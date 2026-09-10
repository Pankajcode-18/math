'use strict';

// ═══════════════════════════════════════════════════════════
// PIYUSHDHARA EDUVERSE BOARD — CURRICULUM STORE
// State manager for Class, Subject, Chapter, and Topic.
// Provides persistent CRUD, reordering, and global search.
// ═══════════════════════════════════════════════════════════

const CurriculumStore = (() => {
  const STORAGE_KEY_CUSTOM = 'eduverse_custom_curriculum';
  const STORAGE_KEY_STATE  = 'eduverse_curriculum_state';
  const STORAGE_KEY_RECENT = 'eduverse_recent_lessons';
  const STORAGE_KEY_PINNED = 'eduverse_pinned_chapters';

  let activeClass   = 'grade-10';
  let activeSubject = 'mathematics';
  let activeChapter = 1;
  let activeTopic   = null;

  // Clone base curriculum
  let curriculum = JSON.parse(JSON.stringify(window.CURRICULUM_DATA || { classes: [], subjects: [] }));

  // Load custom stored modifications
  function loadPersistedData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM);
      if (saved) {
        const custom = JSON.parse(saved);
        if (custom.classes)  curriculum.classes = custom.classes;
        if (custom.subjects) curriculum.subjects = custom.subjects;
      }
    } catch (e) {
      console.warn('Could not load custom curriculum:', e);
    }

    try {
      const savedState = localStorage.getItem(STORAGE_KEY_STATE);
      if (savedState) {
        const s = JSON.parse(savedState);
        if (s.classId)   activeClass = s.classId;
        if (s.subjectId) activeSubject = s.subjectId;
        if (s.chapterId) activeChapter = s.chapterId;
        if (s.topicId)   activeTopic = s.topicId;
      }
    } catch (e) {}
  }

  function savePersistedData() {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify({
        classes: curriculum.classes,
        subjects: curriculum.subjects
      }));
    } catch (e) {}
  }

  function savePersistedState() {
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify({
        classId: activeClass,
        subjectId: activeSubject,
        chapterId: activeChapter,
        topicId: activeTopic
      }));
    } catch (e) {}
  }

  // ── GETTERS ──
  function getClasses() {
    return curriculum.classes || [];
  }

  function getActiveClass() {
    return curriculum.classes.find(c => c.id === activeClass) || curriculum.classes[0];
  }

  function getSubjects(classId = activeClass) {
    return curriculum.subjects.filter(s => s.classId === classId && s.active !== false);
  }

  function getActiveSubject() {
    return curriculum.subjects.find(s => s.id === activeSubject && s.classId === activeClass)
      || curriculum.subjects.find(s => s.id === activeSubject)
      || getSubjects()[0];
  }

  function getChapters(classId = activeClass, subjectId = activeSubject) {
    const sub = curriculum.subjects.find(s => s.id === subjectId && s.classId === classId)
      || curriculum.subjects.find(s => s.id === subjectId);
    return sub ? sub.chapters : [];
  }

  function getActiveChapter() {
    const chapters = getChapters();
    return chapters.find(c => c.id === activeChapter) || chapters[0] || null;
  }

  function getChapter(classId, subjectId, chapterId) {
    const chapters = getChapters(classId, subjectId);
    return chapters.find(c => c.id === chapterId) || null;
  }

  function getTopics(classId = activeClass, subjectId = activeSubject, chapterId = activeChapter) {
    const ch = getChapter(classId, subjectId, chapterId);
    return ch ? (ch.topics || []) : [];
  }

  function getActiveTopic() {
    const topics = getTopics();
    return topics.find(t => t.id === activeTopic) || topics[0] || null;
  }

  // ── SETTERS ──
  function setActiveClass(classId) {
    activeClass = classId;
    const available = getSubjects(classId);
    if (!available.find(s => s.id === activeSubject)) {
      activeSubject = available[0] ? available[0].id : 'mathematics';
    }
    const chapters = getChapters();
    if (chapters.length) {
      activeChapter = chapters[0].id;
      activeTopic = (chapters[0].topics && chapters[0].topics[0]) ? chapters[0].topics[0].id : null;
    } else {
      activeChapter = null;
      activeTopic = null;
    }
    savePersistedState();
  }

  function setActiveSubject(subjectId) {
    activeSubject = subjectId;
    const chapters = getChapters();
    if (chapters.length) {
      activeChapter = chapters[0].id;
      activeTopic = (chapters[0].topics && chapters[0].topics[0]) ? chapters[0].topics[0].id : null;
    } else {
      activeChapter = null;
      activeTopic = null;
    }
    savePersistedState();
    recordRecent(activeSubject, activeChapter, activeTopic);
  }

  function setActiveChapter(chapterId) {
    activeChapter = Number(chapterId) || chapterId;
    const ch = getActiveChapter();
    activeTopic = (ch && ch.topics && ch.topics[0]) ? ch.topics[0].id : null;
    savePersistedState();
    recordRecent(activeSubject, activeChapter, activeTopic);
  }

  function setActiveTopic(topicId) {
    activeTopic = topicId;
    savePersistedState();
    recordRecent(activeSubject, activeChapter, activeTopic);
  }

  // ── ADMIN CRUD OPERATIONS ──
  function addSubject({ name, shortName, classId, board, icon, color, description, nepaliName }) {
    const id = (shortName || name).toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (curriculum.subjects.find(s => s.id === id && s.classId === classId)) {
      throw new Error(`Subject with ID "${id}" already exists in ${classId}.`);
    }
    const newSubject = {
      id,
      name,
      nepaliName: nepaliName || name,
      shortName: shortName || name,
      classId: classId || activeClass,
      board: board || 'Nepal SEE',
      icon: icon || '📘',
      color: color || '#a855f7',
      badgeColor: 'rgba(168,85,247,0.2)',
      description: description || '',
      active: true,
      chapters: []
    };
    curriculum.subjects.push(newSubject);
    savePersistedData();
    return newSubject;
  }

  function updateSubject(id, updates) {
    const sub = curriculum.subjects.find(s => s.id === id);
    if (!sub) return false;
    Object.assign(sub, updates);
    savePersistedData();
    return true;
  }

  function deleteSubject(id) {
    curriculum.subjects = curriculum.subjects.filter(s => s.id !== id);
    savePersistedData();
    return true;
  }

  function addChapter(subjectId, { name, nepaliName, desc, icon, badge, tools, topics }) {
    const sub = curriculum.subjects.find(s => s.id === subjectId);
    if (!sub) throw new Error('Subject not found');
    const newId = sub.chapters.length ? Math.max(...sub.chapters.map(c => Number(c.id) || 0)) + 1 : 1;
    const newChapter = {
      id: newId,
      name,
      nepaliName: nepaliName || name,
      desc: desc || '',
      icon: icon || '📑',
      badge: badge || 'board',
      tools: tools || [],
      topics: topics || []
    };
    sub.chapters.push(newChapter);
    savePersistedData();
    return newChapter;
  }

  function updateChapter(subjectId, chapterId, updates) {
    const sub = curriculum.subjects.find(s => s.id === subjectId);
    if (!sub) return false;
    const ch = sub.chapters.find(c => c.id === chapterId);
    if (!ch) return false;
    Object.assign(ch, updates);
    savePersistedData();
    return true;
  }

  function deleteChapter(subjectId, chapterId) {
    const sub = curriculum.subjects.find(s => s.id === subjectId);
    if (!sub) return false;
    sub.chapters = sub.chapters.filter(c => c.id !== chapterId);
    savePersistedData();
    return true;
  }

  function reorderChapters(subjectId, chapterIds) {
    const sub = curriculum.subjects.find(s => s.id === subjectId);
    if (!sub) return false;
    const reordered = [];
    chapterIds.forEach(id => {
      const ch = sub.chapters.find(c => String(c.id) === String(id));
      if (ch) reordered.push(ch);
    });
    // Add any remaining
    sub.chapters.forEach(c => {
      if (!reordered.includes(c)) reordered.push(c);
    });
    sub.chapters = reordered;
    savePersistedData();
    return true;
  }

  function addTopic(subjectId, chapterId, { name, duration, description }) {
    const sub = curriculum.subjects.find(s => s.id === subjectId);
    if (!sub) return false;
    const ch = sub.chapters.find(c => c.id === chapterId);
    if (!ch) return false;
    if (!ch.topics) ch.topics = [];
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newTopic = { id, name, duration: duration || '45m', description: description || '' };
    ch.topics.push(newTopic);
    savePersistedData();
    return newTopic;
  }

  // ── SEARCH ──
  function search(query) {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    const results = [];

    curriculum.subjects.forEach(sub => {
      if (sub.name.toLowerCase().includes(q) || (sub.nepaliName && sub.nepaliName.includes(q))) {
        results.push({
          type: 'subject',
          title: sub.name,
          subtitle: `${sub.board} • ${sub.chapters.length} Chapters`,
          classId: sub.classId,
          subjectId: sub.id,
          icon: sub.icon,
          color: sub.color
        });
      }

      (sub.chapters || []).forEach(ch => {
        const matchTitle = ch.name.toLowerCase().includes(q) || (ch.nepaliName && ch.nepaliName.includes(q));
        const matchDesc  = ch.desc && ch.desc.toLowerCase().includes(q);
        if (matchTitle || matchDesc) {
          results.push({
            type: 'chapter',
            title: `Ch ${ch.id}: ${ch.name}`,
            subtitle: `${sub.name} • ${ch.desc || ''}`,
            classId: sub.classId,
            subjectId: sub.id,
            chapterId: ch.id,
            icon: ch.icon,
            color: sub.color
          });
        }

        (ch.topics || []).forEach(top => {
          if (top.name.toLowerCase().includes(q)) {
            results.push({
              type: 'topic',
              title: top.name,
              subtitle: `${sub.name} → Ch ${ch.id} ${ch.name}`,
              classId: sub.classId,
              subjectId: sub.id,
              chapterId: ch.id,
              topicId: top.id,
              icon: '📄',
              color: sub.color
            });
          }
        });
      });
    });

    return results.slice(0, 15);
  }

  // ── RECENT LESSONS ──
  function getRecent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT) || '[]');
    } catch(e) { return []; }
  }

  function recordRecent(subjectId, chapterId, topicId) {
    try {
      const sub = curriculum.subjects.find(s => s.id === subjectId);
      if (!sub) return;
      const ch = (sub.chapters || []).find(c => c.id === chapterId);
      if (!ch) return;
      let top = null;
      if (topicId && ch.topics) top = ch.topics.find(t => t.id === topicId);

      const item = {
        classId: sub.classId,
        subjectId: sub.id,
        subjectName: sub.name,
        subjectIcon: sub.icon,
        subjectColor: sub.color,
        chapterId: ch.id,
        chapterName: ch.name,
        topicId: top ? top.id : null,
        topicName: top ? top.name : null,
        timestamp: Date.now()
      };

      let recent = getRecent().filter(r => !(r.subjectId === subjectId && r.chapterId === chapterId));
      recent.unshift(item);
      recent = recent.slice(0, 8);
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent));
    } catch(e) {}
  }

  // ── PINNED CHAPTERS ──
  function getPinned() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_PINNED) || '[]');
    } catch(e) { return []; }
  }

  function togglePin(subjectId, chapterId) {
    try {
      let pinned = getPinned();
      const key = `${subjectId}::${chapterId}`;
      if (pinned.includes(key)) {
        pinned = pinned.filter(k => k !== key);
      } else {
        pinned.push(key);
      }
      localStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(pinned));
      return pinned.includes(key);
    } catch(e) { return false; }
  }

  function isPinned(subjectId, chapterId) {
    const key = `${subjectId}::${chapterId}`;
    return getPinned().includes(key);
  }

  // Initialize
  loadPersistedData();

  return {
    getClasses, getActiveClass,
    getSubjects, getActiveSubject,
    getChapters, getActiveChapter, getChapter,
    getTopics, getActiveTopic,
    setActiveClass, setActiveSubject, setActiveChapter, setActiveTopic,
    addSubject, updateSubject, deleteSubject,
    addChapter, updateChapter, deleteChapter, reorderChapters,
    addTopic,
    search,
    getRecent, recordRecent,
    getPinned, togglePin, isPinned
  };
})();

if (typeof window !== 'undefined') {
  window.CurriculumStore = CurriculumStore;
}
