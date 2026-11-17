import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { audit, newRecord, touch, updateState } from './model.js';
import { transaction } from './db.js';
import { baseUrl, digest, reject, secret, session } from './security.js';

const scopes = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
const calendarApi = 'https://www.googleapis.com/calendar/v3';
const managers = ['owner','admin'];
const encryptionKey = () => {
  const value = Buffer.from(process.env.CALENDAR_ENCRYPTION_KEY ?? '', 'base64');
  if (value.length !== 32) reject(503, 'The calendar encryption key needs to be configured.');
  return value;
};
export const calendarReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.CALENDAR_ENCRYPTION_KEY);
export const calendarRedirect = req => baseUrl(req) + '/api/google-calendar';

export function sealTokens(tokens) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const content = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv,cipher.getAuthTag(),content].map(part => part.toString('base64url')).join('.');
}
function openTokens(value) {
  const [iv,tag,body] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8'));
}
async function permission(db, workspace, user, roles = managers) {
  const { rows } = await db.query('SELECT role FROM crm_memberships WHERE workspace_id=$1 AND user_id=$2',[workspace,user.id]);
  if (!roles.includes(rows[0]?.role)) reject(403, 'Your role does not allow calendar management.');
}
export async function calendarStatus(db, workspace) {
  const { rows } = await db.query('SELECT calendar_id,calendar_name,calendar_timezone,last_sync,issue FROM crm_google_connections WHERE workspace_id=$1',[workspace]);
  const row = rows[0];
  return { configured:calendarReady(), connected:Boolean(row), calendarId:row?.calendar_id,
    name:row?.calendar_name, timezone:row?.calendar_timezone, lastSync:row?.last_sync, issue:row?.issue || '' };
}
export async function authorizeCalendar(db, workspace, user, req) {
  await permission(db,workspace,user);
  if (!calendarReady()) reject(503,'Add the Google OAuth client ID and client secret to finish calendar setup.');
  encryptionKey();
  const token = secret();
  await db.query('DELETE FROM crm_google_oauth WHERE expires_at<=now() OR (workspace_id=$1 AND user_id=$2)',[workspace,user.id]);
  await db.query('INSERT INTO crm_google_oauth VALUES ($1,$2,$3,$4)',[digest(token),workspace,user.id,new Date(Date.now()+600000)]);
  const params = new URLSearchParams({
    client_id:process.env.GOOGLE_CLIENT_ID, redirect_uri:calendarRedirect(req), response_type:'code',
    scope:scopes.join(' '), access_type:'offline', prompt:'consent', include_granted_scopes:'true', state:token, login_hint:user.email
  });
  return { url:'https://accounts.google.com/o/oauth2/v2/auth?' + params };
}
async function tokenRequest(params) {
  const response = await fetch('https://oauth2.googleapis.com/token',{
    method:'POST', signal:AbortSignal.timeout(9000), body:new URLSearchParams({
      client_id:process.env.GOOGLE_CLIENT_ID, client_secret:process.env.GOOGLE_CLIENT_SECRET, ...params
    })
  });
  const result = await response.json();
  if (!response.ok) reject(401,'Reconnect Google Calendar to restore access.');
  return result;
}
export async function calendarCallback(db, req) {
  if (!calendarReady()) reject(503,'Google Calendar setup is incomplete.');
  const url = new URL(req.url,baseUrl(req));
  const user = await session(db,req);
  const state = url.searchParams.get('state') ?? '';
  const { rows } = await db.query('DELETE FROM crm_google_oauth WHERE token=$1 AND user_id=$2 AND expires_at>now() RETURNING workspace_id',[digest(state),user.id]);
  if (!rows[0]) reject(400,'This Google connection link has expired. Start again from Settings.');
  const workspace = rows[0].workspace_id;
  await permission(db,workspace,user);
  if (url.searchParams.has('error')) return baseUrl(req) + '/?google=denied#settings';
  const code = url.searchParams.get('code');
  if (!code) reject(400,'Google did not return an authorization code.');
  const tokens = await tokenRequest({code,redirect_uri:calendarRedirect(req),grant_type:'authorization_code'});
  if (!tokens.refresh_token || !scopes.every(scope => String(tokens.scope ?? '').split(' ').includes(scope))) {
    reject(400,'Grant calendar event and calendar list access when connecting Google.');
  }
  const sealed = sealTokens({access:tokens.access_token,refresh:tokens.refresh_token,expires:Date.now()+tokens.expires_in*1000});
  await updateState(db,workspace,async (state,tx) => {
    await tx.query(`INSERT INTO crm_google_connections(workspace_id,user_id,tokens,connection_id) VALUES($1,$2,$3,$4)
      ON CONFLICT(workspace_id) DO UPDATE SET user_id=$2,tokens=$3,connection_id=$4,sync_token=NULL,sync_query=NULL,sync_seen=NULL,full_sync_at=NULL,last_sync=NULL,calendar_id='primary',calendar_name='Primary calendar',issue=''`,
    [workspace,user.id,sealed,secret()]);
    audit(state,'Connected Google Calendar',user.name);
  },user.id,managers);
  return baseUrl(req) + '/?google=connected#settings';
}
async function connection(db, workspace) {
  return transaction(db,async tx => {
    const { rows } = await tx.query('SELECT * FROM crm_google_connections WHERE workspace_id=$1 FOR UPDATE',[workspace]);
    const row = rows[0];
    if (!row) reject(409,'Connect Google Calendar first.');
    const tokens = openTokens(row.tokens);
    if (tokens.expires < Date.now()+60000) {
      const refreshed = await tokenRequest({refresh_token:tokens.refresh,grant_type:'refresh_token'});
      tokens.access = refreshed.access_token;
      tokens.expires = Date.now()+refreshed.expires_in*1000;
      if (refreshed.refresh_token) tokens.refresh = refreshed.refresh_token;
      await tx.query('UPDATE crm_google_connections SET tokens=$2 WHERE workspace_id=$1',[workspace,sealTokens(tokens)]);
    }
    return {...row,access:tokens.access};
  });
}
async function google(conn, path, options = {}) {
  const response = await fetch(calendarApi + path,{
    ...options, signal:AbortSignal.timeout(9000),
    headers:{Authorization:'Bearer ' + conn.access,'Content-Type':'application/json',...options.headers}
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('Google Calendar could not complete the request.'),{googleStatus:response.status});
  return body;
}
export async function listGoogleCalendars(db,workspace,user) {
  await permission(db,workspace,user);
  const conn = await connection(db,workspace);
  const result = await google(conn,'/users/me/calendarList?minAccessRole=writer&maxResults=250');
  return {calendars:(result.items ?? []).map(item=>({id:item.id,name:item.summary,timezone:item.timeZone,primary:item.primary}))};
}
export async function selectGoogleCalendar(db,workspace,user,input) {
  const { calendars } = await listGoogleCalendars(db,workspace,user);
  const chosen = calendars.find(item=>item.id === input.calendarId);
  if (!chosen) reject(400,'Choose a calendar with permission to create appointments.');
  const result = await db.query(`UPDATE crm_google_connections SET calendar_id=$2,calendar_name=$3,calendar_timezone=$4,
    sync_token=NULL,sync_query=NULL,sync_seen=NULL,full_sync_at=NULL,last_sync=NULL,issue='' WHERE workspace_id=$1 AND (sync_until IS NULL OR sync_until<now()) RETURNING workspace_id`,
  [workspace,chosen.id,chosen.name,chosen.timezone || 'UTC']);
  if (!result.rows.length) reject(409,'Wait for the current calendar sync to finish before changing calendars.');
  return calendarStatus(db,workspace);
}

export function googleAppointment(event, contacts = [], timezone = 'UTC') {
  if (!event.start || !event.end) return null;
  const allDay = Boolean(event.start.date);
  const startsAt = event.start.dateTime || event.start.date + 'T00:00:00Z';
  const endsAt = event.end.dateTime || event.end.date + 'T00:00:00Z';
  if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))) return null;
  const addresses = (event.attendees ?? []).map(item=>item.email?.toLowerCase()).filter(Boolean);
  const matches = contacts.filter(item=>item.email && addresses.includes(item.email.toLowerCase()));
  return { title:(event.summary || 'Busy').slice(0,140), startsAt:new Date(startsAt).toISOString(),endsAt:new Date(endsAt).toISOString(),
    allDay, allDayStart:event.start.date || '',allDayEnd:event.end.date || '',googleTimezone:event.start.timeZone || timezone,
    location:(event.location || '').slice(0,300),notes:(event.description || '').slice(0,2500),
    contactId:matches.length === 1 ? matches[0].id : '',status:event.status === 'cancelled' ? 'Canceled' : 'Scheduled' };
}
const googleEventId = (workspace,id) => 'ksd' + createHash('sha256').update(workspace+':'+id).digest('hex');
const googlePath = conn => '/calendars/' + encodeURIComponent(conn.calendar_id) + '/events';

