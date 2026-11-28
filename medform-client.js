(function () {
  const form = document.getElementById('requestForm');
  const err = document.getElementById('formError');
  form.date.value = todayISO();

  // 2x2 picture: downscaled to a small JPEG before sending
  let photo = '';
  const thumb = document.getElementById('photoThumb');
  const photoIn = document.getElementById('photo');
  const photoClear = document.getElementById('photoClear');
  function showPhoto(url) {
    photo = url;
    thumb.style.backgroundImage = url ? `url(${url})` : '';
    thumb.textContent = url ? '' : 'No photo';
    photoClear.hidden = !url;
    document.getElementById('photoPick').textContent = url ? 'Change photo' : 'Choose photo';
    if (!url) photoIn.value = '';
  }
  photoIn.addEventListener('change', () => {
    const file = photoIn.files[0];
    if (!file) return showPhoto('');
    if (!/^image\//.test(file.type)) { err.textContent = 'Please choose an image file.'; return showPhoto(''); }
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 360 / Math.max(img.width, img.height));
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * s), height: Math.round(img.height * s) });
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      err.textContent = '';
      showPhoto(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { err.textContent = 'Could not read that image.'; showPhoto(''); };
    img.src = URL.createObjectURL(file);
  });
  photoClear.addEventListener('click', () => showPhoto(''));

  // Fill in age from the birthday
  form.birthday.addEventListener('change', () => {
    const [y, m, d] = form.birthday.value.split('-').map(Number);
    if (!y) return;
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    if (age > 0 && age < 131) form.age.value = age;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const data = Object.fromEntries(new FormData(form).entries());
    for (const k of Object.keys(data)) data[k] = data[k].trim();

    const missing = ['last', 'first', 'birthday', 'age', 'sex', 'civilStatus', 'weight', 'height', 'address', 'date'].filter(k => !data[k]);
    if (missing.length) {
      err.textContent = 'Please complete all required fields.';
      focusField(missing[0]);
      return;
    }
    const age = Number(data.age);
    if (!Number.isInteger(age) || age < 1 || age > 130) {
      err.textContent = 'Please enter a valid age.';
      form.age.focus();
      return;
    }

    const w = Number(data.weight), h = Number(data.height);
    if (!(w > 0 && w <= 400)) { err.textContent = 'Please enter a valid weight in kg.'; form.weight.focus(); return; }
    if (!(h >= 30 && h <= 260)) { err.textContent = 'Please enter a valid height in cm.'; form.height.focus(); return; }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    let ref;
    try {
      ({ ref } = await api('requests', { method: 'POST', body: { ...data, age: String(age), birthday: fmtDate(data.birthday), photo, type: 'medform' } }));
    } catch (ex) {
      err.textContent = ex.message;
      return;
    } finally {
      btn.disabled = false;
    }
    document.getElementById('refCode').textContent = ref;
    document.getElementById('formCard').hidden = true;
    document.getElementById('successCard').hidden = false;
  });

  document.getElementById('anotherBtn').addEventListener('click', () => {
    form.reset();
    showPhoto('');
    form.date.value = todayISO();
    document.getElementById('successCard').hidden = true;
    document.getElementById('formCard').hidden = false;
    form.last.focus();
  });
})();
