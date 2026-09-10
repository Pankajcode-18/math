'use strict';

// ═══════════════════════════════════════════════════════════
// GRAPH ENGINE — Live Interactive Graphs & Statistics
// Tabs: Line Graph, Bar Chart, Pie Chart, Scatter Plot,
//       Histogram, Statistics Dashboard
// ═══════════════════════════════════════════════════════════

const GraphEngine = (() => {

  let visible   = false;
  let activeTab = 'line';
  let animFrame = null;
  let annoCanvas = null;
  let annoCtx = null;
  let isAnnoDrawing = false;
  let annoPoints = [];
  let drawingMode = 'draw';
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 30;

  // ── Colour palette for charts ──
  const COLORS = [
    '#4e9af1','#f1a94e','#4ef17a','#f14e8a',
    '#a94ef1','#f14e4e','#4ef1e8','#f1e84e'
  ];

  // ── State for each tab ──
  const state = {
    line: {
      title: 'Line Graph',
      datasets: [
        { label:'Series A', color:'#4e9af1', points:[{x:1,y:3},{x:2,y:5},{x:3,y:2},{x:4,y:8},{x:5,y:6}] },
        { label:'Series B', color:'#f1a94e', points:[{x:1,y:1},{x:2,y:4},{x:3,y:6},{x:4,y:3},{x:5,y:9}] },
      ],
      xLabel:'X Axis', yLabel:'Y Axis', showGrid:true, showPoints:true, smooth:false,
    },
    bar: {
      title: 'Bar Chart',
      labels:  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets:[
        { label:'Students', color:'#4e9af1', values:[12,19,8,15,22,10,18] },
        { label:'Absent',   color:'#f14e4e', values:[3,5,2,4,6,1,3] },
      ],
      xLabel:'Day', yLabel:'Count',
    },
    pie: {
      title: 'Pie / Donut Chart',
      labels:  ['Algebra','Geometry','Arithmetic','Statistics','Probability'],
      values:  [30,25,20,15,10],
      donut: false,
    },
    scatter: {
      title: 'Scatter Plot',
      datasets:[
        { label:'Group A', color:'#4e9af1', points:[{x:2,y:4},{x:3,y:6},{x:4,y:3},{x:6,y:8},{x:7,y:5},{x:8,y:9}] },
        { label:'Group B', color:'#f1a94e', points:[{x:1,y:7},{x:3,y:2},{x:5,y:6},{x:7,y:3},{x:9,y:7}] },
      ],
      showTrendline: false,
      xLabel:'X', yLabel:'Y',
    },
    histogram: {
      title: 'Histogram (Frequency Distribution)',
      rawData: '12,15,18,22,14,19,25,17,21,13,16,20,23,18,15,24,19,22,14,17',
      bins: 5,
      xLabel:'Class Interval', yLabel:'Frequency',
    },
    stats: {
      title: 'Statistics Dashboard',
      data: '12,18,14,16,20,15,13,19,17,11,22,16,14,18,20',
      groupedData: '10-20:5, 20-30:8, 30-40:6, 40-50:3',
    }
  };

  // ════════════════════════════════════════════════════════
  // SHOW / HIDE
  // ════════════════════════════════════════════════════════
  function show() {
    visible = true;
    if (typeof App !== 'undefined' && App.setSimulationActive) {
      App.setSimulationActive(true);
    }
    let overlay = document.getElementById('graph-overlay');
    if (!overlay) { overlay = createOverlay(); }
    overlay.style.display = 'flex';
    setTimeout(() => {
      overlay.style.opacity = '1';
      render();
    }, 10);
    switchTab(activeTab);
    syncToolWithBoard();
  }

  function hide() {
    visible = false;
    if (typeof App !== 'undefined' && App.setSimulationActive) {
      App.setSimulationActive(false);
    }
    const overlay = document.getElementById('graph-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; }, 280);
    }
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  }

  function toggle() { visible ? hide() : show(); }

  function isVisible() { return visible; }

  // ════════════════════════════════════════════════════════
  // BUILD OVERLAY
  // ════════════════════════════════════════════════════════
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'graph-overlay';
    overlay.style.cssText = `
      position: absolute;
      left: 64px; top: 0; right: 0; bottom: 0;
      z-index: 120;
      background: rgba(5,10,20,0.97);
      border: none;
      border-left: 1px solid rgba(201,168,76,0.25);
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      display: flex; flex-direction: column;
      overflow: hidden;
      opacity: 0; transition: opacity .28s ease;
      font-family: 'Segoe UI',system-ui,sans-serif;
    `;

    // Header
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;
        background:linear-gradient(90deg,#060e1c,#101d3a,#060e1c);
        border-bottom:1.5px solid #c9a84c;flex-shrink:0">
        <img src="../assets/logo.png" style="height:34px;width:34px;object-fit:contain;
          filter:drop-shadow(0 0 6px rgba(201,168,76,.5))">
        <div>
          <div style="font-family:Georgia,serif;font-size:15px;font-weight:700;
            color:#e8c96b;letter-spacing:.06em">PiyushDhara MathBoard</div>
          <div style="font-size:9px;color:#c9a84c;letter-spacing:.18em;
            text-transform:uppercase;opacity:.7">Graph & Statistics Engine</div>
        </div>
        <div style="flex:1"></div>
        <button id="graph-btn-stamp" onclick="GraphEngine.stampToWhiteboard()" style="
          padding:7px 12px;border-radius:6px;border:1.5px solid #c9a84c;
          background:linear-gradient(135deg,rgba(201,168,76,.3),rgba(201,168,76,.15));color:#fef08a;font-size:12px;font-weight:600;
          cursor:pointer;font-family:'Segoe UI',sans-serif;touch-action:manipulation;margin-right:6px">
          📷 Insert to Board
        </button>
        <button id="graph-btn-fullscreen" onclick="App.toggleFullscreen()" style="
          padding:7px 12px;border-radius:6px;border:1px solid rgba(201,168,76,.4);
          background:rgba(201,168,76,.12);color:#e8c96b;font-size:12px;font-weight:600;
          cursor:pointer;font-family:'Segoe UI',sans-serif;touch-action:manipulation;margin-right:6px">
          ⛶ Fullscreen
        </button>
        <button onclick="GraphEngine.hide()" style="
          padding:7px 14px;border-radius:6px;border:1px solid rgba(239,68,68,.4);
          background:rgba(239,68,68,.1);color:#fca5a5;font-size:12px;font-weight:600;
          cursor:pointer;font-family:'Segoe UI',sans-serif;touch-action:manipulation">
          ✕ Close
        </button>
      </div>

      <!-- Tab bar -->
      <div id="graph-tabs" style="display:flex;gap:0;background:#080f1f;
        border-bottom:1px solid rgba(201,168,76,.18);flex-shrink:0;overflow-x:auto">
      </div>

      <!-- Main area: controls left, canvas right -->
      <div style="display:flex;flex:1;overflow:hidden">
        <!-- Controls -->
        <div id="graph-controls" style="width:300px;min-width:260px;background:#0d1b38;
          border-right:1px solid rgba(201,168,76,.18);overflow-y:auto;flex-shrink:0;
          padding:14px 12px">
        </div>
        <!-- Chart canvas wrapper -->
        <div style="flex:1;position:relative;padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:hidden">
          <div id="graph-canvas-wrap" style="flex:1;position:relative;min-height:0;border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.03);border:1px solid rgba(201,168,76,.15)">
            <canvas id="graph-canvas" style="position:absolute;left:0;top:0;width:100%;height:100%"></canvas>
            <canvas id="graph-anno-canvas" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:auto;touch-action:none;z-index:10"></canvas>
          </div>
          <div id="graph-stats-row" style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0"></div>
        </div>
      </div>
    `;

    const mountParent = document.getElementById('canvas-zone') || document.body;
    if (mountParent.style.position !== 'relative' && mountParent !== document.body) {
      mountParent.style.position = 'relative';
    }
    mountParent.appendChild(overlay);
    buildTabs();
    initAnnoCanvas();

    // Resize canvas on window resize
    window.addEventListener('resize', () => {
      if (visible) setTimeout(render, 100);
    });

    return overlay;
  }

  // ════════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════════
  const TABS = [
    { id:'line',      label:'📈 Line Graph' },
    { id:'bar',       label:'📊 Bar Chart'  },
    { id:'pie',       label:'🥧 Pie Chart'  },
    { id:'scatter',   label:'⚬ Scatter'     },
    { id:'histogram', label:'▦ Histogram'   },
    { id:'stats',     label:'∑ Statistics'  },
  ];

  function buildTabs() {
    const bar = document.getElementById('graph-tabs');
    if (!bar) return;
    bar.innerHTML = '';
    TABS.forEach(t => {
      const btn = document.createElement('button');
      btn.dataset.tab = t.id;
      btn.textContent = t.label;
      btn.style.cssText = `
        padding:10px 18px;border:none;border-bottom:2px solid transparent;
        background:transparent;color:rgba(255,255,255,.5);
        font-size:12.5px;font-weight:500;cursor:pointer;
        white-space:nowrap;flex-shrink:0;
        transition:all .15s;touch-action:manipulation;
        font-family:'Segoe UI',sans-serif;
      `;
      btn.addEventListener('click', () => switchTab(t.id));
      bar.appendChild(btn);
    });
  }

  function switchTab(id) {
    activeTab = id;
    // Update tab styles
    document.querySelectorAll('#graph-tabs button').forEach(b => {
      const isActive = b.dataset.tab === id;
      b.style.color       = isActive ? '#e8c96b' : 'rgba(255,255,255,.5)';
      b.style.borderColor = isActive ? '#c9a84c' : 'transparent';
      b.style.background  = isActive ? 'rgba(201,168,76,.1)' : 'transparent';
    });
    buildControls(id);
    render();
  }

  // ════════════════════════════════════════════════════════
  // CONTROLS PANEL
  // ════════════════════════════════════════════════════════
  function buildControls(tab) {
    const panel = document.getElementById('graph-controls');
    if (!panel) return;

    const css = `
      <style>
        .gc-section { margin-bottom:14px }
        .gc-label { font-size:9.5px;font-weight:700;letter-spacing:.14em;
          text-transform:uppercase;color:#c9a84c;opacity:.75;margin-bottom:6px;display:block }
        .gc-input { width:100%;background:rgba(255,255,255,.07);border:1.5px solid rgba(201,168,76,.3);
          border-radius:6px;color:#fff;font-size:12px;font-family:'Consolas',monospace;
          padding:7px 9px;outline:none;box-sizing:border-box;resize:vertical }
        .gc-input:focus { border-color:#c9a84c;background:rgba(201,168,76,.08) }
        .gc-row { display:flex;align-items:center;gap:7px;margin-bottom:6px }
        .gc-row label { font-size:11px;color:rgba(255,255,255,.65);min-width:80px }
        .gc-row input[type=text],.gc-row input[type=number] {
          flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(201,168,76,.28);
          border-radius:5px;color:#fff;font-size:12px;font-family:'Consolas',monospace;
          padding:5px 8px;outline:none }
        .gc-row input:focus { border-color:#c9a84c }
        .gc-row input[type=color] { width:32px;height:26px;border-radius:4px;
          border:1px solid rgba(201,168,76,.3);background:none;cursor:pointer;padding:1px }
        .gc-checkbox { display:flex;align-items:center;gap:7px;margin-bottom:5px;cursor:pointer }
        .gc-checkbox input { width:16px;height:16px;cursor:pointer;accent-color:#c9a84c }
        .gc-checkbox span { font-size:12px;color:rgba(255,255,255,.7) }
        .gc-btn { width:100%;padding:9px;border-radius:6px;border:1px solid rgba(201,168,76,.4);
          background:rgba(201,168,76,.12);color:#e8c96b;font-size:12px;font-weight:600;
          cursor:pointer;margin-top:6px;font-family:'Segoe UI',sans-serif;touch-action:manipulation }
        .gc-btn:hover,.gc-btn:active { background:rgba(201,168,76,.25) }
        .gc-btn-sm { padding:5px 10px;border-radius:5px;border:1px solid rgba(201,168,76,.3);
          background:rgba(201,168,76,.08);color:#e8c96b;font-size:11px;cursor:pointer;
          font-family:'Segoe UI',sans-serif;touch-action:manipulation }
        .gc-btn-sm:hover { background:rgba(201,168,76,.2) }
        .gc-dataset { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
          border-radius:8px;padding:10px;margin-bottom:8px }
      </style>
    `;

    let html = css;

    switch(tab) {

      case 'line':
        html += `
          <div class="gc-section">
            <span class="gc-label">Chart Title</span>
            <input class="gc-input" id="gc-line-title" value="${state.line.title}" oninput="GraphEngine.updateField('line','title',this.value)">
          </div>
          <div class="gc-section">
            <span class="gc-label">Axis Labels</span>
            <div class="gc-row"><label>X Label</label><input type="text" id="gc-line-xl" value="${state.line.xLabel}" oninput="GraphEngine.updateField('line','xLabel',this.value)"></div>
            <div class="gc-row"><label>Y Label</label><input type="text" id="gc-line-yl" value="${state.line.yLabel}" oninput="GraphEngine.updateField('line','yLabel',this.value)"></div>
          </div>
          <div class="gc-section">
            <span class="gc-label">Options</span>
            <label class="gc-checkbox"><input type="checkbox" ${state.line.showGrid?'checked':''} onchange="GraphEngine.updateField('line','showGrid',this.checked)"><span>Show Grid</span></label>
            <label class="gc-checkbox"><input type="checkbox" ${state.line.showPoints?'checked':''} onchange="GraphEngine.updateField('line','showPoints',this.checked)"><span>Show Points</span></label>
            <label class="gc-checkbox"><input type="checkbox" ${state.line.smooth?'checked':''} onchange="GraphEngine.updateField('line','smooth',this.checked)"><span>Smooth Curve</span></label>
          </div>
          <div class="gc-section">
            <span class="gc-label">Datasets</span>
            ${state.line.datasets.map((ds,i) => `
              <div class="gc-dataset">
                <div class="gc-row">
                  <label>Label</label>
                  <input type="text" value="${ds.label}" oninput="GraphEngine.updateDataset('line',${i},'label',this.value)">
                  <input type="color" value="${ds.color}" onchange="GraphEngine.updateDataset('line',${i},'color',this.value)">
                </div>
                <div class="gc-row"><label>Points (x,y)</label></div>
                <textarea class="gc-input" rows="4" oninput="GraphEngine.updatePoints('line',${i},this.value)">${ds.points.map(p=>`${p.x},${p.y}`).join('\n')}</textarea>
              </div>
            `).join('')}
            <button class="gc-btn-sm" onclick="GraphEngine.addDataset('line')">＋ Add Series</button>
          </div>`;
        break;

      case 'bar':
        html += `
          <div class="gc-section">
            <span class="gc-label">Chart Title</span>
            <input class="gc-input" id="gc-bar-title" value="${state.bar.title}" oninput="GraphEngine.updateField('bar','title',this.value)">
          </div>
          <div class="gc-section">
            <span class="gc-label">Labels (comma separated)</span>
            <input class="gc-input" id="gc-bar-labels" value="${state.bar.labels.join(',')}" oninput="GraphEngine.updateBarLabels(this.value)">
          </div>
          ${state.bar.datasets.map((ds,i) => `
            <div class="gc-section gc-dataset">
              <div class="gc-row">
                <label>Series ${i+1}</label>
                <input type="text" value="${ds.label}" oninput="GraphEngine.updateDataset('bar',${i},'label',this.value)">
                <input type="color" value="${ds.color}" onchange="GraphEngine.updateDataset('bar',${i},'color',this.value)">
              </div>
              <span class="gc-label">Values (comma separated)</span>
              <input class="gc-input" value="${ds.values.join(',')}" oninput="GraphEngine.updateBarValues(${i},this.value)">
            </div>
          `).join('')}
          <button class="gc-btn-sm" onclick="GraphEngine.addDataset('bar')">＋ Add Series</button>`;
        break;

      case 'pie':
        html += `
          <div class="gc-section">
            <span class="gc-label">Chart Title</span>
            <input class="gc-input" value="${state.pie.title}" oninput="GraphEngine.updateField('pie','title',this.value)">
          </div>
          <label class="gc-checkbox" style="margin-bottom:10px">
            <input type="checkbox" ${state.pie.donut?'checked':''} onchange="GraphEngine.updateField('pie','donut',this.checked)">
            <span>Donut style</span>
          </label>
          <div class="gc-section">
            <span class="gc-label">Categories &amp; Values</span>
            <span style="font-size:10px;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">One per line: Label, Value</span>
            <textarea class="gc-input" rows="8" oninput="GraphEngine.updatePieData(this.value)">${state.pie.labels.map((l,i)=>`${l}, ${state.pie.values[i]}`).join('\n')}</textarea>
          </div>`;
        break;

      case 'scatter':
        html += `
          <div class="gc-section">
            <span class="gc-label">Chart Title</span>
            <input class="gc-input" value="${state.scatter.title}" oninput="GraphEngine.updateField('scatter','title',this.value)">
          </div>
          <div class="gc-section">
            <span class="gc-label">Axis Labels</span>
            <div class="gc-row"><label>X Label</label><input type="text" value="${state.scatter.xLabel}" oninput="GraphEngine.updateField('scatter','xLabel',this.value)"></div>
            <div class="gc-row"><label>Y Label</label><input type="text" value="${state.scatter.yLabel}" oninput="GraphEngine.updateField('scatter','yLabel',this.value)"></div>
          </div>
          <label class="gc-checkbox" style="margin-bottom:10px">
            <input type="checkbox" ${state.scatter.showTrendline?'checked':''} onchange="GraphEngine.updateField('scatter','showTrendline',this.checked)">
            <span>Show Trendline</span>
          </label>
          ${state.scatter.datasets.map((ds,i) => `
            <div class="gc-dataset">
              <div class="gc-row">
                <label>Group ${i+1}</label>
                <input type="text" value="${ds.label}" oninput="GraphEngine.updateDataset('scatter',${i},'label',this.value)">
                <input type="color" value="${ds.color}" onchange="GraphEngine.updateDataset('scatter',${i},'color',this.value)">
              </div>
              <span class="gc-label" style="font-size:9px">Points: x,y per line</span>
              <textarea class="gc-input" rows="5" oninput="GraphEngine.updatePoints('scatter',${i},this.value)">${ds.points.map(p=>`${p.x},${p.y}`).join('\n')}</textarea>
            </div>
          `).join('')}
          <button class="gc-btn-sm" onclick="GraphEngine.addDataset('scatter')">＋ Add Group</button>`;
        break;

      case 'histogram':
        html += `
          <div class="gc-section">
            <span class="gc-label">Raw Data (comma separated)</span>
            <textarea class="gc-input" rows="5" oninput="GraphEngine.updateField('histogram','rawData',this.value)">${state.histogram.rawData}</textarea>
          </div>
          <div class="gc-section">
            <div class="gc-row"><label>No. of Bins</label><input type="number" min="2" max="20" value="${state.histogram.bins}" oninput="GraphEngine.updateField('histogram','bins',parseInt(this.value)||5)"></div>
            <div class="gc-row"><label>X Label</label><input type="text" value="${state.histogram.xLabel}" oninput="GraphEngine.updateField('histogram','xLabel',this.value)"></div>
            <div class="gc-row"><label>Y Label</label><input type="text" value="${state.histogram.yLabel}" oninput="GraphEngine.updateField('histogram','yLabel',this.value)"></div>
          </div>
          <div id="histogram-stats" style="margin-top:10px;padding:10px;background:rgba(201,168,76,.06);
            border:1px solid rgba(201,168,76,.2);border-radius:8px;font-size:11px;
            font-family:'Consolas',monospace;color:rgba(255,255,255,.7);line-height:1.9"></div>`;
        break;

      case 'stats':
        html += `
          <div class="gc-section">
            <span class="gc-label">Raw Data (comma separated)</span>
            <textarea class="gc-input" rows="5" oninput="GraphEngine.updateField('stats','data',this.value)">${state.stats.data}</textarea>
          </div>
          <div class="gc-section">
            <span class="gc-label">Grouped Data (for mean/median)</span>
            <span style="font-size:10px;color:rgba(255,255,255,.4);display:block;margin-bottom:4px">Format: 10-20:5, 20-30:8, ...</span>
            <textarea class="gc-input" rows="4" oninput="GraphEngine.updateField('stats','groupedData',this.value)">${state.stats.groupedData}</textarea>
          </div>
          <button class="gc-btn" onclick="GraphEngine.render()">Recalculate</button>`;
        break;
    }

    panel.innerHTML = html;
  }

  // ════════════════════════════════════════════════════════
  // STATE UPDATERS
  // ════════════════════════════════════════════════════════
  function updateField(tab, key, val) {
    state[tab][key] = val;
    render();
  }

  function updateDataset(tab, i, key, val) {
    if (state[tab].datasets && state[tab].datasets[i]) {
      state[tab].datasets[i][key] = val;
      render();
    }
  }

  function updatePoints(tab, i, raw) {
    try {
      const pts = raw.trim().split('\n').map(line => {
        const [x, y] = line.split(',').map(Number);
        return (!isNaN(x) && !isNaN(y)) ? {x, y} : null;
      }).filter(Boolean);
      if (pts.length > 0) {
        state[tab].datasets[i].points = pts;
        render();
      }
    } catch(e) {}
  }

  function updateBarLabels(raw) {
    state.bar.labels = raw.split(',').map(s => s.trim());
    render();
  }

  function updateBarValues(i, raw) {
    try {
      const vals = raw.split(',').map(Number).filter(n => !isNaN(n));
      if (vals.length > 0) { state.bar.datasets[i].values = vals; render(); }
    } catch(e) {}
  }

  function updatePieData(raw) {
    const labels = [], values = [];
    raw.trim().split('\n').forEach(line => {
      const parts = line.split(',');
      if (parts.length >= 2) {
        labels.push(parts[0].trim());
        values.push(parseFloat(parts[1]) || 0);
      }
    });
    if (labels.length) { state.pie.labels = labels; state.pie.values = values; render(); }
  }

  function addDataset(tab) {
    const n = (state[tab].datasets||[]).length + 1;
    const color = COLORS[(n-1) % COLORS.length];
    if (tab === 'line' || tab === 'scatter') {
      state[tab].datasets.push({ label:`Series ${n}`, color, points:[{x:1,y:2},{x:2,y:4},{x:3,y:3}] });
    } else if (tab === 'bar') {
      state.bar.datasets.push({ label:`Series ${n}`, color, values:state.bar.labels.map(()=>Math.floor(Math.random()*15+3)) });
    }
    buildControls(tab);
    render();
  }

  // ════════════════════════════════════════════════════════
  // RENDER DISPATCHER
  // ════════════════════════════════════════════════════════
  function render() {
    const canvas = document.getElementById('graph-canvas');
    if (!canvas) return;
    const wrap = document.getElementById('graph-canvas-wrap');
    if (wrap) {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w > 0 && h > 0) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        if (annoCanvas && (annoCanvas.width !== w || annoCanvas.height !== h)) {
          const temp = document.createElement('canvas');
          temp.width = annoCanvas.width;
          temp.height = annoCanvas.height;
          const tCtx = temp.getContext('2d');
          if (annoCanvas.width > 0) tCtx.drawImage(annoCanvas, 0, 0);

          annoCanvas.width = w;
          annoCanvas.height = h;

          if (temp.width > 0 && annoCtx) {
            annoCtx.drawImage(temp, 0, 0);
          }
        }
      }
    } else {
      const container = canvas.parentElement;
      canvas.width  = container.clientWidth - 32;
      canvas.height = container.clientHeight - 32 - (document.getElementById('graph-stats-row')?.offsetHeight || 0) - 20;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch(activeTab) {
      case 'line':      renderLine(ctx, canvas); break;
      case 'bar':       renderBar(ctx, canvas);  break;
      case 'pie':       renderPie(ctx, canvas);  break;
      case 'scatter':   renderScatter(ctx, canvas); break;
      case 'histogram': renderHistogram(ctx, canvas); break;
      case 'stats':     renderStats(ctx, canvas); break;
    }
  }

  // ════════════════════════════════════════════════════════
  // SHARED DRAWING HELPERS
  // ════════════════════════════════════════════════════════
  const PAD = { top:50, right:30, bottom:60, left:65 };

  function drawAxes(ctx, W, H, xLabel, yLabel, title) {
    const { top:T, right:R, bottom:B, left:L } = PAD;
    const cW = W - L - R, cH = H - T - B;

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(L, T, cW, cH);

    // Title
    if (title) {
      ctx.font = '600 14px Segoe UI, sans-serif';
      ctx.fillStyle = '#e8c96b';
      ctx.textAlign = 'center';
      ctx.fillText(title, W/2, T - 18);
    }

    // Axis lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L, T); ctx.lineTo(L, T + cH);
    ctx.lineTo(L + cW, T + cH);
    ctx.stroke();

    // Axis labels
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel || '', W/2, H - 6);

    ctx.save();
    ctx.translate(14, T + cH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText(yLabel || '', 0, 0);
    ctx.restore();

    ctx.restore();
    return { x:L, y:T, w:cW, h:cH };
  }

  function drawGrid(ctx, area, xSteps, ySteps, xMin, xMax, yMin, yMax) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

    for (let i = 0; i <= xSteps; i++) {
      const x = area.x + (i / xSteps) * area.w;
      ctx.beginPath(); ctx.moveTo(x, area.y); ctx.lineTo(x, area.y + area.h); ctx.stroke();
      const val = xMin + (i / xSteps) * (xMax - xMin);
      ctx.font = '10px Consolas, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.setLineDash([]);
      ctx.fillText(+val.toFixed(1), x, area.y + area.h + 16);
      ctx.setLineDash([3,4]);
    }

    for (let i = 0; i <= ySteps; i++) {
      const y = area.y + area.h - (i / ySteps) * area.h;
      ctx.beginPath(); ctx.moveTo(area.x, y); ctx.lineTo(area.x + area.w, y); ctx.stroke();
      const val = yMin + (i / ySteps) * (yMax - yMin);
      ctx.font = '10px Consolas, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'right';
      ctx.setLineDash([]);
      ctx.fillText(+val.toFixed(1), area.x - 6, y + 4);
      ctx.setLineDash([3,4]);
    }

    ctx.restore();
  }

  function toCanvasX(val, min, max, area) { return area.x + ((val - min) / (max - min)) * area.w; }
  function toCanvasY(val, min, max, area) { return area.y + area.h - ((val - min) / (max - min)) * area.h; }

  function drawLegend(ctx, datasets, W, H) {
    const items = datasets;
    let lx = PAD.left;
    const ly = H - 12;
    ctx.font = '11px Segoe UI, sans-serif';
    items.forEach(ds => {
      ctx.fillStyle = ds.color;
      ctx.fillRect(lx, ly - 8, 14, 8);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.textAlign = 'left';
      ctx.fillText(ds.label, lx + 18, ly);
      lx += ctx.measureText(ds.label).width + 36;
    });
  }

  // ════════════════════════════════════════════════════════
  // LINE GRAPH
  // ════════════════════════════════════════════════════════
  function renderLine(ctx, canvas) {
    const s = state.line;
    const W = canvas.width, H = canvas.height;

    const allX = s.datasets.flatMap(d => d.points.map(p => p.x));
    const allY = s.datasets.flatMap(d => d.points.map(p => p.y));
    const xMin = Math.min(...allX), xMax = Math.max(...allX);
    const yMin = 0, yMax = Math.max(...allY) * 1.15;

    const area = drawAxes(ctx, W, H, s.xLabel, s.yLabel, s.title);

    if (s.showGrid) drawGrid(ctx, area, 6, 5, xMin, xMax, yMin, yMax);

    s.datasets.forEach(ds => {
      if (!ds.points.length) return;
      const sorted = [...ds.points].sort((a,b) => a.x - b.x);

      ctx.save();
      ctx.strokeStyle = ds.color;
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.shadowColor = ds.color;
      ctx.shadowBlur  = 6;

      // Fill area under line
      ctx.beginPath();
      sorted.forEach((p, i) => {
        const cx = toCanvasX(p.x, xMin, xMax, area);
        const cy = toCanvasY(p.y, yMin, yMax, area);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      });
      const grad = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
      grad.addColorStop(0, ds.color + '40');
      grad.addColorStop(1, ds.color + '05');
      ctx.lineTo(toCanvasX(sorted[sorted.length-1].x, xMin, xMax, area), area.y + area.h);
      ctx.lineTo(toCanvasX(sorted[0].x, xMin, xMax, area), area.y + area.h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.shadowBlur = 0;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.shadowBlur = 6;
      if (s.smooth && sorted.length > 2) {
        ctx.moveTo(toCanvasX(sorted[0].x,xMin,xMax,area), toCanvasY(sorted[0].y,yMin,yMax,area));
        for (let i = 1; i < sorted.length - 1; i++) {
          const cx1 = toCanvasX((sorted[i-1].x+sorted[i].x)/2, xMin,xMax,area);
          const cy1 = toCanvasY((sorted[i-1].y+sorted[i].y)/2, yMin,yMax,area);
          const cx2 = toCanvasX((sorted[i].x+sorted[i+1].x)/2, xMin,xMax,area);
          const cy2 = toCanvasY((sorted[i].y+sorted[i+1].y)/2, yMin,yMax,area);
          ctx.quadraticCurveTo(toCanvasX(sorted[i].x,xMin,xMax,area), toCanvasY(sorted[i].y,yMin,yMax,area), (cx2+cx1)/2, (cy2+cy1)/2);
        }
      } else {
        sorted.forEach((p, i) => {
          const cx = toCanvasX(p.x, xMin, xMax, area);
          const cy = toCanvasY(p.y, yMin, yMax, area);
          i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
        });
      }
      ctx.stroke();

      // Points
      if (s.showPoints) {
        sorted.forEach(p => {
          const cx = toCanvasX(p.x, xMin, xMax, area);
          const cy = toCanvasY(p.y, yMin, yMax, area);
          ctx.shadowBlur = 8;
          ctx.fillStyle  = ds.color;
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle  = '#fff';
          ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI*2); ctx.fill();
          // Value label
          ctx.fillStyle  = 'rgba(255,255,255,0.8)';
          ctx.font       = '10px Consolas, monospace';
          ctx.textAlign  = 'center';
          ctx.fillText(p.y, cx, cy - 10);
        });
      }
      ctx.restore();
    });

    drawLegend(ctx, s.datasets, W, H);
  }

  // ════════════════════════════════════════════════════════
  // BAR CHART
  // ════════════════════════════════════════════════════════
  function renderBar(ctx, canvas) {
    const s = state.bar;
    const W = canvas.width, H = canvas.height;
    const allVals = s.datasets.flatMap(d => d.values);
    const yMax = Math.max(...allVals) * 1.2 || 10;
    const area  = drawAxes(ctx, W, H, s.xLabel, s.yLabel, s.title);
    drawGrid(ctx, area, s.labels.length, 5, 0, s.labels.length, 0, yMax);

    const nGroups  = s.labels.length;
    const nSeries  = s.datasets.length;
    const groupW   = area.w / nGroups;
    const barW     = Math.min((groupW * 0.8) / nSeries, 60);
    const groupGap = (groupW - barW * nSeries) / 2;

    s.datasets.forEach((ds, si) => {
      ds.values.forEach((val, gi) => {
        if (gi >= nGroups) return;
        const bH  = (val / yMax) * area.h;
        const bX  = area.x + gi * groupW + groupGap + si * barW;
        const bY  = area.y + area.h - bH;

        const grad = ctx.createLinearGradient(bX, bY, bX, area.y + area.h);
        grad.addColorStop(0, ds.color);
        grad.addColorStop(1, ds.color + '88');
        ctx.fillStyle = grad;

        // Rounded top bar
        ctx.beginPath();
        const r = Math.min(4, barW/3);
        ctx.moveTo(bX + r, bY);
        ctx.lineTo(bX + barW - r, bY);
        ctx.arcTo(bX + barW, bY, bX + barW, bY + r, r);
        ctx.lineTo(bX + barW, area.y + area.h);
        ctx.lineTo(bX, area.y + area.h);
        ctx.lineTo(bX, bY + r);
        ctx.arcTo(bX, bY, bX + r, bY, r);
        ctx.closePath();
        ctx.fill();

        // Value label on top
        ctx.fillStyle  = 'rgba(255,255,255,0.8)';
        ctx.font       = '10px Consolas, monospace';
        ctx.textAlign  = 'center';
        ctx.fillText(val, bX + barW/2, bY - 4);
      });
    });

    // X-axis category labels
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    s.labels.forEach((lbl, i) => {
      ctx.fillText(lbl, area.x + i * groupW + groupW/2, area.y + area.h + 18);
    });

    // Y-axis value labels
    for (let i = 0; i <= 5; i++) {
      const y = area.y + area.h - (i/5) * area.h;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'right';
      ctx.font = '10px Consolas, monospace';
      ctx.fillText(+(i/5*yMax).toFixed(1), area.x - 6, y + 4);
    }

    drawLegend(ctx, s.datasets, W, H);
  }

  // ════════════════════════════════════════════════════════
  // PIE / DONUT CHART
  // ════════════════════════════════════════════════════════
  function renderPie(ctx, canvas) {
    const s   = state.pie;
    const W   = canvas.width, H = canvas.height;
    const cx  = W/2, cy  = H/2 - 10;
    const r   = Math.min(W, H) * 0.33;
    const ir  = s.donut ? r * 0.5 : 0;
    const total = s.values.reduce((a,b) => a+b, 0) || 1;

    // Title
    ctx.font = '600 14px Segoe UI, sans-serif';
    ctx.fillStyle = '#e8c96b';
    ctx.textAlign = 'center';
    ctx.fillText(s.title, W/2, 28);

    let startAngle = -Math.PI/2;
    s.values.forEach((val, i) => {
      const slice = (val / total) * 2 * Math.PI;
      const color = COLORS[i % COLORS.length];
      const mid   = startAngle + slice/2;

      // Slight explode
      const explode = 4;
      const ox = Math.cos(mid) * explode;
      const oy = Math.sin(mid) * explode;

      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy);
      ctx.arc(cx + ox, cy + oy, r, startAngle, startAngle + slice);
      if (ir > 0) ctx.arc(cx + ox, cy + oy, ir, startAngle + slice, startAngle, true);
      else ctx.lineTo(cx + ox, cy + oy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(5,10,20,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Percentage label
      const labelR = r * (s.donut ? 0.75 : 0.65);
      const lx = cx + ox + Math.cos(mid) * labelR;
      const ly = cy + oy + Math.sin(mid) * labelR;
      const pct = (val/total*100).toFixed(1);
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (slice > 0.2) ctx.fillText(`${pct}%`, lx, ly);
      ctx.textBaseline = 'alphabetic';

      startAngle += slice;
    });

    // Donut centre text
    if (s.donut) {
      ctx.fillStyle = '#e8c96b';
      ctx.font = '700 18px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total, cx, cy);
      ctx.font = '11px Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillText('Total', cx, cy + 18);
      ctx.textBaseline = 'alphabetic';
    }

    // Legend
    const legendY = H - 20;
    let lx = 20;
    s.labels.forEach((lbl, i) => {
      const color = COLORS[i % COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(lx, legendY - 10, 12, 10);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.font = '11px Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${lbl} (${s.values[i]})`, lx + 16, legendY);
      lx += ctx.measureText(`${lbl} (${s.values[i]})`).width + 32;
      if (lx > W - 80) lx = 20;
    });
  }

  // ════════════════════════════════════════════════════════
  // SCATTER PLOT
  // ════════════════════════════════════════════════════════
  function renderScatter(ctx, canvas) {
    const s = state.scatter;
    const W = canvas.width, H = canvas.height;
    const allX = s.datasets.flatMap(d => d.points.map(p => p.x));
    const allY = s.datasets.flatMap(d => d.points.map(p => p.y));
    const xMin = Math.min(...allX)*0.9, xMax = Math.max(...allX)*1.1;
    const yMin = 0, yMax = Math.max(...allY)*1.15;
    const area = drawAxes(ctx, W, H, s.xLabel, s.yLabel, s.title);
    drawGrid(ctx, area, 6, 5, xMin, xMax, yMin, yMax);

    s.datasets.forEach(ds => {
      // Trendline (linear regression)
      if (s.showTrendline && ds.points.length > 1) {
        const n  = ds.points.length;
        const sx = ds.points.reduce((a,p) => a+p.x, 0);
        const sy = ds.points.reduce((a,p) => a+p.y, 0);
        const sx2= ds.points.reduce((a,p) => a+p.x*p.x, 0);
        const sxy= ds.points.reduce((a,p) => a+p.x*p.y, 0);
        const m  = (n*sxy - sx*sy) / (n*sx2 - sx*sx);
        const b  = (sy - m*sx) / n;
        ctx.save();
        ctx.strokeStyle = ds.color + 'aa';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6,4]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(xMin,xMin,xMax,area), toCanvasY(m*xMin+b,yMin,yMax,area));
        ctx.lineTo(toCanvasX(xMax,xMin,xMax,area), toCanvasY(m*xMax+b,yMin,yMax,area));
        ctx.stroke();
        ctx.restore();
        // R² label
        const ss_tot = ds.points.reduce((a,p) => a+(p.y-sy/n)**2, 0);
        const ss_res = ds.points.reduce((a,p) => a+(p.y-(m*p.x+b))**2, 0);
        const r2 = 1 - ss_res/ss_tot;
        ctx.font = '10px Consolas, monospace';
        ctx.fillStyle = ds.color;
        ctx.textAlign = 'right';
        ctx.fillText(`R²=${r2.toFixed(3)}  y=${m.toFixed(2)}x+${b.toFixed(2)}`, area.x+area.w, area.y+12);
      }

      // Points
      ds.points.forEach(p => {
        const cx2 = toCanvasX(p.x, xMin, xMax, area);
        const cy2 = toCanvasY(p.y, yMin, yMax, area);
        ctx.fillStyle = ds.color;
        ctx.shadowColor = ds.color;
        ctx.shadowBlur  = 6;
        ctx.beginPath(); ctx.arc(cx2, cy2, 6, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#fff';
        ctx.beginPath(); ctx.arc(cx2, cy2, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle  = 'rgba(255,255,255,.65)';
        ctx.font = '9px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`(${p.x},${p.y})`, cx2, cy2 - 10);
      });
    });

    drawLegend(ctx, s.datasets, W, H);
  }

  // ════════════════════════════════════════════════════════
  // HISTOGRAM
  // ════════════════════════════════════════════════════════
  function renderHistogram(ctx, canvas) {
    const s = state.histogram;
    const W = canvas.width, H = canvas.height;

    const raw  = s.rawData.split(',').map(Number).filter(n => !isNaN(n));
    if (!raw.length) return;

    const mn   = Math.min(...raw), mx = Math.max(...raw);
    const binW = (mx - mn) / s.bins;
    const bins = Array(s.bins).fill(0);
    raw.forEach(v => {
      const i = Math.min(Math.floor((v - mn) / binW), s.bins - 1);
      bins[i]++;
    });

    const yMax = Math.max(...bins) * 1.2 || 1;
    const area = drawAxes(ctx, W, H, s.xLabel, s.yLabel, s.title);
    drawGrid(ctx, area, s.bins, 5, 0, s.bins, 0, yMax);

    const bW = area.w / s.bins;
    bins.forEach((freq, i) => {
      const bH  = (freq / yMax) * area.h;
      const bX  = area.x + i * bW;
      const bY  = area.y + area.h - bH;
      const hue = 200 + i * (60/s.bins);

      const grad = ctx.createLinearGradient(bX, bY, bX, area.y + area.h);
      grad.addColorStop(0, `hsla(${hue},75%,60%,0.9)`);
      grad.addColorStop(1, `hsla(${hue},75%,40%,0.5)`);
      ctx.fillStyle = grad;
      ctx.fillRect(bX + 1, bY, bW - 2, bH);

      // Frequency label
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = '11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(freq, bX + bW/2, bY - 4);

      // Interval label
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = '9.5px Consolas, monospace';
      ctx.fillText(`${(mn+i*binW).toFixed(1)}-${(mn+(i+1)*binW).toFixed(1)}`, bX + bW/2, area.y + area.h + 18);
    });

    // Stats panel
    const mean   = raw.reduce((a,b)=>a+b,0)/raw.length;
    const sorted = [...raw].sort((a,b)=>a-b);
    const median = sorted.length%2===0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)];
    const sd     = Math.sqrt(raw.reduce((a,b)=>a+(b-mean)**2,0)/raw.length);
    const statsEl = document.getElementById('histogram-stats');
    if (statsEl) statsEl.innerHTML =
      `n = ${raw.length}  |  Min = ${mn}  |  Max = ${mx}  |  Mean = ${mean.toFixed(3)}  |  Median = ${median}  |  SD = ${sd.toFixed(3)}`;
  }

  // ════════════════════════════════════════════════════════
  // STATISTICS DASHBOARD
  // ════════════════════════════════════════════════════════
  function renderStats(ctx, canvas) {
    const s = state.stats;
    const W = canvas.width, H = canvas.height;

    const raw    = s.data.split(',').map(Number).filter(n => !isNaN(n));
    if (!raw.length) return;

    const sorted = [...raw].sort((a,b) => a-b);
    const n      = raw.length;
    const sum    = raw.reduce((a,b) => a+b, 0);
    const mean   = sum / n;
    const mid    = Math.floor(n/2);
    const median = n%2===0 ? (sorted[mid-1]+sorted[mid])/2 : sorted[mid];
    const freq   = {};
    raw.forEach(v => freq[v] = (freq[v]||0)+1);
    const maxF   = Math.max(...Object.values(freq));
    const mode   = Object.keys(freq).filter(k => freq[k]===maxF).map(Number);
    const range  = sorted[n-1] - sorted[0];
    const vari   = raw.reduce((a,b) => a+(b-mean)**2, 0) / n;
    const sd     = Math.sqrt(vari);
    const q1     = sorted[Math.floor(n/4)];
    const q3     = sorted[Math.floor(3*n/4)];

    // Stats cards
    const CARDS = [
      { label:'Count (n)',    val: n,               color:'#4e9af1' },
      { label:'Sum',         val: sum.toFixed(2),   color:'#f1a94e' },
      { label:'Mean (x̄)',    val: mean.toFixed(4),  color:'#4ef17a' },
      { label:'Median',      val: median,           color:'#f14e8a' },
      { label:'Mode',        val: mode.join(', '),  color:'#a94ef1' },
      { label:'Range',       val: range,            color:'#4ef1e8' },
      { label:'Variance',    val: vari.toFixed(4),  color:'#f1e84e' },
      { label:'Std Dev (σ)', val: sd.toFixed(4),    color:'#f14e4e' },
      { label:'Q1',          val: q1,               color:'#4e9af1' },
      { label:'Q3',          val: q3,               color:'#f1a94e' },
      { label:'IQR',         val: q3-q1,            color:'#4ef17a' },
      { label:'Min',         val: sorted[0],        color:'#4ef1e8' },
      { label:'Max',         val: sorted[n-1],      color:'#f14e8a' },
    ];

    const cols = 4;
    const cardW = W / cols - 12;
    const cardH = 56;
    const startY = 40;

    ctx.font = '600 14px Segoe UI, sans-serif';
    ctx.fillStyle = '#e8c96b';
    ctx.textAlign = 'center';
    ctx.fillText('Statistics Dashboard', W/2, 22);

    CARDS.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx  = col * (cardW + 12) + 6;
      const cy  = startY + row * (cardH + 8);

      // Card background
      ctx.fillStyle = card.color + '18';
      ctx.strokeStyle = card.color + '55';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 7);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill(); ctx.stroke();

      // Label
      ctx.fillStyle = card.color;
      ctx.font = '600 10px Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card.label, cx+10, cy+16);

      // Value
      ctx.fillStyle = '#fff';
      ctx.font = '700 18px Consolas, monospace';
      ctx.fillText(String(card.val), cx+10, cy+42);
    });

    // Box plot
    const bpY  = startY + Math.ceil(CARDS.length/cols) * (cardH+8) + 20;
    const bpH  = Math.min(60, H - bpY - 40);
    if (bpY + bpH + 30 < H) {
      const bpMn = sorted[0], bpMx = sorted[n-1];
      const bpRange = bpMx - bpMn || 1;
      const toX = v => 40 + ((v-bpMn)/bpRange) * (W-80);
      const midY = bpY + bpH/2;

      ctx.fillStyle = 'rgba(201,168,76,0.6)';
      ctx.font = '600 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Box & Whisker Plot', W/2, bpY-6);

      ctx.strokeStyle = '#4e9af1';
      ctx.lineWidth = 2;
      // Whiskers
      ctx.beginPath(); ctx.moveTo(toX(bpMn),midY); ctx.lineTo(toX(q1),midY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(q3),midY); ctx.lineTo(toX(bpMx),midY); ctx.stroke();
      // Whisker ends
      [bpMn,bpMx].forEach(v => {
        ctx.beginPath();
        ctx.moveTo(toX(v),midY-8); ctx.lineTo(toX(v),midY+8); ctx.stroke();
      });
      // IQR box
      ctx.fillStyle = 'rgba(78,154,241,0.25)';
      ctx.fillRect(toX(q1), midY-bpH/2, toX(q3)-toX(q1), bpH);
      ctx.strokeRect(toX(q1), midY-bpH/2, toX(q3)-toX(q1), bpH);
      // Median line
      ctx.strokeStyle = '#f1a94e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(toX(median),midY-bpH/2); ctx.lineTo(toX(median),midY+bpH/2); ctx.stroke();
      // Labels
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '9px Consolas, monospace';
      [[bpMn,'Min'],[q1,'Q1'],[median,'Med'],[q3,'Q3'],[bpMx,'Max']].forEach(([v,l]) => {
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.textAlign = 'center';
        ctx.fillText(v, toX(v), midY+bpH/2+14);
        ctx.fillStyle = 'rgba(201,168,76,.7)';
        ctx.fillText(l, toX(v), bpY+bpH+28);
      });
    }

    // Update stats row below chart
    const row = document.getElementById('graph-stats-row');
    if (row) {
      row.innerHTML = [
        `Mean = <b style="color:#4ef17a">${mean.toFixed(3)}</b>`,
        `Median = <b style="color:#f14e8a">${median}</b>`,
        `Mode = <b style="color:#a94ef1">${mode.join(', ')}</b>`,
        `SD = <b style="color:#f14e4e">${sd.toFixed(3)}</b>`,
        `IQR = <b style="color:#4ef1e8">${q3-q1}</b>`,
      ].map(t => `<span style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
        border-radius:6px;padding:5px 12px;font-size:12px;color:rgba(255,255,255,.75)">${t}</span>`).join('');
    }
  }

  // ════════════════════════════════════════════════════════
  // ANNOTATION ENGINE & WHITEBOARD STAMP INTEGRATION
  // ════════════════════════════════════════════════════════
  function initAnnoCanvas() {
    annoCanvas = document.getElementById('graph-anno-canvas');
    if (!annoCanvas) return;
    annoCtx = annoCanvas.getContext('2d');

    annoCanvas.addEventListener('pointerdown', onAnnoPointerDown, { passive: false });
    window.addEventListener('pointermove', onAnnoPointerMove, { passive: false });
    window.addEventListener('pointerup', onAnnoPointerUp, { passive: false });
    window.addEventListener('pointercancel', onAnnoPointerUp, { passive: false });
  }

  function getAnnoPos(e) {
    if (!annoCanvas) return { x: 0, y: 0 };
    const rect = annoCanvas.getBoundingClientRect();
    const scaleX = annoCanvas.width / (rect.width || 1);
    const scaleY = annoCanvas.height / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

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
    const existing = document.getElementById('graph-anno-text-input');
    if (existing) existing.remove();

    const rect = annoCanvas.getBoundingClientRect();
    const scaleX = annoCanvas.width / (rect.width || 1);
    const scaleY = annoCanvas.height / (rect.height || 1);

    const input = document.createElement('input');
    input.id = 'graph-anno-text-input';
    input.type = 'text';
    input.placeholder = 'Type graph label or note...';
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

  function onAnnoPointerDown(e) {
    const curTool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    if (drawingMode !== 'draw' && drawingMode !== 'text' && (curTool === 'select' || curTool === 'pointer')) return;

    const pt = getAnnoPos(e);
    if (drawingMode === 'text' || curTool === 'text') {
      addTextAnnotation(pt.x, pt.y);
      e.preventDefault();
      return;
    }

    pushUndoState();
    isAnnoDrawing = true;
    annoPoints = [pt];
    drawAnnoSegment(pt, pt);
    e.preventDefault();
  }

  function onAnnoPointerMove(e) {
    if (!isAnnoDrawing) return;
    const pt = getAnnoPos(e);
    const prev = annoPoints[annoPoints.length - 1];
    annoPoints.push(pt);
    drawAnnoSegment(prev, pt);
    e.preventDefault();
  }

  function onAnnoPointerUp(e) {
    if (!isAnnoDrawing) return;
    isAnnoDrawing = false;
    annoPoints = [];
  }

  function drawAnnoSegment(p1, p2) {
    if (!annoCtx) return;
    const tool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    const color = (typeof App !== 'undefined') ? App.currentColor : '#e8c96b';
    const size = (typeof App !== 'undefined') ? (App.penSize || 3) : 3;
    const eraserSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : 26;

    annoCtx.save();
    if (tool === 'eraser') {
      annoCtx.globalCompositeOperation = 'destination-out';
      annoCtx.lineWidth = eraserSize;
      annoCtx.lineCap = 'round';
      annoCtx.lineJoin = 'round';
      annoCtx.beginPath();
      annoCtx.moveTo(p1.x, p1.y);
      annoCtx.lineTo(p2.x, p2.y);
      annoCtx.stroke();
    } else {
      annoCtx.globalCompositeOperation = 'source-over';
      annoCtx.strokeStyle = color;
      annoCtx.lineWidth = tool === 'highlighter' ? size * 4 : size;
      if (tool === 'highlighter') annoCtx.globalAlpha = 0.4;
      annoCtx.lineCap = 'round';
      annoCtx.lineJoin = 'round';
      annoCtx.beginPath();
      annoCtx.moveTo(p1.x, p1.y);
      annoCtx.lineTo(p2.x, p2.y);
      annoCtx.stroke();
    }
    annoCtx.restore();
  }

  function clearAnnotations() {
    if (annoCtx && annoCanvas) {
      pushUndoState();
      annoCtx.clearRect(0, 0, annoCanvas.width, annoCanvas.height);
    }
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

  function syncToolWithBoard() {
    const curTool = (typeof App !== 'undefined') ? App.currentTool : 'pen';
    if (curTool === 'select' || curTool === 'pointer') {
      drawingMode = 'interact';
      if (annoCanvas) annoCanvas.style.pointerEvents = 'none';
    } else if (curTool === 'text') {
      drawingMode = 'text';
      if (annoCanvas) annoCanvas.style.pointerEvents = 'auto';
    } else {
      drawingMode = 'draw';
      if (annoCanvas) annoCanvas.style.pointerEvents = 'auto';
    }
  }

  function stampToWhiteboard() {
    const canvas = document.getElementById('graph-canvas');
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
      sCtx.fillText(`PiyushDhara EduVerse — Live Graph (${activeTab.toUpperCase()})`, 24, 32);
      const dataUrl = snapCanvas.toDataURL('image/png');

      if (window.Canvas && typeof Canvas.addImageShape === 'function') {
        Canvas.addImageShape(dataUrl, 100, 100, 520, 320, `${activeTab.toUpperCase()} Graph Snapshot`);
        hide();
        if (window.App && typeof App.showToast === 'function') {
          App.showToast('📊 Graph snapshot stamped onto Whiteboard!');
        }
      } else {
        const img = new Image();
        img.onload = () => {
          const drawCtx = Canvas.getDrawCtx();
          drawCtx.drawImage(img, 100, 100, 520, 320);
          hide();
          if (window.App && typeof App.showToast === 'function') {
            App.showToast('📊 Graph snapshot stamped onto Whiteboard!');
          }
        };
        img.src = dataUrl;
      }
    } catch (err) {
      console.error('Failed to stamp graph to board:', err);
    }
  }

  // ════════════════════════════════════════════════════════
  // PUBLIC
  // ════════════════════════════════════════════════════════
  return {
    show, hide, toggle, render, switchTab,
    isVisible,
    undo,
    redo,
    addTextAnnotation,
    updateField, updateDataset, updatePoints,
    updateBarLabels, updateBarValues, updatePieData,
    addDataset,
    setAnnotationMode,
    clearAnnotations,
    syncToolWithBoard,
    stampToWhiteboard
  };
})();
