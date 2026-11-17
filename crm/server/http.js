import { audit, acceptProposal, findPublic, getRecord, importContacts, publicLink, publicProposal, remove, rolesFor, saveStages, submitLead, text, updateState, upsert } from './model.js';
import { database, transaction } from './db.js';
import { baseUrl, createWorkspace, day, digest, emailAddress, encodePassword, grantSession, rateLimit, readJson, readRaw, reject, sameOrigin, secret, session, setCookie, validPassword } from './security.js';
import { billingEnabled, checkout, priceIds, stripeWebhook, syncStripe } from './billing.js';
import { communicationStatus, resendInbound, sendMessage, twilioInbound } from './comms.js';

import { authorizeCalendar, calendarCallback, calendarStatus, disconnectCalendar, listGoogleCalendars, selectGoogleCalendar, syncGoogleCalendar, useGoogleAppointment } from './calendar.js';

const managers = ['owner','admin'];
const editors = ['owner','admin','member'];
const membershipRoles = ['admin','member','viewer'];
const providersFor = id => Boolean(process.env.INTEGRATION_WORKSPACE_ID && process.env.INTEGRATION_WORKSPACE_ID === id);

function send(res, status, value, contentType = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(contentType.startsWith('application/json') ? JSON.stringify(value) : value);
}

