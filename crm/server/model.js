import { randomUUID } from 'node:crypto';
import { emailAddress, reject, secret } from './security.js';
import { transaction } from './db.js';

export const defaults = [
  ['new', 'New lead', 'open'], ['contacted', 'Contacted', 'open'], ['replied', 'Replied', 'open'],
  ['demo', 'Demo sent', 'open'], ['proposal', 'Proposal sent', 'open'],
  ['won', 'Won', 'won'], ['lost', 'Lost', 'lost']
].map(([id, name, outcome]) => ({ id, name, outcome }));

export const initialState = () => ({
  contacts: [], deals: [], tasks: [], events: [], messages: [], proposals: [],
  workflows: [], runs: [], forms: [], payments: [], subscriptions: [], activity: [], smsOptOuts: [],
  stages: defaults.map(stage => ({ ...stage })), settings: { timezone: 'America/New_York', inbound: '' }
});

const collections = ['contacts', 'deals', 'tasks', 'events', 'messages', 'proposals', 'workflows', 'forms'];
export const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const now = () => new Date().toISOString();
const dashedDay = date => new Date(date).toISOString().slice(0, 10);
const idOf = value => typeof value === 'string' && /^[\w-]{1,90}$/.test(value);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
export const newRecord = fields => ({ ...fields, id: randomUUID(), version: 1, createdAt: now(), updatedAt: now() });

export function getRecord(state, collection, id) {
  const item = state[collection].find(row => row.id === id);
  if (!item) reject(404, 'Record not found in this workspace.');
  return item;
}

export function text(value, max, label = 'Value', required = false) {
  if (value == null) value = '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    reject(400, `${label} must ${required ? 'be provided and ' : ''}use at most ${max} characters.`);
  }
  return value.trim();
}

const oneOf = (value, options, fallback = options[0]) => {
  if (value == null || value === '') return fallback;
  if (!options.includes(value)) reject(400, 'Select one of the available options.');
  return value;
};

function url(value) {
  const link = text(value, 700);
  if (!link) return '';
  try {
    const parsed = new URL(link);
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* show consistent validation response */ }
  reject(400, 'Enter a valid HTTP or HTTPS link.');
}

function phone(value) {
  const clean = text(value, 40, 'Phone');
  const digits = clean.replace(/[\s().-]/g, '');
  if (!clean) return '';
  const normalized = /^(?:1)?\d{10}$/.test(digits) ? '+' + (digits.length === 10 ? '1' : '') + digits : digits;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) reject(400, 'Enter a US phone number or an international number with country code.');
  return normalized;
}

function dayValue(value, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !dateOnly(value)) reject(400, 'Select a valid date.');
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !dateOnly(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) reject(400, 'Select a valid date and time.');
  return new Date(value).toISOString();
}

function number(value, min, max, label) {
  const result = Number(value ?? min);
  if (!Number.isInteger(result) || result < min || result > max) reject(400, `Enter a valid ${label}.`);
  return result;
}

const regions = ['Northern Virginia','Washington, DC','Maryland','Florida','Other'];
export const sourceOptions = ['Manual','Email outreach','Cold call','Referral','Website','LinkedIn','Google Ads','CSV import','SMS'];
export const stageOf = (state, id) => getRecord(state, 'stages', id);
const stageDefault = state => state.stages.find(stage => stage.outcome === 'open').id;
const contactRef = (state, id, required = true) => (id || required) ? getRecord(state, 'contacts', id).id : '';
const dealRef = (state, id) => getRecord(state, 'deals', id);
const statusPriority = ['Normal','High','Low'];
const tagsOf = value => [...new Set((Array.isArray(value) ? value : text(value, 450).split(',')).map(tag => text(tag, 35)).filter(Boolean))].slice(0, 15);

function contactFields(input) {
  return {
    company: text(input.company, 140, 'Practice or company', true), name: text(input.name, 100),
    email: input.email ? emailAddress(input.email) : '', phone: phone(input.phone), city: text(input.city, 100),
    region: oneOf(input.region, regions, 'Other'), website: url(input.website),
    websiteStatus: oneOf(input.websiteStatus, ['Unknown','Working','Needs improvement','Broken','No website']),
    tags: tagsOf(input.tags), source: oneOf(input.source, sourceOptions),
    notes: text(input.notes, 6000), followUp: dayValue(input.followUp),
    emailAllowed: input.emailAllowed === true, smsAllowed: input.smsAllowed === true
  };
}

