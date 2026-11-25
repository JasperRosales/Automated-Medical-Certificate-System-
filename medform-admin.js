/* Pre-Employment/OJT Medical Examination Form for the admin page.
 * Values live on the request (age/sex/civilStatus/address) and in rec.cert (everything else). */
const MedForm = (function () {
  const PE = [
    ['General Appearance/Body Built (BMI)', 'Chest, Breast, Axilla'], ['Skin (Tattoo)', 'Heart'],
    ['Head and Scalp', 'Lungs'], ['Eyes (External)', 'Abdomen'], ['Ears (Piercing)', 'Anus, Rectum'],
    ['Nose and Throat', 'Genital'], ['Mouth', 'Musculo-Skeletal'], ['Neck, Thyroid, LN', 'Extremities']
  ];

  function defaults(rec, s) {
    const c = rec.cert;
    const today = fmtDate(todayISO());
    const d = { controlNo: '', formDate: fmtDate(rec.date), examDate: today, sigDate: today, physDate: today, physician: s.physician || '', license: s.license || '' };
    for (const [k, v] of Object.entries(d)) if (c[k] === undefined) c[k] = v;
    return rec;
  }

  const names = c => {
    const fm = [c.first, c.middle].filter(Boolean).join(' ');
    return {
      fullname: c.last && fm ? `${c.last}, ${fm}` : (c.last || fm || ''),
      signame: [c.first, c.middle ? c.middle.charAt(0) + '.' : '', c.last].filter(Boolean).join(' ')
    };
  };

  const PHOTO_TTL_MS = 24 * 3600e3;

  function html(rec, { pageH = 330.2 } = {}) {
    const c = rec.cert;
    // Photos last one day; the server removes older ones
    if (c.photo && !(Date.now() - Number(c.photoAt) < PHOTO_TTL_MS)) { c.photo = ''; c.photoAt = ''; }
    const val = k => (PATIENT_KEYS.includes(k) ? rec[k] : c[k]) ?? '';
    const ed = (k, ph = '', cls = '', style = '') =>
      `<div class="mfv ${cls}" contenteditable="true" data-k="${k}" data-ph="${esc(ph)}"${style ? ` style="${style}"` : ''}>${esc(val(k))}</div>`;
    const at = (k, l, t, w, ph = '', cls = '') => ed(k, ph, 'a ' + cls, `left:${l}mm;top:${t}mm;width:${w}mm`);
    const cb = (k, v) => `<span class="cb ${c[k] === v ? 'on' : ''}" data-cb="${k}" data-v="${esc(v)}"></span>`;
    const n = names(c);
    const td = (k, ph, up = true) => `<td class="fill">${ed(k, ph, up ? 'up' : '')}</td>`;
    const hist = (label, key, rows, h) => Array.from({ length: rows }, (_, i) =>
      `<tr>${i ? '' : `<td class="hl" rowspan="${rows}">${label}</td>`}<td style="height:${h}mm">${ed(key + (i + 1))}</td></tr>`).join('');
    const pe = PE.map(([a, b], i) => {
      const x = i * 2, y = i * 2 + 1;
      return `<tr><td>${a}</td><td class="ck">${cb(`pe${x}n`, '1')}</td><td>${ed(`pe${x}f`)}</td>` +
        `<td>${b}</td><td class="ck">${cb(`pe${y}n`, '1')}</td><td>${ed(`pe${y}f`)}</td></tr>`;
    }).join('');

    return `<div class="mf-pages">
<section class="mf-page" style="--ph:${pageH}mm"><div class="sheet">
  <table class="g hdr">
    <colgroup><col style="width:16.8mm"><col style="width:78.7mm"><col style="width:67mm"><col></colgroup>
    <tr><td class="logo"><img src="seal.png" alt=""></td>
      <td>Reference No.: BatStateU-FO-HSD-04</td><td>Effectivity Date: September 28, 2026</td><td>Revision No.: 04</td></tr>
  </table>
  <div class="title">PRE-EMPLOYMENT/OJT MEDICAL EXAMINATION FORM</div>
  <div class="privacy">
    <p>The University values your privacy and is committed to protecting personal data in accordance with Republic Act (R.A.) No. 10173 or the Data Privacy Act of 2012, its Implementing Rules and Regulations, and relevant issuances of the National Privacy Commission (NPC).</p>
    <p>We collect and process personal data only when necessary, and always in accordance with the principles of proportionality, transparency, and legitimate purpose. Personal data shall be processed only to the extent required to fulfill our mandates under R.A. No. 11694. Specifically, we process your personal data to fulfill our obligations as a state university, to protect and promote stakeholder welfare, for administration and management of affairs, and other purposes reasonably expected of us as the Philippines' National Engineering University.</p>
    <p>To ensure the protection of your personal data, we employ appropriate organizational, technical, and physical security measures designed to maintain its confidentiality, integrity, and availability. By submitting this form, you consent to the collection and processing of your personal data by the University for the stated purposes, in accordance with this Privacy Statement and our privacy policies.</p>
    <p>Under the Data Privacy Act of 2012, you have the right to be informed of how your data is processed; to object to processing under lawful conditions; to access your personal data; to correct inaccurate or incomplete data; to block or erase unnecessary or unlawfully obtained data; to data portability or obtain your data in a commonly used format; to damages for unlawful use; and to file a complaint with the NPC.</p>
    <p>Take time to read about our Privacy Policies available at https://batstateu.edu.ph/privacy-policy/.</p>
    <p>For inquiries regarding our Privacy Notice and the processing of your personal data, as well as any concerns or complaints regarding data privacy, please contact our Data Protection Officer at dpo@g.batstate-u.edu.ph or at (+63 43) 406-8800; 779-8400 to 62 local: 1171.</p>
  </div>
  <table class="g p1rows" style="border-top:0">
    <colgroup><col style="width:32.3mm"><col style="width:83.3mm"><col style="width:37.9mm"><col></colgroup>
    <tr class="r-ctrl"><td colspan="4" style="border-top:0">Control No.: <span class="ctrl" contenteditable="true" data-k="controlNo" data-ph="on approval">${esc(c.controlNo)}</span></td></tr>
    <tr class="r-it"><td colspan="4" style="height:5.7mm">(To be filled out by the Employee/Students)</td></tr>
    <tr class="r-pi"><td>LAST NAME</td>${td('last', 'last name')}<td>DATE</td>${td('formDate', 'date', false)}</tr>
    <tr class="r-pi"><td>FIRST NAME</td>${td('first', 'first name')}<td>BIRTHDAY</td>${td('birthday', 'birthday', false)}</tr>
    <tr class="r-pi"><td>MIDDLE NAME</td>${td('middle', 'middle name')}<td>AGE</td>${td('age', 'age')}</tr>
    <tr class="r-pi"><td>SEX</td>${td('sex', 'sex')}<td>CIVIL STATUS</td>${td('civilStatus', 'status')}</tr>
    <tr class="r-pi"><td>CELLPHONE NO.</td>${td('cellphone', '')}<td>TEL. NO.</td>${td('tel', '')}</tr>
    <tr class="r-ad"><td>ADDRESS</td>${td('address', 'address')}<td class="pos">POSITION/PROGRAM/<br>CAMPUS</td>${td('position', '')}</tr>
    <tr class="r-it"><td colspan="4" style="height:3.9mm;line-height:1">(To be filled out by the Health Services Office Staff only)</td></tr>
  </table>
  <table class="g hist" style="border-top:0">
    <colgroup><col style="width:49.8mm"><col></colgroup>
    ${hist('PAST MEDICAL HISTORY', 'pmh', 4, 4.85)}${hist('FAMILY HISTORY', 'fh', 4, 4.5)}${hist('OCCUPATIONAL HISTORY', 'oh', 2, 4.5)}
  </table>
  <table class="g pe" style="border-top:0">
    <colgroup><col style="width:58.6mm"><col style="width:19.4mm"><col style="width:20.9mm"><col style="width:52.1mm"><col style="width:20.6mm"><col></colgroup>
    <tr><td colspan="6" class="st" style="height:4.4mm">PHYSICAL EXAMINATION</td></tr>
    <tr><th>REVIEW OF SYSTEM</th><th>NORMAL</th><th>FINDINGS</th><th>REVIEW OF SYSTEM</th><th>NORMAL</th><th>FINDINGS</th></tr>
    ${pe}
    <tr><td colspan="6" class="st" style="height:4.8mm;line-height:1">DIAGNOSTIC EXAMINATION</td></tr>
  </table>
  <div class="diag">
    <div class="div"></div>
    <div class="a" style="left:2.3mm;top:1.4mm">BLOOD PRESSURE</div><div class="ln" style="left:37.8mm;width:29.9mm;top:5mm"></div>${at('bp', 37.8, 1.3, 29.9)}
    <div class="a" style="left:2.3mm;top:6.2mm">HEART RATE</div><div class="ln" style="left:37.8mm;width:29.9mm;top:9.5mm"></div>${at('hr', 37.8, 5.8, 29.9)}
    <div class="a" style="left:2.3mm;top:10.6mm">HEARING</div>
    <div class="a" style="left:39.9mm;top:10.4mm">${cb('hearing', 'Normal')}Normal</div>
    <div class="a" style="left:70mm;top:10.4mm">${cb('hearing', 'Defective')}Defective</div>
    <div class="a" style="left:2.3mm;top:15.1mm">VISION</div>
    <div class="a" style="left:30.2mm;top:14.9mm">${cb('vision', 'With')}With glasses</div>
    <div class="a" style="left:70.1mm;top:15.1mm">R:</div><div class="ln" style="left:77.3mm;width:12.6mm;top:18.8mm"></div>${at('visR', 77.3, 15.1, 18)}
    <div class="a" style="left:30.2mm;top:19.5mm">${cb('vision', 'Without')}Without glasses</div>
    <div class="a" style="left:70.1mm;top:19.6mm">L:</div><div class="ln" style="left:77.3mm;width:12.6mm;top:23.5mm"></div>${at('visL', 77.3, 19.8, 18)}
    <div class="a" style="left:2.3mm;top:24.3mm">CHEST X-RAY</div><div class="a" style="left:30mm;top:24.3mm">Result:</div>
    <div class="ln" style="left:28mm;width:67.8mm;top:32.5mm"></div>${at('xray', 28, 28.8, 67.8, 'result')}
    <div class="a" style="left:30mm;top:33.2mm">Result Date:</div><div class="ln" style="left:53.4mm;width:42.4mm;top:37mm"></div>${at('xrayDate', 53.4, 33.2, 42.4)}
    <div class="a" style="left:2.3mm;top:37.7mm">COMPLETE BLOOD COUNT</div>
    <div class="a" style="left:30.2mm;top:41.9mm">${cb('cbc', 'Normal')}Normal</div>
    <div class="a" style="left:55.6mm;top:41.9mm">${cb('cbc', 'Findings')}Findings:</div><div class="ln" style="left:76.9mm;width:18.9mm;top:45.7mm"></div>${at('cbcFind', 76.9, 42, 18.9)}
    <div class="a" style="left:102.9mm;top:0.6mm">ROUTINE URINALYSIS</div>
    <div class="a" style="left:122.2mm;top:5.1mm">${cb('ua', 'Normal')}Normal</div>
    <div class="a" style="left:150.2mm;top:5.1mm">${cb('ua', 'Findings')}Findings:</div>${at('uaFind', 122.2, 9.8, 72, 'findings')}
    <div class="a" style="left:102.9mm;top:14.8mm">DRUG TEST</div>
    <div class="a" style="left:115.3mm;top:19.1mm">Methamphetamine</div>
    <div class="a" style="left:122.2mm;top:23.8mm">${cb('meth', 'Negative')}Negative</div>
    <div class="a" style="left:149.9mm;top:23.6mm">${cb('meth', 'Positive')}Positive</div>
    <div class="a" style="left:115.3mm;top:28.4mm">Tetrahydrocannabinol</div>
    <div class="a" style="left:122.2mm;top:32.8mm">${cb('thc', 'Negative')}Negative</div>
    <div class="a" style="left:149.9mm;top:32.6mm">${cb('thc', 'Positive')}Positive</div>
    <div class="a" style="left:115.3mm;top:37.7mm">Date Taken:</div>${at('drugDate', 135, 37.6, 58)}
  </div>
  <div class="pgno">Page 1 of 2</div>
</div></section>

<section class="mf-page" style="--ph:${pageH}mm"><div class="sheet">
  <div class="cert">
    <div class="ct">CERTIFICATION</div>
    <div class="vdiv"></div>
    <div class="photo ${c.photo ? 'has' : ''}" data-photo title="Click to upload a 2×2 picture (kept for 1 day)">${c.photo ? `<img src="${c.photo}" alt="">` : ''}<span>Attach<br>picture here</span></div>
    <div class="a" style="left:0.6mm;top:13mm">School/Company/</div>
    <div class="a" style="left:0.6mm;top:17.7mm">Institution:</div><div class="ln" style="left:27.3mm;width:38.7mm;top:22.6mm"></div>${at('institution', 27.3, 18.8, 38.7)}
    <div class="a" style="left:1.7mm;top:24.8mm">Name:</div><div class="ln" style="left:14.7mm;width:51.3mm;top:28mm"></div>
    <div class="a mfv up" data-derive="fullname" style="left:15.4mm;top:24.2mm;width:50.4mm">${esc(n.fullname)}</div>
    <div class="a" style="left:1.9mm;top:39.3mm">Weight (kg):</div><div class="ln" style="left:22.6mm;width:32mm;top:42.2mm"></div>${at('weight', 22.6, 38.5, 32)}
    <div class="a" style="left:1.9mm;top:48.6mm">Height (cm):</div><div class="ln" style="left:22.6mm;width:32mm;top:51.5mm"></div>${at('height', 22.6, 47.7, 32)}
    <div class="a" style="left:1.9mm;top:53.8mm">Civil Status:</div><div class="ln" style="left:22.6mm;width:32mm;top:57mm"></div>${at('civilStatus', 22.6, 53.2, 32, '', 'up')}
    <div class="a" style="left:1.9mm;top:59mm">Date of Examination:</div><div class="ln" style="left:34.4mm;width:41.1mm;top:62.7mm"></div>${at('examDate', 34.4, 58.9, 41.1)}
    <div class="auth">I hereby authorize BATANGAS STATE UNIVERSITY and its officially designated medical examiner and examining physician/s to furnish information that the company may need pertaining to my health status and other pertinent medical findings and do hereby release them from any and all legal responsibilities by so doing. I also further certify that the medical history contained herein is true to the best of my knowledge and any false statement will disqualify me from any employment benefits and claims.</div>
    <div class="a mfv up" data-derive="signame" style="left:14.2mm;width:67.7mm;top:104.4mm;text-align:center">${esc(n.signame)}</div>
    <div class="ln" style="left:14.2mm;width:67.7mm;top:108.6mm"></div>
    <div class="a" style="left:0;width:96.9mm;top:109.4mm;text-align:center">Signature over Printed Name of Employee/Student</div>
    <div class="a" style="left:28.5mm;top:113.6mm">Date:</div>${at('sigDate', 39, 113.5, 40)}

    <div class="a" style="left:99mm;top:6.5mm;font-style:italic;font-size:9.6pt">To be filled out by the Physician only</div>
    <div class="a" style="left:99mm;top:10.3mm;width:96mm;white-space:normal;text-align:justify;line-height:4mm">I certify that I have examined and found the applicant to be physically fit/ unfit for employment.</div>
    <div class="hl2" style="top:18.8mm"></div>
    <div class="a" style="left:99mm;top:19.7mm">CLASSIFICATION:</div>
    <div class="a cls-b" style="left:102.1mm;top:25.1mm">${cb('cls', 'A')}CLASS A</div>
    <div class="cls-d" style="top:24.9mm">Physically fit to work</div>
    <div class="a cls-b" style="left:102.1mm;top:30.3mm">${cb('cls', 'B')}CLASS B</div>
    <div class="cls-d" style="top:30.1mm">Physically underdeveloped or with correctible defects but otherwise fit to work</div>
    <div class="a" style="left:106.4mm;top:43.6mm;font-weight:bold">REMARKS:</div>${at('mfRemarks', 127, 43.5, 67, 'remarks')}
    <div class="a cls-b" style="left:102.1mm;top:48.4mm">${cb('cls', 'C')}CLASS C</div>
    <div class="cls-d" style="top:48.2mm;line-height:4.6mm">Employable but owing to certain impairments or conditions, requires special placement or limited duty in a specified or selected assignment requiring follow up treatment/ periodic evaluation</div>
    <div class="a cls-b" style="left:103.2mm;top:73.6mm">${cb('cls', 'D')}CLASS D</div>
    <div class="cls-d" style="top:73.4mm;line-height:4.6mm"><span style="text-decoration:underline">Unfit or unsafe for any type of</span><br><span style="text-decoration:underline">employment</span></div>
    <div class="hl2" style="top:83.6mm"></div>
    ${at('physician', 108, 98.4, 70, "physician's name", 'up ctr')}
    <div class="ln" style="left:108mm;width:70mm;top:102.8mm"></div>
    <div class="a" style="left:96.9mm;width:99mm;top:103.5mm;text-align:center;padding-right:3mm">Signature over Printed Name of Attending Physician</div>
    <div class="a" style="left:124.6mm;top:107.9mm">License No.:</div><div class="ln" style="left:145mm;width:30mm;top:111.1mm"></div>${at('license', 145, 107.4, 30)}
    <div class="a" style="left:124.6mm;top:112.6mm">Date:</div>${at('physDate', 135, 112.5, 40)}
  </div>
  <div class="note"><span>Note:</span> This certificate does not cover conditions or diseases that will require procedure and examination for their detection and those which are asymptomatic at the time of examination. Valid only for six (6) months from the date of examination.</div>
</div></section>
</div>`;
  }

  // Shrink text that is wider (or taller) than its box
  function fit(el) {
    if (!el.classList.contains('mfv')) return;
    el.style.removeProperty('font-size');
    let size = parseFloat(getComputedStyle(el).fontSize) * 0.75;
    while ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && size > 6) {
      size -= 0.25;
      el.style.fontSize = size + 'pt';
    }
  }

  // After an edit: copy the value to duplicates of the same field and refresh derived names
  function sync(root, rec, k, from) {
    for (const el of root.querySelectorAll(`[data-k="${k}"]`)) if (el !== from) { el.textContent = from.textContent; fit(el); }
    if (['last', 'first', 'middle'].includes(k)) {
      const n = names(rec.cert);
      rec.name = n.fullname;
      for (const el of root.querySelectorAll('[data-derive]')) { el.textContent = n[el.dataset.derive]; fit(el); }
    }
  }

  // Read an image, crop-free downscale, return a small JPEG data URL
  function readPhoto(file) {
    return new Promise((ok, fail) => {
      if (!file || !/^image\//.test(file.type)) return fail(new Error('Please choose an image.'));
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 360 / Math.max(img.width, img.height));
        const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * s), height: Math.round(img.height * s) });
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        ok(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => fail(new Error('Could not read that image.'));
      img.src = URL.createObjectURL(file);
    });
  }

  return { defaults, html, fit, sync, readPhoto };
})();
