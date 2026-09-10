'use strict';

// ═══════════════════════════════════════════════
// CANVAS MANAGER — full touch + mouse support
// ═══════════════════════════════════════════════

const Canvas = (() => {

  const BOARD_COLORS = [
    { id:'green', bg:'#0e2419', line:'rgba(255,255,255,0.075)', major:'rgba(255,255,255,0.15)' },
    { id:'black', bg:'#0b0d13', line:'rgba(255,255,255,0.07)',  major:'rgba(255,255,255,0.14)' },
    { id:'navy',  bg:'#0a1224', line:'rgba(148,163,184,0.08)', major:'rgba(148,163,184,0.16)' },
    { id:'white', bg:'#ffffff', line:'rgba(15,23,42,0.07)',    major:'rgba(15,23,42,0.13)'    },
  ];
  let currentBoardColor = BOARD_COLORS[0];
  let currentBgImage = null; // dataURL or null
  let bgImageObj = null;

  let gridCtx, shapeCtx, drawCtx;
  let W = 0, H = 0;

  let shapes    = [];
  let history   = [];
  let redoStack = [];
  let selected  = null;
  let dragging  = null;
  let resizing  = null;
  let dragOff   = { x:0, y:0 };
  let lineStart = null;
  let draggingTableDivider = null; // { table, type, index, startX, startY, origWidths, origHeights }
  let rotatingStickyNote = null;   // { note, cx, cy, startAngle, origRot }
  let cellClickCandidate = null;   // { table, r, c, startX, startY }

  // Touch tap detection for double-tap (edit text)
  let lastTap = 0;
  let lastTapPos = null;

  // Zoom & Pan state
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let isSpaceDown = false;
  const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  // ─────────────────────────────────────────────
  function init() {
    gridCtx  = document.getElementById('grid-canvas').getContext('2d');
    shapeCtx = document.getElementById('shape-canvas').getContext('2d');
    drawCtx  = document.getElementById('draw-canvas').getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    const sc = document.getElementById('shape-canvas');
    const zone = document.getElementById('canvas-zone');

    // ── Mouse events ──
    sc.addEventListener('mousedown',  onPointerDown);
    sc.addEventListener('mousemove',  onPointerMove);
    sc.addEventListener('mouseup',    onPointerUp);
    sc.addEventListener('dblclick',   onDblClick);
    sc.addEventListener('mousemove',  onCursorPos);

    // ── Touch events — ALL on shape canvas ──
    sc.addEventListener('touchstart',  onTouchStart,  { passive: false });
    sc.addEventListener('touchmove',   onTouchMove,   { passive: false });
    sc.addEventListener('touchend',    onTouchEnd,    { passive: false });
    sc.addEventListener('touchcancel', onTouchCancel, { passive: false });

    // ── Zoom & Pan events (wheel & keyboard shortcuts) ──
    if (zone) {
      zone.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.89;
          const rect = zone.getBoundingClientRect();
          setZoom(zoomLevel * factor, e.clientX - rect.left, e.clientY - rect.top);
        } else if (zoomLevel > 1.0) {
          panX -= e.deltaX;
          panY -= e.deltaY;
          applyZoomTransform();
        }
      }, { passive: false });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (!isSpaceDown) {
          isSpaceDown = true;
          if (zone) zone.style.cursor = 'grab';
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        zoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        isSpaceDown = false;
        if (zone) zone.style.cursor = '';
      }
    });

    setBoardColor(currentBoardColor.id, currentBoardColor.bg, currentBoardColor.line, currentBoardColor.major);
    renderShapes();
    applyZoomTransform();
  }

  // ─────────────────────────────────────────────
  // RESIZE
  // ─────────────────────────────────────────────
  function resize() {
    const zone = document.getElementById('canvas-zone');
    if (!zone) return;
    W = zone.offsetWidth;
    H = zone.offsetHeight;

    // Grid canvas always covers the full zone screen
    const gc = document.getElementById('grid-canvas');
    if (gc) {
      gc.width = W;
      gc.height = H;
    }

    ['shape-canvas','draw-canvas','ui-canvas'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { c.width = W; c.height = H; }
    });
    const pc = document.getElementById('preview-canvas');
    if (pc) { pc.width = W; pc.height = H; }
    const sp = document.getElementById('smart-draw-preview');
    if (sp) { sp.width = W; sp.height = H; }
    drawGrid();
    renderShapes();
  }

  // ─────────────────────────────────────────────
  // BOARD COLOR
  // ─────────────────────────────────────────────
  function getGridColors(bgHexOrRgb) {
    let r = 10, g = 31, b = 10;
    if (bgHexOrRgb) {
      if (bgHexOrRgb.startsWith('#')) {
        let hex = bgHexOrRgb.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (hex.length === 6) {
          r = parseInt(hex.substring(0, 2), 16) || 0;
          g = parseInt(hex.substring(2, 4), 16) || 0;
          b = parseInt(hex.substring(4, 6), 16) || 0;
        }
      } else if (bgHexOrRgb.startsWith('rgb')) {
        const m = bgHexOrRgb.match(/\d+/g);
        if (m && m.length >= 3) {
          r = parseInt(m[0], 10);
          g = parseInt(m[1], 10);
          b = parseInt(m[2], 10);
        }
      }
    }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 150) {
      return { line: 'rgba(15, 23, 42, 0.08)', major: 'rgba(15, 23, 42, 0.15)' };
    } else {
      return { line: 'rgba(255, 255, 255, 0.09)', major: 'rgba(255, 255, 255, 0.18)' };
    }
  }

  function setBoardColor(id, bg, line, major) {
    if (!bg) {
      const match = BOARD_COLORS.find(b => b.id === id);
      bg = match ? match.bg : '#0e2419';
      line = match ? match.line : null;
      major = match ? match.major : null;
    }
    if (!line) {
      const colors = getGridColors(bg);
      line = colors.line;
      major = colors.major;
    }
    currentBoardColor = { id, bg, line, major: major || line };
    const zone = document.getElementById('canvas-zone');
    if (zone) zone.style.background = currentBoardColor.bg;

    // Harmonize UI elements (page tabs & statusbar footer) with board color
    document.documentElement.style.setProperty('--board-bg', currentBoardColor.bg);
    document.documentElement.setAttribute('data-board-theme', id);

    drawGrid();
  }

  // ─────────────────────────────────────────────
  // INFINITE FULL-SCREEN GRID — NEVER CLIPPED BY ZOOM OR PAN
  // ─────────────────────────────────────────────
  function drawGrid() {
    const zone = document.getElementById('canvas-zone');
    const gc   = document.getElementById('grid-canvas');
    if (!zone || !gc || !gridCtx) return;

    const screenW = zone.offsetWidth || W;
    const screenH = zone.offsetHeight || H;

    if (gc.width !== screenW || gc.height !== screenH) {
      gc.width  = screenW;
      gc.height = screenH;
    }

    gridCtx.clearRect(0, 0, screenW, screenH);
    gridCtx.fillStyle = currentBoardColor.bg;
    gridCtx.fillRect(0, 0, screenW, screenH);

    if (bgImageObj && bgImageObj.complete && bgImageObj.naturalWidth > 0) {
      gridCtx.save();
      const imgW = bgImageObj.naturalWidth;
      const imgH = bgImageObj.naturalHeight;
      const scale = Math.min(screenW / imgW, screenH / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (screenW - dw) / 2;
      const dy = (screenH - dh) / 2;
      gridCtx.drawImage(bgImageObj, dx, dy, dw, dh);
      gridCtx.restore();
    } else {
      const colors = (currentBoardColor.line && currentBoardColor.major)
        ? { line: currentBoardColor.line, major: currentBoardColor.major }
        : getGridColors(currentBoardColor.bg);

      // SmartBoard Graph Paper Grid: Always full screen, completely covering everything
      // Base step in screen pixels tracks zoom & pan seamlessly
      let effectiveStep = 32 * zoomLevel;
      while (effectiveStep < 20) {
        effectiveStep *= 2;
      }
      while (effectiveStep > 64) {
        effectiveStep /= 2;
      }

      const majorStep = effectiveStep * 5;

      // Pan-aligned start coordinates so grid tracks canvas movement smoothly
      const startX = ((panX % effectiveStep) + effectiveStep) % effectiveStep;
      const startY = ((panY % effectiveStep) + effectiveStep) % effectiveStep;

      gridCtx.save();
      gridCtx.lineWidth = 1;

      // 1. Regular grid lines across 100% of the screen
      gridCtx.beginPath();
      gridCtx.strokeStyle = colors.line;

      for (let x = startX; x <= screenW; x += effectiveStep) {
        const px = Math.floor(x) + 0.5;
        gridCtx.moveTo(px, 0);
        gridCtx.lineTo(px, screenH);
      }
      for (let y = startY; y <= screenH; y += effectiveStep) {
        const py = Math.floor(y) + 0.5;
        gridCtx.moveTo(0, py);
        gridCtx.lineTo(screenW, py);
      }
      gridCtx.stroke();

      // 2. Major accent grid lines across 100% of the screen
      const majorStartX = ((panX % majorStep) + majorStep) % majorStep;
      const majorStartY = ((panY % majorStep) + majorStep) % majorStep;

      gridCtx.beginPath();
      gridCtx.strokeStyle = colors.major;

      for (let x = majorStartX; x <= screenW; x += majorStep) {
        const px = Math.floor(x) + 0.5;
        gridCtx.moveTo(px, 0);
        gridCtx.lineTo(px, screenH);
      }
      for (let y = majorStartY; y <= screenH; y += majorStep) {
        const py = Math.floor(y) + 0.5;
        gridCtx.moveTo(0, py);
        gridCtx.lineTo(screenW, py);
      }
      gridCtx.stroke();

      gridCtx.restore();
    }
  }

  function setBgImage(dataUrl) {
    currentBgImage = dataUrl || null;
    if (currentBgImage) {
      bgImageObj = new Image();
      bgImageObj.onload = () => drawGrid();
      bgImageObj.src = currentBgImage;
    } else {
      bgImageObj = null;
      drawGrid();
    }
  }

  function getBgImage() {
    return currentBgImage;
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  function renderShapes() {
    shapeCtx.clearRect(0, 0, W, H);
    shapes.forEach(s => Shapes.draw(shapeCtx, s));
    updateFormulaBadge();
    updateFloatingToolbar();
  }

  function updateFormulaBadge() {
    const badge = document.getElementById('formula-badge');
    if (!selected) { badge?.classList.add('hidden'); return; }
    const formula = Shapes.getFormula(selected);
    if (!formula) { badge?.classList.add('hidden'); return; }
    document.getElementById('fb-name').textContent   = formula.name;
    document.getElementById('fb-expr').textContent   = formula.expr;
    document.getElementById('fb-result').textContent = formula.result;
    const b  = Shapes.getBounds(selected);
    const bx = Math.min(b.x + b.w + 12, W - 215);
    const by = Math.max(Math.min(b.y - 10, H - 120), 10);
    badge.style.left = bx + 'px';
    badge.style.top  = by + 'px';
    badge?.classList.remove('hidden');
  }

  function getActiveTextTarget() {
    const editor = document.getElementById('text-editor-box');
    const ta     = document.getElementById('active-textbox-input');
    if (editor && ta) return { type: 'editor', editor, ta };
    if (selected && selected.type === 'text-block') return { type: 'shape', shape: selected };
    return null;
  }

  function updateFloatingToolbar() {
    const bar = document.getElementById('text-floating-toolbar');
    if (!bar) return;
    const target = getActiveTextTarget();
    if (!target) {
      bar.classList.add('hidden');
      const moreMenu = document.getElementById('tft-more-dropdown');
      if (moreMenu) moreMenu.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');

    let curFont = 'Noto Sans, sans-serif';
    let curSize = 24;
    let curBold = false;
    let curColor = '#ffffff';
    let curHighlight = false;
    let curLocked = false;
    let boxX = 0, boxY = 0, boxW = 200, boxH = 40;

    if (target.type === 'editor') {
      curFont = target.ta.style.fontFamily || 'Noto Sans, sans-serif';
      curSize = parseInt(target.ta.style.fontSize) || 24;
      curBold = target.ta.style.fontWeight === '700';
      curColor = target.ta.style.color || '#ffffff';
      curHighlight = target.editor.dataset.highlight === 'true';
      const r = target.editor.getBoundingClientRect();
      const zoneR = document.getElementById('canvas-zone')?.getBoundingClientRect() || { left: 0, top: 0 };
      boxX = r.left - zoneR.left;
      boxY = r.top - zoneR.top;
      boxW = r.width;
      boxH = r.height;
    } else {
      const s = target.shape;
      curFont = s.fontFamily || 'Noto Sans, sans-serif';
      curSize = s.fontSize || 24;
      curBold = !!s.bold;
      curColor = s.color || '#ffffff';
      curHighlight = !!s.highlight;
      curLocked = !!s.locked;
      const b = Shapes.getBounds(s);
      boxX = b.x * zoomLevel + panX;
      boxY = b.y * zoomLevel + panY;
      boxW = b.w * zoomLevel;
      boxH = b.h * zoomLevel;
    }

    // Synchronize UI widgets
    const selFont = document.getElementById('tft-font-select');
    if (selFont) {
      for (let opt of selFont.options) {
        if (opt.value.toLowerCase().includes(curFont.toLowerCase().split(',')[0])) {
          selFont.value = opt.value;
          break;
        }
      }
    }

    const inpSize = document.getElementById('tft-size-input');
    if (inpSize) inpSize.value = curSize;

    const btnBold = document.getElementById('tft-bold-btn');
    if (btnBold) btnBold.classList.toggle('active', curBold);

    const barColor = document.getElementById('tft-color-indicator');
    if (barColor) barColor.style.background = curColor;

    const barHighlight = document.getElementById('tft-highlight-indicator');
    if (barHighlight) barHighlight.style.background = curHighlight ? '#facc15' : 'transparent';

    const btnLock = document.getElementById('tft-lock-btn');
    if (btnLock) btnLock.classList.toggle('active', curLocked);

    // Position toolbar right above box
    const zone = document.getElementById('canvas-zone');
    const zw = zone ? zone.offsetWidth : window.innerWidth;
    let top = boxY - 48;
    if (top < 10) top = boxY + boxH + 12;
    let left = Math.max(12, Math.min(zw - 580, boxX));
    bar.style.top = top + 'px';
    bar.style.left = left + 'px';
  }

  function setTextFontFamily(font) {
    const target = getActiveTextTarget();
    if (!target) return;
    if (target.type === 'editor') {
      target.ta.style.fontFamily = font;
    } else {
      saveHistory();
      target.shape.fontFamily = font;
      renderShapes();
    }
    updateFloatingToolbar();
  }

  function setTextFontSize(size) {
    const sz = Math.max(8, Math.min(240, Number(size) || 24));
    const target = getActiveTextTarget();
    if (!target) return;
    if (target.type === 'editor') {
      target.ta.style.fontSize = sz + 'px';
    } else {
      saveHistory();
      target.shape.fontSize = sz;
      renderShapes();
    }
    updateFloatingToolbar();
  }

  function adjustFontSize(delta) {
    const target = getActiveTextTarget();
    if (!target) return;
    const cur = target.type === 'editor' ? (parseInt(target.ta.style.fontSize) || 24) : (target.shape.fontSize || 24);
    setTextFontSize(cur + delta);
  }

  function toggleTextBold() {
    const target = getActiveTextTarget();
    if (!target) return;
    if (target.type === 'editor') {
      const isB = target.ta.style.fontWeight === '700';
      target.ta.style.fontWeight = isB ? '500' : '700';
    } else {
      saveHistory();
      target.shape.bold = !target.shape.bold;
      renderShapes();
    }
    updateFloatingToolbar();
  }

  function cycleTextAlign() {
    const target = getActiveTextTarget();
    if (!target) return;
    const ALIGNS = ['left', 'center', 'right'];
    let curAlign = 'left';
    if (target.type === 'editor') {
      curAlign = target.ta.style.textAlign || 'left';
      const next = ALIGNS[(ALIGNS.indexOf(curAlign) + 1) % ALIGNS.length];
      target.ta.style.textAlign = next;
    } else {
      saveHistory();
      curAlign = target.shape.align || 'left';
      const next = ALIGNS[(ALIGNS.indexOf(curAlign) + 1) % ALIGNS.length];
      target.shape.align = next;
      renderShapes();
    }
  }

  function toggleTextList() {
    const target = getActiveTextTarget();
    if (!target) return;
    if (target.type === 'editor') {
      const lines = target.ta.value.split('\n');
      const hasBullet = lines.some(l => l.startsWith('• '));
      target.ta.value = lines.map(l => hasBullet ? l.replace(/^•\s*/, '') : `• ${l}`).join('\n');
    } else {
      saveHistory();
      const lines = (target.shape.text || '').split('\n');
      const hasBullet = lines.some(l => l.startsWith('• '));
      target.shape.text = lines.map(l => hasBullet ? l.replace(/^•\s*/, '') : `• ${l}`).join('\n');
      renderShapes();
    }
  }

  function promptTextLink() {
    const target = getActiveTextTarget();
    const url = prompt('Enter link URL (e.g. https://...):', 'https://');
    if (!url) return;
    if (target?.type === 'editor') {
      target.ta.value += ` (${url})`;
    } else if (target?.type === 'shape') {
      saveHistory();
      target.shape.link = url;
      App.showToast(`Link attached: ${url}`);
      renderShapes();
    }
  }

  function setTextColor(hex) {
    const target = getActiveTextTarget();
    if (!target) return;
    if (target.type === 'editor') {
      target.ta.style.color = hex;
      target.ta.style.caretColor = hex;
    } else {
      saveHistory();
      target.shape.color = hex;
      renderShapes();
    }
    const barColor = document.getElementById('tft-color-indicator');
    if (barColor) barColor.style.background = hex;
  }

  function toggleTextHighlight() {
    const target = getActiveTextTarget();
    if (!target) return;
    if (target.type === 'editor') {
      const isH = target.editor.dataset.highlight === 'true';
      target.editor.dataset.highlight = isH ? 'false' : 'true';
      target.editor.style.background = isH ? 'transparent' : 'rgba(254, 240, 138, 0.35)';
    } else {
      saveHistory();
      target.shape.highlight = !target.shape.highlight;
      target.shape.highlightColor = 'rgba(254, 240, 138, 0.45)';
      renderShapes();
    }
    updateFloatingToolbar();
  }

  function cycleTextOpacity() {
    const target = getActiveTextTarget();
    if (!target) return;
    const OPACITIES = [1.0, 0.75, 0.5, 0.25];
    if (target.type === 'editor') {
      const cur = parseFloat(target.ta.style.opacity) || 1.0;
      const next = OPACITIES[(OPACITIES.indexOf(cur) + 1) % OPACITIES.length];
      target.ta.style.opacity = next;
    } else {
      saveHistory();
      const cur = target.shape.opacity !== undefined ? target.shape.opacity : 1.0;
      const next = OPACITIES[(OPACITIES.indexOf(cur) + 1) % OPACITIES.length];
      target.shape.opacity = next;
      renderShapes();
    }
  }

  function promptTextComment() {
    const target = getActiveTextTarget();
    if (!target) return;
    const comment = prompt('Add comment / note for this text:', target.shape?.comment || '');
    if (comment !== null && target.shape) {
      target.shape.comment = comment;
      App.showToast(`Note saved: "${comment}"`);
    }
  }

  function toggleTextLock() {
    const target = getActiveTextTarget();
    if (!target || target.type !== 'shape') return;
    saveHistory();
    target.shape.locked = !target.shape.locked;
    App.showToast(target.shape.locked ? '🔒 Text position locked' : '🔓 Text unlocked');
    updateFloatingToolbar();
  }

  function convertTextMath() {
    const target = getActiveTextTarget();
    if (!target) return;
    const mathMap = [
      [/x\^2/g, 'x²'], [/x\^3/g, 'x³'], [/x\^n/g, 'xⁿ'],
      [/\bsqrt\b/gi, '√'], [/\bpi\b/gi, 'π'], [/\btheta\b/gi, 'θ'],
      [/\balpha\b/gi, 'α'], [/\bbeta\b/gi, 'β'], [/\bdelta\b/gi, 'Δ'],
      [/\+\-/g, '±'], [/<=/g, '≤'], [/>=/g, '≥'], [/!=/g, '≠'],
      [/\*/g, '×'], [/\//g, '÷']
    ];
    if (target.type === 'editor') {
      let val = target.ta.value;
      mathMap.forEach(([from, to]) => { val = val.replace(from, to); });
      target.ta.value = val;
    } else {
      saveHistory();
      let val = target.shape.text || '';
      mathMap.forEach(([from, to]) => { val = val.replace(from, to); });
      target.shape.text = val;
      renderShapes();
    }
    App.showToast('✓ Converted math symbols (x², √, π, θ, ±)');
  }

  function toggleTextMoreMenu(event) {
    if (event) event.stopPropagation();
    const m = document.getElementById('tft-more-dropdown');
    if (m) m.classList.toggle('hidden');
  }

  function duplicateSelectedText() {
    const target = getActiveTextTarget();
    if (!target || target.type !== 'shape') return;
    saveHistory();
    const clone = JSON.parse(JSON.stringify(target.shape));
    clone.id = Date.now();
    clone.x += 24;
    clone.y += 24;
    shapes.push(clone);
    selectShape(clone);
    renderShapes();
    const m = document.getElementById('tft-more-dropdown');
    if (m) m.classList.add('hidden');
  }

  function copySelectedText() {
    const target = getActiveTextTarget();
    if (!target) return;
    const text = target.type === 'editor' ? target.ta.value : target.shape.text;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      App.showToast('Copied text to clipboard');
    }
    const m = document.getElementById('tft-more-dropdown');
    if (m) m.classList.add('hidden');
  }

  function bringTextToFront() {
    const target = getActiveTextTarget();
    if (!target || target.type !== 'shape') return;
    saveHistory();
    const idx = shapes.indexOf(target.shape);
    if (idx !== -1) {
      shapes.splice(idx, 1);
      shapes.push(target.shape);
      renderShapes();
    }
    const m = document.getElementById('tft-more-dropdown');
    if (m) m.classList.add('hidden');
  }

  function showToolbarForTextTool() {
    const bar = document.getElementById('text-floating-toolbar');
    if (!bar) return;
    const target = getActiveTextTarget();
    if (target) {
      updateFloatingToolbar();
    } else {
      bar.classList.remove('hidden');
      const textBtn = document.querySelector('.tool-btn[data-tool="text"]');
      if (textBtn) {
        const r = textBtn.getBoundingClientRect();
        const zoneR = document.getElementById('canvas-zone')?.getBoundingClientRect() || { left: 0, top: 0 };
        bar.style.top = Math.max(16, (r.top - zoneR.top) - 6) + 'px';
        bar.style.left = Math.max(16, (r.right - zoneR.left) + 14) + 'px';
      } else {
        bar.style.top = '160px';
        bar.style.left = '76px';
      }
    }
  }

  function editSelectedText() {
    if (selected && selected.type === 'text-block') {
      Drawing.editText(selected);
    }
  }

  function nudgeSelected(dx, dy) {
    if (!selected) return;
    saveHistory();
    selected.x += dx;
    selected.y += dy;
    renderShapes();
    updateFloatingToolbar();
  }

  // ─────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────
  function saveHistory() {
    try {
      const entry = {
        shapes: JSON.parse(JSON.stringify(shapes)),
        drawDataUrl: getDrawDataUrl()
      };
      history.push(JSON.stringify(entry));
      if (history.length > 60) history.shift();
      redoStack = [];
    } catch (e) {
      console.error('saveHistory error', e);
    }
  }

  function restoreHistoryEntry(entryJson) {
    if (!entryJson) return;
    try {
      const parsed = JSON.parse(entryJson);
      if (Array.isArray(parsed)) {
        shapes = parsed;
      } else if (parsed && typeof parsed === 'object') {
        shapes = parsed.shapes || [];
        drawCtx.clearRect(0, 0, W, H);
        if (parsed.drawDataUrl) {
          const img = new Image();
          img.onload = () => drawCtx.drawImage(img, 0, 0);
          img.src = parsed.drawDataUrl;
        }
      }
    } catch (e) {
      console.error('Failed to restore history', e);
    }
    selected = null;
    renderShapes();
    UI.updateStatus();
    UI.hidePropPanel();
  }

  function undo() {
    if (!history.length) return;
    redoStack.push(JSON.stringify({
      shapes: JSON.parse(JSON.stringify(shapes)),
      drawDataUrl: getDrawDataUrl()
    }));
    restoreHistoryEntry(history.pop());
  }

  function redo() {
    if (!redoStack.length) return;
    history.push(JSON.stringify({
      shapes: JSON.parse(JSON.stringify(shapes)),
      drawDataUrl: getDrawDataUrl()
    }));
    restoreHistoryEntry(redoStack.pop());
  }

  // ─────────────────────────────────────────────
  // SHAPES
  // ─────────────────────────────────────────────
  function addShape(type) {
    // Look in math SHAPE_DEFS first, then science SCIENCE_SHAPE_DEFS
    let def = SHAPE_DEFS[type];
    if (!def && typeof ScienceShapes !== 'undefined' && ScienceShapes.isScienceShape(type)) {
      def = ScienceShapes.SCIENCE_SHAPE_DEFS[type];
    }
    if (!def) return;
    saveHistory();
    const defW = def.w || (def.r ? def.r * 2 : null) || def.length || def.side || 100;
    const defH = def.h || (def.r ? def.r * 2 : null) || def.d2 || def.side || 80;
    const s = {
      id: Date.now(), type,
      x:  W/2 - defW/2,
      y:  H/2 - defH/2,
      color: App.currentColor,
      ...JSON.parse(JSON.stringify(def))
    };
    if (type === 'square') s.h = s.w;
    shapes.push(s);
    selectShape(s);
    renderShapes();
    UI.updateStatus();
  }

  function addShapeObject(s) {
    saveHistory();
    shapes.push(s);
    selectShape(s);
    renderShapes();
    UI.updateStatus();
  }

  function addImageShape(dataUrl, x, y, w, h, name) {
    saveHistory();
    const sz = getCanvasSize ? getCanvasSize() : { W: 1200, H: 800 };
    const imgW = w || 560;
    const imgH = h || 340;
    const posX = (x !== undefined && x !== null) ? x : Math.round((sz.W - imgW) / 2);
    const posY = (y !== undefined && y !== null) ? y : Math.round((sz.H - imgH) / 2);
    const s = {
      id: Date.now(),
      type: 'image',
      src: dataUrl,
      fileName: name || 'Simulation Diagram',
      x: posX,
      y: posY,
      w: imgW,
      h: imgH,
      selected: true
    };
    shapes.push(s);
    selectShape(s);
    renderShapes();
    UI.updateStatus();
    if (typeof App !== 'undefined' && App.setTool) App.setTool('select');
  }

  function addTextShape(x, y, text, color, fontSize) {
    saveHistory();
    const s = { id:Date.now(), type:'text-block', x, y, text, color, fontSize:fontSize||18, selected:false };
    shapes.push(s);
    selectShape(s);
    renderShapes();
    UI.updateStatus();
  }

  function setShapes(newShapes) {
    shapes = newShapes || [];
    if (selected && !shapes.some(s => s.id === selected.id)) {
      selected = null;
    }
    renderShapes();
    UI.updateStatus();
  }

  function deleteShape() {
    if (!selected) return;
    saveHistory();
    shapes = shapes.filter(s => s.id !== selected.id);
    selected = null;
    renderShapes();
    UI.updateStatus();
    UI.hidePropPanel();
    updateFloatingToolbar();
    document.getElementById('formula-badge')?.classList.add('hidden');
  }

  function selectShape(s) {
    shapes.forEach(sh => sh.selected = false);
    if (s) {
      s.selected = true;
      selected = s;
      if (s.type === 'table' && typeof TableTool !== 'undefined') {
        TableTool.showTableContextToolbar(s);
        if (typeof StickyNotesTool !== 'undefined') StickyNotesTool.hideNoteContextToolbar();
      } else if (s.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
        StickyNotesTool.showNoteContextToolbar(s);
        if (typeof TableTool !== 'undefined') TableTool.hideTableContextToolbar();
      } else {
        if (typeof TableTool !== 'undefined') TableTool.hideTableContextToolbar();
        if (typeof StickyNotesTool !== 'undefined') StickyNotesTool.hideNoteContextToolbar();
      }
    } else {
      selected = null;
      if (typeof TableTool !== 'undefined') {
        TableTool.hideTableContextToolbar();
        TableTool.closeInlineEditor();
      }
      if (typeof StickyNotesTool !== 'undefined') {
        StickyNotesTool.hideNoteContextToolbar();
        StickyNotesTool.closeInlineEditor();
      }
    }
    renderShapes();
    UI.showPropPanel(selected);
    updateFloatingToolbar();
  }

  function deselectAll() {
    selectShape(null);
    UI.hidePropPanel();
    updateFloatingToolbar();
    if (typeof TableTool !== 'undefined') TableTool.hideTableContextToolbar();
    if (typeof StickyNotesTool !== 'undefined') StickyNotesTool.hideNoteContextToolbar();
  }

  function updateProp(key, value) {
    if (!selected) return;
    selected[key] = value;
    if (selected.type === 'square') {
      if (key === 'w') selected.h = value;
      if (key === 'h') selected.w = value;
    }
    renderShapes();
  }

  function clearAll() {
    saveHistory();
    shapes = []; selected = null;
    drawCtx.clearRect(0, 0, W, H);
    renderShapes(); UI.updateStatus(); UI.hidePropPanel();
  }

  // ─────────────────────────────────────────────
  // HIT TEST — SmartBoard touch target (24px padding)
  // ─────────────────────────────────────────────
  function hitTest(x, y, padding) {
    const p = padding !== undefined ? padding : 24;
    for (let i = shapes.length-1; i >= 0; i--) {
      const b = Shapes.getBounds(shapes[i]);
      if (x >= b.x-p && x <= b.x+b.w+p && y >= b.y-p && y <= b.y+b.h+p)
        return shapes[i];
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // POSITION HELPERS (Zoom & Pan Scale-Aware)
  // ─────────────────────────────────────────────
  function getPosFromEvent(e) {
    const sc = document.getElementById('shape-canvas');
    const r  = sc.getBoundingClientRect();
    const scaleX = sc.width / r.width || 1;
    const scaleY = sc.height / r.height || 1;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  function getPosFromTouch(touch) {
    const sc = document.getElementById('shape-canvas');
    const r  = sc.getBoundingClientRect();
    const scaleX = sc.width / r.width || 1;
    const scaleY = sc.height / r.height || 1;
    return { x: (touch.clientX - r.left) * scaleX, y: (touch.clientY - r.top) * scaleY };
  }

  // ─────────────────────────────────────────────
  // ZOOM & PAN LOGIC
  // ─────────────────────────────────────────────
  function applyZoomTransform() {
    const vp = document.getElementById('canvas-viewport');
    if (vp) {
      vp.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
    const lbl = document.getElementById('zoom-percentage-label');
    if (lbl) {
      lbl.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
    drawGrid();
  }

  function setZoom(newZoom, originScreenX, originScreenY) {
    const oldZoom = zoomLevel;
    newZoom = Math.max(0.25, Math.min(3.0, newZoom));
    if (Math.abs(newZoom - oldZoom) < 0.005) return;

    const zone = document.getElementById('canvas-zone');
    const ox = (originScreenX !== undefined) ? originScreenX : (zone ? zone.offsetWidth / 2 : 0);
    const oy = (originScreenY !== undefined) ? originScreenY : (zone ? zone.offsetHeight / 2 : 0);

    panX = ox - (ox - panX) * (newZoom / oldZoom);
    panY = oy - (oy - panY) * (newZoom / oldZoom);

    if (newZoom === 1.0 && originScreenX === undefined) {
      panX = 0;
      panY = 0;
    }

    zoomLevel = newZoom;
    applyZoomTransform();
  }

  function zoomIn() {
    const current = zoomLevel;
    const next = ZOOM_STEPS.find(s => s > current + 0.02) || 3.0;
    setZoom(next);
  }

  function zoomOut() {
    const current = zoomLevel;
    const prev = [...ZOOM_STEPS].reverse().find(s => s < current - 0.02) || 0.25;
    setZoom(prev);
  }

  function resetZoom() {
    panX = 0;
    panY = 0;
    setZoom(1.0);
  }

  function getZoom() {
    return zoomLevel;
  }

  // ─────────────────────────────────────────────
  // MOUSE HANDLERS
  // ─────────────────────────────────────────────
  function onPointerDown(e) {
    if (isSpaceDown || e.button === 1) {
      isPanning = true;
      panStart = { x: e.clientX - panX, y: e.clientY - panY };
      const zone = document.getElementById('canvas-zone');
      if (zone) zone.style.cursor = 'grabbing';
      return;
    }
    handleDown(getPosFromEvent(e));
  }
  function onPointerMove(e) {
    if (isPanning) {
      panX = e.clientX - panStart.x;
      panY = e.clientY - panStart.y;
      applyZoomTransform();
      return;
    }
    handleMove(getPosFromEvent(e));
  }
  function onPointerUp(e) {
    if (isPanning) {
      isPanning = false;
      const zone = document.getElementById('canvas-zone');
      if (zone) zone.style.cursor = isSpaceDown ? 'grab' : '';
      return;
    }
    handleUp(getPosFromEvent(e));
  }
  function onDblClick(e) {
    const pos = getPosFromEvent(e);
    const hit = hitTest(pos.x, pos.y, 16);
    if (hit && hit.type === 'text-block') {
      selectShape(hit);
      Drawing.editText(hit);
    } else if (hit && hit.type === 'table' && typeof TableTool !== 'undefined') {
      selectShape(hit);
      const cellHit = TableTool.hitTest(hit, pos.x, pos.y);
      if (cellHit && cellHit.type === 'cell') {
        TableTool.editCell(hit, cellHit.r, cellHit.c);
      }
    } else if (hit && hit.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
      selectShape(hit);
      StickyNotesTool.editNote(hit);
    }
  }
  function onCursorPos(e) {
    const pos = getPosFromEvent(e);
    const sb  = document.getElementById('sb-pos');
    if (sb) sb.innerHTML = `x:<b>${Math.round(pos.x)}</b> y:<b>${Math.round(pos.y)}</b>`;
  }

  // ─────────────────────────────────────────────
  // TWO-FINGER MULTI-TOUCH PAN & PINCH-ZOOM
  // ─────────────────────────────────────────────
  let twoFingerActive = false;
  let twoFingerStartDist = 0;
  let twoFingerStartZoom = 1.0;
  let twoFingerStartMid = { x: 0, y: 0 };
  let twoFingerStartPan = { x: 0, y: 0 };

  function handleTwoFingerTouchStart(e) {
    if (e.touches.length !== 2) return;
    twoFingerActive = true;
    const t1 = e.touches[0], t2 = e.touches[1];
    twoFingerStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
    twoFingerStartZoom = zoomLevel;
    twoFingerStartMid = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
    twoFingerStartPan = { x: panX, y: panY };
  }

  function handleTwoFingerTouchMove(e) {
    if (!twoFingerActive || e.touches.length !== 2) return;
    const t1 = e.touches[0], t2 = e.touches[1];
    const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
    const currentMid = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };

    // Calculate pinch scale
    const scale = currentDist / twoFingerStartDist;
    const targetZoom = Math.max(0.25, Math.min(3.0, twoFingerStartZoom * scale));

    // Calculate pan delta
    const deltaX = currentMid.x - twoFingerStartMid.x;
    const deltaY = currentMid.y - twoFingerStartMid.y;

    // Apply zoom anchored to the two-finger midpoint
    const zone = document.getElementById('canvas-zone');
    const rect = zone ? zone.getBoundingClientRect() : { left: 0, top: 0 };
    const ox = twoFingerStartMid.x - rect.left;
    const oy = twoFingerStartMid.y - rect.top;

    panX = ox - (ox - twoFingerStartPan.x) * (targetZoom / twoFingerStartZoom) + deltaX;
    panY = oy - (oy - twoFingerStartPan.y) * (targetZoom / twoFingerStartZoom) + deltaY;
    zoomLevel = targetZoom;

    applyZoomTransform();
  }

  function handleTwoFingerTouchEnd(e) {
    if (twoFingerActive && e.touches.length < 2) {
      twoFingerActive = false;
    }
  }

  // ─────────────────────────────────────────────
  // TOUCH HANDLERS — Zero-lag touch & multi-touch
  // ─────────────────────────────────────────────
  function onTouchStart(e) {
    // 3+ fingers gesture eraser check
    if (e.touches.length >= 3 && typeof GestureEraser !== 'undefined') {
      e.preventDefault();
      GestureEraser.handleTouchStart(e, getPosFromTouch);
      return;
    }
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      e.preventDefault();
      GestureEraser.handleTouchStart(e, getPosFromTouch);
      return;
    }

    // 2 fingers smooth pan & pinch-zoom
    if (e.touches.length === 2) {
      e.preventDefault();
      if (typeof Drawing !== 'undefined') Drawing.touchEnd();
      handleTwoFingerTouchStart(e);
      return;
    }

    const tool = App.currentTool;

    // Single finger
    if (e.touches.length === 1) {
      e.preventDefault(); // Eliminate browser 300ms tap delay & scrolling conflict
      const t   = e.touches[0];
      const pos = getPosFromTouch(t);

      // Detect double-tap (for editing text) — 50px threshold for 65" touch
      const now = Date.now();
      if (lastTapPos && now - lastTap < 350
          && Math.abs(pos.x - lastTapPos.x) < 50
          && Math.abs(pos.y - lastTapPos.y) < 50) {
        // Double tap
        const hit = hitTest(pos.x, pos.y, 28);
        if (hit && hit.type === 'text-block') {
          selectShape(hit);
          Drawing.editText(hit);
          lastTap = 0; lastTapPos = null;
          return;
        } else if (hit && hit.type === 'table' && typeof TableTool !== 'undefined') {
          selectShape(hit);
          const cellHit = TableTool.hitTest(hit, pos.x, pos.y);
          if (cellHit && cellHit.type === 'cell') {
            TableTool.editCell(hit, cellHit.r, cellHit.c);
          }
          lastTap = 0; lastTapPos = null;
          return;
        } else if (hit && hit.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
          selectShape(hit);
          StickyNotesTool.editNote(hit);
          lastTap = 0; lastTapPos = null;
          return;
        }
      }
      lastTap    = now;
      lastTapPos = pos;

      // Pen / highlighter / eraser — pass to Drawing
      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
        Drawing.touchStart(t);
        return;
      }

      handleDown(pos);
    }
  }

  function onTouchMove(e) {
    if (typeof GestureEraser !== 'undefined' && (GestureEraser.isActive() || e.touches.length >= 3)) {
      e.preventDefault();
      GestureEraser.handleTouchMove(e, getPosFromTouch);
      return;
    }

    if (e.touches.length === 2) {
      e.preventDefault();
      handleTwoFingerTouchMove(e);
      return;
    }

    const tool = App.currentTool;
    if (e.touches.length === 1) {
      e.preventDefault(); // Stop touch scroll emulation
      const t   = e.touches[0];
      const pos = getPosFromTouch(t);
      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
        Drawing.touchMove(t);
        return;
      }
      handleMove(pos);
    }
  }

  function onTouchEnd(e) {
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      e.preventDefault();
      GestureEraser.handleTouchEnd(e);
      return;
    }

    if (twoFingerActive) {
      handleTwoFingerTouchEnd(e);
    }

    const tool = App.currentTool;
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      Drawing.touchEnd();
      return;
    }
    if (e.changedTouches.length === 1) {
      handleUp(getPosFromTouch(e.changedTouches[0]));
    }
  }

  function onTouchCancel(e) {
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      GestureEraser.handleTouchCancel(e);
    }
    twoFingerActive = false;
    if (typeof SmartDrawing !== 'undefined') {
      SmartDrawing.clearStrokePreview();
    }
    Drawing.touchEnd();
    resizing  = null;
    dragging  = null;
    lineStart = null;
    draggingTableDivider = null;
    rotatingStickyNote = null;
    cellClickCandidate = null;
  }

  // ─────────────────────────────────────────────
  // SHARED DOWN / MOVE / UP LOGIC
  // ─────────────────────────────────────────────
  function handleDown(pos) {
    const tool = App.currentTool;

    if (typeof SmartDrawing !== 'undefined' && tool === 'smart-draw') {
      SmartDrawing.onDown(pos);
      return;
    }

    if (typeof GeometryTool !== 'undefined' && ['measure-line', 'measure-angle', 'compass'].includes(tool)) {
      GeometryTool.handleDown(pos, tool);
      return;
    }

    // Direct tool placement for Table and Sticky Notes
    if (tool === 'table') {
      if (typeof TableTool !== 'undefined') {
        TableTool.openCreateModal(pos.x, pos.y);
        App.setTool('select');
      }
      return;
    }
    if (tool === 'sticky' || tool === 'stickyNote') {
      if (typeof StickyNotesTool !== 'undefined') {
        const note = StickyNotesTool.createStickyNote(pos.x - 110, pos.y - 110);
        addShapeObject(note);
        selectShape(note);
        App.setTool('select');
        StickyNotesTool.editNote(note);
      }
      return;
    }

    // Check sticky note rotation stem knob when sticky note is selected
    if (selected && selected.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
      const sHit = StickyNotesTool.hitTest(selected, pos.x, pos.y);
      if (sHit && sHit.type === 'rotate') {
        const cx = selected.x + selected.w / 2;
        const cy = selected.y + selected.h / 2;
        const startAng = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI;
        rotatingStickyNote = {
          note: selected,
          cx, cy,
          startAngle: startAng,
          origRot: selected.rotation || 0
        };
        return;
      }
    }

    // Check table divider dragging or move handle when table is selected
    if (selected && selected.type === 'table' && typeof TableTool !== 'undefined') {
      const tHit = TableTool.hitTest(selected, pos.x, pos.y);
      if (tHit) {
        if (tHit.type === 'col-divider') {
          draggingTableDivider = {
            table: selected,
            type: 'col',
            colIndex: tHit.colIndex,
            startX: pos.x,
            origWidths: [...selected.colWidths]
          };
          return;
        } else if (tHit.type === 'row-divider') {
          draggingTableDivider = {
            table: selected,
            type: 'row',
            rowIndex: tHit.rowIndex,
            startY: pos.y,
            origHeights: [...selected.rowHeights]
          };
          return;
        } else if (tHit.type === 'move-handle') {
          dragging = selected;
          dragOff = { x: pos.x - selected.x, y: pos.y - selected.y };
          return;
        } else if (tHit.type === 'cell') {
          selected.selectedCells = [{ r: tHit.r, c: tHit.c }];
          TableTool.showTableContextToolbar(selected);
          renderShapes();

          if (tool === 'text') {
            TableTool.editCell(selected, tHit.r, tHit.c);
            return;
          }

          cellClickCandidate = { table: selected, r: tHit.r, c: tHit.c, startX: pos.x, startY: pos.y };
          dragging = selected;
          dragOff = { x: pos.x - selected.x, y: pos.y - selected.y };
          return;
        }
      }
    }

    // 1. Check if clicking on resize handles of the selected shape (22px touch target)
    if (selected) {
      const handle = Shapes.getHandleAt(selected, pos.x, pos.y, 22);
      if (handle) {
        resizing = {
          shape: selected,
          handle: handle.id,
          startPos: pos,
          origX: selected.x,
          origY: selected.y,
          origW: selected.w || 80,
          origH: selected.h || 40,
          origFontSize: selected.fontSize || 18,
          origR: selected.r,
          origSide: selected.side,
          origBase: selected.base,
          origHeight: selected.height,
          origProps: JSON.parse(JSON.stringify(selected))
        };
        return;
      }
    }

    // 2. Line tools
    if (tool === 'line' || tool === 'dashed' || tool === 'dotted' ||
        tool === 'arrow' || tool === 'dbl-arrow') {
      lineStart = pos; return;
    }

    // 3. Shape hit test
    const hit = hitTest(pos.x, pos.y, 20);

    if (tool === 'text') {
      if (hit && hit.type === 'text-block') {
        selectShape(hit);
        Drawing.editText(hit);
        return;
      } else if (hit && hit.type === 'table' && typeof TableTool !== 'undefined') {
        selectShape(hit);
        const tHit = TableTool.hitTest(hit, pos.x, pos.y);
        const r = (tHit && tHit.type === 'cell') ? tHit.r : 0;
        const c = (tHit && tHit.type === 'cell') ? tHit.c : 0;
        hit.selectedCells = [{ r, c }];
        TableTool.editCell(hit, r, c);
        return;
      } else if (hit && hit.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
        selectShape(hit);
        StickyNotesTool.editNote(hit);
        return;
      } else if (!hit) {
        deselectAll();
        Drawing.placeText(pos.x, pos.y);
        return;
      }
    }

    if (tool === 'select' || hit) {
      if (hit) {
        selectShape(hit);
        dragging = hit;
        dragOff  = { x: pos.x - hit.x, y: pos.y - hit.y };
        if (hit.type === 'table' && typeof TableTool !== 'undefined') {
          const tHit = TableTool.hitTest(hit, pos.x, pos.y);
          if (tHit && tHit.type === 'cell') {
            hit.selectedCells = [{ r: tHit.r, c: tHit.c }];
            TableTool.showTableContextToolbar(hit);
            renderShapes();
            cellClickCandidate = { table: hit, r: tHit.r, c: tHit.c, startX: pos.x, startY: pos.y };
          }
        }
      } else {
        deselectAll();
      }
    }
  }

  function handleMove(pos) {
    const tool = App.currentTool;

    if (cellClickCandidate && Math.hypot(pos.x - cellClickCandidate.startX, pos.y - cellClickCandidate.startY) > 6) {
      cellClickCandidate = null;
    }

    if (typeof SmartDrawing !== 'undefined' && tool === 'smart-draw') {
      SmartDrawing.onMove(pos);
      return;
    }

    if (typeof GeometryTool !== 'undefined' && ['measure-line', 'measure-angle', 'compass'].includes(tool)) {
      GeometryTool.handleMove(pos, tool);
      return;
    }

    // Rotate sticky note
    if (rotatingStickyNote) {
      const r = rotatingStickyNote;
      const curAng = Math.atan2(pos.y - r.cy, pos.x - r.cx) * 180 / Math.PI;
      let diff = curAng - r.startAngle;
      let newRot = Math.round((r.origRot + diff) % 360);
      [0, 90, -90, 180, -180, 270, 360].forEach(snap => {
        if (Math.abs(newRot - snap) < 4) newRot = (snap === 360 ? 0 : snap);
      });
      r.note.rotation = newRot;
      renderShapes();
      if (typeof StickyNotesTool !== 'undefined') StickyNotesTool.showNoteContextToolbar(r.note);
      return;
    }

    // Drag table column / row divider
    if (draggingTableDivider) {
      const d = draggingTableDivider;
      if (d.type === 'col') {
        const dx = pos.x - d.startX;
        const newW = Math.max(55, d.origWidths[d.colIndex] + dx);
        d.table.colWidths[d.colIndex] = Math.round(newW);
        d.table.w = d.table.colWidths.reduce((a, b) => a + b, 0);
      } else if (d.type === 'row') {
        const dy = pos.y - d.startY;
        const newH = Math.max(38, d.origHeights[d.rowIndex] + dy);
        d.table.rowHeights[d.rowIndex] = Math.round(newH);
        d.table.h = d.table.rowHeights.reduce((a, b) => a + b, 0);
      }
      renderShapes();
      if (typeof TableTool !== 'undefined') TableTool.showTableContextToolbar(d.table);
      return;
    }

    if (resizing) {
      const dx = pos.x - resizing.startPos.x;
      const dy = pos.y - resizing.startPos.y;
      const s  = resizing.shape;
      const hId = resizing.handle;

      if (s.type === 'table') {
        let newW = resizing.origW;
        let newH = resizing.origH;
        if (hId.includes('r')) newW = Math.max(s.cols * 55, resizing.origW + dx);
        if (hId.includes('l')) {
          newW = Math.max(s.cols * 55, resizing.origW - dx);
          s.x = resizing.origX + (resizing.origW - newW);
        }
        if (hId.includes('b')) newH = Math.max(s.rows * 38, resizing.origH + dy);
        if (hId.includes('t')) {
          newH = Math.max(s.rows * 38, resizing.origH - dy);
          s.y = resizing.origY + (resizing.origH - newH);
        }
        const scaleX = newW / Math.max(1, resizing.origW);
        const scaleY = newH / Math.max(1, resizing.origH);
        if (resizing.origProps.colWidths) {
          s.colWidths = resizing.origProps.colWidths.map(w => Math.max(50, Math.round(w * scaleX)));
          s.w = s.colWidths.reduce((a, b) => a + b, 0);
        }
        if (resizing.origProps.rowHeights) {
          s.rowHeights = resizing.origProps.rowHeights.map(h => Math.max(35, Math.round(h * scaleY)));
          s.h = s.rowHeights.reduce((a, b) => a + b, 0);
        }
        renderShapes();
        if (typeof TableTool !== 'undefined') TableTool.showTableContextToolbar(s);
        return;
      } else if (s.type === 'stickyNote') {
        let newW = resizing.origW;
        let newH = resizing.origH;
        if (hId.includes('r')) newW = Math.max(120, resizing.origW + dx);
        if (hId.includes('l')) {
          newW = Math.max(120, resizing.origW - dx);
          s.x = resizing.origX + dx;
        }
        if (hId.includes('b')) newH = Math.max(100, resizing.origH + dy);
        if (hId.includes('t')) {
          newH = Math.max(100, resizing.origH - dy);
          s.y = resizing.origY + dy;
        }
        s.w = newW;
        s.h = newH;
        renderShapes();
        if (typeof StickyNotesTool !== 'undefined') StickyNotesTool.showNoteContextToolbar(s);
        return;
      } else if (s.type === 'text-block') {
        const origSize = resizing.origFontSize;
        const origW = Math.max(resizing.origW, 40);
        let scale = 1;
        if (hId === 'br')      scale = (origW + dx) / origW;
        else if (hId === 'bl') scale = (origW - dx) / origW;
        else if (hId === 'tr') scale = (origW + dx) / origW;
        else if (hId === 'tl') scale = (origW - dx) / origW;
        else if (hId === 'mr') scale = (origW + dx) / origW;
        else if (hId === 'ml') scale = (origW - dx) / origW;
        else if (hId === 'bc') scale = (resizing.origH + dy) / Math.max(resizing.origH, 20);
        else if (hId === 'tc') scale = (resizing.origH - dy) / Math.max(resizing.origH, 20);

        s.fontSize = Math.max(8, Math.min(160, Math.round(origSize * Math.max(0.15, scale))));
        if (hId.includes('l')) s.x = resizing.origX + dx;
        if (hId.includes('t')) s.y = resizing.origY + dy;
      } else if (s.type === 'measured-line' || s.type === 'arrow') {
        if (hId === 'p1') { s.x1 = Math.round(pos.x); s.y1 = Math.round(pos.y); }
        if (hId === 'p2') { s.x2 = Math.round(pos.x); s.y2 = Math.round(pos.y); }
        s.x = Math.min(s.x1, s.x2);
        s.y = Math.min(s.y1, s.y2);
        s.w = Math.max(20, Math.abs(s.x2 - s.x1));
        s.h = Math.max(20, Math.abs(s.y2 - s.y1));
      } else if (s.type === 'measured-angle') {
        if (hId === 'v') { s.vx = Math.round(pos.x); s.vy = Math.round(pos.y); }
        if (hId === 'a') { s.ax = Math.round(pos.x); s.ay = Math.round(pos.y); }
        if (hId === 'b') { s.bx = Math.round(pos.x); s.by = Math.round(pos.y); }
        const angA = Math.atan2(s.ay - s.vy, s.ax - s.vx);
        const angB = Math.atan2(s.by - s.vy, s.bx - s.vx);
        let diff = Math.abs((angB - angA) * 180 / Math.PI);
        if (diff > 180) diff = 360 - diff;
        s.degrees = +(diff.toFixed(1));
        s.x = Math.min(s.vx, s.ax, s.bx);
        s.y = Math.min(s.vy, s.ay, s.by);
        s.w = Math.max(20, Math.max(s.vx, s.ax, s.bx) - s.x);
        s.h = Math.max(20, Math.max(s.vy, s.ay, s.by) - s.y);
      } else if (s.type === 'measured-circle') {
        if (hId === 'r_edge') {
          s.r = Math.max(10, Math.round(Math.hypot(pos.x - s.cx, pos.y - s.cy)));
        } else {
          const delta = (hId.includes('r') ? dx : -dx) + (hId.includes('b') ? dy : -dy);
          s.r = Math.max(10, Math.round(resizing.origR + delta / 2));
        }
        s.label = (typeof GeometryTool !== 'undefined') ? `r = ${GeometryTool.formatLength(s.r)}` : `r = ${(s.r * 0.1).toFixed(2)} cm`;
        s.x = s.cx - s.r;
        s.y = s.cy - s.r;
        s.w = s.r * 2;
        s.h = s.r * 2;
      } else {
        if (s.w !== undefined) {
          if (hId.includes('r')) s.w = Math.max(15, resizing.origW + dx);
          if (hId.includes('l')) { s.w = Math.max(15, resizing.origW - dx); s.x = resizing.origX + dx; }
        }
        if (s.h !== undefined) {
          if (hId.includes('b')) s.h = Math.max(15, (resizing.origH || resizing.origProps.h) + dy);
          if (hId.includes('t')) { s.h = Math.max(15, (resizing.origH || resizing.origProps.h) - dy); s.y = resizing.origY + dy; }
        }
        if (s.type === 'image' && ['tl','tr','bl','br'].includes(hId) && resizing.origW && resizing.origH) {
          const aspect = resizing.origW / resizing.origH;
          s.h = Math.max(15, Math.round(s.w / aspect));
        }
        if (s.type === 'square') s.h = s.w;
        if (s.side !== undefined) {
          const delta = (hId.includes('r') ? dx : -dx) + (hId.includes('b') ? dy : -dy);
          s.side = Math.max(15, Math.round(resizing.origSide + delta / 2));
        }
        if (s.r !== undefined) {
          const delta = (hId.includes('r') ? dx : -dx) + (hId.includes('b') ? dy : -dy);
          s.r = Math.max(8, Math.round(resizing.origR + delta / 2));
        }
        if (s.base !== undefined) {
          if (hId.includes('r')) s.base = Math.max(15, resizing.origBase + dx);
          if (hId.includes('l')) { s.base = Math.max(15, resizing.origBase - dx); s.x = resizing.origX + dx; }
        }
        if (s.height !== undefined) {
          if (hId.includes('b')) s.height = Math.max(15, resizing.origHeight + dy);
          if (hId.includes('t')) { s.height = Math.max(15, resizing.origHeight - dy); s.y = resizing.origY + dy; }
        }
      }
      renderShapes();
      updateFloatingToolbar();
      return;
    }

    if (dragging) {
      const newX = pos.x - dragOff.x;
      const newY = pos.y - dragOff.y;
      const dx = newX - dragging.x;
      const dy = newY - dragging.y;
      dragging.x = newX;
      dragging.y = newY;

      if (dragging.type === 'measured-line' || dragging.type === 'arrow') {
        dragging.x1 += dx; dragging.y1 += dy;
        dragging.x2 += dx; dragging.y2 += dy;
      } else if (dragging.type === 'measured-angle') {
        dragging.vx += dx; dragging.vy += dy;
        dragging.ax += dx; dragging.ay += dy;
        dragging.bx += dx; dragging.by += dy;
      } else if (dragging.type === 'measured-circle') {
        dragging.cx += dx; dragging.cy += dy;
      } else if (dragging.type === 'polygon' && dragging.points) {
        dragging.points.forEach(p => { p.x += dx; p.y += dy; });
      }

      renderShapes();
      updateFloatingToolbar();
      if (dragging.type === 'table' && typeof TableTool !== 'undefined') {
        TableTool.showTableContextToolbar(dragging);
      } else if (dragging.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
        StickyNotesTool.showNoteContextToolbar(dragging);
      }
      return;
    }

    // Dynamic hover cursors
    const sc = document.getElementById('shape-canvas');
    if (selected && sc) {
      if (selected.type === 'table' && typeof TableTool !== 'undefined') {
        const tHit = TableTool.hitTest(selected, pos.x, pos.y);
        if (tHit) {
          if (tHit.type === 'col-divider') { sc.style.cursor = 'col-resize'; return; }
          if (tHit.type === 'row-divider') { sc.style.cursor = 'row-resize'; return; }
          if (tHit.type === 'move-handle') { sc.style.cursor = 'grab'; return; }
          if (tHit.type === 'handle') { sc.style.cursor = tHit.cursor; return; }
        }
      }
      if (selected.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
        const sHit = StickyNotesTool.hitTest(selected, pos.x, pos.y);
        if (sHit) {
          if (sHit.type === 'rotate') { sc.style.cursor = 'crosshair'; return; }
          if (sHit.type === 'handle') { sc.style.cursor = sHit.cursor; return; }
        }
      }

      const h = Shapes.getHandleAt(selected, pos.x, pos.y, 22);
      if (h) {
        sc.style.cursor = h.cursor;
        return;
      }
      const hit = hitTest(pos.x, pos.y, 24);
      if (hit && hit === selected) {
        sc.style.cursor = 'move';
        return;
      }
    }
    if (sc) {
      const tool = App.currentTool;
      sc.style.cursor = (tool === 'select') ? 'default' : (tool === 'text' ? 'text' : 'crosshair');
    }

    if (lineStart && (tool === 'line' || tool === 'dashed' || tool === 'dotted' ||
        tool === 'arrow' || tool === 'dbl-arrow')) {
      Drawing.previewLine(lineStart, pos);
    }
  }

  function handleUp(pos) {
    const tool = App.currentTool;

    if (cellClickCandidate) {
      const cand = cellClickCandidate;
      cellClickCandidate = null;
      dragging = null;
      TableTool.editCell(cand.table, cand.r, cand.c);
      return;
    }

    if (typeof SmartDrawing !== 'undefined' && tool === 'smart-draw') {
      SmartDrawing.onUp(pos);
      return;
    }

    if (typeof GeometryTool !== 'undefined' && ['measure-line', 'measure-angle', 'compass'].includes(tool)) {
      GeometryTool.handleUp(pos, tool);
      return;
    }

    if (rotatingStickyNote) {
      saveHistory();
      rotatingStickyNote = null;
      renderShapes();
    }

    if (draggingTableDivider) {
      saveHistory();
      draggingTableDivider = null;
      renderShapes();
    }

    if (resizing) {
      saveHistory();
      resizing = null;
      UI.showPropPanel(selected);
      updateFloatingToolbar();
    }
    if (dragging) {
      saveHistory();
      dragging = null;
      UI.showPropPanel(selected);
      updateFloatingToolbar();
    }
    if (lineStart) {
      Drawing.commitLine(lineStart, pos, App.currentTool);
      lineStart = null;
    }
  }

  // ─────────────────────────────────────────────
  // SERIALISE / SNAPSHOT
  // ─────────────────────────────────────────────
  function getShapes()   { return JSON.parse(JSON.stringify(shapes)); }
  function getDrawData() {
    try { return drawCtx.getImageData(0, 0, W, H); } catch(e) { return null; }
  }
  // Returns draw canvas as a base64 PNG string — safe to JSON-serialize
  function getDrawDataUrl() {
    try {
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(drawCtx.getImageData(0, 0, W, H), 0, 0);
      return tmp.toDataURL('image/png');
    } catch(e) { return null; }
  }
  function loadPageState(savedShapes, savedDrawData, savedBgImage) {
    shapes = savedShapes ? JSON.parse(JSON.stringify(savedShapes)) : [];
    selected = null; history = []; redoStack = [];
    setBgImage(savedBgImage || null);
    drawCtx.clearRect(0, 0, W, H);
    if (savedDrawData) {
      // Support both raw ImageData (in-memory page switch) and base64 string (loaded from file)
      if (typeof savedDrawData === 'string') {
        const img = new Image();
        img.onload = () => drawCtx.drawImage(img, 0, 0);
        img.src = savedDrawData;
      } else {
        try { drawCtx.putImageData(savedDrawData, 0, 0); } catch(e){}
      }
    }
    renderShapes();
  }
  function getState()       { return { shapes, boardColorId: currentBoardColor.id, bgImage: currentBgImage }; }
  function loadState(state) {
    shapes = state.shapes || []; selected = null;
    if (state.boardColorId) setBoardColor(state.boardColorId);
    if (state.bgImage) setBgImage(state.bgImage);
    renderShapes(); UI.updateStatus();
  }
  function drawBaseGridOn(targetCtx, width, height) {
    targetCtx.fillStyle = currentBoardColor.bg;
    targetCtx.fillRect(0, 0, width, height);

    if (bgImageObj && bgImageObj.complete && bgImageObj.naturalWidth > 0) {
      const imgW = bgImageObj.naturalWidth;
      const imgH = bgImageObj.naturalHeight;
      const scale = Math.min(width / imgW, height / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      targetCtx.drawImage(bgImageObj, dx, dy, dw, dh);
    } else {
      const colors = (currentBoardColor.line && currentBoardColor.major)
        ? { line: currentBoardColor.line, major: currentBoardColor.major }
        : getGridColors(currentBoardColor.bg);

      const step = 32;
      const majorStep = step * 5;

      targetCtx.save();
      targetCtx.lineWidth = 1;

      targetCtx.beginPath();
      targetCtx.strokeStyle = colors.line;
      for (let x = step; x < width; x += step) {
        if (x % majorStep !== 0) {
          const px = Math.floor(x) + 0.5;
          targetCtx.moveTo(px, 0);
          targetCtx.lineTo(px, height);
        }
      }
      for (let y = step; y < height; y += step) {
        if (y % majorStep !== 0) {
          const py = Math.floor(y) + 0.5;
          targetCtx.moveTo(0, py);
          targetCtx.lineTo(width, py);
        }
      }
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.strokeStyle = colors.major;
      for (let x = majorStep; x < width; x += majorStep) {
        const px = Math.floor(x) + 0.5;
        targetCtx.moveTo(px, 0);
        targetCtx.lineTo(px, height);
      }
      for (let y = majorStep; y < height; y += majorStep) {
        const py = Math.floor(y) + 0.5;
        targetCtx.moveTo(0, py);
        targetCtx.lineTo(width, py);
      }
      targetCtx.stroke();
      targetCtx.restore();
    }
  }

  function snapshot() {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    drawBaseGridOn(ctx, W, H);
    try { ctx.drawImage(document.getElementById('shape-canvas'), 0, 0); } catch(e) {}
    try { ctx.drawImage(document.getElementById('draw-canvas'), 0, 0); } catch(e) {}
    try { return out.toDataURL('image/png'); } catch(e) { return ''; }
  }

  // JPEG version for PDF export (smaller, reliable)
  function snapshotJpeg() {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    // White bg fallback for JPEG (no transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    drawBaseGridOn(ctx, W, H);
    try { ctx.drawImage(document.getElementById('shape-canvas'), 0, 0); } catch(e) {}
    try { ctx.drawImage(document.getElementById('draw-canvas'), 0, 0); } catch(e) {}
    try { return out.toDataURL('image/jpeg', 0.92); } catch(e) { return ''; }
  }

  function getShapeCount() { return shapes.length; }
  function getDrawCtx()    { return drawCtx; }
  function getCanvasSize() { return { W, H }; }

  return {
    init, resize, renderShapes, drawGrid, setBoardColor,
    setBgImage, getBgImage,
    addShape, addShapeObject, addImageShape, addTextShape, setShapes, selectShape, deselectAll, hitTest, deleteShape,
    updateProp, clearAll, undo, redo, saveHistory,
    getState, loadState, snapshot, snapshotJpeg,
    getShapeCount, getDrawCtx, getCanvasSize, getPosFromTouch, getPosFromEvent,
    getShapes, getDrawData, getDrawDataUrl, loadPageState,
    adjustFontSize, editSelectedText, nudgeSelected, updateFloatingToolbar,
    setTextFontFamily, setTextFontSize, toggleTextBold, cycleTextAlign,
    toggleTextList, promptTextLink, setTextColor, toggleTextHighlight,
    cycleTextOpacity, promptTextComment, toggleTextLock, convertTextMath,
    toggleTextMoreMenu, duplicateSelectedText, copySelectedText, bringTextToFront,
    showToolbarForTextTool, getSelected: () => selected,
    getBoardColorId: () => currentBoardColor.id, getBoardColor: () => currentBoardColor,
    zoomIn, zoomOut, resetZoom, setZoom, getZoom,
    handleTwoFingerTouchStart, handleTwoFingerTouchMove, handleTwoFingerTouchEnd
  };
})();