const triggerTypes = ['Lead created','Form submitted','Stage changed','Proposal accepted','Payment received','Reply received','Missed call'];
const actionTypes = ['Create task','Add tag','Set follow-up','Draft email','Draft SMS'];

function fields(state, key, input) {
  switch (key) {
    case 'contacts': return contactFields(input);
    case 'deals': return {
      contactId: contactRef(state, input.contactId), title: text(input.title, 140, 'Opportunity name', true),
      stage: stageOf(state, input.stage || stageDefault(state)).id,
      value: number(input.value, 0, 1000000000, 'deal value in cents'),
      mrr: number(input.mrr, 0, 1000000000, 'monthly amount in cents'),
      closeDate: dayValue(input.closeDate), demoUrl: url(input.demoUrl), proposalUrl: url(input.proposalUrl),
      paymentUrl: url(input.paymentUrl), notes: text(input.notes, 5000)
    };
    case 'tasks': return {
      title: text(input.title, 140, 'Task name', true), contactId: contactRef(state, input.contactId, false),
      due: dayValue(input.due, true), priority: oneOf(input.priority, statusPriority),
      done: input.done === true, notes: text(input.notes, 2500)
    };
    case 'events': {
      const startsAt = timestamp(input.startsAt);
      const endsAt = timestamp(input.endsAt);
      if (Date.parse(endsAt) <= Date.parse(startsAt)) reject(400, 'End time must be after start time.');
      return {
        title: text(input.title, 140, 'Meeting name', true), contactId: contactRef(state, input.contactId, false),
        startsAt, endsAt, location: text(input.location, 300), notes: text(input.notes, 2500),
        status: oneOf(input.status, ['Scheduled','Completed','Canceled','No show'])
      };
    }
    case 'messages': {
      const channel = oneOf(input.channel, ['Email','SMS','Call','LinkedIn','Note']);
      const status = oneOf(input.status, ['Draft','Inbound','Logged']);
      if (status === 'Draft' && !['Email','SMS'].includes(channel)) reject(400, 'Only email and SMS can be saved as drafts.');
      return {
        contactId: contactRef(state, input.contactId), channel, status, subject: text(input.subject, 160),
        body: text(input.body, channel === 'SMS' ? 1500 : 6000, 'Message', true)
      };
    }
    case 'proposals': {
      const deal = dealRef(state, input.dealId);
      return {
        dealId: deal.id, contactId: deal.contactId, title: text(input.title, 140, 'Proposal name', true),
        terms: text(input.terms, 12000, 'Proposal terms', true),
        amount: number(input.amount, 0, 1000000000, 'proposal amount in cents'),
        cadence: oneOf(input.cadence, ['One-time','Monthly']),
        expires: dayValue(input.expires), status: oneOf(input.status, ['Draft','Published','Withdrawn'])
      };
    }
    case 'workflows': {
      const action = oneOf(input.action, actionTypes);
      const trigger = oneOf(input.trigger, triggerTypes);
      return {
        title: text(input.title, 100, 'Workflow name', true), trigger, action,
        active: input.active === true, stage: trigger === 'Stage changed' && input.stage ? stageOf(state, input.stage).id : '',
        source: input.source ? oneOf(input.source, sourceOptions) : '',
        value: text(input.value, ({'Draft email': 6000, 'Draft SMS': 1500, 'Add tag': 35, 'Create task': 140})[action] ?? 140, 'Action text', action !== 'Set follow-up'),
        subject: text(input.subject, 160), delay: number(input.delay, 0, 90, 'delay in days')
      };
    }
    case 'forms': return {
      title: text(input.title, 120, 'Form name', true), description: text(input.description, 800),
      active: input.active === true, type: oneOf(input.type, ['Lead inquiry','Booking request']),
      stage: stageOf(state, input.stage || stageDefault(state)).id
    };
    default: reject(404, 'Unknown record type.');
  }
}

export function audit(state, title, actor, { contactId = '', dealId = '', type = 'system' } = {}) {
  state.activity.unshift({ id: randomUUID(), at: now(), title, actor, contactId, dealId, type });
  state.activity = state.activity.slice(0, 1500);
}

