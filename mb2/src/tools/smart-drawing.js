'use strict';

// ══════════════════════════════════════════════════════════════════
// SMART DRAWING ENGINE — AI & Geometric Rough Shape Recognition
// Converts natural rough drawings into clean, precise math shapes
// ══════════════════════════════════════════════════════════════════

const SmartDrawing = (() => {

  // ─────────────────────────────────────────────
  // CONFIGURATION & THRESHOLDS (Centralized)
  // ─────────────────────────────────────────────
  const CONFIG = {
    confidenceThreshold: 0.70,      // Below this, stroke is kept as natural ink
    closureRatioThreshold: 0.22,    // dist(start, end) / totalLength < this => closed
    closurePixelThreshold: 42,      // Absolute distance between endpoints to consider closed
    squareRatioTolerance: 0.18,     // |width - height| / max(w, h) < this => square
    rightAngleToleranceDeg: 16,     // Angle deviation from 90° for rectangular corners
    straightnessThreshold: 0.90,    // Segment length / arc length for straight lines
    circleRadialVarianceMax: 0.17,  // Max normalized std dev of radius for circle
    circleAspectRatioMin: 0.78,     // Min width/height ratio for circle
    ellipseRadialVarianceMax: 0.26, // Max normalized variance for ellipse
    simplificationEpsilonRatio: 0.045 // Epsilon as ratio of bounding box diagonal
  };

  let isDrawing = false;
  let rawStroke = []; // [{ x, y, t }]
  let strokeCtx = null;
  let strokeCanvas = null;
  let holdTimer = null;
  let convertedInHold = false;

  function getStrokeCanvas() {
    let sc = document.getElementById('smart-draw-preview');
    if (!sc) {
      const zone = document.getElementById('canvas-zone');
      const vp   = document.getElementById('canvas-viewport');
      sc = document.createElement('canvas');
      sc.id = 'smart-draw-preview';
      sc.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:6;';
      const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: 0, H: 0 };
      sc.width = size.W || (vp ? vp.offsetWidth : 1200);
      sc.height = size.H || (vp ? vp.offsetHeight : 800);
      if (vp) vp.appendChild(sc);
      else if (zone) zone.appendChild(sc);
    }
    return sc;
  }

  function getStrokeCtx() {
    const sc = getStrokeCanvas();
    return sc ? sc.getContext('2d') : null;
  }

  function clearStrokePreview() {
    const sc = getStrokeCanvas();
    if (sc) {
      const ctx = sc.getContext('2d');
      ctx.clearRect(0, 0, sc.width, sc.height);
    }
  }

  // ─────────────────────────────────────────────
  // POINTER & TOUCH STROKE EVENT HANDLERS
  // ─────────────────────────────────────────────
  function onDown(pos) {
    if (holdTimer) clearTimeout(holdTimer);
    convertedInHold = false;
    isDrawing = true;
    rawStroke = [{ x: pos.x, y: pos.y, t: Date.now() }];

    strokeCanvas = getStrokeCanvas();
    strokeCtx = getStrokeCtx();
    clearStrokePreview();

    // Render initial point
    if (strokeCtx) {
      strokeCtx.save();
      strokeCtx.fillStyle = App.currentColor || '#38bdf8';
      strokeCtx.beginPath();
      strokeCtx.arc(pos.x, pos.y, (App.penSize || 3) / 2, 0, Math.PI * 2);
      strokeCtx.fill();
      strokeCtx.restore();
    }
  }

  function onMove(pos) {
    if (!isDrawing || !rawStroke.length) return;
    if (convertedInHold) return;

    if (holdTimer) clearTimeout(holdTimer);

    // Filter tiny jitter duplicate points
    const last = rawStroke[rawStroke.length - 1];
    const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (dist < 2.5) return;

    rawStroke.push({ x: pos.x, y: pos.y, t: Date.now() });

    // Optional Hold-to-convert: if pen is held stationary for ~550ms after drawing
    if (rawStroke.length >= 8) {
      holdTimer = setTimeout(() => {
        if (!isDrawing || convertedInHold) return;
        const candidate = recognizeStroke(rawStroke);
        if (candidate && candidate.confidence >= CONFIG.confidenceThreshold && candidate.shape) {
          convertedInHold = true;
          clearStrokePreview();
          instantiateCleanShape(candidate.shape, candidate.label);
        }
      }, 550);
    }

    // Render smooth live ink preview
    if (strokeCtx && rawStroke.length >= 2) {
      strokeCtx.save();
      strokeCtx.strokeStyle = App.currentColor || '#38bdf8';
      strokeCtx.lineWidth   = App.penSize || 3;
      strokeCtx.lineCap     = 'round';
      strokeCtx.lineJoin    = 'round';

      const n = rawStroke.length;
      if (n >= 3) {
        const p0 = rawStroke[n - 3];
        const p1 = rawStroke[n - 2];
        const p2 = rawStroke[n - 1];
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        strokeCtx.beginPath();
        strokeCtx.moveTo(p0.x, p0.y);
        strokeCtx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
        strokeCtx.stroke();
      } else {
        strokeCtx.beginPath();
        strokeCtx.moveTo(rawStroke[0].x, rawStroke[0].y);
        strokeCtx.lineTo(pos.x, pos.y);
        strokeCtx.stroke();
      }
      strokeCtx.restore();
    }
  }

  function onUp(pos) {
    if (holdTimer) clearTimeout(holdTimer);
    if (!isDrawing) return;
    isDrawing = false;

    if (convertedInHold) {
      convertedInHold = false;
      rawStroke = [];
      return;
    }

    if (pos) {
      const last = rawStroke[rawStroke.length - 1];
      if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) > 2) {
        rawStroke.push({ x: pos.x, y: pos.y, t: Date.now() });
      }
    }

    if (rawStroke.length < 5) {
      // Too short to be a geometric shape — render to draw-canvas as dot/dash
      clearStrokePreview();
      commitAsInk(rawStroke);
      rawStroke = [];
      return;
    }

    // Run Shape Recognition Pipeline
    const candidate = recognizeStroke(rawStroke);

    if (candidate && candidate.confidence >= CONFIG.confidenceThreshold && candidate.shape) {
      // Smoothly replace stroke with clean vector geometry
      clearStrokePreview();
      instantiateCleanShape(candidate.shape, candidate.label);
    } else {
      // Keep natural drawing as raster ink without interruption
      clearStrokePreview();
      commitAsInk(rawStroke);
    }

    rawStroke = [];
  }

  // ─────────────────────────────────────────────
  // FALLBACK: COMMIT AS INK STROKE
  // ─────────────────────────────────────────────
  function commitAsInk(pts) {
    if (!pts || pts.length < 2) return;
    Canvas.saveHistory();

    const ctx = Canvas.getDrawCtx();
    ctx.save();
    ctx.strokeStyle = App.currentColor || '#ffffff';
    ctx.lineWidth   = App.penSize || 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.globalCompositeOperation = 'source-over';

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // RECOGNITION PIPELINE
  // ─────────────────────────────────────────────
  function recognizeStroke(points) {
    // 1. Resample & Compute basic metrics
    const pts = resamplePoints(points, 6);
    if (pts.length < 4) return null;

    const bounds = computeBounds(pts);
    if (bounds.w < 12 && bounds.h < 12) return null; // Ignore micro dots

    const pathLength = computePathLength(pts);
    const pStart = pts[0];
    const pEnd   = pts[pts.length - 1];
    const closureDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const closureRatio = closureDist / Math.max(1, pathLength);
    const diag = bounds.diag;

    const isClosed = (closureRatio < CONFIG.closureRatioThreshold) ||
                     (closureDist < Math.min(CONFIG.closurePixelThreshold, diag * 0.28));

    // 2. Corner Detection & Simplification (RDP)
    const epsilon = Math.max(4, diag * CONFIG.simplificationEpsilonRatio);
    const simplified = ramerDouglasPeucker(pts, epsilon);

    // 3. Test shape classifiers
    const candidates = [];

    if (isClosed) {
      // ── Test Circle ──
      const circleCand = testCircle(pts, bounds, pathLength);
      if (circleCand) candidates.push(circleCand);

      // ── Test Ellipse ──
      const ellipseCand = testEllipse(pts, bounds);
      if (ellipseCand) candidates.push(ellipseCand);

      // ── Test Quadrilaterals (Rectangle, Square, Parallelogram, Rhombus, Trapezium) ──
      const quadCand = testQuadrilateral(pts, simplified, bounds);
      if (quadCand) candidates.push(quadCand);

      // ── Test Triangle ──
      const triCand = testTriangle(pts, simplified, bounds);
      if (triCand) candidates.push(triCand);

      // ── Test Regular / General Polygon ──
      const polyCand = testPolygon(pts, simplified, bounds);
      if (polyCand) candidates.push(polyCand);

    } else {
      // ── Test Straight Line ──
      const lineCand = testLine(pts, bounds, pathLength);
      if (lineCand) candidates.push(lineCand);

      // ── Test Arrow ──
      const arrowCand = testArrow(pts, bounds, pathLength);
      if (arrowCand) candidates.push(arrowCand);

      // ── Test Measured Angle ──
      const angleCand = testAngle(pts, simplified, bounds);
      if (angleCand) candidates.push(angleCand);
    }

    if (!candidates.length) return null;

    // Pick highest confidence candidate
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: CIRCLE
  // ─────────────────────────────────────────────
  function testCircle(pts, bounds, pathLength) {
    const cx = bounds.cx;
    const cy = bounds.cy;

    // Compute radii from centroid
    let sumR = 0;
    const radii = pts.map(p => {
      const r = Math.hypot(p.x - cx, p.y - cy);
      sumR += r;
      return r;
    });
    const avgR = sumR / pts.length;
    if (avgR < 8) return null;

    // Standard deviation of radius
    let varianceSum = 0;
    radii.forEach(r => { varianceSum += (r - avgR) ** 2; });
    const stdDev = Math.sqrt(varianceSum / pts.length);
    const radialVar = stdDev / avgR;

    // Aspect ratio of bounding box
    const ar = Math.min(bounds.w, bounds.h) / Math.max(bounds.w, bounds.h);

    if (radialVar > CONFIG.circleRadialVarianceMax || ar < CONFIG.circleAspectRatioMin) {
      return null;
    }

    const confVar = Math.max(0, 1 - (radialVar / CONFIG.circleRadialVarianceMax) * 0.4);
    const confAr  = Math.max(0, 1 - (1 - ar) * 1.5);
    const conf = Math.min(0.99, (confVar * 0.6 + confAr * 0.4));

    // Preserve teacher's center, position, and radius
    const cleanRadius = Math.round((bounds.w + bounds.h) / 4);
    const cleanShape = {
      type: 'circle',
      x: Math.round(cx - cleanRadius),
      y: Math.round(cy - cleanRadius),
      r: cleanRadius,
      color: App.currentColor || '#ffffff'
    };

    return {
      type: 'circle',
      label: 'Circle',
      confidence: conf,
      shape: cleanShape
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ELLIPSE
  // ─────────────────────────────────────────────
  function testEllipse(pts, bounds) {
    const ar = Math.min(bounds.w, bounds.h) / Math.max(bounds.w, bounds.h);
    // If it's too circular, circle classifier will take precedence
    if (ar > 0.88) return null;

    const cx = bounds.cx;
    const cy = bounds.cy;
    const rx = bounds.w / 2;
    const ry = bounds.h / 2;
    if (rx < 10 || ry < 8) return null;

    // Normalized algebraic distance to ellipse: (dx/rx)^2 + (dy/ry)^2 ≈ 1
    let sumErr = 0;
    pts.forEach(p => {
      const termX = (p.x - cx) / rx;
      const termY = (p.y - cy) / ry;
      const val = Math.sqrt(termX * termX + termY * termY);
      sumErr += Math.abs(val - 1);
    });
    const avgErr = sumErr / pts.length;

    if (avgErr > CONFIG.ellipseRadialVarianceMax) return null;

    const conf = Math.max(0.65, Math.min(0.96, 1 - avgErr * 2.2));
    const cleanShape = {
      type: 'ellipse',
      x: Math.round(bounds.minX),
      y: Math.round(bounds.minY),
      rx: Math.round(rx),
      ry: Math.round(ry),
      color: App.currentColor || '#ffffff'
    };

    return {
      type: 'ellipse',
      label: 'Ellipse',
      confidence: conf,
      shape: cleanShape
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: QUADRILATERAL (Square, Rectangle, etc.)
  // ─────────────────────────────────────────────
  function testQuadrilateral(pts, simplified, bounds) {
    // Check if simplified polygon has ~4-5 vertices (including closed loop)
    let corners = getDistinctCorners(simplified);
    if (corners.length !== 4 && corners.length !== 5) {
      // Fallback: try higher simplification tolerance to isolate 4 corners
      corners = getDistinctCorners(ramerDouglasPeucker(pts, bounds.diag * 0.08));
    }

    if (corners.length !== 4) return null;

    // Compute 4 corner angles
    const angles = [];
    for (let i = 0; i < 4; i++) {
      const pPrev = corners[(i + 3) % 4];
      const pCurr = corners[i];
      const pNext = corners[(i + 1) % 4];
      const a1 = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
      const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
      let diff = Math.abs((a2 - a1) * 180 / Math.PI);
      if (diff > 180) diff = 360 - diff;
      angles.push(diff);
    }

    // Check right angles (close to 90°)
    const rightAngleDevs = angles.map(a => Math.abs(a - 90));
    const maxDev = Math.max(...rightAngleDevs);
    const avgDev = rightAngleDevs.reduce((a, b) => a + b, 0) / 4;

    const isRectangular = maxDev < CONFIG.rightAngleToleranceDeg + 10 && avgDev < CONFIG.rightAngleToleranceDeg;

    // Check aspect ratio for Square vs Rectangle
    const w = bounds.w;
    const h = bounds.h;
    const diffRatio = Math.abs(w - h) / Math.max(w, h);

    if (isRectangular) {
      if (diffRatio <= CONFIG.squareRatioTolerance) {
        // SQUARE
        const side = Math.round((w + h) / 2);
        const conf = Math.max(0.72, Math.min(0.98, 1 - (avgDev / 90) * 1.5 - diffRatio * 0.5));
        return {
          type: 'square',
          label: 'Square',
          confidence: conf,
          shape: {
            type: 'square',
            x: Math.round(bounds.cx - side / 2),
            y: Math.round(bounds.cy - side / 2),
            w: side,
            h: side,
            side: side,
            color: App.currentColor || '#ffffff'
          }
        };
      } else {
        // RECTANGLE
        const conf = Math.max(0.74, Math.min(0.98, 1 - (avgDev / 90) * 1.5));
        return {
          type: 'rectangle',
          label: 'Rectangle',
          confidence: conf,
          shape: {
            type: 'rectangle',
            x: Math.round(bounds.minX),
            y: Math.round(bounds.minY),
            w: Math.round(w),
            h: Math.round(h),
            color: App.currentColor || '#ffffff'
          }
        };
      }
    }

    // Check Parallelogram / Rhombus / Trapezium
    const sideLens = [
      Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y),
      Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y),
      Math.hypot(corners[3].x - corners[2].x, corners[3].y - corners[2].y),
      Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y)
    ];

    const oppDiff1 = Math.abs(sideLens[0] - sideLens[2]) / Math.max(sideLens[0], sideLens[2]);
    const oppDiff2 = Math.abs(sideLens[1] - sideLens[3]) / Math.max(sideLens[1], sideLens[3]);

    if (oppDiff1 < 0.28 && oppDiff2 < 0.28) {
      // Parallelogram or Rhombus
      const allSidesDiff = Math.abs(sideLens[0] - sideLens[1]) / Math.max(sideLens[0], sideLens[1]);
      if (allSidesDiff < 0.22) {
        // RHOMBUS
        return {
          type: 'rhombus',
          label: 'Rhombus',
          confidence: 0.82,
          shape: {
            type: 'rhombus',
            x: Math.round(bounds.minX),
            y: Math.round(bounds.minY),
            d1: Math.round(bounds.w),
            d2: Math.round(bounds.h),
            color: App.currentColor || '#ffffff'
          }
        };
      } else {
        // PARALLELOGRAM
        return {
          type: 'parallelogram',
          label: 'Parallelogram',
          confidence: 0.81,
          shape: {
            type: 'parallelogram',
            x: Math.round(bounds.minX),
            y: Math.round(bounds.minY),
            base: Math.round(bounds.w * 0.75),
            slant: Math.round(bounds.w * 0.25),
            h: Math.round(bounds.h),
            color: App.currentColor || '#ffffff'
          }
        };
      }
    }

    // TRAPEZIUM
    return {
      type: 'trapezium',
      label: 'Trapezium',
      confidence: 0.76,
      shape: {
        type: 'trapezium',
        x: Math.round(bounds.minX),
        y: Math.round(bounds.minY),
        a: Math.round(bounds.w * 0.55),
        b: Math.round(bounds.w),
        h: Math.round(bounds.h),
        color: App.currentColor || '#ffffff'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: TRIANGLE
  // ─────────────────────────────────────────────
  function testTriangle(pts, simplified, bounds) {
    let corners = getDistinctCorners(simplified);
    if (corners.length !== 3) {
      corners = getDistinctCorners(ramerDouglasPeucker(pts, bounds.diag * 0.09));
    }
    if (corners.length !== 3) return null;

    // Check if one angle is approximately 90°
    const angles = [];
    for (let i = 0; i < 3; i++) {
      const pPrev = corners[(i + 2) % 3];
      const pCurr = corners[i];
      const pNext = corners[(i + 1) % 3];
      const a1 = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
      const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
      let diff = Math.abs((a2 - a1) * 180 / Math.PI);
      if (diff > 180) diff = 360 - diff;
      angles.push(diff);
    }

    const hasRightAngle = angles.some(a => Math.abs(a - 90) < 16);

    if (hasRightAngle) {
      return {
        type: 'rightTriangle',
        label: 'Right Triangle',
        confidence: 0.88,
        shape: {
          type: 'rightTriangle',
          x: Math.round(bounds.minX),
          y: Math.round(bounds.minY),
          base: Math.round(bounds.w),
          height: Math.round(bounds.h),
          color: App.currentColor || '#ffffff'
        }
      };
    }

    // Check if apex is roughly centered
    const topCorner = [...corners].sort((a, b) => a.y - b.y)[0];
    const apexCenterOffset = Math.abs(topCorner.x - bounds.cx) / (bounds.w / 2);

    if (apexCenterOffset < 0.35) {
      return {
        type: 'triangle',
        label: 'Triangle',
        confidence: 0.89,
        shape: {
          type: 'triangle',
          x: Math.round(bounds.minX),
          y: Math.round(bounds.minY),
          base: Math.round(bounds.w),
          height: Math.round(bounds.h),
          color: App.currentColor || '#ffffff'
        }
      };
    }

    // General 3-corner Polygon
    return {
      type: 'polygon',
      label: 'Triangle',
      confidence: 0.85,
      shape: {
        type: 'polygon',
        polygonName: 'Triangle',
        points: corners.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        color: App.currentColor || '#ffffff'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: POLYGON (Pentagon, Hexagon, Octagon)
  // ─────────────────────────────────────────────
  function testPolygon(pts, simplified, bounds) {
    const corners = getDistinctCorners(simplified);
    const n = corners.length;
    if (n < 5 || n > 10) return null;

    let polyName = `${n}-sided Polygon`;
    let typeName = 'polygon';
    if (n === 5) { polyName = 'Pentagon'; typeName = 'pentagon'; }
    if (n === 6) { polyName = 'Hexagon';  typeName = 'hexagon';  }
    if (n === 8) { polyName = 'Octagon';  typeName = 'octagon';  }

    return {
      type: typeName,
      label: polyName,
      confidence: 0.78,
      shape: {
        type: 'polygon',
        polygonName: polyName,
        points: corners.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        color: App.currentColor || '#ffffff'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: STRAIGHT LINE
  // ─────────────────────────────────────────────
  function testLine(pts, bounds, pathLength) {
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    const chordLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (chordLen < 15) return null;

    const straightness = chordLen / Math.max(1, pathLength);
    if (straightness < CONFIG.straightnessThreshold) return null;

    // Measure maximum perpendicular deviation from chord
    let maxDev = 0;
    pts.forEach(p => {
      const d = distToSegment(p, p1, p2);
      if (d > maxDev) maxDev = d;
    });

    const maxAllowedDev = Math.max(10, chordLen * 0.09);
    if (maxDev > maxAllowedDev) return null;

    // Check if horizontal or vertical snap intention
    let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dy < 12 && dx > 25) { // Snapped horizontal line
      const midY = Math.round((y1 + y2) / 2);
      y1 = midY; y2 = midY;
    } else if (dx < 12 && dy > 25) { // Snapped vertical line
      const midX = Math.round((x1 + x2) / 2);
      x1 = midX; x2 = midX;
    }

    const conf = Math.max(0.75, Math.min(0.99, straightness));

    return {
      type: 'measured-line',
      label: 'Straight Line',
      confidence: conf,
      shape: {
        type: 'measured-line',
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2),
        color: App.currentColor || '#38bdf8',
        unit: 'cm'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ARROW
  // ─────────────────────────────────────────────
  function testArrow(pts, bounds, pathLength) {
    if (pts.length < 8) return null;
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];

    // Check for an acute arrow tip at the end of stroke
    // Looking at the last 20% of points reversing direction
    const tailCount = Math.max(4, Math.floor(pts.length * 0.25));
    const mainStem = pts.slice(0, pts.length - tailCount);
    const tipPoints = pts.slice(pts.length - tailCount);

    if (mainStem.length < 4) return null;

    const stemChord = Math.hypot(mainStem[mainStem.length - 1].x - p1.x, mainStem[mainStem.length - 1].y - p1.y);
    const stemPath  = computePathLength(mainStem);
    if (stemChord / Math.max(1, stemPath) < 0.86) return null;

    // Check if tip has sharp turn or barb
    const tipVector = {
      x: tipPoints[tipPoints.length - 1].x - tipPoints[0].x,
      y: tipPoints[tipPoints.length - 1].y - tipPoints[0].y
    };
    const stemVector = {
      x: mainStem[mainStem.length - 1].x - p1.x,
      y: mainStem[mainStem.length - 1].y - p1.y
    };

    const dot = stemVector.x * tipVector.x + stemVector.y * tipVector.y;
    const magS = Math.hypot(stemVector.x, stemVector.y);
    const magT = Math.hypot(tipVector.x, tipVector.y);

    if (magT < 8 || magS < 20) return null;

    const cosAngle = dot / (magS * magT);
    // Sharp hook: angle between tip vector and stem vector is negative (folded back)
    if (cosAngle < 0.3) {
      return {
        type: 'arrow',
        label: 'Arrow',
        confidence: 0.86,
        shape: {
          type: 'arrow',
          x1: Math.round(p1.x),
          y1: Math.round(p1.y),
          x2: Math.round(mainStem[mainStem.length - 1].x),
          y2: Math.round(mainStem[mainStem.length - 1].y),
          color: App.currentColor || '#38bdf8'
        }
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ANGLE
  // ─────────────────────────────────────────────
  function testAngle(pts, simplified, bounds) {
    const corners = simplified;
    if (corners.length !== 3) return null;

    const pA = corners[0];
    const pV = corners[1]; // Vertex
    const pB = corners[2];

    const lenA = Math.hypot(pA.x - pV.x, pA.y - pV.y);
    const lenB = Math.hypot(pB.x - pV.x, pB.y - pV.y);
    if (lenA < 18 || lenB < 18) return null;

    // Compute angle in degrees
    const angA = Math.atan2(pA.y - pV.y, pA.x - pV.x);
    const angB = Math.atan2(pB.y - pV.y, pB.x - pV.x);
    let diff = Math.abs((angB - angA) * 180 / Math.PI);
    if (diff > 180) diff = 360 - diff;

    if (diff < 12 || diff > 168) return null; // Too sharp or too flat

    const conf = 0.87;
    return {
      type: 'measured-angle',
      label: `Angle (${Math.round(diff)}°)`,
      confidence: conf,
      shape: {
        type: 'measured-angle',
        vx: Math.round(pV.x),
        vy: Math.round(pV.y),
        ax: Math.round(pA.x),
        ay: Math.round(pA.y),
        bx: Math.round(pB.x),
        by: Math.round(pB.y),
        degrees: +(diff.toFixed(1)),
        color: App.currentColor || '#f59e0b'
      }
    };
  }

  // ─────────────────────────────────────────────
  // GEOMETRY INSTANTIATION
  // ─────────────────────────────────────────────
  function instantiateCleanShape(shapeObj, shapeLabel) {
    const s = {
      id: Date.now(),
      selected: true,
      ...shapeObj
    };

    Canvas.addShapeObject(s);

    // Subtle unobtrusive feedback
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✨ Recognized: ${shapeLabel || 'Shape'}`);
    }
  }

  // ─────────────────────────────────────────────
  // MATH & ALGORITHMIC UTILITIES
  // ─────────────────────────────────────────────
  function computeBounds(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    return {
      minX, minY, maxX, maxY,
      w, h,
      cx: minX + w / 2,
      cy: minY + h / 2,
      diag: Math.hypot(w, h)
    };
  }

  function computePathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return len;
  }

  function resamplePoints(points, step) {
    if (points.length <= 1) return points;
    const res = [points[0]];
    let prev = points[0];
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) >= step) {
        res.push(p);
        prev = p;
      }
    }
    if (res[res.length - 1] !== points[points.length - 1]) {
      res.push(points[points.length - 1]);
    }
    return res;
  }

  // Ramer-Douglas-Peucker simplification
  function ramerDouglasPeucker(pts, epsilon) {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let index = 0;
    const start = pts[0];
    const end   = pts[pts.length - 1];

    for (let i = 1; i < pts.length - 1; i++) {
      const d = distToSegment(pts[i], start, end);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left  = ramerDouglasPeucker(pts.slice(0, index + 1), epsilon);
      const right = ramerDouglasPeucker(pts.slice(index), epsilon);
      return left.slice(0, left.length - 1).concat(right);
    } else {
      return [start, end];
    }
  }

  function distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function getDistinctCorners(simplifiedPts) {
    if (!simplifiedPts || simplifiedPts.length <= 1) return [];
    const corners = [simplifiedPts[0]];
    for (let i = 1; i < simplifiedPts.length; i++) {
      const p = simplifiedPts[i];
      const isStart = (i === simplifiedPts.length - 1 && Math.hypot(p.x - corners[0].x, p.y - corners[0].y) < 18);
      if (!isStart && Math.hypot(p.x - corners[corners.length - 1].x, p.y - corners[corners.length - 1].y) > 12) {
        corners.push(p);
      }
    }
    return corners;
  }

  return {
    CONFIG,
    onDown,
    onMove,
    onUp,
    recognizeStroke,
    clearStrokePreview
  };
})();

// Attach to window
window.SmartDrawing = SmartDrawing;
