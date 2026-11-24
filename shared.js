/* Shared helpers. Data lives in the Neon database behind /api. */

// Call the API with JSON; throws an Error with the server's message on failure.
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/' + path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed. Please try again.'), { status: res.status });
  return data;
}

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

// "September 1, 2026" + 6 months -> "March 1, 2027" (clamps to month end). '' if unparseable.
function addMonthsText(text, months) {
  const d = new Date(text);
  if (!text || isNaN(d)) return '';
  const r = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  if (r.getDate() !== d.getDate()) r.setDate(0);
  return r.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