export function runWorkflows(state, trigger, context) {
  const contact = state.contacts.find(item => item.id === context.contactId);
  if (!contact) return;
  const rules = state.workflows.filter(rule => rule.active && rule.trigger === trigger
    && (!rule.stage || rule.stage === context.stage) && (!rule.source || rule.source === contact.source));
  for (const rule of rules) {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: state.settings.timezone }).format(new Date());
    const due = dashedDay(Date.parse(today + 'T12:00:00Z') + rule.delay * 86400000);
    if (rule.action === 'Create task') {
      if (state.tasks.length >= 5000) continue;
      state.tasks.unshift(newRecord({ title: rule.value, contactId: contact.id, due, priority: 'Normal', done: false, notes: '' }));
    }
    if (rule.action === 'Add tag') {
      contact.tags = tagsOf([...contact.tags, rule.value]);
      touch(contact);
    }
    if (rule.action === 'Set follow-up') {
      contact.followUp = due;
      touch(contact);
    }
    if (rule.action === 'Draft email' || rule.action === 'Draft SMS') {
      if (state.messages.length >= 5000) continue;
      state.messages.unshift(newRecord({ contactId: contact.id, channel: rule.action === 'Draft email' ? 'Email' : 'SMS',
        status: 'Draft', subject: rule.subject, body: rule.value }));
    }
    state.runs.unshift({ id: randomUUID(), rule: rule.title, contactId: contact.id, at: now(), trigger, action: rule.action });
  }
  state.runs = state.runs.slice(0, 750);
}

export function touch(record) {
  record.updatedAt = now();
  record.version += 1;
}

export async function updateState(db, workspaceId, run, userId = null, roles = []) {
  return transaction(db, async tx => {
    const { rows } = await tx.query('SELECT state FROM crm_workspaces WHERE id=$1 FOR UPDATE', [workspaceId]);
    if (!rows[0]) reject(404, 'Workspace not found.');
    if (userId) {
      const result = await tx.query('SELECT role FROM crm_memberships WHERE workspace_id=$1 AND user_id=$2', [workspaceId, userId]);
      if (!roles.includes(result.rows[0]?.role)) reject(403, 'Your role does not allow this action.');
    }
    const state = { ...initialState(), ...rows[0].state };
    const result = await run(state, tx);
    await tx.query('UPDATE crm_workspaces SET state=$2 WHERE id=$1', [workspaceId, JSON.stringify(state)]);
    return result;
  });
}

export async function publicLink(tx, workspace, kind, recordId, token = secret()) {
  await tx.query('INSERT INTO crm_public_links VALUES ($1,$2,$3,$4)', [token, workspace, kind, recordId]);
  return token;
}

export async function findPublic(db, token, kind) {
  if (!idOf(token)) reject(404, 'This link is unavailable.');
  const { rows } = await db.query(`SELECT l.workspace_id,l.record_id,w.state,w.name
    FROM crm_public_links l JOIN crm_workspaces w ON w.id=l.workspace_id WHERE l.token=$1 AND l.kind=$2`, [token, kind]);
  if (!rows[0]) reject(404, 'This link is unavailable.');
  return rows[0];
}

function duplicateContact(state, contact, ignore) {
  return state.contacts.find(item => item.id !== ignore && (
    (contact.email && item.email === contact.email && item.company.toLowerCase() === contact.company.toLowerCase())
    || (!contact.email && contact.phone && item.phone === contact.phone && item.company.toLowerCase() === contact.company.toLowerCase())
  ));
}

const label = { contacts: 'Contact', deals: 'Opportunity', tasks: 'Task', events: 'Appointment', messages: 'Message', proposals: 'Proposal', workflows: 'Workflow', forms: 'Form' };
const privileged = ['workflows','forms'];

