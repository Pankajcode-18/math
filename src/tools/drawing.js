'use strict';

// ═══════════════════════════════════════════════
// DRAWING TOOLS — Professional Stylus & Whiteboard Engine
// Full touch, pen, stylus & mouse support
// Coalesced high-frequency pointer events & sub-pixel rendering
// ═══════════════════════════════════════════════

const Drawing = (() => {

  let isDrawing       = false;
  let activePointerId = null;
  let points          = [];
  let linePreviewCtx  = null;

  function getDrawCanvas() { return document.getElementById('draw-canvas'); }
  function getDrawCtx()    { return Canvas.getDrawCtx(); }

  // ── Preview canvas for line/arrow (separate — never wipes pen strokes) ──
  function createPreviewCanvas() {
    document.getElementById('preview-canvas')?.remove();
    const zone = document.getElementById('canvas-zone');
    if (!zone) return;
    const pc   = document.createElement('canvas');
    pc.id = 'preview-canvas';
    pc.style.cssText = 'position:absolute;top:0;left:0;width:100%!important;height:100%!important;pointer-events:none;z-index:5;';
    const { W, H } = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: zone.offsetWidth, H: zone.offsetHeight };
    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    pc.width = Math.round(W * dpr);
    pc.height = Math.round(H * dpr);
    zone.appendChild(pc);
    linePreviewCtx = pc.getContext('2d');
  }

  // ─────────────────────────────────────────────
  // STROKE CORE — Board Coordinates & Zero Latency
  // ─────────────────────────────────────────────
  function startStrokeAt(bx, by, pressure = 0.5) {
    isDrawing = true;
    const qx = Math.round(bx * 10) * 0.1;
    const qy = Math.round(by * 10) * 0.1;
    const qp = Math.round(pressure * 100) * 0.01;
    points = [{ x: qx, y: qy, p: qp }];

    const ctx = getDrawCtx();
    if (!ctx) return;

    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    const tool   = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const penSz  = (typeof App !== 'undefined') ? App.penSize : 3;
    const curCol = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';

    if (tool === 'eraser') {
      if (typeof Canvas !== 'undefined' && Canvas.beginEraseSession) {
        Canvas.beginEraseSession();
      }
      const eSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : penSz * 8;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth   = eSize;
      ctx.fillStyle   = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(qx, qy, eSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
      if (typeof Canvas !== 'undefined' && Canvas.eraseAtPoint) {
        Canvas.eraseAtPoint(qx, qy, eSize * 0.5);
      }
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      const hSize = penSz * 5;
      ctx.lineWidth = hSize;
      const alphaCol = (typeof curCol === 'string' && curCol.startsWith('#') && curCol.length === 7) ? curCol + '60' : curCol;
      ctx.fillStyle = alphaCol;
      ctx.beginPath();
      ctx.arc(qx, qy, hSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = penSz;
      ctx.fillStyle = curCol;
      ctx.beginPath();
      ctx.arc(qx, qy, penSz * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function continueStrokeAt(bx, by, pressure = 0.5) {
    if (!isDrawing) return;
    const lastPt = points[points.length - 1];
    if (lastPt) {
      const dx = bx - lastPt.x;
      const dy = by - lastPt.y;
      // High-precision distance filter: drops micro-jitter < 0.8px, preserving crisp small math formulas
      if (dx * dx + dy * dy < 0.64) return;
    }

    const qx = Math.round(bx * 10) * 0.1;
    const qy = Math.round(by * 10) * 0.1;
    const qp = Math.round(pressure * 100) * 0.01;
    points.push({ x: qx, y: qy, p: qp });

    const ctx = getDrawCtx();
    if (!ctx) return;

    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    const tool   = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const penSz  = (typeof App !== 'undefined') ? App.penSize : 3;
    const curCol = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';

    if (tool === 'eraser') {
      const eSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : penSz * 8;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth   = eSize;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      if (typeof Canvas !== 'undefined' && Canvas.eraseAtPoint) {
        Canvas.eraseAtPoint(qx, qy, eSize * 0.5);
      }
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = penSz * 5;
      const alphaCol = (typeof curCol === 'string' && curCol.startsWith('#') && curCol.length === 7) ? curCol + '60' : curCol;
      ctx.strokeStyle = alphaCol;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth   = penSz;
      ctx.strokeStyle = curCol;
    }

    if (points.length >= 3) {
      const n = points.length;
      const p0 = points[n - 3], p1 = points[n - 2], p2 = points[n - 1];
      const midPrevX = (p0.x + p1.x) * 0.5;
      const midPrevY = (p0.y + p1.y) * 0.5;
      const midCurrX = (p1.x + p2.x) * 0.5;
      const midCurrY = (p1.y + p2.y) * 0.5;
      ctx.beginPath();
      ctx.moveTo(midPrevX, midPrevY);
      ctx.quadraticCurveTo(p1.x, p1.y, midCurrX, midCurrY);
      ctx.stroke();
    } else if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(qx, qy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function endStroke() {
    if (!isDrawing) return;
    isDrawing = false;
    activePointerId = null;

    const tool   = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const penSz  = (typeof App !== 'undefined') ? App.penSize : 3;
    const curCol = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';

    if (tool === 'pen' || tool === 'highlighter') {
      if (points.length > 0 && typeof Canvas !== 'undefined' && Canvas.addStroke) {
        Canvas.addStroke({
          tool: tool,
          color: curCol,
          size: (tool === 'highlighter') ? penSz * 5 : penSz,
          points: points.slice()
        });
      }
    } else if (tool === 'eraser') {
      if (typeof Canvas !== 'undefined' && Canvas.endEraseSession) {
        Canvas.endEraseSession();
      }
    }

    points = [];
    const ctx = getDrawCtx();
    if (ctx) ctx.globalCompositeOperation = 'source-over';
  }

  // ─────────────────────────────────────────────
  // HIGH-FREQUENCY POINTER EVENTS
  // Supports Stylus, Pen, Touch & Mouse
  // ─────────────────────────────────────────────
  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const tool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser') return;

    e.preventDefault();
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch(err) {}
    activePointerId = e.pointerId;

    const pos = (typeof Canvas !== 'undefined' && Canvas.getBoardPos)
      ? Canvas.getBoardPos(e)
      : { x: e.clientX, y: e.clientY };
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.5;
    startStrokeAt(pos.x, pos.y, pressure);
  }

  function onPointerMove(e) {
    if (!isDrawing || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    e.preventDefault();

    const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const pos = (typeof Canvas !== 'undefined' && Canvas.getBoardPos)
        ? Canvas.getBoardPos(ev)
        : { x: ev.clientX, y: ev.clientY };
      const pressure = (ev.pressure && ev.pressure > 0) ? ev.pressure : 0.5;
      continueStrokeAt(pos.x, pos.y, pressure);
    }
  }

  function onPointerUp(e) {
    if (activePointerId !== null && e.pointerId === activePointerId) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch(err) {}
      endStroke();
    }
  }

  function onPointerCancel(e) {
    if (activePointerId !== null && e.pointerId === activePointerId) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch(err) {}
      endStroke();
    }
  }

  // Legacy touch forwards (for compatibility when routed through Canvas)
  function touchStart(touch) {
    const pos = (typeof Canvas !== 'undefined' && Canvas.getBoardPos) ? Canvas.getBoardPos(touch) : { x: touch.clientX, y: touch.clientY };
    startStrokeAt(pos.x, pos.y, touch.force || 0.5);
  }

  function touchMove(touch) {
    const pos = (typeof Canvas !== 'undefined' && Canvas.getBoardPos) ? Canvas.getBoardPos(touch) : { x: touch.clientX, y: touch.clientY };
    continueStrokeAt(pos.x, pos.y, touch.force || 0.5);
  }

  function touchEnd() {
    endStroke();
  }

  // ─────────────────────────────────────────────
  // LINE / ARROW / DASHED / DOTTED
  // ─────────────────────────────────────────────
  function previewLine(start, end) {
    if (!linePreviewCtx) createPreviewCanvas();
    const pc = document.getElementById('preview-canvas');
    if (!pc) return;
    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    linePreviewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { W, H } = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: pc.offsetWidth, H: pc.offsetHeight };
    linePreviewCtx.clearRect(0, 0, W, H);
    linePreviewCtx.save();
    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(linePreviewCtx);
    }
    linePreviewCtx.strokeStyle = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff';
    linePreviewCtx.lineWidth   = (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3;
    linePreviewCtx.setLineDash([6, 4]);
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
    if (pc && linePreviewCtx) {
      const { W, H } = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: pc.offsetWidth, H: pc.offsetHeight };
      const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : 1;
      linePreviewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      linePreviewCtx.clearRect(0, 0, W, H);
    }

    if (typeof Canvas !== 'undefined' && Canvas.addStroke) {
      Canvas.addStroke({
        tool: tool,
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff',
        size: (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3,
        points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }]
      });
      Canvas.renderStrokes();
    }
  }

  // ─────────────────────────────────────────────
  // TEXT TOOL — Clean Typing Mode & Shape Storage
  // ─────────────────────────────────────────────
  function openTextEditor(boardX, boardY, existingShape, clickClientPos) {
    closeTextEditor();

    // Ensure the floating formatting toolbar is completely HIDDEN during typing
    const floatBar = document.getElementById('text-floating-toolbar');
    if (floatBar) floatBar.classList.add('hidden');
    const moreMenu = document.getElementById('tft-more-dropdown');
    if (moreMenu) moreMenu.classList.add('hidden');

    const screenPos = (typeof Canvas !== 'undefined' && Canvas.boardToScreen)
      ? Canvas.boardToScreen(boardX, boardY)
      : { x: boardX, y: boardY };

    const curToolbarSize = parseInt(document.getElementById('tft-size-input')?.value) || 28;
    const curToolbarFont = document.getElementById('tft-font-select')?.value || 'Noto Sans, sans-serif';
    const fontSize   = existingShape ? (existingShape.fontSize || curToolbarSize) : curToolbarSize;
    const color      = existingShape ? (existingShape.color || '#ffffff') : (App.currentColor || '#ffffff');
    const fontFamily = existingShape ? (existingShape.fontFamily || curToolbarFont) : curToolbarFont;
    const isBold     = existingShape ? !!existingShape.bold : false;
    const align      = existingShape ? (existingShape.align || 'left') : 'left';
    const zoom       = (typeof Canvas !== 'undefined' && Canvas.getZoom) ? Canvas.getZoom() : 1;
    const initialW   = existingShape && existingShape.w ? Math.max(160, existingShape.w * zoom) : 220;

    const editor = document.createElement('div');
    editor.id = 'text-editor-box';
    editor.className = 'active-board-textbox';
    editor.style.cssText = `
      position: absolute; left: ${screenPos.x - 4}px; top: ${screenPos.y - 4}px;
      min-width: ${initialW}px; z-index: 100;
      background: transparent;
      border: 1.5px solid #3b82f6;
      border-radius: 2px; padding: 2px 4px;
      box-sizing: border-box;
      touch-action: auto;
      cursor: text;
    `;

    editor.innerHTML = `
      <span class="tb-corner-handle tl"></span>
      <span class="tb-corner-handle tr"></span>
      <span class="tb-corner-handle bl"></span>
      <span class="tb-corner-handle br"></span>
    `;

    const ta = document.createElement('textarea');
    ta.id = 'active-textbox-input';
    ta.style.cssText = `
      width: 100%; min-height: ${fontSize + 10}px;
      background: transparent; border: none; outline: none;
      color: ${color}; font-family: ${fontFamily};
      font-size: ${fontSize}px; font-weight: ${isBold ? '700' : '500'};
      text-align: ${align};
      resize: none; line-height: 1.35;
      caret-color: #3b82f6;
      touch-action: auto;
      -webkit-user-select: text; user-select: text;
      padding: 0; margin: 0;
      box-sizing: border-box;
      display: block;
    `;
    ta.placeholder = 'Type here…';
    if (existingShape) {
      ta.value = existingShape.text || '';
      existingShape._editing = true;
      if (typeof Canvas !== 'undefined') Canvas.renderShapes();
    }

    editor.appendChild(ta);
    const parent = document.getElementById('canvas-viewport') || document.getElementById('canvas-zone');
    if (parent) parent.appendChild(editor);

    if (ta.value) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }

    // Clicking anywhere inside the editor box focuses the textarea cleanly
    editor.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      ta.focus();
    });

    ta.focus();
    if (existingShape && !clickClientPos) {
      ta.setSelectionRange(ta.value.length, ta.value.length);
    } else if (clickClientPos) {
      try {
        if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(clickClientPos.clientX, clickClientPos.clientY);
          if (pos && typeof pos.offset === 'number') {
            ta.setSelectionRange(pos.offset, pos.offset);
          }
        } else if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(clickClientPos.clientX, clickClientPos.clientY);
          if (range) {
            ta.setSelectionRange(range.startOffset, range.startOffset);
          }
        }
      } catch (err) {}
    }

    let isCommitted = false;
    function commitAndClose(selectAfterCommit = true) {
      if (isCommitted) return;
      isCommitted = true;
      if (existingShape) delete existingShape._editing;
      const text = ta.value.trim();
      let targetShape = null;

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
          targetShape = existingShape;
        } else {
          const s = Canvas.addTextShape(boardX, boardY, text, curColor, curSize);
          if (s) {
            s.fontFamily     = curFont;
            s.bold           = curBold;
            s.align          = curAlign;
            s.highlight      = curHigh;
            s.highlightColor = 'rgba(254, 240, 138, 0.45)';
            Canvas.renderShapes();
            targetShape = s;
          }
        }
      } else if (existingShape) {
        // If user deleted all text, cleanly remove shape
        Canvas.saveHistory();
        const allShapes = (Canvas.getShapesRef ? Canvas.getShapesRef() : Canvas.getShapes()) || [];
        const idx = allShapes.indexOf(existingShape);
        if (idx !== -1) allShapes.splice(idx, 1);
        Canvas.renderShapes();
      }

      closeTextEditor();

      // Transition to State 2 (Object Selected) if requested
      if (selectAfterCommit && targetShape && typeof Canvas !== 'undefined' && Canvas.selectShape) {
        Canvas.selectShape(targetShape);
        if (typeof BoardClipboard !== 'undefined' && BoardClipboard.selectSingleShape) {
          BoardClipboard.selectSingleShape(targetShape);
        }
      }
    }

    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        commitAndClose(true);
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitAndClose(true);
      }
    });

    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      // Native smooth typing without triggering board renders or toolbar reflows
    });

    function outsideHandler(ev) {
      if (ev.target.closest('#text-floating-toolbar') || ev.target.closest('#tft-more-dropdown')) {
        return;
      }
      if (!editor.contains(ev.target)) {
        document.removeEventListener('mousedown', outsideHandler);
        document.removeEventListener('touchstart', outsideHandler);
        commitAndClose(false);
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

  function placeText(x, y)  { openTextEditor(x, y, null, null); }
  function editText(shape, clickPos) { openTextEditor(shape.x, shape.y, shape, clickPos); }
  function cancelText()      { closeTextEditor(); }

  // ─────────────────────────────────────────────
  // ATTACH EVENTS
  // ─────────────────────────────────────────────
  function onDrawTouchStart(e) {
    if (e.touches.length >= 3 && typeof GestureEraser !== 'undefined') {
      e.preventDefault();
      endStroke();
      GestureEraser.handleTouchStart(e, (typeof Canvas !== 'undefined') ? Canvas.getPosFromTouch : null);
      return;
    }
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      e.preventDefault();
      GestureEraser.handleTouchStart(e, (typeof Canvas !== 'undefined') ? Canvas.getPosFromTouch : null);
      return;
    }
    if (e.touches.length >= 2) {
      e.preventDefault();
      return;
    }
  }

  function onDrawTouchMove(e) {
    if (typeof GestureEraser !== 'undefined' && (GestureEraser.isActive() || e.touches.length >= 3)) {
      e.preventDefault();
      GestureEraser.handleTouchMove(e, (typeof Canvas !== 'undefined') ? Canvas.getPosFromTouch : null);
      return;
    }
    if (e.touches.length >= 2) {
      e.preventDefault();
      return;
    }
  }

  function onDrawTouchEnd(e) {
    if (typeof GestureEraser !== 'undefined' && GestureEraser.isActive()) {
      e.preventDefault();
      GestureEraser.handleTouchEnd(e);
      return;
    }
  }

  function attachEvents() {
    const dc = getDrawCanvas();
    if (!dc) return;

    // High-frequency pointer events (Pen, Stylus, Mouse, Touch)
    dc.addEventListener('pointerdown',   onPointerDown);
    dc.addEventListener('pointermove',   onPointerMove);
    dc.addEventListener('pointerup',     onPointerUp);
    dc.addEventListener('pointercancel', onPointerCancel);
    dc.addEventListener('pointerleave',  onPointerUp);

    // Multi-touch gesture eraser interception & palm rejection
    dc.addEventListener('touchstart',  onDrawTouchStart, { passive: false });
    dc.addEventListener('touchmove',   onDrawTouchMove,  { passive: false });
    dc.addEventListener('touchend',    onDrawTouchEnd,   { passive: false });
    dc.addEventListener('touchcancel', onDrawTouchEnd,   { passive: false });

    setTimeout(createPreviewCanvas, 200);
  }

  function syncPointerEvents() {
    const tool     = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const dc       = getDrawCanvas();
    const vp       = document.getElementById('canvas-viewport');
    if (!dc) return;
    const useDraw = (tool === 'pen' || tool === 'highlighter' || tool === 'eraser');
    dc.style.pointerEvents = useDraw ? 'auto' : 'none';
    if (vp) {
      vp.style.zIndex = useDraw ? '200' : '2';
    }
    dc.style.zIndex = useDraw ? '200' : '3';

    // Synchronize Write Over button on chapter panel if open
    const btnAnnotate = document.getElementById('cp-btn-annotate');
    if (btnAnnotate) {
      if (useDraw) {
        btnAnnotate.classList.add('active');
        btnAnnotate.textContent = '👆 Interact';
        btnAnnotate.title = 'Switch to interacting with buttons & inputs';
      } else {
        btnAnnotate.classList.remove('active');
        btnAnnotate.textContent = '✎ Write Over';
        btnAnnotate.title = 'Write / Draw directly over this panel with stylus or pen';
      }
    }
  }

  function clearDrawings() {
    if (typeof Canvas !== 'undefined' && Canvas.clearAll) {
      Canvas.clearAll();
    }
  }

  return {
    attachEvents, syncPointerEvents,
    previewLine, commitLine,
    placeText, editText, cancelText,
    touchStart, touchMove, touchEnd,
    clearDrawings,
    isDrawingActive: () => isDrawing
  };
})();