'use strict';
// ═══════════════════════════════════════════════
// APP — main controller
// ═══════════════════════════════════════════════
const App = (() => {

  // ── state ──
  let currentTool   = 'select';
  let currentColor  = '#ffffff';
  let penSize       = 2;
  let activeChapter = 1;
  let recording     = false;
  let sidebarHidden = false;
  let rpanelHidden  = false;

  // ── multi-page state ──
  // Each page stores its own shapes array + draw-canvas imageData
  let pages       = [{ id: 1, label: 'Page 1', shapes: [], drawData: null }];
  let currentPage = 0; // index into pages[]

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  function init() {
    UI.buildSidebar();
    UI.buildShapeGrid();
    UI.buildColorPalette();
    UI.buildPenSizes();
    UI.buildBoardSwatches();
    Canvas.init();
    Drawing.attachEvents();
    Drawing.syncPointerEvents();
    renderPageTabs();

    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });

    $('btn-undo').addEventListener('click', () => Canvas.undo());
    $('btn-redo').addEventListener('click', () => Canvas.redo());

    // Wire overlay buttons — done here so globals are guaranteed loaded
    $('btn-graph')   && $('btn-graph').addEventListener('click',   () => GraphEngine.toggle());
    $('btn-library') && $('btn-library').addEventListener('click', () => Library.toggle());
    $('btn-timer')   && $('btn-timer').addEventListener('click',   () => Timer.toggle());

    // Keyboard
    document.addEventListener('keydown', onKey);

    UI.updateStatus();
    updateChapterLabel();
  }

  function $(id) { return document.getElementById(id); }

  // ─────────────────────────────────────────────
  // SIDEBAR TOGGLE
  // ─────────────────────────────────────────────
  function toggleSidebar() {
    sidebarHidden = !sidebarHidden;
    $('sidebar').classList.toggle('hide', sidebarHidden);
    $('sb-toggle').textContent = sidebarHidden ? '▶' : '◀';
    $('sb-toggle').title = sidebarHidden ? 'Show chapters' : 'Hide chapters';
    setTimeout(() => Canvas.resize(), 280);
  }

  function toggleRPanel() {
    rpanelHidden = !rpanelHidden;
    $('right-panel').classList.toggle('hide', rpanelHidden);
    $('rp-toggle').textContent = rpanelHidden ? '◀' : '▶';
    $('rp-toggle').title = rpanelHidden ? 'Show shapes panel' : 'Hide shapes panel';
    setTimeout(() => Canvas.resize(), 280);
  }

  // ─────────────────────────────────────────────
  // MULTI-PAGE SYSTEM
  // ─────────────────────────────────────────────
  function renderPageTabs() {
    const bar = $('page-tabs-bar');
    // Remove all tabs (not the + button)
    bar.querySelectorAll('.page-tab').forEach(t => t.remove());

    const addBtn = $('add-page-btn');
    pages.forEach((pg, idx) => {
      const tab = document.createElement('button');
      tab.className = 'page-tab' + (idx === currentPage ? ' active' : '');
      tab.innerHTML = `
        <span onclick="App.switchPage(${idx})">${pg.label}</span>
        ${pages.length > 1
          ? `<span class="del-tab" onclick="App.deletePage(${idx})" title="Delete page">×</span>`
          : ''}`;
      tab.addEventListener('click', e => {
        if (!e.target.classList.contains('del-tab')) App.switchPage(idx);
      });
      bar.insertBefore(tab, addBtn);
    });

    $('sb-page').textContent = currentPage + 1;
  }

  function addPage() {
    // Save current page state
    saveCurrent();
    pages.push({ id: Date.now(), label: `Page ${pages.length + 1}`, shapes: [], drawData: null });
    currentPage = pages.length - 1;
    loadCurrent();
    renderPageTabs();
    showToast(`Page ${currentPage + 1} added`);
  }

  function switchPage(idx) {
    if (idx === currentPage) return;
    saveCurrent();
    currentPage = idx;
    loadCurrent();
    renderPageTabs();
  }

  function deletePage(idx) {
    if (pages.length === 1) { showToast('Cannot delete the only page'); return; }
    pages.splice(idx, 1);
    if (currentPage >= pages.length) currentPage = pages.length - 1;
    loadCurrent();
    renderPageTabs();
  }

  function saveCurrent() {
    pages[currentPage].shapes   = Canvas.getShapes();
    pages[currentPage].drawData = Canvas.getDrawData();
  }

  function loadCurrent() {
    Canvas.loadPageState(pages[currentPage].shapes, pages[currentPage].drawData);
    UI.updateStatus();
  }

  // ─────────────────────────────────────────────
  // TOOL
  // ─────────────────────────────────────────────
  function setTool(tool) {
    // Reset angle tool if leaving it
    if (currentTool === 'angle' && tool !== 'angle') {
      Canvas.resetAngleTool();
    }
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    Drawing.syncPointerEvents();
    UI.syncPenPanel();
    UI.updateStatus();
  }

  // ─────────────────────────────────────────────
  // COLOR
  // ─────────────────────────────────────────────
  function setColor(hex) {
    currentColor = hex;
    document.querySelectorAll('.color-dot').forEach(d => {
      d.classList.toggle('active', rgbToHex(d.style.background) === hex.toLowerCase() || d.dataset.hex === hex);
    });
  }

  function rgbToHex(rgb) {
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return rgb;
    return '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join('');
  }

  // ─────────────────────────────────────────────
  // CHAPTER
  // ─────────────────────────────────────────────
  function selectChapter(id) {
    activeChapter = id;
    document.querySelectorAll('.ch-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.id) === id);
    });
    updateChapterLabel();
    UI.openChapterPanel();  // automatically opens panel when chapter clicked
  }

  function updateChapterLabel() {
    const ch = CHAPTERS.find(c => c.id === activeChapter);
    if (ch) $('active-ch-label').textContent = `Ch ${ch.id} — ${ch.name}`;
  }

  // ─────────────────────────────────────────────
  // FULLSCREEN
  // ─────────────────────────────────────────────
  function toggleFullscreen() {
    const btn = $('btn-fullscreen');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Electron fallback
        if (window.electronAPI && window.require) {
          const { getCurrentWindow } = window.require('@electron/remote') || {};
          if (getCurrentWindow) getCurrentWindow().setFullScreen(true);
        }
      });
      if (btn) btn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none"><path d="M8 3H3v5M17 3h-5v0M3 12v5h5M12 17h5v-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Exit Full`;
    } else {
      document.exitFullscreen();
      if (btn) btn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Fullscreen`;
    }
  }

  // Listen for fullscreen change (e.g. user presses F11 or Esc)
  document.addEventListener('fullscreenchange', () => {
    const btn = $('btn-fullscreen');
    if (!btn) return;
    if (document.fullscreenElement) {
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M8 3H3v5M17 3h-5v0M3 12v5h5M12 17h5v-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Exit Full`;
    } else {
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Fullscreen`;
    }
  });
  function toggleRecord() {
    recording = !recording;
    const btn = $('btn-rec');
    btn.classList.toggle('on', recording);
    btn.innerHTML = recording
      ? '<span class="rec-dot"></span> Stop'
      : '<span class="rec-dot"></span> Record';
  }

  // ─────────────────────────────────────────────
  // EXPORT ALL PAGES AS PDF
  // ─────────────────────────────────────────────
  async function exportPDF() {
    showToast('Preparing pages…');
    saveCurrent();

    const savedPage  = currentPage;
    const snapshots  = [];
    const { W, H }   = Canvas.getCanvasSize();

    for (let i = 0; i < pages.length; i++) {
      showToast(`Rendering page ${i + 1} of ${pages.length}…`);
      Canvas.loadPageState(pages[i].shapes, pages[i].drawData);
      // Wait for canvas to fully paint
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 150));
      // Use JPEG (smaller, reliable in PDF)
      const dataUrl = Canvas.snapshotJpeg();
      snapshots.push({ dataUrl, w: W, h: H, label: pages[i].label });
    }

    // Restore original page
    Canvas.loadPageState(pages[savedPage].shapes, pages[savedPage].drawData);
    currentPage = savedPage;
    renderPageTabs();

    if (window.electronAPI) {
      showToast(`Building PDF…`);
      const r = await window.electronAPI.savePdf(snapshots, 'PiyushDhara MathBoard');
      if (r && r.success) {
        showToast(`✓ PDF saved — ${r.pageCount} page(s)`);
      } else {
        showToast('PDF export failed or cancelled');
      }
    } else {
      snapshots.forEach((snap, i) => {
        const a = document.createElement('a');
        a.download = `MathBoard-Page${i+1}.jpg`;
        a.href = snap.dataUrl;
        a.click();
      });
      showToast(`Downloaded ${snapshots.length} page(s)`);
    }
  }

  // ─────────────────────────────────────────────
  // SNAPSHOT
  // ─────────────────────────────────────────────
  async function takeSnapshot() {
    const dataUrl = Canvas.snapshot();
    if (window.electronAPI) {
      const r = await window.electronAPI.saveSnapshot(dataUrl);
      if (r.success) showToast('Saved: ' + r.filePath);
    } else {
      const a = document.createElement('a');
      a.download = `MathBoard-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();
    }
  }

  // ─────────────────────────────────────────────
  // SAVE / LOAD / CLEAR
  // ─────────────────────────────────────────────
  async function saveBoard() {
    saveCurrent();
    const state = { pages, currentPage, chapter: activeChapter };
    if (window.electronAPI) {
      const r = await window.electronAPI.saveBoard(state);
      if (r.success) showToast('Session saved');
    } else {
      const a = document.createElement('a');
      a.download = `MathBoard-${Date.now()}.json`;
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], {type:'application/json'}));
      a.click();
    }
  }

  async function loadBoard() {
    if (!window.electronAPI) return;
    const r = await window.electronAPI.loadBoard();
    if (r.success && r.data) {
      pages       = r.data.pages || pages;
      currentPage = r.data.currentPage || 0;
      loadCurrent();
      if (r.data.chapter) selectChapter(r.data.chapter);
      renderPageTabs();
      showToast('Session loaded');
    }
  }

  function clearBoard() {
    if (!confirm('Clear this page?')) return;
    Canvas.clearAll();
    pages[currentPage].shapes   = [];
    pages[currentPage].drawData = null;
  }

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────
  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:48px;left:50%;transform:translateX(-50%);background:rgba(7,16,31,.97);border:1px solid rgba(201,168,76,.5);color:#e8c96b;padding:9px 18px;border-radius:7px;font-size:12.5px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.5);transition:opacity .3s;font-family:'Inter',sans-serif`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 300); }, 2400);
  }

  // ─────────────────────────────────────────────
  // KEYBOARD
  // ─────────────────────────────────────────────
  function onKey(e) {
    const tag = document.activeElement?.tagName;
    // Allow delete even when canvas is focused, but not when typing in inputs
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); Canvas.undo(); }
      if (e.key === 'y') { e.preventDefault(); Canvas.redo(); }
      if (e.key === 's') { e.preventDefault(); saveBoard(); }
      return;
    }
    const map = { v:'select', p:'pen', h:'highlighter', t:'text', l:'line', d:'dashed', a:'arrow', e:'eraser', g:'angle' };
    if (map[e.key]) setTool(map[e.key]);
    if (e.key === 'Escape') {
      setTool('select');
      Canvas.deselectAll();
      Canvas.resetAngleTool();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      Canvas.deleteShape();
    }
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
  }

  // ─────────────────────────────────────────────
  // BOARD STATE — for Presentation Library
  // ─────────────────────────────────────────────
  function getBoardState() {
    // Return serializable state — strip ImageData (drawData) which can't be JSON'd
    return {
      pages: pages.map(pg => ({
        id:       pg.id,
        label:    pg.label,
        shapes:   pg.shapes   ? JSON.parse(JSON.stringify(pg.shapes)) : [],
        drawData: null,  // ImageData cannot be serialized
      })),
      currentPage,
      chapter: activeChapter,
    };
  }

  function loadBoardState(data) {
    if (!data) return;
    pages       = data.pages       || [{ id:1, label:'Page 1', shapes:[], drawData:null }];
    currentPage = data.currentPage || 0;
    if (currentPage >= pages.length) currentPage = 0;
    loadCurrent();
    if (data.chapter) selectChapter(data.chapter);
    renderPageTabs();
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────
  return {
    init,
    setTool, setColor,
    selectChapter,
    toggleSidebar, toggleRPanel,
    addPage, switchPage, deletePage,
    toggleRecord, takeSnapshot, exportPDF,
    toggleFullscreen,
    saveBoard, loadBoard, clearBoard,
    saveCurrent, getBoardState, loadBoardState,
    showToast,
    get currentTool()  { return currentTool; },
    get currentColor() { return currentColor; },
    get penSize()      { return penSize; },
    set penSize(v)     { penSize = v; },
    get activeChapter(){ return activeChapter; },
  };
})();

document.addEventListener('DOMContentLoaded', App.init);