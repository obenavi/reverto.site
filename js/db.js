// Core auth, API, and utility helpers

const API = '/api';

// ── Storage (sessionStorage primary, localStorage fallback) ──────────────────
function _store(key, val) {
  try { sessionStorage.setItem(key, val); } catch (_) {}
  try { localStorage.setItem(key, val); } catch (_) {}
}
function _get(key) {
  try { return sessionStorage.getItem(key) || localStorage.getItem(key); } catch (_) { return null; }
}
function _del(key) {
  try { sessionStorage.removeItem(key); } catch (_) {}
  try { localStorage.removeItem(key); } catch (_) {}
}

const KEYS = ['yd_token', 'yd_user_id', 'yd_business_id', 'yd_role', 'yd_name', 'yd_business_name', 'yd_plan', 'yd_onboarded'];

// ── Auth ─────────────────────────────────────────────────────────────────────
const Auth = {
  token: () => _get('yd_token'),
  userId: () => _get('yd_user_id'),
  businessId: () => _get('yd_business_id'),
  role: () => _get('yd_role'),
  name: () => _get('yd_name'),
  businessName: () => _get('yd_business_name'),
  plan: () => _get('yd_plan') || 'free',
  isOnboarded: () => _get('yd_onboarded') === 'true',

  isOwner: () => Auth.role() === 'owner',
  isManager: () => ['owner', 'manager'].includes(Auth.role()),

  save(data) {
    _store('yd_token', data.token);
    _store('yd_user_id', data.user_id);
    _store('yd_business_id', data.business_id);
    _store('yd_role', data.role);
    _store('yd_name', data.name || '');
    _store('yd_business_name', data.business_name || '');
    _store('yd_plan', data.plan || 'free');
    _store('yd_onboarded', String(!!data.onboarded));
  },

  setOnboarded(v) { _store('yd_onboarded', String(!!v)); },

  clear() { KEYS.forEach(_del); },

  isLoggedIn: () => !!Auth.token(),

  // Sends the user where they belong: login if signed out, onboarding if setup
  // is incomplete. Returns false when a redirect was issued.
  requireAuth({ allowUnonboarded = false } = {}) {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login';
      return false;
    }
    if (!allowUnonboarded && !Auth.isOnboarded()) {
      window.location.href = '/onboarding';
      return false;
    }
    return true;
  },

  logout() {
    Auth.clear();
    window.location.href = '/login';
  }
};

// ── API fetch wrapper ─────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.token();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(API + path, { ...options, headers });
  } catch (_) {
    return { ok: false, status: 0, data: { error: 'Network error — check your connection' } };
  }

  if (res.status === 401 && Auth.isLoggedIn()) {
    Auth.clear();
    window.location.href = '/login';
    return { ok: false, status: 401, data: { error: 'Session expired' } };
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const apiGet  = (path) => apiFetch(path);
const apiPost = (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) });

// ── Toast notifications ──────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const existing = document.getElementById('yd-toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'yd-toast';
  t.className = `yd-toast yd-toast-${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent = msg;
  document.body.appendChild(t);

  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
}

// ── Formatting helpers ───────────────────────────────────────────────────────
function formatUSD(n, decimals = 2) {
  if (n === null || n === undefined || n === '') return '—';
  return '$' + (+n).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPct(n) {
  if (n === null || n === undefined || n === '') return '—';
  return (+n).toFixed(1) + '%';
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(String(d).slice(0, 10) + 'T12:00:00');
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Plan gating ──────────────────────────────────────────────────────────────
function isPro() {
  return ['pro', 'enterprise'].includes(Auth.plan());
}

function requirePro(featureName) {
  if (isPro()) return true;
  showUpgradeModal(featureName);
  return false;
}

function showUpgradeModal(feature) {
  const m = document.getElementById('upgrade-modal');
  if (!m) { showToast(`${feature || 'That feature'} requires the Pro plan.`, 'info'); return; }
  const f = m.querySelector('.upgrade-feature');
  if (f) f.textContent = feature || 'this feature';
  m.classList.remove('hidden');
}
