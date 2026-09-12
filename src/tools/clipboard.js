'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD CLIPBOARD & OBJECT SELECTION SYSTEM
// Professional Selection, Lasso, Move, Copy, Paste, Cut & Duplicate Engine
// 100% Zoom Compatible (25% to 300%) using Board Coordinates
// ═══════════════════════════════════════════════════════════════════════════════

const BoardClipboard = (() => {

  // ── Selection State ──
  let selectedShapes = [];   // Array of direct shape references
  let selectedStrokes = [];  // Array of direct stroke references
  let selectionBounds = null;// { x, y, w, h } in board coordinates
  let isLassoing = false;
  let lassoPoints = [];      // [{ x, y }] in board coordinates

  // ── Drag & Move State ──
  let isDraggingSelection = false;
  let dragStartPos = null;    // { x, y } in board coordinates
  let dragInitialShapes = []; // [{ ref, orig }]
  let dragInitialStrokes = [];// [{ ref, origPoints: [{x, y, p}] }]
  let dragInitialBounds = null;

  // ── Clipboard State ──
  let clipboardData = null;   // { shapes: [...], strokes: [...], bounds: {...}, center: { x, y } }
  let lastPointerPos = null;  // Latest board coordinates of cursor / pointer

  // ── DOM Elements ──
  let selectionToolbar = null;
  let contextMenu = null;

  function getUiCanvas() { return document.getElementById('ui-canvas'); }
  function getUiCtx() {
    const c = getUiCanvas();
    return c ? c.getContext('2d') : null;
  }

  function hasSelection() {
    return (selectedShapes && selectedShapes.length > 0) || (selectedStrokes && selectedStrokes.length > 0);
  }

  function hasClipboardData() {
    return !!clipboardData && (((clipboardData.shapes && clipboardData.shapes.length > 0)) || ((clipboardData.strokes && clipboardData.strokes.length > 0)));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GEOMETRY & BOUNDS HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  function getStrokeBounds(s) {
    if (!s || !s.points || s.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pts = s.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(2, (s.size || 3) / 2);
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(1, (maxX - minX) + pad * 2),
      h: Math.max(1, (maxY - minY) + pad * 2)
    };
  }

  function getShapeBounds(s) {
    if (typeof Shapes !== 'undefined' && Shapes.getBounds) {
      const b = Shapes.getBounds(s);
      if (b && typeof b.x === 'number') return b;
    }
    return { x: s.x || 0, y: s.y || 0, w: s.w || 60, h: s.h || 40 };
  }

  function computeCombinedBounds(shapesList, strokesList) {
    if ((!shapesList || shapesList.length === 0) && (!strokesList || strokesList.length === 0)) {
      return null;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let s of shapesList) {
      const b = getShapeBounds(s);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    for (let st of strokesList) {
      const b = getStrokeBounds(st);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    if (minX === Infinity) return null;
    return {
      x: minX,
      y: minY,
      w: Math.max(8, maxX - minX),
      h: Math.max(8, maxY - minY)
    };
  }

  // Ray-casting point in polygon
  function pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSLATION (DELTA MOVE)
  // ─────────────────────────────────────────────────────────────────────────────

  function translateShape(s, dx, dy) {
    if (typeof s.x === 'number') s.x += dx;
    if (typeof s.y === 'number') s.y += dy;
    if (typeof s.x1 === 'number') s.x1 += dx;
    if (typeof s.y1 === 'number') s.y1 += dy;
    if (typeof s.x2 === 'number') s.x2 += dx;
    if (typeof s.y2 === 'number') s.y2 += dy;
    if (typeof s.cx === 'number') s.cx += dx;
    if (typeof s.cy === 'number') s.cy += dy;
    if (typeof s.vx === 'number') s.vx += dx;
    if (typeof s.vy === 'number') s.vy += dy;
    if (Array.isArray(s.points)) {
      for (let i = 0; i < s.points.length; i++) {
        if (typeof s.points[i].x === 'number') s.points[i].x += dx;
        if (typeof s.points[i].y === 'number') s.points[i].y += dy;
      }
    }
  }

  function translateStroke(s, dx, dy) {
    if (Array.isArray(s.points)) {
      for (let i = 0; i < s.points.length; i++) {
        s.points[i].x += dx;
        s.points[i].y += dy;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HIT TESTING (FOR SINGLE CLICK SELECTION)
  // ─────────────────────────────────────────────────────────────────────────────

  function hitTestStroke(bx, by, tolerance) {
    const strokes = (typeof Canvas !== 'undefined' && Canvas.getStrokesRef)
      ? Canvas.getStrokesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getStrokes) ? Canvas.getStrokes() : []);
    const tol = Math.max(10, tolerance || 12);

    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (!s.points || s.points.length === 0) continue;
      const strokeR = (s.size || 3) / 2;
      const thresh = strokeR + tol;
      for (let j = 0; j < s.points.length; j++) {
        const p = s.points[j];
        if (Math.hypot(p.x - bx, p.y - by) <= thresh) {
          return s;
        }
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LASSO SELECTION ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function startLasso(pos) {
    isLassoing = true;
    lassoPoints = [{ x: pos.x, y: pos.y }];
    clearUiCanvas();
    hideSelectionToolbar();
    hideContextMenu();
  }

  function continueLasso(pos) {
    if (!isLassoing) return;
    const last = lassoPoints[lassoPoints.length - 1];
    if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < 3) return;

    lassoPoints.push({ x: pos.x, y: pos.y });
    renderLiveLasso();
  }

  function renderLiveLasso() {
    const ctx = getUiCtx();
    if (!ctx || lassoPoints.length < 2) return;

    const zoom = (typeof Canvas !== 'undefined' && Canvas.getZoom) ? Canvas.getZoom() : 1;
    const dpr  = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    const canvas = getUiCanvas();

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }

    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i = 1; i < lassoPoints.length; i++) {
      ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    }

    // Dynamic vibrant lasso visual
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  }

  function endLasso() {
    if (!isLassoing) return;
    isLassoing = false;

    if (lassoPoints.length < 3) {
      clearSelection();
      return;
    }

    // Check if lasso traveled enough distance to constitute a loop
    let totalLen = 0;
    for (let i = 1; i < lassoPoints.length; i++) {
      totalLen += Math.hypot(lassoPoints[i].x - lassoPoints[i - 1].x, lassoPoints[i].y - lassoPoints[i - 1].y);
    }
    if (totalLen < 15) {
      // Just a click on empty canvas
      clearSelection();
      return;
    }

    // Close polygon
    const poly = [...lassoPoints];
    if (poly[0].x !== poly[poly.length - 1].x || poly[0].y !== poly[poly.length - 1].y) {
      poly.push({ x: poly[0].x, y: poly[0].y });
    }

    const allShapes = (typeof Canvas !== 'undefined' && Canvas.getShapesRef)
      ? Canvas.getShapesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getShapes) ? Canvas.getShapes() : []);

    const allStrokes = (typeof Canvas !== 'undefined' && Canvas.getStrokesRef)
      ? Canvas.getStrokesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getStrokes) ? Canvas.getStrokes() : []);

    const enclosedShapes = [];
    const enclosedStrokes = [];

    // Hit-test shapes
    for (let i = 0; i < allShapes.length; i++) {
      const s = allShapes[i];
      const b = getShapeBounds(s);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;

      // Check center
      if (pointInPolygon(cx, cy, poly)) {
        enclosedShapes.push(s);
        continue;
      }
      // Check line endpoints if applicable
      if (typeof s.x1 === 'number' && typeof s.x2 === 'number') {
        if (pointInPolygon(s.x1, s.y1, poly) || pointInPolygon(s.x2, s.y2, poly)) {
          enclosedShapes.push(s);
          continue;
        }
      }
      // Check corners of bounding box
      let cornerHits = 0;
      if (pointInPolygon(b.x, b.y, poly)) cornerHits++;
      if (pointInPolygon(b.x + b.w, b.y, poly)) cornerHits++;
      if (pointInPolygon(b.x, b.y + b.h, poly)) cornerHits++;
      if (pointInPolygon(b.x + b.w, b.y + b.h, poly)) cornerHits++;
      if (cornerHits >= 2) {
        enclosedShapes.push(s);
      }
    }

    // Hit-test strokes (handwriting, pen sketches)
    for (let i = 0; i < allStrokes.length; i++) {
      const st = allStrokes[i];
      if (!st.points || st.points.length === 0) continue;

      if (!st.id) {
        st.id = 'strk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }

      const pts = st.points;
      if (pts.length <= 4) {
        let anyIn = false;
        for (let p of pts) {
          if (pointInPolygon(p.x, p.y, poly)) { anyIn = true; break; }
        }
        if (anyIn) enclosedStrokes.push(st);
      } else {
        // Sample up to 20 points
        const step = Math.max(1, Math.floor(pts.length / 16));
        let inCount = 0;
        let sampled = 0;
        for (let k = 0; k < pts.length; k += step) {
          sampled++;
          if (pointInPolygon(pts[k].x, pts[k].y, poly)) inCount++;
        }
        if (sampled > 0 && inCount / sampled >= 0.40) {
          enclosedStrokes.push(st);
        } else {
          // Check stroke bounding box center
          const sb = getStrokeBounds(st);
          if (pointInPolygon(sb.x + sb.w / 2, sb.y + sb.h / 2, poly)) {
            enclosedStrokes.push(st);
          }
        }
      }
    }

    lassoPoints = [];

    if (enclosedShapes.length === 0 && enclosedStrokes.length === 0) {
      clearSelection();
      return;
    }

    selectedShapes = enclosedShapes;
    selectedStrokes = enclosedStrokes;
    selectionBounds = computeCombinedBounds(selectedShapes, selectedStrokes);

    renderSelectionOverlay();
    showSelectionToolbar();

    const totalCount = selectedShapes.length + selectedStrokes.length;
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Selected ${totalCount} object${totalCount > 1 ? 's' : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SINGLE SELECTION
  // ─────────────────────────────────────────────────────────────────────────────

  function selectSingleShape(s) {
    if (!s) return;
    selectedShapes = [s];
    selectedStrokes = [];
    selectionBounds = computeCombinedBounds(selectedShapes, selectedStrokes);
    renderSelectionOverlay();
    showSelectionToolbar();
  }

  function selectSingleStroke(st) {
    if (!st) return;
    if (!st.id) {
      st.id = 'strk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    selectedShapes = [];
    selectedStrokes = [st];
    selectionBounds = computeCombinedBounds(selectedShapes, selectedStrokes);
    renderSelectionOverlay();
    showSelectionToolbar();
  }

  function clearSelection() {
    selectedShapes = [];
    selectedStrokes = [];
    selectionBounds = null;
    isLassoing = false;
    isDraggingSelection = false;
    lassoPoints = [];
    clearUiCanvas();
    hideSelectionToolbar();
    hideContextMenu();
  }

  function clearUiCanvas() {
    const ctx = getUiCtx();
    const canvas = getUiCanvas();
    if (ctx && canvas) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  function isPointInSelection(pos) {
    if (!hasSelection() || !selectionBounds) return false;
    const zoom = (typeof Canvas !== 'undefined' && Canvas.getZoom) ? Canvas.getZoom() : 1;
    const pad = 12 / zoom;
    return (
      pos.x >= selectionBounds.x - pad &&
      pos.x <= selectionBounds.x + selectionBounds.w + pad &&
      pos.y >= selectionBounds.y - pad &&
      pos.y <= selectionBounds.y + selectionBounds.h + pad
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MOVE ENGINE (ZERO-DRIFT GROUP TRANSLATION)
  // ─────────────────────────────────────────────────────────────────────────────

  function startMoveSelected(pos) {
    if (!hasSelection()) return;
    isDraggingSelection = true;
    dragStartPos = { x: pos.x, y: pos.y };

    dragInitialShapes = selectedShapes.map(s => ({
      ref: s,
      orig: JSON.parse(JSON.stringify(s))
    }));

    dragInitialStrokes = selectedStrokes.map(st => ({
      ref: st,
      origPoints: st.points.map(p => ({ x: p.x, y: p.y, p: p.p }))
    }));

    dragInitialBounds = { ...selectionBounds };
    hideSelectionToolbar();
  }

  function moveSelected(pos) {
    if (!isDraggingSelection || !dragStartPos) return;
    const dx = pos.x - dragStartPos.x;
    const dy = pos.y - dragStartPos.y;

    // Apply translation from orig to avoid floating point drift
    for (let i = 0; i < dragInitialShapes.length; i++) {
      const item = dragInitialShapes[i];
      const s = item.ref;
      const orig = item.orig;

      if (typeof orig.x === 'number') s.x = orig.x + dx;
      if (typeof orig.y === 'number') s.y = orig.y + dy;
      if (typeof orig.x1 === 'number') s.x1 = orig.x1 + dx;
      if (typeof orig.y1 === 'number') s.y1 = orig.y1 + dy;
      if (typeof orig.x2 === 'number') s.x2 = orig.x2 + dx;
      if (typeof orig.y2 === 'number') s.y2 = orig.y2 + dy;
      if (typeof orig.cx === 'number') s.cx = orig.cx + dx;
      if (typeof orig.cy === 'number') s.cy = orig.cy + dy;
      if (typeof orig.vx === 'number') s.vx = orig.vx + dx;
      if (typeof orig.vy === 'number') s.vy = orig.vy + dy;

      if (Array.isArray(orig.points) && Array.isArray(s.points)) {
        for (let j = 0; j < orig.points.length; j++) {
          s.points[j].x = orig.points[j].x + dx;
          s.points[j].y = orig.points[j].y + dy;
        }
      }
    }

    for (let i = 0; i < dragInitialStrokes.length; i++) {
      const item = dragInitialStrokes[i];
      const st = item.ref;
      const origPts = item.origPoints;
      for (let j = 0; j < origPts.length; j++) {
        st.points[j].x = origPts[j].x + dx;
        st.points[j].y = origPts[j].y + dy;
      }
    }

    selectionBounds.x = dragInitialBounds.x + dx;
    selectionBounds.y = dragInitialBounds.y + dy;

    if (typeof Canvas !== 'undefined') {
      if (Canvas.renderShapes) Canvas.renderShapes();
      if (Canvas.renderStrokes) Canvas.renderStrokes();
    }

    renderSelectionOverlay();
  }

  function endMoveSelected() {
    if (!isDraggingSelection) return;
    isDraggingSelection = false;
    dragStartPos = null;
    dragInitialShapes = [];
    dragInitialStrokes = [];
    dragInitialBounds = null;

    // Recalculate exact bounds
    selectionBounds = computeCombinedBounds(selectedShapes, selectedStrokes);

    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) {
      Canvas.saveHistory();
    }

    renderSelectionOverlay();
    showSelectionToolbar();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERING SELECTION OVERLAY ON UI-CANVAS
  // ─────────────────────────────────────────────────────────────────────────────

  function renderSelectionOverlay() {
    const ctx = getUiCtx();
    const canvas = getUiCanvas();
    if (!ctx || !canvas) return;

    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (!hasSelection() || !selectionBounds) {
      ctx.restore();
      hideSelectionToolbar();
      return;
    }

    const zoom = (typeof Canvas !== 'undefined' && Canvas.getZoom) ? Canvas.getZoom() : 1;

    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }

    const b = selectionBounds;
    const pad = 8 / zoom;
    const bx = b.x - pad;
    const by = b.y - pad;
    const bw = b.w + pad * 2;
    const bh = b.h + pad * 2;

    // Subtle background tint
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fillRect(bx, by, bw, bh);

    // Glowing dashed border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6 / zoom;
    ctx.setLineDash([7 / zoom, 4 / zoom]);
    ctx.strokeRect(bx, by, bw, bh);

    // Solid inner outline for maximum contrast on any board color
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.8 / zoom;
    ctx.setLineDash([]);
    ctx.strokeRect(bx, by, bw, bh);

    // Corner anchor handles
    const handleSize = 7 / zoom;
    const halfH = handleSize / 2;
    const corners = [
      { x: bx, y: by },
      { x: bx + bw, y: by },
      { x: bx, y: by + bh },
      { x: bx + bw, y: by + bh },
      // Mid-point handles
      { x: bx + bw / 2, y: by },
      { x: bx + bw / 2, y: by + bh },
      { x: bx, y: by + bh / 2 },
      { x: bx + bw, y: by + bh / 2 }
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5 / zoom;

    for (let pt of corners) {
      ctx.fillRect(pt.x - halfH, pt.y - halfH, handleSize, handleSize);
      ctx.strokeRect(pt.x - halfH, pt.y - halfH, handleSize, handleSize);
    }

    ctx.restore();

    updateSelectionToolbarPosition();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLIPBOARD OPERATIONS: COPY, PASTE, CUT, DUPLICATE, DELETE
  // ─────────────────────────────────────────────────────────────────────────────

  function copy() {
    if (!hasSelection()) {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Nothing selected to copy');
      return;
    }

    const cx = selectionBounds.x + selectionBounds.w / 2;
    const cy = selectionBounds.y + selectionBounds.h / 2;

    clipboardData = {
      shapes: selectedShapes.map(s => JSON.parse(JSON.stringify(s))),
      strokes: selectedStrokes.map(st => JSON.parse(JSON.stringify(st))),
      bounds: { ...selectionBounds },
      center: { x: cx, y: cy }
    };

    const count = selectedShapes.length + selectedStrokes.length;
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✓ Copied ${count} item${count > 1 ? 's' : ''}`);
    }
  }

  function paste(targetPos) {
    if (!hasClipboardData()) {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Clipboard is empty');
      return;
    }

    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) {
      Canvas.saveHistory();
    }

    // Determine target location
    let px, py;
    if (targetPos && typeof targetPos.x === 'number') {
      px = targetPos.x;
      py = targetPos.y;
    } else if (lastPointerPos && typeof lastPointerPos.x === 'number') {
      px = lastPointerPos.x;
      py = lastPointerPos.y;
    } else {
      px = clipboardData.center.x + 30;
      py = clipboardData.center.y + 30;
    }

    let dx = px - clipboardData.center.x;
    let dy = py - clipboardData.center.y;

    if (Math.hypot(dx, dy) < 4) {
      dx += 28;
      dy += 28;
    }

    const allShapes = (typeof Canvas !== 'undefined' && Canvas.getShapesRef)
      ? Canvas.getShapesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getShapes) ? Canvas.getShapes() : []);

    const allStrokes = (typeof Canvas !== 'undefined' && Canvas.getStrokesRef)
      ? Canvas.getStrokesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getStrokes) ? Canvas.getStrokes() : []);

    const newShapes = [];
    const newStrokes = [];

    // Clone & translate shapes
    for (let i = 0; i < clipboardData.shapes.length; i++) {
      const clone = JSON.parse(JSON.stringify(clipboardData.shapes[i]));
      clone.id = 'shp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      translateShape(clone, dx, dy);
      allShapes.push(clone);
      newShapes.push(clone);
    }

    // Clone & translate strokes
    for (let i = 0; i < clipboardData.strokes.length; i++) {
      const clone = JSON.parse(JSON.stringify(clipboardData.strokes[i]));
      clone.id = 'strk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      translateStroke(clone, dx, dy);
      allStrokes.push(clone);
      newStrokes.push(clone);
    }

    // Shift clipboard center for cascading pastes
    clipboardData.center.x += 24;
    clipboardData.center.y += 24;

    // Select the newly pasted objects
    selectedShapes = newShapes;
    selectedStrokes = newStrokes;
    selectionBounds = computeCombinedBounds(selectedShapes, selectedStrokes);

    if (typeof Canvas !== 'undefined') {
      if (Canvas.renderShapes) Canvas.renderShapes();
      if (Canvas.renderStrokes) Canvas.renderStrokes();
    }

    renderSelectionOverlay();
    showSelectionToolbar();

    const count = newShapes.length + newStrokes.length;
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✓ Pasted ${count} item${count > 1 ? 's' : ''}`);
    }
  }

  function cut() {
    if (!hasSelection()) return;
    copy();
    deleteSelected(false);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Cut to clipboard');
    }
  }

  function duplicate() {
    if (!hasSelection()) return;

    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) {
      Canvas.saveHistory();
    }

    const offset = 26;
    const allShapes = (typeof Canvas !== 'undefined' && Canvas.getShapesRef)
      ? Canvas.getShapesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getShapes) ? Canvas.getShapes() : []);

    const allStrokes = (typeof Canvas !== 'undefined' && Canvas.getStrokesRef)
      ? Canvas.getStrokesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getStrokes) ? Canvas.getStrokes() : []);

    const newShapes = [];
    const newStrokes = [];

    for (let s of selectedShapes) {
      const clone = JSON.parse(JSON.stringify(s));
      clone.id = 'shp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      translateShape(clone, offset, offset);
      allShapes.push(clone);
      newShapes.push(clone);
    }

    for (let st of selectedStrokes) {
      const clone = JSON.parse(JSON.stringify(st));
      clone.id = 'strk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      translateStroke(clone, offset, offset);
      allStrokes.push(clone);
      newStrokes.push(clone);
    }

    selectedShapes = newShapes;
    selectedStrokes = newStrokes;
    selectionBounds = computeCombinedBounds(selectedShapes, selectedStrokes);

    if (typeof Canvas !== 'undefined') {
      if (Canvas.renderShapes) Canvas.renderShapes();
      if (Canvas.renderStrokes) Canvas.renderStrokes();
    }

    renderSelectionOverlay();
    showSelectionToolbar();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('✓ Duplicated');
    }
  }

  function deleteSelected(showToast = true) {
    if (!hasSelection()) return;

    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) {
      Canvas.saveHistory();
    }

    const allShapes = (typeof Canvas !== 'undefined' && Canvas.getShapesRef)
      ? Canvas.getShapesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getShapes) ? Canvas.getShapes() : []);

    const allStrokes = (typeof Canvas !== 'undefined' && Canvas.getStrokesRef)
      ? Canvas.getStrokesRef()
      : ((typeof Canvas !== 'undefined' && Canvas.getStrokes) ? Canvas.getStrokes() : []);

    const shapeSet = new Set(selectedShapes);
    const strokeSet = new Set(selectedStrokes);

    for (let i = allShapes.length - 1; i >= 0; i--) {
      if (shapeSet.has(allShapes[i])) {
        allShapes.splice(i, 1);
      }
    }

    for (let i = allStrokes.length - 1; i >= 0; i--) {
      if (strokeSet.has(allStrokes[i])) {
        allStrokes.splice(i, 1);
      }
    }

    const count = selectedShapes.length + selectedStrokes.length;
    clearSelection();

    if (typeof Canvas !== 'undefined') {
      if (Canvas.renderShapes) Canvas.renderShapes();
      if (Canvas.renderStrokes) Canvas.renderStrokes();
    }

    if (showToast && typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Deleted ${count} item${count > 1 ? 's' : ''}`);
    }
  }

  function bringToFront() {
    if (!hasSelection()) return;
    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();

    const allShapes = Canvas.getShapesRef ? Canvas.getShapesRef() : [];
    const shapeSet = new Set(selectedShapes);

    const extracted = [];
    for (let i = allShapes.length - 1; i >= 0; i--) {
      if (shapeSet.has(allShapes[i])) {
        extracted.unshift(allShapes.splice(i, 1)[0]);
      }
    }
    allShapes.push(...extracted);

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
    renderSelectionOverlay();
    hideContextMenu();
  }

  function sendToBack() {
    if (!hasSelection()) return;
    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();

    const allShapes = Canvas.getShapesRef ? Canvas.getShapesRef() : [];
    const shapeSet = new Set(selectedShapes);

    const extracted = [];
    for (let i = allShapes.length - 1; i >= 0; i--) {
      if (shapeSet.has(allShapes[i])) {
        extracted.push(allShapes.splice(i, 1)[0]);
      }
    }
    allShapes.unshift(...extracted.reverse());

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
    renderSelectionOverlay();
    hideContextMenu();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOATING SELECTION TOOLBAR & CONTEXT MENU
  // ─────────────────────────────────────────────────────────────────────────────

  function createDomElements() {
    if (document.getElementById('board-sel-toolbar')) return;

    // 1. Floating Action Bar
    const bar = document.createElement('div');
    bar.id = 'board-sel-toolbar';
    bar.className = 'board-sel-toolbar hidden';
    bar.innerHTML = `
      <button type="button" class="bst-btn" id="bst-copy-btn" title="Copy (Ctrl+C)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy</span>
      </button>
      <button type="button" class="bst-btn" id="bst-cut-btn" title="Cut (Ctrl+X)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
        <span>Cut</span>
      </button>
      <button type="button" class="bst-btn" id="bst-duplicate-btn" title="Duplicate (Ctrl+D)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>Duplicate</span>
      </button>
      <div class="bst-divider"></div>
      <button type="button" class="bst-btn danger" id="bst-delete-btn" title="Delete (Del)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Delete</span>
      </button>
    `;
    document.body.appendChild(bar);
    selectionToolbar = bar;

    bar.querySelector('#bst-copy-btn')?.addEventListener('click', (e) => { e.stopPropagation(); copy(); });
    bar.querySelector('#bst-cut-btn')?.addEventListener('click', (e) => { e.stopPropagation(); cut(); });
    bar.querySelector('#bst-duplicate-btn')?.addEventListener('click', (e) => { e.stopPropagation(); duplicate(); });
    bar.querySelector('#bst-delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); deleteSelected(); });

    // 2. Right-click / Long-press Context Menu
    const menu = document.createElement('div');
    menu.id = 'board-ctx-menu';
    menu.className = 'board-ctx-menu hidden';
    menu.innerHTML = `
      <div class="bcm-item" id="bcm-copy"><span>📋 Copy</span><span class="bcm-kbd">Ctrl+C</span></div>
      <div class="bcm-item" id="bcm-cut"><span>✂️ Cut</span><span class="bcm-kbd">Ctrl+X</span></div>
      <div class="bcm-item" id="bcm-paste"><span>📑 Paste</span><span class="bcm-kbd">Ctrl+V</span></div>
      <div class="bcm-item" id="bcm-duplicate"><span>🗐 Duplicate</span><span class="bcm-kbd">Ctrl+D</span></div>
      <div class="bcm-divider"></div>
      <div class="bcm-item" id="bcm-front"><span>⬆️ Bring to Front</span></div>
      <div class="bcm-item" id="bcm-back"><span>⬇️ Send to Back</span></div>
      <div class="bcm-divider"></div>
      <div class="bcm-item danger" id="bcm-delete"><span>🗑️ Delete</span><span class="bcm-kbd">Del</span></div>
    `;
    document.body.appendChild(menu);
    contextMenu = menu;

    menu.querySelector('#bcm-copy')?.addEventListener('click', () => { copy(); hideContextMenu(); });
    menu.querySelector('#bcm-cut')?.addEventListener('click', () => { cut(); hideContextMenu(); });
    menu.querySelector('#bcm-paste')?.addEventListener('click', () => { paste(); hideContextMenu(); });
    menu.querySelector('#bcm-duplicate')?.addEventListener('click', () => { duplicate(); hideContextMenu(); });
    menu.querySelector('#bcm-front')?.addEventListener('click', () => { bringToFront(); });
    menu.querySelector('#bcm-back')?.addEventListener('click', () => { sendToBack(); });
    menu.querySelector('#bcm-delete')?.addEventListener('click', () => { deleteSelected(); hideContextMenu(); });

    // Dismiss context menu on document click
    document.addEventListener('pointerdown', (e) => {
      if (contextMenu && !contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });

    // Right-click event on canvas zone
    const zone = document.getElementById('canvas-zone');
    if (zone) {
      zone.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
      });
      zone.addEventListener('pointermove', (e) => {
        if (typeof Canvas !== 'undefined' && Canvas.getBoardPos) {
          lastPointerPos = Canvas.getBoardPos(e);
        }
      });
    }
  }

  function showSelectionToolbar() {
    if (!selectionToolbar) createDomElements();
    if (!hasSelection() || !selectionToolbar) return;
    selectionToolbar.classList.remove('hidden');
    updateSelectionToolbarPosition();
  }

  function hideSelectionToolbar() {
    if (selectionToolbar) selectionToolbar.classList.add('hidden');
  }

  function updateSelectionToolbarPosition() {
    if (!selectionToolbar || !hasSelection() || !selectionBounds) return;
    if (selectionToolbar.classList.contains('hidden')) return;

    if (typeof Canvas === 'undefined' || !Canvas.boardToScreen) return;

    const b = selectionBounds;
    const sp = Canvas.boardToScreen(b.x + b.w / 2, b.y);
    const zone = document.getElementById('canvas-zone');
    const rect = zone ? zone.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    const screenX = rect.left + sp.x;
    let screenY = rect.top + sp.y - 48;

    // If too close to top bar, show below selection instead
    if (screenY < rect.top + 50) {
      const bottomSp = Canvas.boardToScreen(b.x + b.w / 2, b.y + b.h);
      screenY = rect.top + bottomSp.y + 16;
    }

    selectionToolbar.style.left = `${Math.max(16, Math.min(window.innerWidth - 240, screenX))}px`;
    selectionToolbar.style.top = `${Math.max(10, screenY)}px`;
  }

  function showContextMenu(screenX, screenY) {
    if (!contextMenu) createDomElements();
    if (!contextMenu) return;

    const hasSel = hasSelection();
    const hasClip = hasClipboardData();

    // Toggle disabled items
    const copyItem = contextMenu.querySelector('#bcm-copy');
    const cutItem = contextMenu.querySelector('#bcm-cut');
    const pasteItem = contextMenu.querySelector('#bcm-paste');
    const dupItem = contextMenu.querySelector('#bcm-duplicate');
    const delItem = contextMenu.querySelector('#bcm-delete');
    const frontItem = contextMenu.querySelector('#bcm-front');
    const backItem = contextMenu.querySelector('#bcm-back');

    if (copyItem) copyItem.classList.toggle('disabled', !hasSel);
    if (cutItem) cutItem.classList.toggle('disabled', !hasSel);
    if (dupItem) dupItem.classList.toggle('disabled', !hasSel);
    if (delItem) delItem.classList.toggle('disabled', !hasSel);
    if (frontItem) frontItem.classList.toggle('disabled', !hasSel || selectedShapes.length === 0);
    if (backItem) backItem.classList.toggle('disabled', !hasSel || selectedShapes.length === 0);
    if (pasteItem) pasteItem.classList.toggle('disabled', !hasClip);

    contextMenu.classList.remove('hidden');

    const mw = contextMenu.offsetWidth || 180;
    const mh = contextMenu.offsetHeight || 220;
    const posX = Math.min(screenX, window.innerWidth - mw - 10);
    const posY = Math.min(screenY, window.innerHeight - mh - 10);

    contextMenu.style.left = `${Math.max(10, posX)}px`;
    contextMenu.style.top = `${Math.max(10, posY)}px`;
  }

  function hideContextMenu() {
    if (contextMenu) contextMenu.classList.add('hidden');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  function init() {
    createDomElements();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    startLasso,
    continueLasso,
    endLasso,
    selectSingleShape,
    selectSingleStroke,
    clearSelection,
    isPointInSelection,
    startMoveSelected,
    moveSelected,
    endMoveSelected,
    copy,
    paste,
    cut,
    duplicate,
    deleteSelected,
    bringToFront,
    sendToBack,
    renderSelectionOverlay,
    showContextMenu,
    hideContextMenu,
    hitTestStroke,

    get isLassoing() { return isLassoing; },
    get isDraggingSelection() { return isDraggingSelection; },
    hasSelection: () => selectedShapes.length > 0 || selectedStrokes.length > 0,
    hasClipboardData: () => !!clipboardData && (clipboardData.shapes.length > 0 || clipboardData.strokes.length > 0),
    getSelectedShapes: () => selectedShapes,
    getSelectedStrokes: () => selectedStrokes,
    getSelectionBounds: () => selectionBounds
  };

})();
