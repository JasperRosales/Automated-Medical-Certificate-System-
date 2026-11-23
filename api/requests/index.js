import crypto from 'node:crypto';
import { handler, sql, toRecord, cleanPatient, cleanCert } from '../_lib.js';

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeRef = () => 'REQ-' + Array.from(crypto.randomBytes(5), b => REF_CHARS[b % REF_CHARS.length]).join('');

export default handler({
  // Admin: list every request
  GET: async (req, res) => {
    const rows = await sql`select * from requests order by created_at desc`;
    res.json({ requests: rows.map(toRecord) });
  },

  // Public: submit a request from the client form
  POST: {
    admin: false,
    fn: async (req, res) => {
      const p = cleanPatient(req.body || {});
      if (!p || Object.values(p).some(v => !v)) return res.status(400).json({ error: 'Please complete all fields.' });
      const age = Number(p.age);
      if (!Number.isInteger(age) || age < 1 || age > 130) return res.status(400).json({ error: 'Please enter a valid age.' });
      if (!['Female', 'Male'].includes(p.sex)) return res.status(400).json({ error: 'Please select sex.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return res.status(400).json({ error: 'Please enter a valid date.' });

      for (let i = 0; i < 5; i++) {
        const rows = await sql`insert into requests (ref, name, age, sex, civil_status, address, date)
          values (${makeRef()}, ${p.name}, ${String(age)}, ${p.sex}, ${p.civilStatus}, ${p.address}, ${p.date})
          on conflict (ref) do nothing returning ref`;
        if (rows.length) return res.status(201).json({ ref: rows[0].ref });
      }
      res.status(500).json({ error: 'Could not create a reference code. Please try again.' });
    }
  },

  // Admin: replace all requests with a backup
  PUT: async (req, res) => {
    const list = req.body?.requests;
    if (!Array.isArray(list)) return res.status(400).json({ error: 'Invalid backup.' });
    const rows = [];
    for (const r of list) {
      const p = cleanPatient(r);
      if (!p || typeof r.ref !== 'string') return res.status(400).json({ error: 'Invalid backup.' });
      rows.push({
        ref: r.ref.slice(0, 20), status: r.status === 'approved' ? 'approved' : 'pending', ...p,
        cert: JSON.stringify(cleanCert(r.cert)),
        created: new Date(Number(r.createdAt) || Date.now()).toISOString(),
        approved: r.approvedAt ? new Date(Number(r.approvedAt)).toISOString() : null
      });
    }
    await sql.transaction([
      sql`delete from requests`,
      ...rows.map(r => sql`insert into requests (ref, status, name, age, sex, civil_status, address, date, cert, created_at, approved_at)
        values (${r.ref}, ${r.status}, ${r.name}, ${r.age}, ${r.sex}, ${r.civilStatus}, ${r.address}, ${r.date}, ${r.cert}::jsonb, ${r.created}, ${r.approved})
        on conflict (ref) do nothing`)
    ]);
    res.json({ imported: rows.length });
  }
});
