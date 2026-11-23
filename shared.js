/* Shared storage + helpers.
 * Everything is kept in the browser's localStorage, so the client page and the
 * admin page must be opened in the SAME browser on the SAME computer.
 * To share data across devices later, replace the Store methods with API calls.
 */
const Store = {
  KEY: 'medcert_requests',
  SETTINGS_KEY: 'medcert_settings',

  DEFAULT_SETTINGS: {
    instName: 'Sample University',
    instOffice: 'Health Services Office',
    instAddress: '123 Campus Road, City, Province 0000',
    instContact: 'Tel. No.: 000-0000 · health@example.edu',
    physician: '',
    position: '',
    license: '',
    controlPrefix: 'MC',
    nextControl: 1,
    validMonths: 6,
    adminPassword: 'admin123'
  },

  all() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; }
  },
  saveAll(list) { localStorage.setItem(this.KEY, JSON.stringify(list)); },
  get(id) { return this.all().find(r => r.id === id); },
  upsert(rec) {
    const list = this.all();
    const i = list.findIndex(r => r.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    this.saveAll(list);
  },
  remove(id) { this.saveAll(this.all().filter(r => r.id !== id)); },

  settings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {}; } catch {}
    return { ...this.DEFAULT_SETTINGS, ...s };
  },
  saveSettings(s) { localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(s)); }
};

const PATIENT_KEYS = ['name', 'age', 'sex', 'civilStatus', 'address'];

const pad = (n, len = 2) => String(n).padStart(len, '0');

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDatePlusMonths(iso, months) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1 + Number(months || 0), d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}

function makeRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const used = new Set(Store.all().map(r => r.ref));
  let ref;
  do {
    ref = 'REQ-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (used.has(ref));
  return ref;
}
