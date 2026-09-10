'use strict';

// ══════════════════════════════════════════════════════════════════════════
// GEOMETRY TOOL & MEASUREMENT ENGINE
// Professional Interactive Compass, Measured Line, and Angle Measurement.
// Supports smart vertex/point snapping, Euclidean calculations, dynamic badges,
// and full vector geometry object generation.
// ══════════════════════════════════════════════════════════════════════════

const GeometryTool = (() => {
  const SCALE = 0.1; // 10 px = 1 cm
  const SNAP_THRESHOLD = 32; // px - optimized for 65" SmartBoard finger/touch precision

  let currentMode = null; // 'measure-line' | 'measure-angle' | 'compass'
  let state = {
    step: 0,
    startPoint: null,
    currentPoint: null,
    vertex: null,
    pointA: null,
    pointB: null,
    center: null,
    radius: 0
  };

  let activeSnapPoint = null;

  // ─────────────────────────────────────────────────────────
  // MATH & FORMATTING
  // ─────────────────────────────────────────────────────────
  function distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  function formatLength(px, unit = 'cm') {
    let val = px * SCALE;
    if (unit === 'mm') val *= 10;
    if (unit === 'm')  val *= 0.01;

    // Smart precision: 5 cm, 5.2 cm, 5.25 cm
    if (Math.abs(val - Math.round(val)) < 0.03) {
      return `${Math.round(val)} ${unit}`;
    }
    if (Math.abs(val * 10 - Math.round(val * 10)) < 0.1) {
      return `${val.toFixed(1)} ${unit}`;
    }
    return `${val.toFixed(2)} ${unit}`;
  }

  function calculateAngle(v, p1, p2) {
    const v1 = { x: p1.x - v.x, y: p1.y - v.y };
    const v2 = { x: p2.x - v.x, y: p2.y - v.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 < 1e-4 || mag2 < 1e-4) return 0;
    let cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    let rad = Math.acos(cosTheta);
    return (rad * 180) / Math.PI;
  }

  function formatAngle(deg) {
    if (Math.abs(deg - Math.round(deg)) < 0.05) {
      return `${Math.round(deg)}°`;
    }
    return `${deg.toFixed(1)}°`;
  }

  // ─────────────────────────────────────────────────────────
  // SMART POINT DETECTION / SNAPPING
  // ─────────────────────────────────────────────────────────
  function getAllSnapPoints() {
    const points = [];
    if (typeof Canvas === 'undefined' || !Canvas.getShapes) return points;
    const shapes = Canvas.getShapes();

    shapes.forEach(s => {
      if (!s) return;
      // Line / measured-line
      if (s.type === 'measured-line') {
        points.push({ x: s.x1, y: s.y1, name: s.labelA || 'A' });
        points.push({ x: s.x2, y: s.y2, name: s.labelB || 'B' });
        points.push({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, name: 'M' });
      }
      // Measured Angle
      else if (s.type === 'measured-angle') {
        if (s.vertex) points.push({ x: s.vertex.x, y: s.vertex.y, name: 'V' });
        if (s.pointA) points.push({ x: s.pointA.x, y: s.pointA.y, name: 'A' });
        if (s.pointB) points.push({ x: s.pointB.x, y: s.pointB.y, name: 'B' });
      }
      // Measured Circle / circle
      else if (s.type === 'measured-circle' || s.type === 'circle') {
        const cx = s.cx !== undefined ? s.cx : s.x + (s.r || 0);
        const cy = s.cy !== undefined ? s.cy : s.y + (s.r || 0);
        points.push({ x: cx, y: cy, name: 'O' });
        if (s.r) {
          points.push({ x: cx + s.r, y: cy, name: 'R' });
          points.push({ x: cx - s.r, y: cy, name: 'L' });
          points.push({ x: cx, y: cy + s.r, name: 'B' });
          points.push({ x: cx, y: cy - s.r, name: 'T' });
        }
      }
      // Rectangle / Square
      else if (s.type === 'rectangle' || s.type === 'square') {
        points.push({ x: s.x, y: s.y, name: 'P' });
        points.push({ x: s.x + s.w, y: s.y, name: 'P' });
        points.push({ x: s.x + s.w, y: s.y + s.h, name: 'P' });
        points.push({ x: s.x, y: s.y + s.h, name: 'P' });
        points.push({ x: s.x + s.w/2, y: s.y + s.h/2, name: 'C' });
      }
      // Triangles
      else if (s.type === 'triangle' || s.type === 'equilateral') {
        const w = s.w || s.base || s.side || 100;
        const h = s.h || s.height || (s.side ? s.side * Math.sqrt(3)/2 : 80);
        points.push({ x: s.x + w/2, y: s.y, name: 'A' });
        points.push({ x: s.x + w, y: s.y + h, name: 'B' });
        points.push({ x: s.x, y: s.y + h, name: 'C' });
      }
      else if (s.type === 'rightTriangle') {
        points.push({ x: s.x, y: s.y, name: 'A' });
        points.push({ x: s.x, y: s.y + s.height, name: 'B' });
        points.push({ x: s.x + s.base, y: s.y + s.height, name: 'C' });
      }
    });

    return points;
  }

  function getSnap(pos) {
    const snaps = getAllSnapPoints();
    let best = null;
    let minD = SNAP_THRESHOLD;

    for (const sp of snaps) {
      const d = Math.hypot(pos.x - sp.x, pos.y - sp.y);
      if (d < minD) {
        minD = d;
        best = sp;
      }
    }

    activeSnapPoint = best;
    if (best) {
      return { x: best.x, y: best.y, snapped: true, name: best.name };
    }
    return { x: pos.x, y: pos.y, snapped: false };
  }

  // ─────────────────────────────────────────────────────────
  // PREVIEW CANVAS RENDERING
  // ─────────────────────────────────────────────────────────
  function getPreviewCtx() {
    let pc = document.getElementById('preview-canvas');
    if (!pc) {
      const zone = document.getElementById('canvas-zone');
      if (!zone) return null;
      pc = document.createElement('canvas');
      pc.id = 'preview-canvas';
      pc.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:15;';
      const size = (typeof Canvas !== 'undefined') ? Canvas.getCanvasSize() : { W: zone.offsetWidth, H: zone.offsetHeight };
      pc.width  = size.W || zone.offsetWidth;
      pc.height = size.H || zone.offsetHeight;
      const vp = document.getElementById('canvas-viewport');
      if (vp) vp.appendChild(pc);
      else zone.appendChild(pc);
    }
    return pc.getContext('2d');
  }

  function clearPreview() {
    const pc = document.getElementById('preview-canvas');
    if (pc) {
      const ctx = pc.getContext('2d');
      ctx.clearRect(0, 0, pc.width, pc.height);
    }
  }

  // Draw snap indicator ring
  function drawSnapIndicator(ctx, snap) {
    if (!snap) return;
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle   = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(snap.x, snap.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crosshair - larger for 65" SmartBoard
    ctx.beginPath();
    ctx.moveTo(snap.x - 16, snap.y);
    ctx.lineTo(snap.x + 16, snap.y);
    ctx.moveTo(snap.x, snap.y - 16);
    ctx.lineTo(snap.x, snap.y + 16);
    ctx.stroke();

    if (snap.name) {
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(snap.name, snap.x + 12, snap.y - 12);
    }
    ctx.restore();
  }

  // Dimension Badge helper - enlarged for 65" SmartBoard readability
  function drawBadge(ctx, x, y, text, color = '#38bdf8') {
    ctx.save();
    ctx.font = '600 15px "JetBrains Mono", Inter, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    const pw = tw + 18, ph = 28;

    // Dark pill container
    ctx.fillStyle = 'rgba(8, 15, 31, 0.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - pw/2, y - ph/2, pw, ph, 8);
    else ctx.rect(x - pw/2, y - ph/2, pw, ph);
    ctx.fill();
    ctx.stroke();

    // Text readout
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────
  // INTERACTIVE CONTROLLERS
  // ─────────────────────────────────────────────────────────

  // 1. MEASURED LINE
  function startMeasuredLine(pos) {
    const snap = getSnap(pos);
    state.startPoint = snap;
    state.currentPoint = snap;
    state.step = 1;
    renderLinePreview();
  }

  function moveMeasuredLine(pos) {
    if (state.step !== 1) return;
    state.currentPoint = getSnap(pos);
    renderLinePreview();
  }

  function renderLinePreview() {
    const ctx = getPreviewCtx();
    if (!ctx || !state.startPoint || !state.currentPoint) return;
    clearPreview();

    const p1 = state.startPoint;
    const p2 = state.currentPoint;
    const d  = distance(p1, p2);
    const color = (typeof App !== 'undefined') ? App.currentColor : '#38bdf8';

    ctx.save();

    // Construction Line
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Endpoint dots - larger for 65" SmartBoard
    [p1, p2].forEach((p, idx) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Point letter
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillStyle = color;
      const lbl = idx === 0 ? 'A' : 'B';
      ctx.fillText(lbl, p.x + 10, p.y - 10);
    });

    // Midpoint dimension badge
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    // Offset badge perpendicular to line
    const offX = -Math.sin(angle) * 18;
    const offY =  Math.cos(angle) * 18;

    drawBadge(ctx, mx + offX, my + offY, formatLength(d), color);
    drawSnapIndicator(ctx, activeSnapPoint);

    ctx.restore();
  }

  function endMeasuredLine() {
    if (state.step !== 1) return;
    clearPreview();

    const p1 = state.startPoint;
    const p2 = state.currentPoint;
    state.step = 0;
    state.startPoint = null;
    state.currentPoint = null;

    if (!p1 || !p2 || distance(p1, p2) < 8) return;

    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);

    // Commit vector shape
    const color = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';
    const shape = {
      id: Date.now(),
      type: 'measured-line',
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(Math.max(20, maxX - minX)),
      h: Math.round(Math.max(20, maxY - minY)),
      x1: Math.round(p1.x),
      y1: Math.round(p1.y),
      x2: Math.round(p2.x),
      y2: Math.round(p2.y),
      labelA: 'A',
      labelB: 'B',
      unit: 'cm',
      color: color,
      selected: true
    };

    if (typeof Canvas !== 'undefined') {
      Canvas.addShapeObject(shape);
      if (Canvas.selectShape) Canvas.selectShape(shape);
    }
  }

  // 2. ANGLE MEASUREMENT
  function startMeasuredAngle(pos) {
    const snap = getSnap(pos);
    if (state.step === 0) {
      // Step 1: Set vertex V, start positioning Arm A
      state.vertex = { x: snap.x, y: snap.y };
      state.pointA = { x: snap.x + 110, y: snap.y };
      state.pointB = { x: snap.x + 110, y: snap.y };
      state.step = 1;
      state.isDragging = true;
      state.armALockedTime = Date.now();
      renderAnglePreview();
    } else if (state.step === 1) {
      // Step 2: Lock Arm A, start measuring Arm B continuously
      if (distance(state.vertex, snap) > 12) {
        state.pointA = { x: snap.x, y: snap.y };
      }
      state.pointB = { x: snap.x, y: snap.y };
      state.step = 2;
      state.armALockedTime = Date.now();
      state.isDragging = false;
      renderAnglePreview();
    } else if (state.step === 2) {
      // Step 3: Final click locks Arm B and commits the angle
      if (Date.now() - (state.armALockedTime || 0) > 120 && distance(state.vertex, snap) > 12) {
        state.pointB = { x: snap.x, y: snap.y };
        commitAngle();
      }
    }
  }

  function moveMeasuredAngle(pos) {
    if (state.step === 0) return;
    const snap = getSnap(pos);
    if (state.step === 1) {
      state.pointA = { x: snap.x, y: snap.y };
      renderAnglePreview();
    } else if (state.step === 2) {
      state.pointB = { x: snap.x, y: snap.y };
      renderAnglePreview();
    }
  }

  function endMeasuredAngle() {
    if (state.step === 1 && state.isDragging) {
      if (distance(state.vertex, state.pointA) > 20) {
        state.step = 2;
        state.armALockedTime = Date.now();
        state.isDragging = false;
        state.pointB = { ...state.pointA };
        renderAnglePreview();
      }
    }
  }

  function renderAnglePreview() {
    const ctx = getPreviewCtx();
    if (!ctx || !state.vertex) return;
    clearPreview();

    const v = state.vertex;
    const pA = state.pointA || v;
    const pB = state.pointB || pA;
    const color = (typeof App !== 'undefined') ? App.currentColor : '#38bdf8';

    ctx.save();

    // Step 1: Baseline Arm A positioning
    if (state.step === 1) {
      const distA = distance(v, pA);
      // Horizontal reference dashed guide line from V
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(v.x + Math.max(90, distA), v.y);
      ctx.stroke();
      ctx.restore();

      if (distA > 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(pA.x, pA.y);
        ctx.stroke();

        const baseRad = Math.atan2(pA.y - v.y, pA.x - v.x);
        let baseDeg = (-baseRad * 180 / Math.PI + 360) % 360;
        if (baseDeg > 180) baseDeg = 360 - baseDeg;

        const arcR = Math.min(42, Math.max(20, distA * 0.4));
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(v.x, v.y, arcR, 0, baseRad, baseRad < 0);
        ctx.stroke();

        const badgeX = v.x + Math.cos(baseRad / 2) * (arcR + 24);
        const badgeY = v.y + Math.sin(baseRad / 2) * (arcR + 24);
        drawBadge(ctx, badgeX, badgeY, `∠ = ${formatAngle(baseDeg)}`, '#f59e0b');

        // Continuous cursor badge
        drawBadge(ctx, pA.x + 18, pA.y - 14, `${formatAngle(baseDeg)} · ${formatLength(distA)}`, '#38bdf8');
      }

      // Endpoint A dot
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(pA.x, pA.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('A', pA.x + 10, pA.y - 10);
    }

    // Step 2: Continuous live angle measurement while moving Arm B
    if (state.step === 2) {
      // Ray 1: V -> A (Locked Baseline)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(pA.x, pA.y);
      ctx.stroke();

      // Endpoint A dot
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(pA.x, pA.y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText('A', pA.x + 10, pA.y - 10);

      // Ray 2: V -> B (Live Moving Arm)
      const distB = distance(v, pB);
      if (distB > 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        // Endpoint B dot
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(pB.x, pB.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('B', pB.x + 10, pB.y - 10);

        // Calculations
        const angA = Math.atan2(pA.y - v.y, pA.x - v.x);
        const angB = Math.atan2(pB.y - v.y, pB.x - v.x);
        const deg = calculateAngle(v, pA, pB);
        const arcR = Math.min(54, Math.max(26, Math.min(distance(v, pA), distB) * 0.45));

        let diff = angB - angA;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI)  diff -= Math.PI * 2;

        // Shaded interior sector
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.arc(v.x, v.y, arcR, angA, angA + diff, diff < 0);
        ctx.closePath();
        ctx.fill();

        // Check for right-angle (90°)
        if (Math.abs(deg - 90) < 1.8) {
          const sq = 16;
          const uA = { x: Math.cos(angA) * sq, y: Math.sin(angA) * sq };
          const uB = { x: Math.cos(angB) * sq, y: Math.sin(angB) * sq };
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(v.x + uA.x, v.y + uA.y);
          ctx.lineTo(v.x + uA.x + uB.x, v.y + uA.y + uB.y);
          ctx.lineTo(v.x + uB.x, v.y + uB.y);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(v.x, v.y, arcR, angA, angA + diff, diff < 0);
          ctx.stroke();
        }

        // Central floating angle badge
        const midAng = angA + diff / 2;
        const badgeX = v.x + Math.cos(midAng) * (arcR + 28);
        const badgeY = v.y + Math.sin(midAng) * (arcR + 28);
        drawBadge(ctx, badgeX, badgeY, `∠ = ${formatAngle(deg)}`, '#f59e0b');

        // Continuous live angle readout right at cursor / Arm B
        const cursorBadgeX = pB.x + (Math.cos(angB) >= 0 ? 22 : -22);
        const cursorBadgeY = pB.y + (Math.sin(angB) >= 0 ? 18 : -18);
        drawBadge(ctx, cursorBadgeX, cursorBadgeY, `📐 ${formatAngle(deg)}`, '#f59e0b');
      }
    }

    // Vertex marker V - larger for 65" SmartBoard
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText('V', v.x - 16, v.y - 8);

    drawSnapIndicator(ctx, activeSnapPoint);
    ctx.restore();
  }

  function commitAngle() {
    clearPreview();
    const v  = state.vertex;
    const pA = state.pointA;
    const pB = state.pointB;
    state.step = 0;
    state.vertex = null;
    state.pointA = null;
    state.pointB = null;

    if (!v || !pA || !pB || distance(v, pA) < 10 || distance(v, pB) < 10) return;

    const minX = Math.min(v.x, pA.x, pB.x);
    const minY = Math.min(v.y, pA.y, pB.y);
    const maxX = Math.max(v.x, pA.x, pB.x);
    const maxY = Math.max(v.y, pA.y, pB.y);
    const deg = calculateAngle(v, pA, pB);
    const color = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';

    const shape = {
      id: Date.now(),
      type: 'measured-angle',
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(Math.max(20, maxX - minX)),
      h: Math.round(Math.max(20, maxY - minY)),
      vx: Math.round(v.x),
      vy: Math.round(v.y),
      ax: Math.round(pA.x),
      ay: Math.round(pA.y),
      bx: Math.round(pB.x),
      by: Math.round(pB.y),
      degrees: +(deg.toFixed(1)),
      color: color,
      selected: true
    };

    if (typeof Canvas !== 'undefined') {
      Canvas.addShapeObject(shape);
      if (Canvas.selectShape) Canvas.selectShape(shape);
    }
  }

  // 3. COMPASS TOOL
  function startCompass(pos) {
    const snap = getSnap(pos);
    state.center = snap;
    state.currentPoint = snap;
    state.radius = 0;
    state.step = 1;
    renderCompassPreview();
  }

  function moveCompass(pos) {
    if (state.step !== 1) return;
    state.currentPoint = getSnap(pos);
    state.radius = distance(state.center, state.currentPoint);
    renderCompassPreview();
  }

  function renderCompassPreview() {
    const ctx = getPreviewCtx();
    if (!ctx || !state.center || !state.currentPoint) return;
    clearPreview();

    const c = state.center;
    const p = state.currentPoint;
    const r = distance(c, p);
    const color = (typeof App !== 'undefined') ? App.currentColor : '#38bdf8';

    ctx.save();

    // Circle being inscribed
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dashed Radius Guide Line
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.8)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── DIGITAL COMPASS INSTRUMENT OVERLAY ──
    // Needle tip at center
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Stylus / Pencil tip at circumference
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Compass Hinged Head (above center and rim)
    const midX = (c.x + p.x) / 2;
    const midY = (c.y + p.y) / 2;
    const angle = Math.atan2(p.y - c.y, p.x - c.x);
    const hingeDist = Math.max(30, r * 0.7);
    const hx = midX - Math.sin(angle) * hingeDist;
    const hy = midY + Math.cos(angle) * hingeDist;

    // Metallic legs of compass
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(hx, hy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // Hinge knob
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Radius Measurement Badge at radius midpoint
    const rBadgeX = (c.x + p.x) / 2;
    const rBadgeY = (c.y + p.y) / 2 - 16;
    drawBadge(ctx, rBadgeX, rBadgeY, `r = ${formatLength(r)}`, '#eab308');

    // Labels O and P
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillStyle = '#eab308';
    ctx.fillText('O', c.x - 14, c.y - 10);

    drawSnapIndicator(ctx, activeSnapPoint);
    ctx.restore();
  }

  function endCompass() {
    if (state.step !== 1) return;
    clearPreview();

    const c = state.center;
    const p = state.currentPoint;
    const r = distance(c, p);
    state.step = 0;
    state.center = null;
    state.currentPoint = null;

    if (!c || !p || r < 8) return;

    const color = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';
    const shape = {
      id: Date.now(),
      type: 'measured-circle',
      x: Math.round(c.x - r),
      y: Math.round(c.y - r),
      w: Math.round(r * 2),
      h: Math.round(r * 2),
      cx: Math.round(c.x),
      cy: Math.round(c.y),
      r:  Math.round(r),
      label: `r = ${formatLength(r)}`,
      unit: 'cm',
      color: color,
      selected: true
    };

    if (typeof Canvas !== 'undefined') {
      Canvas.addShapeObject(shape);
      if (Canvas.selectShape) Canvas.selectShape(shape);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC ROUTING FOR CANVAS EVENTS
  // ─────────────────────────────────────────────────────────
  function handleDown(pos, tool) {
    if (tool === 'measure-line') {
      startMeasuredLine(pos);
      return true;
    } else if (tool === 'measure-angle') {
      startMeasuredAngle(pos);
      return true;
    } else if (tool === 'compass') {
      startCompass(pos);
      return true;
    }
    return false;
  }

  function handleMove(pos, tool) {
    if (tool === 'measure-line') {
      moveMeasuredLine(pos);
      return true;
    } else if (tool === 'measure-angle') {
      moveMeasuredAngle(pos);
      return true;
    } else if (tool === 'compass') {
      moveCompass(pos);
      return true;
    }
    return false;
  }

  function handleUp(pos, tool) {
    if (tool === 'measure-line') {
      endMeasuredLine();
      return true;
    } else if (tool === 'measure-angle') {
      endMeasuredAngle();
      return true;
    } else if (tool === 'compass') {
      endCompass();
      return true;
    }
    return false;
  }

  function cancel() {
    clearPreview();
    state = {
      step: 0,
      startPoint: null,
      currentPoint: null,
      vertex: null,
      pointA: null,
      pointB: null,
      center: null,
      radius: 0
    };
    activeSnapPoint = null;
  }

  return {
    handleDown,
    handleMove,
    handleUp,
    cancel,
    getSnap,
    formatLength,
    formatAngle,
    SCALE
  };
})();
