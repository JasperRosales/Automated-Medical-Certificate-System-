(function () {
  const form = document.getElementById('requestForm');
  const err = document.getElementById('formError');

  form.date.value = todayISO();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    for (const k of Object.keys(data)) data[k] = data[k].trim();

    const missing = ['name', 'age', 'sex', 'civilStatus', 'address', 'date'].filter(k => !data[k]);
    if (missing.length) {
      err.textContent = 'Please complete all fields.';
      focusField(missing[0]);
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
      ({ ref } = await api('requests', { method: 'POST', body: {
        name: data.name, age: String(age), sex: data.sex,
        civilStatus: data.civilStatus, address: data.address, date: data.date
      } }));
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
    form.name.focus();
  });
})();
