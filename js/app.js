// Application shell: bootstrap session, tab routing

(function () {
  if (!Auth.requireAuth()) return;

  const tabs   = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    dashboard: document.getElementById('panel-dashboard'),
    invoices:  document.getElementById('panel-invoices'),
    market:    document.getElementById('panel-market'),
    settings:  document.getElementById('panel-settings')
  };

  const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  function activate(name, { focus = false } = {}) {
    if (!panels[name]) name = 'dashboard';

    tabs.forEach(t => {
      const on = t.dataset.panel === name;
      t.setAttribute('aria-selected', String(on));
    });
    Object.entries(panels).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));

    if (focus) panels[name].focus();
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    document.title = `${name[0].toUpperCase() + name.slice(1)} — Yield`;
  }

  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.panel, { focus: true })));

  // Arrow-key navigation between tabs (WCAG tablist pattern)
  document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft')  next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home')       next = 0;
    if (e.key === 'End')        next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    tabs[next].focus();
    activate(tabs[next].dataset.panel);
  });

  document.querySelectorAll('[data-goto]').forEach(b =>
    b.addEventListener('click', () => activate(b.dataset.goto, { focus: true })));

  window.addEventListener('hashchange', () => activate(location.hash.slice(1)));

  // ── Chrome ─────────────────────────────────────────────────────────────────
  document.getElementById('logout').addEventListener('click', () => Auth.logout());

  text('today', new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }));

  function paint(user, business) {
    text('biz-name', business.name || '');
    text('set-name', user.name || '—');
    text('set-email', user.email || '—');
    text('set-role', user.role || '—');
    text('set-biz', business.name || '—');
    text('set-loc', [business.city, business.state].filter(Boolean).join(', ') || '—');

    const plan = business.plan || 'free';
    text('set-plan', plan[0].toUpperCase() + plan.slice(1));
    const badge = document.getElementById('plan-badge');
    badge.textContent = plan.toUpperCase();
    badge.classList.toggle('pro', plan !== 'free');
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  (async function load() {
    // Paint from cached session first so the shell isn't empty while we fetch.
    paint(
      { name: Auth.name(), email: '—', role: Auth.role() },
      { name: Auth.businessName(), plan: Auth.plan() }
    );

    const { ok, data } = await apiGet('/auth/me');
    if (!ok) {
      showToast((data && data.error) || 'Could not load your account.', 'error');
      return;
    }

    paint(data.user, data.business);
    Auth.save({
      token: Auth.token(),
      user_id: data.user.id,
      business_id: data.business.id,
      role: data.user.role,
      name: data.user.name,
      business_name: data.business.name,
      plan: data.business.plan,
      onboarded: data.business.onboarded
    });

    if (!data.business.onboarded) window.location.href = '/onboarding';
  })();

  activate(location.hash.slice(1) || 'dashboard');
})();
