// Three-step onboarding wizard

(function () {
  if (!Auth.requireAuth({ allowUnonboarded: true })) return;
  if (Auth.isOnboarded()) { window.location.href = '/app'; return; }

  const form     = document.getElementById('onboard-form');
  const steps    = Array.from(document.querySelectorAll('fieldset.step'));
  const crumbs   = Array.from(document.querySelectorAll('#steps li'));
  const backBtn  = document.getElementById('back');
  const nextBtn  = document.getElementById('next');
  const errorBox = document.getElementById('error');

  let current = 0;

  const val = (id) => (document.getElementById(id).value || '').trim();

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }
  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function render() {
    steps.forEach((s, i) => s.classList.toggle('hidden', i !== current));
    crumbs.forEach((c, i) => {
      c.classList.toggle('done', i < current);
      if (i === current) c.setAttribute('aria-current', 'step');
      else c.removeAttribute('aria-current');
    });
    backBtn.disabled = current === 0;
    nextBtn.textContent = current === steps.length - 1 ? 'Finish setup' : 'Continue';
    const legend = steps[current].querySelector('legend');
    if (legend) legend.scrollIntoView({ block: 'nearest' });
  }

  function validate() {
    if (current === 1 && !val('loc_name')) {
      showError('Give this location a name.');
      document.getElementById('loc_name').focus();
      return false;
    }
    return true;
  }

  async function finish() {
    nextBtn.disabled = true;
    nextBtn.textContent = 'Saving…';

    const payload = {
      business: {
        city: val('city'),
        state: val('state').toUpperCase() || 'CA',
        phone: val('phone'),
        cuisine_type: val('cuisine_type'),
        seats: val('seats')
      },
      location: {
        name: val('loc_name'),
        address: val('loc_address'),
        city: val('city')
      },
      supplier: val('sup_name') ? {
        name: val('sup_name'),
        rep_name: val('rep_name'),
        rep_email: val('rep_email'),
        payment_terms: val('payment_terms')
      } : {}
    };

    const { ok, data } = await apiPost('/business/setup', payload);

    if (!ok) {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Finish setup';
      showError((data && data.error) || 'Could not save your setup. Please try again.');
      return;
    }

    Auth.setOnboarded(true);
    window.location.href = '/app';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    if (current < steps.length - 1) { current++; render(); return; }
    finish();
  });

  backBtn.addEventListener('click', () => {
    clearError();
    if (current > 0) { current--; render(); }
  });

  render();
})();
