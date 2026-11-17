import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { transaction } from './db.js';
import { initialState } from './model.js';

const scrypt = promisify(scryptCallback);
export const secret = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const day = 86400000;

export function reject(status, message) {
  throw Object.assign(new Error(message), { status });
}

export function emailAddress(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reject(400, 'Enter a valid email address.');
  return email;
}

async function passwordHash(password, salt = secret()) {
  const key = await scrypt(password, salt, 64);
  return [salt, key.toString('hex')].join('.');
}

export async function encodePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    reject(400, 'Use a password between 8 and 256 characters.');
  }
  return passwordHash(password);
}

export async function validPassword(password, encoded) {
  const stored = encoded ?? ('unknown.' + '0'.repeat(128));
  if (typeof password !== 'string' || password.length > 256) return false;
  const actual = await passwordHash(password, stored.split('.')[0]);
  return timingSafeEqual(Buffer.from(actual), Buffer.from(stored)) && Boolean(encoded);
}

export async function createWorkspace(db, userId, name) {
  const id = secret();
  const state = initialState();
  await db.query('INSERT INTO crm_workspaces VALUES ($1,$2,$3)', [id, name, JSON.stringify(state)]);
  await db.query("INSERT INTO crm_memberships VALUES ($1,$2,'owner')", [id, userId]);
  await db.query(`INSERT INTO crm_provider_bindings(provider,workspace_id)
    SELECT 'primary',$1 WHERE (SELECT count(*) FROM crm_workspaces)=1
    ON CONFLICT DO NOTHING`, [id]);
  return { id, name };
}

export async function bootstrap(db, { email, password, name, workspace }) {
  const address = emailAddress(email);
  return transaction(db, async tx => {
    const id = secret();
    const encoded = await encodePassword(password);
    await tx.query('INSERT INTO crm_users VALUES ($1,$2,$3,$4)', [id, address, name, encoded]);
    return createWorkspace(tx, id, workspace);
  });
}

export async function rateLimit(db, key, limit, durationMs) {
  const now = new Date();
  const until = new Date(now.getTime() + durationMs);
  const { rows } = await db.query(`
    INSERT INTO crm_rate_limits VALUES ($1,1,$2)
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN crm_rate_limits.expires_at <= $3 THEN 1 ELSE crm_rate_limits.hits + 1 END,
      expires_at = CASE WHEN crm_rate_limits.expires_at <= $3 THEN $2 ELSE crm_rate_limits.expires_at END
    RETURNING hits`, [digest(key), until, now]);
  if (rows[0].hits > limit) reject(429, 'Too many requests. Try again later.');
}

export async function session(db, req) {
  const cookie = (req.headers.cookie ?? '').match(/(?:^|;\s*)ksd_session=([\w-]{43})(?:;|$)/);
  if (!cookie) reject(401, 'Sign in to continue.');
  const token = digest(cookie[1]);
  const { rows } = await db.query(`
    SELECT u.id,u.email,u.name FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id
    WHERE s.token=$1 AND s.expires_at>now()`, [token]);
  if (!rows[0]) reject(401, 'Your session has expired. Sign in again.');
  return { ...rows[0], token };
}

export function setCookie(res, token, secure) {
  res.setHeader('Set-Cookie', `ksd_session=${token}; Path=/; Max-Age=${token ? 86400 : 0}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
}

export async function grantSession(db, res, userId, secure) {
  const token = secret();
  await db.query('INSERT INTO crm_sessions VALUES ($1,$2,$3)', [digest(token), userId, new Date(Date.now() + day)]);
  setCookie(res, token, secure);
}

export function baseUrl(req) {
  if (process.env.APP_URL) return new URL(process.env.APP_URL).origin;
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`).origin;
  return `http://${req.headers.host ?? 'localhost'}`;
}

export function sameOrigin(req) {
  if (req.headers.origin && req.headers.origin !== baseUrl(req)) reject(403, 'Request origin is invalid.');
  if (req.headers['sec-fetch-site'] === 'cross-site') reject(403, 'Request origin is invalid.');
}

export async function readRaw(req, max = 750000, streamOnly = false) {
  if (!streamOnly && Buffer.isBuffer(req.body)) {
    if (req.body.length > max) reject(413, 'Request is too large.');
    return req.body;
  }
  if (!streamOnly && typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > max) reject(413, 'Request is too large.');
    return Buffer.from(req.body);
  }
  if (!streamOnly && req.body && typeof req.body === 'object') reject(400, 'Raw request body is unavailable.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) reject(413, 'Request is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) reject(415, 'Send JSON data.');
  let body;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    body = req.body;
    if (Buffer.byteLength(JSON.stringify(body)) > 750000) reject(413, 'Request is too large.');
  } else {
    try {
      const raw = await readRaw(req);
      body = JSON.parse(raw.toString('utf8'));
    } catch (error) {
      if (error.status) throw error;
      reject(400, 'Request contains invalid JSON.');
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject(400, 'Send a JSON object.');
  return body;
}
