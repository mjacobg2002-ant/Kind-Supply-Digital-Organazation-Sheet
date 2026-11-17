import { createHmac, timingSafeEqual } from 'node:crypto';
import { audit, getRecord, newRecord, runWorkflows, text, touch, updateState } from './model.js';
import { baseUrl, reject } from './security.js';

const twilioReady = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
const resendReady = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

export function communicationStatus() {
  return { email: resendReady(), sms: twilioReady(), inboundEmail: Boolean(process.env.RESEND_WEBHOOK_SECRET && process.env.RESEND_API_KEY) };
}

async function providerSend(message) {
  const email = message.channel === 'Email';
  if (email) {
    return fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'crm-message-' + message.id + '-' + message.attempt },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to: [message.to], subject: message.subject, text: message.body })
    });
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authorization = Buffer.from(sid + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64');
  return fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { Authorization: 'Basic ' + authorization },
    body: new URLSearchParams({ From: process.env.TWILIO_FROM, To: message.to, Body: message.body })
  });
}

export async function sendMessage(db, workspace, id, version, user) {
  const reservation = await updateState(db, workspace, state => {
    const message = getRecord(state, 'messages', id);
    if (message.version !== version) reject(409, 'This message changed. Open the latest draft.');
    if (message.status !== 'Draft') reject(409, 'Only drafts can be sent.');
    const contact = getRecord(state, 'contacts', message.contactId);
    const email = message.channel === 'Email';
    const ready = email ? resendReady() : twilioReady();
    if (!ready) reject(503, 'Configure this messaging integration first.');
    const to = email ? contact.email : contact.phone;
    if (!to || !(email ? contact.emailAllowed : contact.smsAllowed && !(state.smsOptOuts ?? []).includes(to))) reject(400, 'Add a recipient address or number and confirm contact permission first.');
    if (email) text(message.subject, 160, 'Subject', true);
    message.status = 'Sending';
    message.attempt = (message.attempt ?? 0) + 1;
    touch(message);
    return { ...message, to };
  }, user.id, ['owner','admin','member']);
  let status = 'Needs review';
  let providerId = '';
  try {
    const result = await providerSend(reservation);
    if (result.ok) {
      const provider = await result.json();
      providerId = provider.id ?? provider.sid ?? '';
      if (providerId) status = 'Submitted';
    } else if (result.status < 500) status = 'Failed';
  } catch {
    // A timeout can occur after provider acceptance. Never automatically resend an ambiguous attempt.
  }
  return updateState(db, workspace, state => {
    const message = getRecord(state, 'messages', id);
    message.status = status;
    message.providerId = providerId;
    touch(message);
    audit(state, `${message.channel} ${status.toLowerCase()}`, user.name, message);
    return message;
  });
}