export async function upsert(state, tx, workspaceId, key, input, user) {
  if (!collections.includes(key) || !plain(input)) reject(404, 'Unknown record type.');
  const prior = input.id ? getRecord(state, key, input.id) : null;
  if (prior && input.version !== prior.version) reject(409, 'This record changed. Refresh and try again.');
  if (!prior && state[key].length >= 5000) reject(409, 'This workspace reached its record limit.');
  if (key === 'messages' && prior && !['Draft','Failed'].includes(prior.status)) reject(409, 'This message is part of the conversation history.');
  if (key === 'proposals' && prior && prior.status !== 'Draft') {
    if (prior.status === 'Published' && input.status === 'Withdrawn') {
      prior.status = 'Withdrawn';
      touch(prior);
      audit(state, `Withdrew proposal: ${prior.title}`, user.name, prior);
      return prior;
    }
    reject(409, 'Published terms are fixed. Start a new proposal for revised terms.');
  }
  const valid = fields(state, key, input);
  if (key === 'contacts' && duplicateContact(state, valid, prior?.id)) reject(409, 'A contact with this practice and contact detail already exists.');
  if (key === 'contacts' && (state.smsOptOuts ?? []).includes(valid.phone) && valid.smsAllowed) reject(409, 'This number opted out. It must text START before SMS can be enabled.');
  if (key === 'deals' && prior && prior.contactId !== valid.contactId && (
    state.proposals.some(item => item.dealId === prior.id) || state.payments.some(item => item.dealId === prior.id)
  )) reject(409, 'This opportunity already has billing or proposal history.');
  const previousStage = prior?.stage;
  const previousPhone = prior?.phone;
  const result = prior ? Object.assign(prior, valid) : newRecord(valid);
  if (key === 'contacts' && previousPhone !== valid.phone) result.smsOptedOutAt = (state.smsOptOuts ?? []).includes(valid.phone) ? now() : '';
  if (prior) touch(result);
  else state[key].unshift(result);
  if ((key === 'forms' || (key === 'proposals' && result.status === 'Published')) && !result.linkToken) {
    result.linkToken = await publicLink(tx, workspaceId, key === 'forms' ? 'capture' : 'proposal', result.id);
  }
  const context = { contactId: key === 'contacts' ? result.id : result.contactId, dealId: key === 'deals' ? result.id : result.dealId, stage: result.stage, type: key };
  const name = result.title || result.company || result.subject || result.channel;
  audit(state, `${label[key]} ${prior ? 'updated' : 'added'}: ${name}`, user.name, context);
  if (key === 'contacts' && !prior) runWorkflows(state, 'Lead created', context);
  if (key === 'deals' && previousStage !== result.stage) {
    if (prior) audit(state, `Moved ${result.title} to ${stageOf(state, result.stage).name}`, user.name, context);
    result.enteredAt = now();
    runWorkflows(state, 'Stage changed', context);
  }
  if (key === 'messages' && result.status === 'Inbound') runWorkflows(state, 'Reply received', context);
  return result;
}

export function rolesFor(key) {
  return privileged.includes(key) ? ['owner','admin'] : ['owner','admin','member'];
}

export function remove(state, key, id, version, user) {
  if (!collections.includes(key)) reject(404, 'Unknown record type.');
  const item = getRecord(state, key, id);
  if (item.version !== version) reject(409, 'This record changed. Refresh and try again.');
  if (key === 'contacts' && ['deals','tasks','events','messages','proposals'].some(collection => state[collection].some(row => row.contactId === id))) {
    reject(409, 'This contact has linked records. Resolve them before deleting the contact.');
  }
  if (key === 'deals' && ['proposals','payments'].some(collection => state[collection].some(row => row.dealId === id))) reject(409, 'This opportunity has proposal or payment history.');
  if (key === 'proposals' && item.status !== 'Draft') reject(409, 'Withdraw published proposals to keep their history.');
  if (key === 'messages' && !['Draft','Failed'].includes(item.status)) reject(409, 'Conversation history cannot be deleted here.');
  state[key] = state[key].filter(row => row.id !== id);
  audit(state, `${label[key]} deleted: ${item.title || item.company || item.channel}`, user.name, { contactId: item.contactId, type: key });
}

export async function importContacts(state, tx, workspaceId, rows, user) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) reject(400, 'Import between 1 and 500 rows at a time.');
  let added = 0;
  let duplicates = 0;
  const errors = [];
  for (const [index, row] of rows.entries()) {
    try {
      if (!plain(row)) reject(400, 'Invalid row.');
      const input = contactFields({ ...row, source: row.source || 'CSV import', emailAllowed: false, smsAllowed: false });
      if (duplicateContact(state, input)) {
        duplicates++;
        continue;
      }
      await upsert(state, tx, workspaceId, 'contacts', input, user);
      added++;
    } catch (error) {
      if (!error.status) throw error;
      errors.push({ row: index + 2, message: error.message });
    }
  }
  return { added, duplicates, errors };
}

