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
  let pages       = [{ id: 1, label: 'Page 1', shapes: [], strokes: [], drawData: null, drawDataUrl: null, bgImage: null, history: [], redoStack: [] }];
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
        updatePageControls();
      }, 80);
    });

    UI.updateStatus();
    updateChapterLabel();

    // Update topbar subject badge
    const badge = document.getElementById('active-subject-badge');
    if (badge) badge.textContent = activeSubject === 'science' ? '🔬 Science' : '📐 Mathematics';

    initBrightness();
    document.addEventListener('click', (e) => {
      const bCtrl = document.getElementById('board-brightness-control');
      if (bCtrl && !bCtrl.contains(e.target)) {
        const dd = document.getElementById('brightness-dropdown');
        if (dd) dd.classList.add('hidden');
      }
    });
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
  // ─────────────────────────────────────────────
  // PAGE MANAGEMENT & SYNCHRONIZATION
  // ─────────────────────────────────────────────
  function updatePageControls() {
    const cur = currentPage + 1;
    const total = pages.length;

    // Fullscreen floating page navigator (right side)
    const curNumEl = $('fs-nav-page-num');
    const totalNumEl = $('fs-nav-page-total');
    if (curNumEl) curNumEl.textContent = cur;
    if (totalNumEl) totalNumEl.textContent = total;

    const prevBtn = $('fs-nav-prev');
    const nextBtn = $('fs-nav-next');
    if (prevBtn) {
      const isFirst = (currentPage <= 0);
      prevBtn.disabled = isFirst;
      prevBtn.classList.toggle('disabled', isFirst);
    }
    if (nextBtn) {
      const isLast = (currentPage >= total - 1);
      nextBtn.disabled = isLast;
      nextBtn.classList.toggle('disabled', isLast);
    }

    // Sidebar & full-screen card counters
    const fsp = $('fs-page-counter');
    if (fsp) fsp.textContent = `${cur}/${total}`;
    const sbp = $('sb-page');
    if (sbp) sbp.textContent = cur;
  }

  function renderPageTabs() {
    const bar = $('page-tabs-bar');
    if (bar) {
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
    }

    updatePageControls();
  }

  function addPage() {
    // 1. Save current active page state completely
    saveCurrent();

    // 2. Inherit current board background theme so new page matches
    const curColorId = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId) ? Canvas.getBoardColorId() : null;

    // 3. Push brand new blank page object
    pages.push({
      id: Date.now(),
      label: `Page ${pages.length + 1}`,
      shapes: [],
      strokes: [],
      drawData: null,
      drawDataUrl: null,
      bgImage: null,
      boardColorId: curColorId,
      history: [],
      redoStack: []
    });

    // 4. Activate new page immediately
    currentPage = pages.length - 1;
    loadCurrent();
    renderPageTabs();
    showToast(`Page ${currentPage + 1} added`);
  }

  function prevPage() {
    if (currentPage > 0) {
      switchPage(currentPage - 1);
    }
  }

  function nextPage() {
    if (currentPage < pages.length - 1) {
      switchPage(currentPage + 1);
    }
  }

  function switchPage(idx) {
    if (idx === currentPage || idx < 0 || idx >= pages.length) return;
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
    if (!pages[currentPage]) return;
    pages[currentPage].shapes       = (typeof Canvas !== 'undefined' && Canvas.getShapes) ? Canvas.getShapes() : [];
    pages[currentPage].strokes      = (typeof Canvas !== 'undefined' && Canvas.getStrokes) ? Canvas.getStrokes() : [];
    pages[currentPage].bgImage      = (typeof Canvas !== 'undefined' && Canvas.getBgImage) ? Canvas.getBgImage() : null;
    pages[currentPage].boardColorId = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId) ? Canvas.getBoardColorId() : null;
    pages[currentPage].history      = (typeof Canvas !== 'undefined' && Canvas.getHistory) ? Canvas.getHistory() : [];
    pages[currentPage].redoStack    = (typeof Canvas !== 'undefined' && Canvas.getRedoStack) ? Canvas.getRedoStack() : [];
  }

  function loadCurrent() {
    if (!pages[currentPage]) return;
    if (pages[currentPage].boardColorId && typeof Canvas !== 'undefined' && Canvas.setBoardColor) {
      Canvas.setBoardColor(pages[currentPage].boardColorId);
    }
    const strokes = pages[currentPage].strokes || [];
    const hist = pages[currentPage].history || [];
    const redoStk = pages[currentPage].redoStack || [];
    Canvas.loadPageState(
      pages[currentPage].shapes,
      pages[currentPage].drawDataUrl || null,
      pages[currentPage].bgImage || null,
      strokes,
      hist,
      redoStk
    );
    UI.updateStatus();
    updatePageControls();
  }

  // ─────────────────────────────────────────────
  // CLEAR CURRENT PAGE (With Confirmation & Undo)
  // ─────────────────────────────────────────────
  function confirmClearCurrentPage() {
    const desc = $('fs-modal-desc');
    if (desc) {
      desc.textContent = `This will remove all pen strokes, handwriting, shapes, and graphs from Page ${currentPage + 1}. Other pages will remain unchanged.`;
    }
    const modal = $('fs-clear-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeClearModal() {
    const modal = $('fs-clear-modal');
    if (modal) modal.classList.add('hidden');
  }

  function executeClearCurrentPage() {
    closeClearModal();
    if (typeof Canvas !== 'undefined' && Canvas.clearAll) {
      Canvas.clearAll();
      saveCurrent();
      if (window.PhysicsLab && typeof PhysicsLab.clearAnnotations === 'function') PhysicsLab.clearAnnotations();
      if (window.MathVisualizer && typeof MathVisualizer.clearAnnotations === 'function') MathVisualizer.clearAnnotations();
      if (window.GraphEngine && typeof GraphEngine.clearAnnotations === 'function') GraphEngine.clearAnnotations();
      showToastWithAction(`Page ${currentPage + 1} cleared`, '↩ Undo Clear', () => {
        undo();
      });
    }
  }

  function clearBoard() {
    confirmClearCurrentPage();
  }

  // ─────────────────────────────────────────────
  // PDF READY MODAL & TRUSTED DOWNLOAD HANDLER
  // ─────────────────────────────────────────────
  let pendingPdfBlob = null;
  let pendingPdfFilename = '';

  function openPdfModal(pageCount, filename, sizeBytes) {
    const modal = $('pdf-ready-modal');
    if (!modal) return;
    const desc = $('pdf-modal-desc');
    const sizeKb = Math.round(sizeBytes / 1024);
    if (desc) {
      desc.innerHTML = `All <b>${pageCount}</b> board page${pageCount > 1 ? 's' : ''} compiled into <b>1 PDF document</b> (${sizeKb} KB).<br><span style="font-size:12px;opacity:0.85;color:#38bdf8;word-break:break-all;margin-top:6px;display:inline-block;">📄 ${filename}</span>`;
    }
    modal.classList.remove('hidden');
  }

  function closePdfModal() {
    const modal = $('pdf-ready-modal');
    if (modal) modal.classList.add('hidden');
  }

  async function downloadGeneratedPdf() {
    if (!pendingPdfBlob) {
      closePdfModal();
      return;
    }
    const filename = pendingPdfFilename || 'PiyushDhara-Board-Notes.pdf';
    const blob = pendingPdfBlob;

    // 1. Preferred modern API on Windows: File System Access API
    // Opens genuine Windows "Save As" dialog with .pdf extension pre-set
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        closePdfModal();
        showToast(`✓ Saved: ${handle.name || filename}`);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          // User clicked Cancel in Windows file picker
          return;
        }
        console.warn('showSaveFilePicker failed, falling back to direct anchor download:', err);
      }
    }

    // 2. Direct anchor click in genuine user-click event (Edge preserves .pdf extension)
    try {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 15000);
      closePdfModal();
      showToast(`✓ Downloaded ${filename}`);
    } catch (err) {
      console.error('Download error:', err);
      showToast('❌ Download failed: ' + err.message);
    }
  }

  // ─────────────────────────────────────────────
  // TOOL
  // ─────────────────────────────────────────────
  function setTool(tool) {
    const changed = currentTool !== tool;
    currentTool = tool;
    if (tool !== 'select' && typeof BoardClipboard !== 'undefined' && BoardClipboard.clearSelection) {
      BoardClipboard.clearSelection();
    }
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
  // ─────────────────────────────────────────────
  // CLIENT-SIDE MULTI-PAGE PDF GENERATOR
  // ─────────────────────────────────────────────
  function ensureJpegDataUrl(dataUrl, w, h) {
    return new Promise((resolve) => {
      if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/jpeg')) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w || img.naturalWidth || 1200;
        c.height = h || img.naturalHeight || 800;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.94));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function buildClientPdfBlob(snapshots) {
    const chunks = [];
    const offsets = [];
    let pos = 0;
    let objCount = 0;

    function stringToLatin1Bytes(str) {
      const len = str.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = str.charCodeAt(i) & 0xff;
      }
      return bytes;
    }

    function base64ToUint8Array(base64) {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    function pushString(str) {
      const bytes = stringToLatin1Bytes(str);
      chunks.push(bytes);
      pos += bytes.length;
    }

    function pushBytes(bytes) {
      chunks.push(bytes);
      pos += bytes.length;
    }

    function registerObj() {
      objCount++;
      offsets[objCount] = pos;
      pushString(`${objCount} 0 obj\n`);
      return objCount;
    }

    function endObj() {
      pushString('\nendobj\n');
    }

    // 1. PDF Header (Standard %PDF-1.4 binary marker)
    pushString('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');

    const numPages = snapshots.length;
    const pageObjNums = [];
    for (let i = 0; i < numPages; i++) {
      pageObjNums.push(3 + 3 * i + 2);
    }

    // Obj 1: Catalog
    offsets[1] = pos;
    pushString(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    // Obj 2: Pages
    offsets[2] = pos;
    const kidsStr = pageObjNums.map(n => `${n} 0 R`).join(' ');
    pushString(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${numPages} >>\nendobj\n`);

    // Output each page (Image XObject -> Content Stream -> Page Object)
    objCount = 2;
    for (let i = 0; i < numPages; i++) {
      const snap = snapshots[i];
      const b64 = (snap.dataUrl || '').replace(/^data:image\/[a-z]+;base64,/, '');
      const imgBytes = base64ToUint8Array(b64);
      const imgW = snap.w || 1200;
      const imgH = snap.h || 800;

      // Convert pixels to 72 dpi PDF points
      const ptW = Math.round(imgW * 72 / 96);
      const ptH = Math.round(imgH * 72 / 96);

      // Image XObject
      const imgObj = registerObj();
      pushString(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
      pushBytes(imgBytes);
      pushString('\nendstream');
      endObj();

      // Content stream
      const cs = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im1 Do Q`;
      const csObj = registerObj();
      pushString(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
      endObj();

      // Page Object
      const pageObj = registerObj();
      pushString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Contents ${csObj} 0 R /Resources << /XObject << /Im1 ${imgObj} 0 R >> >> >>`);
      endObj();
    }

    // XRef Table
    const xrefPos = pos;
    pushString(`xref\n0 ${objCount + 1}\n`);
    pushString('0000000000 65535 f \n');
    for (let i = 1; i <= objCount; i++) {
      const off = String(offsets[i]).padStart(10, '0');
      pushString(`${off} 00000 n \n`);
    }

    // Trailer
    pushString(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ─────────────────────────────────────────────
  // EXPORT ALL PAGES AS PDF
  // ─────────────────────────────────────────────
  async function exportPDF() {
    showToast('Preparing pages for PDF…');
    saveCurrent();

    const savedPage  = currentPage;
    const snapshots  = [];
    const { W, H }   = Canvas.getCanvasSize();

    for (let i = 0; i < pages.length; i++) {
      showToast(`Rendering page ${i + 1} of ${pages.length}…`);
      if (pages[i].boardColorId && typeof Canvas !== 'undefined' && Canvas.setBoardColor) {
        Canvas.setBoardColor(pages[i].boardColorId);
      }
      Canvas.loadPageState(
        pages[i].shapes,
        pages[i].drawDataUrl || null,
        pages[i].bgImage || null,
        pages[i].strokes || [],
        pages[i].history || [],
        pages[i].redoStack || []
      );
      // Wait for canvas to fully paint
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 120));
      // Use JPEG (smaller, reliable, 100% native in PDF)
      const dataUrl = Canvas.snapshotJpeg();
      snapshots.push({ dataUrl, w: W, h: H, label: pages[i].label });
    }

    // Restore original page
    if (pages[savedPage].boardColorId && typeof Canvas !== 'undefined' && Canvas.setBoardColor) {
      Canvas.setBoardColor(pages[savedPage].boardColorId);
    }
    Canvas.loadPageState(
      pages[savedPage].shapes,
      pages[savedPage].drawDataUrl || null,
      pages[savedPage].bgImage || null,
      pages[savedPage].strokes || [],
      pages[savedPage].history || [],
      pages[savedPage].redoStack || []
    );
    currentPage = savedPage;
    renderPageTabs();

    if (window.electronAPI && typeof window.electronAPI.savePdf === 'function') {
      showToast(`Building PDF…`);
      const r = await window.electronAPI.savePdf(snapshots, 'PiyushDhara MathBoard');
      if (r && r.success) {
        showToast(`✓ PDF saved — ${r.pageCount} page(s)`);
      } else {
        showToast('PDF export cancelled');
      }
    } else {
      showToast(`Converting ${snapshots.length} page(s) into PDF…`);
      try {
        for (let i = 0; i < snapshots.length; i++) {
          snapshots[i].dataUrl = await ensureJpegDataUrl(snapshots[i].dataUrl, snapshots[i].w, snapshots[i].h);
        }
        const pdfBlob = buildClientPdfBlob(snapshots);
        pendingPdfBlob = pdfBlob;
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        pendingPdfFilename = `PiyushDhara-Board-${stamp}.pdf`;

        // Display download modal for a trusted 1-click download with real .pdf filename
        openPdfModal(snapshots.length, pendingPdfFilename, pdfBlob.size);
        showToast(`✓ PDF Ready (${snapshots.length} pages) — Click Download PDF`);
      } catch (err) {
        console.error('PDF generation error:', err);
        showToast('❌ PDF export error: ' + err.message);
      }
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
      return;
    }

    const filename = `MathBoard-Page${currentPage + 1}-${Date.now()}.png`;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'PNG Image (*.png)',
              accept: { 'image/png': ['.png'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          showToast(`✓ Saved: ${handle.name || filename}`);
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.download = filename;
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 10000);
      showToast(`✓ Snapshot saved as ${filename}`);
    } catch (e) {
      const a = document.createElement('a');
      a.download = filename;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 10000);
      showToast(`✓ Snapshot saved`);
    }
  }

  // ─────────────────────────────────────────────
  // SAVE / LOAD / CLEAR
  // ─────────────────────────────────────────────

  function restoreBoardState(data, fileName) {
    if (!data) return;
    pages = (data.pages || [{ id:1, label:'Page 1', shapes:[], drawData:null, drawDataUrl:null }]).map(pg => ({
      ...pg,
      drawData: null,
      history: [],
      redoStack: []
    }));
    currentPage = data.currentPage || 0;
    if (currentPage >= pages.length) currentPage = 0;
    loadCurrent();
    if (data.chapter) selectChapter(data.chapter);
    const savedSubject = data.subject || 'mathematics';
    if (savedSubject !== activeSubject) {
      switchSubject(savedSubject);
    }
    if (fileName) {
      lastSaveName = fileName;
      pages[currentPage].label = fileName.replace(/\.(mbp|json)$/i, '');
    }
    renderPageTabs();
    showToast(`✓ Loaded "${fileName || 'Board Session'}"`);
  }

  // Save board — clean state (strip redundant canvas history buffers to keep file light)
  async function saveBoard({ forceDialog = false } = {}) {
    saveCurrent();
    const cleanPages = pages.map(pg => ({
      id: pg.id,
      label: pg.label,
      shapes: pg.shapes ? JSON.parse(JSON.stringify(pg.shapes)) : [],
      strokes: pg.strokes ? JSON.parse(JSON.stringify(pg.strokes)) : [],
      drawDataUrl: pg.drawDataUrl || null,
      bgImage: pg.bgImage || null,
      boardColorId: pg.boardColorId || null
      // Redundant undo/redo history snapshots omitted: reduces file size from 130MB to <200KB!
    }));

    const state = {
      pages: cleanPages,
      currentPage,
      chapter: activeChapter,
      subject: activeSubject,
      savedAt: new Date().toISOString()
    };

    if (window.electronAPI) {
      const savePath = (!forceDialog && lastSavePath) ? lastSavePath : null;
      const defaultName = lastSaveName || pages[currentPage].label || 'MathBoard';

      const r = await window.electronAPI.saveBoard(state, defaultName, savePath);
      if (!r.success) { showToast('Save cancelled'); return; }

      lastSavePath   = r.filePath;
      lastSaveFolder = r.filePath.substring(0, r.filePath.lastIndexOf('\\') || r.filePath.lastIndexOf('/'));
      lastSaveName   = r.fileName;

      pages[currentPage].label = r.fileName;
      renderPageTabs();

      showToastWithAction(
        `✓ Saved as "${r.fileName}"`,
        'Open Folder',
        () => window.electronAPI.openFolder(lastSaveFolder)
      );

    } else {
      // Browser fallback — lightweight session file (.mbp)
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const defaultName = lastSaveName || `MathBoard-${stamp}.mbp`;
      const jsonStr = JSON.stringify(state);
      const blob = new Blob([jsonStr], { type: 'application/json' });

      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{
              description: 'PiyushDhara Board Session (*.mbp, *.json)',
              accept: { 'application/json': ['.mbp', '.json'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          lastSaveName = handle.name || defaultName;
          pages[currentPage].label = lastSaveName.replace(/\.(mbp|json)$/i, '');
          renderPageTabs();
          showToast(`✓ Saved: "${handle.name || defaultName}"`);
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          console.warn('showSaveFilePicker failed, falling back to download:', err);
        }
      }

      // Direct anchor download
      const a = document.createElement('a');
      a.download = defaultName;
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 10000);
      showToast(`✓ Saved as ${defaultName}`);
    }
  }

  // Save As — always shows dialog
  async function saveBoardAs() {
    await saveBoard({ forceDialog: true });
  }

  // Load board — works seamlessly in both Electron and Browser
  async function loadBoard() {
    if (window.electronAPI) {
      const r = await window.electronAPI.loadBoard(lastSaveFolder || null);
      if (!r.success || !r.data) { showToast('Load cancelled'); return; }
      lastSavePath   = r.filePath;
      lastSaveFolder = r.folder;
      restoreBoardState(r.data, r.fileName);
      return;
    }

    // Browser mode
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'PiyushDhara Board Session (*.mbp, *.json)',
            accept: { 'application/json': ['.mbp', '.json'] }
          }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        restoreBoardState(data, file.name);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.warn('showOpenFilePicker error, using input fallback:', err);
      }
    }

    let input = document.getElementById('board-session-file-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'board-session-file-input';
      input.accept = '.mbp,.json,application/json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          restoreBoardState(data, file.name);
        } catch (err) {
          showToast('❌ Invalid session file');
        }
        input.value = '';
      };
    }
    input.click();
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
      updatePageControls();
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
      const key = e.key.toLowerCase();
      if (e.shiftKey && key === 'n') {
        e.preventDefault();
        addPage();
        return;
      }
      if (key === 'c') {
        if (typeof BoardClipboard !== 'undefined' && BoardClipboard.hasSelection()) {
          e.preventDefault();
          BoardClipboard.copy();
          return;
        }
      }
      if (key === 'v') {
        if (typeof BoardClipboard !== 'undefined' && BoardClipboard.hasClipboardData()) {
          e.preventDefault();
          BoardClipboard.paste();
          return;
        }
      }
      if (key === 'x') {
        if (typeof BoardClipboard !== 'undefined' && BoardClipboard.hasSelection()) {
          e.preventDefault();
          BoardClipboard.cut();
          return;
        }
      }
      if (key === 'd') {
        if (typeof BoardClipboard !== 'undefined' && BoardClipboard.hasSelection()) {
          e.preventDefault();
          BoardClipboard.duplicate();
          return;
        }
      }
      if (e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 's') { e.preventDefault(); saveBoard(); }
      if (e.key === '[' || e.key === '-') { e.preventDefault(); Canvas.adjustFontSize(-2); }
      if (e.key === ']' || e.key === '=' || e.key === '+') { e.preventDefault(); Canvas.adjustFontSize(2); }
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      prevPage();
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      nextPage();
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
      const clearModal = $('fs-clear-modal');
      if (clearModal && !clearModal.classList.contains('hidden')) {
        closeClearModal();
        return;
      }
      const pdfModal = $('pdf-ready-modal');
      if (pdfModal && !pdfModal.classList.contains('hidden')) {
        closePdfModal();
        return;
      }
      if (typeof BoardClipboard !== 'undefined' && BoardClipboard.clearSelection) {
        BoardClipboard.clearSelection();
      }
      if (typeof UI !== 'undefined' && UI.isChapterPanelOpen && UI.isChapterPanelOpen()) {
        UI.closeChapterPanel();
        return;
      }
      setTool('select');
      Canvas.deselectAll();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (typeof BoardClipboard !== 'undefined' && BoardClipboard.hasSelection()) {
        e.preventDefault();
        BoardClipboard.deleteSelected();
        return;
      }
      Canvas.deleteShape();
    }
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
  // ENTIRE BOARD BRIGHTNESS CONTROL
  // ─────────────────────────────────────────────
  let boardBrightness = 100;

  function initBrightness() {
    try {
      const saved = localStorage.getItem('mbp_board_brightness');
      if (saved) {
        setBoardBrightness(parseInt(saved), false);
      }
    } catch(e) {}

    const bCtrl = document.getElementById('board-brightness-control');
    if (bCtrl) {
      bCtrl.addEventListener('wheel', (e) => {
        e.preventDefault();
        adjustBoardBrightness(e.deltaY < 0 ? 5 : -5);
      }, { passive: false });
    }
  }

  function adjustBoardBrightness(delta) {
    setBoardBrightness(boardBrightness + delta);
  }

  function setBoardBrightness(val, save = true) {
    boardBrightness = Math.max(30, Math.min(100, Math.round((parseInt(val) || 100) / 5) * 5));
    if (save) {
      try { localStorage.setItem('mbp_board_brightness', boardBrightness); } catch(e) {}
    }

    const overlay = document.getElementById('board-brightness-overlay');
    if (overlay) {
      const opacity = ((100 - boardBrightness) / 100) * 0.78;
      overlay.style.opacity = opacity.toFixed(2);
    }

    const lbl = document.getElementById('brightness-val-label');
    if (lbl) lbl.textContent = `${boardBrightness}%`;

    const pctText = document.getElementById('bdm-pct-text');
    if (pctText) pctText.textContent = `${boardBrightness}%`;

    const slider = document.getElementById('board-brightness-slider');
    if (slider) slider.value = boardBrightness;

    document.querySelectorAll('.bdm-preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.b) === boardBrightness);
    });
  }

  function toggleBrightnessMenu(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('brightness-dropdown');
    if (dd) {
      dd.classList.toggle('hidden');
    }
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
    prevPage, nextPage, updatePageControls,
    confirmClearCurrentPage, closeClearModal, executeClearCurrentPage,
    openPdfModal, closePdfModal, downloadGeneratedPdf,
    getPages: () => pages, getCurrentPage: () => currentPage,
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
    setBoardBrightness,
    adjustBoardBrightness,
    toggleBrightnessMenu,
    getBoardBrightness: () => boardBrightness
  };

})();

document.addEventListener('DOMContentLoaded', App.init);