function requestIp(req) {
  return String(req.headers['x-vercel-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].slice(0, 100);
}

async function memberships(db, uid) {
  const { rows } = await db.query(`SELECT w.id,w.name,m.role FROM crm_memberships m JOIN crm_workspaces w ON w.id=m.workspace_id
    WHERE user_id=$1 ORDER BY w.name`, [uid]);
  return rows;
}

async function workspaceView(db, id, uid) {
  const { rows } = await db.query(`SELECT w.id,w.name,w.state,m.role FROM crm_memberships m JOIN crm_workspaces w ON w.id=m.workspace_id
    WHERE m.workspace_id=$1 AND m.user_id=$2`, [id, uid]);
  const workspace = rows[0];
  if (!workspace) reject(404, 'Workspace not found.');
  const state = workspace.state;
  delete state.smsOptOuts;
  if (!managers.includes(workspace.role)) {
    const { inbound, ...settings } = state.settings;
    state.settings = settings;
  }
  const members = await db.query(`SELECT u.id,u.name,u.email,m.role FROM crm_memberships m
    JOIN crm_users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name`, [id]);
  return { ...workspace, members: members.rows,
    integrations: { google:await calendarStatus(db,id), ...(providersFor(id)
      ? { stripe:billingEnabled(), stripePrices:managers.includes(workspace.role) ? priceIds() : [], ...communicationStatus() }
      : { stripe:false, stripePrices:[], email:false, sms:false, inboundEmail:false }) }
  };
}

async function acceptInvite(db, input) {
  const token = text(input.token, 90, 'Invite', true);
  const address = emailAddress(input.email);
  return transaction(db, async tx => {
    const { rows } = await tx.query('SELECT * FROM crm_invites WHERE token=$1 AND expires_at>now() AND used_at IS NULL FOR UPDATE', [digest(token)]);
    const invite = rows[0];
    if (!invite || invite.email !== address) reject(404, 'This invitation is unavailable for that email address.');
    const existing = await tx.query('SELECT * FROM crm_users WHERE email=$1', [address]);
    const user = existing.rows[0];
    if (user && !await validPassword(input.password, user.password)) reject(401, 'Email or password is incorrect.');
    const userId = user?.id ?? secret();
    if (!user) await tx.query('INSERT INTO crm_users VALUES ($1,$2,$3,$4)', [
      userId, address, text(input.name, 100, 'Your name', true), await encodePassword(input.password)
    ]);
    await tx.query('INSERT INTO crm_memberships VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [invite.workspace_id, userId, invite.role]);
    await tx.query('UPDATE crm_invites SET used_at=now() WHERE token=$1', [digest(token)]);
    return userId;
  });
}

async function workspaceAction(db, ws, route, method, req, user) {
  const [area, key, action] = route;
  if (!area && method === 'GET') return workspaceView(db, ws, user.id);
  if (method !== 'POST') reject(405, 'Method not allowed.');
  const input = await readJson(req);
  const apply = (roles, run) => updateState(db, ws, run, user.id, roles);
  if (area === 'records' && key) {
    const result = await apply(rolesFor(key), async (state, tx) => {
      if (action === 'delete') {
        remove(state, key, input.id, input.version, user);
        if (key === 'forms') await tx.query("DELETE FROM crm_public_links WHERE workspace_id=$1 AND kind='capture' AND record_id=$2", [ws, input.id]);
        return { deleted: true };
      }
      if (action) reject(404, 'Action not found.');
      const result = await upsert(state, tx, ws, key, input, user);
      if (key==='events') {
        const connected=await tx.query('SELECT calendar_id FROM crm_google_connections WHERE workspace_id=$1',[ws]);
        if (connected.rows[0] && (!result.google || result.google.calendarId===connected.rows[0].calendar_id)) {
          result.googleSync='Pending';
        }
      }
      return result;
    });
    if (key==='events' && !action && result.googleSync==='Pending') {
      try { await syncGoogleCalendar(db,ws,user); }
      catch { return {...result,calendarIssue:'Saved in CRM. Google Calendar sync needs attention.'}; }
    }
    return result;
  }
  if (area==='calendar') {
    await workspaceView(db,ws,user.id);
    if (key==='connect') return authorizeCalendar(db,ws,user,req);
    if (key==='calendars') return listGoogleCalendars(db,ws,user);
    if (key==='select') return selectGoogleCalendar(db,ws,user,input);
    if (key==='sync') return syncGoogleCalendar(db,ws,user);
    if (key==='disconnect') return disconnectCalendar(db,ws,user);
    if (key==='resolve') return useGoogleAppointment(db,ws,user,input.id);
    reject(404,'Calendar action not found.');
  }
  if (area==='stripe-sync') {
    const workspace=await workspaceView(db,ws,user.id);
    if (!managers.includes(workspace.role)) reject(403,'Only owners and administrators can sync Stripe.');
    if (!providersFor(ws)) reject(503,'Assign Stripe to this workspace in integration settings first.');
    return syncStripe(db,ws,user,input);
  }
  if (area === 'import') return apply(editors, (state, tx) => importContacts(state, tx, ws, input.rows, user));
  if (area === 'checkout' || area === 'send') {
    await workspaceView(db, ws, user.id);
    if (!providersFor(ws)) reject(503, 'Provider integrations are not configured for this workspace.');
    return area === 'checkout' ? checkout(db, ws, user, input, req) : sendMessage(db, ws, input.id, input.version, user);
  }
  if (area === 'stages') return apply(managers, state => {
    saveStages(state, input.stages);
    audit(state, 'Updated pipeline stages', user.name);
    return state.stages;
  });
  if (area === 'settings') return apply(managers, async (state, tx) => {
    const name = text(input.name, 100, 'Workspace name', true);
    const timezone = text(input.timezone, 100, 'Time zone', true);
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { reject(400, 'Enter a valid IANA time zone, such as America/New_York.'); }
    state.settings.timezone = timezone;
    await tx.query('UPDATE crm_workspaces SET name=$2 WHERE id=$1', [ws, name]);
    audit(state, 'Updated workspace settings', user.name);
    return { saved: true };
  });
  if (area === 'inbound') return apply(managers, async (state, tx) => {
    if (state.settings.inbound && input.rotate !== true) return { token: state.settings.inbound };
    if (state.settings.inbound) await tx.query('DELETE FROM crm_public_links WHERE workspace_id=$1 AND token=$2', [ws, state.settings.inbound]);
    state.settings.inbound = await publicLink(tx, ws, 'inbound', ws);
    audit(state, 'Generated inbound integration address', user.name);
    return { token: state.settings.inbound };
  });
  if (area === 'invite') return apply(managers, async (state, tx) => {
    const address = emailAddress(input.email);
    if (!membershipRoles.includes(input.role)) reject(400, 'Select a team role.');
    const { rows } = await tx.query('SELECT role FROM crm_memberships WHERE workspace_id=$1 AND user_id=$2', [ws, user.id]);
    if (input.role === 'admin' && rows[0]?.role !== 'owner') reject(403, 'Only the owner can invite an administrator.');
    const member = await tx.query(`SELECT 1 FROM crm_memberships m JOIN crm_users u ON u.id=m.user_id
      WHERE m.workspace_id=$1 AND u.email=$2`, [ws, address]);
    if (member.rows.length) reject(409, 'This person is already on the workspace team.');
    await tx.query('UPDATE crm_invites SET expires_at=now() WHERE workspace_id=$1 AND email=$2 AND used_at IS NULL', [ws, address]);
    const token = secret();
    await tx.query('INSERT INTO crm_invites VALUES ($1,$2,$3,$4,$5,NULL)', [digest(token), ws, address, input.role, new Date(Date.now() + 3 * day)]);
    audit(state, 'Created team invitation', user.name);
    return { token };
  });
  if (area === 'member') return apply(['owner'], async (state, tx) => {
    const { rows } = await tx.query('SELECT role FROM crm_memberships WHERE workspace_id=$1 AND user_id=$2', [ws, input.userId]);
    if (!rows[0] || rows[0].role === 'owner') reject(400, 'This membership cannot be changed.');
    if (input.role === 'remove') await tx.query('DELETE FROM crm_memberships WHERE workspace_id=$1 AND user_id=$2', [ws, input.userId]);
    else {
      if (!membershipRoles.includes(input.role)) reject(400, 'Select a team role.');
      await tx.query('UPDATE crm_memberships SET role=$3 WHERE workspace_id=$1 AND user_id=$2', [ws, input.userId, input.role]);
    }
    audit(state, input.role === 'remove' ? 'Removed team access' : 'Changed team permissions', user.name);
    return { saved: true };
  });
  reject(404, 'Action not found.');
}

export function createHandler({ db: provided, demo = false } = {}) {
  return async (req, res) => {
    const method = req.method ?? 'GET';
    const target = req.url;
    try {
      const url = new URL(target, 'http://localhost');
      const path = url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '');
      const [area, key, token, ...rest] = path.split('/').filter(Boolean);
      if (area === 'health' && method === 'GET') return send(res, 200, { ready: Boolean(provided || process.env.DATABASE_URL), demo });
      if (demo) reject(401, 'This preview uses sample data.');
      const db = provided ?? database();
      if (area==='google-calendar' && method==='GET') {
        let target;
        try { target=await calendarCallback(db,req); }
        catch { target=baseUrl(req)+'/?google=error#settings'; }
        res.statusCode=303;
        res.setHeader('Location',target);
        res.setHeader('Cache-Control','no-store');
        res.end();
        return;
      }
      if (area === 'webhook' && method === 'POST') {
        const content = await readRaw(req, 750000, true);
        if (key === 'stripe') return send(res, 200, await stripeWebhook(db, content, req.headers['stripe-signature']));
        const entry = await findPublic(db, token, 'inbound');
        if (!providersFor(entry.workspace_id)) reject(404, 'Provider integrations are not enabled for this workspace.');
        if (key === 'resend') return send(res, 200, await resendInbound(db, entry.workspace_id, req, content));
        if (key === 'sms' || key === 'voice') return send(res, 200, await twilioInbound(db, entry.workspace_id, req, target, content, key), 'text/xml; charset=utf-8');
        reject(404, 'Webhook not found.');
      }
      if (method !== 'GET') sameOrigin(req);
      if (area === 'auth' && key === 'me' && method === 'GET') {
        const user = await session(db, req);
        return send(res, 200, { user: { id: user.id, name: user.name, email: user.email }, workspaces: await memberships(db, user.id) });
      }
      if (area === 'auth' && method === 'POST') {
        const secure = baseUrl(req).startsWith('https:');
        if (key === 'logout') {
          try {
            const user = await session(db, req);
            await db.query('DELETE FROM crm_sessions WHERE token=$1', [user.token]);
          } catch (error) {
            if (error.status !== 401) throw error;
          }
          setCookie(res, '', secure);
          return send(res, 200, { signedOut: true });
        }
        const input = await readJson(req);
        await rateLimit(db, 'auth:' + requestIp(req), 25, 15 * 60000);
        if (key === 'login') {
          const email = emailAddress(input.email);
          await rateLimit(db, 'login:' + email, 12, 15 * 60000);
          const { rows } = await db.query('SELECT * FROM crm_users WHERE email=$1', [email]);
          const user = rows[0];
          if (!await validPassword(input.password, user?.password)) reject(401, 'Email or password is incorrect.');
          await grantSession(db, res, user.id, secure);
          return send(res, 200, { signedIn: true });
        }
        if (key === 'invite') {
          await grantSession(db, res, await acceptInvite(db, input), secure);
          return send(res, 200, { signedIn: true });
        }
      }
      if (area === 'public' && (key === 'proposal' || key === 'capture')) {
        const entry = await findPublic(db, token, key);
        if (method === 'GET') {
          if (key === 'proposal') return send(res, 200, publicProposal(entry.state, entry.record_id));
          const form = getRecord(entry.state, 'forms', entry.record_id);
          if (!form.active) reject(404, 'This form is closed.');
          return send(res, 200, { title: form.title, description: form.description, type: form.type, workspace: entry.name });
        }
        if (method === 'POST') {
          await rateLimit(db, `public:${token}:${requestIp(req)}`, 8, 60 * 60000);
          const input = await readJson(req);
          const result = await updateState(db, entry.workspace_id, (state, tx) => key === 'proposal'
            ? acceptProposal(state, entry.record_id, input)
            : submitLead(state, tx, entry.workspace_id, entry.record_id, input));
          return send(res, 200, result);
        }
      }
      if (area === 'workspaces') {
        const user = await session(db, req);
        if (!key && method === 'POST') {
          const input = await readJson(req);
          const existing = await memberships(db, user.id);
          if (!existing.some(row => row.role === 'owner' || row.role === 'admin')) reject(403, 'Only owners and administrators can create workspaces.');
          await rateLimit(db, 'workspace:' + user.id, 10, day);
          const name = text(input.name, 100, 'Workspace name', true);
          return send(res, 201, await transaction(db, tx => createWorkspace(tx, user.id, name)));
        }
        const result = await workspaceAction(db, key, [token, ...rest], method, req, user);
        return send(res, 200, result);
      }
      reject(404, 'Endpoint not found.');
    } catch (error) {
      if (error.status && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) {
        if (error.status >= 500) console.error('CRM request failed:', error.status);
        return send(res, error.status, { error: error.message });
      }
      if (error.code === '23505') return send(res, 409, { error: 'This account or record already exists.' });
      console.error('CRM request failed:', error.code ?? error.name);
      return send(res, 500, { error: 'The workspace could not complete this request.' });
    }
  };
}
