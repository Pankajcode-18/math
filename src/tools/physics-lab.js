'use strict';

// ═══════════════════════════════════════════════════════════════
// ADVANCED INTERACTIVE PHYSICS LABORATORY
// Real-time Physics Simulations with Live Parameter Controls,
// Vector Visualizations, Energy Gauges, & Canvas Snapshot
// ═══════════════════════════════════════════════════════════════

const PhysicsLab = (() => {
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let visible = false;
  let animId = null;
  let lastTime = 0;
  let activeSim = 'projectile';
  let isPlaying = true;
  let simSpeed = 1.0;
  let simTime = 0;
  let annoCanvas = null;
  let annoCtx = null;
  let isAnnoDrawing = false;
  let annoPoints = [];
  let drawingMode = 'interact';
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 30;

  // ─────────────────────────────────────────────────────────────
  // SIMULATION STATES & DATA
  // ─────────────────────────────────────────────────────────────
  const SIMS = [
    { id: 'projectile', name: '🚀 Projectile Motion', category: 'Mechanics' },
    { id: 'pendulum', name: '⏱ Simple & Damped Pendulum', category: 'Oscillations' },
    { id: 'collision', name: '💥 1D/2D Collisions', category: 'Momentum' },
    { id: 'incline', name: '📐 Inclined Plane & FBD', category: 'Forces' },
    { id: 'waves', name: '🌊 Waves & Superposition', category: 'Waves' },
    { id: 'optics', name: '🔍 Snell\'s Law & Lens Rays', category: 'Optics' },
    { id: 'circuits', name: '⚡ DC Circuits & Lorentz', category: 'Electromagnetism' },
    { id: 'thermodynamics', name: '🔥 Kinetic Gas & PV=nRT', category: 'Thermodynamics' }
  ];

  // 1. PROJECTILE STATE
  const projectile = {
    angle: 45, // degrees
    v0: 28, // m/s
    h0: 0, // launch height (m)
    gravity: 9.8, // m/s²
    airDrag: false, // air resistance
    dragCoeff: 0.018,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    trail: [],
    t: 0,
    maxH: 0,
    range: 0,
    flightT: 0,
    landed: false,
    scale: 6.5, // pixels per meter
    originX: 70,
    originY: 0
  };

  // 2. PENDULUM STATE
  const pendulum = {
    length: 2.2, // meters
    mass: 1.5, // kg
    gravity: 9.8, // m/s²
    damping: 0.04, // air resistance damping
    theta0: 45, // initial deg
    theta: (45 * Math.PI) / 180,
    omega: 0,
    alpha: 0,
    trail: [],
    scale: 140
  };

  // 3. COLLISION STATE
  const collision = {
    m1: 2.5, // kg
    u1: 4.0, // m/s
    m2: 3.5, // kg
    u2: -2.0, // m/s
    e: 1.0, // coefficient of restitution (1 = elastic, 0 = inelastic)
    x1: 180,
    v1: 4.0,
    x2: 520,
    v2: -2.0,
    collided: false,
    flashTimer: 0
  };

  // 4. INCLINE STATE
  const incline = {
    angle: 30, // deg
    mass: 2.0, // kg
    gravity: 9.8,
    muS: 0.35, // static friction
    muK: 0.22, // kinetic friction
    dist: 0, // distance along ramp
    v: 0,
    scale: 1.0,
    sliding: true
  };

  // 5. WAVES STATE
  const waves = {
    mode: 'standing', // 'standing' or 'traveling' or 'interference'
    harmonic: 2, // n = 1, 2, 3, 4, 5
    frequency: 1.5, // Hz
    amplitude: 55, // px
    speed: 160, // px/s
    phase: 0
  };

  // 6. OPTICS STATE
  const optics = {
    subMode: 'refraction', // 'refraction' or 'lens'
    n1: 1.0, // medium 1 (Air: 1.0)
    n2: 1.5, // medium 2 (Glass: 1.5, Water: 1.33, Diamond: 2.42)
    incidentAngle: 42, // degrees
    lensFocal: 120, // px
    lensType: 'convex',
    objDist: 220, // px
    objHeight: 65 // px
  };

  // 7. CIRCUITS STATE
  const circuits = {
    voltage: 12, // Volts
    r1: 6, // Ohms
    r2: 12, // Ohms
    circuitType: 'series', // 'series' or 'parallel'
    switchClosed: true,
    particles: [],
    // Lorentz force submode
    lorentz: false,
    charge: 1, // +1 or -1
    partV: 200,
    magFieldB: 25, // arbitrary unit
    partX: 200,
    partY: 300,
    partVx: 200,
    partVy: 0,
    partTrail: []
  };

  // 8. THERMODYNAMICS STATE
  const thermo = {
    temp: 300, // Kelvin
    volume: 80, // % width of piston
    nParticles: 60,
    particles: [],
    pressure: 0,
    collisionsWall: 0
  };

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE & OVERLAY BUILD
  // ─────────────────────────────────────────────────────────────
  function show(defaultSim) {
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
    if (defaultSim) activeSim = defaultSim;
    updateSimSelector();
    buildControls();
    resizeCanvas();
    resetSimulation();
    syncToolWithBoard();
    lastTime = performance.now();
    if (!animId) loop(lastTime);
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
  // LIVE ANNOTATION OVER SIMULATION (Pen, Marker, Eraser, Text, Undo/Redo)
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
    const existing = document.getElementById('phys-anno-text-input');
    if (existing) existing.remove();

    const rect = annoCanvas.getBoundingClientRect();
    const scaleX = annoCanvas.width / (rect.width || 1);
    const scaleY = annoCanvas.height / (rect.height || 1);

    const input = document.createElement('input');
    input.id = 'phys-anno-text-input';
    input.type = 'text';
    input.placeholder = 'Type note / formula...';
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
    let el = document.getElementById('physics-lab-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'physics-lab-overlay';
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
      <!-- TOP HEADER (Ultra Modern Cybernetic Lab Bar) -->
      <div style="display:flex;align-items:center;gap:14px;padding:10px 18px;
                  background:linear-gradient(90deg, #050b18 0%, #0c1a38 50%, #050b18 100%);
                  border-bottom:1px solid rgba(56, 189, 248, 0.25);
                  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
                  flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(56,189,248,0.25),rgba(129,140,248,0.15));border:1px solid rgba(56,189,248,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(56,189,248,0.35);">
            <span style="font-size:20px;filter:drop-shadow(0 0 6px rgba(56,189,248,0.8));">⚡</span>
          </div>
          <div>
            <div style="font-family:'Outfit','Plus Jakarta Sans',system-ui,sans-serif;font-size:15px;font-weight:800;letter-spacing:0.02em;background:linear-gradient(135deg,#ffffff 40%,#7dd3fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
              Physics Simulation Lab
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:9.5px;color:#94a3b8;letter-spacing:0.06em;font-weight:600;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
              <span>INTERACTIVE STEM ENVIRONMENT</span>
            </div>
          </div>
        </div>

        <div style="width:1px;height:28px;background:rgba(255,255,255,0.1);margin:0 4px;"></div>

        <!-- SIMULATION SELECTOR PILLS -->
        <div id="phys-sim-pills" style="display:flex;align-items:center;gap:6px;padding:2px 4px;flex-shrink:0;white-space:nowrap;"></div>

        <!-- PLAYBACK CONTROLS -->
        <div style="display:flex;align-items:center;gap:6px;background:rgba(15,23,42,0.7);padding:4px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);flex-shrink:0;white-space:nowrap;">
          <button id="phys-btn-play" class="phys-header-btn" style="background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.45);color:#6ee7b7;box-shadow:0 0 10px rgba(16,185,129,0.2);" title="Play / Pause Simulation">
            <span>⏸</span> Pause
          </button>
          <button id="phys-btn-step" class="phys-header-btn" style="background:rgba(56,189,248,0.14);border:1px solid rgba(56,189,248,0.35);color:#7dd3fc;" title="Step 1 Frame Forward">
            <span>⏭</span> Step
          </button>
          <button id="phys-btn-reset" class="phys-header-btn" style="background:rgba(244,63,94,0.14);border:1px solid rgba(244,63,94,0.35);color:#fda4af;" title="Reset Simulation Parameters">
            <span>🔄</span> Reset
          </button>
          <div style="width:1px;height:20px;background:rgba(255,255,255,0.12);margin:0 2px;"></div>
          <!-- SPEED -->
          <div style="display:flex;gap:2px;background:rgba(0,0,0,0.25);padding:2px;border-radius:8px;" id="phys-speed-pills">
            <button class="speed-btn" data-spd="0.25">0.25×</button>
            <button class="speed-btn" data-spd="0.5">0.5×</button>
            <button class="speed-btn active" data-spd="1.0">1×</button>
            <button class="speed-btn" data-spd="2.0">2×</button>
          </div>
        </div>

        <div style="width:1px;height:28px;background:rgba(255,255,255,0.1);margin:0 4px;"></div>

        <!-- ACTION BUTTONS -->
        <button id="phys-btn-fullscreen" onclick="App.toggleFullscreen()" class="phys-header-btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;" title="Toggle Fullscreen Board Mode">
          ⛶ Fullscreen
        </button>
        <button id="phys-btn-stamp" class="phys-header-btn" style="background:linear-gradient(135deg,rgba(234,179,8,0.25),rgba(202,138,4,0.2));border:1.5px solid #eab308;color:#fef08a;box-shadow:0 0 12px rgba(234,179,8,0.25);" title="Stamp simulation snapshot to Whiteboard">
          📷 Insert to Board
        </button>
        <button id="phys-btn-close" class="phys-header-btn" style="background:rgba(239,68,68,0.14);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;" title="Close Physics Lab">
          ✕ Close
        </button>
      </div>

      <!-- MAIN BODY -->
      <div style="display:flex;flex:1;overflow:hidden;position:relative;">
        <!-- CONTROLS SIDEBAR -->
        <div id="phys-sidebar" style="width:clamp(220px, 18vw, 280px);background:rgba(6,13,28,0.95);backdrop-filter:blur(20px);border-right:1px solid rgba(255,255,255,0.08);overflow-y:auto;padding:10px 8px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;">
          <!-- Injected dynamically based on activeSim -->
        </div>

        <!-- SIMULATION CANVAS VIEWPORT -->
        <div style="flex:1;position:relative;background:#030712;overflow:hidden;display:flex;flex-direction:column;">
          <!-- Live Simulation Layer -->
          <canvas id="phys-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;"></canvas>

          <!-- Live Annotation Layer (Pen / Eraser directly over simulation) -->
          <canvas id="phys-anno-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;touch-action:none;pointer-events:none;"></canvas>

          <!-- BOTTOM TELEMETRY / FORMULA BAR -->
          <div id="phys-telemetry" style="position:absolute;bottom:0;left:0;right:0;z-index:5;min-height:38px;padding:6px 16px;background:rgba(5,11,24,0.92);backdrop-filter:blur(12px);border-top:1px solid rgba(56,189,248,0.15);display:flex;align-items:center;gap:10px;font-family:'Cascadia Code','Consolas',monospace;font-size:11.5px;color:#94a3b8;flex-wrap:wrap;box-shadow:0 -4px 16px rgba(0,0,0,0.3);">
          </div>
        </div>
      </div>
    `;

    const targetZone = document.getElementById('canvas-zone') || document.body;
    targetZone.appendChild(el);
    canvas = el.querySelector('#phys-canvas');
    ctx = canvas.getContext('2d');
    annoCanvas = el.querySelector('#phys-anno-canvas');
    annoCtx = annoCanvas.getContext('2d');

    // Event listeners (Mouse + Touch)
    window.addEventListener('resize', () => { if (visible) resizeCanvas(); });
    el.querySelector('#phys-btn-close').addEventListener('click', hide);
    el.querySelector('#phys-btn-play').addEventListener('click', togglePlay);
    el.querySelector('#phys-btn-step').addEventListener('click', stepFrame);
    el.querySelector('#phys-btn-reset').addEventListener('click', resetSimulation);
    el.querySelector('#phys-btn-stamp').addEventListener('click', stampToWhiteboard);

    // Canvas Direct Manipulation (Mouse + Touch)
    canvas.addEventListener('mousedown', onPhysPointerDown);
    canvas.addEventListener('mousemove', onPhysPointerMove);
    window.addEventListener('mouseup', onPhysPointerUp);
    canvas.addEventListener('touchstart', onPhysTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onPhysTouchMove, { passive: false });
    window.addEventListener('touchend', onPhysPointerUp);

    // Annotation Canvas Direct Drawing (Mouse + Touch)
    annoCanvas.addEventListener('mousedown', onAnnoPointerDown);
    annoCanvas.addEventListener('mousemove', onAnnoPointerMove);
    window.addEventListener('mouseup', onAnnoPointerUp);
    annoCanvas.addEventListener('touchstart', onAnnoPointerDown, { passive: false });
    annoCanvas.addEventListener('touchmove', onAnnoPointerMove, { passive: false });
    window.addEventListener('touchend', onAnnoPointerUp);

    // Speed buttons
    el.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simSpeed = parseFloat(btn.dataset.spd);
      });
    });

    // Style for speed buttons and controls (Optimized for finger touch & ultra-modern lab UI)
    const style = document.createElement('style');
    style.textContent = `
      #phys-sidebar::-webkit-scrollbar { width: 5px; }
      #phys-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

      .phys-ctrl-group {
        background: rgba(15, 23, 42, 0.7);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 12px;
        padding: 9px 10px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .phys-ctrl-group:hover {
        border-color: rgba(56, 189, 248, 0.28);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
      }

      .phys-ctrl-title {
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      }
      .phys-ctrl-title .title-icon {
        font-size: 13px;
        margin-right: 3px;
      }

      .phys-slider-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .phys-slider-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 10.5px;
        font-weight: 600;
        color: #94a3b8;
      }
      .phys-slider-head span.val {
        color: #38bdf8;
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        font-weight: 700;
        font-size: 10.5px;
        background: rgba(56, 189, 248, 0.12);
        padding: 1px 6px;
        border-radius: 5px;
        border: 1px solid rgba(56, 189, 248, 0.25);
      }

      /* Ultra Sleek Modern Slider */
      .phys-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 5px !important;
        min-height: 0 !important;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 5px;
        outline: none;
        cursor: pointer;
        touch-action: manipulation;
        transition: background 0.15s ease;
        margin: 6px 0;
      }
      .phys-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #38bdf8;
        box-shadow: 0 0 8px rgba(56, 189, 248, 0.8), 0 1px 4px rgba(0, 0, 0, 0.5);
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s;
      }
      .phys-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 0 14px rgba(56, 189, 248, 1), 0 2px 5px rgba(0, 0, 0, 0.6);
      }
      .phys-slider::-webkit-slider-thumb:active {
        transform: scale(1.25);
        background: #38bdf8;
        border-color: #ffffff;
      }

      /* Planet Preset Cards */
      .phys-planet-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        margin-top: 2px;
      }
      .phys-planet-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 5px 2px 4px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        touch-action: manipulation;
      }
      .phys-planet-btn:hover {
        background: rgba(56, 189, 248, 0.12);
        border-color: rgba(56, 189, 248, 0.4);
        transform: translateY(-1px);
      }
      .phys-planet-btn.active {
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(129, 140, 248, 0.2));
        border-color: #38bdf8;
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
        transform: translateY(-1px);
      }
      .phys-planet-btn .p-icon { font-size: 13px; }
      .phys-planet-btn .p-name { font-size: 9px; font-weight: 700; color: #f8fafc; }
      .phys-planet-btn .p-g { font-size: 7.5px; font-family: monospace; color: #94a3b8; }
      .phys-planet-btn.active .p-g { color: #7dd3fc; font-weight: 600; }

      /* iOS Toggle Switch */
      .phys-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 10px;
        cursor: pointer;
        margin-top: 4px;
        transition: all 0.15s;
      }
      .phys-toggle-row:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .phys-toggle-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .phys-toggle-title {
        font-size: 11px;
        font-weight: 700;
        color: #f1f5f9;
      }
      .phys-toggle-desc {
        font-size: 9px;
        color: #64748b;
      }
      .phys-switch {
        position: relative;
        width: 36px;
        height: 20px;
        flex-shrink: 0;
      }
      .phys-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .phys-switch-slider {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 20px;
        transition: 0.2s;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .phys-switch-slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 2px;
        bottom: 2px;
        background: white;
        border-radius: 50%;
        transition: 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      }
      .phys-switch input:checked + .phys-switch-slider {
        background: #38bdf8;
        border-color: #38bdf8;
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
      }
      .phys-switch input:checked + .phys-switch-slider:before {
        transform: translateX(16px);
      }

      /* Formula Cards Grid */
      .phys-formula-cards {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .phys-f-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 8px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 7px;
      }
      .phys-f-item .f-tag {
        font-size: 9.5px;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.02em;
      }
      .phys-f-item .f-code {
        font-family: 'Cascadia Code', monospace;
        font-size: 11px;
        font-weight: 600;
        color: #fde047;
      }

      .phys-sim-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 12px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(129, 140, 248, 0.1));
        border: 1.5px solid rgba(56, 189, 248, 0.4);
        color: #f8fafc;
        font-weight: 700;
        font-size: 12.5px;
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.2);
        letter-spacing: 0.01em;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .phys-header-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        transition: all 0.14s ease;
        touch-action: manipulation;
      }
      .phys-header-btn:hover {
        filter: brightness(1.15);
        transform: translateY(-1px);
      }
      .phys-header-btn:active {
        transform: translateY(1px);
      }
      .speed-btn {
        padding: 5px 9px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.12s ease;
      }
      .speed-btn:hover {
        color: #ffffff;
      }
      .speed-btn.active {
        background: rgba(56, 189, 248, 0.25);
        border-color: rgba(56, 189, 248, 0.5);
        color: #38bdf8;
        font-weight: 700;
        box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);
      }

      /* Bottom Telemetry Chips */
      .phys-tele-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 3px 8px;
        border-radius: 7px;
        font-size: 11px;
      }
      .phys-tele-chip .chip-k {
        color: #94a3b8;
        font-weight: 600;
      }
      .phys-tele-chip .chip-v {
        font-weight: 700;
        font-family: 'Cascadia Code', monospace;
      }
    `;
    document.head.appendChild(style);

    return el;
  }

  // ─────────────────────────────────────────────────────────────
  // TOUCH & POINTER DIRECT CANVAS MANIPULATION
  // ─────────────────────────────────────────────────────────────
  let physDragTarget = null;
  let physDragLast = { x: 0, y: 0 };

  function getPhysCanvasPos(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches.length > 0
      ? e.touches[0]
      : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : e);
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function onPhysPointerDown(e) {
    const pos = getPhysCanvasPos(e);
    physDragLast = { x: pos.x, y: pos.y };
    const W = canvas.width, H = canvas.height;

    if (activeSim === 'projectile') {
      const originX = 80;
      const groundY = H - 90;
      const platH = projectile.h0 * projectile.scale;
      const cx = originX;
      const cy = groundY - platH;
      if (pos.x >= cx - 20) {
        physDragTarget = 'projectile';
        aimProjectile(pos.x, pos.y, cx, cy);
      }
    } else if (activeSim === 'pendulum') {
      const pivotX = W / 2 - 40;
      const pivotY = 90;
      const L_px = pendulum.length * pendulum.scale;
      const bobX = pivotX + Math.sin(pendulum.theta) * L_px;
      const bobY = pivotY + Math.cos(pendulum.theta) * L_px;
      if (Math.hypot(pos.x - bobX, pos.y - bobY) < 55 || pos.y > pivotY + 20) {
        physDragTarget = 'pendulum';
        aimPendulum(pos.x, pos.y, pivotX, pivotY);
      }
    } else if (activeSim === 'collision') {
      const trackY = H / 2 + 50;
      const cartW1 = 50 + collision.m1 * 5;
      const cartW2 = 50 + collision.m2 * 5;
      if (pos.x >= collision.x1 - 10 && pos.x <= collision.x1 + cartW1 + 10 && Math.abs(pos.y - (trackY - 20)) < 40) {
        physDragTarget = 'cart1';
      } else if (pos.x >= collision.x2 - 10 && pos.x <= collision.x2 + cartW2 + 10 && Math.abs(pos.y - (trackY - 20)) < 40) {
        physDragTarget = 'cart2';
      }
    } else if (activeSim === 'incline') {
      const startX = 100, startY = H - 100, rampLen = 520;
      const rad = (incline.angle * Math.PI) / 180;
      const endX = startX + Math.cos(rad) * rampLen;
      const endY = startY - Math.sin(rad) * rampLen;
      if (Math.hypot(pos.x - endX, pos.y - endY) < 50) {
        physDragTarget = 'incline-angle';
      } else {
        physDragTarget = 'incline-block';
      }
    } else if (activeSim === 'optics') {
      const midY = H / 2, midX = W / 2;
      if (optics.subMode === 'refraction') {
        if (pos.y < midY) {
          physDragTarget = 'optics-ray';
          aimRefraction(pos.x, pos.y, midX, midY);
        }
      } else {
        const lensX = W / 2;
        const objX = lensX - optics.objDist;
        const objTopY = midY - optics.objHeight;
        if (Math.hypot(pos.x - objX, pos.y - objTopY) < 60 || (pos.x < lensX && Math.abs(pos.x - objX) < 35)) {
          physDragTarget = 'optics-obj';
        }
      }
    } else if (activeSim === 'circuits') {
      if (!circuits.lorentz) {
        const left = W / 2 - 220, top = 110, cw = 440, ch = 240;
        const swX = left + cw / 2, swY = top + ch;
        if (Math.hypot(pos.x - swX, pos.y - swY) < 45) {
          circuits.switchClosed = !circuits.switchClosed;
          const sw = document.getElementById('ctrl-cir-sw');
          if (sw) sw.checked = circuits.switchClosed;
        }
      } else {
        circuits.partX = pos.x;
        circuits.partY = pos.y;
        circuits.partTrail = [];
        physDragTarget = 'lorentz-particle';
      }
    } else if (activeSim === 'thermodynamics') {
      const left = 70, top = 80;
      const maxW = W * 0.68;
      const curW = maxW * (thermo.volume / 100);
      const boxH = H - 180;
      if (pos.x >= left + curW - 35 && pos.x <= left + curW + 80 && pos.y >= top && pos.y <= top + boxH) {
        physDragTarget = 'thermo-piston';
      }
    }
  }

  function onPhysPointerMove(e) {
    if (!physDragTarget) return;
    const pos = getPhysCanvasPos(e);
    const W = canvas.width, H = canvas.height;
    const dx = pos.x - physDragLast.x;
    physDragLast = { x: pos.x, y: pos.y };

    if (physDragTarget === 'projectile') {
      const originX = 80;
      const groundY = H - 90;
      const platH = projectile.h0 * projectile.scale;
      aimProjectile(pos.x, pos.y, originX, groundY - platH);
    } else if (physDragTarget === 'pendulum') {
      const pivotX = W / 2 - 40;
      const pivotY = 90;
      aimPendulum(pos.x, pos.y, pivotX, pivotY);
    } else if (physDragTarget === 'cart1') {
      collision.x1 = Math.max(40, Math.min(collision.x2 - 60, collision.x1 + dx));
      collision.v1 = dx * 1.5;
    } else if (physDragTarget === 'cart2') {
      collision.x2 = Math.max(collision.x1 + 60, Math.min(W - 100, collision.x2 + dx));
      collision.v2 = dx * 1.5;
    } else if (physDragTarget === 'incline-angle') {
      const startX = 100, startY = H - 100;
      const rad = Math.atan2(startY - pos.y, pos.x - startX);
      const deg = Math.max(5, Math.min(65, Math.round(rad * 180 / Math.PI)));
      incline.angle = deg;
      const sl = document.getElementById('ctrl-inc-angle');
      const vl = document.getElementById('val-inc-angle');
      if (sl) sl.value = deg;
      if (vl) vl.textContent = deg + '°';
    } else if (physDragTarget === 'incline-block') {
      incline.dist = Math.max(0, incline.dist + dx * 0.1);
    } else if (physDragTarget === 'optics-ray') {
      const midY = H / 2, midX = W / 2;
      aimRefraction(pos.x, pos.y, midX, midY);
    } else if (physDragTarget === 'optics-obj') {
      const lensX = W / 2, midY = H / 2;
      const do_ = Math.max(70, Math.min(380, Math.round(lensX - pos.x)));
      const ho_ = Math.max(20, Math.min(110, Math.round(midY - pos.y)));
      optics.objDist = do_;
      optics.objHeight = ho_;
      const sdo = document.getElementById('ctrl-opt-do');
      const vdo = document.getElementById('val-opt-do');
      const sho = document.getElementById('ctrl-opt-ho');
      const vho = document.getElementById('val-opt-ho');
      if (sdo) sdo.value = do_;
      if (vdo) vdo.textContent = do_ + ' px';
      if (sho) sho.value = ho_;
      if (vho) vho.textContent = ho_ + ' px';
    } else if (physDragTarget === 'lorentz-particle') {
      circuits.partX = pos.x;
      circuits.partY = pos.y;
    } else if (physDragTarget === 'thermo-piston') {
      const left = 70;
      const maxW = W * 0.68;
      const pct = Math.max(40, Math.min(95, Math.round(((pos.x - left) / maxW) * 100)));
      thermo.volume = pct;
      const sl = document.getElementById('ctrl-thm-v');
      const vl = document.getElementById('val-thm-v');
      if (sl) sl.value = pct;
      if (vl) vl.textContent = pct + '%';
    }
  }

  function onPhysPointerUp() {
    if (physDragTarget === 'projectile') {
      resetSimulation();
    }
    physDragTarget = null;
  }

  function onPhysTouchStart(e) {
    e.preventDefault();
    onPhysPointerDown(e);
  }

  function onPhysTouchMove(e) {
    if (physDragTarget) {
      e.preventDefault();
      onPhysPointerMove(e);
    }
  }

  function aimProjectile(px, py, cx, cy) {
    const rad = Math.atan2(cy - py, px - cx);
    let deg = Math.round(rad * 180 / Math.PI);
    deg = Math.max(5, Math.min(85, deg));
    projectile.angle = deg;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist > 40) {
      const spd = Math.max(8, Math.min(60, Math.round(dist / 6)));
      projectile.v0 = spd;
      const v0s = document.getElementById('ctrl-proj-v0');
      const v0v = document.getElementById('val-proj-v0');
      if (v0s) {
        v0s.value = spd;
        updateSliderFill(v0s);
      }
      if (v0v) v0v.textContent = spd + ' m/s';
    }
    const as = document.getElementById('ctrl-proj-angle');
    const av = document.getElementById('val-proj-angle');
    if (as) {
      as.value = deg;
      updateSliderFill(as);
    }
    if (av) av.textContent = deg + '°';
  }

  function aimPendulum(px, py, cx, cy) {
    const th = Math.atan2(px - cx, py - cy);
    const clampedTh = Math.max(-1.4, Math.min(1.4, th));
    pendulum.theta = clampedTh;
    pendulum.omega = 0;
    pendulum.theta0 = Math.round(clampedTh * 180 / Math.PI);
    const ts = document.getElementById('ctrl-pend-th');
    const tv = document.getElementById('val-pend-th');
    if (ts) ts.value = Math.abs(pendulum.theta0);
    if (tv) tv.textContent = Math.abs(pendulum.theta0) + '°';
  }

  function aimRefraction(px, py, cx, cy) {
    const angle = Math.atan2(cx - px, cy - py);
    let deg = Math.max(0, Math.min(85, Math.round(angle * 180 / Math.PI)));
    optics.incidentAngle = deg;
    const s = document.getElementById('ctrl-opt-ang');
    const v = document.getElementById('val-opt-ang');
    if (s) s.value = deg;
    if (v) v.textContent = deg + '°';
  }

  function updateSimSelector() {
    const bar = document.getElementById('phys-sim-pills');
    if (!bar) return;
    const curSim = SIMS.find(s => s.id === activeSim) || SIMS[0];
    bar.innerHTML = `
      <div class="phys-sim-badge">
        <span style="font-size:16px;">${curSim.name.split(' ')[0]}</span>
        <div style="display:flex;flex-direction:column;line-height:1.2;">
          <span style="font-size:13px;font-weight:800;color:#f8fafc;">${curSim.name.replace(/^[^\s]+\s*/, '')}</span>
          <span style="font-size:9px;font-weight:700;color:#38bdf8;letter-spacing:0.08em;text-transform:uppercase;">${curSim.category} · INTERACTIVE LAB</span>
        </div>
      </div>
    `;
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('phys-btn-play');
    if (btn) {
      btn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
      btn.style.background = isPlaying ? 'rgba(34,197,94,0.18)' : 'rgba(56,189,248,0.2)';
      btn.style.borderColor = isPlaying ? 'rgba(34,197,94,0.4)' : 'rgba(56,189,248,0.5)';
      btn.style.color = isPlaying ? '#86efac' : '#7dd3fc';
    }
  }

  function stepFrame() {
    isPlaying = false;
    const btn = document.getElementById('phys-btn-play');
    if (btn) { btn.textContent = '▶ Play'; }
    updateSimulation(0.016);
    renderSimulation();
  }

  // ─────────────────────────────────────────────────────────────
  // RESET SIMULATIONS
  // ─────────────────────────────────────────────────────────────
  function resetSimulation() {
    simTime = 0;
    if (activeSim === 'projectile') {
      const rad = (projectile.angle * Math.PI) / 180;
      projectile.x = 0;
      projectile.y = projectile.h0;
      projectile.vx = projectile.v0 * Math.cos(rad);
      projectile.vy = projectile.v0 * Math.sin(rad);
      projectile.trail = [];
      projectile.t = 0;
      projectile.landed = false;
      // Analytical max height and range
      const vy0 = projectile.v0 * Math.sin(rad);
      const g = projectile.gravity;
      projectile.maxH = projectile.h0 + (vy0 * vy0) / (2 * g);
      const tPeak = vy0 / g;
      const tFall = Math.sqrt((2 * projectile.maxH) / g);
      projectile.flightT = tPeak + tFall;
      projectile.range = projectile.vx * projectile.flightT;
    } else if (activeSim === 'pendulum') {
      pendulum.theta = (pendulum.theta0 * Math.PI) / 180;
      pendulum.omega = 0;
      pendulum.alpha = 0;
      pendulum.trail = [];
    } else if (activeSim === 'collision') {
      collision.x1 = 180;
      collision.v1 = collision.u1;
      collision.x2 = 520;
      collision.v2 = collision.u2;
      collision.collided = false;
      collision.flashTimer = 0;
    } else if (activeSim === 'incline') {
      incline.dist = 0;
      incline.v = 0;
      incline.sliding = true;
    } else if (activeSim === 'waves') {
      waves.phase = 0;
    } else if (activeSim === 'circuits') {
      initCircuitParticles();
      circuits.partX = 180;
      circuits.partY = 280;
      circuits.partVx = circuits.partV;
      circuits.partVy = 0;
      circuits.partTrail = [];
    } else if (activeSim === 'thermodynamics') {
      initGasParticles();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SIMULATION CONTROLS SIDEBAR GENERATOR
  // ─────────────────────────────────────────────────────────────
  function buildControls() {
    const sb = document.getElementById('phys-sidebar');
    if (!sb) return;
    sb.innerHTML = '';

    if (activeSim === 'projectile') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">
            <span><span class="title-icon">🚀</span> Launch Parameters</span>
            <span style="font-size:9.5px;color:#38bdf8;background:rgba(56,189,248,0.12);padding:2px 7px;border-radius:6px;border:1px solid rgba(56,189,248,0.25);font-weight:700;">KINEMATICS</span>
          </div>
          
          <div class="phys-slider-row">
            <div class="phys-slider-head">
              <span>Launch Angle (θ)</span>
              <span class="val" id="val-proj-angle">${projectile.angle}°</span>
            </div>
            <input type="range" class="phys-slider" id="ctrl-proj-angle" min="5" max="85" step="1" value="${projectile.angle}">
          </div>

          <div class="phys-slider-row">
            <div class="phys-slider-head">
              <span>Initial Speed (v₀)</span>
              <span class="val" id="val-proj-v0">${projectile.v0} m/s</span>
            </div>
            <input type="range" class="phys-slider" id="ctrl-proj-v0" min="5" max="60" step="1" value="${projectile.v0}">
          </div>

          <div class="phys-slider-row">
            <div class="phys-slider-head">
              <span>Launch Height (h₀)</span>
              <span class="val" id="val-proj-h0">${projectile.h0} m</span>
            </div>
            <input type="range" class="phys-slider" id="ctrl-proj-h0" min="0" max="40" step="1" value="${projectile.h0}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">
            <span><span class="title-icon">🪐</span> Celestial Gravity</span>
            <span style="font-size:9.5px;color:#a855f7;background:rgba(168,85,247,0.12);padding:2px 7px;border-radius:6px;border:1px solid rgba(168,85,247,0.25);font-weight:700;">FIELD</span>
          </div>

          <div class="phys-slider-row">
            <div class="phys-slider-head">
              <span>Gravitational Accel (g)</span>
              <span class="val" id="val-proj-g">${projectile.gravity} m/s²</span>
            </div>
            <input type="range" class="phys-slider" id="ctrl-proj-g" min="1.0" max="25" step="0.1" value="${projectile.gravity}">
          </div>

          <div class="phys-planet-grid">
            <button class="phys-planet-btn ${Math.abs(projectile.gravity - 9.8) < 0.1 ? 'active' : ''}" id="btn-planet-earth" onclick="PhysicsLab.setProjPreset('earth')">
              <span class="p-icon">🌍</span>
              <span class="p-name">Earth</span>
              <span class="p-g">9.8 m/s²</span>
            </button>
            <button class="phys-planet-btn ${Math.abs(projectile.gravity - 1.62) < 0.1 ? 'active' : ''}" id="btn-planet-moon" onclick="PhysicsLab.setProjPreset('moon')">
              <span class="p-icon">🌕</span>
              <span class="p-name">Moon</span>
              <span class="p-g">1.6 m/s²</span>
            </button>
            <button class="phys-planet-btn ${Math.abs(projectile.gravity - 3.72) < 0.1 ? 'active' : ''}" id="btn-planet-mars" onclick="PhysicsLab.setProjPreset('mars')">
              <span class="p-icon">🔴</span>
              <span class="p-name">Mars</span>
              <span class="p-g">3.7 m/s²</span>
            </button>
            <button class="phys-planet-btn ${Math.abs(projectile.gravity - 24.79) < 0.1 ? 'active' : ''}" id="btn-planet-jupiter" onclick="PhysicsLab.setProjPreset('jupiter')">
              <span class="p-icon">🪐</span>
              <span class="p-name">Jupiter</span>
              <span class="p-g">24.8 m/s²</span>
            </button>
          </div>

          <label class="phys-toggle-row">
            <div class="phys-toggle-text">
              <div class="phys-toggle-title">Atmospheric Drag</div>
              <div class="phys-toggle-desc">Quadratic Resistance (F_drag ∝ v²)</div>
            </div>
            <div class="phys-switch">
              <input type="checkbox" id="ctrl-proj-drag" ${projectile.airDrag ? 'checked' : ''}>
              <span class="phys-switch-slider"></span>
            </div>
          </label>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">
            <span><span class="title-icon">📐</span> Kinematic Formulas</span>
            <span style="font-size:9.5px;color:#10b981;background:rgba(16,185,129,0.12);padding:2px 7px;border-radius:6px;border:1px solid rgba(16,185,129,0.25);font-weight:700;">LIVE MATH</span>
          </div>
          <div class="phys-formula-cards">
            <div class="phys-f-item">
              <span class="f-tag">Horizontal Velocity</span>
              <span class="f-code" style="color:#7dd3fc;">vₓ = v₀ cos(θ)</span>
            </div>
            <div class="phys-f-item">
              <span class="f-tag">Vertical Velocity</span>
              <span class="f-code" style="color:#c084fc;">vᵧ(t) = v₀ sin(θ) - gt</span>
            </div>
            <div class="phys-f-item">
              <span class="f-tag">Max Trajectory Apex</span>
              <span class="f-code" style="color:#f87171;">H_max = h₀ + v₀²sin²θ / 2g</span>
            </div>
            <div class="phys-f-item">
              <span class="f-tag">Total Ground Range</span>
              <span class="f-code" style="color:#4ade80;">R = (v₀² sin 2θ) / g</span>
            </div>
            <div class="phys-f-item">
              <span class="f-tag">Total Flight Time</span>
              <span class="f-code" style="color:#fbbf24;">T = 2 v₀ sin(θ) / g</span>
            </div>
          </div>
        </div>
      `;
      bindSlider('ctrl-proj-angle', 'val-proj-angle', '°', v => { projectile.angle = +v; resetSimulation(); });
      bindSlider('ctrl-proj-v0', 'val-proj-v0', ' m/s', v => { projectile.v0 = +v; resetSimulation(); });
      bindSlider('ctrl-proj-h0', 'val-proj-h0', ' m', v => { projectile.h0 = +v; resetSimulation(); });
      bindSlider('ctrl-proj-g', 'val-proj-g', ' m/s²', v => { projectile.gravity = +v; resetSimulation(); });
      const dragCb = document.getElementById('ctrl-proj-drag');
      if (dragCb) dragCb.addEventListener('change', e => { projectile.airDrag = e.target.checked; resetSimulation(); });

    } else if (activeSim === 'pendulum') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">⏱ Pendulum Parameters</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>String Length (L)</span><span class="val" id="val-pend-l">${pendulum.length} m</span></div>
            <input type="range" class="phys-slider" id="ctrl-pend-l" min="0.5" max="4.0" step="0.1" value="${pendulum.length}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Bob Mass (m)</span><span class="val" id="val-pend-m">${pendulum.mass} kg</span></div>
            <input type="range" class="phys-slider" id="ctrl-pend-m" min="0.2" max="5.0" step="0.1" value="${pendulum.mass}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Initial Angle (θ₀)</span><span class="val" id="val-pend-th">${pendulum.theta0}°</span></div>
            <input type="range" class="phys-slider" id="ctrl-pend-th" min="5" max="80" step="1" value="${pendulum.theta0}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Damping / Friction</span><span class="val" id="val-pend-damp">${pendulum.damping}</span></div>
            <input type="range" class="phys-slider" id="ctrl-pend-damp" min="0" max="0.3" step="0.01" value="${pendulum.damping}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">📐 Theoretical Analysis</div>
          <div style="font-family:'Cascadia Code',monospace;font-size:11px;color:#94a3b8;line-height:1.6;">
            • Small Angle Period: T ≈ 2π√(L/g)<br>
            • Energy: E_tot = KE + PE = const<br>
            • Restoring Torque: τ = -mgL sin(θ)<br>
            • Nonlinear ODE: θ'' + (b/m)θ' + (g/L)sinθ = 0
          </div>
        </div>
      `;
      bindSlider('ctrl-pend-l', 'val-pend-l', ' m', v => { pendulum.length = +v; resetSimulation(); });
      bindSlider('ctrl-pend-m', 'val-pend-m', ' kg', v => { pendulum.mass = +v; });
      bindSlider('ctrl-pend-th', 'val-pend-th', '°', v => { pendulum.theta0 = +v; resetSimulation(); });
      bindSlider('ctrl-pend-damp', 'val-pend-damp', '', v => { pendulum.damping = +v; });

    } else if (activeSim === 'collision') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🔵 Cart 1 (Left)</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Mass (m₁)</span><span class="val" id="val-col-m1">${collision.m1} kg</span></div>
            <input type="range" class="phys-slider" id="ctrl-col-m1" min="0.5" max="10" step="0.5" value="${collision.m1}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Initial Velocity (u₁)</span><span class="val" id="val-col-u1">${collision.u1} m/s</span></div>
            <input type="range" class="phys-slider" id="ctrl-col-u1" min="-6" max="6" step="0.5" value="${collision.u1}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🟠 Cart 2 (Right)</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Mass (m₂)</span><span class="val" id="val-col-m2">${collision.m2} kg</span></div>
            <input type="range" class="phys-slider" id="ctrl-col-m2" min="0.5" max="10" step="0.5" value="${collision.m2}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Initial Velocity (u₂)</span><span class="val" id="val-col-u2">${collision.u2} m/s</span></div>
            <input type="range" class="phys-slider" id="ctrl-col-u2" min="-6" max="6" step="0.5" value="${collision.u2}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">💥 Elasticity (Restitution e)</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Coefficient (e)</span><span class="val" id="val-col-e">${collision.e}</span></div>
            <input type="range" class="phys-slider" id="ctrl-col-e" min="0" max="1" step="0.05" value="${collision.e}">
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button class="phys-pill-btn ${collision.e === 1 ? 'active' : ''}" onclick="PhysicsLab.setColType(1)">Elastic (e=1)</button>
            <button class="phys-pill-btn ${collision.e === 0 ? 'active' : ''}" onclick="PhysicsLab.setColType(0)">Inelastic (e=0)</button>
          </div>
        </div>
      `;
      bindSlider('ctrl-col-m1', 'val-col-m1', ' kg', v => { collision.m1 = +v; resetSimulation(); });
      bindSlider('ctrl-col-u1', 'val-col-u1', ' m/s', v => { collision.u1 = +v; resetSimulation(); });
      bindSlider('ctrl-col-m2', 'val-col-m2', ' kg', v => { collision.m2 = +v; resetSimulation(); });
      bindSlider('ctrl-col-u2', 'val-col-u2', ' m/s', v => { collision.u2 = +v; resetSimulation(); });
      bindSlider('ctrl-col-e', 'val-col-e', '', v => { collision.e = +v; });

    } else if (activeSim === 'incline') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">📐 Incline Geometry & Mass</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Ramp Angle (θ)</span><span class="val" id="val-inc-angle">${incline.angle}°</span></div>
            <input type="range" class="phys-slider" id="ctrl-inc-angle" min="5" max="65" step="1" value="${incline.angle}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Block Mass (m)</span><span class="val" id="val-inc-m">${incline.mass} kg</span></div>
            <input type="range" class="phys-slider" id="ctrl-inc-m" min="0.5" max="10" step="0.5" value="${incline.mass}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🧲 Surface Friction</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Static Friction (μₛ)</span><span class="val" id="val-inc-mus">${incline.muS}</span></div>
            <input type="range" class="phys-slider" id="ctrl-inc-mus" min="0" max="0.8" step="0.05" value="${incline.muS}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Kinetic Friction (μₖ)</span><span class="val" id="val-inc-muk">${incline.muK}</span></div>
            <input type="range" class="phys-slider" id="ctrl-inc-muk" min="0" max="0.7" step="0.05" value="${incline.muK}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">⚖ Free-Body Diagram (FBD)</div>
          <div style="font-family:'Cascadia Code',monospace;font-size:11px;color:#94a3b8;line-height:1.6;">
            • Weight: W = mg<br>
            • Normal: N = mg cos(θ)<br>
            • Downhill Force: F_par = mg sin(θ)<br>
            • Friction: f_k = μₖ N = μₖ mg cos(θ)<br>
            • Net Accel: a = g[sin(θ) - μₖ cos(θ)]
          </div>
        </div>
      `;
      bindSlider('ctrl-inc-angle', 'val-inc-angle', '°', v => { incline.angle = +v; resetSimulation(); });
      bindSlider('ctrl-inc-m', 'val-inc-m', ' kg', v => { incline.mass = +v; resetSimulation(); });
      bindSlider('ctrl-inc-mus', 'val-inc-mus', '', v => { incline.muS = +v; resetSimulation(); });
      bindSlider('ctrl-inc-muk', 'val-inc-muk', '', v => { incline.muK = +v; resetSimulation(); });

    } else if (activeSim === 'waves') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🌊 Wave Mode</div>
          <div style="display:flex;gap:4px;">
            <button class="phys-pill-btn ${waves.mode === 'standing' ? 'active' : ''}" onclick="PhysicsLab.setWaveMode('standing')">Standing Wave</button>
            <button class="phys-pill-btn ${waves.mode === 'traveling' ? 'active' : ''}" onclick="PhysicsLab.setWaveMode('traveling')">Traveling Wave</button>
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🎛 Oscillation Parameters</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Harmonic Mode (n)</span><span class="val" id="val-wave-harm">${waves.harmonic}</span></div>
            <input type="range" class="phys-slider" id="ctrl-wave-harm" min="1" max="6" step="1" value="${waves.harmonic}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Frequency (f)</span><span class="val" id="val-wave-freq">${waves.frequency} Hz</span></div>
            <input type="range" class="phys-slider" id="ctrl-wave-freq" min="0.5" max="5.0" step="0.1" value="${waves.frequency}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Amplitude (A)</span><span class="val" id="val-wave-amp">${waves.amplitude} px</span></div>
            <input type="range" class="phys-slider" id="ctrl-wave-amp" min="15" max="90" step="5" value="${waves.amplitude}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">💡 Standing Wave Relations</div>
          <div style="font-family:'Cascadia Code',monospace;font-size:11px;color:#94a3b8;line-height:1.6;">
            • Wavelength: λₙ = 2L / n<br>
            • Frequency: fₙ = n · v / 2L = n · f₁<br>
            • Nodes (N): Zero vibration<br>
            • Antinodes (A): Max amplitude (2A)
          </div>
        </div>
      `;
      bindSlider('ctrl-wave-harm', 'val-wave-harm', '', v => { waves.harmonic = +v; });
      bindSlider('ctrl-wave-freq', 'val-wave-freq', ' Hz', v => { waves.frequency = +v; });
      bindSlider('ctrl-wave-amp', 'val-wave-amp', ' px', v => { waves.amplitude = +v; });

    } else if (activeSim === 'optics') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🔍 Optics Mode</div>
          <div style="display:flex;gap:4px;">
            <button class="phys-pill-btn ${optics.subMode === 'refraction' ? 'active' : ''}" onclick="PhysicsLab.setOpticsMode('refraction')">Snell's Law (Refraction)</button>
            <button class="phys-pill-btn ${optics.subMode === 'lens' ? 'active' : ''}" onclick="PhysicsLab.setOpticsMode('lens')">Thin Lens Ray Tracer</button>
          </div>
        </div>

        ${optics.subMode === 'refraction' ? `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🌈 Media & Refractive Indices</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Incident Angle (θ₁)</span><span class="val" id="val-opt-ang">${optics.incidentAngle}°</span></div>
            <input type="range" class="phys-slider" id="ctrl-opt-ang" min="0" max="85" step="1" value="${optics.incidentAngle}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Medium 1 Index (n₁)</span><span class="val" id="val-opt-n1">${optics.n1}</span></div>
            <input type="range" class="phys-slider" id="ctrl-opt-n1" min="1.0" max="2.5" step="0.05" value="${optics.n1}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Medium 2 Index (n₂)</span><span class="val" id="val-opt-n2">${optics.n2}</span></div>
            <input type="range" class="phys-slider" id="ctrl-opt-n2" min="1.0" max="2.5" step="0.05" value="${optics.n2}">
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px;">
            <button class="phys-pill-btn" onclick="PhysicsLab.setOpticsPreset('air-glass')">Air → Glass</button>
            <button class="phys-pill-btn" onclick="PhysicsLab.setOpticsPreset('water-air')">Water → Air</button>
            <button class="phys-pill-btn" onclick="PhysicsLab.setOpticsPreset('glass-air')">Glass → Air</button>
          </div>
        </div>
        ` : `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">👓 Lens Parameters</div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            <button class="phys-pill-btn ${optics.lensType === 'convex' ? 'active' : ''}" onclick="PhysicsLab.setLensType('convex')">Convex (Converging)</button>
            <button class="phys-pill-btn ${optics.lensType === 'concave' ? 'active' : ''}" onclick="PhysicsLab.setLensType('concave')">Concave (Diverging)</button>
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Focal Length (f)</span><span class="val" id="val-opt-f">${optics.lensFocal} px</span></div>
            <input type="range" class="phys-slider" id="ctrl-opt-f" min="60" max="220" step="5" value="${optics.lensFocal}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Object Distance (dₒ)</span><span class="val" id="val-opt-do">${optics.objDist} px</span></div>
            <input type="range" class="phys-slider" id="ctrl-opt-do" min="70" max="380" step="5" value="${optics.objDist}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Object Height (hₒ)</span><span class="val" id="val-opt-ho">${optics.objHeight} px</span></div>
            <input type="range" class="phys-slider" id="ctrl-opt-ho" min="20" max="110" step="5" value="${optics.objHeight}">
          </div>
        </div>
        `}
      `;
      if (optics.subMode === 'refraction') {
        bindSlider('ctrl-opt-ang', 'val-opt-ang', '°', v => { optics.incidentAngle = +v; });
        bindSlider('ctrl-opt-n1', 'val-opt-n1', '', v => { optics.n1 = +v; });
        bindSlider('ctrl-opt-n2', 'val-opt-n2', '', v => { optics.n2 = +v; });
      } else {
        bindSlider('ctrl-opt-f', 'val-opt-f', ' px', v => { optics.lensFocal = +v; });
        bindSlider('ctrl-opt-do', 'val-opt-do', ' px', v => { optics.objDist = +v; });
        bindSlider('ctrl-opt-ho', 'val-opt-ho', ' px', v => { optics.objHeight = +v; });
      }

    } else if (activeSim === 'circuits') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">⚡ Circuit Setup</div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            <button class="phys-pill-btn ${!circuits.lorentz ? 'active' : ''}" onclick="PhysicsLab.setCircuitMode(false)">DC Resistor Circuit</button>
            <button class="phys-pill-btn ${circuits.lorentz ? 'active' : ''}" onclick="PhysicsLab.setCircuitMode(true)">Lorentz Force B-Field</button>
          </div>
          ${!circuits.lorentz ? `
          <div style="display:flex;gap:4px;">
            <button class="phys-pill-btn ${circuits.circuitType === 'series' ? 'active' : ''}" onclick="PhysicsLab.setCircuitType('series')">Series Circuit</button>
            <button class="phys-pill-btn ${circuits.circuitType === 'parallel' ? 'active' : ''}" onclick="PhysicsLab.setCircuitType('parallel')">Parallel Circuit</button>
          </div>
          ` : ''}
        </div>

        ${!circuits.lorentz ? `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🔋 Electrical Parameters</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>EMF / Voltage (V)</span><span class="val" id="val-cir-v">${circuits.voltage} V</span></div>
            <input type="range" class="phys-slider" id="ctrl-cir-v" min="1.5" max="24" step="0.5" value="${circuits.voltage}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Resistor 1 (R₁)</span><span class="val" id="val-cir-r1">${circuits.r1} Ω</span></div>
            <input type="range" class="phys-slider" id="ctrl-cir-r1" min="1" max="25" step="1" value="${circuits.r1}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Resistor 2 (R₂)</span><span class="val" id="val-cir-r2">${circuits.r2} Ω</span></div>
            <input type="range" class="phys-slider" id="ctrl-cir-r2" min="1" max="25" step="1" value="${circuits.r2}">
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#e2e8f0;margin-top:6px;cursor:pointer;">
            <input type="checkbox" id="ctrl-cir-sw" ${circuits.switchClosed ? 'checked' : ''}> Switch Closed (Current On)
          </label>
        </div>
        ` : `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🧲 Magnetic Field & Charge</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Magnetic Field (B)</span><span class="val" id="val-lor-b">${circuits.magFieldB} T</span></div>
            <input type="range" class="phys-slider" id="ctrl-lor-b" min="-50" max="50" step="5" value="${circuits.magFieldB}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Particle Velocity (v)</span><span class="val" id="val-lor-v">${circuits.partV} m/s</span></div>
            <input type="range" class="phys-slider" id="ctrl-lor-v" min="50" max="400" step="25" value="${circuits.partV}">
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button class="phys-pill-btn ${circuits.charge > 0 ? 'active' : ''}" onclick="PhysicsLab.setCharge(1)">Proton (+q)</button>
            <button class="phys-pill-btn ${circuits.charge < 0 ? 'active' : ''}" onclick="PhysicsLab.setCharge(-1)">Electron (-q)</button>
          </div>
        </div>
        `}
      `;
      if (!circuits.lorentz) {
        bindSlider('ctrl-cir-v', 'val-cir-v', ' V', v => { circuits.voltage = +v; });
        bindSlider('ctrl-cir-r1', 'val-cir-r1', ' Ω', v => { circuits.r1 = +v; });
        bindSlider('ctrl-cir-r2', 'val-cir-r2', ' Ω', v => { circuits.r2 = +v; });
        const sw = document.getElementById('ctrl-cir-sw');
        if (sw) sw.addEventListener('change', e => { circuits.switchClosed = e.target.checked; });
      } else {
        bindSlider('ctrl-lor-b', 'val-lor-b', ' T', v => { circuits.magFieldB = +v; resetSimulation(); });
        bindSlider('ctrl-lor-v', 'val-lor-v', ' m/s', v => { circuits.partV = +v; resetSimulation(); });
      }

    } else if (activeSim === 'thermodynamics') {
      sb.innerHTML = `
        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🔥 State Variables (Ideal Gas)</div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Temperature (T)</span><span class="val" id="val-thm-t">${thermo.temp} K</span></div>
            <input type="range" class="phys-slider" id="ctrl-thm-t" min="100" max="750" step="10" value="${thermo.temp}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Chamber Volume (V)</span><span class="val" id="val-thm-v">${thermo.volume}%</span></div>
            <input type="range" class="phys-slider" id="ctrl-thm-v" min="40" max="95" step="1" value="${thermo.volume}">
          </div>
          <div class="phys-slider-row">
            <div class="phys-slider-head"><span>Molecule Count (N)</span><span class="val" id="val-thm-n">${thermo.nParticles}</span></div>
            <input type="range" class="phys-slider" id="ctrl-thm-n" min="20" max="120" step="5" value="${thermo.nParticles}">
          </div>
        </div>

        <div class="phys-ctrl-group">
          <div class="phys-ctrl-title">🌡 Gas Laws Demonstrated</div>
          <div style="font-family:'Cascadia Code',monospace;font-size:11px;color:#94a3b8;line-height:1.6;">
            • Ideal Gas Law: PV = NkT<br>
            • Boyle's Law: P ∝ 1/V (at constant T)<br>
            • Charles's Law: V ∝ T (at constant P)<br>
            • Average Kinetic Energy: KE_avg = (3/2)kT<br>
            • RMS Speed: v_rms = √(3kT/m)
          </div>
        </div>
      `;
      bindSlider('ctrl-thm-t', 'val-thm-t', ' K', v => { thermo.temp = +v; updateGasParticleSpeeds(); });
      bindSlider('ctrl-thm-v', 'val-thm-v', '%', v => { thermo.volume = +v; });
      bindSlider('ctrl-thm-n', 'val-thm-n', '', v => { thermo.nParticles = +v; initGasParticles(); });
    }
  }

  function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    slider.style.background = `linear-gradient(to right, #38bdf8 0%, #818cf8 ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%, rgba(255, 255, 255, 0.12) 100%)`;
  }

  function bindSlider(sliderId, valId, unit, cb) {
    const slider = document.getElementById(sliderId);
    const val = document.getElementById(valId);
    if (!slider || !val) return;
    updateSliderFill(slider);
    slider.addEventListener('input', e => {
      val.textContent = e.target.value + unit;
      updateSliderFill(slider);
      cb(e.target.value);
    });
  }

  // Helper presets
  function setProjPreset(name) {
    if (name === 'earth') projectile.gravity = 9.8;
    if (name === 'moon') projectile.gravity = 1.62;
    if (name === 'mars') projectile.gravity = 3.72;
    if (name === 'jupiter') projectile.gravity = 24.79;
    const gSlider = document.getElementById('ctrl-proj-g');
    const gVal = document.getElementById('val-proj-g');
    if (gSlider) {
      gSlider.value = projectile.gravity;
      updateSliderFill(gSlider);
    }
    if (gVal) gVal.textContent = projectile.gravity + ' m/s²';

    ['earth', 'moon', 'mars', 'jupiter'].forEach(p => {
      const btn = document.getElementById(`btn-planet-${p}`);
      if (btn) btn.classList.toggle('active', p === name);
    });

    resetSimulation();
  }

  function setColType(e) {
    collision.e = e;
    buildControls();
    resetSimulation();
  }

  function setWaveMode(m) {
    waves.mode = m;
    buildControls();
    resetSimulation();
  }

  function setOpticsMode(m) {
    optics.subMode = m;
    buildControls();
    resetSimulation();
  }

  function setOpticsPreset(p) {
    if (p === 'air-glass') { optics.n1 = 1.0; optics.n2 = 1.5; }
    if (p === 'water-air') { optics.n1 = 1.33; optics.n2 = 1.0; }
    if (p === 'glass-air') { optics.n1 = 1.5; optics.n2 = 1.0; }
    buildControls();
  }

  function setLensType(t) {
    optics.lensType = t;
    buildControls();
  }

  function setCircuitMode(isLorentz) {
    circuits.lorentz = isLorentz;
    buildControls();
    resetSimulation();
  }

  function setCircuitType(t) {
    circuits.circuitType = t;
    buildControls();
  }

  function setCharge(q) {
    circuits.charge = q;
    buildControls();
    resetSimulation();
  }

  // ─────────────────────────────────────────────────────────────
  // SIMULATION UPDATE LOOP
  // ─────────────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!visible) return;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05) * simSpeed;
    lastTime = timestamp;

    if (isPlaying && dt > 0) {
      updateSimulation(dt);
    }
    renderSimulation();
    animId = requestAnimationFrame(loop);
  }

  function updateSimulation(dt) {
    simTime += dt;
    if (activeSim === 'projectile') {
      if (!projectile.landed) {
        projectile.t += dt;
        const g = projectile.gravity;
        if (!projectile.airDrag) {
          const rad = (projectile.angle * Math.PI) / 180;
          const v0x = projectile.v0 * Math.cos(rad);
          const v0y = projectile.v0 * Math.sin(rad);
          projectile.x = v0x * projectile.t;
          projectile.y = projectile.h0 + v0y * projectile.t - 0.5 * g * projectile.t * projectile.t;
          projectile.vx = v0x;
          projectile.vy = v0y - g * projectile.t;
        } else {
          // Numerical integration with drag
          const k = projectile.dragCoeff;
          const v = Math.hypot(projectile.vx, projectile.vy);
          const ax = -k * v * projectile.vx;
          const ay = -g - k * v * projectile.vy;
          projectile.vx += ax * dt;
          projectile.vy += ay * dt;
          projectile.x += projectile.vx * dt;
          projectile.y += projectile.vy * dt;
        }
        projectile.trail.push({ x: projectile.x, y: projectile.y });
        if (projectile.trail.length > 500) projectile.trail.shift();

        if (projectile.y <= 0 && projectile.t > 0.05) {
          projectile.y = 0;
          projectile.landed = true;
        }
      }
    } else if (activeSim === 'pendulum') {
      const g = pendulum.gravity;
      const L = pendulum.length;
      const b = pendulum.damping;
      const m = pendulum.mass;
      const alpha = -(g / L) * Math.sin(pendulum.theta) - (b / m) * pendulum.omega;
      pendulum.omega += alpha * dt;
      pendulum.theta += pendulum.omega * dt;
      pendulum.alpha = alpha;

      const bobX = Math.sin(pendulum.theta) * (pendulum.length * pendulum.scale);
      const bobY = Math.cos(pendulum.theta) * (pendulum.length * pendulum.scale);
      pendulum.trail.push({ x: bobX, y: bobY });
      if (pendulum.trail.length > 120) pendulum.trail.shift();

    } else if (activeSim === 'collision') {
      collision.x1 += collision.v1 * 50 * dt;
      collision.x2 += collision.v2 * 50 * dt;

      // Detect collision between the two carts (width 60 each)
      if (collision.x1 + 60 >= collision.x2 && !collision.collided) {
        collision.collided = true;
        collision.flashTimer = 0.2;
        const m1 = collision.m1, m2 = collision.m2;
        const u1 = collision.v1, u2 = collision.v2;
        const e = collision.e;
        const v1_new = ((m1 - e * m2) * u1 + (1 + e) * m2 * u2) / (m1 + m2);
        const v2_new = ((m2 - e * m1) * u2 + (1 + e) * m1 * u1) / (m1 + m2);
        collision.v1 = v1_new;
        collision.v2 = v2_new;
      }
      if (collision.flashTimer > 0) collision.flashTimer -= dt;

      // Bounce off boundaries
      if (collision.x1 < 40 && collision.v1 < 0) collision.v1 *= -1;
      if (collision.x2 > 700 && collision.v2 > 0) collision.v2 *= -1;

    } else if (activeSim === 'incline') {
      const g = incline.gravity;
      const rad = (incline.angle * Math.PI) / 180;
      const sinA = Math.sin(rad);
      const cosA = Math.cos(rad);
      const fParallel = sinA;
      const fStaticMax = incline.muS * cosA;

      if (fParallel > fStaticMax || incline.dist > 0.01) {
        const a = g * (sinA - incline.muK * cosA);
        if (a > 0 || incline.v > 0) {
          incline.v += a * dt;
          incline.dist += incline.v * dt;
        } else {
          incline.v = 0;
        }
      }

    } else if (activeSim === 'waves') {
      waves.phase += 2 * Math.PI * waves.frequency * dt;

    } else if (activeSim === 'circuits') {
      if (!circuits.lorentz) {
        if (circuits.switchClosed) {
          const req = circuits.circuitType === 'series'
            ? (circuits.r1 + circuits.r2)
            : ((circuits.r1 * circuits.r2) / (circuits.r1 + circuits.r2));
          const current = circuits.voltage / req;
          const speed = current * 40;
          circuits.particles.forEach(p => {
            p.pos = (p.pos + speed * dt) % p.totalLen;
          });
        }
      } else {
        const B = circuits.magFieldB * 0.1;
        const q = circuits.charge;
        const ax = q * circuits.partVy * B;
        const ay = -q * circuits.partVx * B;
        circuits.partVx += ax * dt;
        circuits.partVy += ay * dt;
        circuits.partX += circuits.partVx * dt;
        circuits.partY += circuits.partVy * dt;
        circuits.partTrail.push({ x: circuits.partX, y: circuits.partY });
        if (circuits.partTrail.length > 250) circuits.partTrail.shift();
      }

    } else if (activeSim === 'thermodynamics') {
      const w = (canvas ? canvas.width * 0.75 : 600) * (thermo.volume / 100);
      const h = canvas ? canvas.height * 0.65 : 380;
      const left = 60, top = 80;
      let impulses = 0;

      thermo.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x - p.r < left) {
          p.x = left + p.r;
          p.vx *= -1;
          impulses += Math.abs(p.vx);
        } else if (p.x + p.r > left + w) {
          p.x = left + w - p.r;
          p.vx *= -1;
          impulses += Math.abs(p.vx);
        }

        if (p.y - p.r < top) {
          p.y = top + p.r;
          p.vy *= -1;
          impulses += Math.abs(p.vy);
        } else if (p.y + p.r > top + h) {
          p.y = top + h - p.r;
          p.vy *= -1;
          impulses += Math.abs(p.vy);
        }
      });

      const rawP = (impulses * thermo.temp) / (w * h * 0.05);
      thermo.pressure = thermo.pressure * 0.95 + rawP * 0.05;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER DISPATCHER
  // ─────────────────────────────────────────────────────────────
  function renderSimulation() {
    if (!ctx || !canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    drawGrid(W, H);

    if (activeSim === 'projectile') renderProjectile(W, H);
    else if (activeSim === 'pendulum') renderPendulum(W, H);
    else if (activeSim === 'collision') renderCollision(W, H);
    else if (activeSim === 'incline') renderIncline(W, H);
    else if (activeSim === 'waves') renderWaves(W, H);
    else if (activeSim === 'optics') renderOptics(W, H);
    else if (activeSim === 'circuits') renderCircuits(W, H);
    else if (activeSim === 'thermodynamics') renderThermodynamics(W, H);
  }

  function drawGrid(W, H) {
    ctx.save();
    const step = 35;
    for (let x = 0; x < W; x += step) {
      const isMajor = Math.round(x / step) % 4 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = isMajor ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      const isMajor = Math.round(y / step) % 4 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = isMajor ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // 1. RENDER PROJECTILE (High-End Interactive Lab Viewport)
  // ─────────────────────────────────────────────────────────────
  function renderProjectile(W, H) {
    const originX = 85;
    const groundY = H - 85;
    const sc = projectile.scale;

    ctx.save();

    // ── 1. GROUND & DISTANCE RULER ──
    // Subtle ground gradient plate
    const gGrad = ctx.createLinearGradient(0, groundY, 0, H);
    gGrad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    gGrad.addColorStop(1, 'rgba(5, 11, 24, 0.98)');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Glowing ground baseline
    const lineGrad = ctx.createLinearGradient(30, groundY, W - 30, groundY);
    lineGrad.addColorStop(0, '#38bdf8');
    lineGrad.addColorStop(0.5, '#818cf8');
    lineGrad.addColorStop(1, '#38bdf8');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(20, groundY);
    ctx.lineTo(W - 20, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ground hatch marks
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let gx = 25; gx < W - 25; gx += 18) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY + 1);
      ctx.lineTo(gx - 10, groundY + 13);
      ctx.stroke();
    }

    // Distance ruler ticks & meter labels along ground
    ctx.font = '10px "Cascadia Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxDistM = Math.ceil((W - originX) / sc);
    for (let m = 0; m <= maxDistM; m += 10) {
      const rx = originX + m * sc;
      if (rx > W - 20) break;
      const isMajor = (m % 20 === 0);
      ctx.strokeStyle = isMajor ? '#38bdf8' : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(rx, groundY);
      ctx.lineTo(rx, groundY + (isMajor ? 8 : 4));
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${m}m`, rx, groundY + 11);
      }
    }

    // ── 2. LAUNCH PLATFORM (ELEVATION h₀) ──
    const platH = projectile.h0 * sc;
    if (projectile.h0 > 0) {
      const platW = 38;
      const px = originX - platW;
      const py = groundY - platH;

      // Platform body gradient
      const pGrad = ctx.createLinearGradient(px, py, px + platW, py);
      pGrad.addColorStop(0, 'rgba(30, 41, 59, 0.9)');
      pGrad.addColorStop(1, 'rgba(51, 65, 85, 0.9)');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px, py, platW, platH);

      // Scaffolding cross-trusses
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      const segH = 20;
      for (let sy = py; sy < groundY - 5; sy += segH) {
        const nextY = Math.min(sy + segH, groundY);
        ctx.beginPath();
        ctx.moveTo(px, sy); ctx.lineTo(px + platW, nextY);
        ctx.moveTo(px + platW, sy); ctx.lineTo(px, nextY);
        ctx.stroke();
      }

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, platW, platH);

      // Platform height dimension badge
      drawDimArrow(px - 14, groundY, px - 14, py, `h₀ = ${projectile.h0}m`, '#38bdf8');
    }

    // ── 3. CANNON LAUNCHER & ANGLE DIAL ──
    const rad = (projectile.angle * Math.PI) / 180;
    const cannonLen = 42;
    const cx = originX;
    const cy = groundY - platH;

    // Angle protractor arc guide
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, -rad, true);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angle indicator label near arc
    const midAngle = -rad / 2;
    const lblR = 44;
    const lx = cx + Math.cos(midAngle) * lblR;
    const ly = cy + Math.sin(midAngle) * lblR;
    ctx.font = 'bold 11px "Cascadia Code", monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${projectile.angle}°`, lx, ly);
    ctx.restore();

    // Metallic barrel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rad);

    // Barrel gradient
    const barrelGrad = ctx.createLinearGradient(0, -7, 0, 7);
    barrelGrad.addColorStop(0, '#64748b');
    barrelGrad.addColorStop(0.4, '#cbd5e1');
    barrelGrad.addColorStop(0.7, '#475569');
    barrelGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = barrelGrad;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(0, -7, cannonLen, 14);
    ctx.strokeRect(0, -7, cannonLen, 14);

    // Muzzle ring with neon glow
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.fillRect(cannonLen - 4, -8, 5, 16);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Pivot turret base
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // ── 4. THEORETICAL TRAJECTORY (Translucent Cyan Ribbon) ──
    const rad0 = (projectile.angle * Math.PI) / 180;
    const vx0 = projectile.v0 * Math.cos(rad0);
    const vy0 = projectile.v0 * Math.sin(rad0);
    const g = projectile.gravity;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    for (let simT = 0; simT <= projectile.flightT; simT += 0.05) {
      const tx = originX + (vx0 * simT) * sc;
      const ty = (groundY - platH) - ((vy0 * simT - 0.5 * g * simT * simT) * sc);
      if (simT === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.restore();

    // ── 5. ACTIVE SIMULATION TRAIL (Glowing Neon Ribbon) ──
    if (projectile.trail.length > 1) {
      ctx.save();
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      projectile.trail.forEach((p, idx) => {
        const sx = originX + p.x * sc;
        const sy = (groundY - platH) - (p.y - projectile.h0) * sc;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      // Bright inner core
      ctx.strokeStyle = '#f0f9ff';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
    }

    // ── 6. PROJECTILE ORB (Plasma Energy Core) ──
    const currX = originX + projectile.x * sc;
    const currY = (groundY - platH) - (projectile.y - projectile.h0) * sc;

    ctx.save();
    // Outer glow
    const orbGrad = ctx.createRadialGradient(currX, currY, 2, currX, currY, 16);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.25, '#7dd3fc');
    orbGrad.addColorStop(0.65, '#0284c7');
    orbGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(currX, currY, 16, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(currX, currY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── 7. VELOCITY VECTORS (Real-time Decomposition) ──
    if (!projectile.landed) {
      const vScale = 1.8;
      drawVector(currX, currY, projectile.vx * vScale, -projectile.vy * vScale, '#facc15', 'v');
      drawVector(currX, currY, projectile.vx * vScale, 0, '#38bdf8', 'vₓ');
      drawVector(currX, currY, 0, -projectile.vy * vScale, '#c084fc', 'vᵧ');
    }

    // ── 8. APEX CALLOUT (Neon Crimson Dropline & Badge) ──
    const apexX = originX + (vx0 * (vy0 / g)) * sc;
    const apexY = groundY - projectile.maxH * sc;

    // Vertical dropline to ground
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX, groundY);
    ctx.stroke();
    ctx.restore();

    // Apex Dot with glow
    ctx.save();
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(apexX, apexY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Apex Badge Card
    const apexTxt = `▲ Apex: ${projectile.maxH.toFixed(1)}m`;
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    const apexW = ctx.measureText(apexTxt).width + 16;
    const badgeX = Math.max(10, Math.min(W - apexW - 10, apexX - apexW / 2));
    const badgeY = apexY - 26;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, apexW, 20, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fda4af';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(apexTxt, badgeX + apexW / 2, badgeY + 10);
    ctx.restore();

    // ── 9. RANGE LANDING TARGET (Radar Pulsing Rings) ──
    const rangeX = originX + projectile.range * sc;
    ctx.save();
    // Concentric ground radar target rings
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(rangeX, groundY, 14, 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
    ctx.beginPath();
    ctx.ellipse(rangeX, groundY, 24, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(rangeX, groundY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Range Badge Card
    const rangeTxt = `🎯 Range: ${projectile.range.toFixed(1)}m`;
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    const rangeW = ctx.measureText(rangeTxt).width + 16;
    const rBadgeX = Math.max(10, Math.min(W - rangeW - 10, rangeX - rangeW / 2));
    const rBadgeY = groundY + 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rBadgeX, rBadgeY, rangeW, 20, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rangeTxt, rBadgeX + rangeW / 2, rBadgeY + 10);
    ctx.restore();

    // ── 10. ON-CANVAS FLOATING KINEMATICS & ENERGY HUD ──
    const hudW = 205;
    const hudH = 135;
    const hudX = W - hudW - 18;
    const hudY = 16;

    ctx.save();
    // Glassmorphism card
    ctx.fillStyle = 'rgba(11, 20, 38, 0.82)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // HUD Header
    ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚡ LIVE ENERGY & TELEMETRY', hudX + 12, hudY + 10);

    // Dynamic Kinetic & Potential Energy Calculation
    const mass = 1.0; // kg
    const curSpeed = Math.hypot(projectile.vx, projectile.vy);
    const ke = 0.5 * mass * curSpeed * curSpeed;
    const pe = mass * projectile.gravity * Math.max(0, projectile.y);
    const totalE = Math.max(ke + pe, 1);

    // Mini Energy Bars
    const barW = 100;
    const barH = 7;
    const barLeft = hudX + 88;

    // KE Bar
    ctx.font = '10px "Cascadia Code", monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('Kinetic', hudX + 12, hudY + 30);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(barLeft, hudY + 31, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(barLeft, hudY + 31, Math.max(2, (ke / totalE) * barW), barH, 3);
    ctx.fill();

    // PE Bar
    ctx.fillStyle = '#86efac';
    ctx.fillText('Potential', hudX + 12, hudY + 48);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(barLeft, hudY + 49, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.roundRect(barLeft, hudY + 49, Math.max(2, (pe / totalE) * barW), barH, 3);
    ctx.fill();

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(hudX + 10, hudY + 67);
    ctx.lineTo(hudX + hudW - 10, hudY + 67);
    ctx.stroke();

    // Speed and Altitude Readouts
    ctx.font = '9.5px "Cascadia Code", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`Velocity: ${curSpeed.toFixed(1)} m/s`, hudX + 12, hudY + 74);
    ctx.fillText(`Altitude: ${projectile.y.toFixed(1)} m`, hudX + 12, hudY + 90);
    ctx.fillText(`Elapsed : ${projectile.t.toFixed(2)} s`, hudX + 12, hudY + 106);
    ctx.fillText(`Distance: ${projectile.x.toFixed(1)} m`, hudX + 108, hudY + 90);
    ctx.fillText(`Angle θ : ${projectile.angle}°`, hudX + 108, hudY + 106);
    ctx.restore();

    ctx.restore();

    // ── 11. CYBERNETIC DOCK TELEMETRY CHIPS ──
    const speedVal = Math.hypot(projectile.vx, projectile.vy).toFixed(1);
    updateTelemetry(`
      <div class="phys-tele-chip">
        <span class="chip-k">⏱ Time:</span>
        <span class="chip-v" style="color:#fbbf24;">${projectile.t.toFixed(2)}s</span>
      </div>
      <div class="phys-tele-chip">
        <span class="chip-k">📍 Pos:</span>
        <span class="chip-v" style="color:#38bdf8;">x=${projectile.x.toFixed(1)}m, y=${projectile.y.toFixed(1)}m</span>
      </div>
      <div class="phys-tele-chip">
        <span class="chip-k">⚡ Velocity:</span>
        <span class="chip-v" style="color:#4ade80;">${speedVal} m/s</span>
        <span style="color:#64748b;font-size:10px;">(vₓ=${projectile.vx.toFixed(1)}, vᵧ=${projectile.vy.toFixed(1)})</span>
      </div>
      <div class="phys-tele-chip">
        <span class="chip-k">▲ Apex H:</span>
        <span class="chip-v" style="color:#f43f5e;">${projectile.maxH.toFixed(2)}m</span>
      </div>
      <div class="phys-tele-chip">
        <span class="chip-k">🎯 Range R:</span>
        <span class="chip-v" style="color:#c084fc;">${projectile.range.toFixed(2)}m</span>
      </div>
      <div class="phys-tele-chip">
        <span class="chip-k">💨 Drag:</span>
        <span class="chip-v" style="color:${projectile.airDrag ? '#38bdf8' : '#64748b'};">${projectile.airDrag ? 'ON' : 'OFF'}</span>
      </div>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RENDER PENDULUM
  // ─────────────────────────────────────────────────────────────
  function renderPendulum(W, H) {
    const pivotX = W / 2 - 40;
    const pivotY = 90;
    const L_px = pendulum.length * pendulum.scale;
    const bobX = pivotX + Math.sin(pendulum.theta) * L_px;
    const bobY = pivotY + Math.cos(pendulum.theta) * L_px;

    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.fillRect(pivotX - 35, pivotY - 14, 70, 14);
    ctx.fillStyle = '#c9a84c';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + L_px + 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#e8c96b';
    ctx.lineWidth = 1.5;
    ctx.arc(pivotX, pivotY, 45, Math.PI / 2, Math.PI / 2 + pendulum.theta, pendulum.theta < 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11.5px monospace';
    ctx.fillStyle = '#e8c96b';
    ctx.fillText(`θ = ${(pendulum.theta * 180 / Math.PI).toFixed(1)}°`, pivotX + 15, pivotY + 60);

    if (pendulum.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      pendulum.trail.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(pivotX + p.x, pivotY + p.y);
        else ctx.lineTo(pivotX + p.x, pivotY + p.y);
      });
      ctx.stroke();
    }

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    const bobR = 14 + pendulum.mass * 4;
    const grad = ctx.createRadialGradient(bobX - 4, bobY - 4, 3, bobX, bobY, bobR);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.5, '#c9a84c');
    grad.addColorStop(1, '#78350f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const mg = pendulum.mass * pendulum.gravity;
    const v = pendulum.omega * pendulum.length;
    const T = mg * Math.cos(pendulum.theta) + (pendulum.mass * v * v) / pendulum.length;

    const vx = Math.cos(pendulum.theta) * v * 12;
    const vy = -Math.sin(pendulum.theta) * v * 12;
    drawVector(bobX, bobY, vx, vy, '#38bdf8', 'v');
    drawVector(bobX, bobY, 0, mg * 3.5, '#f43f5e', 'mg');

    const dirX = (pivotX - bobX) / L_px;
    const dirY = (pivotY - bobY) / L_px;
    drawVector(bobX, bobY, dirX * (T * 2.8), dirY * (T * 2.8), '#a78bfa', 'T');

    const h = pendulum.length * (1 - Math.cos(pendulum.theta));
    const pe = pendulum.mass * pendulum.gravity * h;
    const ke = 0.5 * pendulum.mass * v * v;
    const totE = pe + ke;
    renderEnergyBars(W - 190, 110, ke, pe, totE);
    ctx.restore();

    const periodApprox = 2 * Math.PI * Math.sqrt(pendulum.length / pendulum.gravity);
    updateTelemetry(`
      <span style="color:#e8c96b;">Angle θ: <b>${(pendulum.theta * 180 / Math.PI).toFixed(1)}°</b></span> |
      <span style="color:#38bdf8;">Angular Velocity ω: <b>${pendulum.omega.toFixed(2)} rad/s</b></span> |
      <span style="color:#4ade80;">Linear Speed: <b>${Math.abs(v).toFixed(2)} m/s</b></span> |
      <span style="color:#a78bfa;">Tension T: <b>${T.toFixed(1)} N</b></span> |
      <span style="color:#f43f5e;">Theoretical Period T: <b>${periodApprox.toFixed(2)}s</b></span>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. RENDER COLLISION
  // ─────────────────────────────────────────────────────────────
  function renderCollision(W, H) {
    const trackY = H / 2 + 50;
    const trackL = 40, trackR = W - 40;
    ctx.save();

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(trackL, trackY, trackR - trackL, 14);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(trackL, trackY, trackR - trackL, 14);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(trackL - 10, trackY - 30, 10, 44);
    ctx.fillRect(trackR, trackY - 30, 10, 44);

    if (collision.flashTimer > 0) {
      ctx.fillStyle = `rgba(254, 240, 138, ${collision.flashTimer * 3})`;
      ctx.beginPath();
      ctx.arc((collision.x1 + 60 + collision.x2) / 2, trackY - 20, 50, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cart 1
    const cartH = 40;
    const cartW1 = 50 + collision.m1 * 5;
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(collision.x1, trackY - cartH, cartW1, cartH);
    ctx.strokeRect(collision.x1, trackY - cartH, cartW1, cartH);
    drawWheel(collision.x1 + 12, trackY);
    drawWheel(collision.x1 + cartW1 - 12, trackY);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`m₁=${collision.m1}kg`, collision.x1 + 6, trackY - 18);
    drawVector(collision.x1 + cartW1 / 2, trackY - cartH - 12, collision.v1 * 18, 0, '#38bdf8', `v₁=${collision.v1.toFixed(1)}m/s`);

    // Cart 2
    const cartW2 = 50 + collision.m2 * 5;
    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#fb923c';
    ctx.fillRect(collision.x2, trackY - cartH, cartW2, cartH);
    ctx.strokeRect(collision.x2, trackY - cartH, cartW2, cartH);
    drawWheel(collision.x2 + 12, trackY);
    drawWheel(collision.x2 + cartW2 - 12, trackY);
    ctx.fillStyle = '#fff';
    ctx.fillText(`m₂=${collision.m2}kg`, collision.x2 + 6, trackY - 18);
    drawVector(collision.x2 + cartW2 / 2, trackY - cartH - 12, collision.v2 * 18, 0, '#fb923c', `v₂=${collision.v2.toFixed(1)}m/s`);

    const p1 = collision.m1 * collision.v1;
    const p2 = collision.m2 * collision.v2;
    const pTot = p1 + p2;
    const ke1 = 0.5 * collision.m1 * collision.v1 * collision.v1;
    const ke2 = 0.5 * collision.m2 * collision.v2 * collision.v2;
    const keTot = ke1 + ke2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(201,168,76,0.3)';
    ctx.fillRect(trackL, 80, 420, 90);
    ctx.strokeRect(trackL, 80, 420, 90);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#e8c96b';
    ctx.fillText(`⚖ MOMENTUM: P_tot = m₁v₁ + m₂v₂ = ${pTot.toFixed(2)} kg·m/s`, trackL + 14, 106);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`p₁ = ${p1.toFixed(2)} kg·m/s | p₂ = ${p2.toFixed(2)} kg·m/s`, trackL + 14, 126);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`⚡ KINETIC ENERGY: KE_tot = ${keTot.toFixed(2)} J`, trackL + 14, 150);
    ctx.restore();

    updateTelemetry(`
      <span style="color:#e8c96b;">Total Momentum P: <b>${pTot.toFixed(2)} kg·m/s</b> (Conserved)</span> |
      <span style="color:#38bdf8;">Cart 1: v₁=<b>${collision.v1.toFixed(2)} m/s</b></span> |
      <span style="color:#fb923c;">Cart 2: v₂=<b>${collision.v2.toFixed(2)} m/s</b></span> |
      <span style="color:#4ade80;">Total KE: <b>${keTot.toFixed(2)} J</b></span> |
      <span style="color:#f43f5e;">Restitution e: <b>${collision.e}</b></span>
    `);
  }

  function drawWheel(x, y) {
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ─────────────────────────────────────────────────────────────
  // 4. RENDER INCLINED PLANE & FBD
  // ─────────────────────────────────────────────────────────────
  function renderIncline(W, H) {
    const startX = 100;
    const startY = H - 100;
    const rampLen = 520;
    const rad = (incline.angle * Math.PI) / 180;
    const endX = startX + Math.cos(rad) * rampLen;
    const endY = startY - Math.sin(rad) * rampLen;

    ctx.save();
    ctx.fillStyle = 'rgba(201, 168, 76, 0.08)';
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, startY);
    ctx.lineTo(endX, endY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#e8c96b';
    ctx.lineWidth = 1.5;
    ctx.arc(startX, startY, 50, 0, -rad, true);
    ctx.stroke();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#e8c96b';
    ctx.fillText(`θ = ${incline.angle}°`, startX + 60, startY - 14);

    const maxDistPx = rampLen - 120;
    const curDistPx = Math.min((incline.dist * 35) % maxDistPx, maxDistPx);
    const blockPosRamp = endX - Math.cos(rad) * curDistPx;
    const blockPosY = endY + Math.sin(rad) * curDistPx;
    const bw = 65, bh = 45;

    ctx.save();
    ctx.translate(blockPosRamp, blockPosY);
    ctx.rotate(-rad);
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(-bw / 2, -bh, bw, bh);
    ctx.strokeRect(-bw / 2, -bh, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${incline.mass}kg`, -14, -bh / 2 + 4);

    const cmX = 0, cmY = -bh / 2;
    const g = incline.gravity;
    const N = incline.mass * g * Math.cos(rad);
    drawVector(cmX, cmY, 0, -N * 2.5, '#4ade80', 'N');

    const fK = incline.muK * N;
    drawVector(cmX, cmY, fK * 2.5, 0, '#f43f5e', 'fₖ');

    const fPar = incline.mass * g * Math.sin(rad);
    drawVector(cmX, cmY, -fPar * 2.5, 0, '#38bdf8', 'mg sinθ');
    ctx.restore();

    const cmGlobalX = blockPosRamp - Math.sin(rad) * (bh / 2);
    const cmGlobalY = blockPosY - Math.cos(rad) * (bh / 2);
    drawVector(cmGlobalX, cmGlobalY, 0, incline.mass * g * 2.5, '#fb923c', 'W = mg');
    ctx.restore();

    const a = g * (Math.sin(rad) - incline.muK * Math.cos(rad));
    updateTelemetry(`
      <span style="color:#e8c96b;">Incline Angle: <b>${incline.angle}°</b></span> |
      <span style="color:#4ade80;">Normal Force N: <b>${N.toFixed(1)} N</b></span> |
      <span style="color:#f43f5e;">Friction f_k: <b>${fK.toFixed(1)} N</b></span> |
      <span style="color:#38bdf8;">Parallel Downhill: <b>${fPar.toFixed(1)} N</b></span> |
      <span style="color:#fb923c;">Net Acceleration a: <b>${Math.max(0, a).toFixed(2)} m/s²</b></span>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. RENDER WAVES
  // ─────────────────────────────────────────────────────────────
  function renderWaves(W, H) {
    const centerY = H / 2;
    const startX = 90, endX = W - 90;
    const len = endX - startX;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(startX, centerY);
    ctx.lineTo(endX, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (waves.mode === 'standing') {
      const n = waves.harmonic;
      const k = (n * Math.PI) / len;

      ctx.strokeStyle = 'rgba(201,168,76,0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 4) {
        const envY = 2 * waves.amplitude * Math.sin(k * x);
        if (x === 0) ctx.moveTo(startX + x, centerY - envY);
        else ctx.lineTo(startX + x, centerY - envY);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let x = 0; x <= len; x += 4) {
        const envY = 2 * waves.amplitude * Math.sin(k * x);
        if (x === 0) ctx.moveTo(startX + x, centerY + envY);
        else ctx.lineTo(startX + x, centerY + envY);
      }
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 3) {
        const y = 2 * waves.amplitude * Math.sin(k * x) * Math.cos(waves.phase);
        if (x === 0) ctx.moveTo(startX + x, centerY - y);
        else ctx.lineTo(startX + x, centerY - y);
      }
      ctx.stroke();

      for (let m = 0; m <= n; m++) {
        const nodeX = startX + (m * len) / n;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(nodeX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`Node ${m}`, nodeX - 18, centerY + 24);

        if (m < n) {
          const antinodeX = startX + ((m + 0.5) * len) / n;
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(antinodeX, centerY - 2 * waves.amplitude * Math.cos(waves.phase), 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#86efac';
          ctx.fillText(`Antinode`, antinodeX - 22, centerY - waves.amplitude * 2 - 14);
        }
      }
    } else {
      const lambda = 180;
      const k = (2 * Math.PI) / lambda;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 3) {
        const y = waves.amplitude * Math.sin(k * x - waves.phase);
        if (x === 0) ctx.moveTo(startX + x, centerY - y);
        else ctx.lineTo(startX + x, centerY - y);
      }
      ctx.stroke();
    }
    ctx.restore();

    updateTelemetry(`
      <span style="color:#e8c96b;">Harmonic Mode n: <b>${waves.harmonic}</b></span> |
      <span style="color:#38bdf8;">Frequency f: <b>${waves.frequency} Hz</b></span> |
      <span style="color:#4ade80;">Wavelength λ: <b>${(2 * len / waves.harmonic).toFixed(1)} px</b></span> |
      <span style="color:#f43f5e;">Nodes Count: <b>${waves.harmonic + 1}</b></span> |
      <span style="color:#a78bfa;">Antinodes Count: <b>${waves.harmonic}</b></span>
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. RENDER OPTICS & LENSES
  // ─────────────────────────────────────────────────────────────
  function renderOptics(W, H) {
    if (optics.subMode === 'refraction') {
      const midY = H / 2;
      const midX = W / 2;
      ctx.save();

      ctx.fillStyle = getMediumColor(optics.n1, 0.08);
      ctx.fillRect(40, 60, W - 80, midY - 60);

      ctx.fillStyle = getMediumColor(optics.n2, 0.22);
      ctx.fillRect(40, midY, W - 80, H - 120);

      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, midY); ctx.lineTo(W - 40, midY); ctx.stroke();

      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(midX, 60); ctx.lineTo(midX, H - 60); ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#e8c96b';
      ctx.fillText(`Medium 1 (n₁ = ${optics.n1.toFixed(2)})`, 60, 90);
      ctx.fillText(`Medium 2 (n₂ = ${optics.n2.toFixed(2)})`, 60, midY + 30);

      const theta1 = (optics.incidentAngle * Math.PI) / 180;
      const rayLen = 220;
      const inStartX = midX - Math.sin(theta1) * rayLen;
      const inStartY = midY - Math.cos(theta1) * rayLen;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(inStartX, inStartY);
      ctx.lineTo(midX, midY);
      ctx.stroke();
      drawArrowHead(inStartX, inStartY, midX, midY, '#ef4444');

      const refEndX = midX + Math.sin(theta1) * rayLen;
      const refEndY = midY - Math.cos(theta1) * rayLen;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(refEndX, refEndY);
      ctx.stroke();

      const sinTh2 = (optics.n1 / optics.n2) * Math.sin(theta1);
      const isTIR = sinTh2 > 1.0;
      if (!isTIR) {
        const theta2 = Math.asin(sinTh2);
        const refrEndX = midX + Math.sin(theta2) * rayLen;
        const refrEndY = midY + Math.cos(theta2) * rayLen;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(refrEndX, refrEndY);
        ctx.stroke();
        drawArrowHead(midX, midY, refrEndX, refrEndY, '#38bdf8');

        ctx.font = '12px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`θ₁ = ${optics.incidentAngle}°`, midX - 55, midY - 45);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`θ₂ = ${(theta2 * 180 / Math.PI).toFixed(1)}°`, midX + 15, midY + 50);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('⚠ TOTAL INTERNAL REFLECTION (TIR)', midX + 40, midY + 45);
      }
      ctx.restore();

      const critAngle = optics.n1 > optics.n2 ? (Math.asin(optics.n2 / optics.n1) * 180 / Math.PI).toFixed(1) + '°' : 'None (n1 <= n2)';
      updateTelemetry(`
        <span style="color:#ef4444;">Incident θ₁: <b>${optics.incidentAngle}°</b></span> |
        <span style="color:#38bdf8;">Refracted θ₂: <b>${isTIR ? 'TIR' : (Math.asin(sinTh2) * 180 / Math.PI).toFixed(1) + '°'}</b></span> |
        <span style="color:#e8c96b;">Critical Angle θ_c: <b>${critAngle}</b></span> |
        <span style="color:#4ade80;">Law: n₁ sin(θ₁) = n₂ sin(θ₂)</span>
      `);
    } else {
      const midY = H / 2;
      const lensX = W / 2;
      const f = optics.lensFocal * (optics.lensType === 'convex' ? 1 : -1);
      const do_ = optics.objDist;
      const ho = optics.objHeight;

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, midY); ctx.lineTo(W - 40, midY); ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lensX, midY - 140); ctx.lineTo(lensX, midY + 140); ctx.stroke();

      const absF = Math.abs(f);
      drawFocalPoint(lensX - absF, midY, 'F₁');
      drawFocalPoint(lensX + absF, midY, 'F₂');
      drawFocalPoint(lensX - 2 * absF, midY, '2F₁');
      drawFocalPoint(lensX + 2 * absF, midY, '2F₂');

      const objX = lensX - do_;
      const objTopY = midY - ho;
      drawOpticArrow(objX, midY, objTopY, '#4ade80', 'Object');

      let di = (f * do_) / (do_ - f);
      let hi = -(di / do_) * ho;
      const imgX = lensX + di;
      const imgTopY = midY - hi;

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(objX, objTopY);
      ctx.lineTo(lensX, objTopY);
      if (optics.lensType === 'convex') {
        ctx.lineTo(lensX + absF * 2, midY + ((midY - objTopY) / absF) * absF * 2 - (midY - objTopY));
      }
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(objX, objTopY);
      ctx.lineTo(lensX, midY);
      ctx.lineTo(lensX + 250, midY + ((midY - objTopY) / do_) * 250);
      ctx.stroke();

      if (Math.abs(di) < 900) {
        drawOpticArrow(imgX, midY, imgTopY, '#a855f7', di > 0 ? 'Real Image' : 'Virtual Image');
      }
      ctx.restore();

      const mag = Math.abs(hi / ho);
      updateTelemetry(`
        <span style="color:#4ade80;">Object: dₒ=<b>${do_}px</b>, hₒ=<b>${ho}px</b></span> |
        <span style="color:#a855f7;">Image: dᵢ=<b>${di.toFixed(1)}px</b>, hᵢ=<b>${hi.toFixed(1)}px</b></span> |
        <span style="color:#e8c96b;">Focal f: <b>${f}px</b></span> |
        <span style="color:#38bdf8;">Magnification M: <b>${mag.toFixed(2)}×</b> (${di > 0 ? 'Real & Inverted' : 'Virtual & Erect'})</span>
      `);
    }
  }

  function drawFocalPoint(x, y, label) {
    ctx.fillStyle = '#e8c96b';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '11px monospace';
    ctx.fillText(label, x - 6, y + 18);
  }

  function drawOpticArrow(x, base, tip, color, label) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, tip);
    ctx.stroke();

    const dir = tip < base ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, tip);
    ctx.lineTo(x - 6, tip - dir * 10);
    ctx.lineTo(x + 6, tip - dir * 10);
    ctx.closePath();
    ctx.fill();
    ctx.font = '11.5px sans-serif';
    ctx.fillText(label, x - 25, tip + (dir < 0 ? -12 : 20));
  }

  function getMediumColor(n, alpha) {
    if (n < 1.1) return `rgba(148, 163, 184, ${alpha})`;
    if (n < 1.4) return `rgba(56, 189, 248, ${alpha})`;
    if (n < 1.7) return `rgba(168, 85, 247, ${alpha})`;
    return `rgba(234, 179, 8, ${alpha})`;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. RENDER CIRCUITS
  // ─────────────────────────────────────────────────────────────
  function renderCircuits(W, H) {
    if (!circuits.lorentz) {
      const left = W / 2 - 220;
      const top = 110;
      const cw = 440, ch = 240;
      ctx.save();

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.strokeRect(left, top, cw, ch);

      const batY = top + ch / 2;
      ctx.fillStyle = '#09142b';
      ctx.fillRect(left - 10, batY - 25, 20, 50);

      ctx.strokeStyle = '#e8c96b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(left - 18, batY - 14); ctx.lineTo(left + 18, batY - 14);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(left - 10, batY + 14); ctx.lineTo(left + 10, batY + 14);
      ctx.stroke();
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#e8c96b';
      ctx.fillText(`${circuits.voltage}V (+)`, left - 55, batY - 10);

      const swX = left + cw / 2;
      ctx.fillStyle = '#09142b';
      ctx.fillRect(swX - 30, top + ch - 10, 60, 20);
      ctx.strokeStyle = circuits.switchClosed ? '#4ade80' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(swX - 20, top + ch);
      if (circuits.switchClosed) ctx.lineTo(swX + 20, top + ch);
      else ctx.lineTo(swX + 15, top + ch - 18);
      ctx.stroke();
      ctx.fillStyle = circuits.switchClosed ? '#4ade80' : '#ef4444';
      ctx.fillText(circuits.switchClosed ? 'Switch: CLOSED' : 'Switch: OPEN', swX - 45, top + ch + 30);

      if (circuits.circuitType === 'series') {
        drawResistorZigZag(left + cw * 0.3, top, circuits.r1, 'R₁');
        drawResistorZigZag(left + cw * 0.7, top, circuits.r2, 'R₂');
      } else {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(left + 120, top); ctx.lineTo(left + 120, top + 80);
        ctx.lineTo(left + 320, top + 80); ctx.lineTo(left + 320, top);
        ctx.stroke();
        drawResistorZigZag(left + 220, top, circuits.r1, 'R₁');
        drawResistorZigZag(left + 220, top + 80, circuits.r2, 'R₂');
      }

      if (circuits.switchClosed) {
        ctx.fillStyle = '#38bdf8';
        circuits.particles.forEach(p => {
          const pt = getPointAlongRect(p.pos, left, top, cw, ch);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();

      const rEq = circuits.circuitType === 'series'
        ? (circuits.r1 + circuits.r2)
        : ((circuits.r1 * circuits.r2) / (circuits.r1 + circuits.r2));
      const I = circuits.switchClosed ? circuits.voltage / rEq : 0;
      const P = I * I * rEq;
      updateTelemetry(`
        <span style="color:#e8c96b;">Battery EMF: <b>${circuits.voltage} V</b></span> |
        <span style="color:#38bdf8;">Current I = V/R: <b>${I.toFixed(2)} A</b></span> |
        <span style="color:#4ade80;">Equivalent R_eq: <b>${rEq.toFixed(2)} Ω</b> (${circuits.circuitType})</span> |
        <span style="color:#f43f5e;">Power Dissipated P: <b>${P.toFixed(2)} W</b></span>
      `);
    } else {
      ctx.save();
      const midX = W / 2, midY = H / 2;

      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.font = '14px sans-serif';
      for (let bx = 100; bx < W - 100; bx += 55) {
        for (let by = 90; by < H - 90; by += 55) {
          ctx.fillText(circuits.magFieldB >= 0 ? '✕' : '⊙', bx, by);
        }
      }

      if (circuits.partTrail.length > 1) {
        ctx.strokeStyle = circuits.charge > 0 ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        circuits.partTrail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }

      ctx.fillStyle = circuits.charge > 0 ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(circuits.partX, circuits.partY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawVector(circuits.partX, circuits.partY, circuits.partVx * 0.4, circuits.partVy * 0.4, '#facc15', 'v');

      const Fx = circuits.charge * circuits.partVy * (circuits.magFieldB * 0.05);
      const Fy = -circuits.charge * circuits.partVx * (circuits.magFieldB * 0.05);
      drawVector(circuits.partX, circuits.partY, Fx, Fy, '#4ade80', 'F_B');
      ctx.restore();

      const rCyclo = Math.abs((1 * circuits.partV) / (circuits.charge * circuits.magFieldB * 0.1));
      updateTelemetry(`
        <span style="color:#e8c96b;">Lorentz Law: F = q(v × B)</span> |
        <span style="color:${circuits.charge > 0 ? '#ef4444' : '#38bdf8'};">Charge q: <b>${circuits.charge > 0 ? '+1e (Proton)' : '-1e (Electron)'}</b></span> |
        <span style="color:#facc15;">Speed v: <b>${circuits.partV} m/s</b></span> |
        <span style="color:#4ade80;">B-Field: <b>${circuits.magFieldB} T</b></span> |
        <span style="color:#a78bfa;">Cyclotron Radius r = mv/qB: <b>${rCyclo.toFixed(1)} px</b></span>
      `);
    }
  }

  function drawResistorZigZag(cx, cy, rVal, label) {
    ctx.save();
    ctx.fillStyle = '#09142b';
    ctx.fillRect(cx - 30, cy - 14, 60, 28);
    ctx.strokeStyle = '#e8c96b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy);
    ctx.lineTo(cx - 15, cy - 8);
    ctx.lineTo(cx - 5, cy + 8);
    ctx.lineTo(cx + 5, cy - 8);
    ctx.lineTo(cx + 15, cy + 8);
    ctx.lineTo(cx + 25, cy);
    ctx.stroke();
    ctx.font = '11.5px monospace';
    ctx.fillStyle = '#e8c96b';
    ctx.fillText(`${label}=${rVal}Ω`, cx - 22, cy - 16);
    ctx.restore();
  }

  function initCircuitParticles() {
    circuits.particles = [];
    for (let i = 0; i < 30; i++) {
      circuits.particles.push({
        pos: i * 45,
        totalLen: (440 + 240) * 2
      });
    }
  }

  function getPointAlongRect(dist, x, y, w, h) {
    const p = (w + h) * 2;
    const d = dist % p;
    if (d < w) return { x: x + d, y };
    if (d < w + h) return { x: x + w, y: y + (d - w) };
    if (d < 2 * w + h) return { x: x + w - (d - (w + h)), y: y + h };
    return { x, y: y + h - (d - (2 * w + h)) };
  }

  // ─────────────────────────────────────────────────────────────
  // 8. RENDER THERMODYNAMICS
  // ─────────────────────────────────────────────────────────────
  function renderThermodynamics(W, H) {
    const left = 70, top = 80;
    const maxW = W * 0.68;
    const curW = maxW * (thermo.volume / 100);
    const boxH = H - 180;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(left, top, curW, boxH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(left + maxW, top);
    ctx.lineTo(left, top);
    ctx.lineTo(left, top + boxH);
    ctx.lineTo(left + maxW, top + boxH);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 3;
    ctx.fillRect(left + curW - 14, top, 14, boxH);
    ctx.strokeRect(left + curW - 14, top, 14, boxH);

    ctx.fillStyle = '#334155';
    ctx.fillRect(left + curW, top + boxH / 2 - 10, 60, 20);

    thermo.particles.forEach(p => {
      const speed = Math.hypot(p.vx, p.vy);
      const heatFactor = Math.min(speed / 160, 1);
      ctx.fillStyle = `rgb(${Math.floor(255 * heatFactor)}, ${Math.floor(180 * (1 - heatFactor * 0.5))}, ${Math.floor(255 * (1 - heatFactor))})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pressure Gauge
    const gaugeX = W - 140;
    const gaugeY = 160;
    const gaugeR = 55;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, gaugeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '9px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('PRESSURE', gaugeX - 25, gaugeY - 20);

    const maxP = 800;
    const pAngle = Math.PI * 0.75 + (Math.min(thermo.pressure, maxP) / maxP) * Math.PI * 1.5;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY);
    ctx.lineTo(gaugeX + Math.cos(pAngle) * (gaugeR - 12), gaugeY + Math.sin(pAngle) * (gaugeR - 12));
    ctx.stroke();

    ctx.fillStyle = '#e8c96b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${thermo.pressure.toFixed(1)} kPa`, gaugeX - 25, gaugeY + 30);
    ctx.restore();

    updateTelemetry(`
      <span style="color:#e8c96b;">Temperature T: <b>${thermo.temp} K</b></span> |
      <span style="color:#38bdf8;">Volume V: <b>${thermo.volume}%</b></span> |
      <span style="color:#4ade80;">Molecule Count N: <b>${thermo.nParticles}</b></span> |
      <span style="color:#ef4444;">Pressure P: <b>${thermo.pressure.toFixed(1)} kPa</b></span> |
      <span style="color:#a78bfa;">Gas Law: P · V / T = const</span>
    `);
  }

  function initGasParticles() {
    thermo.particles = [];
    const w = (canvas ? canvas.width * 0.75 : 600) * (thermo.volume / 100);
    const h = canvas ? canvas.height * 0.65 : 380;
    const baseSpeed = Math.sqrt(thermo.temp) * 6;
    for (let i = 0; i < thermo.nParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      thermo.particles.push({
        x: 75 + Math.random() * (w - 30),
        y: 95 + Math.random() * (h - 30),
        vx: Math.cos(angle) * baseSpeed,
        vy: Math.sin(angle) * baseSpeed,
        r: 4.5
      });
    }
  }

  function updateGasParticleSpeeds() {
    const baseSpeed = Math.sqrt(thermo.temp) * 6;
    thermo.particles.forEach(p => {
      const curAngle = Math.atan2(p.vy, p.vx);
      p.vx = Math.cos(curAngle) * baseSpeed;
      p.vy = Math.sin(curAngle) * baseSpeed;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // RENDERING HELPERS (Vectors, Energy Bars, Dim Arrows)
  // ─────────────────────────────────────────────────────────────
  function drawVector(x, y, dx, dy, color, label) {
    if (Math.hypot(dx, dy) < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    drawArrowHead(x, y, x + dx, y + dy, color);
    if (label) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(label, x + dx + 6, y + dy + 4);
    }
    ctx.restore();
  }

  function drawArrowHead(fromX, fromY, toX, toY, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLen = 8;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDimArrow(x1, y1, x2, y2, text, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11px monospace';
    ctx.fillText(text, Math.min(x1, x2) - 45, (y1 + y2) / 2);
    ctx.restore();
  }

  function renderEnergyBars(x, y, ke, pe, total) {
    const barW = 28, maxH = 130;
    const maxVal = Math.max(total, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(201,168,76,0.3)';
    ctx.fillRect(x - 14, y - 25, 175, maxH + 60);
    ctx.strokeRect(x - 14, y - 25, 175, maxH + 60);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#e8c96b';
    ctx.fillText('⚡ ENERGY GAUGES', x - 4, y - 8);

    const keH = (ke / maxVal) * maxH;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 5, y + maxH - keH, barW, keH);
    ctx.font = '10px monospace';
    ctx.fillText('KE', x + 12, y + maxH + 15);

    const peH = (pe / maxVal) * maxH;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x + 50, y + maxH - peH, barW, peH);
    ctx.fillText('PE', x + 58, y + maxH + 15);

    const totH = (total / maxVal) * maxH;
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(x + 95, y + maxH - totH, barW, totH);
    ctx.fillText('TOT', x + 100, y + maxH + 15);
    ctx.restore();
  }

  function updateTelemetry(html) {
    const el = document.getElementById('phys-telemetry');
    if (el) el.innerHTML = html;
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

      // Fill board background
      sCtx.fillStyle = '#060f1e';
      sCtx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);

      // Draw simulation canvas onto snapshot
      sCtx.drawImage(canvas, 0, 0);
      if (annoCanvas) {
        sCtx.drawImage(annoCanvas, 0, 0);
      }

      // Watermark with formula & time
      sCtx.font = 'bold 14px Georgia, serif';
      sCtx.fillStyle = '#e8c96b';
      const simName = SIMS.find(s => s.id === activeSim)?.name || 'Physics Lab';
      sCtx.fillText(`PiyushDhara EduVerse — ${simName}`, 24, 32);

      const dataUrl = snapCanvas.toDataURL('image/png');

      // Place onto current whiteboard canvas via Canvas.addImageShape
      if (window.Canvas && typeof Canvas.addImageShape === 'function') {
        Canvas.addImageShape(dataUrl, 100, 100, 560, 340, `${activeSim.toUpperCase()} Simulation Snapshot`);
        hide();
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('📷 Physics Simulation snapshot added to Whiteboard!');
        }
      } else if (typeof ImageTool !== 'undefined' && ImageTool.insertImageOnBoard) {
        ImageTool.insertImageOnBoard(dataUrl, `${activeSim.toUpperCase()} Simulation Snapshot`, 560, 340);
        hide();
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('📷 Physics Simulation snapshot added to Whiteboard!');
        }
      } else {
        const img = new Image();
        img.onload = () => {
          const drawCtx = Canvas.getDrawCtx();
          drawCtx.drawImage(img, 100, 100, 560, 340);
          hide();
          if (window.App && typeof App.showToast === 'function') {
            App.showToast('📷 Simulation stamped onto board!');
          }
        };
        img.src = dataUrl;
      }
    } catch (err) {
      console.error('Failed to stamp simulation to board:', err);
      alert('Error stamping to board: ' + err.message);
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
    setAnnotationMode,
    clearAnnotations,
    syncToolWithBoard,
    setProjPreset,
    setColType,
    setWaveMode,
    setOpticsMode,
    setOpticsPreset,
    setLensType,
    setCircuitMode,
    setCircuitType,
    setCharge,
    getSims: () => SIMS
  };
})();

window.PhysicsLab = PhysicsLab;
