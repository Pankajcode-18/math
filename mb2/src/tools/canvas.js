'use strict';

// ═══════════════════════════════════════════════
// CANVAS MANAGER — full touch + mouse support
// ═══════════════════════════════════════════════

const Canvas = (() => {

  const BOARD_COLORS = [
    { id:'green', bg:'#0a1f0a', dot:'rgba(255,255,255,0.07)' },
    { id:'black', bg:'#000000', dot:'rgba(255,255,255,0.06)' },
    { id:'navy',  bg:'#080f1f', dot:'rgba(201,168,76,0.08)'  },
    { id:'white', bg:'#ffffff', dot:'rgba(0,0,0,0.07)'       },
    { id:'cream', bg:'#fdf6e3', dot:'rgba(0,0,0,0.07)'       },
    { id:'slate', bg:'#0d1b2a', dot:'rgba(255,255,255,0.06)' },
  ];
  let currentBoardColor = BOARD_COLORS[0];

  let gridCtx, shapeCtx, drawCtx;
  let W = 0, H = 0;

  let shapes    = [];
  let history   = [];
  let redoStack = [];
  let selected  = null;
  let dragging  = null;
  let dragOff   = { x:0, y:0 };
  let lineStart = null;

  // Touch tap detection for double-tap (edit text)
  let lastTap = 0;
  let lastTapPos = null;

  // ─────────────────────────────────────────────
  function init() {
    gridCtx  = document.getElementById('grid-canvas').getContext('2d');
    shapeCtx = document.getElementById('shape-canvas').getContext('2d');
    drawCtx  = document.getElementById('draw-canvas').getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    const sc = document.getElementById('shape-canvas');

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

    drawGrid();
    renderShapes();
  }

  // ─────────────────────────────────────────────
  // RESIZE
  // ─────────────────────────────────────────────
  function resize() {
    const zone = document.getElementById('canvas-zone');
    W = zone.offsetWidth;
    H = zone.offsetHeight;
    ['grid-canvas','shape-canvas','draw-canvas','ui-canvas'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { c.width = W; c.height = H; }
    });
    const pc = document.getElementById('preview-canvas');
    if (pc) { pc.width = W; pc.height = H; }
    drawGrid();
    renderShapes();
  }

  // ─────────────────────────────────────────────
  // BOARD COLOR
  // ─────────────────────────────────────────────
  function setBoardColor(id, bg, dot) {
    currentBoardColor = { id, bg: bg||'#0a1f0a', dot: dot||'rgba(255,255,255,0.07)' };
    drawGrid();
  }

  // ─────────────────────────────────────────────
  // GRID
  // ─────────────────────────────────────────────
  function drawGrid() {
    gridCtx.clearRect(0, 0, W, H);
    gridCtx.fillStyle = currentBoardColor.bg;
    gridCtx.fillRect(0, 0, W, H);
    gridCtx.fillStyle = currentBoardColor.dot;
    const step = 36;
    for (let x = step; x < W; x += step)
      for (let y = step; y < H; y += step) {
        gridCtx.beginPath();
        gridCtx.arc(x, y, 1.3, 0, Math.PI*2);
        gridCtx.fill();
      }
    gridCtx.save();
    gridCtx.globalAlpha = 0.04;
    const logo = document.getElementById('brand-logo');
    if (logo && logo.complete) gridCtx.drawImage(logo, W-140, H-140, 120, 120);
    gridCtx.restore();
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  function renderShapes() {
    shapeCtx.clearRect(0, 0, W, H);
    shapes.forEach(s => Shapes.draw(shapeCtx, s));
    updateFormulaBadge();
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

  // ─────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────
  function saveHistory() {
    history.push(JSON.stringify(shapes));
    if (history.length > 60) history.shift();
    redoStack = [];
  }
  function undo() {
    if (!history.length) return;
    redoStack.push(JSON.stringify(shapes));
    shapes = JSON.parse(history.pop());
    selected = null; renderShapes(); UI.updateStatus(); UI.hidePropPanel();
  }
  function redo() {
    if (!redoStack.length) return;
    history.push(JSON.stringify(shapes));
    shapes = JSON.parse(redoStack.pop());
    selected = null; renderShapes(); UI.updateStatus();
  }

  // ─────────────────────────────────────────────
  // SHAPES
  // ─────────────────────────────────────────────
  function addShape(type) {
    const def = SHAPE_DEFS[type];
    if (!def) return;
    saveHistory();
    const s = {
      id: Date.now(), type,
      x:  W/2 - (def.w||def.r*2||def.length||def.side||100)/2,
      y:  H/2 - (def.h||def.r*2||def.d2||def.side||80)/2,
      color: App.currentColor,
      ...JSON.parse(JSON.stringify(def))
    };
    if (type === 'square') s.h = s.w;
    shapes.push(s);
    selectShape(s);
    renderShapes();
    UI.updateStatus();
  }

  function addTextShape(x, y, text, color, fontSize) {
    saveHistory();
    const s = { id:Date.now(), type:'text-block', x, y, text, color, fontSize:fontSize||18, selected:false };
    shapes.push(s);
    selectShape(s);
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
    document.getElementById('formula-badge')?.classList.add('hidden');
  }

  function selectShape(s) {
    shapes.forEach(sh => sh.selected = false);
    if (s) { s.selected = true; selected = s; }
    else selected = null;
    renderShapes();
    UI.showPropPanel(selected);
  }

  function deselectAll() { selectShape(null); UI.hidePropPanel(); }

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
  // HIT TEST — larger touch target (20px padding)
  // ─────────────────────────────────────────────
  function hitTest(x, y, padding) {
    const p = padding !== undefined ? padding : 14;
    for (let i = shapes.length-1; i >= 0; i--) {
      const b = Shapes.getBounds(shapes[i]);
      if (x >= b.x-p && x <= b.x+b.w+p && y >= b.y-p && y <= b.y+b.h+p)
        return shapes[i];
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // POSITION HELPERS
  // ─────────────────────────────────────────────
  function getPosFromEvent(e) {
    const sc = document.getElementById('shape-canvas');
    const r  = sc.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function getPosFromTouch(touch) {
    const sc = document.getElementById('shape-canvas');
    const r  = sc.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  // ─────────────────────────────────────────────
  // MOUSE HANDLERS
  // ─────────────────────────────────────────────
  function onPointerDown(e) {
    handleDown(getPosFromEvent(e));
  }
  function onPointerMove(e) {
    handleMove(getPosFromEvent(e));
  }
  function onPointerUp(e) {
    handleUp(getPosFromEvent(e));
  }
  function onDblClick(e) {
    const pos = getPosFromEvent(e);
    const hit = hitTest(pos.x, pos.y, 16);
    if (hit && hit.type === 'text-block') { selectShape(hit); Drawing.editText(hit); }
  }
  function onCursorPos(e) {
    const pos = getPosFromEvent(e);
    const sb  = document.getElementById('sb-pos');
    if (sb) sb.innerHTML = `x:<b>${Math.round(pos.x)}</b> y:<b>${Math.round(pos.y)}</b>`;
  }

  // ─────────────────────────────────────────────
  // TOUCH HANDLERS
  // ─────────────────────────────────────────────
  function onTouchStart(e) {
    const tool = App.currentTool;

    // Single finger
    if (e.touches.length === 1) {
      const t   = e.touches[0];
      const pos = getPosFromTouch(t);

      // Detect double-tap (for editing text)
      const now = Date.now();
      if (lastTapPos && now - lastTap < 320
          && Math.abs(pos.x - lastTapPos.x) < 30
          && Math.abs(pos.y - lastTapPos.y) < 30) {
        // Double tap
        const hit = hitTest(pos.x, pos.y, 20);
        if (hit && hit.type === 'text-block') {
          e.preventDefault();
          selectShape(hit);
          Drawing.editText(hit);
          lastTap = 0; lastTapPos = null;
          return;
        }
      }
      lastTap    = now;
      lastTapPos = pos;

      // Pen / highlighter / eraser — pass to Drawing
      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
        // Drawing handles its own touch on draw-canvas — but draw-canvas
        // has pointer-events:none when not in draw mode, so we route here
        Drawing.touchStart(t);
        return;
      }

      e.preventDefault();
      handleDown(pos);
    }
  }

  function onTouchMove(e) {
    const tool = App.currentTool;
    if (e.touches.length === 1) {
      const t   = e.touches[0];
      const pos = getPosFromTouch(t);
      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
        Drawing.touchMove(t); return;
      }
      e.preventDefault();
      handleMove(pos);
    }
  }

  function onTouchEnd(e) {
    const tool = App.currentTool;
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      Drawing.touchEnd(); return;
    }
    if (e.changedTouches.length === 1) {
      handleUp(getPosFromTouch(e.changedTouches[0]));
    }
  }

  function onTouchCancel(e) {
    Drawing.touchEnd();
    dragging  = null;
    lineStart = null;
  }

  // ─────────────────────────────────────────────
  // SHARED DOWN / MOVE / UP LOGIC
  // ─────────────────────────────────────────────
  function handleDown(pos) {
    const tool = App.currentTool;

    if (tool === 'text') {
      const hit = hitTest(pos.x, pos.y, 20);
      if (hit && hit.type === 'text-block') { selectShape(hit); Drawing.editText(hit); }
      else { deselectAll(); Drawing.placeText(pos.x, pos.y); }
      return;
    }

    if (tool === 'line' || tool === 'dashed' || tool === 'dotted' ||
        tool === 'arrow' || tool === 'dbl-arrow') {
      lineStart = pos; return;
    }

    if (tool === 'select') {
      const hit = hitTest(pos.x, pos.y, 20);
      if (hit) {
        selectShape(hit);
        dragging = hit;
        dragOff  = { x: pos.x - hit.x, y: pos.y - hit.y };
      } else {
        deselectAll();
      }
    }
  }

  function handleMove(pos) {
    if (dragging) {
      dragging.x = pos.x - dragOff.x;
      dragging.y = pos.y - dragOff.y;
      renderShapes();
    }
    const tool = App.currentTool;
    if (lineStart && (tool === 'line' || tool === 'dashed' || tool === 'dotted' ||
        tool === 'arrow' || tool === 'dbl-arrow')) {
      Drawing.previewLine(lineStart, pos);
    }
  }

  function handleUp(pos) {
    if (dragging) { saveHistory(); dragging = null; }
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
  function loadPageState(savedShapes, savedDrawData) {
    shapes = savedShapes ? JSON.parse(JSON.stringify(savedShapes)) : [];
    selected = null; history = []; redoStack = [];
    drawCtx.clearRect(0, 0, W, H);
    if (savedDrawData) { try { drawCtx.putImageData(savedDrawData, 0, 0); } catch(e){} }
    renderShapes();
  }
  function getState()       { return { shapes, boardColorId: currentBoardColor.id }; }
  function loadState(state) {
    shapes = state.shapes || []; selected = null;
    if (state.boardColorId) setBoardColor(state.boardColorId);
    renderShapes(); UI.updateStatus();
  }
  function snapshot() {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = currentBoardColor.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(document.getElementById('grid-canvas'),  0, 0);
    ctx.drawImage(document.getElementById('shape-canvas'), 0, 0);
    ctx.drawImage(document.getElementById('draw-canvas'),  0, 0);
    return out.toDataURL('image/png');
  }

  // JPEG version for PDF export (smaller, reliable)
  function snapshotJpeg() {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    // White bg fallback for JPEG (no transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = currentBoardColor.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(document.getElementById('grid-canvas'),  0, 0);
    ctx.drawImage(document.getElementById('shape-canvas'), 0, 0);
    ctx.drawImage(document.getElementById('draw-canvas'),  0, 0);
    return out.toDataURL('image/jpeg', 0.92);
  }

  function getShapeCount() { return shapes.length; }
  function getDrawCtx()    { return drawCtx; }
  function getCanvasSize() { return { W, H }; }

  return {
    init, resize, renderShapes, drawGrid, setBoardColor,
    addShape, addTextShape, selectShape, deselectAll, hitTest, deleteShape,
    updateProp, clearAll, undo, redo, saveHistory,
    getState, loadState, snapshot, snapshotJpeg,
    getShapeCount, getDrawCtx, getCanvasSize,
    getShapes, getDrawData, loadPageState
  };
})();