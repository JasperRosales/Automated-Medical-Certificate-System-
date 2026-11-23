(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  let currentId = null;
  let filter = 'pending';

  /* ---------------- Auth (front-end only) ---------------- */
  const loggedIn = () => sessionStorage.getItem('medcert_admin') === '1';

  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    renderList();
  }

  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#pw').value === Store.settings().adminPassword) {
      sessionStorage.setItem('medcert_admin', '1');
      showApp();
    } else {
      $('#loginErr').textContent = 'Incorrect password.';
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('medcert_admin');
    location.reload();
  });

  /* ---------------- Tabs ---------------- */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === t));
    $('#requestsView').hidden = t.dataset.view !== 'requestsView';
    $('#settingsView').hidden = t.dataset.view !== 'settingsView';
    if (t.dataset.view === 'settingsView') loadSettingsForm();
    else { renderList(); renderDetail(); }
  }));

  /* ---------------- Request list ---------------- */
  $$('.filters button').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    $$('.filters button').forEach(x => x.classList.toggle('active', x === b));
    renderList();
  }));
  $('#search').addEventListener('input', renderList);

  function renderList() {
    const all = Store.all();
    $('#cPending').textContent = `(${all.filter(r => r.status === 'pending').length})`;
    $('#cApproved').textContent = `(${all.filter(r => r.status === 'approved').length})`;

    const q = $('#search').value.trim().toLowerCase();
    const list = all
      .filter(r => filter === 'all' || r.status === filter)
      .filter(r => !q || r.name.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);

    $('#items').innerHTML = list.length ? list.map(r => `
      <div class="req ${r.id === currentId ? 'active' : ''}" data-id="${r.id}">
        <div class="top"><span class="name">${esc(r.name)}</span><span class="badge ${r.status}">${r.status}</span></div>
        <div class="sub">${esc(r.ref)} · ${new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
      </div>`).join('')
      : '<div class="empty-state" style="padding:30px 10px">No requests here.</div>';

    $$('.req', $('#items')).forEach(el => el.addEventListener('click', () => openRequest(el.dataset.id)));
  }

  // Refresh the list when the client page (another tab) submits a request
  window.addEventListener('storage', (e) => {
    if (e.key === Store.KEY && loggedIn()) renderList();
  });

  /* ---------------- Detail / certificate ---------------- */
  function ensureCert(rec) {
    if (rec.cert) return rec;
    const s = Store.settings();
    rec.cert = {
      controlNo: '',
      dateIssued: fmtDate(todayISO()),
      visitType: 'examined',
      visitDate: fmtDate(rec.date),
      diagnosis: '',
      remarks1: '',
      remarks2: '',
      purpose: '',
      validUntil: fmtDatePlusMonths(todayISO(), s.validMonths),
      physician: s.physician,
      position: s.position,
      license: s.license
    };
    return rec;
  }

  function openRequest(id) {
    const rec = Store.get(id);
    if (!rec) return;
    if (!rec.cert) Store.upsert(ensureCert(rec));
    currentId = id;
    renderList();
    renderDetail();
  }

  function certificateHTML(rec, s) {
    const c = rec.cert;
    const val = k => PATIENT_KEYS.includes(k) ? rec[k] : c[k];
    const f = (k, ph = '') => `<span contenteditable="true" data-k="${k}" data-ph="${esc(ph)}">${esc(val(k))}</span>`;

    return `
      <div class="header">
        <div class="l2">${esc(s.instName)}</div>
        <div class="l3">${esc(s.instOffice)}</div>
        <div class="small">${esc(s.instAddress)}</div>
        <div class="small">${esc(s.instContact)}</div>
      </div>

      <div class="title">MEDICAL CERTIFICATE</div>

      <div class="ctl">
        <div><span>Control No.:</span><span class="v ctrl-no">${f('controlNo', 'assigned on approval')}</span></div>
        <div><span>Date:</span><span class="v">${f('dateIssued', 'date issued')}</span></div>
      </div>

      <div class="body">
        <p>To whom it may concern,</p>
        <p class="para">
          This is to certify that Mr./Ms./Mrs.
          <span class="blank" style="min-width:300px">${f('name', 'name')}<small>Name</small></span>,
          <span class="blank" style="min-width:60px">${f('age', 'age')}<small>Age</small></span>
          years old,
        </p>
        <p class="para">
          <span class="blank" style="min-width:110px">${f('sex', 'sex')}<small>Sex</small></span>,
          <span class="blank" style="min-width:120px">${f('civilStatus', 'civil status')}<small>Civil Status</small></span>,
          a resident of
          <span class="blank" style="min-width:270px">${f('address', 'address')}<small>Address</small></span>,
        </p>
        <p class="para">
          was ${f('visitType', 'confined/examined/consulted')} on <span class="blank" style="min-width:220px">${f('visitDate', 'date')}<small>Date</small></span>.
        </p>

        <div class="dx"><span>Diagnosis:</span><div class="lines"><div>${f('diagnosis', 'click to type diagnosis')}</div></div></div>
        <div class="dx"><span>Remarks:</span><div class="lines">
          <div>${f('remarks1', 'click to type remarks')}</div>
          <div>${f('remarks2', '')}</div>
        </div></div>

        <p style="margin-top:28px">
          This medical certificate is issued upon request of the patient and for
          <span class="blank" style="min-width:180px">${f('purpose', 'purpose')}</span>
          purpose only and not for medico-legal purposes.
        </p>

        <div class="sig-area">
          <div class="validity">${esc(s.instName)}<br>Valid Until:<b>${f('validUntil', 'date')}</b></div>
          <div class="sig">
            <div class="space"></div>
            <div class="name">${f('physician', "physician's name")}</div>
            <div>${f('position', 'position')}</div>
            <div>License No.: ${f('license', '—')}</div>
          </div>
        </div>
      </div>`;
  }

  function renderDetail() {
    const box = $('#detail');
    const rec = currentId && Store.get(currentId);
    if (!rec) {
      box.innerHTML = '<div class="card empty-state">Select a request to review it.</div>';
      return;
    }
    ensureCert(rec);
    const pending = rec.status === 'pending';

    box.innerHTML = `
      <div class="toolbar no-print">
        <span class="badge ${rec.status}">${rec.status}</span>
        <strong>${esc(rec.ref)}</strong>
        <span class="muted">submitted ${new Date(rec.createdAt).toLocaleString()}</span>
        <span class="muted" id="saveState"></span>
        <span class="spacer"></span>
        ${pending
          ? '<button class="btn ok" id="approveBtn">Approve &amp; print</button>'
          : '<button class="btn" id="reopenBtn">Move back to pending</button><button class="btn primary" id="printBtn">Print</button>'}
        <button class="btn danger" id="deleteBtn">Delete</button>
      </div>
      <p class="hint no-print">Click any highlighted text on the certificate to edit it. Changes save automatically.</p>
      <div class="cert" id="cert">${certificateHTML(rec, Store.settings())}</div>`;

    const cert = $('#cert');

    cert.addEventListener('input', (e) => {
      const el = e.target.closest('[data-k]');
      if (!el) return;
      const r = Store.get(currentId);
      const k = el.dataset.k;
      const v = el.textContent.trim();
      if (PATIENT_KEYS.includes(k)) r[k] = v; else r.cert[k] = v;
      r.updatedAt = Date.now();
      Store.upsert(r);
      $('#saveState').textContent = 'Saved';
      if (k === 'name') renderList();
    });

    // Single-line fields: Enter moves on instead of adding a new line
    cert.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[contenteditable]')) {
        e.preventDefault();
        const fields = $$('[contenteditable]', cert);
        const next = fields[fields.indexOf(e.target) + 1];
        next ? next.focus() : e.target.blur();
      }
    });

    // Paste as plain text
    cert.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
    });

    // Clear leftover <br> so placeholders reappear when a field is emptied
    cert.addEventListener('blur', (e) => {
      if (e.target.matches?.('[contenteditable]') && !e.target.textContent.trim()) e.target.innerHTML = '';
    }, true);

    $('#approveBtn')?.addEventListener('click', approve);
    $('#printBtn')?.addEventListener('click', () => window.print());
    $('#reopenBtn')?.addEventListener('click', () => {
      const r = Store.get(currentId);
      r.status = 'pending';
      Store.upsert(r);
      renderList(); renderDetail();
    });
    $('#deleteBtn').addEventListener('click', () => {
      const r = Store.get(currentId);
      if (!confirm(`Delete request ${r.ref} for ${r.name}? This cannot be undone.`)) return;
      Store.remove(currentId);
      currentId = null;
      renderList(); renderDetail();
    });
  }

  function approve() {
    const r = Store.get(currentId);
    if (!r.cert.diagnosis && !confirm('Diagnosis is empty. Approve anyway?')) return;

    if (!r.cert.controlNo) {
      const s = Store.settings();
      r.cert.controlNo = `${s.controlPrefix}${s.controlPrefix ? '-' : ''}${pad(s.nextControl, 3)}`;
      s.nextControl = Number(s.nextControl) + 1;
      Store.saveSettings(s);
    }
    r.status = 'approved';
    r.approvedAt = Date.now();
    Store.upsert(r);
    renderList();
    renderDetail();
    setTimeout(() => window.print(), 150);
  }

  /* ---------------- Settings ---------------- */
  const sf = $('#settingsForm');

  function loadSettingsForm() {
    const s = Store.settings();
    for (const k of Object.keys(Store.DEFAULT_SETTINGS)) if (sf[k]) sf[k].value = s[k];
    sf.newPassword.value = '';
    $('#settingsMsg').textContent = '';
  }

  sf.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = Store.settings();
    for (const k of Object.keys(Store.DEFAULT_SETTINGS)) if (sf[k]) s[k] = sf[k].value.trim();
    s.nextControl = Math.max(1, parseInt(s.nextControl, 10) || 1);
    s.validMonths = Math.max(0, parseInt(s.validMonths, 10) || 0);
    if (sf.newPassword.value) s.adminPassword = sf.newPassword.value;
    Store.saveSettings(s);
    loadSettingsForm();
    $('#settingsMsg').textContent = 'Settings saved.';
  });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ requests: Store.all(), settings: Store.settings() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `medcert-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.requests)) throw new Error('bad file');
      if (!confirm(`Replace current data with ${data.requests.length} requests from this backup?`)) return;
      Store.saveAll(data.requests);
      if (data.settings) Store.saveSettings(data.settings);
      loadSettingsForm();
      $('#settingsMsg').textContent = 'Backup imported.';
    } catch {
      alert('That file is not a valid backup.');
    } finally {
      e.target.value = '';
    }
  });

  /* ---------------- Start ---------------- */
  if (loggedIn()) showApp(); else $('#login').hidden = false;
})();
