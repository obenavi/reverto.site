// Core auth, API, and utility helpers

const API = '';

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

// ── Auth ─────────────────────────────────────────────────────────────────────
const Auth = {
  token: () => _get('yd_token'),
  userId: () => _get('yd_user_id'),
  businessId: () => _get('yd_business_id'),
  role: () => _get('yd_role'),
  name: () => _get('yd_name'),

  isOwner: () => Auth.role() === 'owner',
  isManager: () => ['owner', 'manager'].includes(Auth.role()),

  save(data) {
    _store('yd_token', data.token);
    _store('yd_user_id', data.user_id);
    _store('yd_business_id', data.business_id);
    _store('yd_role', data.role);
    _store('yd_name', data.name || '');
  },

  clear() {
    ['yd_token', 'yd_user_id', 'yd_business_id', 'yd_role', 'yd_name'].forEach(_del);
  },

  isLoggedIn: () => !!Auth.token(),

  requireAuth() {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  }
};

// ── API fetch wrapper ─────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.token();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, { ...options, headers });

  if (res.status === 401) {
    Auth.clear();
    window.location.href = '/login.html';
    return null;
  }

  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch (_) { return { ok: res.ok, status: res.status, data: text }; }
}

// ── Toast notifications ──────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const existing = document.getElementById('yd-toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'yd-toast';
  t.className = `yd-toast yd-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);

  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
}

// ── Formatting helpers ───────────────────────────────────────────────────────
function formatUSD(n) {
  return '$' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPct(n) {
  return (+n).toFixed(1) + '%';
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Plan check ───────────────────────────────────────────────────────────────
function isPro() {
  return _get('yd_plan') === 'pro' || _get('yd_plan') === 'enterprise';
}

function requirePro(featureName) {
  if (!isPro()) {
    showUpgradeModal(featureName);
    return false;
  }
  return true;
}

function showUpgradeModal(feature) {
  const m = document.getElementById('upgrade-modal');
  if (!m) return;
  const f = m.querySelector('.upgrade-feature');
  if (f) f.textContent = feature || 'this feature';
  m.classList.remove('hidden');
}
