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

  // ── Angle measurement state ──
  let anglePoints = [];   // stores up to 3 {x,y} points
  let angleHover  = null; // current mouse/touch position for preview

  // ── Zoom / Pan state ──
  let scale        = 1;
  let panX         = 0;
  let panY         = 0;
  const MIN_SCALE  = 0.25;
  const MAX_SCALE  = 4.0;
  // Pinch
  let pinchDist0   = 0;
  let pinchScale0  = 1;

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
    sc.addEventListener('mousemove',  onCursorPos);
    sc.addEventListener('mouseup',    onPointerUp);
    sc.addEventListener('dblclick',   onDblClick);

    // ── Scroll wheel zoom ──
    sc.addEventListener('wheel', onWheel, { passive: false });

    // ── Touch events — ALL on shape canvas ──
    sc.addEventListener('touchstart',  onTouchStart,  { passive: false });
    sc.addEventListener('touchmove',   onTouchMove,   { passive: false });
    sc.addEventListener('touchend',    onTouchEnd,    { passive: false });
    sc.addEventListener('touchcancel', onTouchCancel, { passive: false });

    // ── Right panel zoom/delete buttons ──
    setTimeout(() => {
      const btnIn  = document.getElementById('zoom-in');
      const btnOut = document.getElementById('zoom-out');
      const btnRst = document.getElementById('zoom-reset');
      const btnDel = document.getElementById('rp-delete-btn');
      if (btnIn)  btnIn.addEventListener('click',    () => zoomBy(0.25));
      if (btnOut) btnOut.addEventListener('click',   () => zoomBy(-0.25));
      if (btnRst) btnRst.addEventListener('click',   () => zoomReset());
      if (btnDel) {
        btnDel.addEventListener('click',   () => deleteShape());
        btnDel.addEventListener('touchend', e => { e.preventDefault(); deleteShape(); });
      }
    }, 400);

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
  // ZOOM & PAN
  // ─────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    const rect  = document.getElementById('shape-canvas').getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    applyZoom(scale + delta, mx, my);
  }

  function zoomBy(delta) {
    applyZoom(scale + delta, W / 2, H / 2);
  }

  function zoomReset() {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
    updateZoomLabel();
  }

  function applyZoom(newScale, cx, cy) {
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    const factor = newScale / scale;
    panX = cx - factor * (cx - panX);
    panY = cy - factor * (cy - panY);
    scale = newScale;
    applyTransform();
    updateZoomLabel();
  }

  // Apply CSS transform to ALL canvases — pen, shapes, grid, everything zooms together
  function applyTransform() {
    const t = `translate(${panX}px,${panY}px) scale(${scale})`;
    ['grid-canvas','shape-canvas','draw-canvas','ui-canvas'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { c.style.transformOrigin = '0 0'; c.style.transform = t; }
    });
    const pc = document.getElementById('preview-canvas');
    if (pc) { pc.style.transformOrigin = '0 0'; pc.style.transform = t; }
  }

  function updateZoomLabel() {
    const lbl = document.getElementById('zoom-label');
    if (lbl) lbl.textContent = Math.round(scale * 100) + '%';
  }

  // Convert screen coords → canvas coords (world space)
  function screenToWorld(sx, sy) {
    return { x: (sx - panX) / scale, y: (sy - panY) / scale };
  }

  // drawGrid — no zoom transform needed (grid is behind CSS-transformed canvases)
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
    const logo = document.getElementById('brand-logo');
    if (logo && logo.complete) {
      gridCtx.globalAlpha = 0.04;
      gridCtx.drawImage(logo, W-140, H-140, 120, 120);
      gridCtx.globalAlpha = 1;
    }
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
    // Adjust badge position for zoom/pan
    const bx = Math.min((b.x + b.w) * scale + panX + 12, W - 215);
    const by = Math.max(Math.min(b.y * scale + panY - 10, H - 120), 10);
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
    const btn = document.getElementById('touch-delete-btn');
    if (btn) btn.style.display = 'none';
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

  function deselectAll() {
    selectShape(null);
    UI.hidePropPanel();
    const btn = document.getElementById('touch-delete-btn');
    if (btn) btn.style.display = 'none';
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
    return screenToWorld(e.clientX - r.left, e.clientY - r.top);
  }

  function getPosFromTouch(touch) {
    const sc = document.getElementById('shape-canvas');
    const r  = sc.getBoundingClientRect();
    return screenToWorld(touch.clientX - r.left, touch.clientY - r.top);
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
    // ── Two-finger pinch zoom ──
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist0  = Math.sqrt(dx*dx + dy*dy);
      pinchScale0 = scale;
      return;
    }

    const tool = App.currentTool;
    if (e.touches.length === 1) {
      const t   = e.touches[0];
      const pos = getPosFromTouch(t);

      // Detect double-tap (for editing text)
      const now = Date.now();
      if (lastTapPos && now - lastTap < 320
          && Math.abs(pos.x - lastTapPos.x) < 30
          && Math.abs(pos.y - lastTapPos.y) < 30) {
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

      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
        Drawing.touchStart(t); return;
      }
      e.preventDefault();
      handleDown(pos);
    }
  }

  function onTouchMove(e) {
    // ── Pinch zoom ──
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const sc   = document.getElementById('shape-canvas');
      const r    = sc.getBoundingClientRect();
      // Midpoint of two fingers
      const mx   = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - r.left;
      const my   = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - r.top;
      applyZoom(pinchScale0 * (dist / pinchDist0), mx, my);
      return;
    }

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

    // ── ANGLE TOOL ──
    if (tool === 'angle') {
      anglePoints.push({ x: pos.x, y: pos.y });
      if (anglePoints.length === 3) {
        drawAngleMeasurement(anglePoints[0], anglePoints[1], anglePoints[2], true);
        anglePoints = [];  // reset for next measurement
        angleHover  = null;
      } else {
        drawAnglePreview();
      }
      return;
    }

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

    // Angle tool preview
    if (tool === 'angle' && anglePoints.length > 0) {
      angleHover = pos;
      drawAnglePreview();
    }

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
  // ANGLE MEASUREMENT
  // Points: A (first arm), B (vertex), C (second arm)
  // ─────────────────────────────────────────────
  function calcAngle(A, B, C) {
    const v1 = { x: A.x - B.x, y: A.y - B.y };
    const v2 = { x: C.x - B.x, y: C.y - B.y };
    const dot = v1.x*v2.x + v1.y*v2.y;
    const mag = Math.sqrt((v1.x**2 + v1.y**2)) * Math.sqrt((v2.x**2 + v2.y**2));
    if (mag === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
  }

  function drawAnglePreview() {
    // Use ui-canvas for live preview (doesn't affect draw-canvas)
    const uc  = document.getElementById('ui-canvas');
    if (!uc) return;
    uc.style.pointerEvents = 'none';
    const ctx = uc.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const color = '#c9a84c';
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 4]);

    // Draw placed points
    anglePoints.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#4e9af1' : i === 1 ? '#f1a94e' : '#4ef17a';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['A','B','C'][i], p.x, p.y);
    });

    // Draw lines to hover point
    if (angleHover && anglePoints.length >= 1) {
      ctx.strokeStyle = 'rgba(201,168,76,0.5)';
      ctx.beginPath();
      ctx.moveTo(anglePoints[anglePoints.length-1].x, anglePoints[anglePoints.length-1].y);
      ctx.lineTo(angleHover.x, angleHover.y);
      ctx.stroke();
    }

    // Draw connecting line between point 1 and 2
    if (anglePoints.length === 2 && angleHover) {
      ctx.strokeStyle = 'rgba(201,168,76,0.5)';
      ctx.beginPath();
      ctx.moveTo(anglePoints[0].x, anglePoints[0].y);
      ctx.lineTo(anglePoints[1].x, anglePoints[1].y);
      ctx.stroke();
      // Live angle preview
      const deg = calcAngle(anglePoints[0], anglePoints[1], angleHover);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(8,15,31,0.9)';
      const lx = anglePoints[1].x + 20, ly = anglePoints[1].y - 20;
      ctx.fillRect(lx - 4, ly - 16, 80, 22);
      ctx.fillStyle = '#e8c96b';
      ctx.font = '600 13px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg.toFixed(1)}°`, lx, ly - 5);
    }

    // Instruction hint
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(201,168,76,0.75)';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const hints = ['Click point A (first arm)', 'Click B (vertex)', 'Click C (second arm)'];
    ctx.fillText(hints[anglePoints.length] || '', W/2, H - 10);
  }

  function drawAngleMeasurement(A, B, C, permanent) {
    const deg   = calcAngle(A, B, C);
    const ctx   = getDrawCtx();

    // Clear ui-canvas preview
    const uc = document.getElementById('ui-canvas');
    if (uc) uc.getContext('2d').clearRect(0, 0, W, H);

    ctx.save();

    // Draw the two arms
    const armColor = App.currentColor;
    ctx.strokeStyle = armColor;
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    ctx.moveTo(C.x, C.y); ctx.lineTo(B.x, B.y);
    ctx.stroke();

    // Arc at vertex
    const a1    = Math.atan2(A.y - B.y, A.x - B.x);
    const a2    = Math.atan2(C.y - B.y, C.x - B.x);
    const arcR  = 28;
    ctx.strokeStyle = '#f1a94e';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(B.x, B.y, arcR, a1, a2, a2 - a1 > Math.PI);
    ctx.stroke();

    // Points dots
    [[A,'A','#4e9af1'],[B,'B','#f1a94e'],[C,'C','#4ef17a']].forEach(([p, lbl, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px Segoe UI, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, p.x, p.y);
    });

    // Angle label at vertex
    const midA  = (a1 + a2) / 2;
    const lx    = B.x + (arcR + 22) * Math.cos(midA);
    const ly    = B.y + (arcR + 22) * Math.sin(midA);
    const label = `${deg.toFixed(2)}°`;

    // Background pill
    ctx.font = '700 14px Consolas, monospace';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(8,15,31,0.92)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx - tw/2 - 8, ly - 12, tw + 16, 24, 6);
    else ctx.rect(lx - tw/2 - 8, ly - 12, tw + 16, 24);
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#e8c96b';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);

    // Classify angle
    const classify = deg < 90 ? 'Acute' : deg === 90 ? 'Right' : deg < 180 ? 'Obtuse' : 'Reflex';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.fillText(classify, lx, ly + 16);

    ctx.restore();
    saveHistory();

    App.showToast(`∠ABC = ${deg.toFixed(2)}° (${classify === 'Right' ? '⊾ Right angle!' : classify})`);
  }

  // Reset angle tool when switching away
  function resetAngleTool() {
    anglePoints = [];
    angleHover  = null;
    const uc = document.getElementById('ui-canvas');
    if (uc) uc.getContext('2d').clearRect(0, 0, W, H);
  }
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

  function getTransform() { return { panX, panY, scale }; }

  return {
    init, resize, renderShapes, drawGrid, setBoardColor,
    addShape, addTextShape, selectShape, deselectAll, hitTest, deleteShape,
    updateProp, clearAll, undo, redo, saveHistory, resetAngleTool,
    getState, loadState, snapshot, snapshotJpeg,
    getShapeCount, getDrawCtx, getCanvasSize,
    getShapes, getDrawData, loadPageState,
    zoomBy, zoomReset, getTransform,
  };
})();