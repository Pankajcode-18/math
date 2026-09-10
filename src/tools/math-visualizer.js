'use strict';
// ═══════════════════════════════════════════════════════════════
// INTERACTIVE MATHEMATICS VISUALIZER
// Real-time Visual Math Laboratory: trigonometry, calculus, geometry,
// vectors, sequences, and transformations with Board Stamping
// ═══════════════════════════════════════════════════════════════
const MathVisualizer = (() => {
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let visible = false;
  let animId = null;
  let activeModule = 'unitcircle';
  let annoCanvas = null;
  let annoCtx = null;
  let isAnnoDrawing = false;
  let annoPoints = [];
  let drawingMode = 'interact';
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 30;

  // ─────────────────────────────────────────────────────────────
  // MODULE STATES
  // ─────────────────────────────────────────────────────────────
  // 1. UNIT CIRCLE STATE
  const unitCircle = {
    angleDeg: 45, // degrees (0 - 360)
    animating: false,
    speed: 30, // deg/s
    historySin: [],
    historyCos: [],
    waveLen: 240
  };

  // 2. CALCULUS STATE
  const calculus = {
    funcKey: 'poly', // 'poly' | 'sin' | 'cubic' | 'gauss'
    x0: 1.2, // evaluation point for tangent
    mode: 'both', // 'tangent' | 'integral' | 'both'
    intA: -1.5, // lower bound
    intB: 2.0, // upper bound
    rectCount: 12, // Riemann subdivisions
    riemannType: 'mid', // 'left' | 'right' | 'mid' | 'trap'
    viewRangeX: 3.5,
    viewRangeY: 5.0
  };

  // 3. GEOMETRY STATE
  const geometry = {
    theorem: 'triangle', // 'triangle' | 'circle' | 'pythagoras'
    // Triangle vertices (relative to center)
    triA: { x: -140, y: 120 },
    triB: { x: 160, y: 120 },
    triC: { x: 10, y: -130 },
    draggedPoint: null,
    // Circle theorem
    circleR: 150,
    circleAngleA: 200 * Math.PI / 180,
    circleAngleB: 340 * Math.PI / 180,
    circleAngleP: 80 * Math.PI / 180,
    // Pythagoras
    pythA: 120, // base
    pythB: 90 // height
  };

  // 4. VECTORS STATE
  const vectors = {
    vecA: { x: 160, y: -80 },
    vecB: { x: 110, y: 120 },
    draggedVec: null,
    showParallelogram: true
  };

  const sequences = {
    type: 'ap',
    first: 2,
    difference: 3,
    ratio: 1.35,
    terms: 12
  };

  const transforms = {
    shape: 'triangle',
    rotation: 0,
    scale: 1,
    reflect: 'none'
  };

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE & OVERLAY BUILD
  // ─────────────────────────────────────────────────────────────
  function show(defaultMod) {
    visible = true;
    if (typeof App !== 'undefined' && App.setSimulationActive) {
      App.setSimulationActive(true);
    }
    if (!overlay) overlay = buildOverlay();
    overlay.style.display = 'flex';
    setTimeout(() => {
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1)';
    }, 10);
    if (defaultMod) activeModule = defaultMod;
    updateTabs();
    buildControls();
    resizeCanvas();
    syncToolWithBoard();
    if (!animId) loop();
  }

  function hide() {
    visible = false;
    if (typeof App !== 'undefined' && App.setSimulationActive) {
      App.setSimulationActive(false);
    }
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(0.98)';
      setTimeout(() => { overlay.style.display = 'none'; }, 200);
    }
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function toggle() {
    visible ? hide() : show();
  }

  function isVisible() {
    return visible;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
        if (annoCanvas) {
          const tmp = document.createElement('canvas');
          tmp.width = annoCanvas.width;
          tmp.height = annoCanvas.height;
          if (tmp.width > 0 && tmp.height > 0) {
            tmp.getContext('2d').drawImage(annoCanvas, 0, 0);
          }
          annoCanvas.width = w;
          annoCanvas.height = h;
          if (tmp.width > 0 && tmp.height > 0 && annoCtx) {
            annoCtx.drawImage(tmp, 0, 0);
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LIVE ANNOTATION OVER MATH SIMULATION (Pen, Marker, Eraser, Text, Undo/Redo)
  // ─────────────────────────────────────────────────────────────
  function pushUndoState() {
    if (!annoCanvas || !annoCtx) return;
    try {
      const snap = annoCtx.getImageData(0, 0, annoCanvas.width, annoCanvas.height);
      undoStack.push(snap);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
    } catch(e) {}
  }

  function undo() {
    if (!annoCanvas || !annoCtx || undoStack.length === 0) return;
    try {
      const current = annoCtx.getImageData(0, 0, annoCanvas.width, annoCanvas.height);
      redoStack.push(current);
      const prev = undoStack.pop();
      annoCtx.putImageData(prev, 0, 0);
    } catch(e) {}
  }

  function redo() {
    if (!annoCanvas || !annoCtx || redoStack.length === 0) return;
    try {
      const current = annoCtx.getImageData(0, 0, annoCanvas.width, annoCanvas.height);
      undoStack.push(current);
      const next = redoStack.pop();
      annoCtx.putImageData(next, 0, 0);
    } catch(e) {}
  }

  function addTextAnnotation(x, y) {
    if (!annoCanvas || !annoCtx) return;
    const existing = document.getElementById('math-anno-text-input');
    if (existing) existing.remove();

    const rect = annoCanvas.getBoundingClientRect();
    const scaleX = annoCanvas.width / (rect.width || 1);
    const scaleY = annoCanvas.height / (rect.height || 1);

    const input = document.createElement('input');
    input.id = 'math-anno-text-input';
    input.type = 'text';
    input.placeholder = 'Type formula or explanation...';
    input.style.cssText = `
      position: absolute;
      left: ${x / scaleX}px;
      top: ${y / scaleY}px;
      z-index: 50;
      background: rgba(8, 18, 36, 0.95);
      border: 2px solid #e8c96b;
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
      font-family: 'Segoe UI', system-ui, sans-serif;
      padding: 6px 12px;
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      outline: none;
      min-width: 220px;
    `;
    annoCanvas.parentElement.appendChild(input);
    input.focus();

    const commitText = () => {
      const val = input.value.trim();
      if (val) {
        pushUndoState();
        annoCtx.save();
        annoCtx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
        annoCtx.fillStyle = (typeof App !== 'undefined') ? App.currentColor : '#e8c96b';
        annoCtx.shadowColor = 'rgba(0,0,0,0.85)';
        annoCtx.shadowBlur = 6;
        annoCtx.fillText(val, x, y + 20);
        annoCtx.restore();
      }
      input.remove();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitText();
      } else if (e.key === 'Escape') {
        input.remove();
      }
    });
    input.addEventListener('blur', commitText);
  }

  function setAnnotationMode(mode) {
    drawingMode = mode;
    if (annoCanvas) {
      annoCanvas.style.pointerEvents = (mode === 'draw' || mode === 'text') ? 'auto' : 'none';
    }
    if (mode === 'draw' && typeof App !== 'undefined' && App.currentTool === 'select') {
      App.setTool('pen');
    } else if (mode === 'text' && typeof App !== 'undefined' && App.currentTool !== 'text') {
      App.setTool('text');
    } else if (mode === 'interact' && typeof App !== 'undefined' && App.currentTool !== 'select') {
      App.setTool('select');
    }
  }

  function clearAnnotations() {
    if (!annoCanvas || !annoCtx) return;
    pushUndoState();
    annoCtx.clearRect(0, 0, annoCanvas.width, annoCanvas.height);
  }

  function syncToolWithBoard() {
    if (!visible) return;
    const tool = (typeof App !== 'undefined') ? App.currentTool : 'select';
    if (tool === 'select') {
      drawingMode = 'interact';
      if (annoCanvas) annoCanvas.style.pointerEvents = 'none';
    } else if (tool === 'text') {
      drawingMode = 'text';
      if (annoCanvas) annoCanvas.style.pointerEvents = 'auto';
    } else {
      drawingMode = 'draw';
      if (annoCanvas) annoCanvas.style.pointerEvents = 'auto';
    }
  }

  function getAnnoPos(e) {
    const rect = annoCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (annoCanvas.width / rect.width),
      y: (clientY - rect.top) * (annoCanvas.height / rect.height)
    };
  }

  function onAnnoPointerDown(e) {
    if (e.touches && e.touches.length >= 3) {
      clearAnnotations();
      return;
    }
    const tool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    if (tool === 'select') return;
    if (e.cancelable) e.preventDefault();

    const pos = getAnnoPos(e);

    if (drawingMode === 'text' || tool === 'text') {
      addTextAnnotation(pos.x, pos.y);
      return;
    }

    pushUndoState();
    isAnnoDrawing = true;
    annoPoints = [pos];

    const curCol = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';
    const penSz  = (typeof App !== 'undefined') ? App.penSize : 3;

    annoCtx.save();
    annoCtx.lineCap = 'round';
    annoCtx.lineJoin = 'round';

    if (tool === 'eraser') {
      const eSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : penSz * 8;
      annoCtx.globalCompositeOperation = 'destination-out';
      annoCtx.beginPath();
      annoCtx.arc(pos.x, pos.y, eSize / 2, 0, Math.PI * 2);
      annoCtx.fillStyle = 'rgba(0,0,0,1)';
      annoCtx.fill();
    } else if (tool === 'highlighter') {
      annoCtx.globalCompositeOperation = 'source-over';
      annoCtx.beginPath();
      annoCtx.arc(pos.x, pos.y, (penSz * 5) / 2, 0, Math.PI * 2);
      annoCtx.fillStyle = curCol + '60';
      annoCtx.fill();
    } else {
      annoCtx.globalCompositeOperation = 'source-over';
      annoCtx.beginPath();
      annoCtx.arc(pos.x, pos.y, penSz / 2, 0, Math.PI * 2);
      annoCtx.fillStyle = curCol;
      annoCtx.fill();
    }
    annoCtx.restore();
  }

  function onAnnoPointerMove(e) {
    if (!isAnnoDrawing) return;
    if (e.cancelable) e.preventDefault();

    const tool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const pos = getAnnoPos(e);
    annoPoints.push(pos);

    const curCol = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';
    const penSz  = (typeof App !== 'undefined') ? App.penSize : 3;

    annoCtx.save();
    annoCtx.lineCap = 'round';
    annoCtx.lineJoin = 'round';

    if (tool === 'eraser') {
      const eSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : penSz * 8;
      annoCtx.globalCompositeOperation = 'destination-out';
      annoCtx.lineWidth = eSize;
      annoCtx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
      annoCtx.globalCompositeOperation = 'source-over';
      annoCtx.lineWidth = penSz * 5;
      annoCtx.strokeStyle = curCol + '60';
    } else {
      annoCtx.globalCompositeOperation = 'source-over';
      annoCtx.lineWidth = penSz;
      annoCtx.strokeStyle = curCol;
    }

    if (annoPoints.length >= 3) {
      const n = annoPoints.length;
      const p0 = annoPoints[n - 3], p1 = annoPoints[n - 2], p2 = annoPoints[n - 1];
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      annoCtx.beginPath();
      annoCtx.moveTo(p0.x, p0.y);
      annoCtx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
      annoCtx.stroke();
    } else if (annoPoints.length === 2) {
      annoCtx.beginPath();
      annoCtx.moveTo(annoPoints[0].x, annoPoints[0].y);
      annoCtx.lineTo(pos.x, pos.y);
      annoCtx.stroke();
    }
    annoCtx.restore();
  }

  function onAnnoPointerUp() {
    isAnnoDrawing = false;
    annoPoints = [];
  }

  // ─────────────────────────────────────────────────────────────
  // BUILD DOM — In-Board Interactive Widget
  // ─────────────────────────────────────────────────────────────
  function buildOverlay() {
    let el = document.getElementById('math-visualizer-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'math-visualizer-overlay';
    el.style.cssText = `
      position: absolute;
      left: 64px; top: 0; right: 0; bottom: 0;
      z-index: 120;
      background: rgba(5, 12, 26, 0.98);
      border: none;
      border-left: 1px solid rgba(201, 168, 76, 0.25);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
      display: flex; flex-direction: column;
      opacity: 0; transition: opacity .2s ease, transform .2s ease;
      transform: scale(0.99);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #e2e8f0; user-select: none;
      overflow: hidden;
    `;
    el.innerHTML = `
      <!-- TOP HEADER -->
      <div style="display:flex;align-items:center;gap:12px;padding:9px 16px;
        background:linear-gradient(90deg,#060e1c 0%,#112247 50%,#060e1c 100%);
        border-bottom:1.5px solid #c9a84c;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:22px;filter:drop-shadow(0 0 6px rgba(201,168,76,0.6));">📐</span>
          <div>
            <div style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:#e8c96b;letter-spacing:.05em;">
              Interactive Mathematics Visualizer
            </div>
            <div style="font-size:9px;color:#c9a84c;letter-spacing:.14em;text-transform:uppercase;opacity:.85;">
              In-Board Interactive Concepts · PiyushDhara EduVerse
            </div>
          </div>
        </div>
        <div style="width:1px;height:26px;background:rgba(201,168,76,0.25);margin:0 4px;"></div>
        <!-- ACTIVE CONCEPT TITLE -->
        <div id="math-mod-pills" style="display:flex;padding:2px 4px;flex:1;align-items:center;"></div>
        <div style="width:1px;height:26px;background:rgba(201,168,76,0.25);margin:0 3px;"></div>
        <!-- ACTION BUTTONS -->
        <button id="math-btn-fullscreen" onclick="App.toggleFullscreen()" style="padding:6px 11px;border-radius:6px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.35);color:#e8c96b;font-weight:600;font-size:11.5px;cursor:pointer;display:flex;align-items:gap:4px;" title="Toggle Fullscreen Board Mode">
          ⛶ Fullscreen
        </button>
        <button id="math-btn-stamp" style="padding:6px 12px;border-radius:6px;background:linear-gradient(135deg,rgba(201,168,76,0.3),rgba(201,168,76,0.15));border:1.5px solid #c9a84c;color:#fef08a;font-weight:600;font-size:11.5px;cursor:pointer;display:flex;align-items:center;gap:5px;" title="Insert dynamic diagram to Whiteboard">
          📷 Insert to Board
        </button>
        <button id="math-btn-close" style="padding:6px 10px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-weight:600;font-size:11.5px;cursor:pointer;">
          ✕ Close
        </button>
      </div>
      <!-- MAIN BODY -->
      <div style="display:flex;flex:1;overflow:hidden;position:relative;">
        <!-- CONTROLS SIDEBAR -->
        <div id="math-sidebar" style="width:280px;background:#09142b;border-right:1px solid rgba(201,168,76,0.2);overflow-y:auto;padding:14px 12px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">
        </div>
        <!-- CANVAS VIEWPORT -->
        <div style="flex:1;position:relative;background:#030712;overflow:hidden;display:flex;flex-direction:column;">
          <!-- Live Math Canvas -->
          <canvas id="math-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;touch-action:none;"></canvas>

          <!-- Live Annotation Canvas (Pen / Eraser directly over math simulation) -->
          <canvas id="math-anno-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;touch-action:none;pointer-events:none;"></canvas>

          <!-- BOTTOM STATUS BAR -->
          <div id="math-telemetry" style="position:absolute;bottom:0;left:0;right:0;z-index:5;min-height:34px;padding:5px 14px;background:rgba(7,16,35,0.92);border-top:1px solid rgba(201,168,76,0.2);display:flex;align-items:center;gap:14px;font-family:'Cascadia Code','Consolas',monospace;font-size:11px;color:#94a3b8;flex-wrap:wrap;">
          </div>
        </div>
      </div>
    `;
    const targetZone = document.getElementById('canvas-zone') || document.body;
    targetZone.appendChild(el);
    canvas = el.querySelector('#math-canvas');
    ctx = canvas.getContext('2d');
    annoCanvas = el.querySelector('#math-anno-canvas');
    annoCtx = annoCanvas.getContext('2d');

    // Attach interactions
    window.addEventListener('resize', () => { if (visible) resizeCanvas(); });
    el.querySelector('#math-btn-close').addEventListener('click', hide);
    el.querySelector('#math-btn-stamp').addEventListener('click', stampToWhiteboard);

    // Canvas Pointer events for dragging
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    // Annotation Canvas Direct Drawing (Mouse + Touch)
    annoCanvas.addEventListener('mousedown', onAnnoPointerDown);
    annoCanvas.addEventListener('mousemove', onAnnoPointerMove);
    window.addEventListener('mouseup', onAnnoPointerUp);
    annoCanvas.addEventListener('touchstart', onAnnoPointerDown, { passive: false });
    annoCanvas.addEventListener('touchmove', onAnnoPointerMove, { passive: false });
    window.addEventListener('touchend', onAnnoPointerUp);

    return el;
  }

  function updateTabs() {
    const bar = document.getElementById('math-mod-pills');
    if (!bar) return;
    const MODULE_NAMES = {
      unitcircle: '⭕ Unit Circle & Sine Wave',
      vectors: '↗ Vectors & Components',
      calculus: '∫ Calculus, Tangents & Integrals',
      sequences: '∑ Sequences & Series',
      geometry: '△ Dynamic Geometry Proofs',
      transforms: '↻ Coordinate Transforms'
    };
    const title = MODULE_NAMES[activeModule] || 'Interactive Mathematics';
    bar.innerHTML = `
      <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 16px;border-radius:8px;background:rgba(201,168,76,0.18);border:1.5px solid rgba(201,168,76,0.45);color:#fef08a;font-weight:700;font-size:13px;letter-spacing:0.02em;">
        <span>${title}</span>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // CONTROLS BUILDER
  // ─────────────────────────────────────────────────────────────
  function buildControls() {
    const sb = document.getElementById('math-sidebar');
    if (!sb) return;
    sb.innerHTML = '';

    if (activeModule === 'unitcircle') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">⭕ Trigonometric Angle</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Angle (θ)</span><span class="val" id="val-uc-ang">${unitCircle.angleDeg}°</span></div>
            <input type="range" class="phys-slider" id="ctrl-uc-ang" min="0" max="360" step="1" value="${unitCircle.angleDeg}">
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px;">
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(30)">30° (π/6)</button>
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(45)">45° (π/4)</button>
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(60)">60° (π/3)</button>
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(90)">90° (π/2)</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:4px;">
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(120)">120°</button>
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(180)">180°</button>
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(270)">270°</button>
            <button class="phys-pill-btn" onclick="MathVisualizer.setAngle(360)">360°</button>
          </div>
          <button id="ctrl-uc-anim" class="phys-pill-btn" style="margin-top:8px;background:rgba(34,197,94,0.15);border-color:#22c55e;color:#86efac;">
            ${unitCircle.animating ? '⏸ Stop Rotation' : '▶ Animate Rotation'}
          </button>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">📐 Key Trigonometric Identities</div>
          <div style="font-family:'Cascadia Code',monospace;font-size:11px;color:#cbd5e1;line-height:1.7;">
            • <span style="color:#38bdf8;">cos(θ)</span> = x-coordinate<br>
            • <span style="color:#4ade80;">sin(θ)</span> = y-coordinate<br>
            • <span style="color:#a855f7;">tan(θ)</span> = sin(θ) / cos(θ)<br>
            • <b>sin²(θ) + cos²(θ) = 1</b> (Pythagorean Identity)<br>
            • 1 + tan²(θ) = sec²(θ)
          </div>
        </div>
      `;
      const angSlider = document.getElementById('ctrl-uc-ang');
      const angVal = document.getElementById('val-uc-ang');
      if (angSlider) {
        angSlider.addEventListener('input', e => {
          unitCircle.angleDeg = +e.target.value;
          if (angVal) angVal.textContent = unitCircle.angleDeg + '°';
        });
      }
      const animBtn = document.getElementById('ctrl-uc-anim');
      if (animBtn) {
        animBtn.addEventListener('click', () => {
          unitCircle.animating = !unitCircle.animating;
          animBtn.textContent = unitCircle.animating ? '⏸ Stop Rotation' : '▶ Animate Rotation';
        });
      }
    } else if (activeModule === 'calculus') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">∫ Function Selector</div>
          <select id="ctrl-calc-func" class="c-sel" style="width:100%;height:32px;background:#0d1b38;border:1px solid #c9a84c;color:#fef08a;font-size:12px;padding:0 8px;border-radius:6px;">
            <option value="poly" ${calculus.funcKey === 'poly' ? 'selected' : ''}>f(x) = x² - 2 (Parabola)</option>
            <option value="sin" ${calculus.funcKey === 'sin' ? 'selected' : ''}>f(x) = 2 sin(x) (Trig Wave)</option>
            <option value="cubic" ${calculus.funcKey === 'cubic' ? 'selected' : ''}>f(x) = x³ - 3x (Cubic)</option>
            <option value="gauss" ${calculus.funcKey === 'gauss' ? 'selected' : ''}>f(x) = 3 e^(-x²) (Bell Curve)</option>
          </select>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">📈 Derivative (Tangent Line)</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Point x₀</span><span class="val" id="val-calc-x0">${calculus.x0}</span></div>
            <input type="range" class="phys-slider" id="ctrl-calc-x0" min="-2.8" max="2.8" step="0.05" value="${calculus.x0}">
          </div>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">▦ Definite Integral (Riemann Sum)</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Lower Limit (a)</span><span class="val" id="val-calc-a">${calculus.intA}</span></div>
            <input type="range" class="phys-slider" id="ctrl-calc-a" min="-2.5" max="1.0" step="0.1" value="${calculus.intA}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Upper Limit (b)</span><span class="val" id="val-calc-b">${calculus.intB}</span></div>
            <input type="range" class="phys-slider" id="ctrl-calc-b" min="0.0" max="2.8" step="0.1" value="${calculus.intB}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Rectangles (n)</span><span class="val" id="val-calc-n">${calculus.rectCount}</span></div>
            <input type="range" class="phys-slider" id="ctrl-calc-n" min="4" max="40" step="2" value="${calculus.rectCount}">
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button class="phys-pill-btn ${calculus.riemannType === 'mid' ? 'active' : ''}" onclick="MathVisualizer.setRiemann('mid')">Midpoint</button>
            <button class="phys-pill-btn ${calculus.riemannType === 'left' ? 'active' : ''}" onclick="MathVisualizer.setRiemann('left')">Left Sum</button>
            <button class="phys-pill-btn ${calculus.riemannType === 'trap' ? 'active' : ''}" onclick="MathVisualizer.setRiemann('trap')">Trapezoid</button>
          </div>
        </div>
      `;
      const fSel = document.getElementById('ctrl-calc-func');
      if (fSel) fSel.addEventListener('change', e => { calculus.funcKey = e.target.value; });
      bindSlider('ctrl-calc-x0', 'val-calc-x0', '', v => { calculus.x0 = +v; });
      bindSlider('ctrl-calc-a', 'val-calc-a', '', v => { calculus.intA = +v; });
      bindSlider('ctrl-calc-b', 'val-calc-b', '', v => { calculus.intB = +v; });
      bindSlider('ctrl-calc-n', 'val-calc-n', '', v => { calculus.rectCount = +v; });
    } else if (activeModule === 'geometry') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">△ Geometry Theorem</div>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <button class="phys-pill-btn ${geometry.theorem === 'triangle' ? 'active' : ''}" onclick="MathVisualizer.setGeomTh('triangle')">
              1. Triangle Angles Sum = 180° & Exterior Angle
            </button>
            <button class="phys-pill-btn ${geometry.theorem === 'circle' ? 'active' : ''}" onclick="MathVisualizer.setGeomTh('circle')">
              2. Central Angle = 2 × Circumference Angle
            </button>
            <button class="phys-pill-btn ${geometry.theorem === 'pythagoras' ? 'active' : ''}" onclick="MathVisualizer.setGeomTh('pythagoras')">
              3. Visual Pythagoras Theorem: a² + b² = c²
            </button>
          </div>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🖐 Interactive Gesture Tip</div>
          <div style="font-size:11.5px;color:#cbd5e1;line-height:1.6;">
            • You can <b>touch & drag any vertex</b> (A, B, C, or P) directly on the screen to see angles recalculate live in real-time!
          </div>
        </div>
      `;
    } else if (activeModule === 'vectors') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">↗ Vector Controls</div>
          <div style="font-size:11.5px;color:#cbd5e1;line-height:1.6;margin-bottom:8px;">
            • <b>Drag vector arrowheads A and B</b> directly on canvas to reposition in 2D space.
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#e2e8f0;cursor:pointer;">
            <input type="checkbox" id="ctrl-vec-pll" ${vectors.showParallelogram ? 'checked' : ''}> Show Parallelogram Rule
          </label>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">📐 Vector Algebra Relations</div>
          <div style="font-family:'Cascadia Code',monospace;font-size:11px;color:#cbd5e1;line-height:1.7;">
            • Resultant: <b>R = A + B</b> = (Aₓ+Bₓ, Aᵧ+Bᵧ)<br>
            • Magnitude: |R| = √(A² + B² + 2AB cosθ)<br>
            • Dot Product: A · B = |A||B| cos(θ)<br>
            • Cross Product |A × B| = Parallelogram Area
          </div>
        </div>
      `;
      const pllCb = document.getElementById('ctrl-vec-pll');
      if (pllCb) pllCb.addEventListener('change', e => { vectors.showParallelogram = e.target.checked; });
    } else if (activeModule === 'sequences') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">∑ Sequence Type</div>
          <select id="ctrl-seq-type" class="c-sel" style="width:100%;height:32px;background:#0d1b38;border:1px solid #c9a84c;color:#fef08a;font-size:12px;padding:0 8px;border-radius:6px;">
            <option value="ap" ${sequences.type === 'ap' ? 'selected' : ''}>Arithmetic progression (AP)</option>
            <option value="gp" ${sequences.type === 'gp' ? 'selected' : ''}>Geometric progression (GP)</option>
          </select>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">Starting Values</div>
          <div class="phys-slider-row"><div class="phys-slider-head"><span>First term a₁</span><span class="val" id="val-seq-first">${sequences.first}</span></div><input type="range" class="phys-slider" id="ctrl-seq-first" min="-10" max="10" step="0.5" value="${sequences.first}"></div>
          <div class="phys-slider-row"><div class="phys-slider-head"><span>${sequences.type === 'ap' ? 'Difference d' : 'Ratio r'}</span><span class="val" id="val-seq-step">${sequences.type === 'ap' ? sequences.difference : sequences.ratio}</span></div><input type="range" class="phys-slider" id="ctrl-seq-step" min="-3" max="3" step="0.1" value="${sequences.type === 'ap' ? sequences.difference : sequences.ratio}"></div>
          <div class="phys-slider-row"><div class="phys-slider-head"><span>Terms n</span><span class="val" id="val-seq-terms">${sequences.terms}</span></div><input type="range" class="phys-slider" id="ctrl-seq-terms" min="4" max="24" step="1" value="${sequences.terms}"></div>
        </div>
        <div class="phys-ctrl-group"><div class="phys-ctrl-title">How to Read It</div><div style="font-size:11.5px;color:#cbd5e1;line-height:1.6;">Drag the sliders to compare constant addition with constant multiplication. The graph shows each term and the running sum.</div></div>
      `;
      document.getElementById('ctrl-seq-type')?.addEventListener('change', e => { sequences.type = e.target.value; buildControls(); });
      bindSlider('ctrl-seq-first', 'val-seq-first', '', v => { sequences.first = +v; });
      bindSlider('ctrl-seq-step', 'val-seq-step', '', v => { if (sequences.type === 'ap') sequences.difference = +v; else sequences.ratio = +v; });
      bindSlider('ctrl-seq-terms', 'val-seq-terms', '', v => { sequences.terms = +v; });
    } else if (activeModule === 'transforms') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">↻ Shape</div>
          <select id="ctrl-trans-shape" class="c-sel" style="width:100%;height:32px;background:#0d1b38;border:1px solid #c9a84c;color:#fef08a;font-size:12px;padding:0 8px;border-radius:6px;">
            <option value="triangle" ${transforms.shape === 'triangle' ? 'selected' : ''}>Triangle</option>
            <option value="square" ${transforms.shape === 'square' ? 'selected' : ''}>Square</option>
            <option value="arrow" ${transforms.shape === 'arrow' ? 'selected' : ''}>Arrow</option>
          </select>
        </div>
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">Transform</div>
          <div class="phys-slider-row"><div class="phys-slider-head"><span>Rotation</span><span class="val" id="val-trans-rot">${transforms.rotation}°</span></div><input type="range" class="phys-slider" id="ctrl-trans-rot" min="-180" max="180" step="5" value="${transforms.rotation}"></div>
          <div class="phys-slider-row"><div class="phys-slider-head"><span>Scale</span><span class="val" id="val-trans-scale">${transforms.scale.toFixed(1)}×</span></div><input type="range" class="phys-slider" id="ctrl-trans-scale" min="0.5" max="2" step="0.1" value="${transforms.scale}"></div>
          <div style="display:flex;gap:4px;margin-top:6px;"><button class="phys-pill-btn ${transforms.reflect === 'none' ? 'active' : ''}" onclick="MathVisualizer.setReflection('none')">Original</button><button class="phys-pill-btn ${transforms.reflect === 'x' ? 'active' : ''}" onclick="MathVisualizer.setReflection('x')">Reflect X</button><button class="phys-pill-btn ${transforms.reflect === 'y' ? 'active' : ''}" onclick="MathVisualizer.setReflection('y')">Reflect Y</button></div>
        </div>
        <div class="phys-ctrl-group"><div class="phys-ctrl-title">Coordinate Rule</div><div id="trans-rule" style="font-family:'Cascadia Code',monospace;font-size:11px;color:#cbd5e1;line-height:1.8;"></div></div>
      `;
      document.getElementById('ctrl-trans-shape')?.addEventListener('change', e => { transforms.shape = e.target.value; });
      bindSlider('ctrl-trans-rot', 'val-trans-rot', '°', v => { transforms.rotation = +v; });
      bindSlider('ctrl-trans-scale', 'val-trans-scale', '×', v => { transforms.scale = +v; });
    }
  }

  function bindSlider(sliderId, valId, unit, cb) {
    const slider = document.getElementById(sliderId);
    const val = document.getElementById(valId);
    if (!slider || !val) return;
    slider.addEventListener('input', e => {
      val.textContent = e.target.value + unit;
      cb(e.target.value);
    });
  }

  function setAngle(deg) {
    unitCircle.angleDeg = deg;
    const s = document.getElementById('ctrl-uc-ang');
    const v = document.getElementById('val-uc-ang');
    if (s) s.value = deg;
    if (v) v.textContent = deg + '°';
  }

  function setRiemann(type) {
    calculus.riemannType = type;
    buildControls();
  }

  function setGeomTh(th) {
    geometry.theorem = th;
    buildControls();
  }

  function setReflection(axis) {
    transforms.reflect = axis;
    buildControls();
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN DRAW LOOP
  // ─────────────────────────────────────────────────────────────
  function loop() {
    if (!visible) return;
    if (activeModule === 'unitcircle' && unitCircle.animating) {
      unitCircle.angleDeg = (unitCircle.angleDeg + unitCircle.speed * 0.016) % 360;
      const s = document.getElementById('ctrl-uc-ang');
      const v = document.getElementById('val-uc-ang');
      if (s) s.value = Math.floor(unitCircle.angleDeg);
      if (v) v.textContent = Math.floor(unitCircle.angleDeg) + '°';
    }
    renderModule();
    animId = requestAnimationFrame(loop);
  }

  function renderModule() {
    if (!ctx || !canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (activeModule === 'unitcircle') renderUnitCircle(W, H);
    else if (activeModule === 'calculus') renderCalculus(W, H);
    else if (activeModule === 'geometry') renderGeometry(W, H);
    else if (activeModule === 'vectors') renderVectors(W, H);
    else if (activeModule === 'sequences') renderSequences(W, H);
    else if (activeModule === 'transforms') renderTransformations(W, H);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. RENDER UNIT CIRCLE & WAVES
  // ─────────────────────────────────────────────────────────────
  function renderUnitCircle(W, H) {
    const cx = 220;
    const cy = H / 2;
    const R = 140;
    const rad = (unitCircle.angleDeg * Math.PI) / 180;
    const cosVal = Math.cos(rad);
    const sinVal = Math.sin(rad);
    const tanVal = Math.tan(rad);
    const px = cx + cosVal * R;
    const py = cy - sinVal * R;

    ctx.save();
    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - R - 40, cy); ctx.lineTo(cx + R + 40, cy);
    ctx.moveTo(cx, cy - R - 40); ctx.lineTo(cx, cy + R + 40);
    ctx.stroke();

    // Circle
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Right-angle triangle inside circle
    // 1. Cosine segment (x-axis: blue)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();

    // 2. Sine segment (vertical drop: green)
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();

    // 3. Hypotenuse (radius: gold)
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // Angle Arc
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, -rad, true);
    ctx.stroke();

    // Point on Circle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label coordinates
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`P(${cosVal.toFixed(2)}, ${sinVal.toFixed(2)})`, px + 12, py - 8);

    // Tangent Line at x = 1 (purple)
    if (Math.abs(cosVal) > 0.05) {
      const tanY = cy - tanVal * R;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + R, cy - R * 1.5);
      ctx.lineTo(cx + R, cy + R * 1.5);
      ctx.stroke();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx + R, cy);
      ctx.lineTo(cx + R, tanY);
      ctx.stroke();
    }

    // ── Synchronized Sine Wave on Right ──
    const waveStartX = cx + R + 70;
    const waveEndX = W - 40;
    const waveW = waveEndX - waveStartX;

    // Horizontal baseline for wave
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(waveStartX, cy); ctx.lineTo(waveEndX, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Line from unit circle P to wave start
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(waveStartX, py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot Sine wave: y(t) = R * sin(t)
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < waveW; x += 3) {
      const t = rad - (x / waveW) * (Math.PI * 2);
      const wy = cy - Math.sin(t) * R;
      if (x === 0) ctx.moveTo(waveStartX + x, wy);
      else ctx.lineTo(waveStartX + x, wy);
    }
    ctx.stroke();

    // Wave moving point
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(waveStartX, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Live Sine Wave: y = sin(θ)', waveStartX + 20, cy - R - 20);
    ctx.restore();

    updateTelemetry(`
      <span style="color:#fef08a;">Angle θ: <b>${unitCircle.angleDeg.toFixed(1)}°</b> (${(rad / Math.PI).toFixed(2)}π rad)</span> |
      <span style="color:#38bdf8;">cos(θ): <b>${cosVal.toFixed(3)}</b></span> |
      <span style="color:#4ade80;">sin(θ): <b>${sinVal.toFixed(3)}</b></span> |
      <span style="color:#a855f7;">tan(θ): <b>${Math.abs(tanVal) < 100 ? tanVal.toFixed(3) : 'Undefined'}</b></span> |
      <span style="color:#e8c96b;">sin²θ + cos²θ = <b>${(sinVal**2 + cosVal**2).toFixed(3)}</b></span>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RENDER CALCULUS
  // ─────────────────────────────────────────────────────────────
  function evalFunc(x) {
    const k = calculus.funcKey;
    if (k === 'poly') return x * x - 2;
    if (k === 'sin') return 2 * Math.sin(x);
    if (k === 'cubic') return 0.5 * (x * x * x - 3 * x);
    if (k === 'gauss') return 3 * Math.exp(-x * x);
    return x * x;
  }

  function evalDeriv(x) {
    const h = 0.0001;
    return (evalFunc(x + h) - evalFunc(x - h)) / (2 * h);
  }

  function renderCalculus(W, H) {
    const originX = W / 2 - 30;
    const originY = H / 2;
    const scaleX = (W * 0.7) / (calculus.viewRangeX * 2);
    const scaleY = (H * 0.7) / (calculus.viewRangeY * 2);

    ctx.save();
    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, originY); ctx.lineTo(W - 40, originY); // x-axis
    ctx.moveTo(originX, 40); ctx.lineTo(originX, H - 40); // y-axis
    ctx.stroke();

    // Grid ticks
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    for (let x = -3; x <= 3; x++) {
      if (x === 0) continue;
      const tx = originX + x * scaleX;
      ctx.beginPath(); ctx.moveTo(tx, originY - 4); ctx.lineTo(tx, originY + 4); ctx.stroke();
      ctx.fillText(x.toString(), tx - 4, originY + 16);
    }
    for (let y = -4; y <= 4; y++) {
      if (y === 0) continue;
      const ty = originY - y * scaleY;
      ctx.beginPath(); ctx.moveTo(originX - 4, ty); ctx.lineTo(originX + 4, ty); ctx.stroke();
      ctx.fillText(y.toString(), originX + 8, ty + 3);
    }

    // Riemann Sum Rectangles (Integral)
    const a = Math.min(calculus.intA, calculus.intB);
    const b = Math.max(calculus.intA, calculus.intB);
    const n = calculus.rectCount;
    const dx = (b - a) / n;
    let riemannSum = 0;

    for (let i = 0; i < n; i++) {
      let sampleX = a + i * dx;
      if (calculus.riemannType === 'right') sampleX = a + (i + 1) * dx;
      if (calculus.riemannType === 'mid') sampleX = a + (i + 0.5) * dx;
      const fVal = evalFunc(sampleX);
      riemannSum += fVal * dx;

      const rx = originX + (a + i * dx) * scaleX;
      const rw = dx * scaleX;
      const ry = fVal >= 0 ? originY - fVal * scaleY : originY;
      const rh = Math.abs(fVal) * scaleY;

      ctx.fillStyle = fVal >= 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }

    // Function Curve
    ctx.strokeStyle = '#e8c96b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const xMin = -calculus.viewRangeX, xMax = calculus.viewRangeX;
    for (let x = xMin; x <= xMax; x += 0.05) {
      const y = evalFunc(x);
      const cx = originX + x * scaleX;
      const cy = originY - y * scaleY;
      if (x === xMin) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Tangent Line at x0 (Derivative)
    const x0 = calculus.x0;
    const y0 = evalFunc(x0);
    const slope = evalDeriv(x0);
    const ptX = originX + x0 * scaleX;
    const ptY = originY - y0 * scaleY;

    // Tangent segment
    const tanSpan = 2.0;
    const x1 = x0 - tanSpan, y1 = y0 - slope * tanSpan;
    const x2 = x0 + tanSpan, y2 = y0 + slope * tanSpan;

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX + x1 * scaleX, originY - y1 * scaleY);
    ctx.lineTo(originX + x2 * scaleX, originY - y2 * scaleY);
    ctx.stroke();

    // Tangent evaluation point
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ptX, ptY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(`Slope m = f'(${x0.toFixed(2)}) = ${slope.toFixed(2)}`, ptX + 12, ptY - 14);
    ctx.restore();

    updateTelemetry(`
      <span style="color:#e8c96b;">Function: <b>${calculus.funcKey.toUpperCase()}</b></span> |
      <span style="color:#f43f5e;">Derivative at x₀=${x0.toFixed(2)}: <b>f'(x₀) = ${slope.toFixed(3)}</b></span> |
      <span style="color:#38bdf8;">Riemann Area [${a.toFixed(1)}, ${b.toFixed(1)}]: <b>${riemannSum.toFixed(3)}</b> (n=${n})</span>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. RENDER DYNAMIC GEOMETRY THEOREMS
  // ─────────────────────────────────────────────────────────────
  function renderGeometry(W, H) {
    const cx = W / 2 - 20;
    const cy = H / 2;
    ctx.save();

    if (geometry.theorem === 'triangle') {
      const A = { x: cx + geometry.triA.x, y: cy + geometry.triA.y };
      const B = { x: cx + geometry.triB.x, y: cy + geometry.triB.y };
      const C = { x: cx + geometry.triC.x, y: cy + geometry.triC.y };

      // Triangle fill & stroke
      ctx.fillStyle = 'rgba(201, 168, 76, 0.12)';
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Extended exterior line from B through D
      const extLen = 100;
      const dirBC = { x: B.x - A.x, y: B.y - A.y };
      const normBC = Math.hypot(dirBC.x, dirBC.y);
      const D = { x: B.x + (dirBC.x / normBC) * extLen, y: B.y + (dirBC.y / normBC) * extLen };

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(D.x, D.y); ctx.stroke();
      ctx.setLineDash([]);

      // Compute angles via dot products
      const angA = computeAngle(A, B, C);
      const angB = computeAngle(B, A, C);
      const angC = computeAngle(C, A, B);
      const extB = 180 - angB;

      // Draw angle arcs
      drawAngleArc(A, B, C, angA, '#38bdf8', `A: ${angA.toFixed(1)}°`);
      drawAngleArc(B, C, A, angB, '#4ade80', `B: ${angB.toFixed(1)}°`);
      drawAngleArc(C, A, B, angC, '#a855f7', `C: ${angC.toFixed(1)}°`);

      // Exterior angle arc at B
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`Ext ∠: ${extB.toFixed(1)}° = A + C`, B.x + 20, B.y - 15);

      // Vertex drag handles
      drawVertexHandle(A.x, A.y, 'A');
      drawVertexHandle(B.x, B.y, 'B');
      drawVertexHandle(C.x, C.y, 'C');

      const sum = angA + angB + angC;
      updateTelemetry(`
        <span style="color:#e8c96b;">Theorem: <b>∠A + ∠B + ∠C = 180°</b></span> |
        <span style="color:#38bdf8;">∠A = <b>${angA.toFixed(1)}°</b></span> |
        <span style="color:#4ade80;">∠B = <b>${angB.toFixed(1)}°</b></span> |
        <span style="color:#a855f7;">∠C = <b>${angC.toFixed(1)}°</b></span> |
        <span style="color:#fef08a;">Sum: <b>${sum.toFixed(1)}°</b> (Universal Constant)</span>
      `);
    } else if (geometry.theorem === 'circle') {
      const O = { x: cx, y: cy };
      const R = geometry.circleR;

      // Circle
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(O.x, O.y, R, 0, Math.PI * 2);
      ctx.stroke();

      const A = { x: O.x + Math.cos(geometry.circleAngleA) * R, y: O.y + Math.sin(geometry.circleAngleA) * R };
      const B = { x: O.x + Math.cos(geometry.circleAngleB) * R, y: O.y + Math.sin(geometry.circleAngleB) * R };
      const P = { x: O.x + Math.cos(geometry.circleAngleP) * R, y: O.y + Math.sin(geometry.circleAngleP) * R };

      // Center O
      ctx.fillStyle = '#e8c96b';
      ctx.beginPath(); ctx.arc(O.x, O.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('O (Center)', O.x + 8, O.y - 8);

      // Central Angle rays: OA and OB
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(O.x, O.y); ctx.lineTo(B.x, B.y);
      ctx.stroke();

      // Inscribed Angle rays: PA and PB
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(P.x, P.y); ctx.lineTo(B.x, B.y);
      ctx.stroke();

      // Calculate angles
      let centralAng = (geometry.circleAngleB - geometry.circleAngleA) * 180 / Math.PI;
      if (centralAng < 0) centralAng += 360;
      if (centralAng > 180) centralAng = 360 - centralAng;
      const inscribedAng = centralAng / 2;

      drawVertexHandle(A.x, A.y, 'A');
      drawVertexHandle(B.x, B.y, 'B');
      drawVertexHandle(P.x, P.y, 'P (Drag Me!)');

      updateTelemetry(`
        <span style="color:#e8c96b;">Theorem: <b>Central Angle = 2 × Inscribed Angle</b></span> |
        <span style="color:#f43f5e;">Central ∠AOB: <b>${centralAng.toFixed(1)}°</b></span> |
        <span style="color:#38bdf8;">Inscribed ∠APB: <b>${inscribedAng.toFixed(1)}°</b></span> |
        <span style="color:#4ade80;">Ratio: <b>2.00×</b> (Always Exactly Double)</span>
      `);
    } else if (geometry.theorem === 'pythagoras') {
      const a = geometry.pythA;
      const b = geometry.pythB;
      const c = Math.hypot(a, b);
      const ox = cx - a / 2;
      const oy = cy + b / 2;

      // Triangle vertices: (ox, oy), (ox+a, oy), (ox, oy-b)
      ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy); ctx.lineTo(ox + a, oy); ctx.lineTo(ox, oy - b); ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Square on base A (downwards)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.strokeStyle = '#38bdf8';
      ctx.fillRect(ox, oy, a, a);
      ctx.strokeRect(ox, oy, a, a);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`a² = ${Math.round(a**2)}`, ox + a / 2 - 25, oy + a / 2);

      // Square on height B (leftwards)
      ctx.fillStyle = 'rgba(74, 222, 128, 0.2)';
      ctx.strokeStyle = '#4ade80';
      ctx.fillRect(ox - b, oy - b, b, b);
      ctx.strokeRect(ox - b, oy - b, b, b);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`b² = ${Math.round(b**2)}`, ox - b / 2 - 25, oy - b / 2);

      // Square on hypotenuse C (slanted)
      ctx.save();
      ctx.translate(ox, oy - b);
      const hypAngle = Math.atan2(b, a);
      ctx.rotate(-hypAngle);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.strokeStyle = '#f43f5e';
      ctx.fillRect(0, -c, c, c);
      ctx.strokeRect(0, -c, c, c);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`c² = a² + b² = ${Math.round(c**2)}`, c / 2 - 50, -c / 2);
      ctx.restore();

      updateTelemetry(`
        <span style="color:#e8c96b;">Pythagoras Theorem: <b>a² + b² = c²</b></span> |
        <span style="color:#38bdf8;">Base a = ${a} (Area = <b>${a*a}</b>)</span> |
        <span style="color:#4ade80;">Height b = ${b} (Area = <b>${b*b}</b>)</span> |
        <span style="color:#f43f5e;">Hypotenuse c = ${c.toFixed(1)} (Area = <b>${Math.round(c*c)}</b>)</span>
      `);
    }
    ctx.restore();
  }

  function computeAngle(v, p1, p2) {
    const v1 = { x: p1.x - v.x, y: p1.y - v.y };
    const v2 = { x: p2.x - v.x, y: p2.y - v.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
  }

  function drawAngleArc(v, p1, p2, deg, color, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(label, v.x + 10, v.y - 12);
  }

  function drawVertexHandle(x, y, label) {
    ctx.fillStyle = '#c9a84c';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(label, x - 5, y - 14);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. RENDER VECTORS
  // ─────────────────────────────────────────────────────────────
  function renderVectors(W, H) {
    const origin = { x: W / 2 - 40, y: H / 2 + 30 };
    const A = vectors.vecA;
    const B = vectors.vecB;
    const R = { x: A.x + B.x, y: A.y + B.y };

    ctx.save();
    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(40, origin.y); ctx.lineTo(W - 40, origin.y);
    ctx.moveTo(origin.x, 40); ctx.lineTo(origin.x, H - 40);
    ctx.stroke();

    // Parallelogram dashed lines
    if (vectors.showParallelogram) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.35)';
      ctx.beginPath();
      ctx.moveTo(origin.x + A.x, origin.y + A.y);
      ctx.lineTo(origin.x + R.x, origin.y + R.y);
      ctx.lineTo(origin.x + B.x, origin.y + B.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vector A (Blue)
    drawVectorArrow(origin.x, origin.y, origin.x + A.x, origin.y + A.y, '#38bdf8', 'Vector A');
    // Vector B (Green)
    drawVectorArrow(origin.x, origin.y, origin.x + B.x, origin.y + B.y, '#4ade80', 'Vector B');
    // Resultant R (Gold)
    drawVectorArrow(origin.x, origin.y, origin.x + R.x, origin.y + R.y, '#facc15', 'Resultant R = A + B');

    // Drag Handles at tips
    drawVertexHandle(origin.x + A.x, origin.y + A.y, 'A');
    drawVertexHandle(origin.x + B.x, origin.y + B.y, 'B');
    ctx.restore();

    const magA = Math.hypot(A.x, A.y);
    const magB = Math.hypot(B.x, B.y);
    const magR = Math.hypot(R.x, R.y);
    const dot = A.x * B.x + A.y * B.y;

    updateTelemetry(`
      <span style="color:#38bdf8;">Vector A: (${A.x}, ${-A.y}) | |A|=<b>${magA.toFixed(1)}</b></span> |
      <span style="color:#4ade80;">Vector B: (${B.x}, ${-B.y}) | |B|=<b>${magB.toFixed(1)}</b></span> |
      <span style="color:#facc15;">Resultant R = A+B: (${R.x}, ${-R.y}) | |R|=<b>${magR.toFixed(1)}</b></span> |
      <span style="color:#e8c96b;">Dot Product A·B = <b>${dot}</b></span>
    `);
  }

  function drawVectorArrow(fromX, fromY, toX, toY, color, label) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, toX + 10, toY + 5);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. RENDER SEQUENCES & SERIES
  // ─────────────────────────────────────────────────────────────
  function renderSequences(W, H) {
    const originX = 70;
    const originY = H - 70;
    const plotW = W - 130;
    const plotH = H - 130;
    const values = [];
    let total = 0;

    for (let i = 0; i < sequences.terms; i++) {
      const value = sequences.type === 'ap'
        ? sequences.first + i * sequences.difference
        : sequences.first * Math.pow(sequences.ratio, i);
      values.push(value);
      total += value;
    }

    const maxAbs = Math.max(1, ...values.map(value => Math.abs(value)));
    const yScale = plotH / (maxAbs * 2.4);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(originX, originY - plotH / 2); ctx.lineTo(originX, originY + plotH / 2);
    ctx.moveTo(originX, originY); ctx.lineTo(originX + plotW, originY);
    ctx.stroke();

    const xStep = plotW / Math.max(1, sequences.terms - 1);
    values.forEach((value, index) => {
      const x = originX + index * xStep;
      const y = originY - value * yScale;

      ctx.strokeStyle = value >= 0 ? 'rgba(56,189,248,.35)' : 'rgba(244,63,94,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, originY); ctx.lineTo(x, y); ctx.stroke();

      ctx.fillStyle = '#e8c96b';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.fillText(`a${index + 1}`, x - 7, originY + 18);
      ctx.fillText(value.toFixed(1), x - 13, y - 10);
    });

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(sequences.type === 'ap' ? 'Arithmetic Progression (AP)' : 'Geometric Progression (GP)', originX, 32);
    ctx.restore();

    const stepLabel = sequences.type === 'ap' ? `d = ${sequences.difference}` : `r = ${sequences.ratio}`;
    updateTelemetry(`
      <span style="color:#e8c96b;">a₁ = <b>${sequences.first}</b></span> |
      <span style="color:#38bdf8;">${stepLabel}</span> |
      <span style="color:#4ade80;">n = <b>${sequences.terms}</b></span> |
      <span style="color:#fef08a;">Sum Sₙ = <b>${total.toFixed(2)}</b></span>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. RENDER TRANSFORMATIONS
  // ─────────────────────────────────────────────────────────────
  function renderTransformations(W, H) {
    const cx = W / 2;
    const cy = H / 2 + 20;
    const base = transforms.shape === 'square'
      ? [[-90,-90],[90,-90],[90,90],[-90,90]]
      : transforms.shape === 'arrow'
      ? [[-120,60],[40,60],[40,110],[140,0],[40,-110],[40,-60],[-120,-60]]
      : [[0,-130],[-130,100],[130,100]];

    const rad = transforms.rotation * Math.PI / 180;
    const sx = transforms.reflect === 'y' ? -1 : 1;
    const sy = transforms.reflect === 'x' ? -1 : 1;
    const points = base.map(([x, y]) => {
      const px = x * transforms.scale * sx;
      const py = y * transforms.scale * sy;
      return { x: cx + px * Math.cos(rad) - py * Math.sin(rad), y: cy + px * Math.sin(rad) + py * Math.cos(rad) };
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, cy); ctx.lineTo(W - 30, cy); ctx.moveTo(cx, 45); ctx.lineTo(cx, H - 40); ctx.stroke();

    // Original faint ghost shape
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.beginPath();
    base.forEach(([x, y], index) => { const bx = cx + x; const by = cy + y; index ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by); });
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);

    // Transformed shape
    ctx.strokeStyle = '#e8c96b'; ctx.fillStyle = 'rgba(201,168,76,.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    points.forEach((point, index) => {
      ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.fillText(String.fromCharCode(65 + index), point.x + 8, point.y - 8);
    });
    ctx.restore();

    const reflection = transforms.reflect === 'none' ? 'none' : `reflect across ${transforms.reflect === 'x' ? 'x' : 'y'}-axis`;
    const rule = document.getElementById('trans-rule');
    if (rule) rule.innerHTML = `Rotation: ${transforms.rotation}°<br>Scale: ${transforms.scale.toFixed(1)}×<br>${reflection}`;
    updateTelemetry(`
      <span style="color:#e8c96b;">Shape: <b>${transforms.shape}</b></span> |
      <span style="color:#38bdf8;">Rotation: <b>${transforms.rotation}°</b></span> |
      <span style="color:#4ade80;">Scale: <b>${transforms.scale.toFixed(1)}×</b></span> |
      <span style="color:#fef08a;">Reflection: <b>${reflection}</b></span>
    `);
  }

  function updateTelemetry(html) {
    const el = document.getElementById('math-telemetry');
    if (el) el.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────
  // POINTER INTERACTIONS (DRAG VERTICES & VECTORS)
  // ─────────────────────────────────────────────────────────────
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onPointerDown(e) {
    const pos = getCanvasPos(e);
    const cx = canvas.width / 2 - 20;
    const cy = canvas.height / 2;
    if (activeModule === 'geometry') {
      if (geometry.theorem === 'triangle') {
        const A = { x: cx + geometry.triA.x, y: cy + geometry.triA.y };
        const B = { x: cx + geometry.triB.x, y: cy + geometry.triB.y };
        const C = { x: cx + geometry.triC.x, y: cy + geometry.triC.y };
        if (Math.hypot(pos.x - A.x, pos.y - A.y) < 25) geometry.draggedPoint = 'A';
        else if (Math.hypot(pos.x - B.x, pos.y - B.y) < 25) geometry.draggedPoint = 'B';
        else if (Math.hypot(pos.x - C.x, pos.y - C.y) < 25) geometry.draggedPoint = 'C';
      } else if (geometry.theorem === 'circle') {
        const O = { x: cx, y: cy };
        const R = geometry.circleR;
        const P = { x: O.x + Math.cos(geometry.circleAngleP) * R, y: O.y + Math.sin(geometry.circleAngleP) * R };
        if (Math.hypot(pos.x - P.x, pos.y - P.y) < 28) geometry.draggedPoint = 'P';
      }
    } else if (activeModule === 'vectors') {
      const origin = { x: canvas.width / 2 - 40, y: canvas.height / 2 + 30 };
      const tipA = { x: origin.x + vectors.vecA.x, y: origin.y + vectors.vecA.y };
      const tipB = { x: origin.x + vectors.vecB.x, y: origin.y + vectors.vecB.y };
      if (Math.hypot(pos.x - tipA.x, pos.y - tipA.y) < 25) vectors.draggedVec = 'A';
      else if (Math.hypot(pos.x - tipB.x, pos.y - tipB.y) < 25) vectors.draggedVec = 'B';
    }
  }

  function onPointerMove(e) {
    if (!geometry.draggedPoint && !vectors.draggedVec) return;
    const pos = getCanvasPos(e);
    const cx = canvas.width / 2 - 20;
    const cy = canvas.height / 2;
    if (geometry.draggedPoint) {
      if (geometry.draggedPoint === 'A') geometry.triA = { x: pos.x - cx, y: pos.y - cy };
      if (geometry.draggedPoint === 'B') geometry.triB = { x: pos.x - cx, y: pos.y - cy };
      if (geometry.draggedPoint === 'C') geometry.triC = { x: pos.x - cx, y: pos.y - cy };
      if (geometry.draggedPoint === 'P') {
        geometry.circleAngleP = Math.atan2(pos.y - cy, pos.x - cx);
      }
    }
    if (vectors.draggedVec) {
      const origin = { x: canvas.width / 2 - 40, y: canvas.height / 2 + 30 };
      if (vectors.draggedVec === 'A') vectors.vecA = { x: pos.x - origin.x, y: pos.y - origin.y };
      if (vectors.draggedVec === 'B') vectors.vecB = { x: pos.x - origin.x, y: pos.y - origin.y };
    }
  }

  function onPointerUp() {
    geometry.draggedPoint = null;
    vectors.draggedVec = null;
  }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      onPointerDown(e);
    }
  }

  function onTouchMove(e) {
    if (geometry.draggedPoint || vectors.draggedVec) {
      e.preventDefault();
      onPointerMove(e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // WHITEBOARD STAMP INTEGRATION
  // ─────────────────────────────────────────────────────────────
  function stampToWhiteboard() {
    if (!canvas) return;
    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = canvas.width;
      snapCanvas.height = canvas.height;
      const sCtx = snapCanvas.getContext('2d');
      sCtx.fillStyle = '#060f1e';
      sCtx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);
      sCtx.drawImage(canvas, 0, 0);
      if (annoCanvas) {
        sCtx.drawImage(annoCanvas, 0, 0);
      }
      sCtx.font = 'bold 14px Georgia, serif';
      sCtx.fillStyle = '#e8c96b';
      sCtx.fillText(`PiyushDhara EduVerse — Math Visualizer (${activeModule.toUpperCase()})`, 24, 32);
      const dataUrl = snapCanvas.toDataURL('image/png');

      if (window.Canvas && typeof Canvas.addImageShape === 'function') {
        Canvas.addImageShape(dataUrl, 100, 100, 520, 320, `${activeModule.toUpperCase()} Math Snapshot`);
        hide();
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('📷 Math Visualizer snapshot added to Whiteboard!');
        }
      } else {
        const img = new Image();
        img.onload = () => {
          const drawCtx = Canvas.getDrawCtx();
          drawCtx.drawImage(img, 100, 100, 520, 320);
          hide();
          if (window.App && typeof App.showToast === 'function') {
            App.showToast('📷 Math snapshot stamped onto board!');
          }
        };
        img.src = dataUrl;
      }
    } catch (err) {
      console.error('Failed to stamp math visualizer to board:', err);
    }
  }

  return {
    show,
    hide,
    toggle,
    isVisible,
    undo,
    redo,
    addTextAnnotation,
    setAngle,
    setRiemann,
    setGeomTh,
    setReflection,
    setAnnotationMode,
    clearAnnotations,
    syncToolWithBoard
  };
})();

window.MathVisualizer = MathVisualizer;
