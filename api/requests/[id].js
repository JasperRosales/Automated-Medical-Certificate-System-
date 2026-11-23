import { handler, sql, toRecord, cleanPatient, cleanCert, getSettings } from '../_lib.js';

const UUID = /^[0-9a-f-]{36}$/i;

const withId = fn => async (req, res) => {
  if (!UUID.test(req.query.id || '')) return res.status(404).json({ error: 'Not found' });
  return fn(req, res, req.query.id);
};

export default handler({
  // Save edits made on the certificate (patient fields and/or certificate fields)
  PUT: withId(async (req, res, id) => {
    const body = req.body || {};
    const p = cleanPatient(body, { partial: true });
    if (!p) return res.status(400).json({ error: 'Invalid data' });
    const cert = JSON.stringify(cleanCert(body.cert));
    const status = body.status === 'pending' ? 'pending' : null;
    const rows = await sql`update requests set
        name = coalesce(${p.name ?? null}, name),
        age = coalesce(${p.age ?? null}, age),
        sex = coalesce(${p.sex ?? null}, sex),
        civil_status = coalesce(${p.civilStatus ?? null}, civil_status),
        address = coalesce(${p.address ?? null}, address),
        cert = cert || ${cert}::jsonb,
        status = coalesce(${status}, status),
        updated_at = now()
      where id = ${id} returning *`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ request: toRecord(rows[0]) });
  }),

  // Approve: assigns the next control number (once) atomically
  POST: withId(async (req, res, id) => {
    const s = await getSettings();
    const prefix = s.controlPrefix ? `${s.controlPrefix}-` : '';
    const rows = await sql`
      with cur as (select * from requests where id = ${id} for update),
      need as (select 1 from cur where coalesce(cur.cert->>'controlNo', '') = ''),
      bump as (
        insert into settings (key, value)
        select 'general', jsonb_build_object('nextControl', ${s.nextControl}::int + 1)
        from need
        on conflict (key) do update
          set value = settings.value || jsonb_build_object('nextControl',
                coalesce((settings.value->>'nextControl')::int, ${s.nextControl}::int) + 1)
        returning (value->>'nextControl')::int - 1 as n
      )
      update requests r set
        status = 'approved',
        approved_at = now(),
        updated_at = now(),
        cert = case when exists (select 1 from bump)
          then r.cert || jsonb_build_object('controlNo', ${prefix} || lpad((select n from bump)::text, 3, '0'))
          else r.cert end
      from cur where r.id = cur.id
      returning r.*`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ request: toRecord(rows[0]) });
  }),

  DELETE: withId(async (req, res, id) => {
    await sql`delete from requests where id = ${id}`;
    res.json({ ok: true });
  })
});
