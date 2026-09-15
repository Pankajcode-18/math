/**
 * RBAC Prototype — Static Data Layer
 * ------------------------------------
 * This file is the ONLY source of truth for the prototype.
 * No server, no database — everything is in memory.
 *
 * DO NOT import or reference any existing Eduverse modules.
 */

'use strict';

const RBAC_DATA = (() => {

  /* ═══════════════════════════════════════════════════
     INSTITUTION STRUCTURE
  ═══════════════════════════════════════════════════ */
  const institution = {
    name: 'Eduverse Institute',
    departments: [
      {
        id: 'dept-fy',
        name: 'First Year',
        code: 'FY',
        description: 'Foundation year covering core engineering subjects',
        subjects: [
          {
            id: 'sub-math',
            name: 'Mathematics',
            code: 'MATH101',
            description: 'Engineering Mathematics – Calculus, Algebra, Matrices',
            color: '#6366f1',
            icon: '∑',
          },
          {
            id: 'sub-phy',
            name: 'Physics',
            code: 'PHY101',
            description: 'Applied Physics – Mechanics, Optics, Thermodynamics',
            color: '#0ea5e9',
            icon: '⚛',
          },
        ],
      },
    ],
  };

  /* ═══════════════════════════════════════════════════
     USERS
  ═══════════════════════════════════════════════════ */
  const users = [
    {
      id: 'user-hod',
      name: 'Dr. Anita Sharma',
      username: 'hod.fy',
      password: 'hod@123',
      role: 'hod',
      departmentId: 'dept-fy',
      subjectId: null,
      avatar: 'AS',
      email: 'anita.sharma@eduverse.edu',
      phone: '+91 98765 00001',
      joinDate: '2020-06-01',
      qualification: 'Ph.D. Applied Mathematics',
    },
    {
      id: 'user-math-teacher',
      name: 'Prof. Rahul Mehta',
      username: 'math.teacher',
      password: 'math@123',
      role: 'teacher',
      departmentId: 'dept-fy',
      subjectId: 'sub-math',
      avatar: 'RM',
      email: 'rahul.mehta@eduverse.edu',
      phone: '+91 98765 00002',
      joinDate: '2021-08-01',
      qualification: 'M.Sc. Mathematics',
      status: 'approved',
    },
    {
      id: 'user-phy-teacher',
      name: 'Prof. Sunita Verma',
      username: 'phy.teacher',
      password: 'phy@123',
      role: 'teacher',
      departmentId: 'dept-fy',
      subjectId: 'sub-phy',
      avatar: 'SV',
      email: 'sunita.verma@eduverse.edu',
      phone: '+91 98765 00003',
      joinDate: '2022-01-15',
      qualification: 'M.Sc. Physics',
      status: 'approved',
    },
    {
      id: 'user-pending-teacher',
      name: 'Mr. Arjun Patel',
      username: 'arjun.patel',
      password: 'arjun@123',
      role: 'teacher',
      departmentId: 'dept-fy',
      subjectId: null,
      avatar: 'AP',
      email: 'arjun.patel@eduverse.edu',
      phone: '+91 98765 00004',
      joinDate: '2024-07-01',
      qualification: 'B.Tech + M.Tech (Dual)',
      status: 'pending',
    },
  ];

  /* ═══════════════════════════════════════════════════
     WORKSPACE CONTENT  (per subject)
  ═══════════════════════════════════════════════════ */
  const workspaceBoards = {
    'sub-math': [
      { id: 'wb-m-1', title: 'Chapter 1 – Limits & Continuity',     date: '2024-09-01', slides: 14 },
      { id: 'wb-m-2', title: 'Chapter 2 – Differentiation',          date: '2024-09-08', slides: 18 },
      { id: 'wb-m-3', title: 'Chapter 3 – Integration Basics',       date: '2024-09-15', slides: 12 },
      { id: 'wb-m-4', title: 'Chapter 4 – Matrix Algebra',           date: '2024-09-22', slides: 16 },
    ],
    'sub-phy': [
      { id: 'wb-p-1', title: 'Chapter 1 – Units & Measurements',     date: '2024-09-01', slides: 10 },
      { id: 'wb-p-2', title: "Chapter 2 – Newton's Laws of Motion",  date: '2024-09-07', slides: 15 },
      { id: 'wb-p-3', title: 'Chapter 3 – Work, Energy & Power',     date: '2024-09-14', slides: 13 },
      { id: 'wb-p-4', title: 'Chapter 4 – Wave Optics',              date: '2024-09-21', slides: 11 },
    ],
  };

  /* ═══════════════════════════════════════════════════
     ANNOUNCEMENTS
  ═══════════════════════════════════════════════════ */
  const announcements = [
    {
      id: 'ann-1',
      from: 'user-hod',
      target: 'dept-fy',
      title: 'Mid-Semester Exam Schedule Released',
      body: 'Mid-semester exams for First Year will be held from October 15–18. Please ensure syllabus coverage and upload relevant board sessions before October 12.',
      date: '2024-09-10',
      priority: 'high',
    },
    {
      id: 'ann-2',
      from: 'user-hod',
      target: 'dept-fy',
      title: 'Faculty Development Program – Registration Open',
      body: 'All faculty members are encouraged to register for the online FDP on Modern Pedagogy being conducted from September 20–24.',
      date: '2024-09-08',
      priority: 'normal',
    },
    {
      id: 'ann-3',
      from: 'user-hod',
      target: 'dept-fy',
      title: 'Department Meeting – September 13',
      body: 'Monthly department meeting scheduled for September 13 at 3:00 PM in the Conference Room. Attendance is mandatory.',
      date: '2024-09-06',
      priority: 'normal',
    },
  ];

  /* ═══════════════════════════════════════════════════
     PERMISSIONS MAP
  ═══════════════════════════════════════════════════ */
  const permissions = {
    hod: [
      'view_all_teachers',
      'approve_teacher',
      'reject_teacher',
      'assign_subject',
      'remove_teacher',
      'view_all_workspaces',
      'post_announcement',
      'view_department_stats',
    ],
    teacher: [
      'view_own_subject_workspace',
      'open_smartboard',
      'view_department_announcements',
      'view_own_profile',
    ],
  };

  /* ═══════════════════════════════════════════════════
     RUNTIME STATE
  ═══════════════════════════════════════════════════ */
  const state = {
    currentUser: null,
    sessionToken: null,
    _users: JSON.parse(JSON.stringify(users)),
    _announcements: JSON.parse(JSON.stringify(announcements)),
  };

  /* AUTH */
  function login(username, password) {
    const user = state._users.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, error: 'Invalid username or password.' };
    if (user.role === 'teacher' && user.status !== 'approved') {
      if (user.status === 'pending')  return { success: false, error: 'Your account is pending HOD approval.' };
      if (user.status === 'rejected') return { success: false, error: 'Your account access has been revoked.' };
    }
    state.currentUser = user;
    state.sessionToken = 'tok_' + Math.random().toString(36).substr(2);
    return { success: true, user };
  }

  function logout() { state.currentUser = null; state.sessionToken = null; }
  function getSession() { return state.currentUser; }
  function hasPermission(action) {
    if (!state.currentUser) return false;
    return (permissions[state.currentUser.role] || []).includes(action);
  }

  /* HOD ACTIONS */
  function getTeachersByDept(deptId) {
    if (!hasPermission('view_all_teachers')) return [];
    return state._users.filter(u => u.role === 'teacher' && u.departmentId === deptId);
  }
  function approveTeacher(teacherId) {
    if (!hasPermission('approve_teacher')) return false;
    const t = state._users.find(u => u.id === teacherId);
    if (t) { t.status = 'approved'; return true; } return false;
  }
  function rejectTeacher(teacherId) {
    if (!hasPermission('reject_teacher')) return false;
    const t = state._users.find(u => u.id === teacherId);
    if (t) { t.status = 'rejected'; t.subjectId = null; return true; } return false;
  }
  function assignSubject(teacherId, subjectId) {
    if (!hasPermission('assign_subject')) return false;
    const t = state._users.find(u => u.id === teacherId);
    if (t) { t.subjectId = subjectId; return true; } return false;
  }
  function removeTeacher(teacherId) {
    if (!hasPermission('remove_teacher')) return false;
    const idx = state._users.findIndex(u => u.id === teacherId);
    if (idx !== -1) { state._users.splice(idx, 1); return true; } return false;
  }
  function addAnnouncement(title, body, priority) {
    if (!hasPermission('post_announcement')) return false;
    state._announcements.unshift({
      id: 'ann-' + Date.now(),
      from: state.currentUser.id,
      target: state.currentUser.departmentId,
      title, body,
      date: new Date().toISOString().split('T')[0],
      priority: priority || 'normal',
    });
    return true;
  }

  /* TEACHER ACTIONS */
  function getMyWorkspace() {
    const user = state.currentUser;
    if (!user || !hasPermission('view_own_subject_workspace')) return null;
    if (!user.subjectId) return null;
    return { subject: getSubjectById(user.subjectId), boards: workspaceBoards[user.subjectId] || [] };
  }

  /* LOOKUP */
  function getDepartmentById(id) { return institution.departments.find(d => d.id === id) || null; }
  function getSubjectById(id) {
    for (const dept of institution.departments) {
      const sub = dept.subjects.find(s => s.id === id);
      if (sub) return sub;
    }
    return null;
  }
  function getAnnouncements(deptId) {
    return state._announcements.filter(a => a.target === deptId || a.target === 'all');
  }
  function getUserById(id) { return state._users.find(u => u.id === id) || null; }

  return {
    institution,
    login, logout, getSession, hasPermission,
    getTeachersByDept, approveTeacher, rejectTeacher, assignSubject, removeTeacher, addAnnouncement,
    getMyWorkspace,
    getDepartmentById, getSubjectById, getAnnouncements, getUserById,
    getUsers: () => [...state._users],
  };

})();

window.RBAC_DATA = RBAC_DATA;
