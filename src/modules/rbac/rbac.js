/**
 * RBAC Prototype — Main UI Controller
 * =====================================
 * Single-file SPA-style controller.
 * Renders into  #rbac-root  on the page.
 * Uses RBAC_DATA (data.js) as the only data source.
 *
 * NO dependency on any existing Eduverse JS files.
 */

'use strict';

(function () {
  /* ─── DOM root ─────────────────────────────────────── */
  let root;

  /* ─── Toast helper ─────────────────────────────────── */
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `rbac-toast ${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ─── Modal helper ─────────────────────────────────── */
  function showModal(html, onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'rbac-modal-overlay';
    overlay.innerHTML = `<div class="rbac-modal rbac-page">${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); } });
    document.body.appendChild(overlay);
    return overlay;
  }

  /* ═════════════════════════════════════════════════════
     LOGIN PAGE
  ═════════════════════════════════════════════════════ */
  const DEMO_CREDENTIALS = [
    { role: 'HOD',                   user: 'hod.fy',       pass: 'hod@123'   },
    { role: 'Mathematics Teacher',   user: 'math.teacher', pass: 'math@123'  },
    { role: 'Physics Teacher',       user: 'phy.teacher',  pass: 'phy@123'   },
    { role: 'Pending Teacher',       user: 'arjun.patel',  pass: 'arjun@123' },
  ];

  function renderLogin(errorMsg) {
    root.innerHTML = `
    <div class="rbac-login-wrap rbac-page">
      <div class="rbac-login-bg"></div>
      <div class="rbac-login-card">

        <div class="rbac-login-logo">
          <div class="rbac-login-logo-icon">E</div>
          <div class="rbac-login-logo-text">
            <h1>Eduverse</h1>
            <span>Institution Management Portal</span>
          </div>
        </div>

        <h2 class="rbac-login-title">Welcome Back</h2>
        <p class="rbac-login-sub">Sign in to access your department workspace.</p>

        <div class="rbac-role-pills" id="rbac-role-pills">
          <button class="rbac-role-pill" data-idx="0">HOD</button>
          <button class="rbac-role-pill" data-idx="1">Math Teacher</button>
          <button class="rbac-role-pill" data-idx="2">Physics Teacher</button>
          <button class="rbac-role-pill" data-idx="3">Pending</button>
        </div>

        ${errorMsg ? `<div class="rbac-error-msg">⚠ ${errorMsg}</div>` : ''}

        <div class="rbac-field">
          <label class="rbac-label" for="rbac-username">Username</label>
          <input class="rbac-input" id="rbac-username" type="text" placeholder="e.g. hod.fy" autocomplete="username">
        </div>
        <div class="rbac-field">
          <label class="rbac-label" for="rbac-password">Password</label>
          <input class="rbac-input" id="rbac-password" type="password" placeholder="••••••••" autocomplete="current-password">
        </div>

        <button class="rbac-btn rbac-btn-primary" id="rbac-login-btn">
          Sign In
        </button>

        <div class="rbac-creds-hint">
          <p>Demo Credentials</p>
          ${DEMO_CREDENTIALS.map(c => `
            <div class="rbac-creds-row">
              <span>${c.role}</span>
              <span>${c.user} / ${c.pass}</span>
            </div>`).join('')}
        </div>

      </div>
    </div>`;

    /* role pill quick-fill */
    document.querySelectorAll('#rbac-role-pills .rbac-role-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const cred = DEMO_CREDENTIALS[btn.dataset.idx];
        document.getElementById('rbac-username').value = cred.user;
        document.getElementById('rbac-password').value = cred.pass;
        document.querySelectorAll('#rbac-role-pills .rbac-role-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    /* login submit */
    function doLogin() {
      const u = document.getElementById('rbac-username').value.trim();
      const p = document.getElementById('rbac-password').value;
      const btn = document.getElementById('rbac-login-btn');
      btn.innerHTML = '<span class="rbac-spinner"></span>';
      btn.disabled = true;
      setTimeout(() => {
        const res = RBAC_DATA.login(u, p);
        if (res.success) {
          renderApp();
        } else {
          renderLogin(res.error);
        }
      }, 500); // simulate async
    }

    document.getElementById('rbac-login-btn').addEventListener('click', doLogin);
    document.getElementById('rbac-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }

  /* ═════════════════════════════════════════════════════
     APP SHELL  (sidebar + main area)
  ═════════════════════════════════════════════════════ */
  let currentView = null;

  function renderApp() {
    const user = RBAC_DATA.getSession();
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);

    /* Build sidebar nav items based on role */
    const navItems = buildNavItems(user);

    root.innerHTML = `
    <div class="rbac-app rbac-page">

      <!-- Sidebar -->
      <aside class="rbac-sidebar" id="rbac-sidebar">
        <div class="rbac-sidebar-head">
          <div class="rbac-sidebar-brand">
            <div class="rbac-sidebar-brand-icon">E</div>
            <div class="rbac-sidebar-brand-text">
              Eduverse
              <small>${dept ? dept.name + ' Dept.' : 'Portal'}</small>
            </div>
          </div>
          <div class="rbac-user-chip">
            <div class="rbac-avatar">${user.avatar}</div>
            <div class="rbac-user-chip-info">
              <h4>${user.name.split(' ').slice(0,2).join(' ')}</h4>
              <span>${roleName(user.role)}</span>
            </div>
          </div>
        </div>

        <nav class="rbac-nav" id="rbac-nav">
          <div class="rbac-nav-section">Menu</div>
          ${navItems.map(n => `
            <div class="rbac-nav-item" data-view="${n.view}">
              <span class="nav-icon">${n.icon}</span>
              <span>${n.label}</span>
              ${n.badge ? `<span class="rbac-nav-badge">${n.badge}</span>` : ''}
            </div>`).join('')}
        </nav>

        <div class="rbac-sidebar-foot">
          <button class="rbac-logout-btn" id="rbac-logout">
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      <!-- Main -->
      <main class="rbac-main" id="rbac-main-content"></main>
    </div>`;

    /* nav click */
    document.querySelectorAll('.rbac-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigateTo(item.dataset.view);
      });
    });

    /* logout */
    document.getElementById('rbac-logout').addEventListener('click', () => {
      RBAC_DATA.logout();
      renderLogin();
    });

    /* default view */
    const defaultView = navItems[0]?.view || 'dashboard';
    navigateTo(defaultView);
  }

  function navigateTo(view) {
    currentView = view;
    /* highlight active nav item */
    document.querySelectorAll('.rbac-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    const main = document.getElementById('rbac-main-content');
    if (!main) return;
    main.innerHTML = '';

    const user = RBAC_DATA.getSession();
    switch (view) {
      case 'hod-dashboard':  renderHODDashboard(main); break;
      case 'hod-teachers':   renderHODTeachers(main);  break;
      case 'hod-announce':   renderHODAnnounce(main);  break;
      case 'teacher-home':   renderTeacherHome(main);  break;
      case 'teacher-ws':     renderTeacherWorkspace(main); break;
      case 'teacher-ann':    renderTeacherAnnouncements(main); break;
      case 'profile':        renderProfile(main, user); break;
      default:               renderHODDashboard(main);
    }
  }

  /* ─── Nav item config ─────────────────────────────── */
  function buildNavItems(user) {
    if (user.role === 'hod') {
      const pending = RBAC_DATA.getTeachersByDept(user.departmentId).filter(t => t.status === 'pending').length;
      return [
        { view: 'hod-dashboard', icon: '🏠', label: 'Dashboard' },
        { view: 'hod-teachers',  icon: '👩‍🏫', label: 'Teachers', badge: pending || null },
        { view: 'hod-announce',  icon: '📢', label: 'Announcements' },
        { view: 'profile',       icon: '👤', label: 'My Profile' },
      ];
    }
    return [
      { view: 'teacher-home', icon: '🏠', label: 'Dashboard' },
      { view: 'teacher-ws',   icon: '📚', label: 'My Workspace' },
      { view: 'teacher-ann',  icon: '📢', label: 'Announcements' },
      { view: 'profile',      icon: '👤', label: 'My Profile' },
    ];
  }

  function roleName(role) {
    return role === 'hod' ? 'Head of Department' : 'Faculty Teacher';
  }

  /* ═════════════════════════════════════════════════════
     HOD — DASHBOARD
  ═════════════════════════════════════════════════════ */
  function renderHODDashboard(el) {
    const user = RBAC_DATA.getSession();
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);
    const teachers = RBAC_DATA.getTeachersByDept(user.departmentId);
    const approved = teachers.filter(t => t.status === 'approved').length;
    const pending  = teachers.filter(t => t.status === 'pending').length;
    const anns     = RBAC_DATA.getAnnouncements(user.departmentId);

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header">
        <h2>👋 Good day, ${user.name.split(' ')[0]}</h2>
        <p>${dept.name} Department Overview — Eduverse Institute</p>
      </div>

      <!-- Stats -->
      <div class="rbac-stats-grid">
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">👩‍🏫</div>
          <div class="rbac-stat-val">${teachers.length}</div>
          <div class="rbac-stat-label">Total Teachers</div>
        </div>
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">✅</div>
          <div class="rbac-stat-val" style="color:var(--rbac-success)">${approved}</div>
          <div class="rbac-stat-label">Active Teachers</div>
        </div>
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">⏳</div>
          <div class="rbac-stat-val" style="color:var(--rbac-warning)">${pending}</div>
          <div class="rbac-stat-label">Pending Approvals</div>
        </div>
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">📚</div>
          <div class="rbac-stat-val">${dept.subjects.length}</div>
          <div class="rbac-stat-label">Subjects</div>
        </div>
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">📢</div>
          <div class="rbac-stat-val">${anns.length}</div>
          <div class="rbac-stat-label">Announcements</div>
        </div>
      </div>

      <!-- Subjects overview -->
      <div class="rbac-section">
        <div class="rbac-section-head">
          <div><h3>Subjects in ${dept.name}</h3><p>Assigned teachers per subject</p></div>
        </div>
        ${dept.subjects.map(sub => {
          const assigned = teachers.filter(t => t.subjectId === sub.id && t.status === 'approved');
          return `
          <div class="rbac-subject-banner" style="margin-bottom:14px;">
            <div class="rbac-subject-banner-icon" style="background:${sub.color}">${sub.icon}</div>
            <div>
              <h3>${sub.name}</h3>
              <p>${sub.description}</p>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                ${assigned.length ? assigned.map(t =>
                  `<div class="rbac-tag"><span class="rbac-avatar-sm">${t.avatar}</span>${t.name}</div>`
                ).join('') : `<span style="font-size:13px;color:var(--rbac-warning)">⚠ No teacher assigned</span>`}
              </div>
            </div>
            <div class="rbac-subject-code">${sub.code}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Recent announcements preview -->
      <div class="rbac-section">
        <div class="rbac-section-head">
          <div><h3>Recent Announcements</h3></div>
          <button class="rbac-btn rbac-btn-sm rbac-btn-outline" id="rbac-goto-ann">View All</button>
        </div>
        <div class="rbac-ann-list">
          ${anns.slice(0,2).map(a => annCardHTML(a)).join('')}
        </div>
      </div>
    </div>`;

    document.getElementById('rbac-goto-ann')?.addEventListener('click', () => navigateTo('hod-announce'));
  }

  /* ═════════════════════════════════════════════════════
     HOD — TEACHERS
  ═════════════════════════════════════════════════════ */
  function renderHODTeachers(el) {
    const user = RBAC_DATA.getSession();
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);
    const teachers = RBAC_DATA.getTeachersByDept(user.departmentId);

    function buildTable() {
      const teachers = RBAC_DATA.getTeachersByDept(user.departmentId);
      const tbody = document.getElementById('rbac-teacher-tbody');
      if (!tbody) return;
      tbody.innerHTML = teachers.map(t => {
        const sub = t.subjectId ? RBAC_DATA.getSubjectById(t.subjectId) : null;
        return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="rbac-avatar-sm">${t.avatar}</div>
              <div>
                <div style="font-weight:600;font-size:14px">${t.name}</div>
                <div style="font-size:12px;color:var(--rbac-muted)">${t.email}</div>
              </div>
            </div>
          </td>
          <td><span class="rbac-badge rbac-badge-${t.status}"><span class="rbac-badge-dot"></span>${cap(t.status)}</span></td>
          <td>
            <select class="rbac-select" data-teacher="${t.id}" id="sub-sel-${t.id}">
              <option value="">— Not assigned —</option>
              ${dept.subjects.map(s => `<option value="${s.id}" ${t.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </td>
          <td>${t.qualification}</td>
          <td>
            <div class="rbac-action-group">
              ${t.status === 'pending'  ? `<button class="rbac-btn rbac-btn-sm rbac-btn-success" data-action="approve" data-id="${t.id}">✓ Approve</button>` : ''}
              ${t.status === 'approved' ? `<button class="rbac-btn rbac-btn-sm rbac-btn-warning" data-action="reject"  data-id="${t.id}">✕ Revoke</button>` : ''}
              ${t.status === 'rejected' ? `<button class="rbac-btn rbac-btn-sm rbac-btn-success" data-action="approve" data-id="${t.id}">✓ Re-Approve</button>` : ''}
              <button class="rbac-btn rbac-btn-sm rbac-btn-danger" data-action="remove" data-id="${t.id}">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('') || `<tr><td colspan="5"><div class="rbac-empty"><div class="rbac-empty-icon">👩‍🏫</div><p>No teachers found.</p></div></td></tr>`;
    }

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header">
        <h2>👩‍🏫 Teacher Management</h2>
        <p>Approve, revoke, and assign subjects to teachers in ${dept.name}</p>
      </div>
      <div class="rbac-section">
        <div class="rbac-table-wrap">
          <table class="rbac-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Status</th>
                <th>Assigned Subject</th>
                <th>Qualification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="rbac-teacher-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

    buildTable();

    /* subject assignment changes */
    el.addEventListener('change', e => {
      if (e.target.dataset.teacher) {
        RBAC_DATA.assignSubject(e.target.dataset.teacher, e.target.value || null);
        toast('Subject assignment updated.', 'success');
        buildTable();
      }
    });

    /* action buttons */
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'approve') {
        RBAC_DATA.approveTeacher(id);
        toast('Teacher approved.', 'success');
      } else if (action === 'reject') {
        RBAC_DATA.rejectTeacher(id);
        toast('Teacher access revoked.', 'info');
      } else if (action === 'remove') {
        if (confirm('Remove this teacher from the department?')) {
          RBAC_DATA.removeTeacher(id);
          toast('Teacher removed.', 'error');
        }
      }
      buildTable();
      /* refresh nav badge */
      rebuildNavBadges();
    });
  }

  /* ═════════════════════════════════════════════════════
     HOD — ANNOUNCEMENTS
  ═════════════════════════════════════════════════════ */
  function renderHODAnnounce(el) {
    const user = RBAC_DATA.getSession();
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);

    function renderAnns() {
      const anns = RBAC_DATA.getAnnouncements(user.departmentId);
      const list = document.getElementById('rbac-ann-list-hod');
      if (!list) return;
      list.innerHTML = anns.map(a => annCardHTML(a)).join('') ||
        `<div class="rbac-empty"><div class="rbac-empty-icon">📢</div><p>No announcements yet.</p></div>`;
    }

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header">
        <h2>📢 Announcements</h2>
        <p>Post notices to all teachers in ${dept.name}</p>
      </div>

      <!-- Compose -->
      <div class="rbac-section">
        <div class="rbac-section-head"><h3>New Announcement</h3></div>
        <div class="rbac-compose-form">
          <div class="rbac-compose-row">
            <input class="rbac-input" id="rbac-ann-title" placeholder="Announcement title…">
            <select class="rbac-select" id="rbac-ann-priority" style="width:150px">
              <option value="normal">Normal</option>
              <option value="high">High Priority</option>
            </select>
          </div>
          <textarea class="rbac-textarea" id="rbac-ann-body" placeholder="Write your message here…"></textarea>
          <div>
            <button class="rbac-btn rbac-btn-primary" id="rbac-post-ann" style="width:auto;padding:11px 28px;">
              📤 Post Announcement
            </button>
          </div>
        </div>
      </div>

      <!-- List -->
      <div class="rbac-section">
        <div class="rbac-section-head"><h3>Posted Announcements</h3></div>
        <div class="rbac-ann-list" id="rbac-ann-list-hod"></div>
      </div>
    </div>`;

    renderAnns();

    document.getElementById('rbac-post-ann').addEventListener('click', () => {
      const title    = document.getElementById('rbac-ann-title').value.trim();
      const body     = document.getElementById('rbac-ann-body').value.trim();
      const priority = document.getElementById('rbac-ann-priority').value;
      if (!title || !body) { toast('Please fill in title and message.', 'error'); return; }
      RBAC_DATA.addAnnouncement(title, body, priority);
      document.getElementById('rbac-ann-title').value = '';
      document.getElementById('rbac-ann-body').value  = '';
      toast('Announcement posted!', 'success');
      renderAnns();
    });
  }

  /* ═════════════════════════════════════════════════════
     TEACHER — HOME
  ═════════════════════════════════════════════════════ */
  function renderTeacherHome(el) {
    const user = RBAC_DATA.getSession();
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);
    const sub  = user.subjectId ? RBAC_DATA.getSubjectById(user.subjectId) : null;
    const anns = RBAC_DATA.getAnnouncements(user.departmentId);
    const ws   = RBAC_DATA.getMyWorkspace();

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header">
        <h2>👋 Hello, ${user.name.split(' ')[0]}</h2>
        <p>${dept.name} Department — ${sub ? sub.name : 'No subject assigned'}</p>
      </div>

      <div class="rbac-stats-grid">
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">${sub ? sub.icon : '📚'}</div>
          <div class="rbac-stat-val" style="font-size:20px">${sub ? sub.name : '—'}</div>
          <div class="rbac-stat-label">My Subject</div>
        </div>
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">📋</div>
          <div class="rbac-stat-val">${ws ? ws.boards.length : 0}</div>
          <div class="rbac-stat-label">Board Sessions</div>
        </div>
        <div class="rbac-stat-card">
          <div class="rbac-stat-icon">📢</div>
          <div class="rbac-stat-val">${anns.length}</div>
          <div class="rbac-stat-label">Announcements</div>
        </div>
      </div>

      ${sub ? `
      <div class="rbac-subject-banner">
        <div class="rbac-subject-banner-icon" style="background:${sub.color}">${sub.icon}</div>
        <div>
          <h3>${sub.name}</h3>
          <p>${sub.description}</p>
        </div>
        <div class="rbac-subject-code">${sub.code}</div>
      </div>` : `
      <div class="rbac-section">
        <div class="rbac-empty">
          <div class="rbac-empty-icon">⚠️</div>
          <p>You have not been assigned a subject yet. Please contact the HOD.</p>
        </div>
      </div>`}

      <!-- Recent announcements -->
      <div class="rbac-section">
        <div class="rbac-section-head">
          <div><h3>Latest Announcement</h3></div>
          <button class="rbac-btn rbac-btn-sm rbac-btn-outline" id="rbac-t-goto-ann">View All</button>
        </div>
        <div class="rbac-ann-list">
          ${anns.slice(0,1).map(a => annCardHTML(a)).join('') || '<p style="color:var(--rbac-muted);font-size:14px">No announcements.</p>'}
        </div>
      </div>

      <!-- Quick launch -->
      ${ws ? `
      <div class="rbac-section">
        <div class="rbac-section-head"><h3>Open Smart Board</h3><p>Your latest session</p></div>
        ${ws.boards.slice(0,1).map(b => `
          <div class="rbac-board-card" style="max-width:300px" id="rbac-quick-launch" data-board="${b.id}">
            <div class="rbac-board-icon">📋</div>
            <div class="rbac-board-title">${b.title}</div>
            <div class="rbac-board-meta">${b.date} · ${b.slides} slides</div>
            <div class="rbac-board-launch">🖥 Open Smart Board →</div>
          </div>`).join('')}
      </div>` : ''}
    </div>`;

    document.getElementById('rbac-t-goto-ann')?.addEventListener('click', () => navigateTo('teacher-ann'));
    document.getElementById('rbac-quick-launch')?.addEventListener('click', function () {
      openBoardModal(this.dataset.board);
    });
  }

  /* ═════════════════════════════════════════════════════
     TEACHER — WORKSPACE
  ═════════════════════════════════════════════════════ */
  function renderTeacherWorkspace(el) {
    const user = RBAC_DATA.getSession();
    const ws   = RBAC_DATA.getMyWorkspace();

    if (!ws) {
      el.innerHTML = `
      <div class="rbac-page">
        <div class="rbac-page-header"><h2>📚 My Workspace</h2></div>
        <div class="rbac-section">
          <div class="rbac-empty">
            <div class="rbac-empty-icon">⚠️</div>
            <p>You have not been assigned a subject yet.<br>Please contact your HOD to get a subject assigned.</p>
          </div>
        </div>
      </div>`;
      return;
    }

    const { subject: sub, boards } = ws;

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header">
        <h2>📚 My Workspace</h2>
        <p>All your Smart Board sessions for ${sub.name}</p>
      </div>

      <div class="rbac-subject-banner">
        <div class="rbac-subject-banner-icon" style="background:${sub.color}">${sub.icon}</div>
        <div>
          <h3>${sub.name}</h3>
          <p>${sub.description}</p>
          <p style="font-size:12px;color:var(--rbac-muted);margin-top:4px">
            ✅ Access restricted to <strong>${user.name}</strong> only. Other subjects are not accessible.
          </p>
        </div>
        <div class="rbac-subject-code">${sub.code}</div>
      </div>

      <div class="rbac-section">
        <div class="rbac-section-head">
          <div><h3>Board Sessions</h3><p>${boards.length} sessions available</p></div>
        </div>
        <div class="rbac-boards-grid">
          ${boards.map(b => `
            <div class="rbac-board-card rbac-launch-board" data-board="${b.id}" tabindex="0" role="button">
              <div class="rbac-board-icon">📋</div>
              <div class="rbac-board-title">${b.title}</div>
              <div class="rbac-board-meta">${b.date} · ${b.slides} slides</div>
              <div class="rbac-board-launch">🖥 Open Smart Board →</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

    el.querySelectorAll('.rbac-launch-board').forEach(card => {
      card.addEventListener('click', () => openBoardModal(card.dataset.board));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openBoardModal(card.dataset.board); });
    });
  }

  /* ═════════════════════════════════════════════════════
     TEACHER — ANNOUNCEMENTS
  ═════════════════════════════════════════════════════ */
  function renderTeacherAnnouncements(el) {
    const user = RBAC_DATA.getSession();
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);
    const anns = RBAC_DATA.getAnnouncements(user.departmentId);

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header">
        <h2>📢 Department Announcements</h2>
        <p>${dept.name} — ${anns.length} announcement${anns.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="rbac-section">
        <div class="rbac-ann-list">
          ${anns.map(a => annCardHTML(a)).join('') ||
            `<div class="rbac-empty"><div class="rbac-empty-icon">📢</div><p>No announcements yet.</p></div>`}
        </div>
      </div>
    </div>`;
  }

  /* ═════════════════════════════════════════════════════
     PROFILE PAGE
  ═════════════════════════════════════════════════════ */
  function renderProfile(el, user) {
    const dept = RBAC_DATA.getDepartmentById(user.departmentId);
    const sub  = user.subjectId ? RBAC_DATA.getSubjectById(user.subjectId) : null;

    el.innerHTML = `
    <div class="rbac-page">
      <div class="rbac-page-header"><h2>👤 My Profile</h2><p>Your account information</p></div>
      <div class="rbac-section" style="max-width:600px">

        <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px">
          <div class="rbac-avatar" style="width:64px;height:64px;font-size:22px">${user.avatar}</div>
          <div>
            <div style="font-size:22px;font-weight:700">${user.name}</div>
            <div style="color:var(--rbac-muted);font-size:14px">${roleName(user.role)}</div>
            ${user.role === 'teacher' ? `<span class="rbac-badge rbac-badge-${user.status}" style="margin-top:6px"><span class="rbac-badge-dot"></span>${cap(user.status)}</span>` : ''}
          </div>
        </div>

        <hr class="rbac-divider">

        ${profileRow('🏢', 'Department', dept?.name || '—')}
        ${sub ? profileRow(sub.icon, 'Subject', `${sub.name} (${sub.code})`) : ''}
        ${profileRow('✉️', 'Email', user.email)}
        ${profileRow('📞', 'Phone', user.phone)}
        ${profileRow('🎓', 'Qualification', user.qualification)}
        ${profileRow('📅', 'Joined', user.joinDate)}

        <hr class="rbac-divider">
        <div style="background:var(--rbac-surface);border-radius:10px;padding:16px 18px;">
          <h4 style="font-size:12px;font-weight:700;color:var(--rbac-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Access Permissions</h4>
          ${getPermissionsForUser(user).map(p =>
            `<div class="rbac-perm-row"><span class="rbac-perm-dot allow"></span><span>${p}</span></div>`
          ).join('')}
        </div>
      </div>
    </div>`;
  }

  function profileRow(icon, label, value) {
    return `<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">
      <span style="font-size:18px;width:24px">${icon}</span>
      <div>
        <div style="font-size:11px;color:var(--rbac-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700">${label}</div>
        <div style="font-size:14px;margin-top:2px">${value}</div>
      </div>
    </div>`;
  }

  function getPermissionsForUser(user) {
    const map = {
      hod: ['View all teachers in department','Approve / Revoke teacher accounts','Assign subjects to teachers','Remove teachers','Post department announcements','View department statistics'],
      teacher: ['View own subject workspace only','Open Smart Board for assigned subject','View department announcements','View and edit own profile'],
    };
    return map[user.role] || [];
  }

  /* ═════════════════════════════════════════════════════
     SMART BOARD MODAL
  ═════════════════════════════════════════════════════ */
  function openBoardModal(boardId) {
    const user = RBAC_DATA.getSession();
    const ws   = RBAC_DATA.getMyWorkspace();
    const board = ws?.boards.find(b => b.id === boardId);
    if (!board) return;
    const sub = ws.subject;

    const html = `
      <div class="rbac-modal-icon">🖥</div>
      <h3>Open Smart Board</h3>
      <p style="margin-bottom:4px">You are about to launch the Smart Board for:</p>
      <p style="font-weight:600;color:var(--rbac-accent2)">${board.title}</p>
      <p style="margin-top:6px">Subject: <strong>${sub.name}</strong> &nbsp;·&nbsp; ${board.slides} slides</p>

      <div class="rbac-perm-box">
        <h4>Access Verification</h4>
        <div class="rbac-perm-row">
          <span class="rbac-perm-dot allow"></span>
          <span>Logged in as: <strong>${user.name}</strong></span>
        </div>
        <div class="rbac-perm-row">
          <span class="rbac-perm-dot allow"></span>
          <span>Role: <strong>${roleName(user.role)}</strong></span>
        </div>
        <div class="rbac-perm-row">
          <span class="rbac-perm-dot allow"></span>
          <span>Subject access: <strong>${sub.name}</strong> ✓ Allowed</span>
        </div>
        <div class="rbac-perm-row">
          <span class="rbac-perm-dot deny"></span>
          <span class="rbac-perm-deny">Other subjects — Access denied</span>
        </div>
      </div>

      <div class="rbac-modal-actions">
        <button class="rbac-btn rbac-btn-outline" id="rbac-modal-cancel">Cancel</button>
        <button class="rbac-btn rbac-btn-primary" id="rbac-modal-launch">🚀 Launch Smart Board</button>
      </div>`;

    const overlay = showModal(html);

    overlay.querySelector('#rbac-modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#rbac-modal-launch').addEventListener('click', () => {
      overlay.remove();
      toast(`Smart Board launched: ${board.title}`, 'success');
      // In a real integration, this would call the main app's board launcher.
      // For prototype, show a success notification.
    });
  }

  /* ═════════════════════════════════════════════════════
     HELPERS
  ═════════════════════════════════════════════════════ */
  function annCardHTML(a) {
    return `
    <div class="rbac-ann-card priority-${a.priority}">
      <div class="rbac-ann-head">
        <div class="rbac-ann-title">${a.title}</div>
        <span class="rbac-badge rbac-badge-${a.priority === 'high' ? 'high' : 'normal'}">
          ${a.priority === 'high' ? '🔴 High' : '🔵 Notice'}
        </span>
      </div>
      <div class="rbac-ann-body">${a.body}</div>
      <div class="rbac-ann-meta">
        <span class="rbac-ann-date">📅 ${a.date}</span>
      </div>
    </div>`;
  }

  function cap(str) { return str ? str[0].toUpperCase() + str.slice(1) : ''; }

  function rebuildNavBadges() {
    const user = RBAC_DATA.getSession();
    if (!user || user.role !== 'hod') return;
    const pending = RBAC_DATA.getTeachersByDept(user.departmentId).filter(t => t.status === 'pending').length;
    const badge = document.querySelector('[data-view="hod-teachers"] .rbac-nav-badge');
    if (badge) badge.textContent = pending || '';
    if (badge && !pending) badge.style.display = 'none';
    else if (badge) badge.style.display = '';
  }

  /* ═════════════════════════════════════════════════════
     BOOT
  ═════════════════════════════════════════════════════ */
  function boot() {
    root = document.getElementById('rbac-root');
    if (!root) { console.error('[RBAC] #rbac-root not found.'); return; }
    const session = RBAC_DATA.getSession();
    if (session) renderApp();
    else renderLogin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
