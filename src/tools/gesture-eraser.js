'use strict';

// ══════════════════════════════════════════════════════════════════════════
// 3-FINGER GESTURE ERASER — Multi-Touch SmartBoard Eraser
// Automatically triggers when a teacher touches canvas with 3+ fingers.
// Smoothly erases raster strokes and intersecting vector shapes.
// Treats the entire multi-touch gesture as a single undoable action.
// Restores the previous active tool when fingers are lifted.
// ══════════════════════════════════════════════════════════════════════════

const GestureEraser = (() => {
  let isActive       = false;
  let previousTool   = 'pen';
  let lastCentroid   = null;
  let lastRadius     = 40;
  let historySaved   = false;
  let auraCtx        = null;

  function getAuraCanvas() {
    let ac = document.getElementById('gesture-eraser-aura');
    const zone = document.getElementById('canvas-zone');
    if (!zone) return null;
    const dpr = window.devicePixelRatio || 1;
    const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: zone.offsetWidth, H: zone.offsetHeight };
    const logicalW = size.W || zone.offsetWidth;
    const logicalH = size.H || zone.offsetHeight;

    if (!ac) {
      ac = document.createElement('canvas');
      ac.id = 'gesture-eraser-aura';
      ac.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:90;';
      const vp = document.getElementById('canvas-viewport');
      if (vp) vp.appendChild(ac);
      else zone.appendChild(ac);
    }

    const targetW = Math.round(logicalW * dpr);
    const targetH = Math.round(logicalH * dpr);
    if (ac.width !== targetW || ac.height !== targetH) {
      ac.width = targetW;
      ac.height = targetH;
      ac.style.width = logicalW + 'px';
      ac.style.height = logicalH + 'px';
      auraCtx = ac.getContext('2d');
      if (auraCtx) auraCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return ac;
  }

  function getAuraCtx() {
    const ac = getAuraCanvas();
    if (!ac) return null;
    if (!auraCtx || auraCtx.canvas !== ac) {
      auraCtx = ac.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      if (auraCtx) auraCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return auraCtx;
  }

  function clearAura() {
    const ac = document.getElementById('gesture-eraser-aura');
    if (ac && auraCtx) {
      const zone = document.getElementById('canvas-zone');
      const w = zone ? zone.offsetWidth : ac.width;
      const h = zone ? zone.offsetHeight : ac.height;
      auraCtx.clearRect(0, 0, w, h);
    }
  }

  function drawAura(cx, cy, r) {
    const ctx = getAuraCtx();
    const ac = getAuraCanvas();
    if (!ctx || !ac) return;

    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const zone = document.getElementById('canvas-zone');
    const w = zone ? zone.offsetWidth : ac.width;
    const h = zone ? zone.offsetHeight : ac.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }

    // Subtle glowing eraser aura circle with inner soft gradient
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
    grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.12)');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0.02)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Clean dashed outer perimeter ring
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Center icon / badge
    ctx.setLineDash([]);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧹 Eraser', cx, cy);

    ctx.restore();
  }

  // Calculate centroid and radius from 3+ touch points
  function computeGestureGeometry(touches, getPosFn) {
    if (!touches || touches.length < 3) return null;
    const getPos = getPosFn || ((t) => (typeof Canvas !== 'undefined' && Canvas.getPosFromTouch) ? Canvas.getPosFromTouch(t) : { x: t.clientX, y: t.clientY });
    const points = [];
    let sumX = 0, sumY = 0;

    for (let i = 0; i < touches.length; i++) {
      const pos = getPos(touches[i]);
      points.push(pos);
      sumX += pos.x;
      sumY += pos.y;
    }

    const cx = sumX / points.length;
    const cy = sumY / points.length;

    let maxDist = 0;
    for (const p of points) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d > maxDist) maxDist = d;
    }

    // Dynamic radius: covers fingers + comfortable margin (min 40px, max 220px)
    const r = Math.max(40, Math.min(220, maxDist + 24));
    return { cx, cy, r, points };
  }

  function handleTouchStart(e, getPosFn) {
    if (e.touches.length >= 3) {
      e.preventDefault();

      if (!isActive) {
        isActive = true;
        previousTool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
        historySaved = false;

        // Visual feedback toast
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('🧹 3-Finger Eraser Active');
        }
      }

      // Save history ONCE at start of the entire multi-touch gesture
      if (!historySaved && typeof Canvas !== 'undefined' && Canvas.saveHistory) {
        Canvas.saveHistory();
        historySaved = true;
      }

      const geom = computeGestureGeometry(e.touches, getPosFn);
      if (geom) {
        lastCentroid = { x: geom.cx, y: geom.cy };
        lastRadius   = geom.r;
        drawAura(geom.cx, geom.cy, geom.r);
        performErase(geom.cx, geom.cy, geom.r, lastCentroid);
      }
      return true;
    }
    return false;
  }

  function handleTouchMove(e, getPosFn) {
    if (isActive && e.touches.length >= 3) {
      e.preventDefault();

      const geom = computeGestureGeometry(e.touches, getPosFn);
      if (geom) {
        const prev = lastCentroid || { x: geom.cx, y: geom.cy };
        drawAura(geom.cx, geom.cy, geom.r);
        performErase(geom.cx, geom.cy, geom.r, prev);
        lastCentroid = { x: geom.cx, y: geom.cy };
        lastRadius   = geom.r;
      }
      return true;
    }
    return false;
  }

  function handleTouchEnd(e) {
    if (isActive) {
      // If fingers dropped below 3, finish gesture
      if (e.touches.length < 3) {
        finishGesture();
        return true;
      }
    }
    return false;
  }

  function handleTouchCancel() {
    if (isActive) {
      finishGesture();
    }
  }

  function finishGesture() {
    if (!isActive) return;
    isActive     = false;
    lastCentroid = null;
    clearAura();

    // Restore previous tool cleanly
    if (typeof App !== 'undefined' && App.setTool && previousTool) {
      App.setTool(previousTool);
    }
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  // Smoothly erase raster strokes on draw-canvas and intersecting shapes
  function performErase(cx, cy, r, prev) {
    // 1. Erase raster drawing strokes on draw-canvas and vector strokes
    if (typeof Canvas !== 'undefined') {
      const ctx = Canvas.getDrawCtx();
      if (ctx) {
        ctx.save();
        const dpr = Canvas.getDPR ? Canvas.getDPR() : (window.devicePixelRatio || 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (Canvas.applyTransformToCtx) Canvas.applyTransformToCtx(ctx);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = r * 2;

        ctx.beginPath();
        if (prev) {
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cx, cy);
        } else {
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        // Also stamp a solid circular clear at current center
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
      if (Canvas.eraseAtPoint) {
        Canvas.eraseAtPoint(cx, cy, r);
      }
    }

    // 2. Erase vector shapes on shape-canvas if intersecting
    if (typeof Canvas !== 'undefined' && Canvas.getShapes) {
      let shapes = Canvas.getShapes();
      const initialCount = shapes.length;

      shapes = shapes.filter(s => {
        // Never auto-erase background images or locked shapes
        if (s.type === 'image' || s.locked) return true;
        const b = (typeof Shapes !== 'undefined') ? Shapes.getBounds(s) : { x: s.x, y: s.y, w: s.w || 40, h: s.h || 40 };

        // Check circle vs rectangle intersection
        const nearestX = Math.max(b.x, Math.min(cx, b.x + b.w));
        const nearestY = Math.max(b.y, Math.min(cy, b.y + b.h));
        const distSq = (cx - nearestX) ** 2 + (cy - nearestY) ** 2;

        return distSq > (r * r);
      });

      if (shapes.length !== initialCount) {
        if (Canvas.setShapes) {
          Canvas.setShapes(shapes);
        } else if (Canvas.loadPageState) {
          Canvas.loadPageState(shapes, null, Canvas.getBgImage());
        }
      }
    }
  }

  return {
    isErasing: () => isActive,
    isActive:  () => isActive,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    finishGesture
  };
})();