async function pushAppointment(db,workspace,conn,event) {
  if (event.google && event.google.calendarId !== conn.calendar_id) return;
  const id = event.google?.id || googleEventId(workspace,event.id);
  const date = {start:event.allDay ? {date:event.allDayStart} : {dateTime:event.startsAt},
    end:event.allDay ? {date:event.allDayEnd} : {dateTime:event.endsAt}};
  const body = {summary:event.title,location:event.location,description:event.notes,...date,
    status:event.status === 'Canceled' ? 'cancelled' : 'confirmed',
    extendedProperties:{private:{ksdWorkspace:workspace,ksdEvent:event.id}}};
  let remote;
  try {
    if (event.google) {
      remote = await google(conn,googlePath(conn)+'/'+encodeURIComponent(id)+'?sendUpdates=none',{
        method:'PATCH',headers:{'If-Match':event.google.etag || '*'},body:JSON.stringify(body)
      });
    } else {
      try {
        remote = await google(conn,googlePath(conn)+'?sendUpdates=none',{method:'POST',body:JSON.stringify({...body,id})});
      } catch(error) {
        if (error.googleStatus !== 409) throw error;
        remote = await google(conn,googlePath(conn)+'/'+encodeURIComponent(id));
        if (remote.extendedProperties?.private?.ksdWorkspace !== workspace || remote.extendedProperties?.private?.ksdEvent !== event.id) throw error;
        remote = await google(conn,googlePath(conn)+'/'+encodeURIComponent(id)+'?sendUpdates=none',{
          method:'PATCH',headers:{'If-Match':remote.etag},body:JSON.stringify(body)
        });
      }
    }
    await updateState(db,workspace,state=>{
      const row = state.events.find(item=>item.id === event.id);
      if (!row) return;
      row.google = {id,calendarId:conn.calendar_id,etag:remote.etag,updated:remote.updated,url:remote.htmlLink};
      row.googleSync = row.version === event.version ? 'Synced' : 'Pending';
    });
  } catch(error) {
    await updateState(db,workspace,state=>{
      const row = state.events.find(item=>item.id === event.id);
      if (row && row.version === event.version) row.googleSync = [412,404,410].includes(error.googleStatus) ? 'Conflict' : 'Pending';
    });
    if (![412,404,410].includes(error.googleStatus)) throw error;
  }
}

