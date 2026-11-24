(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  let currentId = null;
  let filter = 'pending';

  /* ---------------- Data (cached from the API) ---------------- */
  const Store = {
    list: [],
    cfg: {},
    timers: {},
    async load() {
      const [r, s] = await Promise.all([api('requests'), api('settings')]);
      this.list = r.requests;
      this.cfg = s.settings;
    },
    all() { return this.list; },
    get(id) { return this.list.find(r => r.id === id); },
    put(rec) {
      const i = this.list.findIndex(r => r.id === rec.id);
      if (i >= 0) this.list[i] = rec; else this.list.push(rec);
    },
    // Save edits to the server shortly after typing stops
    save(rec) {
      clearTimeout(this.timers[rec.id]);
      setSaveState('Saving…');
      this.timers[rec.id] = setTimeout(async () => {
        try {
          const body = { cert: rec.cert };
          for (const k of PATIENT_KEYS) body[k] = rec[k];
          await api(`requests/${rec.id}`, { method: 'PUT', body });
          setSaveState('Saved');
        } catch (e) {
          setSaveState('Not saved: ' + e.message);
          if (e.status === 401) location.reload();
        }
      }, 500);
    },
    settings() { return { ...this.cfg }; }
  };

  function setSaveState(t) {
    const el = $('#saveState');
    if (el) el.textContent = t;
  }

  // Run an API call; show errors, and go back to sign-in if the session ended
  async function run(fn) {
    try { return await fn(); }
    catch (e) {
      if (e.status === 401) { alert('Your session has ended. Please sign in again.'); location.reload(); }
      else alert(e.message);
      throw e;
    }
  }

  /* ---------------- Auth ---------------- */
  async function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#items').innerHTML = '<div class="empty-state" style="padding:30px 10px">Loading…</div>';
    await run(() => Store.load());
    renderList();
    setInterval(refresh, 15000);
  }

  // Pick up new requests from the client page
  async function refresh() {
    if (document.hidden) return;
    try {
      const { requests } = await api('requests');
      // Keep the open request as-is so unsaved typing is not overwritten
      const open = Store.get(currentId);
      Store.list = requests.map(r => (open && r.id === open.id ? open : r));
      renderList();
    } catch (e) {
      if (e.status === 401) location.reload();
    }
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = $('#loginForm button');
    btn.disabled = true;
    try {
      await api('session', { method: 'POST', body: { password: $('#pw').value } });
      $('#pw').value = '';
      showApp();
    } catch (ex) {
      $('#loginErr').textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('session', { method: 'DELETE', body: {} }).catch(() => {});
    location.reload();
  });

  /* ---------------- Tabs ---------------- */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === t));
    $('#requestsView').hidden = t.dataset.view !== 'requestsView';
    for (const v of ['requestsView', 'downloadView', 'settingsView']) $('#' + v).hidden = t.dataset.view !== v;
    if (t.dataset.view === 'settingsView') loadSettingsForm();
    else if (t.dataset.view === 'downloadView') renderDownload();
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
    if (c.validUntil === undefined) c.validUntil = addMonthsText(c.issueDate, VALID_MONTHS);
    return rec;
  }

  const VALID_MONTHS = 6;

  function openRequest(id) {
    const rec = Store.get(id);
    if (!rec) return;
    ensureCert(rec);
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
      `<div class="v ${al}" ${ed(k, ph)} style="--x1:${x1};--x2:${x2};--y:${dy(y)};${extra}">${esc(val(k))}</div>` +
      (PICK[k] ? `<button type="button" class="pick-btn" data-pick="${k}" title="Choose from list" style="--x:${x2};--y:${dy(y)}">&#9662;</button>` : '')).join('');

    return `<div class="page">
      <img class="seal" src="seal.png" alt="">
      ${fixed}
      ${fields}
      <div class="para flow" style="--x:24.6;--y:${dy(80.3)}">${blank('sex', 'sex', 'Sex', 16.5)}&nbsp;,
        ${blank('civilStatus', 'status', 'Civil Status', 18.8)}&nbsp;, a resident of
        ${blank('address', 'address', 'Address', 70.5, 'grow')}&nbsp;, was
        confined/<wbr>examined/consulted on ${blank('consultDate', 'date', 'Date', 40.8)}&nbsp;.</div>
      <div class="para" style="--x:26.4;--y:${dy(115.6)}">This medical certificate is issued upon request of the patient and for
        <span class="blank"><span ${ed('purpose', 'purpose')}>${esc(c.purpose)}</span></span><button type="button" class="pick-btn inline" data-pick="purpose" title="Choose from list">&#9662;</button>
        purpose only and not for medico-legal purposes.</div>
      <div class="stamp" style="--y:${dy(122.5)}">
        <div class="st-1">BATANGAS STATE UNIVERSITY</div>
        <div class="st-2">Balayan Campus &middot; Health Services</div>
        <div class="st-3">VALID UNTIL</div>
        <div class="st-4"><span ${ed('validUntil', 'date')}>${esc(c.validUntil)}</span></div>
      </div>
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
        <select class="paper-select" title="Paper size">${paperOptions()}</select>
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
      // Validity follows the issue date (6 months)
      if (k === 'issueDate') {
        const vu = addMonthsText(v, VALID_MONTHS);
        const out = $('[data-k="validUntil"]', cert);
        if (vu && out) { r.cert.validUntil = vu; out.textContent = vu; }
      }
      fit(el);
      Store.save(r);
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
    cert.addEventListener('focusin', (e) => { if (PICK[e.target.dataset?.k]) showPicker(e.target); });
    cert.addEventListener('focusout', (e) => { if (!e.relatedTarget?.closest?.('.pick-btn')) hidePicker(); });
    cert.addEventListener('input', (e) => { if (PICK[e.target.dataset?.k]) showPicker(e.target, true); });

    cert.addEventListener('blur', (e) => {
      if (e.target.matches?.('[contenteditable]') && !e.target.textContent.trim()) e.target.innerHTML = '';
    }, true);

    $('#approveBtn')?.addEventListener('click', approve);
    $('#printBtn')?.addEventListener('click', () => window.print());
    $('#reopenBtn')?.addEventListener('click', async () => {
      const r = Store.get(currentId);
      const { request } = await run(() => api(`requests/${r.id}`, { method: 'PUT', body: { status: 'pending', cert: r.cert } }));
      Store.put(request);
      renderList(); renderDetail();
    });
    $('#deleteBtn').addEventListener('click', async () => {
      const r = Store.get(currentId);
      if (!confirm(`Delete request ${r.ref} for ${r.name}? This cannot be undone.`)) return;
      await run(() => api(`requests/${r.id}`, { method: 'DELETE' }));
      Store.list = Store.list.filter(x => x.id !== r.id);
      currentId = null;
      renderList(); renderDetail();
    });
  }

  /* ---------------- Paper: two copies per sheet, cut line in the exact middle ---------------- */
  const PAPERS = { legal: ['Legal (8.5 x 14 in)', 355.6], folio: ['Folio / Long (8.5 x 13 in)', 330.2] };
  const PAPER_W = 215.9;
  let paper = PAPERS[localStorage.getItem('medcert_paper')] ? localStorage.getItem('medcert_paper') : 'legal';
  const paperOptions = () => Object.entries(PAPERS)
    .map(([k, [label]]) => `<option value="${k}" ${k === paper ? 'selected' : ''}>${label}</option>`).join('');
  const pageStyle = document.createElement('style');
  document.head.append(pageStyle);
  function setPaper(k) {
    paper = k;
    localStorage.setItem('medcert_paper', k);
    const H = PAPERS[k][1];
    pageStyle.textContent = `@page { size: ${PAPER_W}mm ${H}mm; margin: 0; } #printSheet { --sheet-h: ${H}mm; }`;
    $$('.paper-select').forEach(s => (s.value = k));
  }
  document.addEventListener('change', (e) => { if (e.target.matches('.paper-select')) setPaper(e.target.value); });
  setPaper(paper);
  $('#dlPaper').innerHTML = paperOptions();

  // Each copy is centred in its own half of the sheet
  const sheet = document.createElement('div');
  sheet.id = 'printSheet';
  window.addEventListener('beforeprint', () => {
    const page = $('#cert .page');
    if (!page) return;
    const copy = () => {
      const p = page.cloneNode(true);
      $$('[contenteditable]', p).forEach(el => el.removeAttribute('contenteditable'));
      $$('.pick-btn', p).forEach(el => el.remove());
      return p;
    };
    const half = () => Object.assign(document.createElement('div'), { className: 'half' });
    const top = half(), bottom = half();
    top.append(copy());
    bottom.append(copy());
    sheet.replaceChildren(top, bottom);
    document.body.append(sheet);
  });
  window.addEventListener('afterprint', () => sheet.remove());

  /* ---------------- Quick-pick dropdown for Diagnosis / Remarks / Purpose ---------------- */
  const PICK = { diagnosis: 'diagnosisOptions', remarks1: 'remarksOptions', remarks2: 'remarksOptions', purpose: 'purposeOptions' };
  const OPTION_KEYS = ['diagnosisOptions', 'remarksOptions', 'purposeOptions'];
  const picker = document.createElement('div');
  picker.className = 'picker no-print';
  picker.hidden = true;
  document.body.append(picker);
  let pickTarget = null;

  // On focus show every option; while typing, only the matching ones
  function showPicker(el, filter) {
    const opts = Store.settings()[PICK[el.dataset.k]] || [];
    const q = filter ? el.textContent.trim().toLowerCase() : '';
    const list = opts.filter(o => !q || o.toLowerCase().includes(q) && o.toLowerCase() !== q);
    if (!list.length) return hidePicker();
    pickTarget = el;
    picker.innerHTML = list.map(o => `<button type="button">${esc(o)}</button>`).join('');
    const r = el.getBoundingClientRect();
    picker.style.left = Math.max(4, r.left + scrollX) + 'px';
    picker.style.top = (r.bottom + scrollY + 4) + 'px';
    picker.hidden = false;
  }
  function hidePicker() { picker.hidden = true; pickTarget = null; }

  // mousedown keeps focus on the field so the choice lands in it
  picker.addEventListener('mousedown', e => e.preventDefault());
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !pickTarget) return;
    const el = pickTarget;
    el.textContent = b.textContent;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    hidePicker();
    el.blur();
  });

  // The ▾ button opens the full list without bringing up the keyboard
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.pick-btn');
    if (btn) {
      const el = $(`[data-k="${btn.dataset.pick}"]`, btn.closest('.page'));
      if (pickTarget === el && !picker.hidden) return hidePicker();
      showPicker(el, false);
      if (picker.hidden) alert('No options yet. Add them in Settings → Quick picks.');
      return;
    }
    if (!picker.hidden && !picker.contains(e.target) && e.target !== pickTarget) hidePicker();
  });

  async function approve() {
    const r = Store.get(currentId);
    if (!r.cert.diagnosis && !confirm('Diagnosis is empty. Approve anyway?')) return;

    $('#approveBtn').disabled = true;
    try {
      // Save any pending edits first, then approve (the server assigns the control number)
      clearTimeout(Store.timers[r.id]);
      const body = { cert: r.cert };
      for (const k of PATIENT_KEYS) body[k] = r[k];
      await run(() => api(`requests/${r.id}`, { method: 'PUT', body }));
      const { request } = await run(() => api(`requests/${r.id}`, { method: 'POST', body: {} }));
      delete Store.timers[r.id];
      Store.put(request);
      const s = await api('settings');
      Store.cfg = s.settings;
    } catch {
      if ($('#approveBtn')) $('#approveBtn').disabled = false;
      return;
    }
    renderList();
    renderDetail();
    setTimeout(() => window.print(), 150);
  }

  /* ---------------- Batch download (PDF) ---------------- */
  const dlDate = $('#dlDate');
  dlDate.value = todayISO();
  dlDate.addEventListener('change', renderDownload);

  function dayRequests() {
    return Store.all().filter(r => r.date === dlDate.value).sort((a, b) => a.createdAt - b.createdAt);
  }

  function renderDownload() {
    const list = dayRequests();
    $('#dlList').innerHTML = list.length ? list.map(r => `
      <label class="dl-item">
        <input type="checkbox" value="${r.id}" ${r.status === 'approved' ? 'checked' : ''}>
        <span class="name">${esc(r.name)}</span>
        <span class="muted">${esc(r.cert?.controlNo || r.ref)}</span>
        <span class="badge ${r.status}">${r.status}</span>
      </label>`).join('')
      : '<div class="empty-state" style="padding:24px 10px">No requests on this day.</div>';
    $('#dlMsg').textContent = '';
    updateDlCount();
  }

  function updateDlCount() {
    const boxes = $$('#dlList input');
    const n = boxes.filter(b => b.checked).length;
    $('#dlCount').textContent = `${n} of ${boxes.length} selected`;
    $('#dlAll').checked = boxes.length > 0 && n === boxes.length;
    $('#dlBtn').disabled = n === 0;
  }
  $('#dlList').addEventListener('change', updateDlCount);
  $('#dlAll').addEventListener('change', (e) => {
    $$('#dlList input').forEach(b => (b.checked = e.target.checked));
    updateDlCount();
  });

  const loadScript = src => new Promise((ok, fail) => {
    if ([...document.scripts].some(s => s.src === src)) return ok();
    const s = Object.assign(document.createElement('script'), { src, onload: ok, onerror: () => fail(new Error('Could not load ' + src)) });
    document.head.append(s);
  });

  $('#dlBtn').addEventListener('click', async () => {
    const ids = $$('#dlList input').filter(b => b.checked).map(b => b.value);
    if (!ids.length) return;
    const btn = $('#dlBtn'), msg = $('#dlMsg');
    btn.disabled = true;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;';
    document.body.append(box);
    try {
      msg.textContent = 'Preparing…';
      await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
      const W = PAPER_W, H = PAPERS[paper][1], PW = 210, PH = 148, X = (W - PW) / 2, Y = (H / 2 - PH) / 2;
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' });
      const s = Store.settings();
      for (const [i, id] of ids.entries()) {
        msg.textContent = `Rendering ${i + 1} of ${ids.length}…`;
        const rec = ensureCert(structuredClone(Store.get(id)));
        box.innerHTML = certificateHTML(rec, s);
        const page = $('.page', box);
        $$('[data-k]', page).forEach(fit);
        $$('[contenteditable]', page).forEach(el => el.removeAttribute('contenteditable'));
        $$('.pick-btn', page).forEach(el => el.remove());
        await Promise.all($$('img', page).map(img => img.decode().catch(() => {})));
        const canvas = await window.html2canvas(page, { scale: 3, backgroundColor: '#ffffff', logging: false });
        const img = canvas.toDataURL('image/jpeg', 0.92);
        if (i) pdf.addPage([W, H], 'portrait');
        pdf.addImage(img, 'JPEG', X, Y, PW, PH);
        pdf.addImage(img, 'JPEG', X, H / 2 + Y, PW, PH);
        pdf.setDrawColor(160);
        pdf.setLineDashPattern([1.5, 1.5], 0);
        pdf.setLineWidth(0.15);
        pdf.line(0, H / 2, W, H / 2);
      }
      pdf.save(`certificates-${dlDate.value}.pdf`);
      msg.textContent = `Downloaded ${ids.length} certificate${ids.length > 1 ? 's' : ''}.`;
    } catch (e) {
      msg.textContent = 'Download failed: ' + e.message;
    } finally {
      box.remove();
      btn.disabled = false;
    }
  });

  /* ---------------- Settings ---------------- */
  const sf = $('#settingsForm');

  function loadSettingsForm() {
    const s = Store.settings();
    for (const k of Object.keys(s)) if (sf[k]) sf[k].value = Array.isArray(s[k]) ? s[k].join('\n') : s[k];
    sf.newPassword.value = '';
    $('#settingsMsg').textContent = '';
  }

  sf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = Store.settings();
    for (const k of Object.keys(s)) if (sf[k]) s[k] = sf[k].value.trim();
    for (const k of OPTION_KEYS) s[k] = (sf[k]?.value || '').split('\n').map(x => x.trim()).filter(Boolean);
    s.nextControl = Math.max(1, parseInt(s.nextControl, 10) || 1);
    const pw = sf.newPassword.value;
    $('#settingsMsg').textContent = 'Saving…';
    try {
      const { settings } = await run(() => api('settings', { method: 'PUT', body: { ...s, newPassword: pw } }));
      Store.cfg = settings;
      loadSettingsForm();
      $('#settingsMsg').textContent = pw ? 'Settings and password saved.' : 'Settings saved.';
    } catch {
      $('#settingsMsg').textContent = '';
    }
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
      await run(() => api('requests', { method: 'PUT', body: { requests: data.requests } }));
      if (data.settings) {
        const { adminPassword, ...rest } = data.settings;
        await run(() => api('settings', { method: 'PUT', body: rest }));
      }
      await Store.load();
      currentId = null;
      loadSettingsForm();
      $('#settingsMsg').textContent = 'Backup imported.';
    } catch (ex) {
      if (!ex.status) alert('That file is not a valid backup.');
    } finally {
      e.target.value = '';
    }
  });

  /* ---------------- Start ---------------- */
  api('session')
    .then(s => s.admin ? showApp() : ($('#login').hidden = false))
    .catch(() => ($('#login').hidden = false));

  // Warn before leaving with unsaved edits
  window.addEventListener('beforeunload', (e) => {
    if ($('#saveState')?.textContent === 'Saving…') e.preventDefault();
  });
})();
