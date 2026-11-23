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
    ['sex', 24.6, 41.1, 80.3, 81.5, 'left', 'sex', '--pad:1.8mm'],
    ['civilStatus', 45.6, 64.4, 80.3, 81.5, 'center', 'status'],
    ['address', 85.9, 156.4, 80.3, 81.5, 'left', 'address', '--pad:1.7mm'],
    ['consultDate', 59.5, 100.3, 87.8, 89.0, 'center', 'date'],
    ['diagnosis', 45.6, 184.9, 96.3, 97.8, 'left', 'click to type diagnosis'],
    ['remarks1', 45.6, 184.9, 101.9, 103.2, 'left', 'click to type remarks'],
    ['remarks2', 45.6, 184.9, 106.5, 107.8, 'left', ''],
    ['purpose', 111.8, 146.1, 115.6, 117.0, 'center', 'purpose']
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
    ['c cap', 32.9, 84.2, 'Sex'],
    ['l', 42.9, 80.3, ','],
    ['c cap', 55.0, 84.2, 'Civil Status'],
    ['l', 65.9, 80.3, ', a resident of'],
    ['c cap', 121.1, 84.2, 'Address'],
    ['l', 157.9, 80.3, ', was confined/'],
    ['l', 26.4, 87.8, 'examined/consulted on'],
    ['c cap', 80.3, 91.7, 'Date'],
    ['l', 102.0, 87.8, '.'],
    ['l', 26.4, 96.3, 'Diagnosis:'],
    ['l', 26.4, 101.9, 'Remarks:'],
    ['l', 26.4, 115.6, 'This medical certificate is issued upon request of the patient and for'],
    ['l', 147.7, 115.6, 'purpose only and not for'],
    ['l', 27.7, 119.9, 'medico-legal purposes.']
  ];

  function certificateHTML(rec, s) {
    const c = rec.cert;
    const val = k => PATIENT_KEYS.includes(k) ? rec[k] : c[k];
    const ed = (k, ph) => `contenteditable="true" data-k="${k}" data-ph="${esc(ph)}"`;
    const fixed = STATIC.map(([cls, x, y, text]) =>
      `<div class="t ${cls}" style="--x:${x};--y:${y}">${esc(text)}</div>`).join('');
    const fields = FIELDS.map(([k, x1, x2, y, ly, al, ph, extra = '']) =>
      `<div class="line" style="--x1:${x1};--x2:${x2};--y:${ly}"></div>` +
      `<div class="v ${al}" ${ed(k, ph)} style="--x1:${x1};--x2:${x2};--y:${y};${extra}">${esc(val(k))}</div>`).join('');

    // Bottom-left (about 27-73 mm across, 121-142 mm down) stays blank for the Valid Until stamp.
    return `<div class="page">
      <img class="seal" src="seal.png" alt="">
      ${fixed}
      ${fields}
      ${isImg(s.signature) ? `<img class="sig-img" src="${esc(s.signature)}" alt="">` : ''}
      <div class="t c sig-name" style="--x:145.6;--y:131.3"><span ${ed('signatoryName', "physician's name")}>${esc(c.signatoryName)}</span></div>
      <div class="t c" style="--x:145.6;--y:134.6"><span ${ed('signatoryTitle', 'position')}>${esc(c.signatoryTitle)}</span></div>
      <div class="t c" style="--x:145.6;--y:138.1">License No.: <span ${ed('license', '—')}>${esc(c.license)}</span></div>
    </div>`;
  }

  // Shrink a value that is wider than its line so it never overlaps printed text
  function fit(el) {
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
    $$('.v', cert).forEach(fit);

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
    showSignature(s.signature);
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

  /* ---------------- Signature ---------------- */
  const isImg = v => typeof v === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v);

  function showSignature(src) {
    const ok = isImg(src);
    $('#sigPreview').hidden = !ok;
    $('#sigNone').hidden = ok;
    if (ok) $('#sigPreview').src = src; else $('#sigPreview').removeAttribute('src');
  }

  // Scale the image down, crop to the ink, and make the paper transparent
  function processSignature(img) {
    const scale = Math.min(1, 900 / img.width, 400 / img.height);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h), px = d.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const a = lum > 200 ? 0 : lum < 140 ? 255 : Math.round((200 - lum) / 60 * 255);
      px[i + 3] = Math.min(px[i + 3], a);
      if (px[i + 3] > 40) {
        const p = i / 4, x = p % w, y = (p - x) / w;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    ctx.putImageData(d, 0, 0);
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  $('#sigFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const data = processSignature(img);
      if (!data) { alert('No signature found in that image. Use dark ink on white paper.'); return; }
      const s = Store.settings();
      s.signature = data;
      try { Store.saveSettings(s); } catch { alert('Image is too large to save. Try a smaller photo.'); return; }
      showSignature(data);
      $('#settingsMsg').textContent = 'Signature saved.';
    };
    img.onerror = () => alert('Could not read that image.');
    img.src = URL.createObjectURL(file);
  });

  $('#sigRemove').addEventListener('click', () => {
    const s = Store.settings();
    s.signature = '';
    Store.saveSettings(s);
    showSignature('');
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
