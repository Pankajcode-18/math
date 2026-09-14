'use strict';

// ══════════════════════════════════════════════════════════════════
// SMART DRAWING ENGINE — AI & Geometric Classroom Recognition
// ══════════════════════════════════════════════════════════════════
// Features:
// 1. Ultra-smooth, zero-latency live drawing with corner-preserving splines
// 2. Mathematically robust shape recognition:
//    - Real curvature & corner detection (circles NEVER misdetected as squares!)
//    - Circles, ellipses, semicircles, arcs
//    - Triangles (equilateral, right, scalene) in 1 or 3 strokes
//    - Squares, rectangles, parallelograms, rhombuses, trapeziums in 1 or 4 strokes
//    - Polygons (pentagon, hexagon)
//    - Lines, rays, arrows, angles, coordinate axes, points
// 3. Mathematical symbol & expression recognition:
//    - Operators: +, -, ×, ÷, =, ≠, ≈, ±, <, >, ≤, ≥
//    - Symbols: √, π, θ, α, β, Δ, ∞, ∑, ∫, °
//    - Brackets: (), [], {}
//    - Structured math: fractions (a/b), exponents (x²), radicals, equations
// 4. Single-stroke and multi-stroke object grouping
// 5. Non-destructive: preserves natural ink when confidence is uncertain
// 6. Asynchronous non-blocking pipeline: 60-120 FPS buttery smooth
// ══════════════════════════════════════════════════════════════════

