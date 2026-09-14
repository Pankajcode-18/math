'use strict';

// ══════════════════════════════════════════════════════════════════
// SMART DRAWING ENGINE — AI & Geometric Classroom Recognition
// Converts natural rough drawings into clean, precise math shapes & symbols
// Non-destructive: preserves original ink if uncertain, zero viewport changes
// ══════════════════════════════════════════════════════════════════

const SmartDrawing = (() => {

  // ─────────────────────────────────────────────
  // CONFIGURATION & THRESHOLDS
  // ─────────────────────────────────────────────
  const CONFIG = {
    confidenceThreshold: 0.65,        // Below this, strokes are preserved as natural ink
    clusterDebounceMs: 420,           // Wait window for multi-stroke math/shapes completion
    clusterMaxGapPx: 60,              // Spatial proximity for grouping strokes into one object
    closureRatioThreshold: 0.32,      // dist(start, end) / totalLength < this => closed
    closurePixelThreshold: 75,        // Absolute distance between endpoints to consider closed
    squareRatioTolerance: 0.18,       // |width - height| / max(w, h) < this => square
    rightAngleToleranceDeg: 18,       // Angle deviation from 90° for rectangular corners
    straightnessThreshold: 0.88,      // Segment length / arc length for straight lines
    circleRadialVarianceMax: 0.22,    // Max normalized std dev of radius for circle
    circleAspectRatioMin: 0.72,       // Min width/height ratio for circle
    ellipseRadialVarianceMax: 0.30    // Max normalized variance for ellipse
  };

  let isDrawing = false;
  let activeStroke = [];       // Points of current stroke: [{ x, y, t }]
  let pendingCluster = [];     // Array of strokes belonging to current spatial cluster
  let clusterTimer = null;
  let strokeCanvas = null;
  let strokeCtx = null;

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
    isDrawing = true;
    activeStroke = [{ x: pos.x, y: pos.y, t: Date.now() }];

    strokeCanvas = getStrokeCanvas();
    strokeCtx = getStrokeCtx();

    // Check if new stroke is far away from the currently pending cluster
    if (pendingCluster.length > 0) {
      const clusterBBox = getClusterBounds(pendingCluster);
      const distToCluster = distToBounds(pos, clusterBBox);
      // If user moved to draw a different object, finalize previous cluster immediately
      if (distToCluster > Math.max(CONFIG.clusterMaxGapPx, clusterBBox.diag * 0.55)) {
        flushClusterNow();
      } else {
        // Still drawing the same multi-stroke object, cancel pending finalize timer
        if (clusterTimer) {
          clearTimeout(clusterTimer);
          clusterTimer = null;
        }
      }
    }

    // Render initial point preview
    if (strokeCtx) {
      strokeCtx.save();
      if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
        Canvas.applyTransformToCtx(strokeCtx);
      }
      strokeCtx.fillStyle = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8';
      strokeCtx.beginPath();
      strokeCtx.arc(pos.x, pos.y, ((typeof App !== 'undefined' && App.penSize) ? App.penSize : 3) / 2, 0, Math.PI * 2);
      strokeCtx.fill();
      strokeCtx.restore();
    }
  }

  function onMove(pos) {
    if (!isDrawing || !activeStroke.length) return;

    const last = activeStroke[activeStroke.length - 1];
    const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (dist < 2.2) return; // Filter micro jitter

    activeStroke.push({ x: pos.x, y: pos.y, t: Date.now() });

    // Render smooth live ink preview
    if (strokeCtx && activeStroke.length >= 2) {
      strokeCtx.save();
      if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
        Canvas.applyTransformToCtx(strokeCtx);
      }
      strokeCtx.strokeStyle = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8';
      strokeCtx.lineWidth   = (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3;
      strokeCtx.lineCap     = 'round';
      strokeCtx.lineJoin    = 'round';

      const n = activeStroke.length;
      if (n >= 3) {
        const p0 = activeStroke[n - 3];
        const p1 = activeStroke[n - 2];
        const p2 = activeStroke[n - 1];
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        strokeCtx.beginPath();
        strokeCtx.moveTo(p0.x, p0.y);
        strokeCtx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
        strokeCtx.stroke();
      } else {
        strokeCtx.beginPath();
        strokeCtx.moveTo(activeStroke[0].x, activeStroke[0].y);
        strokeCtx.lineTo(pos.x, pos.y);
        strokeCtx.stroke();
      }
      strokeCtx.restore();
    }
  }

  function onUp(pos) {
    if (!isDrawing) return;
    isDrawing = false;

    if (pos) {
      const last = activeStroke[activeStroke.length - 1];
      if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) > 2) {
        activeStroke.push({ x: pos.x, y: pos.y, t: Date.now() });
      }
    }

    if (activeStroke.length >= 2) {
      pendingCluster.push({
        points: activeStroke.slice(),
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff',
        size: (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3
      });
    }

    activeStroke = [];

    // Schedule debounced processing to allow for multi-stroke objects (=, +, ×, ÷, √, fractions, multi-stroke shapes)
    if (clusterTimer) clearTimeout(clusterTimer);
    clusterTimer = setTimeout(() => {
      flushClusterNow();
    }, CONFIG.clusterDebounceMs);
  }

  // ─────────────────────────────────────────────
  // CLUSTER PROCESSOR (Single & Multi-Stroke)
  // ─────────────────────────────────────────────
  function flushClusterNow() {
    if (clusterTimer) {
      clearTimeout(clusterTimer);
      clusterTimer = null;
    }

    if (!pendingCluster.length) {
      clearStrokePreview();
      return;
    }

    const strokesToProcess = pendingCluster.slice();
    pendingCluster = [];
    clearStrokePreview();

    processStrokeCluster(strokesToProcess);
  }

  function processStrokeCluster(cluster) {
    if (!cluster || !cluster.length) return;

    // 1. If cluster has multiple strokes, try multi-stroke recognition first
    if (cluster.length > 1) {
      const multiCandidate = recognizeMultiStroke(cluster);
      if (multiCandidate && multiCandidate.confidence >= CONFIG.confidenceThreshold && multiCandidate.shape) {
        instantiateCleanShape(multiCandidate.shape, multiCandidate.label);
        return;
      }
    }

    // 2. If single stroke, test comprehensive single-stroke shape & math classifiers
    if (cluster.length === 1) {
      const singleCandidate = recognizeSingleStroke(cluster[0].points);
      if (singleCandidate && singleCandidate.confidence >= CONFIG.confidenceThreshold && singleCandidate.shape) {
        instantiateCleanShape(singleCandidate.shape, singleCandidate.label);
        return;
      }
    }

    // 3. Fallback: preserve original natural strokes without alteration (non-destructive)
    commitClusterAsNaturalInk(cluster);
  }

  // ─────────────────────────────────────────────
  // MULTI-STROKE RECOGNITION (Math, Symbols, Multi-line Shapes)
  // ─────────────────────────────────────────────
  function recognizeMultiStroke(cluster) {
    const n = cluster.length;
    const bounds = getClusterBounds(cluster);
    const strokeBounds = cluster.map(s => computeBounds(s.points));
    const strokeLengths = cluster.map(s => computePathLength(s.points));
    const strokeChords = cluster.map(s => {
      const pts = s.points;
      return Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    });

    const isLinear = cluster.map((s, idx) => {
      return (strokeChords[idx] / Math.max(1, strokeLengths[idx])) > 0.82;
    });

    // ── 1. EQUALS SIGN (=): 2 horizontal parallel lines ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const b0 = strokeBounds[0], b1 = strokeBounds[1];
      const isH0 = b0.w > b0.h * 2 && b0.w > 12;
      const isH1 = b1.w > b1.h * 2 && b1.w > 12;
      if (isH0 && isH1) {
        const xOverlap = Math.min(b0.maxX, b1.maxX) - Math.max(b0.minX, b1.minX);
        const avgW = (b0.w + b1.w) / 2;
        if (xOverlap / avgW > 0.55 && Math.abs(b0.cy - b1.cy) > 6 && Math.abs(b0.cy - b1.cy) < 55) {
          return {
            type: 'text-block',
            label: 'Equals (=)',
            confidence: 0.94,
            shape: makeMathTextShape('=', bounds.cx, bounds.cy, Math.max(22, bounds.h * 1.2))
          };
        }
      }
    }

    // ── 2. PLUS SIGN (+): 1 horizontal + 1 vertical line intersecting near center ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const b0 = strokeBounds[0], b1 = strokeBounds[1];
      const isH0 = b0.w > b0.h * 1.5, isV0 = b0.h > b0.w * 1.5;
      const isH1 = b1.w > b1.h * 1.5, isV1 = b1.h > b1.w * 1.5;
      if ((isH0 && isV1) || (isV0 && isH1)) {
        const centerDist = Math.hypot(b0.cx - b1.cx, b0.cy - b1.cy);
        if (centerDist < Math.max(b0.diag, b1.diag) * 0.35) {
          return {
            type: 'text-block',
            label: 'Plus (+)',
            confidence: 0.95,
            shape: makeMathTextShape('+', bounds.cx, bounds.cy, Math.max(24, bounds.diag * 0.7))
          };
        }
      }
    }

    // ── 3. MULTIPLICATION / CROSS (×): 2 diagonal crossing lines ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const pA1 = cluster[0].points[0], pA2 = cluster[0].points[cluster[0].points.length - 1];
      const pB1 = cluster[1].points[0], pB2 = cluster[1].points[cluster[1].points.length - 1];
      const angA = Math.atan2(pA2.y - pA1.y, pA2.x - pA1.x);
      const angB = Math.atan2(pB2.y - pB1.y, pB2.x - pB1.x);
      let diffAng = Math.abs((angA - angB) * 180 / Math.PI);
      if (diffAng > 180) diffAng = 360 - diffAng;
      if (diffAng > 90) diffAng = 180 - diffAng;

      if (diffAng > 50 && diffAng < 130) {
        const b0 = strokeBounds[0], b1 = strokeBounds[1];
        const centerDist = Math.hypot(b0.cx - b1.cx, b0.cy - b1.cy);
        if (centerDist < Math.max(b0.diag, b1.diag) * 0.35) {
          return {
            type: 'text-block',
            label: 'Multiply (×)',
            confidence: 0.92,
            shape: makeMathTextShape('×', bounds.cx, bounds.cy, Math.max(22, bounds.diag * 0.7))
          };
        }
      }
    }

    // ── 4. DIVISION SIGN (÷): 1 horizontal line with dots above and below ──
    if (n === 3) {
      const barIdx = strokeBounds.findIndex((b, i) => isLinear[i] && b.w > b.h * 1.8 && b.w > 12);
      if (barIdx !== -1) {
        const otherIndices = [0, 1, 2].filter(i => i !== barIdx);
        const d1 = strokeBounds[otherIndices[0]], d2 = strokeBounds[otherIndices[1]];
        const bar = strokeBounds[barIdx];
        const isOneAbove = (d1.cy < bar.minY && d2.cy > bar.maxY) || (d2.cy < bar.minY && d1.cy > bar.maxY);
        if (isOneAbove && Math.abs(d1.cx - bar.cx) < bar.w * 0.45 && Math.abs(d2.cx - bar.cx) < bar.w * 0.45) {
          return {
            type: 'text-block',
            label: 'Division (÷)',
            confidence: 0.93,
            shape: makeMathTextShape('÷', bounds.cx, bounds.cy, Math.max(24, bounds.h * 1.2))
          };
        }
      }
    }

    // ── 5. SQUARE ROOT / RADICAL (√): Tick + upward stroke + horizontal overbar ──
    if (n >= 2 && n <= 3) {
      const topBarIdx = strokeBounds.findIndex((b, i) => isLinear[i] && b.w > b.h * 2 && b.minY <= bounds.minY + bounds.h * 0.35);
      if (topBarIdx !== -1) {
        return {
          type: 'text-block',
          label: 'Square Root (√)',
          confidence: 0.88,
          shape: makeMathTextShape('√', bounds.minX + 8, bounds.cy, Math.max(26, bounds.h))
        };
      }
    }

    // ── 6. COORDINATE AXES: 2 perpendicular lines/arrows (X & Y axes) ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const b0 = strokeBounds[0], b1 = strokeBounds[1];
      const isCross = (b0.w > b0.h * 2 && b1.h > b1.w * 2) || (b1.w > b1.h * 2 && b0.h > b0.w * 2);
      if (isCross && bounds.w > 60 && bounds.h > 60) {
        return {
          type: 'polygon',
          label: 'Coordinate Axes',
          confidence: 0.90,
          shape: {
            type: 'number-line',
            x: Math.round(bounds.minX),
            y: Math.round(bounds.cy),
            length: Math.round(bounds.w),
            min: -5,
            max: 5,
            color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8'
          }
        };
      }
    }

    // ── 7. MULTI-STROKE TRIANGLE (3 separate connected lines) ──
    if (n === 3 && isLinear[0] && isLinear[1] && isLinear[2]) {
      const endpoints = [];
      cluster.forEach(s => {
        endpoints.push(s.points[0]);
        endpoints.push(s.points[s.points.length - 1]);
      });
      const corners = clusterEndpointsToCorners(endpoints, 3);
      if (corners && corners.length === 3) {
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
            color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
          }
        };
      }
    }

    // ── 8. MULTI-STROKE RECTANGLE / SQUARE (4 separate connected lines) ──
    if (n === 4 && isLinear[0] && isLinear[1] && isLinear[2] && isLinear[3]) {
      const endpoints = [];
      cluster.forEach(s => {
        endpoints.push(s.points[0]);
        endpoints.push(s.points[s.points.length - 1]);
      });
      const corners = clusterEndpointsToCorners(endpoints, 4);
      if (corners && corners.length === 4) {
        const isSq = Math.abs(bounds.w - bounds.h) / Math.max(bounds.w, bounds.h) <= CONFIG.squareRatioTolerance;
        const shType = isSq ? 'square' : 'rectangle';
        return {
          type: shType,
          label: isSq ? 'Square' : 'Rectangle',
          confidence: 0.90,
          shape: {
            type: shType,
            x: Math.round(bounds.minX),
            y: Math.round(bounds.minY),
            w: Math.round(bounds.w),
            h: Math.round(bounds.h),
            side: isSq ? Math.round(bounds.w) : undefined,
            color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
          }
        };
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // SINGLE STROKE RECOGNITION (Shapes, Symbols, Ink)
  // ─────────────────────────────────────────────
  function recognizeSingleStroke(points) {
    const pts = resamplePoints(points, 5);
    if (pts.length < 4) return null;

    const bounds = computeBounds(pts);
    if (bounds.w < 10 && bounds.h < 10) return null; // Ignore tiny dots

    const pathLength = computePathLength(pts);
    const pStart = pts[0];
    const pEnd   = pts[pts.length - 1];
    const closureDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const closureRatio = closureDist / Math.max(1, pathLength);
    const diag = bounds.diag;

    const isClosed = (closureRatio < CONFIG.closureRatioThreshold) ||
                     (closureDist < Math.min(CONFIG.closurePixelThreshold, diag * 0.28));

    const epsilon = Math.max(4, diag * 0.045);
    const simplified = ramerDouglasPeucker(pts, epsilon);

    const candidates = [];

    // ── Teacher Annotation: Checkmark (✓) ──
    const checkCand = testCheckmark(pts, bounds);
    if (checkCand) candidates.push(checkCand);

    if (isClosed) {
      // ── Circle ──
      const circleCand = testCircle(pts, bounds, pathLength);
      if (circleCand) candidates.push(circleCand);

      // ── Ellipse ──
      const ellipseCand = testEllipse(pts, bounds);
      if (ellipseCand) candidates.push(ellipseCand);

      // ── Quadrilaterals (Rectangle, Square, Parallelogram, Rhombus, Trapezium) ──
      const quadCand = testQuadrilateral(pts, simplified, bounds);
      if (quadCand) candidates.push(quadCand);

      // ── Triangle ──
      const triCand = testTriangle(pts, simplified, bounds);
      if (triCand) candidates.push(triCand);

      // ── Polygon (Pentagon, Hexagon, Octagon) ──
      const polyCand = testPolygon(pts, simplified, bounds);
      if (polyCand) candidates.push(polyCand);

    } else {
      // ── Straight Line ──
      const lineCand = testLine(pts, bounds, pathLength);
      if (lineCand) candidates.push(lineCand);

      // ── Arrow ──
      const arrowCand = testArrow(pts, bounds, pathLength);
      if (arrowCand) candidates.push(arrowCand);

      // ── Measured Angle ──
      const angleCand = testAngle(pts, simplified, bounds);
      if (angleCand) candidates.push(angleCand);

      // ── Math Symbol: Less than (<) / Greater than (>) ──
      const ineqCand = testInequalitySymbol(pts, simplified, bounds);
      if (ineqCand) candidates.push(ineqCand);
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: CHECKMARK (✓)
  // ─────────────────────────────────────────────
  function testCheckmark(pts, bounds) {
    if (pts.length < 6) return null;
    const lowestPoint = pts.reduce((lowest, p) => p.y > lowest.y ? p : lowest, pts[0]);
    const lowIdx = pts.indexOf(lowestPoint);

    const ratio = lowIdx / pts.length;
    if (ratio < 0.15 || ratio > 0.60) return null;

    const pStart = pts[0];
    const pEnd   = pts[pts.length - 1];

    const isDownLeft = (lowestPoint.y - pStart.y) > 10;
    const isUpRight  = (lowestPoint.y - pEnd.y) > 15;
    const goesRight  = pEnd.x > lowestPoint.x && lowestPoint.x >= pStart.x - 10;

    if (isDownLeft && isUpRight && goesRight) {
      return {
        type: 'text-block',
        label: 'Checkmark (✓)',
        confidence: 0.92,
        shape: makeMathTextShape('✓', bounds.cx, bounds.cy, Math.max(22, bounds.diag * 0.7), '#22c55e')
      };
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: INEQUALITY (< or >)
  // ─────────────────────────────────────────────
  function testInequalitySymbol(pts, simplified, bounds) {
    if (simplified.length !== 3) return null;
    const p0 = simplified[0], p1 = simplified[1], p2 = simplified[2];
    const ang1 = Math.atan2(p0.y - p1.y, p0.x - p1.x);
    const ang2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let diff = Math.abs((ang2 - ang1) * 180 / Math.PI);
    if (diff > 180) diff = 360 - diff;

    if (diff > 25 && diff < 85) {
      if (p1.x < p0.x && p1.x < p2.x) {
        return {
          type: 'text-block',
          label: 'Less Than (<)',
          confidence: 0.90,
          shape: makeMathTextShape('<', bounds.cx, bounds.cy, Math.max(22, bounds.h))
        };
      } else if (p1.x > p0.x && p1.x > p2.x) {
        return {
          type: 'text-block',
          label: 'Greater Than (>)',
          confidence: 0.90,
          shape: makeMathTextShape('>', bounds.cx, bounds.cy, Math.max(22, bounds.h))
        };
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: CIRCLE
  // ─────────────────────────────────────────────
  function testCircle(pts, bounds, pathLength) {
    const cx = bounds.cx;
    const cy = bounds.cy;

    let sumR = 0;
    const radii = pts.map(p => {
      const r = Math.hypot(p.x - cx, p.y - cy);
      sumR += r;
      return r;
    });
    const avgR = sumR / pts.length;
    if (avgR < 8) return null;

    let varianceSum = 0;
    radii.forEach(r => { varianceSum += (r - avgR) ** 2; });
    const stdDev = Math.sqrt(varianceSum / pts.length);
    const radialVar = stdDev / avgR;

    const ar = Math.min(bounds.w, bounds.h) / Math.max(bounds.w, bounds.h);

    if (radialVar > CONFIG.circleRadialVarianceMax || ar < CONFIG.circleAspectRatioMin) {
      return null;
    }

    const confVar = Math.max(0, 1 - (radialVar / CONFIG.circleRadialVarianceMax) * 0.4);
    const confAr  = Math.max(0, 1 - (1 - ar) * 1.5);
    const conf = Math.min(0.99, (confVar * 0.6 + confAr * 0.4));

    const cleanRadius = Math.round((bounds.w + bounds.h) / 4);
    return {
      type: 'circle',
      label: 'Circle',
      confidence: conf,
      shape: {
        type: 'circle',
        x: Math.round(cx - cleanRadius),
        y: Math.round(cy - cleanRadius),
        r: cleanRadius,
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ELLIPSE
  // ─────────────────────────────────────────────
  function testEllipse(pts, bounds) {
    const ar = Math.min(bounds.w, bounds.h) / Math.max(bounds.w, bounds.h);
    if (ar > 0.88) return null;

    const cx = bounds.cx, cy = bounds.cy;
    const rx = bounds.w / 2, ry = bounds.h / 2;
    if (rx < 10 || ry < 8) return null;

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
    return {
      type: 'ellipse',
      label: 'Ellipse',
      confidence: conf,
      shape: {
        type: 'ellipse',
        x: Math.round(bounds.minX),
        y: Math.round(bounds.minY),
        rx: Math.round(rx),
        ry: Math.round(ry),
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: QUADRILATERAL (Square, Rectangle, etc.)
  // ─────────────────────────────────────────────
  function testQuadrilateral(pts, simplified, bounds) {
    let corners = getDistinctCorners(simplified);
    if (corners.length !== 4) {
      corners = extractCornersN(pts, bounds, 4);
    }
    if (!corners || corners.length !== 4) return null;

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

    const rightAngleDevs = angles.map(a => Math.abs(a - 90));
    const maxDev = Math.max(...rightAngleDevs);
    const avgDev = rightAngleDevs.reduce((a, b) => a + b, 0) / 4;

    const isRectangular = maxDev < CONFIG.rightAngleToleranceDeg + 10 && avgDev < CONFIG.rightAngleToleranceDeg;
    const diffRatio = Math.abs(bounds.w - bounds.h) / Math.max(bounds.w, bounds.h);

    if (isRectangular) {
      if (diffRatio <= CONFIG.squareRatioTolerance) {
        const side = Math.round((bounds.w + bounds.h) / 2);
        return {
          type: 'square',
          label: 'Square',
          confidence: 0.95,
          shape: {
            type: 'square',
            x: Math.round(bounds.cx - side / 2),
            y: Math.round(bounds.cy - side / 2),
            w: side,
            h: side,
            side: side,
            color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
          }
        };
      } else {
        return {
          type: 'rectangle',
          label: 'Rectangle',
          confidence: 0.95,
          shape: {
            type: 'rectangle',
            x: Math.round(bounds.minX),
            y: Math.round(bounds.minY),
            w: Math.round(bounds.w),
            h: Math.round(bounds.h),
            color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
          }
        };
      }
    }

    return {
      type: 'rectangle',
      label: 'Rectangle',
      confidence: 0.82,
      shape: {
        type: 'rectangle',
        x: Math.round(bounds.minX),
        y: Math.round(bounds.minY),
        w: Math.round(bounds.w),
        h: Math.round(bounds.h),
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
      }
    };
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: TRIANGLE
  // ─────────────────────────────────────────────
  function testTriangle(pts, simplified, bounds) {
    let corners = getDistinctCorners(simplified);
    if (corners.length !== 3) {
      corners = extractCornersN(pts, bounds, 3);
    }
    if (!corners || corners.length !== 3) return null;

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
        confidence: 0.90,
        shape: {
          type: 'rightTriangle',
          x: Math.round(bounds.minX),
          y: Math.round(bounds.minY),
          base: Math.round(bounds.w),
          height: Math.round(bounds.h),
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
        }
      };
    }

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
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
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

    let polyName = `${n}-gon`;
    if (n === 5) polyName = 'Pentagon';
    if (n === 6) polyName = 'Hexagon';
    if (n === 8) polyName = 'Octagon';

    return {
      type: 'polygon',
      label: polyName,
      confidence: 0.82,
      shape: {
        type: 'polygon',
        polygonName: polyName,
        points: corners.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
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

    return {
      type: 'measured-line',
      label: 'Straight Line',
      confidence: Math.max(0.75, Math.min(0.99, straightness)),
      shape: {
        type: 'measured-line',
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2),
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8',
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
    const tailCount = Math.max(4, Math.floor(pts.length * 0.25));
    const mainStem = pts.slice(0, pts.length - tailCount);
    const tipPoints = pts.slice(pts.length - tailCount);

    if (mainStem.length < 4) return null;
    const stemChord = Math.hypot(mainStem[mainStem.length - 1].x - p1.x, mainStem[mainStem.length - 1].y - p1.y);
    const stemPath  = computePathLength(mainStem);
    if (stemChord / Math.max(1, stemPath) < 0.84) return null;

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
    if (cosAngle < 0.35) { // Hook turn at tip indicates arrow
      return {
        type: 'arrow',
        label: 'Arrow',
        confidence: 0.88,
        shape: {
          type: 'arrow',
          x1: Math.round(p1.x),
          y1: Math.round(p1.y),
          x2: Math.round(mainStem[mainStem.length - 1].x),
          y2: Math.round(mainStem[mainStem.length - 1].y),
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8'
        }
      };
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ANGLE
  // ─────────────────────────────────────────────
  function testAngle(pts, simplified, bounds) {
    if (simplified.length !== 3) return null;
    const pA = simplified[0], pV = simplified[1], pB = simplified[2];
    const lenA = Math.hypot(pA.x - pV.x, pA.y - pV.y);
    const lenB = Math.hypot(pB.x - pV.x, pB.y - pV.y);
    if (lenA < 18 || lenB < 18) return null;

    const angA = Math.atan2(pA.y - pV.y, pA.x - pV.x);
    const angB = Math.atan2(pB.y - pV.y, pB.x - pV.x);
    let diff = Math.abs((angB - angA) * 180 / Math.PI);
    if (diff > 180) diff = 360 - diff;
    if (diff < 12 || diff > 168) return null;

    return {
      type: 'measured-angle',
      label: `Angle (${Math.round(diff)}°)`,
      confidence: 0.88,
      shape: {
        type: 'measured-angle',
        vx: Math.round(pV.x),
        vy: Math.round(pV.y),
        ax: Math.round(pA.x),
        ay: Math.round(pA.y),
        bx: Math.round(pB.x),
        by: Math.round(pB.y),
        degrees: +(diff.toFixed(1)),
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#f59e0b'
      }
    };
  }

  // ─────────────────────────────────────────────
  // SHAPE & TEXT INSTANTIATION
  // ─────────────────────────────────────────────
  function instantiateCleanShape(shapeObj, shapeLabel) {
    // Completely decoupled from zoom & camera: never changes zoomLevel or pan
    const s = {
      id: Date.now(),
      selected: true,
      ...shapeObj
    };

    if (typeof Canvas !== 'undefined' && Canvas.addShapeObject) {
      Canvas.addShapeObject(s);
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✨ Recognized: ${shapeLabel || 'Shape'}`);
    }
  }

  function makeMathTextShape(text, cx, cy, fontSize, col) {
    const fs = Math.round(fontSize || 24);
    return {
      type: 'text-block',
      x: Math.round(cx - fs * 0.4),
      y: Math.round(cy - fs * 0.5),
      text: text,
      color: col || ((typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'),
      fontSize: fs,
      fontFamily: 'KaTeX_Main, "Times New Roman", serif'
    };
  }

  // ─────────────────────────────────────────────
  // NON-DESTRUCTIVE FALLBACK (Preserve Natural Ink)
  // ─────────────────────────────────────────────
  function commitClusterAsNaturalInk(cluster) {
    if (!cluster || !cluster.length) return;
    if (typeof Canvas !== 'undefined' && Canvas.addStroke) {
      Canvas.saveHistory();
      cluster.forEach(stroke => {
        Canvas.addStroke({
          id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          tool: 'pen',
          color: stroke.color || '#ffffff',
          size: stroke.size || 3,
          points: stroke.points.slice()
        });
      });
      if (Canvas.renderStrokes) Canvas.renderStrokes();
    }
  }

  // ─────────────────────────────────────────────
  // GEOMETRIC & MATH UTILITIES
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

  function getClusterBounds(cluster) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cluster.forEach(s => {
      s.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
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

  function distToBounds(p, b) {
    const dx = Math.max(0, Math.max(b.minX - p.x, p.x - b.maxX));
    const dy = Math.max(0, Math.max(b.minY - p.y, p.y - b.maxY));
    return Math.hypot(dx, dy);
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
    const n = simplifiedPts.length;
    for (let i = 1; i < n; i++) {
      const p = simplifiedPts[i];
      const isLoopClose = (i === n - 1 && Math.hypot(p.x - corners[0].x, p.y - corners[0].y) < 45);
      if (!isLoopClose && Math.hypot(p.x - corners[corners.length - 1].x, p.y - corners[corners.length - 1].y) > 16) {
        corners.push(p);
      }
    }
    if (corners.length > 3 && Math.hypot(corners[corners.length - 1].x - corners[0].x, corners[corners.length - 1].y - corners[0].y) < 35) {
      corners.pop();
    }
    return corners;
  }

  function extractCornersN(pts, bounds, targetN) {
    if (!pts || pts.length < targetN * 2) return null;
    const epsilons = [0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.18].map(r => bounds.diag * r);
    for (const eps of epsilons) {
      const simp = ramerDouglasPeucker(pts, eps);
      const c = getDistinctCorners(simp);
      if (c.length === targetN) return c;
    }
    return null;
  }

  function clusterEndpointsToCorners(endpoints, targetN) {
    const clusters = [];
    endpoints.forEach(p => {
      let found = false;
      for (const c of clusters) {
        if (Math.hypot(p.x - c.x, p.y - c.y) < 35) {
          c.pts.push(p);
          c.x = c.pts.reduce((acc, pt) => acc + pt.x, 0) / c.pts.length;
          c.y = c.pts.reduce((acc, pt) => acc + pt.y, 0) / c.pts.length;
          found = true;
          break;
        }
      }
      if (!found) {
        clusters.push({ x: p.x, y: p.y, pts: [p] });
      }
    });

    if (clusters.length === targetN) {
      return clusters.map(c => ({ x: c.x, y: c.y }));
    }
    return null;
  }

  return {
    CONFIG,
    onDown,
    onMove,
    onUp,
    flushClusterNow,
    recognizeSingleStroke,
    recognizeMultiStroke,
    clearStrokePreview
  };
})();

// Attach to window
window.SmartDrawing = SmartDrawing;
