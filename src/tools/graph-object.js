'use strict';

// ═══════════════════════════════════════════════════════════════
// GRAPH BOARD OBJECT — Movable, Resizable Whiteboard Graph Object
// Safe math expression parser (no eval), multi-curve plotting,
// interactive dimension and equation editor for SmartBoard.
// ═══════════════════════════════════════════════════════════════

const GraphObject = (() => {

  // ─────────────────────────────────────────────────────────────
  // SAFE MATH EXPRESSION PARSER & EVALUATOR (No eval / No Function)
  // ─────────────────────────────────────────────────────────────
  function tokenize(str) {
    const tokens = [];
    let i = 0;
    const s = str.replace(/\s+/g, '').toLowerCase();

    while (i < s.length) {
      const c = s[i];

      if (/[0-9.]/.test(c)) {
        let num = '';
        while (i < s.length && /[0-9.]/.test(s[i])) {
          num += s[i];
          i++;
        }
        tokens.push({ type: 'num', val: parseFloat(num) });
        continue;
      }

      if (/[a-z]/.test(c)) {
        let ident = '';
        while (i < s.length && /[a-z]/.test(s[i])) {
          ident += s[i];
          i++;
        }
        if (ident === 'x') {
          tokens.push({ type: 'var', val: 'x' });
        } else if (ident === 'pi') {
          tokens.push({ type: 'num', val: Math.PI });
        } else if (ident === 'e') {
          tokens.push({ type: 'num', val: Math.E });
        } else if (['sin', 'cos', 'tan', 'abs', 'sqrt', 'ln', 'log', 'exp'].includes(ident)) {
          tokens.push({ type: 'fn', val: ident });
        } else {
          tokens.push({ type: 'var', val: 'x' });
        }
        continue;
      }

      if ('+-*/^()'.includes(c)) {
        tokens.push({ type: 'op', val: c });
        i++;
        continue;
      }

      i++;
    }
    return tokens;
  }

  // Convert infix tokens to postfix (RPN) using Shunting-yard algorithm
  function infixToRPN(tokens) {
    const output = [];
    const ops = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
    const rightAssoc = { '^': true };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t.type === 'num' || t.type === 'var') {
        output.push(t);
      } else if (t.type === 'fn') {
        ops.push(t);
      } else if (t.type === 'op') {
        if (t.val === '-' && (i === 0 || ['(', '+', '-', '*', '/', '^'].includes(tokens[i - 1].val))) {
          output.push({ type: 'num', val: 0 });
          ops.push({ type: 'op', val: '-' });
          continue;
        }

        if (t.val === '(') {
          ops.push(t);
        } else if (t.val === ')') {
          while (ops.length && ops[ops.length - 1].val !== '(') {
            output.push(ops.pop());
          }
          ops.pop(); // discard '('
          if (ops.length && ops[ops.length - 1].type === 'fn') {
            output.push(ops.pop());
          }
        } else {
          const prec = precedence[t.val] || 0;
          while (ops.length) {
            const top = ops[ops.length - 1];
            if (top.val === '(') break;
            const topPrec = precedence[top.val] || 0;
            if ((!rightAssoc[t.val] && prec <= topPrec) || (rightAssoc[t.val] && prec < topPrec)) {
              output.push(ops.pop());
            } else {
              break;
            }
          }
          ops.push(t);
        }
      }
    }

    while (ops.length) {
      output.push(ops.pop());
    }

    return output;
  }

  // Compile equation string to an executable function f(x)
  function compile(exprStr) {
    try {
      let cleaned = (exprStr || '').trim();
      if (cleaned.startsWith('y=') || cleaned.startsWith('y =')) {
        cleaned = cleaned.replace(/^y\s*=\s*/, '');
      }
      if (cleaned.startsWith('f(x)=') || cleaned.startsWith('f(x) =')) {
        cleaned = cleaned.replace(/^f\(x\)\s*=\s*/, '');
      }
      cleaned = cleaned.replace(/(\d)([a-z(])/g, '$1*$2');
      cleaned = cleaned.replace(/(\))([a-z0-9(])/g, '$1*$2');

      const tokens = tokenize(cleaned);
      const rpn = infixToRPN(tokens);

      return function evaluate(x) {
        const stack = [];
        for (const t of rpn) {
          if (t.type === 'num') {
            stack.push(t.val);
          } else if (t.type === 'var') {
            stack.push(x);
          } else if (t.type === 'fn') {
            const a = stack.pop();
            switch (t.val) {
              case 'sin': stack.push(Math.sin(a)); break;
              case 'cos': stack.push(Math.cos(a)); break;
              case 'tan': stack.push(Math.tan(a)); break;
              case 'abs': stack.push(Math.abs(a)); break;
              case 'sqrt': stack.push(Math.sqrt(a)); break;
              case 'ln': stack.push(Math.log(a)); break;
              case 'log': stack.push(Math.log10 ? Math.log10(a) : Math.log(a) / Math.LN10); break;
              case 'exp': stack.push(Math.exp(a)); break;
              default: stack.push(a); break;
            }
          } else if (t.type === 'op') {
            const b = stack.pop();
            const a = stack.pop();
            switch (t.val) {
              case '+': stack.push(a + b); break;
              case '-': stack.push(a - b); break;
              case '*': stack.push(a * b); break;
              case '/': stack.push(b === 0 ? NaN : a / b); break;
              case '^': stack.push(Math.pow(a, b)); break;
              default: stack.push(NaN); break;
            }
          }
        }
        const res = stack.pop();
        return (typeof res === 'number' && isFinite(res)) ? res : NaN;
      };
    } catch (e) {
      return () => NaN;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FACTORY: CREATE NEW GRAPH SHAPE
  // ─────────────────────────────────────────────────────────────
  function create(x, y, w, h, options = {}) {
    return {
      id: 'graph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'graph',
      x: x || 120,
      y: y || 80,
      w: w || 460,
      h: h || 320,
      xMin: options.xMin !== undefined ? options.xMin : -10,
      xMax: options.xMax !== undefined ? options.xMax : 10,
      yMin: options.yMin !== undefined ? options.yMin : -10,
      yMax: options.yMax !== undefined ? options.yMax : 10,
      equations: options.equations || [
        { expr: 'x^2', color: '#38bdf8', lineWidth: 2.5, visible: true },
        { expr: 'sin(x)', color: '#f43f5e', lineWidth: 2.5, visible: true }
      ],
      title: options.title || 'Function Plotter',
      showGrid: options.showGrid !== undefined ? options.showGrid : true,
      showAxes: options.showAxes !== undefined ? options.showAxes : true,
      showLabels: options.showLabels !== undefined ? options.showLabels : true,
      color: '#38bdf8'
    };
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER GRAPH OBJECT ON WHITEBOARD
  // ─────────────────────────────────────────────────────────────
  function draw(ctx, g) {
    if (!g || g.w <= 0 || g.h <= 0) return;

    ctx.save();

    // 1. Container Background (Modern Glassmorphic Dark Panel)
    const gx = g.x, gy = g.y, gw = g.w, gh = g.h;
    ctx.fillStyle = 'rgba(7, 14, 30, 0.94)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx, gy, gw, gh, 14);
    else ctx.rect(gx, gy, gw, gh);
    ctx.fill();
    ctx.stroke();

    // 2. Header Bar with Title & Legend
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx, gy, gw, 36, [14, 14, 0, 0]);
    else ctx.rect(gx, gy, gw, 36);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`📊 ${g.title || 'Graph'}`, gx + 14, gy + 18);

    // Legend pills
    let legendX = gx + gw - 12;
    if (g.equations && g.equations.length) {
      for (let i = g.equations.length - 1; i >= 0; i--) {
        const eq = g.equations[i];
        if (!eq.visible) continue;
        const text = `y = ${eq.expr}`;
        ctx.font = '600 11px monospace';
        const tw = ctx.measureText(text).width;
        legendX -= (tw + 22);

        // Pill background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(legendX, gy + 8, tw + 18, 20, 10);
        else ctx.rect(legendX, gy + 8, tw + 18, 20);
        ctx.fill();

        // Color dot
        ctx.fillStyle = eq.color || '#38bdf8';
        ctx.beginPath();
        ctx.arc(legendX + 9, gy + 18, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.fillStyle = '#f1f5f9';
        ctx.textAlign = 'left';
        ctx.fillText(text, legendX + 17, gy + 18);
      }
    }

    // 3. Plot Viewport Bounds
    const padL = 36, padR = 18, padT = 46, padB = 26;
    const plotX = gx + padL;
    const plotY = gy + padT;
    const plotW = Math.max(20, gw - padL - padR);
    const plotH = Math.max(20, gh - padT - padB);

    const xMin = g.xMin !== undefined ? g.xMin : -10;
    const xMax = g.xMax !== undefined ? g.xMax : 10;
    const yMin = g.yMin !== undefined ? g.yMin : -10;
    const yMax = g.yMax !== undefined ? g.yMax : 10;

    const spanX = Math.max(0.001, xMax - xMin);
    const spanY = Math.max(0.001, yMax - yMin);

    function toScreenX(x) {
      return plotX + ((x - xMin) / spanX) * plotW;
    }
    function toScreenY(y) {
      return plotY + plotH - ((y - yMin) / spanY) * plotH;
    }

    // Clip all plotting inside plot viewport
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotW, plotH);
    ctx.clip();

    // 4. Background Grid Lines
    if (g.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      // Vertical grid lines
      const stepX = Math.pow(10, Math.floor(Math.log10(spanX / 6))) || 1;
      const firstX = Math.ceil(xMin / stepX) * stepX;
      for (let x = firstX; x <= xMax; x += stepX) {
        const sx = toScreenX(x);
        ctx.beginPath();
        ctx.moveTo(sx, plotY);
        ctx.lineTo(sx, plotY + plotH);
        ctx.stroke();
      }

      // Horizontal grid lines
      const stepY = Math.pow(10, Math.floor(Math.log10(spanY / 5))) || 1;
      const firstY = Math.ceil(yMin / stepY) * stepY;
      for (let y = firstY; y <= yMax; y += stepY) {
        const sy = toScreenY(y);
        ctx.beginPath();
        ctx.moveTo(plotX, sy);
        ctx.lineTo(plotX + plotW, sy);
        ctx.stroke();
      }
    }

    // 5. Axes (X & Y)
    if (g.showAxes) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.8;

      const originX = toScreenX(0);
      const originY = toScreenY(0);

      // X Axis
      if (originY >= plotY && originY <= plotY + plotH) {
        ctx.beginPath();
        ctx.moveTo(plotX, originY);
        ctx.lineTo(plotX + plotW, originY);
        ctx.stroke();
      }
      // Y Axis
      if (originX >= plotX && originX <= plotX + plotW) {
        ctx.beginPath();
        ctx.moveTo(originX, plotY);
        ctx.lineTo(originX, plotY + plotH);
        ctx.stroke();
      }
    }

    // 6. Draw Curves for Each Equation
    if (g.equations && g.equations.length) {
      const samples = Math.min(600, Math.max(150, Math.round(plotW * 1.5)));
      const dx = spanX / samples;

      g.equations.forEach(eq => {
        if (!eq.visible || !eq.expr) return;

        const fn = compile(eq.expr);
        ctx.strokeStyle = eq.color || '#38bdf8';
        ctx.lineWidth = eq.lineWidth || 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let started = false;
        let lastY = 0;

        for (let i = 0; i <= samples; i++) {
          const vx = xMin + i * dx;
          const vy = fn(vx);

          if (isNaN(vy) || !isFinite(vy)) {
            started = false;
            continue;
          }

          const sx = toScreenX(vx);
          const sy = toScreenY(vy);

          // Detect vertical asymptotic spikes (e.g. tan(x), 1/x)
          if (started && Math.abs(sy - lastY) > plotH * 0.75) {
            ctx.stroke();
            ctx.beginPath();
            started = false;
          }

          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
          lastY = sy;
        }
        ctx.stroke();
      });
    }

    ctx.restore(); // end clip

    // 7. Tick Labels (outside clip)
    if (g.showLabels) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // X tick labels
      const stepX = Math.pow(10, Math.floor(Math.log10(spanX / 6))) || 1;
      const firstX = Math.ceil(xMin / stepX) * stepX;
      for (let x = firstX; x <= xMax; x += stepX) {
        if (Math.abs(x) < 0.0001) continue;
        const sx = toScreenX(x);
        if (sx >= plotX + 10 && sx <= plotX + plotW - 10) {
          ctx.fillText(x.toString(), sx, plotY + plotH + 4);
        }
      }

      // Y tick labels
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const stepY = Math.pow(10, Math.floor(Math.log10(spanY / 5))) || 1;
      const firstY = Math.ceil(yMin / stepY) * stepY;
      for (let y = firstY; y <= yMax; y += stepY) {
        if (Math.abs(y) < 0.0001) continue;
        const sy = toScreenY(y);
        if (sy >= plotY + 10 && sy <= plotY + plotH - 10) {
          ctx.fillText(y.toString(), plotX - 5, sy);
        }
      }
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE EQUATION & RANGE MODAL DIALOG
  // ─────────────────────────────────────────────────────────────
  let editingGraph = null;

  function openEditor(graphShape) {
    editingGraph = graphShape;
    let modal = document.getElementById('graph-object-editor-modal');
    if (!modal) {
      modal = createEditorModal();
    }
    populateEditor(modal, graphShape);
    modal.classList.add('open');
  }

  function closeEditor() {
    const modal = document.getElementById('graph-object-editor-modal');
    if (modal) modal.classList.remove('open');
    editingGraph = null;
  }

  function createEditorModal() {
    const modal = document.createElement('div');
    modal.id = 'graph-object-editor-modal';
    modal.className = 'board-bg-modal';
    modal.innerHTML = `
      <div class="bbm-overlay" onclick="GraphObject.closeEditor()"></div>
      <div class="bbm-content" style="max-width:540px;">
        <div class="bbm-header">
          <div class="bbm-title-wrap">
            <span class="bbm-icon">📈</span>
            <div class="bbm-title">Edit Graph Equations</div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeEditor()">✕</button>
        </div>
        <div style="padding:18px 22px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;">
          <!-- Quick Presets -->
          <div>
            <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;">Quick Presets</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;" id="go-presets">
              <button class="bbm-tab" onclick="GraphObject.applyPreset('x^2')">y = x²</button>
              <button class="bbm-tab" onclick="GraphObject.applyPreset('sin(x)')">y = sin(x)</button>
              <button class="bbm-tab" onclick="GraphObject.applyPreset('cos(x)')">y = cos(x)</button>
              <button class="bbm-tab" onclick="GraphObject.applyPreset('abs(x)')">y = |x|</button>
              <button class="bbm-tab" onclick="GraphObject.applyPreset('1/x')">y = 1/x</button>
              <button class="bbm-tab" onclick="GraphObject.applyPreset('sqrt(x)')">y = √x</button>
              <button class="bbm-tab" onclick="GraphObject.applyPreset('2*x + 1')">y = 2x+1</button>
            </div>
          </div>

          <!-- Equations List -->
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Equations</span>
              <button class="bbm-tab" style="padding:3px 8px;font-size:11px;" onclick="GraphObject.addEquationRow()">＋ Add Function</button>
            </div>
            <div id="go-equations-list" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>

          <!-- Range Bounds -->
          <div>
            <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">Axis Limits [Min, Max]</div>
            <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
              <div>
                <label style="font-size:10px;color:#94a3b8;display:block;">X Min</label>
                <input type="number" id="go-xmin" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;">
              </div>
              <div>
                <label style="font-size:10px;color:#94a3b8;display:block;">X Max</label>
                <input type="number" id="go-xmax" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;">
              </div>
              <div>
                <label style="font-size:10px;color:#94a3b8;display:block;">Y Min</label>
                <input type="number" id="go-ymin" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;">
              </div>
              <div>
                <label style="font-size:10px;color:#94a3b8;display:block;">Y Max</label>
                <input type="number" id="go-ymax" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;">
              </div>
            </div>
          </div>

          <!-- Options -->
          <div style="display:flex;gap:16px;align-items:center;padding:8px 0;">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
              <input type="checkbox" id="go-show-grid" checked> Show Grid
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
              <input type="checkbox" id="go-show-axes" checked> Show Axes
            </label>
          </div>

          <!-- Save Button -->
          <button class="tb-btn" style="background:linear-gradient(135deg,#eab308,#f59e0b);color:#000;font-weight:800;justify-content:center;padding:10px;font-size:13px;" onclick="GraphObject.saveEditor()">
            ✓ Apply to Board
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function populateEditor(modal, g) {
    modal.querySelector('#go-xmin').value = g.xMin !== undefined ? g.xMin : -10;
    modal.querySelector('#go-xmax').value = g.xMax !== undefined ? g.xMax : 10;
    modal.querySelector('#go-ymin').value = g.yMin !== undefined ? g.yMin : -10;
    modal.querySelector('#go-ymax').value = g.yMax !== undefined ? g.yMax : 10;
    modal.querySelector('#go-show-grid').checked = g.showGrid !== false;
    modal.querySelector('#go-show-axes').checked = g.showAxes !== false;

    renderEquationRows(modal, g.equations || []);
  }

  function renderEquationRows(modal, eqs) {
    const list = modal.querySelector('#go-equations-list');
    list.innerHTML = '';

    eqs.forEach((eq, idx) => {
      const row = document.createElement('div');
      row.className = 'go-eq-row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;';
      row.innerHTML = `
        <span style="font-family:monospace;font-size:12px;font-weight:700;color:#94a3b8;">y =</span>
        <input type="text" class="go-expr-input" value="${eq.expr}" style="flex:1;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#f8fafc;font-family:monospace;font-size:13px;">
        <input type="color" class="go-color-input" value="${eq.color || '#38bdf8'}" style="width:34px;height:34px;border:none;border-radius:8px;background:transparent;cursor:pointer;">
        <button class="bbm-close" style="width:28px;height:28px;" title="Remove Equation" onclick="this.parentElement.remove()">✕</button>
      `;
      list.appendChild(row);
    });
  }

  function addEquationRow() {
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal) return;
    const list = modal.querySelector('#go-equations-list');
    const colors = ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24', '#c084fc', '#f97316'];
    const col = colors[list.children.length % colors.length];

    const row = document.createElement('div');
    row.className = 'go-eq-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    row.innerHTML = `
      <span style="font-family:monospace;font-size:12px;font-weight:700;color:#94a3b8;">y =</span>
      <input type="text" class="go-expr-input" value="x" style="flex:1;padding:7px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#f8fafc;font-family:monospace;font-size:13px;">
      <input type="color" class="go-color-input" value="${col}" style="width:34px;height:34px;border:none;border-radius:8px;background:transparent;cursor:pointer;">
      <button class="bbm-close" style="width:28px;height:28px;" title="Remove Equation" onclick="this.parentElement.remove()">✕</button>
    `;
    list.appendChild(row);
  }

  function applyPreset(expr) {
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal) return;
    const list = modal.querySelector('#go-equations-list');
    const input = list.querySelector('.go-expr-input');
    if (input) {
      input.value = expr;
    } else {
      addEquationRow();
      const last = list.querySelector('.go-expr-input:last-child');
      if (last) last.value = expr;
    }
  }

  function saveEditor() {
    if (!editingGraph) return;
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal) return;

    editingGraph.xMin = parseFloat(modal.querySelector('#go-xmin').value) || -10;
    editingGraph.xMax = parseFloat(modal.querySelector('#go-xmax').value) || 10;
    editingGraph.yMin = parseFloat(modal.querySelector('#go-ymin').value) || -10;
    editingGraph.yMax = parseFloat(modal.querySelector('#go-ymax').value) || 10;
    editingGraph.showGrid = modal.querySelector('#go-show-grid').checked;
    editingGraph.showAxes = modal.querySelector('#go-show-axes').checked;

    const newEqs = [];
    modal.querySelectorAll('.go-eq-row').forEach(row => {
      const expr = row.querySelector('.go-expr-input').value.trim();
      const color = row.querySelector('.go-color-input').value;
      if (expr) {
        newEqs.push({ expr, color, lineWidth: 2.5, visible: true });
      }
    });

    editingGraph.equations = newEqs;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }

    closeEditor();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('📈 Graph Equations Updated');
    }
  }

  // Insert a new graph object onto the board at center
  function insertGraphOnBoard(initialEq = 'x^2') {
    if (typeof Canvas === 'undefined') return;
    const size = Canvas.getCanvasSize ? Canvas.getCanvasSize() : { W: 1000, H: 700 };
    const w = 460, h = 320;
    const x = Math.max(80, (size.W - w) / 2);
    const y = Math.max(60, (size.H - h) / 2);

    const graphObj = create(x, y, w, h, {
      equations: [
        { expr: initialEq, color: '#38bdf8', lineWidth: 2.5, visible: true }
      ]
    });

    if (Canvas.addShapeObject) {
      Canvas.addShapeObject(graphObj);
    } else {
      const shapes = Canvas.getShapes ? Canvas.getShapes() : [];
      shapes.push(graphObj);
      if (Canvas.setShapes) Canvas.setShapes(shapes);
    }

    if (Canvas.selectShape) {
      Canvas.selectShape(graphObj);
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('📈 Interactive Graph added to Whiteboard! Double-tap to edit.');
    }
  }

  return {
    compile, create, draw,
    openEditor, closeEditor,
    addEquationRow, applyPreset, saveEditor,
    insertGraphOnBoard
  };
})();

if (typeof window !== 'undefined') {
  window.GraphObject = GraphObject;
}
