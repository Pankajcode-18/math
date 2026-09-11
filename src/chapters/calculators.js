'use strict';

// ═══════════════════════════════════════════════
// CHAPTER CALCULATORS — all 14 chapters
// ═══════════════════════════════════════════════

const Calculators = (() => {

  // ── Helper: read input value ──
  const val   = id => parseFloat(document.getElementById(id)?.value) || 0;
  const str   = id => document.getElementById(id)?.value || '';
  const setR  = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  // ══════════════════════════════════════════════
  // CH 1 — SETS
  // ══════════════════════════════════════════════
  // Live update Venn as user types — no button needed
  function vennLive() {
    const aArr = str('set-A').split(',').map(s => s.trim()).filter(Boolean);
    const bArr = str('set-B').split(',').map(s => s.trim()).filter(Boolean);
    drawVenn(aArr, bArr, 'live');
  }

  function setsCalc(op) {
    const aArr = str('set-A').split(',').map(s => s.trim()).filter(Boolean);
    const bArr = str('set-B').split(',').map(s => s.trim()).filter(Boolean);
    if (!aArr.length && !bArr.length) {
      setR('set-result', '⚠ Enter values in Set A and Set B first');
      return;
    }
    const A = new Set(aArr), B = new Set(bArr);

    let result, label;
    switch (op) {
      case 'union': result = [...new Set([...aArr, ...bArr])]; label = 'A ∪ B'; break;
      case 'inter': result = aArr.filter(x => B.has(x));       label = 'A ∩ B'; break;
      case 'diff':  result = aArr.filter(x => !B.has(x));      label = 'A − B'; break;
      case 'diffs': result = bArr.filter(x => !A.has(x));      label = 'B − A'; break;
      case 'sym':   result = [...aArr.filter(x => !B.has(x)), ...bArr.filter(x => !A.has(x))]; label = 'A △ B'; break;
    }
    const display = result.length ? `{ ${result.join(', ')} }` : '∅  (empty set)';
    setR('set-result',
      `<b>${label}</b> = ${display}<br>` +
      `n(${label}) = <b>${result.length}</b>`);
    drawVenn(aArr, bArr, op);
  }

  function drawVenn(A, B, op) {
    const c = document.getElementById('venn-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);

    const bSet  = new Set(B), aSet = new Set(A);
    const onlyA = A.filter(x => !bSet.has(x));
    const inter  = A.filter(x => bSet.has(x));
    const onlyB  = B.filter(x => !aSet.has(x));

    const cx1 = W * 0.36, cx2 = W * 0.64, cy = H * 0.52, r = H * 0.38;

    // Fill circles
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#4e9af1';
    ctx.beginPath(); ctx.arc(cx1, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f14e8a';
    ctx.beginPath(); ctx.arc(cx2, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // Stroke circles
    ctx.strokeStyle = 'rgba(201,168,76,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx1, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx2, cy, r, 0, Math.PI*2); ctx.stroke();

    // Circle labels A, B
    ctx.fillStyle = 'rgba(201,168,76,0.95)';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', cx1 - r * 0.55, 16);
    ctx.fillText('B', cx2 + r * 0.55, 16);

    // Element labels inside zones
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 11px JetBrains Mono, monospace';

    // Only A zone
    const aZone = onlyA.slice(0, 5);
    aZone.forEach((v, i) => {
      ctx.fillText(v, cx1 - r * 0.55, cy - (aZone.length - 1) * 9 + i * 18);
    });
    if (onlyA.length > 5) ctx.fillText(`+${onlyA.length - 5}`, cx1 - r * 0.55, cy + 5 * 18 - (aZone.length - 1) * 9);

    // Intersection zone
    const iZone = inter.slice(0, 4);
    iZone.forEach((v, i) => {
      ctx.fillText(v, (cx1 + cx2) / 2, cy - (iZone.length - 1) * 9 + i * 18);
    });
    if (inter.length > 4) ctx.fillText(`+${inter.length - 4}`, (cx1 + cx2) / 2, cy + 4 * 18 - (iZone.length - 1) * 9);

    // Only B zone
    const bZone = onlyB.slice(0, 5);
    bZone.forEach((v, i) => {
      ctx.fillText(v, cx2 + r * 0.55, cy - (bZone.length - 1) * 9 + i * 18);
    });
    if (onlyB.length > 5) ctx.fillText(`+${onlyB.length - 5}`, cx2 + r * 0.55, cy + 5 * 18 - (bZone.length - 1) * 9);

    // Update counts below diagram
    const countsEl = document.getElementById('venn-counts');
    if (countsEl) {
      countsEl.innerHTML =
        `n(A) = ${A.length}  |  n(B) = ${B.length}  |  n(A∩B) = ${inter.length}<br>` +
        `n(A∪B) = ${[...new Set([...A,...B])].length}  |  n(A only) = ${onlyA.length}  |  n(B only) = ${onlyB.length}`;
    }
  }

  // ══════════════════════════════════════════════
  // CH 2 — COMPOUND INTEREST
  // ══════════════════════════════════════════════
  function ciCalc() {
    const P = val('ci-p'), R = val('ci-r'), T = val('ci-t');
    const n = parseFloat(document.getElementById('ci-n')?.value) || 1;
    if (!P || !R || !T) return setR('ci-result', 'Fill in all fields');
    const A  = P * Math.pow(1 + R / (100 * n), n * T);
    const CI = A - P;
    const SI = P * R * T / 100;
    setR('ci-result',
      `Amount (A) = <b>Rs. ${A.toFixed(2)}</b>\n` +
      `Compound Interest = <b>Rs. ${CI.toFixed(2)}</b>\n` +
      `Simple Interest = Rs. ${SI.toFixed(2)}\n` +
      `Extra earned (CI−SI) = Rs. ${(CI-SI).toFixed(2)}`);
  }

  // ══════════════════════════════════════════════
  // CH 3 — GROWTH & DEPRECIATION
  // ══════════════════════════════════════════════
  function gdCalc() {
    const P = val('gd-p'), R = val('gd-r'), T = val('gd-t');
    const type = document.getElementById('gd-type')?.value || 'growth';
    if (!P || !R || !T) return setR('gd-result', 'Fill in all fields');
    const factor = type === 'growth' ? (1 + R/100) : (1 - R/100);
    const V = P * Math.pow(factor, T);
    const change = Math.abs(V - P);
    setR('gd-result',
      `Final Value = <b>${V.toFixed(2)}</b>\n` +
      `${type === 'growth' ? 'Total Growth' : 'Total Loss'} = ${change.toFixed(2)}\n` +
      `(${((change/P)*100).toFixed(2)}% ${type === 'growth' ? 'gain' : 'loss'} overall)`);
  }

  // ══════════════════════════════════════════════
  // CH 4 — CURRENCY & EXCHANGE
  // ══════════════════════════════════════════════
  function fxCalc() {
    const amt  = val('fx-amt');
    const rate = val('fx-rate');
    const from = str('fx-from').toUpperCase() || 'NPR';
    const to   = str('fx-to').toUpperCase()   || 'USD';
    if (!amt || !rate) return setR('fx-result', 'Fill in amount and rate');
    const result   = amt * rate;
    const commPct  = val('fx-comm');
    const comm     = result * commPct / 100;
    const net      = result - comm;
    setR('fx-result',
      `${amt} ${from} = <b>${result.toFixed(4)} ${to}</b>\n` +
      (commPct ? `Commission (${commPct}%) = ${comm.toFixed(4)} ${to}\nNet = ${net.toFixed(4)} ${to}` : ''));
  }

  // ══════════════════════════════════════════════
  // CH 5 — AREA (handled by shape canvas + Shapes.getFormula)
  // ══════════════════════════════════════════════

  // ══════════════════════════════════════════════
  // CH 6 — SEQUENCES & SERIES
  // ══════════════════════════════════════════════
  function seqCalc() {
    const type = document.getElementById('seq-type')?.value || 'ap';
    const a    = val('seq-a'), n = parseInt(val('seq-n'));

    if (type === 'ap') {
      const d     = val('seq-d');
      const terms = Array.from({length: n}, (_, i) => a + i * d);
      const Sn    = (n / 2) * (2 * a + (n - 1) * d);
      const nth   = a + (n - 1) * d;
      setR('seq-result',
        `Terms: ${terms.slice(0,8).map(x => +x.toFixed(2)).join(', ')}${n>8?'...':''}\n` +
        `<b>a₍ₙ₎ = ${nth.toFixed(4)}</b>   |   <b>S₍ₙ₎ = ${Sn.toFixed(4)}</b>`);
    } else {
      const r     = val('seq-r');
      if (r === 0) return setR('seq-result', 'Common ratio cannot be 0');
      const terms = Array.from({length: n}, (_, i) => a * Math.pow(r, i));
      const Sn    = Math.abs(r - 1) < 1e-9 ? a * n : a * (Math.pow(r, n) - 1) / (r - 1);
      const nth   = a * Math.pow(r, n - 1);
      setR('seq-result',
        `Terms: ${terms.slice(0,8).map(x => +x.toFixed(3)).join(', ')}${n>8?'...':''}\n` +
        `<b>a₍ₙ₎ = ${nth.toFixed(4)}</b>   |   <b>S₍ₙ₎ = ${Sn.toFixed(4)}</b>`);
    }
  }

  function seqTypeSwitch() {
    const type = document.getElementById('seq-type')?.value;
    const dRow = document.getElementById('seq-d-row');
    const rRow = document.getElementById('seq-r-row');
    if (dRow) dRow.style.display = type === 'ap' ? 'flex' : 'none';
    if (rRow) rRow.style.display = type === 'gp' ? 'flex' : 'none';
  }

  // ══════════════════════════════════════════════
  // CH 7 — QUADRATIC EQUATION
  // ══════════════════════════════════════════════
  function quadCalc() {
    const a = val('q-a'), b = val('q-b'), c = val('q-c');
    if (a === 0) return setR('q-result', 'Coefficient a ≠ 0 for quadratic');
    const D = b * b - 4 * a * c;
    let res;
    if (D > 0) {
      const x1 = (-b + Math.sqrt(D)) / (2 * a);
      const x2 = (-b - Math.sqrt(D)) / (2 * a);
      res = `D = ${D.toFixed(3)} > 0 → <b>Two distinct real roots</b>\nx₁ = ${x1.toFixed(5)}\nx₂ = ${x2.toFixed(5)}\nFactored: ${a}(x − ${x1.toFixed(3)})(x − ${x2.toFixed(3)})`;
    } else if (Math.abs(D) < 1e-9) {
      const x = -b / (2 * a);
      res = `D = 0 → <b>One repeated real root</b>\nx = ${x.toFixed(5)}\nFactored: ${a}(x − ${x.toFixed(3)})²`;
    } else {
      const real = (-b / (2 * a)).toFixed(4);
      const imag = (Math.sqrt(-D) / (2 * a)).toFixed(4);
      res = `D = ${D.toFixed(3)} < 0 → <b>Complex (no real roots)</b>\nx = ${real} ± ${imag}i`;
    }
    setR('q-result', res);
  }

  // ══════════════════════════════════════════════
  // CH 10 — TRIANGLES & QUADRILATERALS
  // ══════════════════════════════════════════════
  function triCalc() {
    const a = val('tri-a'), b = val('tri-b'), c = val('tri-c');
    if (!a || !b || !c) return setR('tri-result', 'Enter all three sides');
    if (a + b <= c || a + c <= b || b + c <= a) {
      setR('tri-result', '⚠ Invalid triangle — sides don\'t satisfy triangle inequality');
      return;
    }
    const s    = (a + b + c) / 2;
    const area = Math.sqrt(s * (s-a) * (s-b) * (s-c));
    const A    = Math.acos((b*b + c*c - a*a) / (2*b*c)) * 180 / Math.PI;
    const B    = Math.acos((a*a + c*c - b*b) / (2*a*c)) * 180 / Math.PI;
    const C    = 180 - A - B;

    // Classify
    let typeAngle = A > 90 || B > 90 || C > 90 ? 'Obtuse' : (Math.abs(A-90)<0.1||Math.abs(B-90)<0.1||Math.abs(C-90)<0.1 ? 'Right' : 'Acute');
    let typeSide  = a===b&&b===c ? 'Equilateral' : (a===b||b===c||a===c ? 'Isosceles' : 'Scalene');

    setR('tri-result',
      `Area (Heron's) = <b>${area.toFixed(4)} sq units</b>\n` +
      `Perimeter = ${(a+b+c).toFixed(3)}\n` +
      `∠A = ${A.toFixed(2)}°   ∠B = ${B.toFixed(2)}°   ∠C = ${C.toFixed(2)}°\n` +
      `Type: <b>${typeSide} ${typeAngle} triangle</b>`);
  }

  // ══════════════════════════════════════════════
  // CH 12 — CIRCLE
  // ══════════════════════════════════════════════
  function circleCalc() {
    const r     = val('circ-r');
    const theta = val('circ-theta');
    if (!r) return setR('circ-result', 'Enter radius');
    const area  = Math.PI * r * r;
    const circ  = 2 * Math.PI * r;
    const arc   = (theta / 360) * 2 * Math.PI * r;
    const secA  = (theta / 360) * Math.PI * r * r;
    const chord = 2 * r * Math.sin((theta / 2) * Math.PI / 180);
    setR('circ-result',
      `Area = <b>${area.toFixed(4)} cm²</b>\n` +
      `Circumference = <b>${circ.toFixed(4)} cm</b>\n` +
      `Arc length (${theta}°) = ${arc.toFixed(4)} cm\n` +
      `Sector area (${theta}°) = ${secA.toFixed(4)} cm²\n` +
      `Chord length (${theta}°) = ${chord.toFixed(4)} cm`);
  }

  // ══════════════════════════════════════════════
  // CH 13 — STATISTICS
  // ══════════════════════════════════════════════
  function statCalc(op) {
    const raw = str('stat-data')
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n));
    if (!raw.length) return setR('stat-result', 'Enter comma-separated data');

    const sorted = [...raw].sort((a, b) => a - b);
    const n      = raw.length;
    const mean   = raw.reduce((s, x) => s + x, 0) / n;

    const mid    = Math.floor(n / 2);
    const median = n % 2 === 0 ? (sorted[mid-1] + sorted[mid]) / 2 : sorted[mid];

    const freq = {};
    raw.forEach(x => freq[x] = (freq[x] || 0) + 1);
    const maxF = Math.max(...Object.values(freq));
    const mode = Object.keys(freq).filter(k => freq[k] === maxF).map(Number);

    const range    = sorted[n-1] - sorted[0];
    const variance = raw.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    const sd       = Math.sqrt(variance);
    const q1       = sorted[Math.floor(n/4)];
    const q3       = sorted[Math.floor(3*n/4)];

    let res = '';
    if (op === 'all' || op === 'mean')   res += `Mean = <b>${mean.toFixed(4)}</b>\n`;
    if (op === 'all' || op === 'median') res += `Median = <b>${median}</b>\n`;
    if (op === 'all' || op === 'mode')   res += `Mode = <b>${mode.join(', ')}</b> (freq=${maxF})\n`;
    if (op === 'all' || op === 'range')  res += `Range = <b>${range}</b>\n`;
    if (op === 'all' || op === 'sd')     res += `Std Dev σ = <b>${sd.toFixed(4)}</b>\nVariance = ${variance.toFixed(4)}\n`;
    if (op === 'all') res += `Q1=${q1}  Q3=${q3}  IQR=${q3-q1}`;

    setR('stat-result', res);
    if (op === 'all') drawStatBar(raw);
  }

  function drawStatBar(data) {
    const c = document.getElementById('stat-bar-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...data);
    const bw  = Math.max(4, Math.floor((W - 10) / data.length) - 3);
    data.forEach((v, i) => {
      const bh = Math.round((v / max) * (H - 20));
      const x  = 5 + i * (bw + 3);
      const y  = H - bh - 10;
      ctx.fillStyle = `hsl(${200 + i * 18},65%,58%)`;
      ctx.fillRect(x, y, bw, bh);
      if (bw > 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(v, x + bw/2, y - 2);
      }
    });
  }

  // ══════════════════════════════════════════════
  // CH 14 — PROBABILITY
  // ══════════════════════════════════════════════
  function probCalc() {
    const f = val('pr-f'), n = val('pr-n');
    if (!n) return setR('pr-result', 'Total outcomes cannot be 0');
    if (f > n) return setR('pr-result', 'Favourable cannot exceed total');
    const p = f / n;
    setR('pr-result',
      `P(E) = ${f}/${n} = <b>${p.toFixed(6)}</b>\n` +
      `P(E') = ${(1-p).toFixed(6)}\n` +
      `As percentage = ${(p*100).toFixed(3)}%`);

    const bar = document.getElementById('prob-bar-fill');
    if (bar) bar.style.width = (p * 100) + '%';
  }

  function rollDice() {
    const val = Math.floor(Math.random() * 6) + 1;
    const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const el    = document.getElementById('dice-face');
    const res   = document.getElementById('dice-result-text');
    if (!el) return;
    let i = 0;
    const iv = setInterval(() => {
      el.textContent = faces[Math.floor(Math.random() * 6)];
      if (++i > 10) {
        clearInterval(iv);
        el.textContent = faces[val - 1];
        if (res) res.textContent = `Rolled: ${val}`;
      }
    }, 70);
  }

  function flipCoin() {
    const el  = document.getElementById('coin-face');
    const res = document.getElementById('coin-result-text');
    if (!el) return;
    let i = 0;
    const iv = setInterval(() => {
      el.textContent = Math.random() > 0.5 ? 'H' : 'T';
      if (++i > 10) {
        clearInterval(iv);
        const final = Math.random() > 0.5 ? 'Heads' : 'Tails';
        el.textContent = final[0];
        if (res) res.textContent = `Result: ${final}`;
      }
    }, 60);
  }

  return {
    setsCalc, drawVenn, vennLive,
    ciCalc,
    gdCalc,
    fxCalc,
    seqCalc, seqTypeSwitch,
    quadCalc,
    triCalc,
    circleCalc,
    statCalc, drawStatBar,
    probCalc, rollDice, flipCoin
  };
})();

// ═══════════════════════════════════════════════
// SETS UI — Dynamic multi-set manager
// Handles: add/remove sets, operation buttons,
// Venn diagram (2-set and 3-set), result display
// ═══════════════════════════════════════════════
const SetsUI = (() => {

  const SET_NAMES   = ['A','B','C','D','E'];
  const SET_COLORS  = ['#4e9af1','#f14e8a','#f1a94e','#7ef14e','#c44ef1'];
  let   setCount    = 2;   // start with 2 sets

  // ── Initialise when chapter panel opens ──
  function init() {
    setCount = 2;
    renderInputs();
    renderOpButtons();
    redrawVenn();
  }

  // ── Render set input rows ──
  function renderInputs() {
    const wrap = document.getElementById('sets-inputs');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < setCount; i++) {
      const name  = SET_NAMES[i];
      const color = SET_COLORS[i];
      const row   = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:7px';
      row.innerHTML = `
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${color};min-width:16px">${name}</span>
        <input class="c-inp" id="set-${name}"
          style="flex:1;text-align:left;font-size:12px;height:28px"
          placeholder="e.g. 1, 2, 3, 4"
          oninput="SetsUI.redrawVenn()">`;
      wrap.appendChild(row);
    }
  }

  // ── Render operation buttons based on current set count ──
  function renderOpButtons() {
    const wrap = document.getElementById('sets-op-btns');
    if (!wrap) return;
    wrap.innerHTML = '';

    const ops2 = [
      { label:'A ∪ B  — Union',                op:'AB_union' },
      { label:'A ∩ B  — Intersection',          op:'AB_inter' },
      { label:'A − B  — Difference',            op:'AB_diff'  },
      { label:'B − A  — Difference',            op:'BA_diff'  },
      { label:'A △ B  — Symmetric Difference',  op:'AB_sym'   },
      { label:"A'  — Complement of A (needs U)",op:'A_comp'   },
    ];

    const ops3 = [
      { label:'A ∪ B ∪ C',                      op:'ABC_union' },
      { label:'A ∩ B ∩ C',                      op:'ABC_inter' },
      { label:'(A ∪ B) − C',                    op:'AuB_mC'    },
      { label:'A ∩ B only (not C)',              op:'AB_notC'   },
      { label:'Only in A',                       op:'onlyA'     },
      { label:'Only in B',                       op:'onlyB'     },
      { label:'Only in C',                       op:'onlyC'     },
      { label:"n(A ∪ B ∪ C) — Formula check",   op:'ABC_form'  },
    ];

    const ops = setCount === 2 ? ops2 : [...ops2.slice(0,4), ...ops3];

    // 2-column grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:5px';

    ops.forEach(o => {
      const btn = document.createElement('button');
      btn.className = 'c-btn-sm';
      btn.textContent = o.label;
      btn.style.cssText = 'text-align:left;padding:4px 6px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;border-radius:4px;';
      btn.title = o.label;
      btn.addEventListener('click', () => compute(o.op));
      // Full-width for single-column ops
      if (['AB_sym','A_comp','ABC_form'].includes(o.op)) {
        btn.style.gridColumn = '1 / -1';
      }
      grid.appendChild(btn);
    });

    wrap.appendChild(grid);
  }

  // ── Read a set by letter ──
  function readSet(letter) {
    const el = document.getElementById(`set-${letter}`);
    if (!el || !el.value.trim()) return [];
    return el.value.split(',').map(s => s.trim()).filter(Boolean);
  }

  // ── Core compute ──
  function compute(op) {
    const A = readSet('A'), B = readSet('B');
    const C = setCount >= 3 ? readSet('C') : [];
    const sA = new Set(A), sB = new Set(B), sC = new Set(C);
    const nU = parseFloat(document.getElementById('set-U')?.value) || null;

    let result, label;

    switch (op) {
      case 'AB_union': {
        result = [...new Set([...A,...B])];
        label  = 'A ∪ B';
        break;
      }
      case 'AB_inter': {
        result = A.filter(x => sB.has(x));
        label  = 'A ∩ B';
        break;
      }
      case 'AB_diff': {
        result = A.filter(x => !sB.has(x));
        label  = 'A − B';
        break;
      }
      case 'BA_diff': {
        result = B.filter(x => !sA.has(x));
        label  = 'B − A';
        break;
      }
      case 'AB_sym': {
        result = [...A.filter(x => !sB.has(x)), ...B.filter(x => !sA.has(x))];
        label  = 'A △ B';
        break;
      }
      case 'A_comp': {
        if (!nU) { setR('set-result','⚠ Enter n(U) first'); return; }
        label  = "A'  (Complement of A)";
        setR('set-result',
          `<b>${label}</b><br>n(A') = n(U) − n(A) = ${nU} − ${A.length} = <b>${nU - A.length}</b>`);
        redrawVenn();
        return;
      }
      case 'ABC_union': {
        result = [...new Set([...A,...B,...C])];
        label  = 'A ∪ B ∪ C';
        break;
      }
      case 'ABC_inter': {
        result = A.filter(x => sB.has(x) && sC.has(x));
        label  = 'A ∩ B ∩ C';
        break;
      }
      case 'AuB_mC': {
        const AuB = new Set([...A,...B]);
        result = [...AuB].filter(x => !sC.has(x));
        label  = '(A ∪ B) − C';
        break;
      }
      case 'AB_notC': {
        result = A.filter(x => sB.has(x) && !sC.has(x));
        label  = 'A ∩ B (not in C)';
        break;
      }
      case 'onlyA': {
        result = A.filter(x => !sB.has(x) && !sC.has(x));
        label  = 'Only in A';
        break;
      }
      case 'onlyB': {
        result = B.filter(x => !sA.has(x) && !sC.has(x));
        label  = 'Only in B';
        break;
      }
      case 'onlyC': {
        result = C.filter(x => !sA.has(x) && !sB.has(x));
        label  = 'Only in C';
        break;
      }
      case 'ABC_form': {
        const AuB   = new Set([...A,...B]);
        const AuBuC = new Set([...A,...B,...C]);
        const nAB   = A.filter(x => sB.has(x)).length;
        const nBC   = B.filter(x => sC.has(x)).length;
        const nAC   = A.filter(x => sC.has(x)).length;
        const nABC  = A.filter(x => sB.has(x) && sC.has(x)).length;
        const formula = A.length + B.length + C.length - nAB - nBC - nAC + nABC;
        setR('set-result',
          `n(A∪B∪C) = n(A)+n(B)+n(C) − n(A∩B) − n(B∩C) − n(A∩C) + n(A∩B∩C)<br>` +
          `= ${A.length}+${B.length}+${C.length} − ${nAB} − ${nBC} − ${nAC} + ${nABC}<br>` +
          `= <b>${formula}</b>  (actual: <b>${AuBuC.size}</b>)`);
        redrawVenn();
        return;
      }
      default: return;
    }

    const display = result.length ? `{ ${result.join(', ')} }` : '∅  (empty set)';
    setR('set-result',
      `<b>${label}</b> = ${display}<br>n(${label}) = <b>${result.length}</b>`);
    redrawVenn();
  }

  // ── Add / Remove set ──
  function addSet() {
    if (setCount >= 5) { App.showToast('Maximum 5 sets'); return; }
    setCount++;
    renderInputs();
    renderOpButtons();
    redrawVenn();
  }

  function removeSet() {
    if (setCount <= 2) { App.showToast('Minimum 2 sets'); return; }
    setCount--;
    renderInputs();
    renderOpButtons();
    redrawVenn();
  }

  // ── Venn diagram (2-set or 3-set) ──
  function redrawVenn() {
    const c = document.getElementById('venn-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);

    const sets  = [];
    for (let i = 0; i < setCount && i < 3; i++) {
      sets.push({ name: SET_NAMES[i], color: SET_COLORS[i], vals: readSet(SET_NAMES[i]) });
    }

    if (sets.length === 2) drawVenn2(ctx, W, H, sets);
    else if (sets.length >= 3) drawVenn3(ctx, W, H, sets);

    updateCounts(sets);
  }

  function drawVenn2(ctx, W, H, sets) {
    const r  = H * 0.38;
    const cx1 = W * 0.35, cx2 = W * 0.65, cy = H * 0.52;

    // Fill
    [0,1].forEach(i => {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = sets[i].color;
      ctx.beginPath(); ctx.arc(i===0?cx1:cx2, cy, r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Stroke
    [cx1,cx2].forEach((cx,i) => {
      ctx.strokeStyle = sets[i].color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    });

    // Labels A B
    ctx.font = '700 13px Inter,sans-serif'; ctx.textAlign = 'center';
    [cx1,cx2].forEach((cx,i) => {
      ctx.fillStyle = sets[i].color;
      ctx.fillText(sets[i].name, cx, 15);
    });

    // Element zones
    const sA = new Set(sets[0].vals), sB = new Set(sets[1].vals);
    const onlyA = sets[0].vals.filter(x => !sB.has(x));
    const inter  = sets[0].vals.filter(x => sB.has(x));
    const onlyB  = sets[1].vals.filter(x => !sA.has(x));

    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.font = '11px JetBrains Mono,monospace';
    drawZoneText(ctx, onlyA, cx1 - r*0.52, cy);
    drawZoneText(ctx, inter,  (cx1+cx2)/2,  cy);
    drawZoneText(ctx, onlyB, cx2 + r*0.52, cy);
  }

  function drawVenn3(ctx, W, H, sets) {
    const r  = H * 0.32;
    const cx1 = W*0.35, cy1 = H*0.38;
    const cx2 = W*0.65, cy2 = H*0.38;
    const cx3 = W*0.5,  cy3 = H*0.72;
    const centres = [[cx1,cy1],[cx2,cy2],[cx3,cy3]];

    // Fill
    centres.forEach(([cx,cy],i) => {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = sets[i].color;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Stroke
    centres.forEach(([cx,cy],i) => {
      ctx.strokeStyle = sets[i].color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    });

    // Set name labels
    ctx.font = '700 12px Inter,sans-serif'; ctx.textAlign = 'center';
    const labelPos = [[cx1-r*.6,cy1-r*.8],[cx2+r*.6,cy2-r*.8],[cx3,cy3+r*.85]];
    labelPos.forEach(([lx,ly],i) => {
      ctx.fillStyle = sets[i].color;
      ctx.fillText(sets[i].name, lx, ly);
    });

    // Zone labels (simplified — just show n values in each zone)
    const [A,B,C] = sets.map(s => new Set(s.vals));
    const zones = [
      { label:'only A', val:[...A].filter(x=>!B.has(x)&&!C.has(x)), pos:[cx1-r*.55,cy1+r*.15] },
      { label:'only B', val:[...B].filter(x=>!A.has(x)&&!C.has(x)), pos:[cx2+r*.55,cy2+r*.15] },
      { label:'only C', val:[...C].filter(x=>!A.has(x)&&!B.has(x)), pos:[cx3,cy3+r*.15]        },
      { label:'A∩B',    val:[...A].filter(x=>B.has(x)&&!C.has(x)),  pos:[(cx1+cx2)/2,cy1-r*.12]},
      { label:'A∩C',    val:[...A].filter(x=>C.has(x)&&!B.has(x)),  pos:[(cx1+cx3)/2+4,(cy1+cy3)/2]},
      { label:'B∩C',    val:[...B].filter(x=>C.has(x)&&!A.has(x)),  pos:[(cx2+cx3)/2-4,(cy2+cy3)/2]},
      { label:'A∩B∩C',  val:[...A].filter(x=>B.has(x)&&C.has(x)),   pos:[(cx1+cx2+cx3)/3,(cy1+cy2+cy3)/3+4]},
    ];

    ctx.font = '600 10.5px JetBrains Mono,monospace'; ctx.textAlign = 'center';
    zones.forEach(z => {
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      if (z.val.length > 0) ctx.fillText(z.val.slice(0,3).join(',')+(z.val.length>3?'…':''), z.pos[0], z.pos[1]);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      if (z.val.length === 0) ctx.fillText('∅', z.pos[0], z.pos[1]);
    });
  }

  function drawZoneText(ctx, arr, x, y) {
    const show = arr.slice(0, 5);
    const more = arr.length - show.length;
    show.forEach((v, i) => {
      ctx.fillText(v, x, y - (show.length-1)*9 + i*18);
    });
    if (more > 0) ctx.fillText(`+${more}`, x, y - (show.length-1)*9 + show.length*18);
  }

  function updateCounts(sets) {
    const el = document.getElementById('venn-counts');
    if (!el) return;
    const ss = sets.map(s => new Set(s.vals));
    let html = sets.map((s,i) => `n(${s.name}) = ${s.vals.length}`).join('  |  ');
    if (sets.length === 2) {
      const inter = sets[0].vals.filter(x => ss[1].has(x));
      const union = [...new Set([...sets[0].vals,...sets[1].vals])];
      html += `<br>n(A∩B) = ${inter.length}  |  n(A∪B) = ${union.length}`;
    } else if (sets.length === 3) {
      const ABC = sets[0].vals.filter(x => ss[1].has(x) && ss[2].has(x));
      const union = [...new Set([...sets[0].vals,...sets[1].vals,...sets[2].vals])];
      html += `<br>n(A∩B∩C) = ${ABC.length}  |  n(A∪B∪C) = ${union.length}`;
    }
    el.innerHTML = html;
  }

  function setR(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  return { init, addSet, removeSet, redrawVenn };
})();