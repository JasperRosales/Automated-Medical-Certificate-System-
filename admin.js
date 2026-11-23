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
    const s = Store.settings();
    if (!rec.cert) rec.cert = {};
    const c = rec.cert;
    // Migrate older records that used the previous field names
    const defaults = {
      controlNo: '',
      issueDate: c.dateIssued || fmtDate(todayISO()),
      consultDate: c.visitDate || fmtDate(rec.date),
      diagnosis: '', remarks1: '', remarks2: '', purpose: '',
      signatoryName: c.physician ?? s.physician,
      signatoryTitle: c.position ?? s.position,
      license: s.license
    };
    for (const [k, v] of Object.entries(defaults)) if (c[k] === undefined) c[k] = v;
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

  // Official form layout: [key, x1, x2, baseline y, line y, align, placeholder, extra style]
  const FIELDS = [
    ['controlNo', 133.6, 184.9, 52.1, 53.2, 'left ctrl', 'assigned on approval', '--pad:1.8mm'],
    ['issueDate', 133.6, 184.9, 57.7, 58.8, 'left', 'date issued'],
    ['name', 75.9, 148.9, 72.9, 74.0, 'center', 'name'],
    ['age', 152.7, 162.6, 72.9, 74.0, 'center', 'age'],
    ['diagnosis', 45.6, 184.9, 96.3, 97.8, 'left', 'click to type diagnosis'],
    ['remarks1', 45.6, 184.9, 101.9, 103.2, 'left', 'click to type remarks'],
    ['remarks2', 45.6, 184.9, 106.5, 107.8, 'left', '']
  ];

  // Fixed printed text: [class, x, baseline y, text]. Not editable.
  const STATIC = [
    ['l ref', 24.6, 9.2, 'Reference No.: BatStateU-CE-12'],
    ['c ref', 111.6, 9.2, 'Effectivity Date: July 01, 2024'],
    ['r ref', 175.6, 9.2, 'Revision No.: 02'],
    ['c h-rep', 110.4, 17.1, 'Republic of the Philippines'],
    ['c h-bsu', 110.2, 22.9, 'BATANGAS STATE UNIVERSITY'],
    ['c h-tneu', 109.4, 26.8, 'The National Engineering University'],
    ['c h-camp', 106.6, 30.6, 'Balayan Campus'],
    ['c h-addr', 106.6, 33.9, 'Caloocan, Balayan, Batangas 4213'],
    ['c h-tel', 106.6, 36.9, 'Tel. No.: 980-0385 loc 6108'],
    ['c h-tel', 106.6, 40.1, 'E-mail Address: health.balayan@g.batstate-u.edu.ph'],
    ['c h-title', 106.4, 46.2, 'MEDICAL CERTIFICATE'],
    ['l', 106.9, 52.1, 'Control No.:'],
    ['l', 106.9, 57.7, 'Date:'],
    ['l', 26.4, 63.9, 'To whom it may concern,'],
    ['l', 26.4, 72.9, 'This is to certify that Mr./Ms./Mrs.'],
    ['c cap', 112.5, 76.9, 'Name'],
    ['l', 149.6, 72.9, ','],
    ['c cap', 157.6, 77.0, 'Age'],
    ['l', 164.4, 72.9, 'years old,'],
    ['l', 26.4, 96.3, 'Diagnosis:'],
    ['l', 26.4, 101.9, 'Remarks:'],
  ];

  // Everything from the title down sits this many mm lower than on the
  // original form, to give the title some space below the header.
  const BODY_SHIFT = 3;
  const dy = y => (y >= 46 ? +(y + BODY_SHIFT).toFixed(2) : y);

  function certificateHTML(rec, s) {
    const c = rec.cert;
    const val = k => PATIENT_KEYS.includes(k) ? rec[k] : c[k];
    const ed = (k, ph) => `contenteditable="true" data-k="${k}" data-ph="${esc(ph)}"`;
    const fixed = STATIC.map(([cls, x, y, text]) =>
      `<div class="t ${cls}" style="--x:${x};--y:${dy(y)}">${esc(text)}</div>`).join('');
    // Underlined blank inside flowing text: grows with its value and pushes the words after it.
    const blank = (k, ph, cap, w, cls = '') =>
      `<span class="blank ${cls}" style="min-width:${w}mm"><span ${ed(k, ph)}>${esc(val(k))}</span><i class="bcap">${cap}</i></span>`;
    const fields = FIELDS.map(([k, x1, x2, y, ly, al, ph, extra = '']) =>
      `<div class="line" style="--x1:${x1};--x2:${x2};--y:${dy(ly)}"></div>` +
      `<div class="v ${al}" ${ed(k, ph)} style="--x1:${x1};--x2:${x2};--y:${dy(y)};${extra}">${esc(val(k))}</div>`).join('');

    // Bottom-left (about 27-73 mm across, 121-142 mm down) stays blank for the Valid Until stamp.
    return `<div class="page">
      <img class="seal" src="seal.png" alt="">
      ${fixed}
      ${fields}
      <div class="para flow" style="--x:24.6;--y:${dy(80.3)}">${blank('sex', 'sex', 'Sex', 16.5)}&nbsp;,
        ${blank('civilStatus', 'status', 'Civil Status', 18.8)}&nbsp;, a resident of
        ${blank('address', 'address', 'Address', 70.5, 'grow')}&nbsp;, was
        confined/<wbr>examined/consulted on ${blank('consultDate', 'date', 'Date', 40.8)}&nbsp;.</div>
      <div class="para" style="--x:26.4;--y:${dy(115.6)}">This medical certificate is issued upon request of the patient and for
        <span class="blank"><span ${ed('purpose', 'purpose')}>${esc(c.purpose)}</span></span>
        purpose only and not for medico-legal purposes.</div>
      <div class="t c sig-name" style="--x:145.6;--y:${dy(131.3)}"><span ${ed('signatoryName', "physician's name")}>${esc(c.signatoryName)}</span></div>
      <div class="t c sig-sub" style="--x:145.6;--y:${dy(134.4)}"><span ${ed('signatoryTitle', 'position')}>${esc(c.signatoryTitle)}</span></div>
      <div class="t c sig-sub" style="--x:145.6;--y:${dy(137.6)}">License No.: <span ${ed('license', '—')}>${esc(c.license)}</span></div>
    </div>`;
  }

  // Shrink a value that is wider than its line so it never overlaps printed text
  function fit(el) {
    const blank = el.parentElement?.classList.contains('grow') && el.parentElement;
    if (blank) {
      // Growing blank: shrink only once it would be wider than the whole line
      el.style.removeProperty('font-size');
      const max = 98 * 96 / 25.4; // room after "a resident of" on the first line
      let size = 8.7;
      while (blank.offsetWidth > max && size > 5.5) {
        size -= 0.25;
        el.style.fontSize = size + 'pt';
      }
      return;
    }
    if (!el.classList.contains('v')) return;
    el.style.removeProperty('--fs');
    let size = 8.7;
    while (el.scrollWidth > el.clientWidth + 0.5 && size > 5.5) {
      size -= 0.25;
      el.style.setProperty('--fs', size + 'pt');
    }
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
      <div class="cert-wrap" id="cert">${certificateHTML(rec, Store.settings())}</div>`;

    const cert = $('#cert');
    $$('[data-k]', cert).forEach(fit);

    cert.addEventListener('input', (e) => {
      const el = e.target.closest('[data-k]');
      if (!el) return;
      const r = Store.get(currentId);
      const k = el.dataset.k;
      const v = el.textContent.trim();
      if (PATIENT_KEYS.includes(k)) r[k] = v; else r.cert[k] = v;
      fit(el);
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
