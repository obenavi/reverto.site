// Reverto app shell: frosted top bar (company + profile menus) and fixed
// bottom 5-tab nav. Injected into authenticated pages so the markup stays in
// one place. CSP-safe (no external resources). Requires js/db.js (Auth/showToast)
// to be loaded first.

(function () {
  // SVG icon set (inline, currentColor) ------------------------------------
  var I = {
    chev: '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    contact: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 4h16v12H7l-3 3z"/></svg>',
    refer: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M16 11a3 3 0 100-6 3 3 0 000 6z"/><path d="M8 13a3 3 0 100-6 3 3 0 000 6z"/><path d="M2 20c0-2.5 2.7-4 6-4s6 1.5 6 4"/><path d="M14 16c2.8.2 5 1.6 5 4"/></svg>',
    vision: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 2l2.6 6.6L21 9.3l-5 4.3 1.6 6.7L12 16.9 6.4 20.3 8 13.6 3 9.3l6.4-.7z"/></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    branch: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg>',
    key: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M21 2l-2 2m-7.6 7.6a5 5 0 11-1.4-1.4l5-5 1.4 1.4L18 8l2 2 2-2-3-3"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    navDash: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 13a9 9 0 0118 0"/><path d="M12 13l4-3"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>',
    navMarket: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 17l6-6 4 4 7-7"/><path d="M17 8h4v4"/></svg>',
    navScan: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8a2 2 0 012-2h2l1.5-2h7L18 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.2"/></svg>',
    navVendors: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>',
    navRecipes: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M6 3h12a1 1 0 011 1v16l-7-3-7 3V4a1 1 0 011-1z"/><path d="M9 8h6M9 12h6"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function initials(name) {
    var n = (name || '').trim();
    if (!n) return 'RV';
    var parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function roleLabel(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'manager') return 'Manager';
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member';
  }

  // ?? company menu item -> "Coming soon" toast
  function comingSoon(e) {
    if (e) e.preventDefault();
    if (typeof showToast === 'function') showToast('Coming soon', 'info');
  }

  // Builds the top bar (with both menus + scrim) and bottom nav, then wires
  // the open/close behavior. `active` is one of:
  // dashboard | market | scan | vendors | recipes  (controls aria-current).
  function renderShell(active) {
    var name = (typeof Auth !== 'undefined' && Auth.name && Auth.name()) || 'Reverto';
    var role = (typeof Auth !== 'undefined' && Auth.role && Auth.role()) || '';

    var topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML =
      '<button class="wordmark" id="sh-companyBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="sh-companyMenu">' +
        '<span class="mark">Reverto</span>' + I.chev +
      '</button>' +
      '<button class="avatar-btn" id="sh-profileBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="sh-profileMenu" title="Business profile">' + esc(initials(name)) + '</button>' +

      '<ul class="menu menu-left" id="sh-companyMenu" role="menu" aria-label="Company menu">' +
        '<li class="menu-header">Reverto</li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.contact + 'Contact us</a></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.refer + 'Refer a friend</a></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.vision + 'Our vision</a></li>' +
        '<li class="menu-sep" role="separator"></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.star + 'Upgrade subscription <span class="tag">PRO</span></a></li>' +
      '</ul>' +

      '<ul class="menu menu-right" id="sh-profileMenu" role="menu" aria-label="Business profile menu">' +
        '<li class="menu-header">' + esc(name) + ' <small>' + esc(roleLabel(role)) + '</small></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.edit + 'Edit business details</a></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.clock + 'Work days &amp; hours</a></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.branch + 'Branches / locations</a></li>' +
        '<li class="menu-sep" role="separator"></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.key + 'Generate partner code</a></li>' +
        '<li><a href="#" class="menu-item" role="menuitem" data-soon>' + I.lock + 'Generate manager code <span class="tag">LIMITED</span></a></li>' +
        '<li class="menu-sep" role="separator"></li>' +
        '<li><a href="/account.html" class="menu-item" role="menuitem">' + I.download + 'Export data</a></li>' +
        '<li><a href="/privacy.html" class="menu-item" role="menuitem">' + I.shield + 'Legal</a></li>' +
        '<li class="menu-sep" role="separator"></li>' +
        '<li><a href="/account.html" class="menu-item danger" role="menuitem">' + I.trash + 'Delete profile</a></li>' +
        '<li><button class="menu-item danger" id="sh-logoutBtn" type="button" role="menuitem">' + I.logout + 'Log out</button></li>' +
      '</ul>';

    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.id = 'sh-scrim';

    function tab(href, key, icon, label) {
      var cur = active === key ? ' aria-current="page"' : '';
      return '<a href="' + href + '" class="nav-tab"' + cur + '>' + icon + '<span class="lab">' + label + '</span></a>';
    }
    var nav = document.createElement('nav');
    nav.className = 'bottomnav';
    nav.setAttribute('aria-label', 'Primary');
    nav.innerHTML =
      tab('/dashboard.html', 'dashboard', I.navDash, 'Dashboard') +
      tab('/market.html', 'market', I.navMarket, 'Market') +
      '<a href="/app.html" class="nav-center"' + (active === 'scan' ? ' aria-current="page"' : '') + ' aria-label="Scan invoice">' +
        '<span class="orb">' + I.navScan + '</span><span class="lab">Scan</span></a>' +
      tab('/vendors.html', 'vendors', I.navVendors, 'Vendors') +
      tab('/recipes.html', 'recipes', I.navRecipes, 'Recipes');

    return { topbar: topbar, scrim: scrim, nav: nav };
  }

  // Mounts the shell into `frame` (an .app-frame element). Returns nothing.
  function mountShell(frame, active) {
    var parts = renderShell(active);
    frame.insertBefore(parts.scrim, frame.firstChild);
    frame.insertBefore(parts.topbar, frame.firstChild);
    frame.appendChild(parts.nav);

    // Wire menus -----------------------------------------------------------
    var scrim = parts.scrim;
    var menus = {
      company: { btn: document.getElementById('sh-companyBtn'), menu: document.getElementById('sh-companyMenu') },
      profile: { btn: document.getElementById('sh-profileBtn'), menu: document.getElementById('sh-profileMenu') }
    };
    function closeOne(w) { menus[w].menu.classList.remove('open'); menus[w].btn.setAttribute('aria-expanded', 'false'); }
    function closeAll() { closeOne('company'); closeOne('profile'); scrim.classList.remove('open'); }
    function open(w) { closeAll(); menus[w].menu.classList.add('open'); menus[w].btn.setAttribute('aria-expanded', 'true'); scrim.classList.add('open'); }
    function toggle(w) { menus[w].menu.classList.contains('open') ? closeAll() : open(w); }

    menus.company.btn.addEventListener('click', function (e) { e.stopPropagation(); toggle('company'); });
    menus.profile.btn.addEventListener('click', function (e) { e.stopPropagation(); toggle('profile'); });
    scrim.addEventListener('click', closeAll);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

    // "Coming soon" items
    parts.topbar.querySelectorAll('[data-soon]').forEach(function (el) {
      el.addEventListener('click', function (e) { closeAll(); comingSoon(e); });
    });

    // Log out
    var logout = document.getElementById('sh-logoutBtn');
    if (logout) logout.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof Auth !== 'undefined') Auth.clear();
      window.location.href = '/login.html';
    });
  }

  // Expose
  window.Shell = { mount: mountShell };
})();
