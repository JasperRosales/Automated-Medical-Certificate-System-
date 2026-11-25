// Shared helpers for the API functions (files starting with _ are not routes).
import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL);

const DEFAULT_PASSWORD = 'Admin001100';
const SESSION_HOURS = 12;
const COOKIE = 'medcert_session';

export const DEFAULT_SETTINGS = {
  physician: '',
  position: '',
  license: '',
  controlPrefix: 'MC',
  nextControl: 1,
  formPrefix: 'MF',
  nextFormControl: 1,
  diagnosisOptions: [],
  remarksOptions: [],
  purposeOptions: []
};

// Quick-pick list: accepts an array or newline-separated text.
const optionList = a => (Array.isArray(a) ? a : String(a ?? '').split('\n'))
  .map(x => String(x).trim().slice(0, 200)).filter(Boolean)
  .filter((x, i, all) => all.indexOf(x) === i).slice(0, 100);

/* ---------------- Schema (created on first use) ---------------- */
let ready;
export function ensureSchema() {
  ready ??= (async () => {
    await sql`create table if not exists requests (
      id uuid primary key default gen_random_uuid(),
      ref text unique not null,
      status text not null default 'pending',
      name text not null,
      age text not null,
      sex text not null,
      civil_status text not null,
      address text not null,
      date text not null,
      cert jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz,
      approved_at timestamptz
    )`;
    await sql`alter table requests add column if not exists type text not null default 'certificate'`;
    await sql`create table if not exists settings (key text primary key, value jsonb not null)`;
  })().catch(e => { ready = undefined; throw e; });
  return ready;
}

/* ---------------- Records ---------------- */
export const toRecord = r => ({
  id: r.id,
  ref: r.ref,
  type: r.type || 'certificate',
  status: r.status,
  name: r.name,
  age: r.age,
  sex: r.sex,
  civilStatus: r.civil_status,
  address: r.address,
  date: r.date,
  cert: r.cert || {},
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
  approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : null
});

const LIMITS = { name: 120, age: 3, sex: 20, civilStatus: 20, address: 200, date: 40 };
const CERT_KEYS = ['controlNo', 'issueDate', 'consultDate', 'diagnosis', 'remarks1', 'remarks2',
  'purpose', 'signatoryName', 'signatoryTitle', 'license', 'validUntil'];

// Medical (pre-employment/OJT exam) form fields kept in the cert json
const MF_KEYS = ['last', 'first', 'middle', 'formDate', 'birthday', 'cellphone', 'tel', 'position', 'institution',
  'weight', 'height', 'examDate', 'sigDate', 'bp', 'hr', 'hearing', 'vision', 'visR', 'visL', 'xray', 'xrayDate',
  'cbc', 'cbcFind', 'ua', 'uaFind', 'meth', 'thc', 'drugDate', 'cls', 'mfRemarks', 'physician', 'physDate'];
const MF_KEY_RE = /^(pe\d{1,2}[nf]|pmh[1-4]|fh[1-4]|oh[12])$/;
const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

// Trim and length-limit patient fields; returns null for anything not a string.
export function cleanPatient(body, { partial = false } = {}) {
  const out = {};
  for (const [k, max] of Object.entries(LIMITS)) {
    if (body[k] === undefined && partial) continue;
    if (typeof body[k] !== 'string') return null;
    out[k] = body[k].trim().slice(0, max);
  }
  return out;
}

export function cleanCert(cert) {
  const out = {};
  if (!cert || typeof cert !== 'object') return out;
  for (const [k, v] of Object.entries(cert)) {
    if (typeof v !== 'string') continue;
    if (CERT_KEYS.includes(k) || MF_KEYS.includes(k) || MF_KEY_RE.test(k)) out[k] = v.slice(0, 300);
    else if (k === 'photoAt' && /^\d{1,15}$/.test(v)) out[k] = v;
    else if (k === 'photo' && (v === '' || (v.length < 400000 && PHOTO_RE.test(v)))) out[k] = v;
  }
  return out;
}

// Medical form photos are kept for one day only, so the request list stays light
export const PHOTO_TTL_MS = 24 * 3600e3;
export async function expirePhotos() {
  const cutoff = Date.now() - PHOTO_TTL_MS;
  await sql`update requests set cert = cert - 'photo' - 'photoAt'
    where cert ? 'photo' and coalesce(nullif(cert->>'photoAt', '')::bigint, 0) < ${cutoff}`;
}

/* ---------------- Settings ---------------- */
export async function getSettings() {
  const rows = await sql`select value from settings where key = 'general'`;
  return { ...DEFAULT_SETTINGS, ...(rows[0]?.value || {}) };
}

export async function saveSettings(s) {
  const v = {
    physician: String(s.physician ?? '').slice(0, 120),
    position: String(s.position ?? '').slice(0, 120),
    license: String(s.license ?? '').slice(0, 60),
    controlPrefix: String(s.controlPrefix ?? '').slice(0, 20),
    nextControl: Math.max(1, parseInt(s.nextControl, 10) || 1),
    formPrefix: String(s.formPrefix ?? '').slice(0, 20),
    nextFormControl: Math.max(1, parseInt(s.nextFormControl, 10) || 1),
    diagnosisOptions: optionList(s.diagnosisOptions),
    remarksOptions: optionList(s.remarksOptions),
    purposeOptions: optionList(s.purposeOptions)
  };
  await sql`insert into settings (key, value) values ('general', ${JSON.stringify(v)}::jsonb)
            on conflict (key) do update set value = excluded.value`;
  return v;
}

/* ---------------- Password ---------------- */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');

export async function checkPassword(pw) {
  if (typeof pw !== 'string' || !pw) return false;
  const rows = await sql`select value from settings where key = 'admin_password'`;
  const stored = rows[0]?.value;
  if (!stored) return safeEqual(pw, DEFAULT_PASSWORD);
  return safeEqual(hashPw(pw, stored.salt), stored.hash);
}

export async function setPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const value = JSON.stringify({ salt, hash: hashPw(pw, salt) });
  await sql`insert into settings (key, value) values ('admin_password', ${value}::jsonb)
            on conflict (key) do update set value = excluded.value`;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------------- Session cookie ---------------- */
const sign = v => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(v).digest('hex');

export function startSession(res) {
  const exp = String(Date.now() + SESSION_HOURS * 3600e3);
  res.setHeader('Set-Cookie', `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`);
}

export function endSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function isAdmin(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([a-f0-9]+)`));
  return !!m && Number(m[1]) > Date.now() && safeEqual(sign(m[1]), m[2]);
}

/* ---------------- Handler wrapper ---------------- */
// Runs the handler with schema ready, JSON-only writes, admin check and error handling.
export function handler(methods) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const spec = methods[req.method];
    if (!spec) return res.status(405).json({ error: 'Method not allowed' });
    const fn = typeof spec === 'function' ? spec : spec.fn;
    const admin = typeof spec === 'function' || spec.admin !== false;
    if (['POST', 'PUT'].includes(req.method) && !/^application\/json/.test(req.headers['content-type'] || '')) {
      return res.status(415).json({ error: 'Send JSON' });
    }
    if (admin && !isAdmin(req)) return res.status(401).json({ error: 'Not signed in' });
    try {
      await ensureSchema();
      await fn(req, res);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  };
}
