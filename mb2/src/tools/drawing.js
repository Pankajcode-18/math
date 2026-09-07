'use strict';

// ═══════════════════════════════════════════════
// DRAWING TOOLS — full touch + mouse support
// Pen, highlighter, eraser, line, arrow, text
// ═══════════════════════════════════════════════

const Drawing = (() => {

  let isDrawing      = false;
  let points         = [];
  let linePreviewCtx = null;

  function getDrawCanvas() { return document.getElementById('draw-canvas'); }
  function getDrawCtx()    { return Canvas.getDrawCtx(); }

  // ── Preview canvas for line/arrow (separate — never wipes pen strokes) ──
  function createPreviewCanvas() {
    document.getElementById('preview-canvas')?.remove();
    const zone = document.getElementById('canvas-zone');
    const pc   = document.createElement('canvas');
    pc.id = 'preview-canvas';
    pc.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
    const { W, H } = Canvas.getCanvasSize();
    pc.width = W; pc.height = H;
    zone.appendChild(pc);
    linePreviewCtx = pc.getContext('2d');
  }

  // ─────────────────────────────────────────────
  // STROKE CORE — used by both mouse and touch
  // ─────────────────────────────────────────────
  function startStrokeAt(x, y) {
    isDrawing = true;
    points    = [{ x, y }];
  }

  function continueStrokeAt(x, y) {
    if (!isDrawing) return;
    const tool = App.currentTool;
    const ctx  = getDrawCtx();
    points.push({ x, y });

    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth   = App.penSize * 8;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = App.penSize * 5;
      ctx.strokeStyle = App.currentColor + '60';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = App.penSize;
      ctx.strokeStyle = App.currentColor;
    }

    if (points.length >= 3) {
      const n = points.length;
      const p0 = points[n-3], p1 = points[n-2], p2 = points[n-1];
      const mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
      ctx.stroke();
    } else if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function endStroke() {
    if (!isDrawing) return;
    isDrawing = false;
    points    = [];
    getDrawCtx().globalCompositeOperation = 'source-over';
  }

  // ─────────────────────────────────────────────
  // MOUSE EVENTS on draw-canvas
  // ─────────────────────────────────────────────
  function onMouseDown(e) {
    const tool = App.currentTool;
    if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser') return;
    const pos = getMousePos(e);
    startStrokeAt(pos.x, pos.y);
  }

  function onMouseMove(e) {
    const tool = App.currentTool;
    if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser') return;
    const pos = getMousePos(e);
    continueStrokeAt(pos.x, pos.y);
  }

  function onMouseUp() { endStroke(); }

  function getMousePos(e) {
    const dc = getDrawCanvas();
    const r  = dc.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ─────────────────────────────────────────────
  // TOUCH HANDLERS — called from canvas.js
  // (draw-canvas has pointer-events:none so we
  //  route touch through the shape canvas)
  // ─────────────────────────────────────────────
  function getTouchPos(touch) {
    const dc = getDrawCanvas();
    const r  = dc.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function touchStart(touch) {
    const pos = getTouchPos(touch);
    startStrokeAt(pos.x, pos.y);
  }

  function touchMove(touch) {
    const pos = getTouchPos(touch);
    continueStrokeAt(pos.x, pos.y);
  }

  function touchEnd() { endStroke(); }

  // ─────────────────────────────────────────────
  // LINE / ARROW
  // ─────────────────────────────────────────────
  function previewLine(start, end) {
    if (!linePreviewCtx) createPreviewCanvas();
    const pc = document.getElementById('preview-canvas');
    if (!pc) return;
    linePreviewCtx.clearRect(0, 0, pc.width, pc.height);
    linePreviewCtx.save();
    linePreviewCtx.strokeStyle = App.currentColor;
    linePreviewCtx.lineWidth   = App.penSize;
    linePreviewCtx.setLineDash([6,4]);
    linePreviewCtx.lineCap     = 'round';
    linePreviewCtx.globalAlpha = 0.75;
    linePreviewCtx.beginPath();
    linePreviewCtx.moveTo(start.x, start.y);
    linePreviewCtx.lineTo(end.x, end.y);
    linePreviewCtx.stroke();
    linePreviewCtx.restore();
  }

  function commitLine(start, end, tool) {
    const pc = document.getElementById('preview-canvas');
    if (pc && linePreviewCtx) linePreviewCtx.clearRect(0, 0, pc.width, pc.height);

    const ctx = getDrawCtx();
    ctx.save();
    ctx.strokeStyle = App.currentColor;
    ctx.lineWidth   = App.penSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.globalAlpha = 1;

    // Dash pattern
    if (tool === 'dashed') {
      ctx.setLineDash([App.penSize * 5, App.penSize * 3]);
    } else if (tool === 'dotted') {
      ctx.setLineDash([App.penSize * 0.5, App.penSize * 4]);
      ctx.lineWidth = App.penSize * 1.5;
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const isArrow    = (tool === 'arrow' || tool === 'dbl-arrow');
    const isDblArrow = (tool === 'dbl-arrow');

    if (isArrow) {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const hl    = Math.max(14, App.penSize * 5);
      ctx.lineWidth = App.penSize;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - hl*Math.cos(angle - Math.PI/7),
                 end.y - hl*Math.sin(angle - Math.PI/7));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - hl*Math.cos(angle + Math.PI/7),
                 end.y - hl*Math.sin(angle + Math.PI/7));
      ctx.stroke();

      if (isDblArrow) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + hl*Math.cos(angle - Math.PI/7),
                   start.y + hl*Math.sin(angle - Math.PI/7));
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + hl*Math.cos(angle + Math.PI/7),
                   start.y + hl*Math.sin(angle + Math.PI/7));
        ctx.stroke();
      }
    }
    ctx.restore();
    Canvas.saveHistory();
  }

  // ─────────────────────────────────────────────
  // TEXT TOOL — floating editor, stored as shape
  // ─────────────────────────────────────────────
  function openTextEditor(x, y, existingShape) {
    closeTextEditor();

    const fontSize = Math.max(18, App.penSize * 5 + 12);
    const color    = App.currentColor;

    const editor = document.createElement('div');
    editor.id = 'text-editor-box';
    editor.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      min-width:180px; z-index:100;
      background:rgba(0,0,0,0.6);
      border:2px solid ${color};
      border-radius:8px; padding:8px 12px;
      box-shadow:0 6px 28px rgba(0,0,0,0.6);
      touch-action:none;
    `;

    const ta = document.createElement('textarea');
    ta.style.cssText = `
      width:100%; min-height:${fontSize+8}px;
      background:transparent; border:none; outline:none;
      color:${color}; font-family:'Inter',sans-serif;
      font-size:${fontSize}px; font-weight:600;
      resize:both; line-height:1.4;
      caret-color:${color};
      touch-action:auto;
      -webkit-user-select:text; user-select:text;
    `;
    ta.placeholder = 'Type here…';
    if (existingShape) ta.value = existingShape.text || '';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.38);margin-top:5px;font-family:Inter,sans-serif;user-select:none';
    hint.textContent = 'Ctrl+Enter = place  |  Esc = cancel';

    // Touch keyboards: show confirm button for mobile/smartboard
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '✓ Place Text';
    confirmBtn.style.cssText = `
      display:block; width:100%; margin-top:8px;
      padding:10px; border-radius:6px;
      background:rgba(201,168,76,0.2);
      border:1.5px solid rgba(201,168,76,0.5);
      color:#e8c96b; font-size:14px; font-weight:600;
      cursor:pointer; font-family:Inter,sans-serif;
      touch-action:manipulation;
    `;

    editor.appendChild(ta);
    editor.appendChild(hint);
    editor.appendChild(confirmBtn);
    document.getElementById('canvas-zone').appendChild(editor);

    // Focus — works on both mouse and touch
    setTimeout(() => {
      ta.focus();
      if (existingShape) ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 50);

    function commitAndClose() {
      const text = ta.value.trim();
      if (text) {
        if (existingShape) {
          Canvas.saveHistory();
          existingShape.text     = text;
          existingShape.color    = color;
          existingShape.fontSize = fontSize;
          Canvas.renderShapes();
        } else {
          Canvas.addTextShape(x, y, text, color, fontSize);
        }
      }
      closeTextEditor();
    }

    // Confirm button (for touch)
    confirmBtn.addEventListener('click',       commitAndClose);
    confirmBtn.addEventListener('touchend', e => { e.preventDefault(); commitAndClose(); });

    // Keyboard shortcuts (for mouse/keyboard)
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape')                   { closeTextEditor(); return; }
      if (e.key === 'Enter' && e.ctrlKey)       { e.preventDefault(); commitAndClose(); }
    });

    // Auto-grow
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });

    // Click/tap outside to cancel
    function outsideHandler(ev) {
      if (!editor.contains(ev.target)) {
        document.removeEventListener('mousedown', outsideHandler);
        document.removeEventListener('touchstart', outsideHandler);
        closeTextEditor();
      }
    }
    setTimeout(() => {
      document.addEventListener('mousedown',  outsideHandler);
      document.addEventListener('touchstart', outsideHandler, { passive: true });
    }, 120);
  }

  function closeTextEditor() {
    document.getElementById('text-editor-box')?.remove();
  }

  function placeText(x, y)  { openTextEditor(x, y, null); }
  function editText(shape)   { openTextEditor(shape.x, shape.y, shape); }
  function cancelText()      { closeTextEditor(); }

  // ─────────────────────────────────────────────
  // ATTACH EVENTS
  // ─────────────────────────────────────────────
  function attachEvents() {
    const dc = getDrawCanvas();
    // Mouse only — touch is routed via canvas.js shape canvas
    dc.addEventListener('mousedown',  onMouseDown);
    dc.addEventListener('mousemove',  onMouseMove);
    dc.addEventListener('mouseup',    onMouseUp);
    dc.addEventListener('mouseleave', onMouseUp);

    setTimeout(createPreviewCanvas, 200);
  }

  function syncPointerEvents() {
    const tool     = App.currentTool;
    const dc       = getDrawCanvas();
    const useMouse = (tool === 'pen' || tool === 'highlighter' || tool === 'eraser');
    dc.style.pointerEvents = useMouse ? 'auto' : 'none';
  }

  return {
    attachEvents, syncPointerEvents,
    previewLine, commitLine,
    placeText, editText, cancelText,
    touchStart, touchMove, touchEnd
  };
})();