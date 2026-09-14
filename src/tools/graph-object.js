'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// PROFESSIONAL MATHEMATICAL GRAPHING ENGINE & WHITEBOARD GRAPH OBJECT
// Supports Linear, Quadratic, Cubic, Natural Logarithm (domain x > 0), Exponential
// Real-time coefficient sliders, equal scaling, smooth adaptive plotting,
// interactive point inspection, and classroom teaching tools.
// ═══════════════════════════════════════════════════════════════════════════════

const GraphObject = (() => {

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SAFE MATH EXPRESSION PARSER & EVALUATOR
  // ─────────────────────────────────────────────────────────────────────────────

  function normalize(str) {
    let s = (str || '').trim();
    // Strip leading y = or f(x) =
    s = s.replace(/^y\s*=\s*/i, '').replace(/^f\(x\)\s*=\s*/i, '');

    // Unicode superscripts
    s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4').replace(/⁵/g, '^5');
    s = s.replace(/ˣ/g, '^x').replace(/⁻/g, '^-').replace(/⁺/g, '^+').replace(/⁰/g, '^0').replace(/¹/g, '^1');
    s = s.replace(/π/g, 'pi');
    s = s.replace(/[·×]/g, '*');

    // e^... to exp(...)
    s = s.replace(/e\^\(([^)]+)\)/gi, 'exp($1)');
    s = s.replace(/e\^([a-z0-9_]+)/gi, 'exp($1)');

    // ln ... to ln(...)
    s = s.replace(/ln\s+([a-z0-9_.]+)/gi, 'ln($1)');

    // Implicit multiplication: number followed by variable or function or '('
    s = s.replace(/(\d(?:\.\d+)?)\s*([a-z(])/gi, '$1*$2');
    // ')' followed by number or variable or '('
    s = s.replace(/(\))\s*([0-9a-z(])/gi, '$1*$2');
    // variable followed by '('
    s = s.replace(/\b([xy])\s*\(/gi, '$1*(');
    // ')' followed by variable
    s = s.replace(/(\))\s*([xy])/gi, '$1*$2');

    // Negative variable: -x -> -1*x, -y -> -1*y
    s = s.replace(/(^|[(\-+*\/^])\s*-\s*([xy])\b/gi, '$1-1*$2');

    return s;
  }

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
        if (ident === 'x' || ident === 'y') {
          tokens.push({ type: 'var', val: ident });
        } else if (ident === 'pi') {
          tokens.push({ type: 'num', val: Math.PI });
        } else if (ident === 'e') {
          tokens.push({ type: 'num', val: Math.E });
        } else if (['sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'abs', 'sqrt', 'ln', 'log', 'exp'].includes(ident)) {
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

  function compile(exprStr) {
    try {
      const cleaned = normalize(exprStr);
      const tokens = tokenize(cleaned);
      const rpn = infixToRPN(tokens);

      return function evaluate(val) {
        const stack = [];
        for (const t of rpn) {
          if (t.type === 'num') {
            stack.push(t.val);
          } else if (t.type === 'var') {
            stack.push(val);
          } else if (t.type === 'fn') {
            const a = stack.pop();
            switch (t.val) {
              case 'sin': stack.push(Math.sin(a)); break;
              case 'cos': stack.push(Math.cos(a)); break;
              case 'tan': {
                const cVal = Math.cos(a);
                stack.push(Math.abs(cVal) < 1e-11 ? NaN : Math.tan(a));
                break;
              }
              case 'csc': {
                const sVal = Math.sin(a);
                stack.push(Math.abs(sVal) < 1e-11 ? NaN : 1 / sVal);
                break;
              }
              case 'sec': {
                const cVal = Math.cos(a);
                stack.push(Math.abs(cVal) < 1e-11 ? NaN : 1 / cVal);
                break;
              }
              case 'cot': {
                const sVal = Math.sin(a);
                stack.push(Math.abs(sVal) < 1e-11 ? NaN : Math.cos(a) / sVal);
                break;
              }
              case 'abs': stack.push(Math.abs(a)); break;
              case 'sqrt': stack.push(a < 0 ? NaN : Math.sqrt(a)); break;
              case 'ln': stack.push(a <= 0 ? NaN : Math.log(a)); break;
              case 'log': stack.push(a <= 0 ? NaN : (Math.log10 ? Math.log10(a) : Math.log(a) / Math.LN10)); break;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. COEFFICIENT FORMATTERS (For Classroom Teaching Presets)
  // ─────────────────────────────────────────────────────────────────────────────

  function formatLinear(m, c) {
    let mPart = '';
    if (m === 0) {
      return (c !== undefined && c !== null) ? `${c}` : '0';
    } else if (m === 1) {
      mPart = 'x';
    } else if (m === -1) {
      mPart = '-x';
    } else {
      mPart = `${m}x`;
    }

    if (!c || c === 0) return mPart;
    const sign = c > 0 ? '+ ' : '- ';
    return `${mPart} ${sign}${Math.abs(c)}`;
  }

  function formatQuadratic(a, b, c) {
    let parts = [];
    if (a !== 0) {
      if (a === 1) parts.push('x²');
      else if (a === -1) parts.push('-x²');
      else parts.push(`${a}x²`);
    }
    if (b !== 0) {
      let bStr = '';
      if (parts.length > 0) {
        const sign = b > 0 ? '+ ' : '- ';
        const absB = Math.abs(b);
        bStr = sign + (absB === 1 ? 'x' : `${absB}x`);
      } else {
        bStr = b === 1 ? 'x' : (b === -1 ? '-x' : `${b}x`);
      }
      parts.push(bStr);
    }
    if (c !== 0 || parts.length === 0) {
      if (parts.length > 0) {
        const sign = c >= 0 ? '+ ' : '- ';
        parts.push(sign + Math.abs(c));
      } else {
        parts.push(`${c}`);
      }
    }
    return parts.join(' ');
  }

  function formatHorizontalQuadratic(a, b, c) {
    let parts = [];
    if (a !== 0) {
      if (a === 1) parts.push('y²');
      else if (a === -1) parts.push('-y²');
      else parts.push(`${a}y²`);
    }
    if (b !== 0) {
      let bStr = '';
      if (parts.length > 0) {
        const sign = b > 0 ? '+ ' : '- ';
        const absB = Math.abs(b);
        bStr = sign + (absB === 1 ? 'y' : `${absB}y`);
      } else {
        bStr = b === 1 ? 'y' : (b === -1 ? '-y' : `${b}y`);
      }
      parts.push(bStr);
    }
    if (c !== 0 || parts.length === 0) {
      if (parts.length > 0) {
        const sign = c >= 0 ? '+ ' : '- ';
        parts.push(sign + Math.abs(c));
      } else {
        parts.push(`${c}`);
      }
    }
    return parts.join(' ');
  }

  function formatCubic(a, b, c, d) {
    let parts = [];
    if (a !== 0) {
      if (a === 1) parts.push('x³');
      else if (a === -1) parts.push('-x³');
      else parts.push(`${a}x³`);
    }
    if (b !== 0) {
      if (parts.length > 0) {
        const sign = b > 0 ? '+ ' : '- ';
        const absB = Math.abs(b);
        parts.push(sign + (absB === 1 ? 'x²' : `${absB}x²`));
      } else {
        parts.push(b === 1 ? 'x²' : (b === -1 ? '-x²' : `${b}x²`));
      }
    }
    if (c !== 0) {
      if (parts.length > 0) {
        const sign = c > 0 ? '+ ' : '- ';
        const absC = Math.abs(c);
        parts.push(sign + (absC === 1 ? 'x' : `${absC}x`));
      } else {
        parts.push(c === 1 ? 'x' : (c === -1 ? '-x' : `${c}x`));
      }
    }
    if (d !== 0 || parts.length === 0) {
      if (parts.length > 0) {
        const sign = d >= 0 ? '+ ' : '- ';
        parts.push(sign + Math.abs(d));
      } else {
        parts.push(`${d}`);
      }
    }
    return parts.join(' ');
  }

  function formatExponential(a, b, c) {
    const baseVal = b !== undefined ? b : 2;
    let baseStr = (baseVal === 2.718 || Math.abs(baseVal - Math.E) < 0.01) ? 'eˣ' : `${baseVal}ˣ`;
    let aStr = '';
    const aVal = a !== undefined ? a : 1;
    if (aVal === 1) aStr = baseStr;
    else if (aVal === -1) aStr = `-${baseStr}`;
    else aStr = `${aVal}·${baseStr}`;

    const cVal = c !== undefined ? c : 0;
    if (!cVal || cVal === 0) return aStr;
    const sign = cVal > 0 ? '+ ' : '- ';
    return `${aStr} ${sign}${Math.abs(cVal)}`;
  }

  function formatLogarithmic(a, h, k) {
    const aVal = a !== undefined ? a : 1;
    const hVal = h !== undefined ? h : 0;
    const kVal = k !== undefined ? k : 0;

    let inner = 'x';
    if (hVal > 0) inner = `x - ${hVal}`;
    else if (hVal < 0) inner = `x + ${Math.abs(hVal)}`;

    let main = `ln(${inner})`;
    if (aVal === -1) main = `-${main}`;
    else if (aVal !== 1) main = `${aVal}·${main}`;

    if (!kVal || kVal === 0) return main;
    const sign = kVal > 0 ? '+ ' : '- ';
    return `${main} ${sign}${Math.abs(kVal)}`;
  }

  function formatTrig(fnName, a, b, c, d) {
    const aVal = a !== undefined ? a : 1;
    const bVal = b !== undefined ? b : 1;
    const cVal = c !== undefined ? c : 0;
    const dVal = d !== undefined ? d : 0;

    let bStr = '';
    if (bVal === 1) bStr = 'x';
    else if (bVal === -1) bStr = '-x';
    else bStr = `${bVal}x`;

    let inner = bStr;
    if (cVal && cVal !== 0) {
      const sign = cVal > 0 ? '+ ' : '- ';
      inner = `${bStr} ${sign}${Math.abs(cVal)}`;
    }

    let core = `${fnName}(${inner})`;
    if (aVal === -1) core = `-${core}`;
    else if (aVal !== 1) core = `${aVal}·${core}`;

    if (!dVal || dVal === 0) return core;
    const sign = dVal > 0 ? '+ ' : '- ';
    return `${core} ${sign}${Math.abs(dVal)}`;
  }

  function formatPeriod(isPi, b) {
    const absB = Math.abs(b) || 1;
    const numPi = isPi ? 1 : 2;
    const val = (numPi * Math.PI) / absB;
    const approx = Math.round(val * 100) / 100;

    let exact = '';
    if (Math.abs(absB - Math.PI) < 0.01) {
      exact = `${numPi}`;
    } else if (Math.abs(absB - 1) < 0.001) {
      exact = numPi === 1 ? 'π' : '2π';
    } else if (Math.abs(absB - 2) < 0.001) {
      exact = numPi === 1 ? 'π/2' : 'π';
    } else if (Math.abs(absB - 3) < 0.001) {
      exact = numPi === 1 ? 'π/3' : '2π/3';
    } else if (Math.abs(absB - 4) < 0.001) {
      exact = numPi === 1 ? 'π/4' : 'π/2';
    } else if (Math.abs(absB - 0.5) < 0.001) {
      exact = numPi === 1 ? '2π' : '4π';
    } else {
      exact = `${numPi}π/${absB}`;
    }
    return { exact, approx, raw: val };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. FACTORY: CREATE GRAPH BOARD OBJECT
  // ─────────────────────────────────────────────────────────────────────────────

  function create(x, y, w, h, options = {}) {
    return {
      id: 'graph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'graph',
      x: x || 120,
      y: y || 80,
      w: w || 520,
      h: h || 380,
      xMin: options.xMin !== undefined ? options.xMin : -10,
      xMax: options.xMax !== undefined ? options.xMax : 10,
      yMin: options.yMin !== undefined ? options.yMin : -10,
      yMax: options.yMax !== undefined ? options.yMax : 10,
      equalAspect: options.equalAspect !== undefined ? options.equalAspect : true,
      equations: options.equations || [
        { id: 1, label: 'f₁(x)', expr: 'x²', color: '#38bdf8', lineWidth: 2.8, visible: true },
        { id: 2, label: 'f₂(x)', expr: '2x', color: '#fbbf24', lineWidth: 2.5, visible: true }
      ],
      title: options.title || 'Mathematical Graph',
      showGrid: options.showGrid !== undefined ? options.showGrid : true,
      showMinorGrid: options.showMinorGrid !== undefined ? options.showMinorGrid : true,
      showAxes: options.showAxes !== undefined ? options.showAxes : true,
      showLabels: options.showLabels !== undefined ? options.showLabels : true,
      color: '#38bdf8',

      // Interactive teaching state
      activeTemplate: options.activeTemplate || 'quadratic', // 'linear', 'quadratic', 'cubic', 'exp', 'ln'
      params: options.params || { a: 1, b: 0, c: 0, d: 0 },
      hoverPoint: null // { x, y, sx, sy, expr, color }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. HIGH-PRECISION GRAPH RENDERER
  // ─────────────────────────────────────────────────────────────────────────────

  function draw(ctx, g) {
    if (!g || g.w <= 0 || g.h <= 0) return;

    ctx.save();

    const gx = g.x, gy = g.y, gw = g.w, gh = g.h;

    // Outer Container (Modern Dark Glass Panel with Sleek Shadow)
    ctx.fillStyle = 'rgba(10, 16, 32, 0.95)';
    ctx.strokeStyle = g.selected ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = g.selected ? 2.5 : 1.5;

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx, gy, gw, gh, 14);
    else ctx.rect(gx, gy, gw, gh);
    ctx.fill();
    ctx.stroke();

    // Header Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx, gy, gw, 38, [14, 14, 0, 0]);
    else ctx.rect(gx, gy, gw, 38);
    ctx.fill();

    // Title & Equal Aspect Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`📈 ${g.title || 'Math Graph'}`, gx + 14, gy + 19);

    if (g.equalAspect) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(gx + 155, gy + 9, 72, 20, 10);
      else ctx.rect(gx + 155, gy + 9, 72, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 10.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1:1 Scale', gx + 191, gy + 19);
    }

    // Quick Action Header Buttons (Edit, Reset, Zoom In, Zoom Out)
    drawHeaderButtons(ctx, g);

    // Plot Viewport Bounds
    const padL = 42, padR = 20, padT = 48, padB = 30;
    const plotX = gx + padL;
    const plotY = gy + padT;
    const plotW = Math.max(30, gw - padL - padR);
    const plotH = Math.max(30, gh - padT - padB);

    // Coordinate Mapping (with optional Equal Aspect Ratio 1 unit x = 1 unit y)
    let xMin = g.xMin !== undefined ? g.xMin : -10;
    let xMax = g.xMax !== undefined ? g.xMax : 10;
    let yMin = g.yMin !== undefined ? g.yMin : -10;
    let yMax = g.yMax !== undefined ? g.yMax : 10;

    let spanX = Math.max(0.0001, xMax - xMin);
    let spanY = Math.max(0.0001, yMax - yMin);

    if (g.equalAspect) {
      const targetRatio = plotW / plotH;
      const currentRatio = spanX / spanY;
      const cy = (yMin + yMax) / 2;
      const cx = (xMin + xMax) / 2;

      if (currentRatio < targetRatio) {
        // Expand X span to match width
        const newSpanX = spanY * targetRatio;
        xMin = cx - newSpanX / 2;
        xMax = cx + newSpanX / 2;
        spanX = newSpanX;
      } else {
        // Expand Y span to match height
        const newSpanY = spanX / targetRatio;
        yMin = cy - newSpanY / 2;
        yMax = cy + newSpanY / 2;
        spanY = newSpanY;
      }
    }

    function toScreenX(x) {
      return plotX + ((x - xMin) / spanX) * plotW;
    }
    function toScreenY(y) {
      return plotY + plotH - ((y - yMin) / spanY) * plotH;
    }
    function toGraphX(sx) {
      return xMin + ((sx - plotX) / plotW) * spanX;
    }
    function toGraphY(sy) {
      return yMin + ((plotY + plotH - sy) / plotH) * spanY;
    }

    // Clip plot region
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotW, plotH);
    ctx.clip();

    // ── Grid Lines (Major & Minor) ──
    if (g.showGrid) {
      const stepX = calcNiceStep(spanX, Math.max(4, Math.floor(plotW / 65)));
      const stepY = calcNiceStep(spanY, Math.max(4, Math.floor(plotH / 55)));

      // Minor grid
      if (g.showMinorGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = 0.8;
        const minorStepX = stepX / 5;
        const firstMinorX = Math.floor(xMin / minorStepX) * minorStepX;
        for (let x = firstMinorX; x <= xMax; x += minorStepX) {
          const sx = toScreenX(x);
          ctx.beginPath();
          ctx.moveTo(sx, plotY);
          ctx.lineTo(sx, plotY + plotH);
          ctx.stroke();
        }

        const minorStepY = stepY / 5;
        const firstMinorY = Math.floor(yMin / minorStepY) * minorStepY;
        for (let y = firstMinorY; y <= yMax; y += minorStepY) {
          const sy = toScreenY(y);
          ctx.beginPath();
          ctx.moveTo(plotX, sy);
          ctx.lineTo(plotX + plotW, sy);
          ctx.stroke();
        }
      }

      // Major grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1;

      const firstMajorX = Math.floor(xMin / stepX) * stepX;
      for (let x = firstMajorX; x <= xMax; x += stepX) {
        const sx = toScreenX(x);
        ctx.beginPath();
        ctx.moveTo(sx, plotY);
        ctx.lineTo(sx, plotY + plotH);
        ctx.stroke();
      }

      const firstMajorY = Math.floor(yMin / stepY) * stepY;
      for (let y = firstMajorY; y <= yMax; y += stepY) {
        const sy = toScreenY(y);
        ctx.beginPath();
        ctx.moveTo(plotX, sy);
        ctx.lineTo(plotX + plotW, sy);
        ctx.stroke();
      }
    }

    // ── Axes with Arrowheads & Origin ──
    if (g.showAxes) {
      ctx.strokeStyle = '#94a3b8';
      ctx.fillStyle = '#94a3b8';
      ctx.lineWidth = 1.8;

      const originX = toScreenX(0);
      const originY = toScreenY(0);

      // X Axis
      if (originY >= plotY - 10 && originY <= plotY + plotH + 10) {
        ctx.beginPath();
        ctx.moveTo(plotX, originY);
        ctx.lineTo(plotX + plotW, originY);
        ctx.stroke();

        // Right Arrowhead
        drawArrowhead(ctx, plotX + plotW, originY, 0, 7);

        // 'X' label
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('x', plotX + plotW - 12, originY - 6);
      }

      // Y Axis
      if (originX >= plotX - 10 && originX <= plotX + plotW + 10) {
        ctx.beginPath();
        ctx.moveTo(originX, plotY + plotH);
        ctx.lineTo(originX, plotY);
        ctx.stroke();

        // Top Arrowhead
        drawArrowhead(ctx, originX, plotY, -Math.PI / 2, 7);

        // 'Y' label
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('y', originX + 8, plotY + 12);
      }
    }

    // ── Draw Curves (High-density adaptive sampling + Domain & Asymptote Handling) ──
    // ── Educational Asymptotes & Midline Guides ──
    if (g.activeTemplate === 'exp' && g.params && g.params.c !== undefined) {
      const asympY = toScreenY(g.params.c);
      if (asympY >= plotY && asympY <= plotY + plotH) {
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(plotX, asympY);
        ctx.lineTo(plotX + plotW, asympY);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 9.5px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Horiz. Asymptote y = ${g.params.c}`, plotX + plotW - 6, asympY - 4);
        ctx.restore();
      }
    } else if (g.activeTemplate === 'ln' && g.params && g.params.h !== undefined) {
      const asympX = toScreenX(g.params.h);
      if (asympX >= plotX && asympX <= plotX + plotW) {
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(asympX, plotY);
        ctx.lineTo(asympX, plotY + plotH);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 9.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Vert. Asymptote x = ${g.params.h}`, asympX + 6, plotY + 14);
        ctx.restore();
      }
    } else if (g.activeTemplate && g.activeTemplate.startsWith('trig_') && g.params && g.params.d !== 0 && g.params.d !== undefined) {
      const midY = toScreenY(g.params.d);
      if (midY >= plotY && midY <= plotY + plotH) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(plotX, midY);
        ctx.lineTo(plotX + plotW, midY);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '9.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Midline y = ${g.params.d}`, plotX + 8, midY - 4);
        ctx.restore();
      }
    }

    // ── Draw Curves (High-density adaptive sampling + Domain & Asymptote Handling) ──
    if (g.equations && g.equations.length) {
      const numSamples = Math.min(1400, Math.max(350, Math.round(plotW * 2.8)));
      const dx = spanX / numSamples;
      const numSamplesY = Math.min(1400, Math.max(350, Math.round(plotH * 2.8)));
      const dy = spanY / numSamplesY;

      g.equations.forEach(eq => {
        if (!eq.visible || !eq.expr) return;

        const isHorizontal = eq.isXEquals || (g.activeTemplate === 'quadratic_horizontal');
        const fn = compile(eq.expr);
        ctx.strokeStyle = eq.color || '#38bdf8';
        ctx.lineWidth = eq.lineWidth || 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let started = false;
        let lastCoord = 0;

        if (isHorizontal) {
          // Horizontal Curve: x = f(y) (sample along y-axis)
          for (let i = 0; i <= numSamplesY; i++) {
            const vy = yMin + i * dy;
            const vx = fn(vy);

            if (isNaN(vx) || !isFinite(vx)) {
              started = false;
              continue;
            }

            const sx = toScreenX(vx);
            const sy = toScreenY(vy);

            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          ctx.stroke();
        } else {
          // Standard Vertical Curve: y = f(x) (sample along x-axis)
          const isLog = /ln/i.test(eq.expr) || g.activeTemplate === 'ln';
          const logMinX = (g.params && g.params.h !== undefined) ? g.params.h : 0;

          for (let i = 0; i <= numSamples; i++) {
            let vx = xMin + i * dx;

            // Logarithm domain enforcement: strictly x > h
            if (isLog && vx <= logMinX) {
              started = false;
              continue;
            }

            const vy = fn(vx);

            if (isNaN(vy) || !isFinite(vy)) {
              started = false;
              continue;
            }

            const sx = toScreenX(vx);
            const sy = toScreenY(vy);

            // Discontinuity & vertical asymptote jump detection (e.g. tan, sec, csc, cot, 1/x)
            if (started && Math.abs(sy - lastCoord) > plotH * 0.7) {
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
            lastCoord = sy;
          }
          ctx.stroke();
        }
      });
    }

    // ── Interactive Hover Point Display ──
    if (g.hoverPoint) {
      const hp = g.hoverPoint;
      ctx.fillStyle = hp.color || '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(hp.sx, hp.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore(); // end clip

    // ── Numerical Tick Labels ──
    if (g.showLabels) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';

      const stepX = calcNiceStep(spanX, Math.max(4, Math.floor(plotW / 65)));
      const stepY = calcNiceStep(spanY, Math.max(4, Math.floor(plotH / 55)));

      const originX = toScreenX(0);
      const originY = toScreenY(0);

      // Label Origin
      if (originX >= plotX + 10 && originX <= plotX + plotW - 10 &&
          originY >= plotY + 10 && originY <= plotY + plotH - 10) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('0', originX - 4, originY + 4);
      }

      // X tick labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const firstX = Math.floor(xMin / stepX) * stepX;
      for (let x = firstX; x <= xMax; x += stepX) {
        if (Math.abs(x) < 1e-6) continue;
        const sx = toScreenX(x);
        if (sx >= plotX + 14 && sx <= plotX + plotW - 14) {
          const yPos = (originY >= plotY && originY <= plotY + plotH - 18) ? originY + 4 : plotY + plotH + 4;
          ctx.fillText(formatNumber(x), sx, yPos);
        }
      }

      // Y tick labels
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const firstY = Math.floor(yMin / stepY) * stepY;
      for (let y = firstY; y <= yMax; y += stepY) {
        if (Math.abs(y) < 1e-6) continue;
        const sy = toScreenY(y);
        if (sy >= plotY + 10 && sy <= plotY + plotH - 10) {
          const xPos = (originX >= plotX + 24 && originX <= plotX + plotW) ? originX - 5 : plotX - 5;
          ctx.fillText(formatNumber(y), xPos, sy);
        }
      }
    }

    // ── Hover Tooltip Pill ──
    if (g.hoverPoint) {
      const hp = g.hoverPoint;
      const text = `(${formatNumber(hp.x, 2)}, ${formatNumber(hp.y, 2)})`;
      ctx.font = 'bold 11px monospace';
      const tw = ctx.measureText(text).width;
      const pillW = tw + 18;
      const pillH = 22;
      const px = Math.min(plotX + plotW - pillW - 6, Math.max(plotX + 6, hp.sx - pillW / 2));
      const py = hp.sy - 30 > plotY ? hp.sy - 30 : hp.sy + 12;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = hp.color || '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, pillW, pillH, 6);
      else ctx.rect(px, py, pillW, pillH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px + pillW / 2, py + pillH / 2);
    }

    ctx.restore();
  }

  // Helper: Draw header buttons on graph object
  function drawHeaderButtons(ctx, g) {
    const gx = g.x, gy = g.y, gw = g.w;
    const btnSize = 22;
    let right = gx + gw - 12;

    // Button 1: Settings / Studio Edit
    drawMiniButton(ctx, right - btnSize, gy + 8, btnSize, btnSize, '⚙️', 'Edit Graph');
    right -= (btnSize + 6);

    // Button 2: Reset View
    drawMiniButton(ctx, right - btnSize, gy + 8, btnSize, btnSize, '⤢', 'Reset View');
    right -= (btnSize + 6);

    // Button 3: Zoom In
    drawMiniButton(ctx, right - btnSize, gy + 8, btnSize, btnSize, '＋', 'Zoom In');
    right -= (btnSize + 6);

    // Button 4: Zoom Out
    drawMiniButton(ctx, right - btnSize, gy + 8, btnSize, btnSize, '−', 'Zoom Out');
  }

  function drawMiniButton(ctx, bx, by, bw, bh, icon, title) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5);
    else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, bx + bw / 2, by + bh / 2);
  }

  function drawArrowhead(ctx, x, y, angle, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.5);
    ctx.lineTo(-size, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function calcNiceStep(range, maxTicks) {
    const rawStep = range / maxTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const fraction = rawStep / mag;
    let niceFraction = 1;
    if (fraction >= 1.5 && fraction < 3.5) niceFraction = 2;
    else if (fraction >= 3.5 && fraction < 7.5) niceFraction = 5;
    else if (fraction >= 7.5) niceFraction = 10;
    return niceFraction * mag;
  }

  function formatNumber(val, decimals = 1) {
    if (Math.abs(val) < 1e-6) return '0';
    if (Math.abs(val) >= 10000 || (Math.abs(val) < 0.01 && Math.abs(val) > 0)) {
      return val.toExponential(1);
    }
    const fixed = val.toFixed(decimals);
    return fixed.replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ON-BOARD INTERACTION (PAN, ZOOM, HOVER INSPECTION, BUTTON CLICKS)
  // ─────────────────────────────────────────────────────────────────────────────

  function handlePointerMove(g, bx, by) {
    if (!g) return false;
    const gx = g.x, gy = g.y, gw = g.w, gh = g.h;
    if (bx < gx || bx > gx + gw || by < gy || by > gy + gh) {
      if (g.hoverPoint) {
        g.hoverPoint = null;
        return true;
      }
      return false;
    }

    const padL = 42, padR = 20, padT = 48, padB = 30;
    const plotX = gx + padL, plotY = gy + padT;
    const plotW = gw - padL - padR, plotH = gh - padT - padB;

    if (bx >= plotX && bx <= plotX + plotW && by >= plotY && by <= plotY + plotH) {
      const spanX = Math.max(0.0001, g.xMax - g.xMin);
      const spanY = Math.max(0.0001, g.yMax - g.yMin);
      const graphX = g.xMin + ((bx - plotX) / plotW) * spanX;
      const graphY = g.yMin + ((plotY + plotH - by) / plotH) * spanY;

      // Find closest curve
      let closest = null;
      let minDiff = Infinity;

      if (g.equations) {
        g.equations.forEach(eq => {
          if (!eq.visible || !eq.expr) return;
          const fn = compile(eq.expr);
          const curveY = fn(graphX);
          if (isNaN(curveY) || !isFinite(curveY)) return;

          const screenCurveY = plotY + plotH - ((curveY - g.yMin) / spanY) * plotH;
          const diff = Math.abs(by - screenCurveY);
          if (diff < 40 && diff < minDiff) {
            minDiff = diff;
            closest = {
              x: graphX,
              y: curveY,
              sx: bx,
              sy: screenCurveY,
              color: eq.color,
              expr: eq.expr
            };
          }
        });
      }

      g.hoverPoint = closest;
      return true;
    } else {
      if (g.hoverPoint) {
        g.hoverPoint = null;
        return true;
      }
    }
    return false;
  }

  function handlePointerClick(g, bx, by) {
    if (!g) return false;
    const gx = g.x, gy = g.y, gw = g.w;
    const btnSize = 22;

    // Check header buttons (Edit, Reset, Zoom In, Zoom Out)
    let right = gx + gw - 12;

    // Button 1: Settings / Edit
    if (bx >= right - btnSize && bx <= right && by >= gy + 8 && by <= gy + 8 + btnSize) {
      openEditor(g);
      return true;
    }
    right -= (btnSize + 6);

    // Button 2: Reset View
    if (bx >= right - btnSize && bx <= right && by >= gy + 8 && by <= gy + 8 + btnSize) {
      resetView(g);
      return true;
    }
    right -= (btnSize + 6);

    // Button 3: Zoom In
    if (bx >= right - btnSize && bx <= right && by >= gy + 8 && by <= gy + 8 + btnSize) {
      zoom(g, 0.8);
      return true;
    }
    right -= (btnSize + 6);

    // Button 4: Zoom Out
    if (bx >= right - btnSize && bx <= right && by >= gy + 8 && by <= gy + 8 + btnSize) {
      zoom(g, 1.25);
      return true;
    }

    return false;
  }

  function pan(g, dxPx, dyPx) {
    if (!g) return;
    const padL = 42, padR = 20, padT = 48, padB = 30;
    const plotW = Math.max(30, g.w - padL - padR);
    const plotH = Math.max(30, g.h - padT - padB);

    const spanX = g.xMax - g.xMin;
    const spanY = g.yMax - g.yMin;

    const dxGraph = (dxPx / plotW) * spanX;
    const dyGraph = (dyPx / plotH) * spanY;

    g.xMin -= dxGraph;
    g.xMax -= dxGraph;
    g.yMin += dyGraph;
    g.yMax += dyGraph;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function zoom(g, factor) {
    if (!g) return;
    const cx = (g.xMin + g.xMax) / 2;
    const cy = (g.yMin + g.yMax) / 2;
    const halfSpanX = ((g.xMax - g.xMin) / 2) * factor;
    const halfSpanY = ((g.yMax - g.yMin) / 2) * factor;

    g.xMin = cx - halfSpanX;
    g.xMax = cx + halfSpanX;
    g.yMin = cy - halfSpanY;
    g.yMax = cy + halfSpanY;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
  }

  function resetView(g) {
    if (!g) return;
    g.xMin = -10;
    g.xMax = 10;
    g.yMin = -10;
    g.yMax = 10;
    g.hoverPoint = null;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Graph View Reset to Default (-10 to 10)');
    }
  }

  function clearAllEquations(g) {
    if (!g) return;
    g.equations = [];
    g.hoverPoint = null;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Cleared All Functions');
    }
  }

  function autoScaleView(g) {
    if (!g || !g.equations || g.equations.length === 0) return;

    let globalYMin = Infinity;
    let globalYMax = -Infinity;
    let domainXMin = -5;
    let domainXMax = 5;

    // Check if any equation is ln(x)
    const hasLog = g.equations.some(eq => /ln/i.test(eq.expr));
    if (hasLog) {
      domainXMin = 0.05;
      domainXMax = 8;
    }

    const testPoints = 100;
    const dx = (domainXMax - domainXMin) / testPoints;

    g.equations.forEach(eq => {
      if (!eq.visible || !eq.expr) return;
      const fn = compile(eq.expr);
      for (let i = 0; i <= testPoints; i++) {
        const x = domainXMin + i * dx;
        const y = fn(x);
        if (typeof y === 'number' && isFinite(y) && !isNaN(y)) {
          if (y < globalYMin) globalYMin = y;
          if (y > globalYMax) globalYMax = y;
        }
      }
    });

    if (globalYMin !== Infinity && globalYMax !== -Infinity) {
      const padY = Math.max(1, (globalYMax - globalYMin) * 0.2);
      g.xMin = domainXMin;
      g.xMax = domainXMax;
      g.yMin = Math.floor(globalYMin - padY);
      g.yMax = Math.ceil(globalYMax + padY);

      if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
        Canvas.renderShapes();
        if (Canvas.saveHistory) Canvas.saveHistory();
      }
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Smart Auto-Scaled Visible Range');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CLASSROOM GRAPH STUDIO MODAL & COEFFICIENT SLIDERS
  // ─────────────────────────────────────────────────────────────────────────────

  let editingGraph = null;
  let activeModalTab = 'templates'; // 'templates', 'sliders', 'functions', 'settings'

  function openEditor(graphShape) {
    editingGraph = graphShape;
    let modal = document.getElementById('graph-object-editor-modal');
    if (!modal) {
      modal = createEditorModal();
    }
    modal.classList.add('open');
    switchStudioTab(activeModalTab);
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
      <div class="bbm-content" style="max-width:580px;border:1px solid rgba(56,189,248,0.35);box-shadow:0 20px 50px rgba(0,0,0,0.7);">
        <!-- Header -->
        <div class="bbm-header" style="background:rgba(15,23,42,0.8);border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 20px;">
          <div class="bbm-title-wrap">
            <span class="bbm-icon" style="font-size:20px;">📊</span>
            <div>
              <div class="bbm-title" style="font-size:16px;font-weight:700;">Mathematical Graph Studio</div>
              <div style="font-size:11px;color:#94a3b8;">Classroom Algebra & Function Teaching Lab</div>
            </div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeEditor()">✕</button>
        </div>

        <!-- Studio Navigation Tabs -->
        <div style="display:flex;background:rgba(8,15,31,0.9);border-bottom:1px solid rgba(255,255,255,0.08);padding:0 14px;">
          <button class="gos-tab active" id="gos-tab-templates" onclick="GraphObject.switchStudioTab('templates')">📐 Templates</button>
          <button class="gos-tab" id="gos-tab-sliders" onclick="GraphObject.switchStudioTab('sliders')">🔢 Parameters (a, b, c)</button>
          <button class="gos-tab" id="gos-tab-functions" onclick="GraphObject.switchStudioTab('functions')">📝 Function List</button>
          <button class="gos-tab" id="gos-tab-settings" onclick="GraphObject.switchStudioTab('settings')">⚙️ Axes & Grid</button>
        </div>

        <!-- Main Body Content -->
        <div id="gos-body" style="padding:20px;max-height:480px;overflow-y:auto;display:flex;flex-direction:column;gap:16px;">
          <!-- Dynamically populated by switchStudioTab -->
        </div>

        <!-- Footer Action Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.95);border-top:1px solid rgba(255,255,255,0.08);padding:12px 20px;">
          <div style="display:flex;gap:8px;">
            <button class="tb-btn" style="background:rgba(255,255,255,0.08);color:#94a3b8;font-size:12px;padding:6px 12px;" onclick="GraphObject.autoScaleView(GraphObject.getEditingGraph())">
              ✨ Auto Scale
            </button>
            <button class="tb-btn" style="background:rgba(255,255,255,0.08);color:#94a3b8;font-size:12px;padding:6px 12px;" onclick="GraphObject.resetView(GraphObject.getEditingGraph())">
              ⤢ Reset View
            </button>
          </div>
          <button class="tb-btn" style="background:linear-gradient(135deg,#38bdf8,#0284c7);color:#ffffff;font-weight:700;padding:8px 20px;font-size:13px;" onclick="GraphObject.saveEditor()">
            ✓ Apply to Board
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function switchStudioTab(tabName) {
    activeModalTab = tabName;
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal) return;

    modal.querySelectorAll('.gos-tab').forEach(b => {
      b.classList.toggle('active', b.id === `gos-tab-${tabName}`);
    });

    const body = modal.querySelector('#gos-body');
    if (!body || !editingGraph) return;

    if (tabName === 'templates') {
      renderTemplatesTab(body, editingGraph);
    } else if (tabName === 'sliders') {
      renderSlidersTab(body, editingGraph);
    } else if (tabName === 'functions') {
      renderFunctionsTab(body, editingGraph);
    } else if (tabName === 'settings') {
      renderSettingsTab(body, editingGraph);
    }
  }

  // Tab 1: Presets & Templates (Reorganized into Algebraic & Trigonometric Sections)
  function renderTemplatesTab(container, g) {
    container.innerHTML = `
      <div style="font-size:13px;color:#cbd5e1;line-height:1.5;margin-bottom:14px;">
        Select a standard mathematical function family to explore interactive curves with real-time parameter controls:
      </div>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- SECTION 1 — ALGEBRAIC FUNCTIONS                             -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <div class="gos-section-block">
        <div class="gos-section-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="gos-section-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;border-color:rgba(56,189,248,0.35);">
              SECTION 1
            </span>
            <span style="font-weight:800;font-size:14px;color:#f8fafc;letter-spacing:0.02em;">
              📐 Algebraic Functions
            </span>
          </div>
          <span style="font-size:11px;color:#94a3b8;">Lines, Polynomials, Exponentials & Logarithms</span>
        </div>

        <div class="gos-templates-grid">
          <!-- 1. Linear Function -->
          <div class="gos-template-card" onclick="GraphObject.applyTemplate('linear')">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#38bdf8;font-size:14px;">📏 Linear Function</span>
              <span class="gos-math-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;">y = mx + c</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;line-height:1.45;">
              <strong style="color:#e2e8f0;">m</strong> = slope / gradient, <strong style="color:#e2e8f0;">c</strong> = y-intercept. Constant rate of change with increasing or decreasing behavior.
            </div>
          </div>

          <!-- 2. Quadratic Function (Two-level selection) -->
          <div class="gos-template-card gos-card-two-level">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#eab308;font-size:14px;">🎯 Quadratic Equations</span>
              <span class="gos-math-tag" style="background:rgba(234,179,8,0.15);color:#eab308;">2 Forms</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;line-height:1.45;">
              Parabolas with vertex, axis of symmetry, opening direction, and real roots.
            </div>
            <div style="display:flex;gap:6px;">
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('quadratic_vertical')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Vertical</span>
                <span style="font-family:monospace;font-size:11px;font-weight:700;color:#eab308;">y = ax² + bx + c</span>
              </button>
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('quadratic_horizontal')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Horizontal</span>
                <span style="font-family:monospace;font-size:11px;font-weight:700;color:#f59e0b;">x = ay² + by + c</span>
              </button>
            </div>
          </div>

          <!-- 3. Cubic Function -->
          <div class="gos-template-card" onclick="GraphObject.applyTemplate('cubic')">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#a855f7;font-size:14px;">🌊 Cubic Function</span>
              <span class="gos-math-tag" style="background:rgba(168,85,247,0.15);color:#a855f7;">y = ax³ + bx² + cx + d</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;line-height:1.45;">
              Demonstrate inflection points, polynomial turning points, and progressive end behavior.
            </div>
          </div>

          <!-- 4. Exponential Function -->
          <div class="gos-template-card" onclick="GraphObject.applyTemplate('exp')">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#10b981;font-size:14px;">🚀 Exponential Curve</span>
              <span class="gos-math-tag" style="background:rgba(16,185,129,0.15);color:#10b981;">y = a·bˣ + c</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;line-height:1.45;">
              Continuous growth & decay with asymptotic approach toward horizontal asymptote <strong style="color:#e2e8f0;font-family:monospace;">y = c</strong>.
            </div>
          </div>

          <!-- 5. Natural Logarithm -->
          <div class="gos-template-card" style="grid-column: span 2;" onclick="GraphObject.applyTemplate('ln')">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#f43f5e;font-size:14px;">🌲 Natural Logarithm</span>
              <span class="gos-math-tag" style="background:rgba(244,63,94,0.15);color:#f43f5e;">y = a·ln(x - h) + k  [x > h]</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;line-height:1.45;">
              Strictly respects domain <strong style="color:#e2e8f0;font-family:monospace;">x > h</strong> with asymptotic approach toward vertical asymptote <strong style="color:#e2e8f0;font-family:monospace;">x = h</strong>.
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- SECTION 2 — TRIGONOMETRIC FUNCTIONS                         -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <div class="gos-section-block">
        <div class="gos-section-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="gos-section-tag" style="background:rgba(168,85,247,0.15);color:#a855f7;border-color:rgba(168,85,247,0.35);">
              SECTION 2
            </span>
            <span style="font-weight:800;font-size:14px;color:#f8fafc;letter-spacing:0.02em;">
              🌊 Trigonometric Functions
            </span>
          </div>
          <span style="font-size:11px;color:#94a3b8;">Periodic Waves & Reciprocal Trigonometric Pairs</span>
        </div>

        <div class="gos-templates-grid">
          <!-- 1. Sine / Cosecant -->
          <div class="gos-template-card gos-card-two-level">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#38bdf8;font-size:14px;">〰️ Sine & Cosecant</span>
              <span class="gos-math-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;">Period = 2π/|b|</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;line-height:1.45;">
              Fundamental harmonic wave and its reciprocal. Amplitude, frequency, and midline analysis.
            </div>
            <div style="display:flex;gap:6px;">
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('trig_sin')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Sine</span>
                <span style="font-family:monospace;font-size:10.5px;font-weight:700;color:#38bdf8;">y = a·sin(bx + c) + d</span>
              </button>
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('trig_csc')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Cosecant (1/sin)</span>
                <span style="font-family:monospace;font-size:10.5px;font-weight:700;color:#0284c7;">y = a·csc(bx + c) + d</span>
              </button>
            </div>
          </div>

          <!-- 2. Cosine / Secant -->
          <div class="gos-template-card gos-card-two-level">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#06b6d4;font-size:14px;">📐 Cosine & Secant</span>
              <span class="gos-math-tag" style="background:rgba(6,182,212,0.15);color:#06b6d4;">Period = 2π/|b|</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;line-height:1.45;">
              Even harmonic wave and its reciprocal with amplitude, midline, and vertical asymptotes.
            </div>
            <div style="display:flex;gap:6px;">
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('trig_cos')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Cosine</span>
                <span style="font-family:monospace;font-size:10.5px;font-weight:700;color:#06b6d4;">y = a·cos(bx + c) + d</span>
              </button>
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('trig_sec')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Secant (1/cos)</span>
                <span style="font-family:monospace;font-size:10.5px;font-weight:700;color:#0891b2;">y = a·sec(bx + c) + d</span>
              </button>
            </div>
          </div>

          <!-- 3. Tangent / Cotangent -->
          <div class="gos-template-card gos-card-two-level" style="grid-column: span 2;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;color:#f59e0b;font-size:14px;">⚡ Tangent & Cotangent</span>
              <span class="gos-math-tag" style="background:rgba(245,158,11,0.15);color:#f59e0b;">Period = π/|b|</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;line-height:1.45;">
              Ratio waves with asymptotic branches. First-class period control with fundamental period = π/|b|.
            </div>
            <div style="display:flex;gap:6px;">
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('trig_tan')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Tangent</span>
                <span style="font-family:monospace;font-size:10.5px;font-weight:700;color:#f59e0b;">y = a·tan(bx + c) + d</span>
              </button>
              <button class="gos-variant-btn" onclick="event.stopPropagation(); GraphObject.applyTemplate('trig_cot')">
                <span style="display:block;font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Cotangent (1/tan)</span>
                <span style="font-family:monospace;font-size:10.5px;font-weight:700;color:#d97706;">y = a·cot(bx + c) + d</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Complete Standard General Equations ─────────────────────────────────────
  function getGeneralEquation(tmpl) {
    switch (tmpl) {
      case 'linear': return 'y = mx + c';
      case 'quadratic':
      case 'quadratic_vertical': return 'y = ax² + bx + c';
      case 'quadratic_horizontal': return 'x = ay² + by + c';
      case 'cubic': return 'y = ax³ + bx² + cx + d';
      case 'exp': return 'y = a·bˣ + c';
      case 'ln': return 'y = a·ln(x - h) + k';
      case 'trig_sin': return 'y = a·sin(bx + c) + d';
      case 'trig_csc': return 'y = a·csc(bx + c) + d';
      case 'trig_cos': return 'y = a·cos(bx + c) + d';
      case 'trig_sec': return 'y = a·sec(bx + c) + d';
      case 'trig_tan': return 'y = a·tan(bx + c) + d';
      case 'trig_cot': return 'y = a·cot(bx + c) + d';
      default: return 'y = f(x)';
    }
  }

  // ── Math Educational Insights Helper ──────────────────────────────────────
  function computeMathInsights(tmpl, params) {
    const round = (num) => Math.round(num * 100) / 100;
    let items = [];

    if (tmpl === 'linear') {
      const m = params.m !== undefined ? params.m : (params.a !== undefined ? params.a : 1);
      const c = params.c !== undefined ? params.c : 0;

      const slopeDesc = m > 0 ? 'Increasing ↗' : m < 0 ? 'Decreasing ↘' : 'Horizontal Constant →';
      items.push({ icon: '📐', label: `Slope m = ${round(m)}`, sub: slopeDesc, color: '#38bdf8' });
      items.push({ icon: '🎯', label: `Y-Intercept (0, ${round(c)})`, color: '#10b981' });
      if (m !== 0) {
        items.push({ icon: '📍', label: `X-Intercept (${round(-c / m)}, 0)`, color: '#a855f7' });
      }
    } else if (tmpl === 'quadratic_vertical' || tmpl === 'quadratic') {
      const a = params.a !== undefined ? params.a : 1;
      const b = params.b !== undefined ? params.b : 0;
      const c = params.c !== undefined ? params.c : 0;

      if (a > 0) {
        items.push({ icon: '∪', label: 'Opens Upward', sub: 'Min vertex', color: '#38bdf8' });
      } else if (a < 0) {
        items.push({ icon: '∩', label: 'Opens Downward', sub: 'Max vertex', color: '#f43f5e' });
      } else {
        items.push({ icon: '—', label: 'Degenerate (Linear)', sub: 'a = 0', color: '#94a3b8' });
      }

      if (a !== 0) {
        const h = -b / (2 * a);
        const k = a * h * h + b * h + c;
        items.push({ icon: '📍', label: `Vertex (${round(h)}, ${round(k)})`, color: '#a855f7' });
        items.push({ icon: '📏', label: `Axis of Symmetry x = ${round(h)}`, color: '#06b6d4' });
      }

      items.push({ icon: '🎯', label: `Y-Intercept (0, ${round(c)})`, color: '#10b981' });

      if (a !== 0) {
        const disc = b * b - 4 * a * c;
        if (disc > 0) {
          const r1 = (-b + Math.sqrt(disc)) / (2 * a);
          const r2 = (-b - Math.sqrt(disc)) / (2 * a);
          items.push({ icon: '✨', label: `2 Real Roots: ${round(r1)}, ${round(r2)}`, sub: `Δ = ${round(disc)}`, color: '#fbbf24' });
        } else if (Math.abs(disc) < 1e-9) {
          const r = -b / (2 * a);
          items.push({ icon: '✨', label: `1 Repeated Root: ${round(r)}`, sub: 'Δ = 0', color: '#fbbf24' });
        } else {
          items.push({ icon: '💤', label: `No Real Roots`, sub: `Δ = ${round(disc)} < 0`, color: '#64748b' });
        }
      }
    } else if (tmpl === 'quadratic_horizontal') {
      const a = params.a !== undefined ? params.a : 1;
      const b = params.b !== undefined ? params.b : 0;
      const c = params.c !== undefined ? params.c : 0;

      if (a > 0) {
        items.push({ icon: '⊂', label: 'Opens Right', sub: 'Rightward parabola', color: '#38bdf8' });
      } else if (a < 0) {
        items.push({ icon: '⊃', label: 'Opens Left', sub: 'Leftward parabola', color: '#f43f5e' });
      } else {
        items.push({ icon: '—', label: 'Degenerate (Linear)', sub: 'a = 0', color: '#94a3b8' });
      }

      if (a !== 0) {
        const k = -b / (2 * a);
        const h = a * k * k + b * k + c;
        items.push({ icon: '📍', label: `Vertex (${round(h)}, ${round(k)})`, color: '#a855f7' });
        items.push({ icon: '📏', label: `Axis of Symmetry y = ${round(k)}`, color: '#06b6d4' });
      }

      items.push({ icon: '🎯', label: `X-Intercept (${round(c)}, 0)`, color: '#10b981' });

      if (a !== 0) {
        const disc = b * b - 4 * a * c;
        if (disc > 0) {
          const y1 = (-b + Math.sqrt(disc)) / (2 * a);
          const y2 = (-b - Math.sqrt(disc)) / (2 * a);
          items.push({ icon: '✨', label: `2 Y-Intercepts: ${round(y1)}, ${round(y2)}`, sub: `Δ = ${round(disc)}`, color: '#fbbf24' });
        } else if (Math.abs(disc) < 1e-9) {
          items.push({ icon: '✨', label: `1 Y-Intercept: ${round(-b / (2 * a))}`, sub: 'Δ = 0', color: '#fbbf24' });
        } else {
          items.push({ icon: '💤', label: 'No Y-Intercepts', sub: `Δ < 0`, color: '#64748b' });
        }
      }
    } else if (tmpl === 'cubic') {
      const a = params.a !== undefined ? params.a : 1;
      const b = params.b !== undefined ? params.b : 0;
      const c = params.c !== undefined ? params.c : 0;
      const d = params.d !== undefined ? params.d : 0;

      if (a !== 0) {
        const inflX = -b / (3 * a);
        const inflY = a * inflX * inflX * inflX + b * inflX * inflX + c * inflX + d;
        items.push({ icon: '〰️', label: `Inflection Point (${round(inflX)}, ${round(inflY)})`, color: '#a855f7' });

        const endDesc = a > 0 ? '↙ Down (x→-∞) to ↗ Up (x→+∞)' : '↖ Up (x→-∞) to ↘ Down (x→+∞)';
        items.push({ icon: '🧭', label: `End Behavior`, sub: endDesc, color: '#06b6d4' });

        const derivDisc = (2 * b) * (2 * b) - 4 * (3 * a) * c;
        if (derivDisc > 0) {
          items.push({ icon: '⚡', label: '2 Turning Points', sub: 'Local max & min', color: '#fbbf24' });
        } else if (derivDisc === 0) {
          items.push({ icon: '⚡', label: '1 Stationary Inflection', sub: 'Monotonic saddle', color: '#94a3b8' });
        } else {
          items.push({ icon: '⚡', label: a > 0 ? 'Strictly Increasing' : 'Strictly Decreasing', sub: 'No turning points', color: '#10b981' });
        }
      }
      items.push({ icon: '🎯', label: `Y-Intercept (0, ${round(d)})`, color: '#10b981' });
    } else if (tmpl === 'exp') {
      const a = params.a !== undefined ? params.a : 1;
      const b = params.b !== undefined ? params.b : 2;
      const c = params.c !== undefined ? params.c : 0;

      const isGrowth = (b > 1 && a > 0) || (b < 1 && b > 0 && a < 0);
      items.push({ icon: isGrowth ? '📈' : '📉', label: isGrowth ? 'Exponential Growth' : 'Exponential Decay', sub: `Base b = ${b}`, color: '#10b981' });
      items.push({ icon: '🎯', label: `Y-Intercept (0, ${round(a + c)})`, color: '#38bdf8' });
      items.push({ icon: '🚧', label: `Horiz. Asymptote y = ${round(c)}`, sub: 'Approaches without touching', color: '#f43f5e' });
    } else if (tmpl === 'ln') {
      const a = params.a !== undefined ? params.a : 1;
      const h = params.h !== undefined ? params.h : 0;
      const k = params.k !== undefined ? params.k : 0;

      items.push({ icon: '🌲', label: `Domain x > ${round(h)}`, sub: 'Strictly positive argument', color: '#f43f5e' });
      items.push({ icon: '🚧', label: `Vert. Asymptote x = ${round(h)}`, color: '#f43f5e' });
      if (a !== 0) {
        const rootX = h + Math.exp(-k / a);
        if (isFinite(rootX)) {
          items.push({ icon: '🎯', label: `X-Intercept (${round(rootX)}, 0)`, color: '#10b981' });
        }
      }
    } else if (tmpl && tmpl.startsWith('trig_')) {
      const a = params.a !== undefined ? params.a : 1;
      const b = params.b !== undefined ? params.b : 1;
      const c = params.c !== undefined ? params.c : 0;
      const d = params.d !== undefined ? params.d : 0;

      const isTanCot = tmpl === 'trig_tan' || tmpl === 'trig_cot';
      const periodObj = formatPeriod(isTanCot, b);

      items.push({ icon: '⏱️', label: `Period T = ${periodObj.exact}`, sub: `≈ ${periodObj.approx} rad`, color: '#38bdf8' });
      items.push({ icon: '📊', label: `Frequency |b| = ${round(Math.abs(b))}`, color: '#10b981' });

      if (tmpl === 'trig_sin' || tmpl === 'trig_cos') {
        const amp = Math.abs(a);
        items.push({ icon: '📏', label: `Amplitude = ${round(amp)}`, color: '#fbbf24' });
        items.push({ icon: '🔝', label: `Range [${round(d - amp)}, ${round(d + amp)}]`, color: '#a855f7' });
      } else {
        items.push({ icon: '↕️', label: `Vertical Scale |a| = ${round(Math.abs(a))}`, color: '#fbbf24' });
      }

      items.push({ icon: '〰️', label: `Midline y = ${round(d)}`, color: '#06b6d4' });

      if (b !== 0 && c !== 0) {
        items.push({ icon: '↔️', label: `Phase Shift: ${round(-c / b)}`, color: '#f59e0b' });
      }
    }

    return items;
  }

  // Tab 2: Interactive Real-Time Coefficient Parameters (Manual Input, No Sliders)
  function renderSlidersTab(container, g) {
    const tmpl = g.activeTemplate || 'quadratic_vertical';
    const params = g.params || {};

    let currentFormula = '';
    let isXEquals = false;

    if (tmpl === 'linear') {
      const m = params.m !== undefined ? params.m : (params.a !== undefined ? params.a : 1);
      const c = params.c !== undefined ? params.c : 0;
      currentFormula = `y = ${formatLinear(m, c)}`;
    } else if (tmpl === 'quadratic' || tmpl === 'quadratic_vertical') {
      currentFormula = `y = ${formatQuadratic(params.a !== undefined ? params.a : 1, params.b || 0, params.c || 0)}`;
    } else if (tmpl === 'quadratic_horizontal') {
      isXEquals = true;
      currentFormula = `x = ${formatHorizontalQuadratic(params.a !== undefined ? params.a : 1, params.b || 0, params.c || 0)}`;
    } else if (tmpl === 'cubic') {
      currentFormula = `y = ${formatCubic(params.a !== undefined ? params.a : 1, params.b || 0, params.c || 0, params.d || 0)}`;
    } else if (tmpl === 'exp') {
      currentFormula = `y = ${formatExponential(params.a !== undefined ? params.a : 1, params.b !== undefined ? params.b : 2, params.c || 0)}`;
    } else if (tmpl === 'ln') {
      currentFormula = `y = ${formatLogarithmic(params.a !== undefined ? params.a : 1, params.h || 0, params.k || 0)}`;
    } else if (tmpl && tmpl.startsWith('trig_')) {
      let fnName = 'sin';
      if (tmpl === 'trig_csc') fnName = 'csc';
      else if (tmpl === 'trig_cos') fnName = 'cos';
      else if (tmpl === 'trig_sec') fnName = 'sec';
      else if (tmpl === 'trig_tan') fnName = 'tan';
      else if (tmpl === 'trig_cot') fnName = 'cot';
      currentFormula = `y = ${formatTrig(fnName, params.a !== undefined ? params.a : 1, params.b !== undefined ? params.b : 1, params.c || 0, params.d || 0)}`;
    }

    const generalEq = getGeneralEquation(tmpl);
    const isModified = !!g.isParamModified;
    const displayEq = isModified ? currentFormula : generalEq;
    const insights = computeMathInsights(tmpl, params);
    const round = (num) => Math.round(num * 100) / 100;

    // Optional two-level variant switcher header
    let variantToggleHtml = '';
    if (tmpl === 'quadratic' || tmpl === 'quadratic_vertical' || tmpl === 'quadratic_horizontal') {
      variantToggleHtml = `
        <div class="gos-variant-toggle">
          <button class="gos-variant-btn ${tmpl !== 'quadratic_horizontal' ? 'active' : ''}" onclick="GraphObject.applyTemplate('quadratic_vertical')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Vertical Parabola</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#eab308;">y = ax² + bx + c</span>
          </button>
          <button class="gos-variant-btn ${tmpl === 'quadratic_horizontal' ? 'active' : ''}" onclick="GraphObject.applyTemplate('quadratic_horizontal')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Horizontal Parabola</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#f59e0b;">x = ay² + by + c</span>
          </button>
        </div>
      `;
    } else if (tmpl === 'trig_sin' || tmpl === 'trig_csc') {
      variantToggleHtml = `
        <div class="gos-variant-toggle">
          <button class="gos-variant-btn ${tmpl === 'trig_sin' ? 'active' : ''}" onclick="GraphObject.applyTemplate('trig_sin')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Sine Wave</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#38bdf8;">y = a·sin(bx + c) + d</span>
          </button>
          <button class="gos-variant-btn ${tmpl === 'trig_csc' ? 'active' : ''}" onclick="GraphObject.applyTemplate('trig_csc')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Cosecant (Reciprocal)</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#0284c7;">y = a·csc(bx + c) + d</span>
          </button>
        </div>
      `;
    } else if (tmpl === 'trig_cos' || tmpl === 'trig_sec') {
      variantToggleHtml = `
        <div class="gos-variant-toggle">
          <button class="gos-variant-btn ${tmpl === 'trig_cos' ? 'active' : ''}" onclick="GraphObject.applyTemplate('trig_cos')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Cosine Wave</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#06b6d4;">y = a·cos(bx + c) + d</span>
          </button>
          <button class="gos-variant-btn ${tmpl === 'trig_sec' ? 'active' : ''}" onclick="GraphObject.applyTemplate('trig_sec')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Secant (Reciprocal)</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#0891b2;">y = a·sec(bx + c) + d</span>
          </button>
        </div>
      `;
    } else if (tmpl === 'trig_tan' || tmpl === 'trig_cot') {
      variantToggleHtml = `
        <div class="gos-variant-toggle">
          <button class="gos-variant-btn ${tmpl === 'trig_tan' ? 'active' : ''}" onclick="GraphObject.applyTemplate('trig_tan')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Tangent</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#f59e0b;">y = a·tan(bx + c) + d</span>
          </button>
          <button class="gos-variant-btn ${tmpl === 'trig_cot' ? 'active' : ''}" onclick="GraphObject.applyTemplate('trig_cot')">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;">Cotangent (Reciprocal)</span>
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#d97706;">y = a·cot(bx + c) + d</span>
          </button>
        </div>
      `;
    }

    // Dedicated Trigonometric Wave Period & Frequency Card
    let periodCardHtml = '';
    if (tmpl && tmpl.startsWith('trig_')) {
      const isTanCot = tmpl === 'trig_tan' || tmpl === 'trig_cot';
      const bVal = params.b !== undefined ? params.b : 1;
      const aVal = params.a !== undefined ? params.a : 1;
      const dVal = params.d !== undefined ? params.d : 0;
      const periodObj = formatPeriod(isTanCot, bVal);

      periodCardHtml = `
        <div class="gos-period-card">
          <div class="gos-period-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="gos-section-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;border-color:rgba(56,189,248,0.35);">TEACHING CONCEPT</span>
              <span style="font-weight:800;font-size:13px;color:#f8fafc;">Wave Period & Frequency Analysis</span>
            </div>
            <span class="gos-math-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;">Period T = ${isTanCot ? 'π / |b|' : '2π / |b|'}</span>
          </div>
          <div class="gos-period-grid">
            <div class="gos-period-stat">
              <span class="gos-period-label">Period (T)</span>
              <span class="gos-period-value" id="gos-trig-period-val" style="color:#38bdf8;">${periodObj.exact}</span>
              <span class="gos-period-sub" id="gos-trig-period-sub">≈ ${periodObj.approx} rad</span>
            </div>
            <div class="gos-period-stat">
              <span class="gos-period-label">Frequency (|b|)</span>
              <span class="gos-period-value" id="gos-trig-freq-val" style="color:#10b981;">${round(Math.abs(bVal))}</span>
              <span class="gos-period-sub">Cycles per ${isTanCot ? 'π' : '2π'}</span>
            </div>
            <div class="gos-period-stat">
              <span class="gos-period-label">Amplitude (|a|)</span>
              <span class="gos-period-value" id="gos-trig-amp-val" style="color:#fbbf24;">${round(Math.abs(aVal))}</span>
              <span class="gos-period-sub">${(tmpl === 'trig_sin' || tmpl === 'trig_cos') ? 'Peak to midline' : 'Vertical stretch'}</span>
            </div>
            <div class="gos-period-stat">
              <span class="gos-period-label">Midline (y)</span>
              <span class="gos-period-value" id="gos-trig-midline-val" style="color:#c084fc;">y = ${round(dVal)}</span>
              <span class="gos-period-sub">Center axis</span>
            </div>
          </div>
        </div>
      `;
    }

    // Build parameter cards list
    let paramCardsHtml = '';
    if (tmpl === 'linear') {
      const mVal = params.m !== undefined ? params.m : (params.a !== undefined ? params.a : 1);
      const cVal = params.c !== undefined ? params.c : 0;
      paramCardsHtml = `
        ${renderParamRow('m', 'Slope / Gradient (m)', 'Rate of change: rise over run; m > 0 increasing ↗, m < 0 decreasing ↘', mVal, 1, 0.5, [-3, -2, -1, -0.5, 0.5, 1, 2, 3], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('c', 'Y-Intercept (c)', 'Vertical offset: coordinate where line crosses y-axis at (0, c)', cVal, 0, 0.5, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
      `;
    } else if (tmpl === 'quadratic' || tmpl === 'quadratic_vertical') {
      paramCardsHtml = `
        ${renderParamRow('a', 'Coefficient a (Curvature & Opening)', 'a > 0 opens upward ∪, a < 0 opens downward ∩; magnitude controls width', params.a !== undefined ? params.a : 1, 1, 0.1, [-3, -2, -1, -0.5, 0.5, 1, 2, 3], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('b', 'Coefficient b (Axis of Symmetry)', 'Horizontal shift of parabola axis of symmetry: x = -b / (2a)', params.b !== undefined ? params.b : 0, 0, 0.5, [-3, -2, -1, 0, 1, 2, 3], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
        ${renderParamRow('c', 'Coefficient c (Y-Intercept)', 'Vertical offset: where curve crosses y-axis at (0, c)', params.c !== undefined ? params.c : 0, 0, 0.5, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' })}
      `;
    } else if (tmpl === 'quadratic_horizontal') {
      paramCardsHtml = `
        ${renderParamRow('a', 'Coefficient a (Opening & Curvature)', 'a > 0 opens right ⊂, a < 0 opens left ⊃; magnitude controls width', params.a !== undefined ? params.a : 1, 1, 0.1, [-3, -2, -1, -0.5, 0.5, 1, 2, 3], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('b', 'Coefficient b (Axis of Symmetry)', 'Vertical shift of horizontal axis: y = -b / (2a)', params.b !== undefined ? params.b : 0, 0, 0.5, [-3, -2, -1, 0, 1, 2, 3], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
        ${renderParamRow('c', 'Coefficient c (X-Intercept)', 'Horizontal constant: where curve crosses x-axis at (c, 0)', params.c !== undefined ? params.c : 0, 0, 0.5, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' })}
      `;
    } else if (tmpl === 'cubic') {
      paramCardsHtml = `
        ${renderParamRow('a', 'Coefficient a (Cubic Scale & End-Behavior)', 'Controls cubic steepness and progressive end-behavior', params.a !== undefined ? params.a : 1, 1, 0.1, [-2, -1, -0.5, 0.5, 1, 2], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('b', 'Coefficient b (Quadratic Term / Bend)', 'Shifts inflection point horizontally: x = -b / (3a)', params.b !== undefined ? params.b : 0, 0, 0.5, [-3, -2, -1, 0, 1, 2, 3], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
        ${renderParamRow('c', 'Coefficient c (Slope at Inflection)', 'Instantaneous linear gradient at the inflection point', params.c !== undefined ? params.c : 0, 0, 0.5, [-3, -2, -1, 0, 1, 2, 3], { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' })}
        ${renderParamRow('d', 'Coefficient d (Y-Intercept)', 'Vertical constant: where cubic crosses y-axis at (0, d)', params.d !== undefined ? params.d : 0, 0, 0.5, [-4, -2, 0, 2, 4], { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.35)' })}
      `;
    } else if (tmpl === 'exp') {
      paramCardsHtml = `
        ${renderParamRow('a', 'Coefficient a (Vertical Scale / Reflection)', 'Initial amplitude factor: y-intercept is (0, a + c)', params.a !== undefined ? params.a : 1, 1, 0.5, [-3, -2, -1, 0.5, 1, 2, 3], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('b', 'Base b (Growth / Decay Factor)', 'b > 1 exponential growth, 0 < b < 1 exponential decay', params.b !== undefined ? params.b : 2, 2, 0.5, [0.5, 1.5, 2, 2.718, 3], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
        ${renderParamRow('c', 'Vertical Shift c (Horizontal Asymptote y = c)', 'Translates curve; horizontal asymptote updates to y = c', params.c !== undefined ? params.c : 0, 0, 0.5, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: 'rgba(244,63,94,0.35)' })}
      `;
    } else if (tmpl === 'ln') {
      paramCardsHtml = `
        ${renderParamRow('a', 'Coefficient a (Vertical Scale Factor)', 'Dilates or compresses curve vertically; reflects across asymptote', params.a !== undefined ? params.a : 1, 1, 0.5, [-2, -1, -0.5, 0.5, 1, 2], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('h', 'Horizontal Shift h (Vertical Asymptote x = h)', 'Domain is strictly x > h; asymptotic boundary at x = h', params.h !== undefined ? params.h : 0, 0, 0.5, [-3, -2, -1, 0, 1, 2, 3], { bg: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: 'rgba(244,63,94,0.35)' })}
        ${renderParamRow('k', 'Vertical Shift k (Vertical Offset)', 'Translates entire logarithmic curve vertically', params.k !== undefined ? params.k : 0, 0, 0.5, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
      `;
    } else if (tmpl && tmpl.startsWith('trig_')) {
      const isSinCos = tmpl === 'trig_sin' || tmpl === 'trig_cos';
      paramCardsHtml = `
        ${renderParamRow('a', 'Amplitude / Vertical Scale (a)', isSinCos ? 'Peak displacement from midline: Amplitude = |a|' : 'Vertical scaling & dilation factor', params.a !== undefined ? params.a : 1, 1, 0.5, [-3, -2, -1, 0.5, 1, 2, 3], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('b', 'Frequency Parameter (b)', 'Directly controls period: T = 2π/|b| (or π/|b|)', params.b !== undefined ? params.b : 1, 1, 0.5, [0.5, 1, 1.5, 2, 3, 4], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
        ${renderParamRow('c', 'Phase Shift Parameter (c)', 'Horizontal translation: Phase shift = -c / b', params.c !== undefined ? params.c : 0, 0, 0.5, [-3, -2, -1, 0, 1, 2, 3], { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' })}
        ${renderParamRow('d', 'Vertical Shift (d) / Midline', 'Translates wave vertically; center midline is y = d', params.d !== undefined ? params.d : 0, 0, 0.5, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.35)' })}
      `;
    }

    container.innerHTML = `
      ${variantToggleHtml}

      <!-- Dynamic Live Equation Header Banner -->
      <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:14px 18px;text-align:center;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span id="gos-equation-status" style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">
            ${isModified ? 'Current Active Equation' : 'Complete Standard Equation'}
          </span>
          <span style="font-size:11px;font-weight:700;color:#facc15;background:rgba(250,204,21,0.12);padding:2px 8px;border-radius:4px;border:1px solid rgba(250,204,21,0.3);font-family:monospace;">
            ${generalEq}
          </span>
        </div>
        <div id="gos-live-formula" style="font-size:26px;font-weight:800;color:#38bdf8;font-family:monospace;letter-spacing:0.02em;">
          ${displayEq}
        </div>
        <div id="gos-formula-sub" style="font-size:11.5px;color:#94a3b8;margin-top:5px;">
          ${isModified 
            ? `Standard Form: <strong style="color:#facc15;font-family:monospace;">${generalEq}</strong>` 
            : `<span style="color:#64748b;">Complete standard equation displayed initially • Adjust parameters below to transform</span>`}
        </div>
        <div id="gos-math-insights" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px;">
          ${insights.map(item => `
            <span class="gos-insight-badge" style="border-color:${item.color}40;color:${item.color};background:${item.color}15;">
              <span>${item.icon}</span>
              <span>${item.label}</span>
              ${item.sub ? `<span style="font-size:10px;opacity:0.75;margin-left:2px;">(${item.sub})</span>` : ''}
            </span>
          `).join('')}
        </div>
      </div>

      ${periodCardHtml}

      <!-- Manual Parameter Cards List (Direct Input, No Lines / Sliders) -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${paramCardsHtml}
      </div>
    `;
  }

  function renderParamRow(key, title, subtitle, val, defaultVal, step, presets, theme) {
    const numVal = val !== undefined ? val : defaultVal;
    return `
      <div class="gos-param-card" id="gos-card-${key}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
          <!-- Left: Variable Avatar & Pedagogical Role -->
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <div class="gos-param-badge" style="background:${theme.bg};color:${theme.color};border:1px solid ${theme.border};">
              ${key}
            </div>
            <div style="min-width:0;">
              <div style="font-size:13.5px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${title}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                ${subtitle}
              </div>
            </div>
          </div>

          <!-- Right: Tactile Stepper & Manual Numeric Input (No range slider lines) -->
          <div class="gos-input-cluster">
            <button class="gos-stepper-btn" onclick="GraphObject.stepParam('${key}', -${step})" title="Decrease ${key} by ${step}">
              −
            </button>
            <input type="number" step="${step}" id="gos-val-${key}" value="${numVal}" class="gos-manual-input"
              oninput="GraphObject.handleManualInput('${key}', this.value)"
              onchange="GraphObject.commitManualInput('${key}', this.value)"
              title="Click to manually type any value">
            <button class="gos-stepper-btn" onclick="GraphObject.stepParam('${key}', ${step})" title="Increase ${key} by ${step}">
              +
            </button>
            <button class="gos-reset-btn" onclick="GraphObject.setParam('${key}', ${defaultVal})" title="Reset to default (${defaultVal})">
              ↺
            </button>
          </div>
        </div>

        <!-- Quick Value Presets & Quick Step -->
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-right:2px;">Presets:</span>
          ${presets.map(p => {
            const isActive = Math.abs(Number(numVal) - p) < 0.0001;
            return `
              <button class="gos-preset-chip gos-chip-${key} ${isActive ? 'active' : ''}" 
                data-val="${p}"
                onclick="GraphObject.setParam('${key}', ${p})">
                ${p > 0 && key !== 'a' && key !== 'm' ? '+' + p : p}
              </button>
            `;
          }).join('')}
          <div style="margin-left:auto;display:flex;align-items:center;gap:4px;">
            <button class="gos-preset-chip" style="font-size:10px;padding:2px 6px;opacity:0.8;" onclick="GraphObject.stepParam('${key}', -1)" title="Step −1.0">−1</button>
            <button class="gos-preset-chip" style="font-size:10px;padding:2px 6px;opacity:0.8;" onclick="GraphObject.stepParam('${key}', 1)" title="Step +1.0">+1</button>
          </div>
        </div>
      </div>
    `;
  }

  // Tab 3: Functions List (f1, f2, Add Function, Delete, Visibility)
  function renderFunctionsTab(container, g) {
    const eqs = g.equations || [];
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Plotted Equations (${eqs.length})</span>
        <button class="tb-btn" style="padding:4px 10px;font-size:11px;background:rgba(56,189,248,0.2);color:#38bdf8;" onclick="GraphObject.addEquationRow()">
          ＋ Add Equation
        </button>
      </div>
      <div id="gos-eqs-list" style="display:flex;flex-direction:column;gap:8px;">
        ${eqs.map((eq, i) => `
          <div class="gos-eq-row" data-index="${i}" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
            <input type="checkbox" ${eq.visible ? 'checked' : ''} onchange="GraphObject.toggleEqVisible(${i}, this.checked)" title="Show/Hide">
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#94a3b8;">${eq.isXEquals ? 'x(y)=' : `f${i+1}(x)=`}</span>
            <input type="text" class="gos-expr-input" value="${eq.expr}" style="flex:1;padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f8fafc;font-family:monospace;font-size:13px;" oninput="GraphObject.updateEqExpr(${i}, this.value)">
            <input type="color" value="${eq.color || '#38bdf8'}" style="width:30px;height:30px;border:none;border-radius:6px;background:transparent;cursor:pointer;" onchange="GraphObject.updateEqColor(${i}, this.value)">
            <button class="bbm-close" style="width:26px;height:26px;" onclick="GraphObject.removeEqRow(${i})" title="Delete">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Tab 4: Axis & Grid Settings (Limits, Equal Scale, Labels)
  function renderSettingsTab(container, g) {
    container.innerHTML = `
      <div>
        <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;">Coordinate Limits</div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
          <div>
            <label style="font-size:10px;color:#94a3b8;display:block;">X Min</label>
            <input type="number" id="gos-xmin" value="${g.xMin}" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;">
          </div>
          <div>
            <label style="font-size:10px;color:#94a3b8;display:block;">X Max</label>
            <input type="number" id="gos-xmax" value="${g.xMax}" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;">
          </div>
          <div>
            <label style="font-size:10px;color:#94a3b8;display:block;">Y Min</label>
            <input type="number" id="gos-ymin" value="${g.yMin}" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;">
          </div>
          <div>
            <label style="font-size:10px;color:#94a3b8;display:block;">Y Max</label>
            <input type="number" id="gos-ymax" value="${g.yMax}" style="width:100%;padding:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;">
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;padding:8px 0;">
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" id="gos-equal-scale" ${g.equalAspect ? 'checked' : ''}>
          <span><strong>Equal X:Y Scale (1:1 Ratio)</strong> — Prevents geometric distortion of curves</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" id="gos-show-grid" ${g.showGrid ? 'checked' : ''}>
          <span>Show Major Grid Lines</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" id="gos-show-minor-grid" ${g.showMinorGrid ? 'checked' : ''}>
          <span>Show Minor Grid Lines</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" id="gos-show-axes" ${g.showAxes ? 'checked' : ''}>
          <span>Show Axes with Arrowheads & Origin (0,0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" id="gos-show-labels" ${g.showLabels ? 'checked' : ''}>
          <span>Show Numerical Tick Labels</span>
        </label>
      </div>

      <button class="tb-btn danger" style="padding:8px;justify-content:center;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);" onclick="GraphObject.clearAllEquations(GraphObject.getEditingGraph()); GraphObject.switchStudioTab('settings');">
        🗑️ Clear All Equations
      </button>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. STUDIO ACTIONS & INTERACTIVE CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────────

  function getDefaultVal(key, tmpl) {
    if (key === 'm' || key === 'a') return 1;
    if (key === 'b') {
      if (tmpl === 'exp') return 2;
      if (tmpl && tmpl.startsWith('trig_')) return 1;
      return 0;
    }
    return 0;
  }

  function applyTemplate(type) {
    if (!editingGraph) return;
    editingGraph.activeTemplate = type;

    let initialExpr = 'x²';
    let defaultParams = { a: 1, b: 0, c: 0, d: 0 };
    let initialColor = '#38bdf8';
    let isXEquals = false;

    if (type === 'linear') {
      defaultParams = { m: 1, c: 0 };
      initialExpr = 'x';
      initialColor = '#38bdf8';
      editingGraph.xMin = -10; editingGraph.xMax = 10;
      editingGraph.yMin = -10; editingGraph.yMax = 10;
    } else if (type === 'quadratic' || type === 'quadratic_vertical') {
      type = 'quadratic_vertical';
      editingGraph.activeTemplate = type;
      defaultParams = { a: 1, b: 0, c: 0 };
      initialExpr = 'x²';
      initialColor = '#eab308';
      editingGraph.xMin = -6; editingGraph.xMax = 6;
      editingGraph.yMin = -2; editingGraph.yMax = 12;
    } else if (type === 'quadratic_horizontal') {
      defaultParams = { a: 1, b: 0, c: 0 };
      initialExpr = 'y²';
      initialColor = '#f59e0b';
      isXEquals = true;
      editingGraph.xMin = -2; editingGraph.xMax = 12;
      editingGraph.yMin = -6; editingGraph.yMax = 6;
    } else if (type === 'cubic') {
      defaultParams = { a: 1, b: 0, c: 0, d: 0 };
      initialExpr = 'x³';
      initialColor = '#a855f7';
      editingGraph.xMin = -5; editingGraph.xMax = 5;
      editingGraph.yMin = -15; editingGraph.yMax = 15;
    } else if (type === 'exp') {
      defaultParams = { a: 1, b: 2, c: 0 };
      initialExpr = '2ˣ';
      initialColor = '#10b981';
      editingGraph.xMin = -5; editingGraph.xMax = 5;
      editingGraph.yMin = -2; editingGraph.yMax = 10;
    } else if (type === 'ln') {
      defaultParams = { a: 1, h: 0, k: 0 };
      initialExpr = 'ln(x)';
      initialColor = '#f43f5e';
      editingGraph.xMin = -2; editingGraph.xMax = 10;
      editingGraph.yMin = -5; editingGraph.yMax = 5;
    } else if (type === 'trig_sin') {
      defaultParams = { a: 1, b: 1, c: 0, d: 0 };
      initialExpr = 'sin(x)';
      initialColor = '#38bdf8';
      editingGraph.xMin = -7; editingGraph.xMax = 7;
      editingGraph.yMin = -3; editingGraph.yMax = 3;
    } else if (type === 'trig_csc') {
      defaultParams = { a: 1, b: 1, c: 0, d: 0 };
      initialExpr = 'csc(x)';
      initialColor = '#0284c7';
      editingGraph.xMin = -7; editingGraph.xMax = 7;
      editingGraph.yMin = -6; editingGraph.yMax = 6;
    } else if (type === 'trig_cos') {
      defaultParams = { a: 1, b: 1, c: 0, d: 0 };
      initialExpr = 'cos(x)';
      initialColor = '#06b6d4';
      editingGraph.xMin = -7; editingGraph.xMax = 7;
      editingGraph.yMin = -3; editingGraph.yMax = 3;
    } else if (type === 'trig_sec') {
      defaultParams = { a: 1, b: 1, c: 0, d: 0 };
      initialExpr = 'sec(x)';
      initialColor = '#0891b2';
      editingGraph.xMin = -7; editingGraph.xMax = 7;
      editingGraph.yMin = -6; editingGraph.yMax = 6;
    } else if (type === 'trig_tan') {
      defaultParams = { a: 1, b: 1, c: 0, d: 0 };
      initialExpr = 'tan(x)';
      initialColor = '#f59e0b';
      editingGraph.xMin = -7; editingGraph.xMax = 7;
      editingGraph.yMin = -6; editingGraph.yMax = 6;
    } else if (type === 'trig_cot') {
      defaultParams = { a: 1, b: 1, c: 0, d: 0 };
      initialExpr = 'cot(x)';
      initialColor = '#d97706';
      editingGraph.xMin = -7; editingGraph.xMax = 7;
      editingGraph.yMin = -6; editingGraph.yMax = 6;
    }

    editingGraph.params = defaultParams;
    editingGraph.isParamModified = false;
    editingGraph.equations = [
      { id: Date.now(), label: isXEquals ? 'x(y)' : 'f₁(x)', expr: initialExpr, color: initialColor, lineWidth: 2.8, visible: true, isXEquals }
    ];

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }

    switchStudioTab('sliders');
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Applied ${type.replace('trig_', '').replace('_', ' ').toUpperCase()} template`);
    }
  }

  function setParam(key, val) {
    if (!editingGraph) return;
    if (!editingGraph.params) editingGraph.params = {};
    val = Math.round(Number(val) * 1000) / 1000;
    editingGraph.params[key] = val;
    editingGraph.isParamModified = true;

    // Update input box if not currently actively focused
    const valInput = document.getElementById(`gos-val-${key}`);
    if (valInput && document.activeElement !== valInput) {
      valInput.value = val;
    }

    // Update preset chip active states
    const card = document.getElementById(`gos-card-${key}`);
    if (card) {
      card.querySelectorAll('.gos-preset-chip').forEach(chip => {
        const chipVal = parseFloat(chip.getAttribute('data-val'));
        if (!isNaN(chipVal)) {
          chip.classList.toggle('active', Math.abs(chipVal - val) < 0.0001);
        }
      });
    }

    updateFormulaAndInsights();

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function stepParam(key, delta) {
    if (!editingGraph) return;
    if (!editingGraph.params) editingGraph.params = {};
    const tmpl = editingGraph.activeTemplate || 'quadratic_vertical';
    const defaultVal = getDefaultVal(key, tmpl);
    let cur = editingGraph.params[key] !== undefined ? editingGraph.params[key] : defaultVal;
    let next = Math.round((cur + delta) * 100) / 100;
    setParam(key, next);
    const valInput = document.getElementById(`gos-val-${key}`);
    if (valInput) valInput.value = next;
  }

  function handleManualInput(key, rawVal) {
    if (!editingGraph) return;
    if (rawVal === '' || rawVal === '-' || rawVal === '.' || rawVal === '-.') return;
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      if (!editingGraph.params) editingGraph.params = {};
      editingGraph.params[key] = parsed;
      editingGraph.isParamModified = true;

      const card = document.getElementById(`gos-card-${key}`);
      if (card) {
        card.querySelectorAll('.gos-preset-chip').forEach(chip => {
          const chipVal = parseFloat(chip.getAttribute('data-val'));
          if (!isNaN(chipVal)) {
            chip.classList.toggle('active', Math.abs(chipVal - parsed) < 0.0001);
          }
        });
      }

      updateFormulaAndInsights();

      if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
        Canvas.renderShapes();
      }
    }
  }

  function commitManualInput(key, rawVal) {
    if (!editingGraph) return;
    const tmpl = editingGraph.activeTemplate || 'quadratic_vertical';
    const defaultVal = getDefaultVal(key, tmpl);
    let parsed = parseFloat(rawVal);
    if (isNaN(parsed)) parsed = defaultVal;
    setParam(key, parsed);
    const valInput = document.getElementById(`gos-val-${key}`);
    if (valInput) valInput.value = parsed;
  }

  function updateFormulaAndInsights() {
    if (!editingGraph) return;
    const tmpl = editingGraph.activeTemplate || 'quadratic_vertical';
    const params = editingGraph.params || {};

    let formatted = '';
    let isXEquals = false;

    if (tmpl === 'linear') {
      const m = params.m !== undefined ? params.m : (params.a !== undefined ? params.a : 1);
      const c = params.c !== undefined ? params.c : 0;
      formatted = formatLinear(m, c);
    } else if (tmpl === 'quadratic' || tmpl === 'quadratic_vertical') {
      formatted = formatQuadratic(params.a !== undefined ? params.a : 1, params.b || 0, params.c || 0);
    } else if (tmpl === 'quadratic_horizontal') {
      isXEquals = true;
      formatted = formatHorizontalQuadratic(params.a !== undefined ? params.a : 1, params.b || 0, params.c || 0);
    } else if (tmpl === 'cubic') {
      formatted = formatCubic(params.a !== undefined ? params.a : 1, params.b || 0, params.c || 0, params.d || 0);
    } else if (tmpl === 'exp') {
      formatted = formatExponential(params.a !== undefined ? params.a : 1, params.b !== undefined ? params.b : 2, params.c || 0);
    } else if (tmpl === 'ln') {
      formatted = formatLogarithmic(params.a !== undefined ? params.a : 1, params.h || 0, params.k || 0);
    } else if (tmpl && tmpl.startsWith('trig_')) {
      let fnName = 'sin';
      if (tmpl === 'trig_csc') fnName = 'csc';
      else if (tmpl === 'trig_cos') fnName = 'cos';
      else if (tmpl === 'trig_sec') fnName = 'sec';
      else if (tmpl === 'trig_tan') fnName = 'tan';
      else if (tmpl === 'trig_cot') fnName = 'cot';
      formatted = formatTrig(fnName, params.a !== undefined ? params.a : 1, params.b !== undefined ? params.b : 1, params.c || 0, params.d || 0);
    }

    if (editingGraph.equations && editingGraph.equations[0]) {
      editingGraph.equations[0].expr = formatted;
      editingGraph.equations[0].isXEquals = isXEquals;
      editingGraph.equations[0].label = isXEquals ? 'x(y)' : 'f₁(x)';
    }

    const liveBanner = document.getElementById('gos-live-formula');
    if (liveBanner) {
      liveBanner.textContent = isXEquals ? `x = ${formatted}` : `y = ${formatted}`;
    }

    const eqStatus = document.getElementById('gos-equation-status');
    if (eqStatus) {
      eqStatus.textContent = 'Current Active Equation';
    }

    const formulaSub = document.getElementById('gos-formula-sub');
    if (formulaSub) {
      const generalEq = getGeneralEquation(tmpl);
      formulaSub.innerHTML = `Standard Form: <strong style="color:#facc15;font-family:monospace;">${generalEq}</strong>`;
    }

    const insightsContainer = document.getElementById('gos-math-insights');
    if (insightsContainer) {
      const insights = computeMathInsights(tmpl, params);
      insightsContainer.innerHTML = insights.map(item => `
        <span class="gos-insight-badge" style="border-color:${item.color}40;color:${item.color};background:${item.color}15;">
          <span>${item.icon}</span>
          <span>${item.label}</span>
          ${item.sub ? `<span style="font-size:10px;opacity:0.75;margin-left:2px;">(${item.sub})</span>` : ''}
        </span>
      `).join('');
    }

    // Update real-time period stats if present
    const pValEl = document.getElementById('gos-trig-period-val');
    if (pValEl) {
      const isTanCot = tmpl === 'trig_tan' || tmpl === 'trig_cot';
      const b = params.b !== undefined ? params.b : 1;
      const periodObj = formatPeriod(isTanCot, b);
      pValEl.textContent = periodObj.exact;
      const pSubEl = document.getElementById('gos-trig-period-sub');
      if (pSubEl) pSubEl.textContent = `≈ ${periodObj.approx} rad`;
      const fValEl = document.getElementById('gos-trig-freq-val');
      if (fValEl) fValEl.textContent = `${Math.round(Math.abs(b) * 100) / 100}`;
      const aValEl = document.getElementById('gos-trig-amp-val');
      if (aValEl) aValEl.textContent = `${Math.round(Math.abs(params.a !== undefined ? params.a : 1) * 100) / 100}`;
      const mValEl = document.getElementById('gos-trig-midline-val');
      if (mValEl) mValEl.textContent = `y = ${Math.round((params.d !== undefined ? params.d : 0) * 100) / 100}`;
    }
  }

  function updateParam(key, val) {
    setParam(key, val);
  }

  function addEquationRow() {
    if (!editingGraph) return;
    const colors = ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24', '#a855f7', '#f97316'];
    const idx = (editingGraph.equations || []).length;
    const color = colors[idx % colors.length];

    editingGraph.equations.push({
      id: Date.now(),
      label: `f${idx + 1}(x)`,
      expr: 'x',
      color: color,
      lineWidth: 2.6,
      visible: true
    });

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
    switchStudioTab('functions');
  }

  function removeEqRow(idx) {
    if (!editingGraph || !editingGraph.equations) return;
    editingGraph.equations.splice(idx, 1);
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
    switchStudioTab('functions');
  }

  function toggleEqVisible(idx, isVis) {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[idx]) return;
    editingGraph.equations[idx].visible = isVis;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function updateEqExpr(idx, expr) {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[idx]) return;
    editingGraph.equations[idx].expr = expr;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function updateEqColor(idx, col) {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[idx]) return;
    editingGraph.equations[idx].color = col;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function saveEditor() {
    if (!editingGraph) return;
    const modal = document.getElementById('graph-object-editor-modal');
    if (modal) {
      const xminEl = modal.querySelector('#gos-xmin');
      const xmaxEl = modal.querySelector('#gos-xmax');
      const yminEl = modal.querySelector('#gos-ymin');
      const ymaxEl = modal.querySelector('#gos-ymax');

      if (xminEl) editingGraph.xMin = parseFloat(xminEl.value) || editingGraph.xMin;
      if (xmaxEl) editingGraph.xMax = parseFloat(xmaxEl.value) || editingGraph.xMax;
      if (yminEl) editingGraph.yMin = parseFloat(yminEl.value) || editingGraph.yMin;
      if (ymaxEl) editingGraph.yMax = parseFloat(ymaxEl.value) || editingGraph.yMax;

      const equalScaleEl = modal.querySelector('#gos-equal-scale');
      if (equalScaleEl) editingGraph.equalAspect = equalScaleEl.checked;

      const showGridEl = modal.querySelector('#gos-show-grid');
      if (showGridEl) editingGraph.showGrid = showGridEl.checked;

      const showMinorGridEl = modal.querySelector('#gos-show-minor-grid');
      if (showMinorGridEl) editingGraph.showMinorGrid = showMinorGridEl.checked;

      const showAxesEl = modal.querySelector('#gos-show-axes');
      if (showAxesEl) editingGraph.showAxes = showAxesEl.checked;

      const showLabelsEl = modal.querySelector('#gos-show-labels');
      if (showLabelsEl) editingGraph.showLabels = showLabelsEl.checked;
    }

    if (typeof Canvas !== 'undefined') {
      if (Canvas.renderShapes) Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }

    closeEditor();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('📈 Graph Updated Successfully');
    }
  }

  function insertGraphOnBoard(initialEq = 'x²') {
    if (typeof Canvas === 'undefined') return;
    const size = Canvas.getCanvasSize ? Canvas.getCanvasSize() : { W: 1000, H: 700 };
    const w = 520, h = 380;
    const x = Math.max(80, (size.W - w) / 2);
    const y = Math.max(60, (size.H - h) / 2);

    const graphObj = create(x, y, w, h, {
      equations: [
        { id: 1, label: 'f₁(x)', expr: initialEq, color: '#38bdf8', lineWidth: 2.8, visible: true }
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
      App.showToast('📈 Interactive Math Graph added! Click ⚙️ to explore parameters.');
    }
  }

  return {
    compile,
    normalize,
    create,
    draw,
    openEditor,
    closeEditor,
    switchStudioTab,
    applyTemplate,
    updateParam,
    setParam,
    stepParam,
    handleManualInput,
    commitManualInput,
    computeMathInsights,
    addEquationRow,
    removeEqRow,
    toggleEqVisible,
    updateEqExpr,
    updateEqColor,
    saveEditor,
    insertGraphOnBoard,
    handlePointerMove,
    handlePointerClick,
    pan,
    zoom,
    resetView,
    clearAllEquations,
    autoScaleView,
    getEditingGraph: () => editingGraph
  };

})();

if (typeof window !== 'undefined') {
  window.GraphObject = GraphObject;
}
