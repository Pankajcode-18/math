'use strict';
// ═══════════════════════════════════════════════
// UI — builds all dynamic HTML, manages panels
// ═══════════════════════════════════════════════
const UI = (() => {

  let panelOpen = false;

  const BOARD_COLORS = [
    { id:'green',  bg:'#0a1f0a', dot:'rgba(255,255,255,0.07)', label:'Chalkboard Green' },
    { id:'black',  bg:'#000000', dot:'rgba(255,255,255,0.06)', label:'Blackboard'       },
    { id:'navy',   bg:'#080f1f', dot:'rgba(201,168,76,0.08)',  label:'Dark Navy'        },
    { id:'white',  bg:'#ffffff', dot:'rgba(0,0,0,0.07)',       label:'Whiteboard'       },
    { id:'cream',  bg:'#fdf6e3', dot:'rgba(0,0,0,0.07)',       label:'Cream Paper'      },
    { id:'slate',  bg:'#0d1b2a', dot:'rgba(255,255,255,0.06)', label:'Slate Blue'       },
  ];

  // ─────────────────────────────────────────────
  function buildSidebar() {
    const nav = document.getElementById('chapter-nav');
    nav.innerHTML = '';
    CHAPTERS.forEach(ch => {
      const d = document.createElement('div');
      d.className = `ch-item${ch.id === App.activeChapter ? ' active' : ''}`;
      d.dataset.id = ch.id;
      d.innerHTML = `
        <span class="ch-num">ch${String(ch.id).padStart(2,'0')}</span>
        <div>
          <div class="ch-name">${ch.name}</div>
          <span class="ch-badge ${ch.badge}">${ch.badge === 'interactive' ? '⚡ Interactive' : '🖊 Boardwork'}</span>
        </div>`;
      d.addEventListener('click', () => App.selectChapter(ch.id));
      nav.appendChild(d);
    });
  }

  // ─────────────────────────────────────────────
  function buildBoardSwatches() {
    const wrap = document.getElementById('board-swatches');
    if (!wrap) return;
    wrap.innerHTML = '';
    BOARD_COLORS.forEach(bc => {
      const s = document.createElement('div');
      s.className = 'bswatch' + (bc.id === 'green' ? ' active' : '');
      s.dataset.id = bc.id;
      s.style.background = bc.bg;
      s.title = bc.label;
      if (bc.bg === '#ffffff' || bc.bg === '#fdf6e3')
        s.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.15)';
      s.addEventListener('click', () => {
        Canvas.setBoardColor(bc.id, bc.bg, bc.dot);
        document.querySelectorAll('.bswatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
      });
      wrap.appendChild(s);
    });
  }

  // ─────────────────────────────────────────────
  function buildShapeGrid() {
    const grid = document.getElementById('shape-grid');
    const SECTIONS = [
      {
        label: '2D Shapes',
        shapes: [
          { t:'rectangle',     l:'Rectangle',   svg:'<rect x="2" y="6" width="28" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'square',        l:'Square',      svg:'<rect x="5" y="5" width="22" height="22" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'circle',        l:'Circle',      svg:'<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'triangle',      l:'Triangle',    svg:'<polygon points="16,3 30,29 2,29" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'equilateral',   l:'Equilat.',    svg:'<polygon points="16,2 30,28 2,28" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'rightTriangle', l:'Right Tri.',  svg:'<polygon points="2,2 2,30 30,30" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><rect x="2" y="17" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2"/>' },
          { t:'trapezium',     l:'Trapezium',   svg:'<polygon points="9,5 23,5 31,27 1,27" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'parallelogram', l:'Parallel.',   svg:'<polygon points="8,5 32,5 24,27 0,27" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'rhombus',       l:'Rhombus',     svg:'<polygon points="16,2 30,16 16,30 2,16" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'kite',          l:'Kite',        svg:'<polygon points="16,2 28,14 16,30 4,14" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'sector',        l:'Sector',      svg:'<path d="M16,16 L16,3 A13,13 0 0,1 28,23 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'semicircle',    l:'Semicircle',  svg:'<path d="M4,16 A12,12 0 0,1 28,16 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="2"/>' },
          { t:'ellipse',       l:'Ellipse',     svg:'<ellipse cx="16" cy="16" rx="14" ry="9" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'pentagon',      l:'Pentagon',    svg:'<polygon points="16,2 29,11 24,27 8,27 3,11" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'hexagon',       l:'Hexagon',     svg:'<polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'octagon',       l:'Octagon',     svg:'<polygon points="11,2 21,2 30,11 30,21 21,30 11,30 2,21 2,11" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
        ]
      },
      {
        label: '3D Shapes',
        shapes: [
          { t:'cube',          l:'Cube',        svg:'<rect x="4" y="10" width="18" height="18" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".1"/><polygon points="4,10 10,4 28,4 28,22 22,28" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".07"/><line x1="22" y1="10" x2="28" y2="4" stroke="currentColor" stroke-width="1.8"/>' },
          { t:'cuboid',        l:'Cuboid',      svg:'<rect x="2" y="12" width="20" height="14" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".1"/><polygon points="2,12 8,6 28,6 28,20 22,26" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".07"/><line x1="22" y1="12" x2="28" y2="6" stroke="currentColor" stroke-width="1.8"/>' },
          { t:'cylinder',      l:'Cylinder',    svg:'<ellipse cx="16" cy="7" rx="11" ry="4" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><ellipse cx="16" cy="25" rx="11" ry="4" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><line x1="5" y1="7" x2="5" y2="25" stroke="currentColor" stroke-width="1.8"/><line x1="27" y1="7" x2="27" y2="25" stroke="currentColor" stroke-width="1.8"/>' },
          { t:'hollowCylinder',l:'Hollow Cyl.', svg:'<ellipse cx="16" cy="7" rx="11" ry="4" stroke="currentColor" stroke-width="1.8" fill="none"/><ellipse cx="16" cy="7" rx="5" ry="2" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,2" fill="none"/><ellipse cx="16" cy="25" rx="11" ry="4" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".1"/><line x1="5" y1="7" x2="5" y2="25" stroke="currentColor" stroke-width="1.8"/><line x1="27" y1="7" x2="27" y2="25" stroke="currentColor" stroke-width="1.8"/>' },
          { t:'cone',          l:'Cone',        svg:'<polygon points="16,3 28,29 4,29" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><ellipse cx="16" cy="29" rx="12" ry="3.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".15"/>' },
          { t:'sphere',        l:'Sphere',      svg:'<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><ellipse cx="16" cy="16" rx="12" ry="4" stroke="currentColor" stroke-width="1" stroke-dasharray="3,2" fill="none"/>' },
          { t:'hemisphere',    l:'Hemisphere',  svg:'<path d="M4,16 A12,12 0 0,1 28,16 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><ellipse cx="16" cy="16" rx="12" ry="3.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".15"/>' },
          { t:'prism',         l:'Tri. Prism',  svg:'<polygon points="16,3 28,26 4,26" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><polygon points="20,0 32,23 20,23" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,2" fill="none"/><line x1="16" y1="3" x2="20" y2="0" stroke="currentColor" stroke-width="1.5"/><line x1="28" y1="26" x2="32" y2="23" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="26" x2="20" y2="23" stroke="currentColor" stroke-dasharray="3,2" stroke-width="1.2"/>' },
          { t:'rectPrism',     l:'Rect. Prism', svg:'<rect x="2" y="12" width="20" height="14" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".1"/><polygon points="2,12 8,6 28,6 28,20 22,26" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".07"/><line x1="22" y1="12" x2="28" y2="6" stroke="currentColor" stroke-width="1.8"/>' },
          { t:'pentPrism',     l:'Pent. Prism', svg:'<polygon points="16,3 27,10 23,24 9,24 5,10" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><polygon points="20,0 31,7 27,21 13,21 9,7" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,2" fill="none"/><line x1="16" y1="3" x2="20" y2="0" stroke="currentColor" stroke-width="1.5"/><line x1="27" y1="10" x2="31" y2="7" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'hexPrism',      l:'Hex. Prism',  svg:'<polygon points="16,2 25,7 25,19 16,24 7,19 7,7" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><polygon points="20,0 29,5 29,17 20,22 11,17 11,5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,2" fill="none"/><line x1="16" y1="2" x2="20" y2="0" stroke="currentColor" stroke-width="1.5"/><line x1="25" y1="7" x2="29" y2="5" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'pyramid',       l:'Pyramid',     svg:'<polygon points="16,2 30,28 2,28" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".12"/><polygon points="16,2 30,28 34,22" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".07"/><line x1="2" y1="28" x2="34" y2="22" stroke="currentColor" stroke-dasharray="3,2" stroke-width="1.2"/>' },
        ]
      },
      {
        label: 'Tools',
        shapes: [
          { t:'number-line',   l:'Num. Line',   svg:'<line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="2.5"/><line x1="10" y1="11" x2="10" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="11" x2="16" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="11" x2="22" y2="21" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'protractor',    l:'Protractor',  svg:'<path d="M4,20 A12,12 0 0,1 28,20 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><line x1="4" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="20" x2="16" y2="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>' },
        ]
      }
    ];

    grid.innerHTML = '';
    SECTIONS.forEach(sec => {
      // Section label
      const lbl = document.createElement('div');
      lbl.style.cssText = `grid-column:1/-1;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);opacity:.6;padding:6px 2px 3px;margin-top:2px;border-top:1px solid rgba(201,168,76,0.12)`;
      lbl.textContent = sec.label;
      grid.appendChild(lbl);

      sec.shapes.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'shape-btn';
        btn.title = s.l;
        btn.innerHTML = `<svg viewBox="0 0 32 32" fill="none" style="color:var(--gold)">${s.svg}</svg><span class="sl">${s.l}</span>`;
        btn.addEventListener('click', () => Canvas.addShape(s.t));
        grid.appendChild(btn);
      });
    });
  }

  // ─────────────────────────────────────────────
  function buildColorPalette() {
    const pal = document.getElementById('color-palette');
    const COLORS = [
      '#ffffff','#ef4444','#22c55e','#c9a84c','#a855f7',
      '#f97316','#06b6d4','#ec4899','#6b7280','#1d4ed8'
    ];
    pal.innerHTML = '';
    COLORS.forEach(hex => {
      const d = document.createElement('div');
      d.className = `color-dot${hex === App.currentColor ? ' active' : ''}`;
      d.dataset.hex = hex;
      d.style.background = hex;
      if (hex === '#ffffff') d.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.15)';
      d.addEventListener('click', () => App.setColor(hex));
      pal.appendChild(d);
    });
    const cc = document.getElementById('custom-color');
    if (cc) cc.addEventListener('input', e => App.setColor(e.target.value));
  }

  // ─────────────────────────────────────────────
  function buildPenSizes() {
    const wrap = document.getElementById('pen-sizes');
    [{ sz:2,dot:4 },{ sz:4,dot:7 },{ sz:8,dot:11 },{ sz:16,dot:16 }].forEach(p => {
      const btn = document.createElement('button');
      btn.className = `pen-sz${p.sz === App.penSize ? ' active' : ''}`;
      btn.title = `${p.sz}px`;
      btn.innerHTML = `<div style="width:${p.dot}px;height:${p.dot}px;border-radius:50%;background:var(--gold)"></div>`;
      btn.addEventListener('click', () => {
        App.penSize = p.sz;
        document.querySelectorAll('.pen-sz').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      wrap.appendChild(btn);
    });
  }

  // ─────────────────────────────────────────────
  function syncPenPanel() {
    const sec = document.getElementById('pen-sz-sec');
    if (sec) sec.style.display = ['pen','highlighter','eraser'].includes(App.currentTool) ? 'block' : 'none';
  }

  // ─────────────────────────────────────────────
  function showPropPanel(shape) {
    const sec = document.getElementById('props-sec');
    const cnt = document.getElementById('props-content');
    if (!sec || !cnt) return;
    if (!shape || !getPropDefs(shape).length) { sec.style.display='none'; return; }
    sec.style.display = 'block';
    cnt.innerHTML = '';

    getPropDefs(shape).forEach(p => {
      const row = document.createElement('div');
      row.className = 'prop-row';

      // Unit label — show cm for display, px internally
      const cmVal = (+(shape[p.key] || 0) * 0.1).toFixed(1);

      row.innerHTML = `
        <span class="prop-lbl">${p.label}</span>
        <input class="prop-inp"
          type="text"
          inputmode="decimal"
          value="${Math.round(shape[p.key] || 0)}"
          placeholder="e.g. 80"
          style="width:100%;text-align:left;letter-spacing:.02em">
        <span class="prop-unit" style="white-space:nowrap;font-size:9px;min-width:22px">px</span>`;

      const input = row.querySelector('input');

      // Apply on every keystroke immediately
      input.addEventListener('input', function() {
        const v = parseFloat(this.value);
        if (!isNaN(v) && v > 0) Canvas.updateProp(p.key, v);
      });

      // Select all text on focus so teacher can just type new value
      input.addEventListener('focus', function() {
        setTimeout(() => this.select(), 0);
      });

      // Also accept Enter key
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          const v = parseFloat(this.value);
          if (!isNaN(v) && v > 0) Canvas.updateProp(p.key, v);
          this.blur();
        }
        // Prevent canvas keyboard shortcuts while typing in input
        e.stopPropagation();
      });

      cnt.appendChild(row);
    });

    // Delete button at bottom of props panel
    const delBtn = document.createElement('button');
    delBtn.innerHTML = `
      <svg viewBox="0 0 18 18" fill="none" style="width:13px;height:13px">
        <path d="M3 5h12M8 5V3h2v2M7 8v5M11 8v5M4 5l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Delete Shape`;
    delBtn.style.cssText = `
      width:100%;margin-top:10px;padding:8px 12px;
      border-radius:6px;border:1px solid rgba(239,68,68,.4);
      background:rgba(239,68,68,.1);color:#fca5a5;
      font-size:12px;font-weight:600;cursor:pointer;
      display:flex;align-items:center;justify-content:center;gap:6px;
      transition:all .15s;font-family:'Inter',sans-serif;
    `;
    delBtn.addEventListener('mouseenter', () => {
      delBtn.style.background = 'rgba(239,68,68,.22)';
      delBtn.style.borderColor = 'rgba(239,68,68,.7)';
    });
    delBtn.addEventListener('mouseleave', () => {
      delBtn.style.background = 'rgba(239,68,68,.1)';
      delBtn.style.borderColor = 'rgba(239,68,68,.4)';
    });
    delBtn.addEventListener('click', () => Canvas.deleteShape());
    cnt.appendChild(delBtn);
  }  // ← end showPropPanel

  function hidePropPanel() {
    const sec = document.getElementById('props-sec');
    if (sec) sec.style.display = 'none';
  }

  function getPropDefs(s) {
    return ({
      rectangle:    [{ label:'Width', key:'w' },{ label:'Height', key:'h' }],
      square:       [{ label:'Side',  key:'w' }],
      circle:       [{ label:'Radius', key:'r' }],
      triangle:     [{ label:'Base', key:'base' },{ label:'Height', key:'height' }],
      trapezium:    [{ label:'Top (a)', key:'a' },{ label:'Bottom (b)', key:'b' },{ label:'Height', key:'h' }],
      parallelogram:[{ label:'Base', key:'base' },{ label:'Height', key:'h' }],
      rhombus:      [{ label:'Diag d₁', key:'d1' },{ label:'Diag d₂', key:'d2' }],
      sector:       [{ label:'Radius', key:'r' },{ label:'Angle°', key:'angle', step:1, min:1 }],
      equilateral:   [{ label:'Side', key:'side' }],
      rightTriangle: [{ label:'Base', key:'base' },{ label:'Height', key:'height' }],
      hollowCylinder:[{ label:'Outer R', key:'R' },{ label:'Inner r', key:'r' },{ label:'Height', key:'h' }],
      hemisphere:    [{ label:'Radius', key:'r' }],
      rectPrism:     [{ label:'Length', key:'w' },{ label:'Depth', key:'depth' },{ label:'Height', key:'h' }],
      pentPrism:     [{ label:'Radius', key:'r' },{ label:'Length', key:'depth' }],
      hexPrism:      [{ label:'Radius', key:'r' },{ label:'Length', key:'depth' }],
      prism:         [{ label:'Base', key:'base' },{ label:'Height', key:'height' },{ label:'Length', key:'depth' }],
      pyramid:       [{ label:'Base', key:'base' },{ label:'Height', key:'h' }],
      ellipse:      [{ label:'Semi-a (rx)', key:'rx' },{ label:'Semi-b (ry)', key:'ry' }],
      pentagon:     [{ label:'Radius', key:'r' }],
      hexagon:      [{ label:'Radius', key:'r' }],
      octagon:      [{ label:'Radius', key:'r' }],
      kite:         [{ label:'Width', key:'w' },{ label:'Top height', key:'h1' },{ label:'Bot height', key:'h2' }],
      sphere:       [{ label:'Radius', key:'r' }],
      cuboid:       [{ label:'Length', key:'w' },{ label:'Height', key:'h' },{ label:'Depth', key:'d' }],
      protractor:   [{ label:'Radius', key:'r' }],
      'number-line':[{ label:'Min', key:'min', min:-100 },{ label:'Max', key:'max' },{ label:'Length', key:'length' }],
      cube:         [{ label:'Side', key:'side' }],
      cylinder:     [{ label:'Radius', key:'r' },{ label:'Height', key:'h' }],
      cone:         [{ label:'Radius', key:'r' },{ label:'Height', key:'h' }],
    })[s.type] || [];
  }

  // ─────────────────────────────────────────────
  // CHAPTER PANEL (SLIDES DOWN FROM TOP)
  // ─────────────────────────────────────────────
  function toggleChapterPanel() {
    panelOpen = !panelOpen;
    const panel = document.getElementById('chapter-panel');
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) renderChapterPanel();
  }

  function openChapterPanel() {
    panelOpen = true;
    document.getElementById('chapter-panel').classList.add('open');
    renderChapterPanel();
  }

  function renderChapterPanel() {
    const ch  = CHAPTERS.find(c => c.id === App.activeChapter);
    if (!ch) return;
    document.getElementById('cp-title').textContent = `Ch ${ch.id}: ${ch.name}`;
    document.getElementById('cp-body').innerHTML = buildContent(ch);
    setTimeout(() => {
      if (ch.id === 1)  SetsUI.init();
      if (ch.id === 13) Calculators.drawStatBar([12,18,14,16,20,15]);
      if (ch.id === 6) {
        const sel = document.getElementById('seq-type');
        if (sel) sel.addEventListener('change', Calculators.seqTypeSwitch);
      }
    }, 60);
  }

  // ─────────────────────────────────────────────
  // CHAPTER CONTENT — SETS REDESIGNED
  // ─────────────────────────────────────────────
  function buildContent(ch) {
    switch(ch.id) {

      // ── CH 1: SETS — Dynamic multi-set ──
      case 1: return `
        <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:14px;height:100%">

          <!-- LEFT: Set inputs + operations -->
          <div class="calc-card" style="display:flex;flex-direction:column;gap:0;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <h4 style="margin:0">Sets</h4>
              <div style="display:flex;gap:6px;align-items:center">
                <button class="c-btn-sm" onclick="SetsUI.addSet()" style="padding:4px 10px;font-size:11px">＋ Add Set</button>
                <button class="c-btn-sm" onclick="SetsUI.removeSet()" style="padding:4px 10px;font-size:11px;background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);color:#fca5a5">− Remove</button>
              </div>
            </div>

            <!-- Dynamic set inputs container -->
            <div id="sets-inputs" style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px;max-height:130px;overflow-y:auto"></div>

            <!-- n(U) -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap">n(U) universal set:</span>
              <input class="c-inp" id="set-U" type="number" placeholder="e.g. 50" style="width:80px;text-align:left">
            </div>

            <!-- Operation buttons — generated dynamically -->
            <div id="sets-op-btns" style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px"></div>

            <!-- Result -->
            <div class="c-result" id="set-result" style="min-height:38px;font-size:12.5px">Enter values in sets above, then choose an operation.</div>

            <!-- Solve space -->
            <div style="margin-top:8px">
              <div style="font-size:9px;color:rgba(255,255,255,.35);margin-bottom:3px;letter-spacing:.08em;text-transform:uppercase">Working / solve space</div>
              <textarea id="sets-solve" style="width:100%;min-height:48px;max-height:80px;background:rgba(0,0,0,.28);border:1px solid rgba(201,168,76,.14);border-radius:6px;color:rgba(255,255,255,.82);font-family:'JetBrains Mono',monospace;font-size:12px;padding:6px 9px;resize:vertical;outline:none" placeholder="Write your steps here…"></textarea>
            </div>
          </div>

          <!-- RIGHT: Venn diagram -->
          <div class="calc-card" style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <h4 style="align-self:flex-start">Live Venn Diagram</h4>
            <canvas id="venn-canvas" width="280" height="200" style="border-radius:7px;background:rgba(0,0,0,.22);max-width:100%"></canvas>
            <div id="venn-counts" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,.5);text-align:center;line-height:1.9;align-self:flex-start"></div>
          </div>

        </div>`;


      // ── CH 2: COMPOUND INTEREST ──
      case 2: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Compound Interest Calculator</h4>
            <div class="c-row"><label>Principal (P):</label><input class="c-inp" id="ci-p" type="number" value="10000"></div>
            <div class="c-row"><label>Rate % (R):</label><input class="c-inp" id="ci-r" type="number" value="10" step=".1"></div>
            <div class="c-row"><label>Time (T) years:</label><input class="c-inp" id="ci-t" type="number" value="3"></div>
            <div class="c-row"><label>Compounded:</label>
              <select class="c-sel" id="ci-n"><option value="1">Yearly</option><option value="2">Half-yearly</option><option value="4">Quarterly</option><option value="12">Monthly</option></select>
            </div>
            <button class="c-btn" onclick="Calculators.ciCalc()">Calculate</button>
            <div class="c-result" id="ci-result">—</div>
          </div>
          <div class="calc-card"><h4>Formulas</h4>
            <div class="c-ref">A = P(1 + R/100n)ⁿᵀ<br>CI = A − P<br>SI = PRT/100<br><br><b>P</b>=Principal <b>R</b>=Rate <b>T</b>=Time<br><b>n</b>=compounding frequency</div>
          </div>
        </div>`;

      // ── CH 3 ──
      case 3: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Growth &amp; Depreciation</h4>
            <div class="c-row"><label>Initial Value:</label><input class="c-inp" id="gd-p" type="number" value="100000"></div>
            <div class="c-row"><label>Rate % (R):</label><input class="c-inp" id="gd-r" type="number" value="8" step=".1"></div>
            <div class="c-row"><label>Time (T) years:</label><input class="c-inp" id="gd-t" type="number" value="5"></div>
            <div class="c-row"><label>Type:</label>
              <select class="c-sel" id="gd-type"><option value="growth">Growth</option><option value="depreciation">Depreciation</option></select>
            </div>
            <button class="c-btn" onclick="Calculators.gdCalc()">Calculate</button>
            <div class="c-result" id="gd-result">—</div>
          </div>
          <div class="calc-card"><h4>Formulas</h4>
            <div class="c-ref"><b>Growth:</b> V = P(1 + R/100)ᵀ<br><b>Depreciation:</b> V = P(1 − R/100)ᵀ</div>
          </div>
        </div>`;

      // ── CH 4 ──
      case 4: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Currency Converter</h4>
            <div class="c-row"><label>Amount:</label><input class="c-inp" id="fx-amt" type="number" value="1000"></div>
            <div class="c-row"><label>From:</label><input class="c-inp" id="fx-from" value="NPR" style="text-align:left;width:70px;text-transform:uppercase"></div>
            <div class="c-row"><label>To:</label><input class="c-inp" id="fx-to" value="USD" style="text-align:left;width:70px;text-transform:uppercase"></div>
            <div class="c-row"><label>Rate (1 from = ? to):</label><input class="c-inp" id="fx-rate" type="number" value="0.0075" step=".0001"></div>
            <div class="c-row"><label>Commission %:</label><input class="c-inp" id="fx-comm" type="number" value="0" step=".1"></div>
            <button class="c-btn" onclick="Calculators.fxCalc()">Convert</button>
            <div class="c-result" id="fx-result">—</div>
          </div>
          <div class="calc-card"><h4>Common Rates (approx)</h4>
            <div class="c-ref">1 USD ≈ 133 NPR<br>1 EUR ≈ 144 NPR<br>1 GBP ≈ 168 NPR<br>1 INR ≈ 1.6 NPR<br>1 AUD ≈ 86 NPR</div>
          </div>
        </div>`;

      // ── CH 5 ──
      case 5: return `
        <div class="calc-grid">
          <div class="calc-card"><h4>2D Formulas</h4>
            <div class="c-ref">Square: A = a²<br>Rectangle: A = l×b<br>Triangle: A = ½bh<br>Parallelogram: A = bh<br>Trapezium: A = ½(a+b)h<br>Rhombus: A = ½d₁d₂<br>Circle: A = πr²<br>Sector: A = (θ/360)πr²</div>
          </div>
          <div class="calc-card"><h4>3D Formulas</h4>
            <div class="c-ref">Cube: V = a³<br>Cuboid: V = l×b×h<br>Cylinder: V = πr²h<br>Cone: V = ⅓πr²h<br>Sphere: V = ⁴⁄₃πr³<br><br>Select a shape → enter dimensions in right panel → formula shows automatically.</div>
          </div>
        </div>`;

      // ── CH 6 ──
      case 6: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Sequence Generator</h4>
            <div class="c-row"><label>Type:</label>
              <select class="c-sel" id="seq-type" onchange="Calculators.seqTypeSwitch()">
                <option value="ap">AP — Arithmetic</option>
                <option value="gp">GP — Geometric</option>
              </select>
            </div>
            <div class="c-row"><label>First term (a):</label><input class="c-inp" id="seq-a" type="number" value="2"></div>
            <div class="c-row" id="seq-d-row"><label>Common diff (d):</label><input class="c-inp" id="seq-d" type="number" value="3"></div>
            <div class="c-row" id="seq-r-row" style="display:none"><label>Common ratio (r):</label><input class="c-inp" id="seq-r" type="number" value="2" step=".1"></div>
            <div class="c-row"><label>No. of terms (n):</label><input class="c-inp" id="seq-n" type="number" value="10"></div>
            <button class="c-btn" onclick="Calculators.seqCalc()">Generate</button>
            <div class="c-result" id="seq-result">—</div>
          </div>
          <div class="calc-card"><h4>Formulas</h4>
            <div class="c-ref"><b>AP:</b> aₙ = a+(n-1)d  |  Sₙ = n/2[2a+(n-1)d]<br><br><b>GP:</b> aₙ = arⁿ⁻¹  |  Sₙ = a(rⁿ-1)/(r-1)</div>
          </div>
        </div>`;

      // ── CH 7 ──
      case 7: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Quadratic Solver — ax² + bx + c = 0</h4>
            <div class="c-row"><label>a:</label><input class="c-inp" id="q-a" type="number" value="1" step=".1"></div>
            <div class="c-row"><label>b:</label><input class="c-inp" id="q-b" type="number" value="-5" step=".1"></div>
            <div class="c-row"><label>c:</label><input class="c-inp" id="q-c" type="number" value="6" step=".1"></div>
            <button class="c-btn" onclick="Calculators.quadCalc()">Solve</button>
            <div class="c-result" id="q-result">—</div>
          </div>
          <div class="calc-card"><h4>Discriminant</h4>
            <div class="c-ref">D = b² − 4ac<br>D &gt; 0 → 2 real roots<br>D = 0 → 1 repeated root<br>D &lt; 0 → complex roots<br><br>x = (−b ± √D) / 2a<br><br>Sum of roots = −b/a<br>Product = c/a</div>
          </div>
        </div>`;

      // ── CH 8 ──
      case 8: return `<div class="calc-card"><h4>Algebraic Fractions — Board Mode</h4><div class="c-ref">• Factorise numerator &amp; denominator<br>• Cancel common factors<br>• Use LCM for addition/subtraction<br><br>Example: (x²−4)/(x+2) = x−2</div></div>`;

      // ── CH 9 ──
      case 9: return `<div class="calc-card"><h4>Laws of Indices</h4><div class="c-ref">aᵐ × aⁿ = aᵐ⁺ⁿ<br>aᵐ ÷ aⁿ = aᵐ⁻ⁿ<br>(aᵐ)ⁿ = aᵐⁿ<br>a⁰ = 1<br>a⁻ⁿ = 1/aⁿ<br>a^(1/n) = ⁿ√a<br>a^(m/n) = ⁿ√(aᵐ)</div></div>`;

      // ── CH 10 ──
      case 10: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Triangle Calculator</h4>
            <div class="c-row"><label>Side a:</label><input class="c-inp" id="tri-a" type="number" value="5" step=".1"></div>
            <div class="c-row"><label>Side b:</label><input class="c-inp" id="tri-b" type="number" value="7" step=".1"></div>
            <div class="c-row"><label>Side c:</label><input class="c-inp" id="tri-c" type="number" value="8" step=".1"></div>
            <button class="c-btn" onclick="Calculators.triCalc()">Calculate</button>
            <div class="c-result" id="tri-result">—</div>
          </div>
          <div class="calc-card"><h4>Theorems</h4>
            <div class="c-ref">Pythagoras: a²+b²=c²<br>Heron's: A=√s(s-a)(s-b)(s-c)<br>s = (a+b+c)/2<br><br>Angle sum = 180°<br>Cosine: a²=b²+c²−2bc·cosA</div>
          </div>
        </div>`;

      // ── CH 11 ──
      case 11: return `<div class="calc-card"><h4>Construction — Board Mode</h4><div class="c-ref">Use Line and Pen tools to construct:<br>• Perpendicular bisector<br>• Angle bisector<br>• Triangle (SSS, SAS, ASA)<br>• Parallel lines<br>• Circles (circumscribed / inscribed)</div></div>`;

      // ── CH 12 ──
      case 12: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Circle Calculator</h4>
            <div class="c-row"><label>Radius (r):</label><input class="c-inp" id="circ-r" type="number" value="7" step=".1"></div>
            <div class="c-row"><label>Angle θ°:</label><input class="c-inp" id="circ-theta" type="number" value="90" step="1"></div>
            <button class="c-btn" onclick="Calculators.circleCalc()">Calculate</button>
            <div class="c-result" id="circ-result">—</div>
          </div>
          <div class="calc-card"><h4>Formulas</h4>
            <div class="c-ref">Area = πr²<br>Circumference = 2πr<br>Arc = (θ/360)×2πr<br>Sector area = (θ/360)×πr²<br>Chord = 2r·sin(θ/2)</div>
          </div>
        </div>`;

      // ── CH 13 ──
      case 13: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Statistics Calculator</h4>
            <div style="margin-bottom:8px">
              <div style="font-size:10px;color:rgba(255,255,255,.45);margin-bottom:3px">Data (comma-separated)</div>
              <input class="c-inp wide" id="stat-data" value="12,18,14,16,20,15,13,19,17,11">
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
              <button class="c-btn-sm" onclick="Calculators.statCalc('mean')">Mean</button>
              <button class="c-btn-sm" onclick="Calculators.statCalc('median')">Median</button>
              <button class="c-btn-sm" onclick="Calculators.statCalc('mode')">Mode</button>
              <button class="c-btn-sm" onclick="Calculators.statCalc('range')">Range</button>
              <button class="c-btn-sm" onclick="Calculators.statCalc('sd')">Std Dev</button>
              <button class="c-btn-sm" onclick="Calculators.statCalc('all')">All + Chart</button>
            </div>
            <div class="c-result" id="stat-result">—</div>
          </div>
          <div class="calc-card"><h4>Bar Chart</h4>
            <canvas id="stat-bar-canvas" width="210" height="120" style="border-radius:6px;background:rgba(0,0,0,.25)"></canvas>
          </div>
        </div>`;

      // ── CH 14 ──
      case 14: return `
        <div class="calc-grid">
          <div class="calc-card">
            <h4>Probability</h4>
            <div class="c-row"><label>Favourable (f):</label><input class="c-inp" id="pr-f" type="number" value="3"></div>
            <div class="c-row"><label>Total (n):</label><input class="c-inp" id="pr-n" type="number" value="6"></div>
            <button class="c-btn" onclick="Calculators.probCalc()">Calculate P(E)</button>
            <div class="c-result" id="pr-result">—</div>
            <div class="prob-bar-wrap"><div class="prob-bar-fill" id="prob-bar-fill" style="width:50%"></div></div>
          </div>
          <div class="calc-card">
            <h4>Simulators</h4>
            <div style="margin-bottom:12px">
              <div style="font-size:10px;color:var(--gold);margin-bottom:6px;font-weight:600">DICE ROLLER</div>
              <div class="dice-row">
                <button class="c-btn-sm" onclick="Calculators.rollDice()">🎲 Roll</button>
                <div id="dice-face" style="font-size:30px;line-height:1">⚄</div>
                <span id="dice-result-text" style="font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.6)"></span>
              </div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--gold);margin-bottom:6px;font-weight:600">COIN FLIP</div>
              <div class="dice-row">
                <button class="c-btn-sm" onclick="Calculators.flipCoin()">🪙 Flip</button>
                <div id="coin-face" style="font-size:26px;font-family:var(--mono);font-weight:700;color:var(--gold-hi)">H</div>
                <span id="coin-result-text" style="font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.6)"></span>
              </div>
            </div>
          </div>
          <div class="calc-card"><h4>Formulas</h4>
            <div class="c-ref">P(E) = f/n<br>0 ≤ P(E) ≤ 1<br>P(E)+P(E')=1<br><br>P(A∪B)=P(A)+P(B)−P(A∩B)<br>P(A∩B)=P(A)·P(B) [indep]</div>
          </div>
        </div>`;

      default: return `<div class="c-ref">Use the drawing tools on the board above.</div>`;
    }
  }

  // ─────────────────────────────────────────────
  function updateStatus() {
    const t = document.getElementById('sb-tool');
    const o = document.getElementById('sb-objs');
    if (t) t.innerHTML = App.currentTool;
    if (o) o.innerHTML = Canvas.getShapeCount();
  }

  // ─────────────────────────────────────────────
  return {
    buildSidebar, buildShapeGrid, buildColorPalette, buildPenSizes,
    buildBoardSwatches, syncPenPanel,
    showPropPanel, hidePropPanel,
    toggleChapterPanel, openChapterPanel, renderChapterPanel,
    updateStatus
  };
})();