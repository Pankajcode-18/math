'use strict';
// ═══════════════════════════════════════════════
// APP — main controller
// ═══════════════════════════════════════════════
const App = (() => {

  // ── state ──
  let currentTool   = 'select';
  let currentColor  = '#ffffff';
  let penSize       = 2;
  let eraserSize    = 26;
  let activeChapter = 1;
  let activeSubject = 'mathematics';  // 'mathematics' | 'science' | ...
  let recording     = false;
  let sidebarHidden = false;
  let rpanelHidden  = false;


  // ── File tracking: remember where we saved so we can re-save without dialog ──
  let lastSavePath   = null;  // full path of last saved .mbp file
  let lastSaveFolder = null;  // folder of last saved/loaded file
  let lastSaveName   = null;  // display name (without extension)

  // ── multi-page state ──
  // Each page stores shapes + in-memory ImageData (drawData) + serializable base64 (drawDataUrl)
  let pages       = [{ id: 1, label: 'Page 1', shapes: [], drawData: null, drawDataUrl: null }];
  let currentPage = 0; // index into pages[]

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  function init() {
    // ── Init CurriculumStore if available ──
    if (typeof CurriculumStore !== 'undefined') {
      const subj = CurriculumStore.getActiveSubject();
      if (subj) activeSubject = subj.id;
    }

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
      btn.addEventListener('click', () => {
        if (btn.id === 'btn-fp-pen' || btn.id === 'btn-fp-eraser') return;
        setTool(btn.dataset.tool);
      });
    });

    $('btn-undo').addEventListener('click', () => undo());
    $('btn-redo').addEventListener('click', () => redo());

    // Wire tools if available
    if (typeof PptPresenter !== 'undefined') PptPresenter.init();
    if (typeof ImageTool !== 'undefined') ImageTool.init();

    // Keyboard & Fullscreen sync
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove('board-fullscreen');
      } else {
        document.body.classList.add('board-fullscreen');
      }
      setTimeout(() => {
        if (typeof Canvas !== 'undefined' && Canvas.resize) Canvas.resize();
      }, 80);
    });

    UI.updateStatus();
    updateChapterLabel();

    // Update topbar subject badge
    const badge = document.getElementById('active-subject-badge');
    if (badge) badge.textContent = activeSubject === 'science' ? '🔬 Science' : '📐 Mathematics';
  }


  function $(id) { return document.getElementById(id); }

  // ─────────────────────────────────────────────
  // SIDEBAR TOGGLE
  // ─────────────────────────────────────────────
  function toggleSidebar() {
    sidebarHidden = !sidebarHidden;
    const sb = $('sidebar');
    if (sb) sb.classList.toggle('hide', sidebarHidden);
    const sbt = $('sb-toggle');
    if (sbt) {
      sbt.textContent = sidebarHidden ? '▶' : '◀';
      sbt.title = sidebarHidden ? 'Show chapters' : 'Hide chapters';
    }
    setTimeout(() => Canvas.resize(), 280);
  }

  function toggleRPanel() {
    if (typeof UI !== 'undefined' && UI.toggleShapesFlyout) {
      UI.toggleShapesFlyout();
    }
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
    pages.push({ id: Date.now(), label: `Page ${pages.length + 1}`, shapes: [], drawData: null, drawDataUrl: null, bgImage: null });
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
    pages[currentPage].shapes      = Canvas.getShapes();
    pages[currentPage].drawData    = Canvas.getDrawData();    // in-memory ImageData (fast page switching)
    pages[currentPage].drawDataUrl = Canvas.getDrawDataUrl(); // base64 PNG string (persisted to file)
    pages[currentPage].bgImage     = Canvas.getBgImage();
  }

  function loadCurrent() {
    const drawData = pages[currentPage].drawData;
    // Only use ImageData if it's a real ImageData instance (not {} from JSON parse)
    const drawSrc = (drawData instanceof ImageData)
      ? drawData
      : (pages[currentPage].drawDataUrl || null);
    Canvas.loadPageState(pages[currentPage].shapes, drawSrc, pages[currentPage].bgImage || null);
    UI.updateStatus();
  }

  // ─────────────────────────────────────────────
  // TOOL
  // ─────────────────────────────────────────────
  function setTool(tool) {
    const changed = currentTool !== tool;
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    Drawing.syncPointerEvents();
    if (typeof UI !== 'undefined') {
      if (UI.syncSubtoolButtons) UI.syncSubtoolButtons(tool);
      if (tool === 'pen' || tool === 'highlighter') {
        if (UI.closeEraserFlyout) UI.closeEraserFlyout();
        if (typeof Canvas !== 'undefined' && Canvas.updateFloatingToolbar) Canvas.updateFloatingToolbar();
      } else if (tool === 'eraser') {
        if (UI.closePenFlyout) UI.closePenFlyout();
        if (typeof Canvas !== 'undefined' && Canvas.updateFloatingToolbar) Canvas.updateFloatingToolbar();
      } else if (tool === 'text') {
        if (UI.closePenFlyout) UI.closePenFlyout();
        if (UI.closeEraserFlyout) UI.closeEraserFlyout();
        if (typeof Canvas !== 'undefined' && Canvas.showToolbarForTextTool) {
          Canvas.showToolbarForTextTool();
        }
      } else {
        if (UI.closePenFlyout) UI.closePenFlyout();
        if (UI.closeEraserFlyout) UI.closeEraserFlyout();
        if (typeof Canvas !== 'undefined' && Canvas.updateFloatingToolbar) {
          Canvas.updateFloatingToolbar();
        }
      }
      UI.syncPenPanel();
      UI.updateStatus();
    }

    if (window.PhysicsLab && typeof PhysicsLab.syncToolWithBoard === 'function') {
      PhysicsLab.syncToolWithBoard();
    }
    if (window.MathVisualizer && typeof MathVisualizer.syncToolWithBoard === 'function') {
      MathVisualizer.syncToolWithBoard();
    }
    if (window.GraphEngine && typeof GraphEngine.syncToolWithBoard === 'function') {
      GraphEngine.syncToolWithBoard();
    }
  }

  // ─────────────────────────────────────────────
  // COLOR
  // ─────────────────────────────────────────────
  function setColor(hex) {
    currentColor = hex;
    document.querySelectorAll('.color-dot, .fp-color-dot').forEach(d => {
      const match = (d.dataset.hex && d.dataset.hex.toLowerCase() === hex.toLowerCase()) ||
                    (d.style.background && rgbToHex(d.style.background) === hex.toLowerCase());
      d.classList.toggle('active', match);
    });
    if (typeof UI !== 'undefined' && UI.syncPenPanel) {
      UI.syncPenPanel();
    }
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
    activeChapter = isNaN(+id) ? id : +id;
    updateChapterLabel();
    // Update CurriculumStore if available
    if (typeof CurriculumStore !== 'undefined') {
      CurriculumStore.setActiveChapter(activeChapter);
    }
    if (typeof UI !== 'undefined') {
      if (UI.renderTopChapters) UI.renderTopChapters();
      if (UI.updateSidebarCard) UI.updateSidebarCard();
    }
    const sel = document.getElementById('sb-chapter-select');
    if (sel && sel.value !== String(activeChapter)) {
      sel.value = activeChapter;
    }
    // Update right panel badge & button label above Color
    const rpBadge = document.getElementById('rp-active-ch-badge');
    if (rpBadge) rpBadge.textContent = `Unit ${activeChapter}`;
    const rpBtnLbl = document.getElementById('rp-ch-tools-btn-label');
    if (rpBtnLbl) rpBtnLbl.textContent = `Ch ${activeChapter} Tools`;

    // USER REQUIREMENT: Automatically open chapter tools when clicking that unit
    if (typeof UI !== 'undefined' && UI.openChapterPanel) {
      UI.openChapterPanel();
    }
  }

  // ─────────────────────────────────────────────
  // SUBJECT SWITCHER
  // ─────────────────────────────────────────────
  function switchSubject(subjectId) {
    if (subjectId === activeSubject) return;
    activeSubject = subjectId;
    // Let UI rebuild sidebar + shape grid
    UI.rebuildForSubject(subjectId);
    // Update topbar subject switcher button active states
    const mathBtn = document.getElementById('subj-math');
    const sciBtn  = document.getElementById('subj-sci');
    if (mathBtn) mathBtn.classList.toggle('active', subjectId === 'mathematics');
    if (sciBtn)  sciBtn.classList.toggle('active', subjectId === 'science');
    // Reset chapter to first chapter of new subject
    if (typeof CurriculumStore !== 'undefined') {
      const chapters = CurriculumStore.getChapters();
      if (chapters && chapters.length) {
        activeChapter = chapters[0].id;
        if (typeof UI !== 'undefined') {
          if (UI.renderTopChapters) UI.renderTopChapters();
          if (UI.updateSidebarCard) UI.updateSidebarCard();
        }
      }
    }
    // If chapter panel is open, re-render it immediately for new subject
    const panel = document.getElementById('chapter-panel');
    if (panel && panel.classList.contains('open')) {
      UI.renderChapterPanel();
    }
    showToast(subjectId === 'science' ? '🔬 Switched to Science & Technology' : '📐 Switched to Mathematics');
  }

  function updateChapterLabel() {
    let chName = null;
    // Prefer CurriculumStore for the active subject's chapter name
    if (typeof CurriculumStore !== 'undefined') {
      const storeChapters = CurriculumStore.getChapters();
      const ch = storeChapters.find(c => c.id === activeChapter || +c.id === +activeChapter);
      if (ch) chName = `Ch ${ch.id} \u2014 ${ch.name}`;
    }
    // Fallback to legacy CHAPTERS array
    if (!chName) {
      const ch = CHAPTERS.find(c => c.id === activeChapter);
      if (ch) chName = `Ch ${ch.id} \u2014 ${ch.name}`;
    }
    if (chName) {
      const el = $('active-ch-label');
      if (el) {
        el.textContent = chName;
        el.title = chName;
      }
      const rpBadge = document.getElementById('rp-active-ch-badge');
      if (rpBadge) rpBadge.textContent = `Unit ${activeChapter}`;
      const rpBtnLbl = document.getElementById('rp-ch-tools-btn-label');
      if (rpBtnLbl) rpBtnLbl.textContent = `Ch ${activeChapter} Tools`;
    }
  }


  // ─────────────────────────────────────────────
  // RECORD
  // ─────────────────────────────────────────────
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

  // Save board — first save opens dialog, subsequent saves go to same file
  async function saveBoard({ forceDialog = false } = {}) {
    saveCurrent();
    const state = {
      pages, currentPage,
      chapter: activeChapter,
      subject: activeSubject,    // ── Curriculum metadata ──
      savedAt: new Date().toISOString()
    };


    if (window.electronAPI) {
      // If we already have a path and not forcing dialog, save silently
      const savePath = (!forceDialog && lastSavePath) ? lastSavePath : null;
      const defaultName = lastSaveName || pages[currentPage].label || 'MathBoard';

      const r = await window.electronAPI.saveBoard(state, defaultName, savePath);
      if (!r.success) { showToast('Save cancelled'); return; }

      // ── remember where we saved ──
      lastSavePath   = r.filePath;
      lastSaveFolder = r.filePath.substring(0, r.filePath.lastIndexOf('\\') || r.filePath.lastIndexOf('/'));
      lastSaveName   = r.fileName;

      // ── rename the current page tab to the file name ──
      pages[currentPage].label = r.fileName;
      renderPageTabs();

      // ── toast with Open Folder button ──
      showToastWithAction(
        `✓ Saved as "${r.fileName}"`,
        'Open Folder',
        () => window.electronAPI.openFolder(lastSaveFolder)
      );

    } else {
      // Browser fallback — download as JSON
      const a = document.createElement('a');
      a.download = `MathBoard-${Date.now()}.json`;
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], {type:'application/json'}));
      a.click();
    }
  }

  // Save As — always shows dialog
  async function saveBoardAs() {
    await saveBoard({ forceDialog: true });
  }

  // Load board — opens file dialog from last known folder
  async function loadBoard() {
    if (!window.electronAPI) return;
    const r = await window.electronAPI.loadBoard(lastSaveFolder || null);
    if (!r.success || !r.data) { showToast('Load cancelled'); return; }

    // ── restore state, nulling out drawData so loadCurrent uses drawDataUrl ──
    pages = (r.data.pages || [{ id:1, label:'Page 1', shapes:[], drawData:null, drawDataUrl:null }]).map(pg => ({
      ...pg,
      drawData: null,  // ImageData can't survive JSON — restore from drawDataUrl instead
    }));
    currentPage = r.data.currentPage || 0;
    if (currentPage >= pages.length) currentPage = 0;
    loadCurrent();
    if (r.data.chapter) selectChapter(r.data.chapter);
    // ── Restore curriculum state (backward compat: defaults to math) ──
    const savedSubject = r.data.subject || 'mathematics';
    if (savedSubject !== activeSubject) {
      switchSubject(savedSubject);
    }
    renderPageTabs();


    // ── remember this file for re-save ──
    lastSavePath   = r.filePath;
    lastSaveFolder = r.folder;
    lastSaveName   = r.fileName;

    // ── rename page tab to match loaded file ──
    pages[currentPage].label = r.fileName;
    renderPageTabs();

    showToast(`✓ Opened "${r.fileName}"`);
  }

  function clearBoard() {
    // Custom SmartBoard Touch Confirmation Dialog
    const existing = document.getElementById('sb-confirm-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sb-confirm-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(5, 11, 23, 0.75);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      touch-action: manipulation; user-select: none;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #0d1b38;
      border: 2px solid #c9a84c;
      border-radius: 18px;
      padding: 28px 32px;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(201,168,76,0.25);
      text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
    `;

    card.innerHTML = `
      <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(239,68,68,0.18); border: 2px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 26px;">
        ⚠️
      </div>
      <div style="font-size: 19px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', system-ui, sans-serif;">
        Clear Current Board?
      </div>
      <div style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.5;">
        This will erase all pen strokes and shapes on this page. This action cannot be undone.
      </div>
      <div style="display: flex; gap: 14px; width: 100%; margin-top: 8px;">
        <button id="sb-clear-cancel" style="flex: 1; min-height: 48px; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.2); color: #ffffff; font-size: 15px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button id="sb-clear-confirm" style="flex: 1.2; min-height: 48px; border-radius: 12px; background: linear-gradient(135deg, #dc2626, #b91c1c); border: 1.5px solid #ef4444; color: #ffffff; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(220,38,38,0.4);">
          Clear Board
        </button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    overlay.querySelector('#sb-clear-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('#sb-clear-confirm').onclick = () => {
      overlay.remove();
      Canvas.clearAll();
      pages[currentPage].shapes   = [];
      pages[currentPage].drawData = null;
      if (window.PhysicsLab && typeof PhysicsLab.clearAnnotations === 'function') PhysicsLab.clearAnnotations();
      if (window.MathVisualizer && typeof MathVisualizer.clearAnnotations === 'function') MathVisualizer.clearAnnotations();
      if (window.GraphEngine && typeof GraphEngine.clearAnnotations === 'function') GraphEngine.clearAnnotations();
      showToast('Board cleared');
    };
  }

  // ─────────────────────────────────────────────
  // TOAST (plain) + TOAST WITH ACTION BUTTON — SmartBoard enlarged
  // ─────────────────────────────────────────────
  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:rgba(7,16,31,.97);border:1.5px solid rgba(201,168,76,.6);color:#e8c96b;padding:12px 26px;border-radius:12px;font-size:15px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,.65);transition:opacity .3s;font-family:'Segoe UI',sans-serif;pointer-events:none`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 300); }, 2500);
  }

  function showToastWithAction(msg, btnLabel, onAction) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:rgba(7,16,31,.97);border:1.5px solid rgba(201,168,76,.6);color:#e8c96b;padding:12px 24px;border-radius:12px;font-size:15px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,.65);display:flex;align-items:center;gap:14px;font-family:'Segoe UI',sans-serif`;
    const span = document.createElement('span');
    span.textContent = msg;
    const btn = document.createElement('button');
    btn.textContent = btnLabel;
    btn.style.cssText = `background:rgba(201,168,76,.25);border:1px solid rgba(201,168,76,.7);color:#e8c96b;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13.5px;font-weight:600;font-family:'Segoe UI',sans-serif;min-height:36px;`;
    btn.onclick = () => { onAction(); t.remove(); };
    t.appendChild(span);
    t.appendChild(btn);
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(() => t.remove(), 300); }, 4500);
  }

  // ─────────────────────────────────────────────
  // SIMULATION & IMMERSIVE STATE
  // ─────────────────────────────────────────────
  function isSimulationActive() {
    if (window.PhysicsLab && typeof PhysicsLab.isVisible === 'function' && PhysicsLab.isVisible()) return 'physics';
    if (window.MathVisualizer && typeof MathVisualizer.isVisible === 'function' && MathVisualizer.isVisible()) return 'math';
    if (window.GraphEngine && typeof GraphEngine.isVisible === 'function' && GraphEngine.isVisible()) return 'graph';
    return false;
  }

  function undo() {
    const sim = isSimulationActive();
    if (sim === 'physics' && window.PhysicsLab && typeof PhysicsLab.undo === 'function') {
      PhysicsLab.undo();
      return;
    }
    if (sim === 'math' && window.MathVisualizer && typeof MathVisualizer.undo === 'function') {
      MathVisualizer.undo();
      return;
    }
    if (sim === 'graph' && window.GraphEngine && typeof GraphEngine.undo === 'function') {
      GraphEngine.undo();
      return;
    }
    if (typeof Canvas !== 'undefined' && Canvas.undo) {
      Canvas.undo();
    }
  }

  function redo() {
    const sim = isSimulationActive();
    if (sim === 'physics' && window.PhysicsLab && typeof PhysicsLab.redo === 'function') {
      PhysicsLab.redo();
      return;
    }
    if (sim === 'math' && window.MathVisualizer && typeof MathVisualizer.redo === 'function') {
      MathVisualizer.redo();
      return;
    }
    if (sim === 'graph' && window.GraphEngine && typeof GraphEngine.redo === 'function') {
      GraphEngine.redo();
      return;
    }
    if (typeof Canvas !== 'undefined' && Canvas.redo) {
      Canvas.redo();
    }
  }

  function toggleFullscreen() {
    const isNowFullscreen = document.body.classList.toggle('board-fullscreen');
    if (isNowFullscreen) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
    setTimeout(() => {
      if (typeof Canvas !== 'undefined' && Canvas.resize) {
        Canvas.resize();
      }
    }, 80);
  }

  function setSimulationActive(active) {
    if (active) {
      document.body.classList.add('sim-active');
    } else {
      document.body.classList.remove('sim-active');
    }
    setTimeout(() => {
      if (typeof Canvas !== 'undefined' && Canvas.resize) {
        Canvas.resize();
      }
    }, 60);
  }

  // ─────────────────────────────────────────────
  // KEYBOARD
  // ─────────────────────────────────────────────
  function onKey(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 's') { e.preventDefault(); saveBoard(); }
      if (e.key === '[' || e.key === '-') { e.preventDefault(); Canvas.adjustFontSize(-2); }
      if (e.key === ']' || e.key === '=' || e.key === '+') { e.preventDefault(); Canvas.adjustFontSize(2); }
      return;
    }
    if (e.key === '[' || e.key === '-') { Canvas.adjustFontSize(-2); return; }
    if (e.key === ']' || e.key === '=' || e.key === '+') { Canvas.adjustFontSize(2); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); Canvas.nudgeSelected(0, e.shiftKey ? -10 : -2); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); Canvas.nudgeSelected(0, e.shiftKey ? 10 : 2); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); Canvas.nudgeSelected(e.shiftKey ? -10 : -2, 0); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); Canvas.nudgeSelected(e.shiftKey ? 10 : 2, 0); return; }
    const map = { v:'select', p:'pen', h:'highlighter', t:'text', l:'line', d:'dashed', a:'arrow', e:'eraser', s:'smart-draw' };
    if (map[e.key]) setTool(map[e.key]);
    if (e.key === 'i' || e.key === 'I') { if (typeof ImageTool !== 'undefined') ImageTool.openPicker(); }
    if (e.key === 'Escape') {
      if (typeof UI !== 'undefined' && UI.isChapterPanelOpen && UI.isChapterPanelOpen()) {
        UI.closeChapterPanel();
        return;
      }
      setTool('select');
      Canvas.deselectAll();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') Canvas.deleteShape();
  }

  // ─────────────────────────────────────────────
  // BOARD STATE — for Presentation Library
  // ─────────────────────────────────────────────
  function getBoardState() {
    // Capture current page before serializing
    saveCurrent();
    return {
      pages: pages.map(pg => ({
        id:          pg.id,
        label:       pg.label,
        shapes:      pg.shapes      ? JSON.parse(JSON.stringify(pg.shapes)) : [],
        drawDataUrl: pg.drawDataUrl || null,  // base64 PNG — fully serializable
      })),
      currentPage,
      chapter: activeChapter,
    };
  }

  function loadBoardState(data) {
    if (!data) return;
    pages = (data.pages || [{ id:1, label:'Page 1', shapes:[], drawData:null, drawDataUrl:null }]).map(pg => ({
      ...pg,
      drawData: null,            // will be restored from drawDataUrl by loadCurrent
    }));
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
    undo,
    redo,
    toggleFullscreen,
    setSimulationActive,
    isSimulationActive,
    setTool, setColor,
    selectChapter, switchSubject,
    toggleSidebar, toggleRPanel,
    addPage, switchPage, deletePage,
    toggleRecord, takeSnapshot, exportPDF,
    saveBoard, saveBoardAs, loadBoard, clearBoard,
    saveCurrent, getBoardState, loadBoardState,
    showToast, showToastWithAction,
    get currentTool()  { return currentTool; },
    get currentColor() { return currentColor; },
    get penSize()      { return penSize; },
    set penSize(v)     { penSize = v; },
    get eraserSize()   { return eraserSize; },
    set eraserSize(v)  { eraserSize = v; },
    setPenSize: (v) => { penSize = v; },
    setEraserSize: (v) => { eraserSize = v; },
    get activeChapter(){ return activeChapter; },
    get activeSubject(){ return activeSubject; },
  };

})();

document.addEventListener('DOMContentLoaded', App.init);