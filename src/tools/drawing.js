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
    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) {
      Canvas.saveHistory();
    }
    isDrawing = true;
    points    = [{ x, y }];

    // Immediately render dot for single-tap precision (decimal points, dots on i, etc.)
    const tool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const ctx  = getDrawCtx();
    if (!ctx) return;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    const penSz = (typeof App !== 'undefined') ? App.penSize : 3;
    const curCol = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';

    if (tool === 'eraser') {
      const eSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : penSz * 8;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth   = eSize;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(x, y, eSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill();
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = penSz * 5;
      ctx.strokeStyle = curCol + '60';
      ctx.beginPath();
      ctx.arc(x, y, (penSz * 5) / 2, 0, Math.PI * 2);
      ctx.fillStyle = curCol + '60';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = penSz;
      ctx.strokeStyle = curCol;
      ctx.beginPath();
      ctx.arc(x, y, penSz / 2, 0, Math.PI * 2);
      ctx.fillStyle = curCol;
      ctx.fill();
    }
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
      ctx.lineWidth   = (App.eraserSize || (App.penSize * 8));
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
    const scaleX = dc.width / r.width || 1;
    const scaleY = dc.height / r.height || 1;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  // ─────────────────────────────────────────────
  // TOUCH HANDLERS — called from canvas.js
  // (draw-canvas has pointer-events:none so we
  //  route touch through the shape canvas)
  // ─────────────────────────────────────────────
  function getTouchPos(touch) {
    const dc = getDrawCanvas();
    const r  = dc.getBoundingClientRect();
    const scaleX = dc.width / r.width || 1;
    const scaleY = dc.height / r.height || 1;
    return { x: (touch.clientX - r.left) * scaleX, y: (touch.clientY - r.top) * scaleY };
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
    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) {
      Canvas.saveHistory();
    }
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
  // TEXT TOOL — floating editor, stored as shape
  // ─────────────────────────────────────────────
  function openTextEditor(x, y, existingShape) {
    closeTextEditor();

    const curToolbarSize = parseInt(document.getElementById('tft-size-input')?.value) || 28;
    const curToolbarFont = document.getElementById('tft-font-select')?.value || 'Noto Sans, sans-serif';
    const fontSize   = existingShape ? (existingShape.fontSize || curToolbarSize) : curToolbarSize;
    const color      = existingShape ? (existingShape.color || '#ffffff') : (App.currentColor || '#ffffff');
    const fontFamily = existingShape ? (existingShape.fontFamily || curToolbarFont) : curToolbarFont;
    const isBold     = existingShape ? !!existingShape.bold : false;
    const align      = existingShape ? (existingShape.align || 'left') : 'left';

    const editor = document.createElement('div');
    editor.id = 'text-editor-box';
    editor.className = 'active-board-textbox';
    editor.style.cssText = `
      position: absolute; left: ${x}px; top: ${y}px;
      min-width: 160px; z-index: 100;
      background: transparent;
      border: 1.5px solid #3b82f6;
      border-radius: 2px; padding: 4px 6px;
      touch-action: auto;
    `;

    // 4 corner resize indicator dots matching user screenshot
    editor.innerHTML = `
      <span class="tb-corner-handle tl"></span>
      <span class="tb-corner-handle tr"></span>
      <span class="tb-corner-handle bl"></span>
      <span class="tb-corner-handle br"></span>
    `;

    const ta = document.createElement('textarea');
    ta.id = 'active-textbox-input';
    ta.style.cssText = `
      width: 100%; min-height: ${fontSize + 12}px;
      background: transparent; border: none; outline: none;
      color: ${color}; font-family: ${fontFamily};
      font-size: ${fontSize}px; font-weight: ${isBold ? '700' : '500'};
      text-align: ${align};
      resize: none; line-height: 1.35;
      caret-color: #3b82f6;
      touch-action: auto;
      -webkit-user-select: text; user-select: text;
      padding: 2px 4px; margin: 0;
    `;
    ta.placeholder = 'Type here…';
    if (existingShape) {
      ta.value = existingShape.text || '';
      existingShape._editing = true;
      if (typeof Canvas !== 'undefined') Canvas.renderShapes();
    }

    editor.appendChild(ta);
    const parent = document.getElementById('canvas-viewport') || document.getElementById('canvas-zone');
    parent.appendChild(editor);

    // Auto-adjust initial height if existing text
    if (ta.value) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }

    // Show floating formatting toolbar right above
    if (typeof Canvas !== 'undefined' && Canvas.updateFloatingToolbar) {
      Canvas.updateFloatingToolbar();
    }

    // Focus
    setTimeout(() => {
      ta.focus();
      if (existingShape) ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 50);

    function commitAndClose() {
      if (existingShape) delete existingShape._editing;
      const text = ta.value.trim();
      if (text) {
        const curColor  = ta.style.color || color;
        const curSize   = parseInt(ta.style.fontSize) || fontSize;
        const curFont   = ta.style.fontFamily || fontFamily;
        const curBold   = ta.style.fontWeight === '700';
        const curAlign  = ta.style.textAlign || align;
        const curHigh   = editor.dataset.highlight === 'true';

        if (existingShape) {
          Canvas.saveHistory();
          existingShape.text           = text;
          existingShape.color          = curColor;
          existingShape.fontSize       = curSize;
          existingShape.fontFamily     = curFont;
          existingShape.bold           = curBold;
          existingShape.align          = curAlign;
          existingShape.highlight      = curHigh;
          existingShape.highlightColor = 'rgba(254, 240, 138, 0.45)';
          Canvas.renderShapes();
        } else {
          const s = Canvas.addTextShape(x, y, text, curColor, curSize);
          if (s) {
            s.fontFamily     = curFont;
            s.bold           = curBold;
            s.align          = curAlign;
            s.highlight      = curHigh;
            s.highlightColor = 'rgba(254, 240, 138, 0.45)';
            Canvas.renderShapes();
          }
        }
      } else if (existingShape) {
        Canvas.renderShapes();
      }
      closeTextEditor();
    }

    // Keyboard shortcuts
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape')             { closeTextEditor(); return; }
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitAndClose(); }
    });

    // Auto-grow and update toolbar position
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      if (typeof Canvas !== 'undefined' && Canvas.updateFloatingToolbar) {
        Canvas.updateFloatingToolbar();
      }
    });

    // Click/tap outside to commit and close
    function outsideHandler(ev) {
      if (ev.target.closest('#text-floating-toolbar') || ev.target.closest('#tft-more-dropdown')) {
        return; // interacting with formatting toolbar
      }
      if (!editor.contains(ev.target)) {
        document.removeEventListener('mousedown', outsideHandler);
        document.removeEventListener('touchstart', outsideHandler);
        commitAndClose();
      }
    }
    setTimeout(() => {
      document.addEventListener('mousedown',  outsideHandler);
      document.addEventListener('touchstart', outsideHandler, { passive: true });
    }, 120);
  }

  function closeTextEditor() {
    const editor = document.getElementById('text-editor-box');
    if (editor) editor.remove();
    if (typeof Canvas !== 'undefined') {
      const target = Canvas.getSelected();
      if (target && target._editing) {
        delete target._editing;
        Canvas.renderShapes();
      }
      if (Canvas.updateFloatingToolbar) {
        Canvas.updateFloatingToolbar();
      }
    }
  }

  function placeText(x, y)  { openTextEditor(x, y, null); }
  function editText(shape)   { openTextEditor(shape.x, shape.y, shape); }
  function cancelText()      { closeTextEditor(); }

  // ─────────────────────────────────────────────
  // ATTACH EVENTS
  // ─────────────────────────────────────────────
  // Direct touch handlers for draw-canvas (eliminates touch-to-mouse synthesis latency)
  function onDrawTouchStart(e) {
    if (e.touches.length >= 3 && typeof GestureEraser !== 'undefined') {
      e.preventDefault();
      GestureEraser.handleTouchStart(e, (typeof Canvas !== 'undefined') ? Canvas.getPosFromTouch : null);
      return;
    }
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      e.preventDefault();
      GestureEraser.handleTouchStart(e, (typeof Canvas !== 'undefined') ? Canvas.getPosFromTouch : null);
      return;
    }
    if (e.touches.length === 2 && typeof Canvas !== 'undefined' && Canvas.handleTwoFingerTouchStart) {
      e.preventDefault();
      endStroke();
      Canvas.handleTwoFingerTouchStart(e);
      return;
    }
    if (e.touches.length === 1) {
      e.preventDefault();
      touchStart(e.touches[0]);
    }
  }

  function onDrawTouchMove(e) {
    if (typeof GestureEraser !== 'undefined' && (GestureEraser.isActive() || e.touches.length >= 3)) {
      e.preventDefault();
      GestureEraser.handleTouchMove(e, (typeof Canvas !== 'undefined') ? Canvas.getPosFromTouch : null);
      return;
    }
    if (e.touches.length === 2 && typeof Canvas !== 'undefined' && Canvas.handleTwoFingerTouchMove) {
      e.preventDefault();
      Canvas.handleTwoFingerTouchMove(e);
      return;
    }
    if (e.touches.length === 1) {
      e.preventDefault();
      touchMove(e.touches[0]);
    }
  }

  function onDrawTouchEnd(e) {
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      e.preventDefault();
      GestureEraser.handleTouchEnd(e);
      return;
    }
    if (typeof Canvas !== 'undefined' && Canvas.handleTwoFingerTouchEnd) {
      Canvas.handleTwoFingerTouchEnd(e);
    }
    touchEnd();
  }

  function attachEvents() {
    const dc = getDrawCanvas();
    if (!dc) return;

    // Mouse events
    dc.addEventListener('mousedown',  onMouseDown);
    dc.addEventListener('mousemove',  onMouseMove);
    dc.addEventListener('mouseup',    onMouseUp);
    dc.addEventListener('mouseleave', onMouseUp);

    // Direct touch events on draw-canvas — zero latency & multi-touch ready for SmartBoard
    dc.addEventListener('touchstart',  onDrawTouchStart, { passive: false });
    dc.addEventListener('touchmove',   onDrawTouchMove,  { passive: false });
    dc.addEventListener('touchend',    onDrawTouchEnd,   { passive: false });
    dc.addEventListener('touchcancel', onDrawTouchEnd,   { passive: false });

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