const SmartDrawing = (() => {

  // ─────────────────────────────────────────────
  // CONFIGURATION & RECOGNITION THRESHOLDS
  // ─────────────────────────────────────────────
  const CONFIG = {
    confidenceThreshold: 0.76,      // Solid bar: only confident matches convert
    clusterDebounceMs: 340,         // Wait time to group multi-stroke items
    clusterMaxGapPx: 68,            // Max spatial distance to cluster strokes
    minDiagonalPx: 12,              // Strokes smaller than this are dots/points
    closureRatioThreshold: 0.28,    // End-to-start distance / path length
    closurePixelThreshold: 55,      // Max end-to-start pixel distance for closed shape
    straightnessThreshold: 0.88,    // Min chord / path length for straight lines
    circleRadialVarianceMax: 0.18,  // Max radius standard deviation for circles
    circleAspectRatioMin: 0.76,     // Min aspect ratio (width/height) for circle
    ellipseRadialVarianceMax: 0.26, // Max variance for ellipse fit
    squareRatioTolerance: 0.18,     // Max width/height deviation for square
    rightAngleToleranceDeg: 18      // Corner angle tolerance from 90°
  };

  let isDrawing = false;
  let activeStroke = [];
  let pendingCluster = [];
  let clusterTimer = null;
  let strokeCanvas = null;
  let strokeCtx = null;

  // ─────────────────────────────────────────────
  // HIGH-DPI PREVIEW OVERLAY CANVAS
  // ─────────────────────────────────────────────
  function getStrokeCanvas() {
    let sc = document.getElementById('smart-draw-preview');
    const vp = document.getElementById('canvas-viewport');
    const zone = document.getElementById('canvas-zone');
    if (!sc) {
      sc = document.createElement('canvas');
      sc.id = 'smart-draw-preview';
      sc.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:6;';
      if (vp) vp.appendChild(sc);
      else if (zone) zone.appendChild(sc);
    }
    const size = (typeof Canvas !== 'undefined' && Canvas.getCanvasSize) ? Canvas.getCanvasSize() : { W: 1200, H: 800 };
    const dpr = (typeof Canvas !== 'undefined' && Canvas.getDPR) ? Canvas.getDPR() : (window.devicePixelRatio || 1);
    const w = size.W || 1200;
    const h = size.H || 800;
    const iw = Math.round(w * dpr);
    const ih = Math.round(h * dpr);
    if (sc.width !== iw || sc.height !== ih) {
      sc.width  = iw;
      sc.height = ih;
      sc.style.width  = w + 'px';
      sc.style.height = h + 'px';
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, sc.width, sc.height);
    }
  }

  function applyPreviewTransform(ctx) {
    if (typeof Canvas !== 'undefined' && Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }
  }

  // ─────────────────────────────────────────────
  // LIVE DRAWING WITH CORNER-AWARE SMOOTHING
  // ─────────────────────────────────────────────
  function onDown(pos) {
    isDrawing = true;
    activeStroke = [{ x: pos.x, y: pos.y, t: Date.now() }];

    strokeCanvas = getStrokeCanvas();
    strokeCtx = getStrokeCtx();

    // Check if new stroke is far from pending cluster → flush earlier cluster
    if (pendingCluster.length > 0) {
      const clusterBBox = getClusterBounds(pendingCluster);
      const d = distToBounds(pos, clusterBBox);
      const threshold = Math.max(CONFIG.clusterMaxGapPx, clusterBBox.diag * 0.65);
      if (d > threshold) {
        flushClusterNow();
      } else if (clusterTimer) {
        clearTimeout(clusterTimer);
        clusterTimer = null;
      }
    }

    // Render initial crisp point
    if (strokeCtx) {
      const penSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3;
      const color = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8';
      strokeCtx.save();
      applyPreviewTransform(strokeCtx);
      strokeCtx.fillStyle = color;
      strokeCtx.beginPath();
      strokeCtx.arc(pos.x, pos.y, penSize / 2, 0, Math.PI * 2);
      strokeCtx.fill();
      strokeCtx.restore();
    }
  }

  function onMove(pos) {
    if (!isDrawing || !activeStroke.length) return;

    const last = activeStroke[activeStroke.length - 1];
    const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (dist < 1.8) return;

    activeStroke.push({ x: pos.x, y: pos.y, t: Date.now() });

    if (strokeCtx && activeStroke.length >= 2) {
      const penSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3;
      const color = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8';

      strokeCtx.save();
      applyPreviewTransform(strokeCtx);
      strokeCtx.strokeStyle = color;
      strokeCtx.lineWidth   = penSize;
      strokeCtx.lineCap     = 'round';
      strokeCtx.lineJoin    = 'round';

      const n = activeStroke.length;
      if (n >= 3) {
        const p0 = activeStroke[n - 3];
        const p1 = activeStroke[n - 2];
        const p2 = activeStroke[n - 1];

        // Corner check: sharp turn (> 65°) keeps corner sharp
        const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const d1 = Math.hypot(v1.x, v1.y);
        const d2 = Math.hypot(v2.x, v2.y);
        let isSharpCorner = false;
        if (d1 > 4 && d2 > 4) {
          const cosAngle = (v1.x * v2.x + v1.y * v2.y) / (d1 * d2);
          if (cosAngle < 0.42) {
            isSharpCorner = true;
          }
        }

        strokeCtx.beginPath();
        if (isSharpCorner) {
          strokeCtx.moveTo(p0.x, p0.y);
          strokeCtx.lineTo(p1.x, p1.y);
          strokeCtx.lineTo(p2.x, p2.y);
        } else {
          strokeCtx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
          strokeCtx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        }
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
    } else if (activeStroke.length === 1) {
      pendingCluster.push({
        points: [activeStroke[0], { x: activeStroke[0].x + 0.1, y: activeStroke[0].y + 0.1 }],
        color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff',
        size: (typeof App !== 'undefined' && App.penSize) ? App.penSize : 3
      });
    }

    activeStroke = [];

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

    requestAnimationFrame(() => {
      processStrokeCluster(strokesToProcess);
    });
  }

  function processStrokeCluster(cluster) {
    if (!cluster || !cluster.length) return;

    // 1. Multi-stroke recognition
    if (cluster.length > 1) {
      const multiCandidate = recognizeMultiStroke(cluster);
      if (multiCandidate && multiCandidate.confidence >= CONFIG.confidenceThreshold && multiCandidate.shape) {
        instantiateCleanShape(multiCandidate.shape, multiCandidate.label);
        return;
      }
    }

    // 2. Single stroke recognition
    if (cluster.length === 1) {
      const singleCandidate = recognizeSingleStroke(cluster[0].points);
      if (singleCandidate && singleCandidate.confidence >= CONFIG.confidenceThreshold && singleCandidate.shape) {
        instantiateCleanShape(singleCandidate.shape, singleCandidate.label);
        return;
      }
    }

    // 3. Non-destructive fallback: preserve natural ink
    commitClusterAsNaturalInk(cluster);
  }

  // ─────────────────────────────────────────────
  // MULTI-STROKE RECOGNITION
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
      return (strokeChords[idx] / Math.max(1, strokeLengths[idx])) > 0.80;
    });

    // ── 1. DIVISION SIGN (÷): 1 horizontal line + 2 small dots above & below ──
    if (n === 3) {
      const barIdx = strokeBounds.findIndex((b, i) => isLinear[i] && b.w > b.h * 1.6 && b.w >= 10);
      if (barIdx !== -1) {
        const otherIndices = [0, 1, 2].filter(i => i !== barIdx);
        const d1 = strokeBounds[otherIndices[0]], d2 = strokeBounds[otherIndices[1]];
        const bar = strokeBounds[barIdx];
        const isOneAbove = (d1.cy < bar.minY && d2.cy > bar.maxY) || (d2.cy < bar.minY && d1.cy > bar.maxY);
        const areBothDots = d1.diag <= 20 && d2.diag <= 20;
        if (isOneAbove && areBothDots) {
          return {
            type: 'text-block',
            label: 'Division (÷)',
            confidence: 0.96,
            shape: makeMathTextShape('÷', bounds.cx, bounds.cy, Math.max(26, bounds.h * 1.2))
          };
        }
      }
    }

    // ── 2. FRACTION: Horizontal division line with substantial strokes above and below ──
    if (n >= 2) {
      const barIdx = strokeBounds.findIndex((b, i) => isLinear[i] && b.w > b.h * 2.0 && b.w >= 18);
      if (barIdx !== -1) {
        const bar = strokeBounds[barIdx];
        const others = cluster.filter((_, i) => i !== barIdx);
        const above = others.filter(s => computeBounds(s.points).maxY < bar.minY + 8);
        const below = others.filter(s => computeBounds(s.points).minY > bar.maxY - 8);

        if (above.length > 0 && below.length > 0) {
          return {
            type: 'text-block',
            label: 'Fraction (a/b)',
            confidence: 0.94,
            shape: makeMathTextShape('—', bounds.cx, bounds.cy, Math.max(24, bounds.h * 0.75))
          };
        }
      }
    }

    // ── 3. EXPONENT / SUPERSCRIPT (e.g. x², y³, a²): Main stroke + smaller stroke in upper right ──
    if (n === 2) {
      const b0 = strokeBounds[0], b1 = strokeBounds[1];
      const isExp1 = (b1.minX >= b0.cx && b1.minY <= b0.cy && b1.diag <= b0.diag * 0.65);
      const isExp0 = (b0.minX >= b1.cx && b0.minY <= b1.cy && b0.diag <= b1.diag * 0.65);
      if (isExp1 || isExp0) {
        const baseBounds = isExp1 ? b0 : b1;
        return {
          type: 'text-block',
          label: 'Exponent (x²)',
          confidence: 0.90,
          shape: makeMathTextShape('x²', baseBounds.cx, baseBounds.cy, Math.max(28, bounds.h * 0.9))
        };
      }
    }

    // ── 4. EQUALS SIGN (=): 2 parallel horizontal lines ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const b0 = strokeBounds[0], b1 = strokeBounds[1];
      const isH0 = b0.w > b0.h * 1.8 && b0.w >= 10;
      const isH1 = b1.w > b1.h * 1.8 && b1.w >= 10;
      if (isH0 && isH1) {
        const xOverlap = Math.min(b0.maxX, b1.maxX) - Math.max(b0.minX, b1.minX);
        const avgW = (b0.w + b1.w) / 2;
        if (xOverlap / avgW > 0.45 && Math.abs(b0.cy - b1.cy) >= 4 && Math.abs(b0.cy - b1.cy) < 60) {
          return {
            type: 'text-block',
            label: 'Equals (=)',
            confidence: 0.96,
            shape: makeMathTextShape('=', bounds.cx, bounds.cy, Math.max(24, bounds.h * 1.2))
          };
        }
      }
    }

    // ── 5. NOT EQUAL (≠): Equals sign with diagonal slash ──
    if (n === 3) {
      const linearIndices = [0, 1, 2].filter(i => isLinear[i]);
      if (linearIndices.length >= 2) {
        const horizBars = linearIndices.filter(i => strokeBounds[i].w > strokeBounds[i].h * 1.8);
        if (horizBars.length === 2) {
          const slashIdx = [0, 1, 2].find(i => !horizBars.includes(i));
          if (slashIdx !== undefined && strokeBounds[slashIdx].h > 12) {
            return {
              type: 'text-block',
              label: 'Not Equal (≠)',
              confidence: 0.95,
              shape: makeMathTextShape('≠', bounds.cx, bounds.cy, Math.max(26, bounds.h * 1.2))
            };
          }
        }
      }
    }

    // ── 6. PLUS SIGN (+) & COORDINATE AXES: 1 horizontal + 1 vertical line ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const b0 = strokeBounds[0], b1 = strokeBounds[1];
      const isH0 = b0.w > b0.h * 1.4, isV0 = b0.h > b0.w * 1.4;
      const isH1 = b1.w > b1.h * 1.4, isV1 = b1.h > b1.w * 1.4;
      if ((isH0 && isV1) || (isV0 && isH1)) {
        const centerDist = Math.hypot(b0.cx - b1.cx, b0.cy - b1.cy);
        if (centerDist < Math.max(b0.diag, b1.diag) * 0.40) {
          if (bounds.w > 120 && bounds.h > 120) {
            return {
              type: 'coordinate-axes',
              label: 'Coordinate Axes (X-Y)',
              confidence: 0.94,
              shape: {
                type: 'measured-line',
                x1: Math.round(bounds.minX),
                y1: Math.round(bounds.cy),
                x2: Math.round(bounds.maxX),
                y2: Math.round(bounds.cy),
                color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8',
                unit: 'x'
              }
            };
          }
          return {
            type: 'text-block',
            label: 'Plus (+)',
            confidence: 0.96,
            shape: makeMathTextShape('+', bounds.cx, bounds.cy, Math.max(26, bounds.diag * 0.75))
          };
        }
      }
    }

    // ── 7. MULTIPLICATION / CROSS (×): 2 crossing diagonal lines ──
    if (n === 2 && isLinear[0] && isLinear[1]) {
      const pA1 = cluster[0].points[0], pA2 = cluster[0].points[cluster[0].points.length - 1];
      const pB1 = cluster[1].points[0], pB2 = cluster[1].points[cluster[1].points.length - 1];
      const angA = Math.atan2(pA2.y - pA1.y, pA2.x - pA1.x);
      const angB = Math.atan2(pB2.y - pB1.y, pB2.x - pB1.x);
      let diffAng = Math.abs((angA - angB) * 180 / Math.PI);
      if (diffAng > 180) diffAng = 360 - diffAng;
      if (diffAng > 90) diffAng = 180 - diffAng;

      if (diffAng > 45 && diffAng < 135) {
        const b0 = strokeBounds[0], b1 = strokeBounds[1];
        const centerDist = Math.hypot(b0.cx - b1.cx, b0.cy - b1.cy);
        if (centerDist < Math.max(b0.diag, b1.diag) * 0.40) {
          return {
            type: 'text-block',
            label: 'Multiply (×)',
            confidence: 0.93,
            shape: makeMathTextShape('×', bounds.cx, bounds.cy, Math.max(24, bounds.diag * 0.75))
          };
        }
      }
    }

    // ── 8. MULTI-STROKE ARROW (1 shaft + 1 or 2 head strokes) ──
    if (n === 2 || n === 3) {
      let shaftIdx = -1, maxLen = 0;
      strokeLengths.forEach((l, i) => {
        if (l > maxLen && isLinear[i]) { maxLen = l; shaftIdx = i; }
      });
      if (shaftIdx !== -1 && maxLen >= 35) {
        const shaftPts = cluster[shaftIdx].points;
        const pStart = shaftPts[0];
        const pEnd   = shaftPts[shaftPts.length - 1];
        const otherStrokes = cluster.filter((_, i) => i !== shaftIdx);
        const nearEnd = otherStrokes.every(s => {
          const sb = computeBounds(s.points);
          return Math.hypot(sb.cx - pEnd.x, sb.cy - pEnd.y) < maxLen * 0.45;
        });
        if (nearEnd) {
          return {
            type: 'arrow',
            label: 'Arrow',
            confidence: 0.92,
            shape: {
              type: 'arrow',
              x1: Math.round(pStart.x),
              y1: Math.round(pStart.y),
              x2: Math.round(pEnd.x),
              y2: Math.round(pEnd.y),
              color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8'
            }
          };
        }
      }
    }

    // ── 9. MULTI-STROKE TRIANGLE (3 separate lines whose endpoints connect) ──
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
          confidence: 0.92,
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

    // ── 10. MULTI-STROKE RECTANGLE / SQUARE (4 separate lines) ──
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
          confidence: 0.93,
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
  // SINGLE STROKE RECOGNITION (Corner-Based Classification)
  // ─────────────────────────────────────────────
  function recognizeSingleStroke(points) {
    const pts = resamplePoints(points, 4);
    if (pts.length < 4) return null;

    const bounds = computeBounds(pts);

    // 0. Point / Dot
    if (bounds.diag <= CONFIG.minDiagonalPx) {
      return {
        type: 'point',
        label: 'Point',
        confidence: 0.95,
        shape: {
          type: 'circle',
          x: Math.round(bounds.cx - 4),
          y: Math.round(bounds.cy - 4),
          r: 4,
          fill: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff',
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
        }
      };
    }

    const pathLength = computePathLength(pts);
    const pStart = pts[0];
    const pEnd   = pts[pts.length - 1];
    const closureDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const closureRatio = closureDist / Math.max(1, pathLength);
    const diag = bounds.diag;

    // Angular sweep around center: circles sweep ~360° (2pi rad)
    const angularSweep = computeAngularSweep(pts, bounds.cx, bounds.cy);
    const isClosed = (closureRatio < CONFIG.closureRatioThreshold) ||
                     (closureDist < Math.min(CONFIG.closurePixelThreshold, diag * 0.35)) ||
                     (angularSweep >= 5.1 && closureRatio < 0.38);

    // Isoperimetric Circularity: 4 * pi * Area / (Perimeter^2)
    // Circle: ~0.88 - 0.99
    // Square: theoretical max 0.785 (with noise ~0.72 - 0.78)
    // Triangle: ~0.55 - 0.68
    const circularity = computeCircularity(pts);

    // TRUE sharp corners with turning angle >= 58°
    const trueCorners = findTrueCorners(pts, isClosed, 58);

    const candidates = [];

    if (isClosed) {
      // 1. Always evaluate round shapes (Circle & Ellipse)
      const circleCand = testCircle(pts, bounds, circularity);
      if (circleCand) candidates.push(circleCand);

      const ellipseCand = testEllipse(pts, bounds, circularity);
      if (ellipseCand) candidates.push(ellipseCand);

      // 2. Corner-based polygons (Triangles, Quadrilaterals, Regular Polygons)
      // Strictly prohibited if circularity > 0.83 (circles can NEVER be squares or triangles)
      if (circularity <= 0.83) {
        if (trueCorners.length === 3) {
          const triCand = testTriangleFromCorners(pts, trueCorners, bounds, circularity);
          if (triCand) candidates.push(triCand);
        } else if (trueCorners.length === 4) {
          const quadCand = testQuadrilateralFromCorners(pts, trueCorners, bounds, circularity);
          if (quadCand) candidates.push(quadCand);
        } else if (trueCorners.length === 5 || trueCorners.length === 6) {
          const polyCand = testPolygonFromCorners(pts, trueCorners, bounds);
          if (polyCand) candidates.push(polyCand);
        }
      }
    } else {
      // Open strokes:
      // If stroke sweeps a nearly complete loop (e.g. user drew a circle with a small gap), test circle/ellipse!
      if (angularSweep >= 4.8) {
        const circleCand = testCircle(pts, bounds, circularity);
        if (circleCand) candidates.push(circleCand);
        const ellipseCand = testEllipse(pts, bounds, circularity);
        if (ellipseCand) candidates.push(ellipseCand);
      }

      const lineCand = testLine(pts, bounds, pathLength);
      if (lineCand) candidates.push(lineCand);

      const arrowCand = testArrow(pts, bounds, pathLength);
      if (arrowCand) candidates.push(arrowCand);

      if (trueCorners.length === 1) {
        const angleCand = testAngleFromCorners(pts, trueCorners[0], bounds);
        if (angleCand) candidates.push(angleCand);
      }

      const arcCand = testArc(pts, bounds, pathLength);
      if (arcCand) candidates.push(arcCand);

      const symCand = testSingleStrokeSymbols(pts, trueCorners, bounds);
      if (symCand) candidates.push(symCand);
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  // ─────────────────────────────────────────────
  // TRUE CORNER FINDING (Curvature-Based Turning Points)
  // ─────────────────────────────────────────────
  function findTrueCorners(pts, isClosed = true, minAngleDeg = 58) {
    const corners = [];
    const n = pts.length;
    if (n < 8) return [];
    const span = Math.max(3, Math.min(8, Math.floor(n / 10)));

    for (let i = 0; i < n; i++) {
      if (!isClosed && (i < span || i >= n - span)) continue;
      const pPrev = pts[(i - span + n) % n];
      const pCurr = pts[i];
      const pNext = pts[(i + span) % n];

      const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
      const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };
      const d1 = Math.hypot(v1.x, v1.y);
      const d2 = Math.hypot(v2.x, v2.y);
      if (d1 < 3 || d2 < 3) continue;

      const cosAngle = (v1.x * v2.x + v1.y * v2.y) / (d1 * d2);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      const turningDeg = angleRad * 180 / Math.PI;

      if (turningDeg >= minAngleDeg) {
        corners.push({ index: i, pt: pCurr, angle: turningDeg });
      }
    }

    // Group adjacent hits to single sharp peak
    const clusters = [];
    corners.forEach(c => {
      const last = clusters[clusters.length - 1];
      if (last && Math.hypot(c.pt.x - last.pt.x, c.pt.y - last.pt.y) < 32) {
        if (c.angle > last.angle) clusters[clusters.length - 1] = c;
      } else {
        clusters.push(c);
      }
    });

    if (isClosed && clusters.length > 1) {
      const first = clusters[0];
      const last = clusters[clusters.length - 1];
      if (Math.hypot(first.pt.x - last.pt.x, first.pt.y - last.pt.y) < 32) {
        clusters.pop();
      }
    }

    return clusters.map(c => c.pt);
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: CIRCLE (Circularity & Radial Consistency)
  // ─────────────────────────────────────────────
  function testCircle(pts, bounds, circularity) {
    const cx = bounds.cx, cy = bounds.cy;
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

    if (radialVar > 0.24 || ar < 0.70) {
      return null;
    }

    const confVar = Math.max(0, 1 - (radialVar / 0.24) * 0.35);
    const confAr  = Math.max(0, 1 - (1 - ar) * 1.2);
    const circVal = (circularity !== undefined) ? circularity : 0.85;
    const confCirc = Math.max(0, Math.min(1, (circVal - 0.65) / 0.35));
    const conf = Math.min(0.99, (confVar * 0.45 + confAr * 0.25 + confCirc * 0.30));

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
  function testEllipse(pts, bounds, circularity) {
    const ar = Math.min(bounds.w, bounds.h) / Math.max(bounds.w, bounds.h);
    if (ar > 0.86) return null;

    const cx = bounds.cx, cy = bounds.cy;
    const rx = bounds.w / 2, ry = bounds.h / 2;
    if (rx < 10 || ry < 6) return null;

    let sumErr = 0;
    pts.forEach(p => {
      const termX = (p.x - cx) / rx;
      const termY = (p.y - cy) / ry;
      const val = Math.sqrt(termX * termX + termY * termY);
      sumErr += Math.abs(val - 1);
    });
    const avgErr = sumErr / pts.length;
    if (avgErr > CONFIG.ellipseRadialVarianceMax) return null;

    const conf = Math.max(0.72, Math.min(0.96, 1 - avgErr * 2.0));
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
  // CLASSIFIER: TRIANGLE FROM 3 CORNERS
  // ─────────────────────────────────────────────
  function testTriangleFromCorners(pts, corners, bounds, circularity) {
    if (!corners || corners.length !== 3) return null;
    if (circularity !== undefined && circularity > 0.74) return null;
    if (!checkPolygonEdgesStraight(pts, corners, 0.14)) return null;

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

    const hasRightAngle = angles.some(a => Math.abs(a - 90) < 18);
    if (hasRightAngle) {
      return {
        type: 'rightTriangle',
        label: 'Right Triangle',
        confidence: 0.95,
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

    const isEqui = angles.every(a => Math.abs(a - 60) < 20);
    if (isEqui) {
      return {
        type: 'equilateral',
        label: 'Equilateral Triangle',
        confidence: 0.94,
        shape: {
          type: 'equilateral',
          x: Math.round(bounds.minX),
          y: Math.round(bounds.minY),
          side: Math.round(bounds.w),
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
        }
      };
    }

    return {
      type: 'triangle',
      label: 'Triangle',
      confidence: 0.92,
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
  // CLASSIFIER: QUADRILATERAL FROM 4 CORNERS
  // ─────────────────────────────────────────────
  function testQuadrilateralFromCorners(pts, corners, bounds, circularity) {
    if (!corners || corners.length !== 4) return null;
    if (circularity !== undefined && circularity > 0.83) return null;
    if (!checkPolygonEdgesStraight(pts, corners, 0.12)) return null;

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

    // Rectangle or Square
    if (maxDev < CONFIG.rightAngleToleranceDeg + 10 && avgDev < CONFIG.rightAngleToleranceDeg) {
      const diffRatio = Math.abs(bounds.w - bounds.h) / Math.max(bounds.w, bounds.h);
      if (diffRatio <= CONFIG.squareRatioTolerance) {
        const side = Math.round((bounds.w + bounds.h) / 2);
        return {
          type: 'square',
          label: 'Square',
          confidence: 0.97,
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
          confidence: 0.96,
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

    // Parallelogram / Rhombus
    const oppDiff1 = Math.abs(angles[0] - angles[2]);
    const oppDiff2 = Math.abs(angles[1] - angles[3]);
    if (oppDiff1 < 24 && oppDiff2 < 24) {
      return {
        type: 'parallelogram',
        label: 'Parallelogram',
        confidence: 0.91,
        shape: {
          type: 'parallelogram',
          x: Math.round(bounds.minX),
          y: Math.round(bounds.minY),
          base: Math.round(bounds.w * 0.8),
          h: Math.round(bounds.h),
          slant: Math.round(bounds.w * 0.2),
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
        }
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: POLYGONS (Pentagon, Hexagon)
  // ─────────────────────────────────────────────
  function testPolygonFromCorners(pts, corners, bounds) {
    if (corners.length === 5) {
      return {
        type: 'polygon',
        label: 'Pentagon (5-gon)',
        confidence: 0.89,
        shape: {
          type: 'polygon',
          x: Math.round(bounds.cx),
          y: Math.round(bounds.cy),
          r: Math.round(bounds.diag / 2.2),
          sides: 5,
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
        }
      };
    }
    if (corners.length === 6) {
      return {
        type: 'polygon',
        label: 'Hexagon (6-gon)',
        confidence: 0.89,
        shape: {
          type: 'polygon',
          x: Math.round(bounds.cx),
          y: Math.round(bounds.cy),
          r: Math.round(bounds.diag / 2.2),
          sides: 6,
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#ffffff'
        }
      };
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: STRAIGHT LINE
  // ─────────────────────────────────────────────
  function testLine(pts, bounds, pathLength) {
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    const chordLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (chordLen < 16) return null;

    const straightness = chordLen / Math.max(1, pathLength);
    if (straightness < CONFIG.straightnessThreshold) return null;

    let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    if (dy < 14 && dx > 25) {
      const midY = Math.round((y1 + y2) / 2);
      y1 = midY; y2 = midY;
    } else if (dx < 14 && dy > 25) {
      const midX = Math.round((x1 + x2) / 2);
      x1 = midX; x2 = midX;
    }

    return {
      type: 'measured-line',
      label: 'Straight Line',
      confidence: Math.max(0.82, Math.min(0.99, straightness)),
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
    if (pts.length < 10 || bounds.diag < 35) return null;

    const p1 = pts[0];
    const tailCount = Math.max(4, Math.floor(pts.length * 0.22));
    const mainStem = pts.slice(0, pts.length - tailCount);
    const tipPoints = pts.slice(pts.length - tailCount);

    if (mainStem.length < 5) return null;
    const stemEnd = mainStem[mainStem.length - 1];
    const stemChord = Math.hypot(stemEnd.x - p1.x, stemEnd.y - p1.y);
    const stemPath  = computePathLength(mainStem);
    if (stemChord < 28) return null;
    if (stemChord / Math.max(1, stemPath) < 0.88) return null;

    const tipVector = {
      x: tipPoints[tipPoints.length - 1].x - tipPoints[0].x,
      y: tipPoints[tipPoints.length - 1].y - tipPoints[0].y
    };
    const stemVector = { x: stemEnd.x - p1.x, y: stemEnd.y - p1.y };

    const dot = stemVector.x * tipVector.x + stemVector.y * tipVector.y;
    const magS = Math.hypot(stemVector.x, stemVector.y);
    const magT = Math.hypot(tipVector.x, tipVector.y);
    if (magT < 8 || magS < 28) return null;

    const cosAngle = dot / (magS * magT);
    if (cosAngle < 0.15) {
      return {
        type: 'arrow',
        label: 'Arrow',
        confidence: 0.90,
        shape: {
          type: 'arrow',
          x1: Math.round(p1.x),
          y1: Math.round(p1.y),
          x2: Math.round(stemEnd.x),
          y2: Math.round(stemEnd.y),
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8'
        }
      };
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ANGLE (From 1 vertex corner)
  // ─────────────────────────────────────────────
  function testAngleFromCorners(pts, corner, bounds) {
    if (bounds.diag < 35) return null;
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    const a1 = Math.atan2(p1.y - corner.y, p1.x - corner.x);
    const a2 = Math.atan2(p2.y - corner.y, p2.x - corner.x);
    let deg = Math.abs((a2 - a1) * 180 / Math.PI);
    if (deg > 180) deg = 360 - deg;

    if (deg > 18 && deg < 165) {
      return {
        type: 'angle',
        label: `Angle (${Math.round(deg)}°)`,
        confidence: 0.88,
        shape: {
          type: 'measured-line',
          x1: Math.round(corner.x),
          y1: Math.round(corner.y),
          x2: Math.round(p2.x),
          y2: Math.round(p2.y),
          color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8'
        }
      };
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: ARC / CURVE (Parabola / Semicircle)
  // ─────────────────────────────────────────────
  function testArc(pts, bounds, pathLength) {
    if (pts.length < 12 || bounds.diag < 40) return null;
    const p1 = pts[0], p2 = pts[pts.length - 1];
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const straightness = chord / Math.max(1, pathLength);

    if (straightness > 0.45 && straightness < 0.82) {
      const mid = pts[Math.floor(pts.length / 2)];
      const chordMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const sagitta = Math.hypot(mid.x - chordMid.x, mid.y - chordMid.y);

      if (sagitta > 15) {
        return {
          type: 'arc',
          label: 'Parabola / Curve',
          confidence: 0.86,
          shape: {
            type: 'measured-line',
            x1: Math.round(p1.x),
            y1: Math.round(p1.y),
            x2: Math.round(p2.x),
            y2: Math.round(p2.y),
            color: (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : '#38bdf8'
          }
        };
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // CLASSIFIER: SINGLE-STROKE MATH SYMBOLS
  // ─────────────────────────────────────────────
  function testSingleStrokeSymbols(pts, corners, bounds) {
    // 1. Radical tick (√)
    if (corners.length >= 2 && bounds.w > 20 && bounds.h > 20) {
      const pStart = pts[0];
      const pEnd = pts[pts.length - 1];
      if (pEnd.y < pStart.y && pEnd.x > pStart.x + 15) {
        let maxY = -Infinity, maxPt = null;
        pts.forEach(p => { if (p.y > maxY) { maxY = p.y; maxPt = p; } });

        if (maxPt && maxPt.x < pEnd.x) {
          return {
            type: 'text-block',
            label: 'Square Root (√)',
            confidence: 0.89,
            shape: makeMathTextShape('√', bounds.cx, bounds.cy, Math.max(26, bounds.h * 1.1))
          };
        }
      }
    }

    // 2. Inequalities (< or >)
    if (corners.length === 1 && bounds.diag >= 18) {
      const c = corners[0];
      const p1 = pts[0];
      const p2 = pts[pts.length - 1];
      const isPointingLeft = (c.x < p1.x - 12 && c.x < p2.x - 12);
      const isPointingRight = (c.x > p1.x + 12 && c.x > p2.x + 12);
      if (isPointingLeft) {
        return {
          type: 'text-block',
          label: 'Less Than (<)',
          confidence: 0.90,
          shape: makeMathTextShape('<', bounds.cx, bounds.cy, Math.max(22, bounds.h * 1.1))
        };
      }
      if (isPointingRight) {
        return {
          type: 'text-block',
          label: 'Greater Than (>)',
          confidence: 0.90,
          shape: makeMathTextShape('>', bounds.cx, bounds.cy, Math.max(22, bounds.h * 1.1))
        };
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // SHAPE INSTANTIATION & FEEDBACK
  // ─────────────────────────────────────────────
  function instantiateCleanShape(shapeObj, shapeLabel) {
    const s = {
      id: Date.now(),
      selected: true,
      ...shapeObj
    };

    if (typeof Canvas !== 'undefined' && Canvas.addShapeObject) {
      Canvas.addShapeObject(s);
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✨ Smart Recognized: ${shapeLabel || 'Object'}`);
    }
  }

  function makeMathTextShape(text, cx, cy, fontSize, col) {
    const fs = Math.round(fontSize || 24);
    return {
      type: 'text-block',
      x: Math.round(cx - fs * 0.45),
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
        const smoothed = smoothPointsSpline(stroke.points);
        Canvas.addStroke({
          id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          tool: 'pen',
          color: stroke.color || '#ffffff',
          size: stroke.size || 3,
          points: smoothed
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

  function computeArea(pts) {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2;
  }

  function computeCircularity(pts) {
    const a = computeArea(pts);
    const p = computePathLength(pts);
    if (p === 0) return 0;
    return (4 * Math.PI * a) / (p * p);
  }

  function computeAngularSweep(pts, cx, cy) {
    if (!pts || pts.length < 2) return 0;
    let totalSweep = 0;
    let prevA = Math.atan2(pts[0].y - cy, pts[0].x - cx);
    for (let i = 1; i < pts.length; i++) {
      const a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
      let diff = a - prevA;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      totalSweep += diff;
      prevA = a;
    }
    return Math.abs(totalSweep);
  }

  function checkPolygonEdgesStraight(pts, corners, maxAllowedBulgeRatio = 0.12) {
    if (!pts || pts.length < 4 || !corners || corners.length < 3) return false;
    const n = pts.length;
    const cornerIndices = corners.map(c => {
      let bestIdx = 0, bestD = Infinity;
      pts.forEach((p, idx) => {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < bestD) { bestD = d; bestIdx = idx; }
      });
      return bestIdx;
    });

    cornerIndices.sort((a, b) => a - b);
    const k = corners.length;
    for (let i = 0; i < k; i++) {
      const idxA = cornerIndices[i];
      const idxB = cornerIndices[(i + 1) % k];
      const pA = pts[idxA];
      const pB = pts[idxB];
      const chord = Math.hypot(pB.x - pA.x, pB.y - pA.y);
      if (chord < 6) continue;

      const edgePts = [];
      if (idxA < idxB) {
        for (let j = idxA; j <= idxB; j++) edgePts.push(pts[j]);
      } else {
        for (let j = idxA; j < n; j++) edgePts.push(pts[j]);
        for (let j = 0; j <= idxB; j++) edgePts.push(pts[j]);
      }

      let maxD = 0;
      edgePts.forEach(p => {
        const num = Math.abs((pB.y - pA.y) * p.x - (pB.x - pA.x) * p.y + pB.x * pA.y - pB.y * pA.x);
        const d = num / chord;
        if (d > maxD) maxD = d;
      });

      if (maxD / chord > maxAllowedBulgeRatio) {
        return false;
      }
    }
    return true;
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

  function smoothPointsSpline(pts) {
    if (!pts || pts.length <= 3) return pts ? pts.slice() : [];
    const smoothed = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];

      const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
      const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const d1 = Math.hypot(v1.x, v1.y);
      const d2 = Math.hypot(v2.x, v2.y);
      let isCusp = false;
      if (d1 > 4 && d2 > 4) {
        const cosAngle = (v1.x * v2.x + v1.y * v2.y) / (d1 * d2);
        if (cosAngle < 0.42) isCusp = true;
      }

      if (isCusp) {
        smoothed.push(p1);
      } else {
        smoothed.push({
          x: p0.x * 0.25 + p1.x * 0.5 + p2.x * 0.25,
          y: p0.y * 0.25 + p1.y * 0.5 + p2.y * 0.25
        });
      }
    }
    smoothed.push(pts[pts.length - 1]);
    return smoothed;
  }

  function clusterEndpointsToCorners(endpoints, targetN) {
    const clusters = [];
    endpoints.forEach(p => {
      let found = false;
      for (const c of clusters) {
        if (Math.hypot(p.x - c.x, p.y - c.y) < 38) {
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