export async function syncGoogleCalendar(db,workspace,user) {
  await permission(db,workspace,user,['owner','admin','member']);
  const lease = await db.query(`UPDATE crm_google_connections SET sync_until=now()+interval '2 minutes'
    WHERE workspace_id=$1 AND (sync_until IS NULL OR sync_until<now()) RETURNING workspace_id`,[workspace]);
  if (!lease.rows.length) reject(409,'Calendar sync is already running or the calendar is disconnected.');
  let imported = 0;
  try {
    const conn = await connection(db,workspace);
    if (!conn.sync_query && (!conn.full_sync_at || Date.now()-new Date(conn.full_sync_at).getTime()>86400000)) conn.sync_token=null;
    const snapshot = await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[workspace]);
    const pending = snapshot.rows[0].state.events.filter(event=>event.googleSync === 'Pending' && (!event.google || event.google.calendarId===conn.calendar_id));
    const deadline=Date.now()+17000;
    let processed=0;
    for (const event of pending.slice(0,8)) {
      if (Date.now()>deadline-9000) break;
      await pushAppointment(db,workspace,conn,event);
      processed++;
    }
    if (Date.now()>deadline-9000) return {imported,pending:Math.max(0,pending.length-processed),more:true};
    const query = new URLSearchParams(conn.sync_query || {singleEvents:'true',showDeleted:'true',maxResults:'250'});
    if (!conn.sync_query && conn.sync_token) query.set('syncToken',conn.sync_token);
    else if (!conn.sync_query) {
      query.set('timeMin',new Date(Date.now()-90*86400000).toISOString());
      query.set('timeMax',new Date(Date.now()+365*86400000).toISOString());
    }
    const fullSync=!query.has('syncToken');
    const seen=new Set(conn.sync_query ? conn.sync_seen || [] : []);
    let response;
    let page = 0;
    do {
      try { response = await google(conn,googlePath(conn)+'?'+query); }
      catch(error) {
        if (error.googleStatus === 410 && query.has('syncToken')) {
          await db.query('UPDATE crm_google_connections SET sync_token=NULL,sync_query=NULL,sync_seen=NULL WHERE workspace_id=$1',[workspace]);
          reject(409,'Google requested a full refresh. Select Sync Google again.');
        }
        throw error;
      }
      for (const item of response.items ?? []) seen.add(item.id);
      await updateState(db,workspace,state=>{
        for (const item of response.items ?? []) {
          let row = state.events.find(event=>event.google?.id === item.id && event.google.calendarId === conn.calendar_id);
          if (row?.googleSync === 'Pending' || row?.googleSync === 'Conflict') continue;
          if (item.status === 'cancelled') {
            if (row && row.status !== 'Canceled') {row.status='Canceled';touch(row);}
            continue;
          }
          const values = googleAppointment(item,state.contacts,conn.calendar_timezone);
          if (!values) continue;
          if (!row && (Date.parse(values.startsAt)<Date.now()-90*86400000 || Date.parse(values.startsAt)>Date.now()+365*86400000)) continue;
          if (!row) {
            if (state.events.length>=5000) reject(409,'The workspace appointment limit has been reached.');
            row = newRecord(values);state.events.unshift(row);imported++;
          } else if (row.google.updated !== item.updated) {
            Object.assign(row,{...values,contactId:row.contactId || values.contactId,
              status:['Completed','No show'].includes(row.status) ? row.status : values.status});
            touch(row);
          }
          row.google = {id:item.id,calendarId:conn.calendar_id,etag:item.etag,updated:item.updated,url:item.htmlLink};
          row.googleSync='Synced';
        }
      });
      if (response.nextPageToken) query.set('pageToken',response.nextPageToken);
      page++;
      if (Date.now()>deadline-9000) break;
    } while (response.nextPageToken && page<2);
    if (response.nextPageToken) {
      await db.query('UPDATE crm_google_connections SET sync_query=$2,sync_seen=$3 WHERE workspace_id=$1',[workspace,JSON.stringify(Object.fromEntries(query)),JSON.stringify([...seen])]);
      return {imported,pending:Math.max(0,pending.length-processed),more:true};
    }
    if (fullSync) await updateState(db,workspace,state=>{
      const start=Date.parse(query.get('timeMin'));
      const end=Date.parse(query.get('timeMax'));
      for (const row of state.events) {
        if (row.google?.calendarId===conn.calendar_id && row.googleSync==='Synced' && row.status!=='Canceled'
          && Date.parse(row.endsAt)>start && Date.parse(row.startsAt)<end && !seen.has(row.google.id)) {
          row.status='Canceled';touch(row);
        }
      }
    });
    await db.query(`UPDATE crm_google_connections SET sync_token=$2,sync_query=NULL,sync_seen=NULL,last_sync=now(),
      full_sync_at=CASE WHEN $3 THEN now() ELSE full_sync_at END,issue='' WHERE workspace_id=$1`,
    [workspace,response.nextSyncToken || null,fullSync]);
    return {imported,pending:Math.max(0,pending.length-processed)};
  } catch(error) {
    const message = error.status ? error.message : 'Calendar sync needs attention. Try again or reconnect Google.';
    await db.query('UPDATE crm_google_connections SET issue=$2 WHERE workspace_id=$1',[workspace,message]);
    if (error.status) throw error;
    reject(502,message);
  } finally {
    await db.query('UPDATE crm_google_connections SET sync_until=NULL WHERE workspace_id=$1',[workspace]);
  }
}
export async function disconnectCalendar(db,workspace,user) {
  await permission(db,workspace,user);
  await updateState(db,workspace,async (state,tx)=>{
    await tx.query('DELETE FROM crm_google_connections WHERE workspace_id=$1',[workspace]);
    await tx.query('DELETE FROM crm_google_oauth WHERE workspace_id=$1',[workspace]);
    audit(state,'Disconnected Google Calendar',user.name);
  },user.id,managers);
  return {disconnected:true};
}
export async function useGoogleAppointment(db,workspace,user,eventId) {
  await permission(db,workspace,user,['owner','admin','member']);
  const conn = await connection(db,workspace);
  const snapshot = await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[workspace]);
  const event = snapshot.rows[0].state.events.find(item=>item.id === eventId);
  if (!event?.google || event.google.calendarId !== conn.calendar_id) reject(404,'This appointment is not linked to the selected calendar.');
  let remote;
  try {remote=await google(conn,googlePath(conn)+'/'+encodeURIComponent(event.google.id));}
  catch(error) {if (![404,410].includes(error.googleStatus)) throw error; remote={status:'cancelled'};}
  return updateState(db,workspace,state=>{
    const row=state.events.find(item=>item.id === eventId);
    if (!row || row.version !== event.version) reject(409,'This appointment changed. Refresh it before resolving.');
    if (remote.status === 'cancelled') row.status='Canceled';
    else {
      const values=googleAppointment(remote,state.contacts,conn.calendar_timezone);
      if (!values) reject(400,'Google returned an appointment without a valid time.');
      Object.assign(row,{...values,contactId:row.contactId || values.contactId});
      row.google={...row.google,etag:remote.etag,updated:remote.updated};
    }
    row.googleSync='Synced';touch(row);
    return row;
  },user.id,['owner','admin','member']);
}