export async function submitLead(state, tx, workspaceId, formId, input) {
  const form = getRecord(state, 'forms', formId);
  if (!form.active) reject(404, 'This form is closed.');
  if (input.homepage) return { received: true };
  if (!input.email && !input.phone) reject(400, 'Enter an email address or phone number.');
  const notes = text(input.notes, 1200);
  const requested = form.type === 'Booking request' ? dayValue(input.requested, true) : '';
  const contact = contactFields({ company:input.company, name:input.name, email:input.email, phone:input.phone, source:'Website' });
  const match = duplicateContact(state, contact);
  const record = match ?? await upsert(state, tx, workspaceId, 'contacts', contact, { name: 'Website form' });
  if (!match) {
    await upsert(state, tx, workspaceId, 'deals', {
      title: record.company.slice(0, 130) + ' inquiry', contactId: record.id, stage: form.stage, value: 0, mrr: 0
    }, { name: 'Website form' });
  }
  if (notes || requested) await upsert(state, tx, workspaceId, 'messages', {
    contactId: record.id, channel: 'Note', status: 'Logged', subject: form.title,
    body: [requested && `Requested day: ${requested}`, notes].filter(Boolean).join('\n\n')
  }, { name: 'Website form' });
  if (requested) await upsert(state, tx, workspaceId, 'tasks', {
    contactId: record.id, title: 'Confirm booking request: ' + record.company.slice(0, 110), due: requested, priority: 'High'
  }, { name: 'Website form' });
  audit(state, `Form submitted: ${form.title}`, 'Website form', { contactId: record.id, type: 'forms' });
  runWorkflows(state, 'Form submitted', { contactId: record.id });
  return { received: true };
}

export function publicProposal(state, id) {
  const proposal = getRecord(state, 'proposals', id);
  if (!['Published','Accepted'].includes(proposal.status)) reject(404, 'This proposal is unavailable.');
  const company = getRecord(state, 'contacts', proposal.contactId).company;
  const { title, terms, amount, cadence, status, acceptedAt, expires } = proposal;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: state.settings.timezone }).format(new Date());
  return { company, title, terms, amount, cadence, status, acceptedAt, expires, expired: Boolean(expires && expires < today) };
}

export function acceptProposal(state, id, input) {
  const view = publicProposal(state, id);
  const proposal = getRecord(state, 'proposals', id);
  if (view.status === 'Accepted') return { accepted: true };
  if (view.expired) reject(409, 'This proposal has expired.');
  if (input.agree !== true) reject(400, 'Confirm your acceptance.');
  proposal.acceptedBy = text(input.name, 100, 'Your name', true);
  proposal.acceptedAt = now();
  proposal.status = 'Accepted';
  touch(proposal);
  audit(state, `Proposal accepted: ${proposal.title}`, proposal.acceptedBy, proposal);
  runWorkflows(state, 'Proposal accepted', proposal);
  return { accepted: true };
}

export function saveStages(state, rows) {
  if (!Array.isArray(rows) || rows.length < 3 || rows.length > 16) reject(400, 'Use between 3 and 16 stages.');
  if (rows.some(row => !plain(row))) reject(400, 'Each stage must have a name and an outcome.');
  const stages = rows.map(row => ({
    id: state.stages.some(stage => stage.id === row.id) ? row.id : randomUUID(),
    name: text(row.name, 40, 'Stage name', true), outcome: oneOf(row.outcome, ['open','won','lost'])
  }));
  if (new Set(stages.map(row => row.id)).size !== stages.length || new Set(stages.map(row => row.name.toLowerCase())).size !== stages.length) reject(400, 'Stage names and IDs must be unique.');
  if (new Set(stages.map(row => row.outcome)).size !== 3) reject(400, 'Keep an open, won and lost stage.');
  for (const row of [...state.deals, ...state.forms, ...state.workflows]) {
    if (row.stage && !stages.some(stage => stage.id === row.stage)) reject(409, 'Move records out of the stage before removing it.');
  }
  state.stages = stages;
}