function secureEqual(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

async function recordInbound(db, workspace, provider, id, input) {
  await updateState(db, workspace, async (state, tx) => {
    if (!id) return;
    const { rows } = await tx.query('INSERT INTO crm_provider_events(provider,id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id', [provider, workspace + '-' + id]);
    if (!rows.length) return;
    const attribute = input.channel === 'Email' ? 'email' : 'phone';
    const matches = state.contacts.filter(item => item[attribute] === input.from);
    if (input.channel === 'SMS' && input.opt && /^\+[1-9]\d{7,14}$/.test(input.from)) {
      const optedOut = (state.smsOptOuts ?? []).filter(number => number !== input.from);
      state.smsOptOuts = input.opt === 'STOP' ? [...optedOut,input.from] : optedOut;
      for (const contact of matches) {
        contact.smsAllowed = false;
        contact.smsOptedOutAt = input.opt === 'STOP' ? new Date().toISOString() : '';
        touch(contact);
        audit(state, input.opt === 'STOP' ? 'SMS opt-out recorded' : 'SMS opt-out cleared; permission review required', 'Twilio', { contactId: contact.id });
      }
      return;
    }
    if (matches.length !== 1) {
      audit(state, `Unmatched inbound ${input.channel.toLowerCase()}: ${input.from}`, provider);
      return;
    }
    const contactId = matches[0].id;
    if (state.messages.length >= 5000) {
      audit(state, 'Inbound message received after reaching the message limit', provider, { contactId });
      return;
    }
    state.messages.unshift(newRecord({
      contactId, channel: input.channel, status: 'Inbound', subject: input.subject,
      body: input.body.slice(0, 6000), providerId: id
    }));
    audit(state, input.subject || `Received ${input.channel}`, provider, { contactId, type: 'messages' });
    runWorkflows(state, input.channel === 'Call' ? 'Missed call' : 'Reply received', { contactId });
  });
}

export async function twilioInbound(db, workspace, req, target, raw, kind) {
  if (!twilioReady()) reject(503, 'Twilio is not configured.');
  const params = new URLSearchParams(raw.toString('utf8'));
  const encoded = [...new Set(params.keys())].sort().map(key => key + [...new Set(params.getAll(key))].sort().join(key)).join('');
  const expected = createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(baseUrl(req) + target + encoded).digest('base64');
  if (!secureEqual(expected, req.headers['x-twilio-signature'] ?? '')) reject(400, 'Invalid Twilio signature.');
  if (params.get('AccountSid') !== process.env.TWILIO_ACCOUNT_SID) reject(400, 'Unknown provider account.');
  if (kind === 'voice') {
    const status = params.get('CallStatus');
    if (['busy','no-answer','failed','canceled'].includes(status)) {
      await recordInbound(db, workspace, 'Twilio', params.get('CallSid'), {
        channel: 'Call', from: params.get('From') ?? '', subject: 'Missed call', body: 'Twilio status: ' + status
      });
    }
  } else {
    const body = params.get('Body') ?? '';
    const keyword = params.get('OptOutType') || body.trim().toUpperCase();
    const opt = ['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT'].includes(keyword) ? 'STOP' : ['START','UNSTOP'].includes(keyword) ? 'START' : '';
    await recordInbound(db, workspace, 'Twilio', params.get('MessageSid'), {
      channel: 'SMS', from: params.get('From') ?? '', subject: '', body: body || 'Media message. Review it in Twilio.', opt
    });
  }
  return '<Response></Response>';
}

export async function resendInbound(db, workspace, req, raw) {
  const signingKey = process.env.RESEND_WEBHOOK_SECRET;
  if (!signingKey || !process.env.RESEND_API_KEY) reject(503, 'Inbound email is not configured.');
  const id = req.headers['svix-id'] ?? '';
  const timestamp = req.headers['svix-timestamp'] ?? '';
  const signatures = req.headers['svix-signature'] ?? '';
  if (!id || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) reject(400, 'Invalid email webhook timestamp.');
  const expected = createHmac('sha256', Buffer.from(signingKey.replace(/^whsec_/, ''), 'base64')).update(`${id}.${timestamp}.`).update(raw).digest('base64');
  if (!signatures.split(' ').some(sig => sig.startsWith('v1,') && secureEqual(expected, sig.slice(3)))) reject(400, 'Invalid email webhook signature.');
  let event;
  try { event = JSON.parse(raw); } catch { reject(400, 'Invalid email webhook.'); }
  if (event.type !== 'email.received' || !event.data?.email_id) return { received: true };
  const response = await fetch('https://api.resend.com/emails/receiving/' + encodeURIComponent(event.data.email_id), {
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }, signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) reject(502, 'Could not load inbound email.');
  const email = await response.json();
  const sender = (email.from ?? event.data.from ?? '').trim();
  const from = (sender.match(/<([^>]+)>/)?.[1] ?? sender).toLowerCase();
  await recordInbound(db, workspace, 'Resend', event.data.email_id, {
    channel: 'Email', from, subject: String(email.subject ?? '').slice(0, 160),
    body: typeof email.text === 'string' && email.text ? email.text : 'No plain-text body. Review the original email in Resend.'
  });
  return { received: true };
}
