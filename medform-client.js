(function () {
  const form = document.getElementById('requestForm');
  const err = document.getElementById('formError');
  form.date.value = todayISO();

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

    const missing = ['last', 'first', 'birthday', 'age', 'sex', 'civilStatus', 'address', 'date'].filter(k => !data[k]);
    if (missing.length) {
      err.textContent = 'Please complete all required fields.';
      form[missing[0]].focus();
      return;
    }
    const age = Number(data.age);
    if (!Number.isInteger(age) || age < 1 || age > 130) {
      err.textContent = 'Please enter a valid age.';
      form.age.focus();
      return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    let ref;
    try {
      ({ ref } = await api('requests', { method: 'POST', body: { ...data, age: String(age), birthday: fmtDate(data.birthday), type: 'medform' } }));
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
    form.date.value = todayISO();
    document.getElementById('successCard').hidden = true;
    document.getElementById('formCard').hidden = false;
    form.last.focus();
  });
})();
