'use strict';

// ═══════════════════════════════════════════════
// SHAPE RENDERER — draws all math shapes on canvas
// ═══════════════════════════════════════════════

const Shapes = (() => {
  const PI = Math.PI;
  const SCALE = 0.1; // px to cm conversion for labels

  // ── Draw a dimension label badge ──
  function dimLabel(ctx, x, y, text, color) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    const pw = tw + 14, ph = 22;
    ctx.fillStyle = 'rgba(8,15,31,0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - pw/2, y - ph/2, pw, ph, 5);
    else ctx.rect(x - pw/2, y - ph/2, pw, ph);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Draw dashed helper line ──
  function helperLine(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(201,168,76,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Selection handles — enlarged for 65" SmartBoard touch grabbing ──
  function selectionHandles(ctx, bx, by, bw, bh) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(bx - 6, by - 6, bw + 12, bh + 12);
    ctx.setLineDash([]);
    const pts = [
      [bx-6, by-6], [bx-6+bw/2+6, by-6], [bx+bw+6, by-6],
      [bx-6, by-6+bh/2+6],                [bx+bw+6, by-6+bh/2+6],
      [bx-6, by+bh+6], [bx-6+bw/2+6, by+bh+6], [bx+bw+6, by+bh+6]
    ];
    pts.forEach(([hx, hy]) => {
      ctx.fillStyle = '#c9a84c';
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, PI*2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── Main draw dispatcher ──
  function draw(ctx, s) {
    // ── Delegate Table to TableTool ──
    if (s.type === 'table' && typeof TableTool !== 'undefined') {
      TableTool.draw(ctx, s);
      return;
    }
    // ── Delegate Sticky Note to StickyNotesTool ──
    if (s.type === 'stickyNote' && typeof StickyNotesTool !== 'undefined') {
      StickyNotesTool.draw(ctx, s);
      return;
    }

    // ── Delegate Graph to GraphObject ──
    if (s.type === 'graph' && typeof GraphObject !== 'undefined') {
      GraphObject.draw(ctx, s);
      if (s.selected) {
        selectionHandles(ctx, s.x, s.y, s.w, s.h);
      }
      return;
    }

    // ── Delegate science diagram types to ScienceShapes ──
    if (typeof ScienceShapes !== 'undefined' && ScienceShapes.isScienceShape(s.type)) {
      ScienceShapes.draw(ctx, s);
      if (s.selected) {
        const b = ScienceShapes.getBounds(s);
        selectionHandles(ctx, b.x, b.y, b.w, b.h);
      }
      return;
    }

    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle   = s.fill ? s.fill : 'transparent';
    ctx.lineWidth   = s.selected ? 2.5 : 2;
    ctx.setLineDash([]);
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';

    switch (s.type) {

      case 'image': {
        if (!s._imgObj) {
          s._imgObj = new Image();
          s._imgObj.src = s.src;
          s._imgObj.onload = () => {
            if (typeof Canvas !== 'undefined') Canvas.renderShapes();
          };
        }
        if (s._imgObj.complete && s._imgObj.naturalWidth > 0) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(s._imgObj, s.x, s.y, s.w, s.h);
          ctx.restore();
        } else {
          ctx.strokeStyle = '#c9a84c';
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(s.x, s.y, s.w, s.h);
          ctx.setLineDash([]);
        }
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.w, s.h);
        break;
      }

      case 'rectangle':
      case 'square': {
        ctx.beginPath();
        ctx.rect(s.x, s.y, s.w, s.h);
        ctx.fill();
        ctx.stroke();
        // Right angle indicator
        const rsz = 12;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + rsz);
        ctx.lineTo(s.x + rsz, s.y + rsz);
        ctx.lineTo(s.x + rsz, s.y);
        ctx.strokeStyle = s.color + '99';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Labels
        dimLabel(ctx, s.x + s.w/2, s.y - 14,
          `${(s.w * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, s.x + s.w + 20, s.y + s.h/2,
          `${(s.h * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.w, s.h);
        break;
      }

      case 'circle': {
        const cx = s.x + s.r, cy = s.y + s.r;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r, 0, PI*2);
        ctx.fill();
        ctx.stroke();
        // Center dot only — no label on canvas, shown in right panel
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, PI*2); ctx.fill();
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r*2);
        break;
      }

      case 'triangle': {
        const tip  = { x: s.x + s.base/2, y: s.y };
        const bl   = { x: s.x, y: s.y + s.height };
        const br   = { x: s.x + s.base, y: s.y + s.height };
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        helperLine(ctx, tip.x, tip.y, tip.x, s.y + s.height);
        dimLabel(ctx, s.x + s.base/2, s.y + s.height + 16,
          `b = ${(s.base * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, tip.x + 28, s.y + s.height/2,
          `h = ${(s.height * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.base, s.height);
        break;
      }

      case 'trapezium': {
        const off = (s.b - s.a) / 2;
        ctx.beginPath();
        ctx.moveTo(s.x + off, s.y);
        ctx.lineTo(s.x + off + s.a, s.y);
        ctx.lineTo(s.x + s.b, s.y + s.h);
        ctx.lineTo(s.x, s.y + s.h);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        helperLine(ctx, s.x + s.b/2, s.y, s.x + s.b/2, s.y + s.h);
        dimLabel(ctx, s.x + off + s.a/2, s.y - 14,
          `a = ${(s.a * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, s.x + s.b/2, s.y + s.h + 16,
          `b = ${(s.b * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, s.x + s.b + 26, s.y + s.h/2,
          `h = ${(s.h * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.b, s.h);
        break;
      }

      case 'parallelogram': {
        ctx.beginPath();
        ctx.moveTo(s.x + s.slant, s.y);
        ctx.lineTo(s.x + s.slant + s.base, s.y);
        ctx.lineTo(s.x + s.base, s.y + s.h);
        ctx.lineTo(s.x, s.y + s.h);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        helperLine(ctx, s.x + s.slant + s.base/2, s.y,
                        s.x + s.slant + s.base/2, s.y + s.h);
        dimLabel(ctx, s.x + s.slant + s.base/2, s.y - 14,
          `b = ${(s.base * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, s.x + s.slant + s.base + 22, s.y + s.h/2,
          `h = ${(s.h * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.base + s.slant, s.h);
        break;
      }

      case 'rhombus': {
        const rx = s.x + s.d1/2, ry = s.y + s.d2/2;
        ctx.beginPath();
        ctx.moveTo(rx, s.y);
        ctx.lineTo(s.x + s.d1, ry);
        ctx.lineTo(rx, s.y + s.d2);
        ctx.lineTo(s.x, ry);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        helperLine(ctx, s.x, ry, s.x + s.d1, ry);
        helperLine(ctx, rx, s.y, rx, s.y + s.d2);
        dimLabel(ctx, rx, s.y - 14,
          `d₁ = ${(s.d1 * SCALE).toFixed(1)}`, s.color);
        dimLabel(ctx, s.x + s.d1 + 22, ry,
          `d₂ = ${(s.d2 * SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.d1, s.d2);
        break;
      }

      case 'sector': {
        const scx = s.x + s.r, scy = s.y + s.r;
        const startA = -PI/2;
        const endA   = startA + (s.angle * PI / 180);
        ctx.beginPath();
        ctx.moveTo(scx, scy);
        ctx.arc(scx, scy, s.r, startA, endA);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Angle arc
        ctx.beginPath();
        ctx.arc(scx, scy, 20, startA, endA);
        ctx.strokeStyle = s.color + 'aa';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        dimLabel(ctx, scx + 10, scy - s.r/2,
          `r = ${(s.r * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, scx + 28, scy + 18,
          `θ = ${s.angle}°`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r*2);
        break;
      }

      case 'number-line': {
        const nlY = s.y + 20;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = s.color;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(s.x, nlY);
        ctx.lineTo(s.x + s.length, nlY);
        ctx.stroke();
        // Arrowheads
        ctx.beginPath();
        ctx.moveTo(s.x + s.length, nlY);
        ctx.lineTo(s.x + s.length - 10, nlY - 5);
        ctx.lineTo(s.x + s.length - 10, nlY + 5);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s.x, nlY);
        ctx.lineTo(s.x + 10, nlY - 5);
        ctx.lineTo(s.x + 10, nlY + 5);
        ctx.closePath();
        ctx.fill();
        // Ticks and numbers
        const range = s.max - s.min;
        const steps = Math.min(range, 12);
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= steps; i++) {
          const px  = s.x + (i / steps) * s.length;
          const val = s.min + (i / steps) * range;
          ctx.beginPath();
          ctx.moveTo(px, nlY - 7);
          ctx.lineTo(px, nlY + 7);
          ctx.stroke();
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = s.color;
          ctx.fillText(Math.round(val * 10) / 10, px, nlY + 10);
        }
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.length, 40);
        break;
      }

      case 'equilateral': {
        const eqH = s.side * Math.sqrt(3) / 2;
        ctx.beginPath();
        ctx.moveTo(s.x + s.side/2, s.y);
        ctx.lineTo(s.x + s.side,   s.y + eqH);
        ctx.lineTo(s.x,            s.y + eqH);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        helperLine(ctx, s.x + s.side/2, s.y, s.x + s.side/2, s.y + eqH);
        dimLabel(ctx, s.x + s.side/2, s.y + eqH + 16, `a = ${(s.side*SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.side, eqH);
        break;
      }

      case 'rightTriangle': {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y + s.height);
        ctx.lineTo(s.x + s.base, s.y + s.height);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = s.color + 'cc'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.strokeRect(s.x + 1, s.y + s.height - 14, 13, 13);
        dimLabel(ctx, s.x + s.base/2, s.y + s.height + 16, `b = ${(s.base*SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, s.x - 28, s.y + s.height/2, `h = ${(s.height*SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.base, s.height);
        break;
      }

      case 'hollowCylinder': {
        const hcx = s.x + s.R, ey = s.R * 0.22;
        ctx.fillStyle = s.fill || 'transparent';
        ctx.beginPath(); ctx.ellipse(hcx, s.y + ey, s.R, ey, 0, 0, PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(hcx, s.y + s.h, s.R, ey, 0, 0, PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + ey); ctx.lineTo(s.x, s.y + s.h);
        ctx.moveTo(s.x + s.R*2, s.y + ey); ctx.lineTo(s.x + s.R*2, s.y + s.h);
        ctx.stroke();
        ctx.save(); ctx.setLineDash([4,3]); ctx.strokeStyle = s.color + 'aa'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(hcx, s.y + ey, s.r, ey*0.6, 0, 0, PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(hcx, s.y + s.h, s.r, ey*0.6, 0, 0, PI*2); ctx.stroke();
        ctx.restore();
        dimLabel(ctx, hcx, s.y - 12, `R=${(s.R*SCALE).toFixed(1)} r=${(s.r*SCALE).toFixed(1)}`, s.color);
        dimLabel(ctx, hcx + s.R + 24, s.y + s.h/2, `h=${(s.h*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.R*2, s.h);
        break;
      }

      case 'hemisphere': {
        const hsx = s.x + s.r, hsy = s.y + s.r;
        ctx.beginPath(); ctx.arc(hsx, hsy, s.r, PI, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(hsx, hsy, s.r, s.r * 0.25, 0, 0, PI*2);
        if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); } ctx.stroke();
        helperLine(ctx, hsx, hsy, hsx + s.r, hsy);
        dimLabel(ctx, hsx + s.r/2, hsy - 12, `r = ${(s.r*SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r);
        break;
      }

      case 'rectPrism': {
        const dz = s.depth * 0.38;
        ctx.fillStyle = s.fill || 'transparent'; ctx.strokeStyle = s.color; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.rect(s.x, s.y + dz, s.w, s.h); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + dz); ctx.lineTo(s.x + dz, s.y);
        ctx.lineTo(s.x + s.w + dz, s.y); ctx.lineTo(s.x + s.w, s.y + dz);
        ctx.closePath(); if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); } ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x + s.w, s.y + dz); ctx.lineTo(s.x + s.w + dz, s.y);
        ctx.lineTo(s.x + s.w + dz, s.y + s.h); ctx.lineTo(s.x + s.w, s.y + s.h + dz);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        dimLabel(ctx, s.x + s.w/2, s.y + s.h + dz + 16,
          `l=${(s.w*SCALE).toFixed(1)} b=${(s.depth*SCALE).toFixed(1)} h=${(s.h*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.w + dz, s.h + dz);
        break;
      }

      case 'pentPrism':
      case 'hexPrism': {
        const ns  = s.type === 'pentPrism' ? 5 : 6;
        const pd  = s.depth * 0.35;
        const pcx = s.x + s.r, pcy = s.y + s.r;
        const pts2 = [];
        for (let i = 0; i < ns; i++) {
          const a = (i * 2 * PI / ns) - PI/2;
          pts2.push({ x: pcx + s.r * Math.cos(a), y: pcy + s.r * Math.sin(a) });
        }
        ctx.fillStyle = s.fill || 'transparent'; ctx.strokeStyle = s.color; ctx.lineWidth = 1.8;
        ctx.beginPath();
        pts2.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.setLineDash([4,3]); ctx.strokeStyle = s.color + 'aa'; ctx.lineWidth = 1;
        ctx.beginPath();
        pts2.forEach((p, i) => i === 0 ? ctx.moveTo(p.x+pd, p.y-pd) : ctx.lineTo(p.x+pd, p.y-pd));
        ctx.closePath(); ctx.stroke(); ctx.restore();
        pts2.forEach(p => {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + pd, p.y - pd); ctx.stroke();
        });
        dimLabel(ctx, pcx, pcy + s.r + 16, `r=${(s.r*SCALE).toFixed(1)} l=${(s.depth*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2 + pd, s.r*2);
        break;
      }

      case 'prism': {
        const pd = s.depth * 0.35;
        ctx.beginPath();
        ctx.moveTo(s.x + s.base/2, s.y); ctx.lineTo(s.x + s.base, s.y + s.height); ctx.lineTo(s.x, s.y + s.height);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth = 1.2; ctx.strokeStyle = s.color + 'aa';
        ctx.beginPath();
        ctx.moveTo(s.x + s.base/2 + pd, s.y - pd);
        ctx.lineTo(s.x + s.base + pd, s.y + s.height - pd);
        ctx.lineTo(s.x + pd, s.y + s.height - pd); ctx.closePath(); ctx.stroke();
        ctx.restore();
        [[s.x+s.base/2,s.y],[s.x+s.base,s.y+s.height],[s.x,s.y+s.height]].forEach(([px,py]) => {
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+pd, py-pd); ctx.stroke();
        });
        dimLabel(ctx, s.x + s.base/2, s.y + s.height + 16, `b=${(s.base*SCALE).toFixed(1)}  l=${(s.depth*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.base + pd, s.height);
        break;
      }

      case 'pyramid': {
        const apex = { x: s.x + s.base/2, y: s.y };
        const bl = { x: s.x, y: s.y + s.h };
        const br = { x: s.x + s.base, y: s.y + s.h };
        const brd = { x: s.x + s.base*1.2, y: s.y + s.h - s.base*0.15 };
        const bld = { x: s.x + s.base*0.2, y: s.y + s.h - s.base*0.15 };
        ctx.beginPath(); ctx.moveTo(apex.x,apex.y); ctx.lineTo(bl.x,bl.y); ctx.lineTo(br.x,br.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = s.fill || 'transparent';
        ctx.beginPath(); ctx.moveTo(apex.x,apex.y); ctx.lineTo(br.x,br.y); ctx.lineTo(brd.x,brd.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth = 1.2; ctx.strokeStyle = s.color + 'aa';
        ctx.beginPath(); ctx.moveTo(bl.x,bl.y); ctx.lineTo(bld.x,bld.y); ctx.lineTo(brd.x,brd.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(apex.x,apex.y); ctx.lineTo(bld.x,bld.y); ctx.stroke();
        ctx.restore();
        helperLine(ctx, apex.x, apex.y, apex.x, s.y + s.h);
        dimLabel(ctx, s.x + s.base/2, s.y + s.h + 16, `b=${(s.base*SCALE).toFixed(1)} h=${(s.h*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.base*1.2, s.h);
        break;
      }

      case 'semicircle': {
        const cx = s.x + s.r, cy = s.y + s.r;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r, Math.PI, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // diameter line
        helperLine(ctx, s.x, cy, s.x + s.r*2, cy);
        dimLabel(ctx, cx, cy + s.r + 16, `r = ${(s.r*SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r);
        break;
      }

      case 'ellipse': {
        const ecx = s.x + s.rx, ecy = s.y + s.ry;
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, s.rx, s.ry, 0, 0, PI*2);
        ctx.fill(); ctx.stroke();
        helperLine(ctx, ecx, ecy, ecx + s.rx, ecy);
        helperLine(ctx, ecx, ecy, ecx, ecy - s.ry);
        dimLabel(ctx, ecx + s.rx/2, ecy - 12, `a=${(s.rx*SCALE).toFixed(1)}`, s.color);
        dimLabel(ctx, ecx + s.rx + 20, ecy - s.ry/2, `b=${(s.ry*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.rx*2, s.ry*2);
        break;
      }

      case 'pentagon':
      case 'hexagon':
      case 'octagon': {
        const n   = s.sides;
        const pcx = s.x + s.r, pcy = s.y + s.r;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const angle = (i * 2 * PI / n) - PI/2;
          const px = pcx + s.r * Math.cos(angle);
          const py = pcy + s.r * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        dimLabel(ctx, pcx, pcy + s.r + 16, `r = ${(s.r*SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r*2);
        break;
      }

      case 'kite': {
        const kx = s.x + s.w/2;
        ctx.beginPath();
        ctx.moveTo(kx, s.y);                    // top
        ctx.lineTo(s.x + s.w, s.y + s.h1);     // right
        ctx.lineTo(kx, s.y + s.h1 + s.h2);     // bottom
        ctx.lineTo(s.x, s.y + s.h1);            // left
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        helperLine(ctx, kx, s.y, kx, s.y + s.h1 + s.h2);
        helperLine(ctx, s.x, s.y + s.h1, s.x + s.w, s.y + s.h1);
        dimLabel(ctx, kx + s.w/2 + 14, s.y + s.h1/2, `d₁`, s.color);
        dimLabel(ctx, kx, s.y + s.h1 + s.h2 + 16, `d₂`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.w, s.h1 + s.h2);
        break;
      }

      case 'sphere': {
        const sx = s.x + s.r, sy = s.y + s.r;
        // Main circle
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, PI*2);
        ctx.fill(); ctx.stroke();
        // Equator ellipse (dashed)
        ctx.save();
        ctx.setLineDash([5,4]);
        ctx.strokeStyle = s.color + 'aa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(sx, sy, s.r, s.r * 0.28, 0, 0, PI*2);
        ctx.stroke();
        ctx.restore();
        // Center dot
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, PI*2); ctx.fill();
        dimLabel(ctx, sx + s.r/2, sy - 12, `r = ${(s.r*SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r*2);
        break;
      }

      case 'cuboid': {
        const dz = s.d * 0.4;
        // Front face
        ctx.beginPath(); ctx.rect(s.x, s.y + dz, s.w, s.h);
        ctx.fill(); ctx.stroke();
        // Top face
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + dz);
        ctx.lineTo(s.x + dz, s.y);
        ctx.lineTo(s.x + s.w + dz, s.y);
        ctx.lineTo(s.x + s.w, s.y + dz);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Right face
        ctx.beginPath();
        ctx.moveTo(s.x + s.w, s.y + dz);
        ctx.lineTo(s.x + s.w + dz, s.y);
        ctx.lineTo(s.x + s.w + dz, s.y + s.h);
        ctx.lineTo(s.x + s.w, s.y + s.h + dz);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        dimLabel(ctx, s.x + s.w/2, s.y + s.h + dz + 16, `l=${(s.w*SCALE).toFixed(1)}`, s.color);
        dimLabel(ctx, s.x + s.w + dz + 24, s.y + dz + s.h/2, `h=${(s.h*SCALE).toFixed(1)}`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.w + dz, s.h + dz);
        break;
      }

      case 'protractor': {
        const prx = s.x + s.r, pry = s.y + s.r;
        // Semicircle
        ctx.beginPath(); ctx.arc(prx, pry, s.r, PI, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Degree marks
        ctx.strokeStyle = s.color; ctx.lineWidth = 1;
        for (let deg = 0; deg <= 180; deg += 10) {
          const rad = (PI - deg * PI/180);
          const tick = deg % 30 === 0 ? 14 : 8;
          ctx.beginPath();
          ctx.moveTo(prx + s.r * Math.cos(rad), pry + s.r * Math.sin(rad));
          ctx.lineTo(prx + (s.r - tick) * Math.cos(rad), pry + (s.r - tick) * Math.sin(rad));
          ctx.stroke();
          if (deg % 30 === 0) {
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = s.color;
            ctx.fillText(deg, prx + (s.r-22)*Math.cos(rad), pry + (s.r-22)*Math.sin(rad));
          }
        }
        // Center line
        helperLine(ctx, s.x, pry, s.x + s.r*2, pry);
        // Center dot
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(prx, pry, 3, 0, PI*2); ctx.fill();
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.r);
        break;
      }
      case 'cube': {
        const d = s.side * 0.35; // depth offset
        // Front face
        ctx.beginPath();
        ctx.rect(s.x, s.y + d, s.side, s.side);
        ctx.fill(); ctx.stroke();
        // Top face
        ctx.beginPath();
        ctx.moveTo(s.x,        s.y + d);
        ctx.lineTo(s.x + d,    s.y);
        ctx.lineTo(s.x + s.side + d, s.y);
        ctx.lineTo(s.x + s.side,     s.y + d);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Right face
        ctx.beginPath();
        ctx.moveTo(s.x + s.side, s.y + d);
        ctx.lineTo(s.x + s.side + d, s.y);
        ctx.lineTo(s.x + s.side + d, s.y + s.side);
        ctx.lineTo(s.x + s.side, s.y + s.side + d);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        dimLabel(ctx, s.x + s.side/2, s.y + s.side + d + 16,
          `side = ${(s.side * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.side + d, s.side + d);
        break;
      }

      case 'cylinder': {
        const ex = s.r * 0.4; // ellipse x-radius
        const ey = s.r * 0.18;
        const cx = s.x + s.r;
        // Body
        ctx.beginPath();
        ctx.rect(s.x, s.y + ey, s.r*2, s.h - ey);
        ctx.fill();
        // Left and right sides
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + ey);
        ctx.lineTo(s.x, s.y + s.h);
        ctx.moveTo(s.x + s.r*2, s.y + ey);
        ctx.lineTo(s.x + s.r*2, s.y + s.h);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Bottom ellipse
        ctx.beginPath();
        ctx.ellipse(cx, s.y + s.h, s.r, ey, 0, 0, PI*2);
        if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); }
        ctx.strokeStyle = s.color; ctx.stroke();
        // Top ellipse
        ctx.beginPath();
        ctx.ellipse(cx, s.y + ey, s.r, ey, 0, 0, PI*2);
        ctx.fill(); ctx.stroke();
        helperLine(ctx, cx, s.y + ey, cx + s.r, s.y + ey);
        helperLine(ctx, s.x + s.r*2 + 8, s.y + ey, s.x + s.r*2 + 8, s.y + s.h);
        dimLabel(ctx, cx + s.r/2 + 8, s.y + ey - 12,
          `r = ${(s.r * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, s.x + s.r*2 + 30, s.y + s.h/2,
          `h = ${(s.h * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.h);
        break;
      }

      case 'cone': {
        const ccx = s.x + s.r;
        const ey2  = s.r * 0.2;
        // Body triangle
        ctx.beginPath();
        ctx.moveTo(ccx, s.y);
        ctx.lineTo(s.x + s.r*2, s.y + s.h);
        ctx.lineTo(s.x, s.y + s.h);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Base ellipse
        ctx.beginPath();
        ctx.ellipse(ccx, s.y + s.h, s.r, ey2, 0, 0, PI*2);
        if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); }
        ctx.strokeStyle = s.color; ctx.stroke();
        helperLine(ctx, ccx, s.y, ccx, s.y + s.h);
        dimLabel(ctx, ccx + s.r/2, s.y + s.h + 18,
          `r = ${(s.r * SCALE).toFixed(1)} cm`, s.color);
        dimLabel(ctx, ccx + 28, s.y + s.h/2,
          `h = ${(s.h * SCALE).toFixed(1)} cm`, s.color);
        if (s.selected) selectionHandles(ctx, s.x, s.y, s.r*2, s.h);
        break;
      }

      case 'text-block': {
        if (s._editing) break;
        const fs         = s.fontSize || 24;
        const fontFam    = s.fontFamily || 'Noto Sans, sans-serif';
        const isBold     = s.bold ? '700' : '500';
        const rawLines   = (s.text || '').split('\n');
        if (!rawLines.length || (rawLines.length === 1 && !rawLines[0])) break;

        ctx.font         = `${isBold} ${fs}px ${fontFam}`;
        ctx.textAlign    = s.align || 'left';
        ctx.textBaseline = 'top';

        // Measure natural line widths
        const naturalMaxW = Math.max(...rawLines.map(l => ctx.measureText(l).width), 40);
        const lineH = fs * 1.35;
        const boxW  = s.w ? Math.max(60, s.w) : naturalMaxW;

        // Wrap words to fit box width if box is constrained
        let lines = [];
        if (s.w && s.w < naturalMaxW) {
          rawLines.forEach(line => {
            if (!line || ctx.measureText(line).width <= boxW) {
              lines.push(line);
              return;
            }
            const words = line.split(' ');
            let curLine = words[0] || '';
            for (let w = 1; w < words.length; w++) {
              const test = curLine + ' ' + words[w];
              if (ctx.measureText(test).width <= boxW) {
                curLine = test;
              } else {
                lines.push(curLine);
                curLine = words[w];
              }
            }
            lines.push(curLine);
          });
        } else {
          lines = rawLines;
        }

        const contentH = lines.length * lineH;
        const totalH = Math.max(s.h || 0, contentH);

        s.w = boxW;
        s.h = totalH;

        // Background highlight if enabled
        if (s.highlight) {
          ctx.fillStyle = s.highlightColor || 'rgba(254, 240, 138, 0.45)';
          ctx.fillRect(s.x - 4, s.y - 2, boxW + 8, totalH + 4);
        }

        // Draw each line
        ctx.save();
        if (s.opacity !== undefined) ctx.globalAlpha = s.opacity;
        ctx.fillStyle = s.color || '#ffffff';
        lines.forEach((line, i) => {
          let drawX = s.x;
          if (s.align === 'center') drawX = s.x + boxW / 2;
          else if (s.align === 'right') drawX = s.x + boxW;
          ctx.fillText(line, drawX, s.y + i * lineH);
        });
        ctx.restore();

        // 4 corner handles + solid border if selected
        if (s.selected) {
          ctx.save();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth   = 1.5;
          ctx.strokeRect(s.x - 4, s.y - 4, boxW + 8, totalH + 8);

          // 4 corner circles
          const corners = [
            [s.x - 4, s.y - 4],
            [s.x + boxW + 4, s.y - 4],
            [s.x - 4, s.y + totalH + 4],
            [s.x + boxW + 4, s.y + totalH + 4]
          ];
          corners.forEach(([cx, cy]) => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
          ctx.restore();
        }
        break;
      }

      case 'measured-line': {
        const p1 = { x: s.x1, y: s.y1 };
        const p2 = { x: s.x2, y: s.y2 };
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        ctx.strokeStyle = s.color || '#ffffff';
        ctx.lineWidth   = s.selected ? 3 : 2.2;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Endpoints
        [p1, p2].forEach((p, idx) => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = s.color || '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = s.color || '#38bdf8';
          const name = idx === 0 ? (s.labelA || 'A') : (s.labelB || 'B');
          ctx.fillText(name, p.x + 8, p.y - 6);
        });

        // Midpoint measurement badge
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const offX = -Math.sin(ang) * 16;
        const offY =  Math.cos(ang) * 16;

        const lenText = (typeof GeometryTool !== 'undefined') ? GeometryTool.formatLength(d, s.unit || 'cm') : `${(d * SCALE).toFixed(2)} cm`;
        dimLabel(ctx, mx + offX, my + offY, lenText, s.color || '#38bdf8');

        if (s.selected) {
          [p1, p2].forEach(p => {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
        break;
      }

      case 'measured-angle': {
        const v = { x: s.vx, y: s.vy };
        const pA = { x: s.ax, y: s.ay };
        const pB = { x: s.bx, y: s.by };

        ctx.strokeStyle = s.color || '#ffffff';
        ctx.lineWidth   = s.selected ? 3 : 2.2;
        ctx.lineCap     = 'round';

        // Rays
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(pA.x, pA.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        // Angle arc
        const angA = Math.atan2(pA.y - v.y, pA.x - v.x);
        const angB = Math.atan2(pB.y - v.y, pB.x - v.x);
        const arcR = Math.min(48, Math.max(22, Math.min(Math.hypot(pA.x - v.x, pA.y - v.y), Math.hypot(pB.x - v.x, pB.y - v.y)) * 0.45));

        let diff = angB - angA;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI)  diff -= Math.PI * 2;

        // Shaded interior sector
        ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.arc(v.x, v.y, arcR, angA, angA + diff, diff < 0);
        ctx.closePath();
        ctx.fill();

        const degVal = Math.abs(diff * 180 / Math.PI);
        if (Math.abs(degVal - 90) < 1.8) {
          const sq = 14;
          const uA = { x: Math.cos(angA) * sq, y: Math.sin(angA) * sq };
          const uB = { x: Math.cos(angB) * sq, y: Math.sin(angB) * sq };
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(v.x + uA.x, v.y + uA.y);
          ctx.lineTo(v.x + uA.x + uB.x, v.y + uA.y + uB.y);
          ctx.lineTo(v.x + uB.x, v.y + uB.y);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(v.x, v.y, arcR, angA, angA + diff, diff < 0);
          ctx.stroke();
        }

        // Angle badge
        const midAng = angA + diff / 2;
        const badgeX = v.x + Math.cos(midAng) * (arcR + 24);
        const badgeY = v.y + Math.sin(midAng) * (arcR + 24);
        const degText = s.degrees !== undefined ? `${s.degrees}°` : (typeof GeometryTool !== 'undefined' ? GeometryTool.formatAngle(degVal) : `${Math.round(degVal)}°`);
        dimLabel(ctx, badgeX, badgeY, `∠ = ${degText}`, '#f59e0b');

        // Markers
        [v, pA, pB].forEach((p, idx) => {
          ctx.fillStyle = idx === 0 ? '#f59e0b' : '#ffffff';
          ctx.strokeStyle = s.color || '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        if (s.selected) {
          [v, pA, pB].forEach(p => {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
        break;
      }

      case 'measured-circle': {
        const cx = s.cx, cy = s.cy, r = s.r;

        ctx.strokeStyle = s.color || '#ffffff';
        ctx.lineWidth   = s.selected ? 3 : 2.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Radius dashed guide line to rim
        ctx.save();
        ctx.strokeStyle = 'rgba(201, 168, 76, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r, cy);
        ctx.stroke();
        ctx.restore();

        // Radius label
        const rText = s.label || ((typeof GeometryTool !== 'undefined') ? `r = ${GeometryTool.formatLength(r)}` : `r = ${(r * SCALE).toFixed(2)} cm`);
        dimLabel(ctx, cx + r / 2, cy - 14, rText, '#eab308');

        if (s.selected) {
          selectionHandles(ctx, cx - r, cy - r, r * 2, r * 2);
        }
        break;
      }

      case 'arrow': {
        const p1 = { x: s.x1, y: s.y1 };
        const p2 = { x: s.x2, y: s.y2 };
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.strokeStyle = s.color || '#ffffff';
        ctx.fillStyle   = s.color || '#38bdf8';
        ctx.lineWidth   = s.selected ? 3 : 2.2;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Arrowhead at p2
        const headLen = Math.min(18, Math.max(10, d * 0.2));
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - headLen * Math.cos(ang - Math.PI / 6), p2.y - headLen * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(p2.x - headLen * 0.7 * Math.cos(ang), p2.y - headLen * 0.7 * Math.sin(ang));
        ctx.lineTo(p2.x - headLen * Math.cos(ang + Math.PI / 6), p2.y - headLen * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Length badge
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        dimLabel(ctx, mx, my - 14, `${(d * SCALE).toFixed(1)} cm`, s.color || '#38bdf8');

        if (s.selected) {
          [p1, p2].forEach(p => {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
          });
        }
        break;
      }

      case 'polygon': {
        if (!s.points || s.points.length < 3) break;
        ctx.beginPath();
        s.points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const b = _mathGetBounds(s);
        dimLabel(ctx, b.x + b.w / 2, b.y + b.h + 16, `${s.polygonName || 'Polygon'} (${s.points.length}-gon)`, s.color);
        if (s.selected) selectionHandles(ctx, b.x, b.y, b.w, b.h);
        break;
      }
    }

    ctx.restore();
  }

  // ── Bounding box for hit-testing (math shapes) ──
  function _mathGetBounds(s) {
    switch (s.type) {
      case 'table':
      case 'stickyNote':
      case 'graph':          return { x: s.x, y: s.y, w: s.w, h: s.h };
      case 'image':          return { x: s.x, y: s.y, w: s.w, h: s.h };
      case 'equilateral':    return { x: s.x, y: s.y, w: s.side, h: s.side * Math.sqrt(3)/2 };
      case 'rightTriangle':  return { x: s.x, y: s.y, w: s.base, h: s.height };
      case 'hollowCylinder': return { x: s.x, y: s.y, w: s.R*2, h: s.h };
      case 'hemisphere':     return { x: s.x, y: s.y, w: s.r*2, h: s.r };
      case 'rectPrism':      return { x: s.x, y: s.y, w: s.w + s.depth*0.38, h: s.h + s.depth*0.38 };
      case 'pentPrism':
      case 'hexPrism':       return { x: s.x, y: s.y, w: s.r*2 + s.depth*0.35, h: s.r*2 };
      case 'prism':          return { x: s.x, y: s.y, w: s.base + s.depth*0.35, h: s.height };
      case 'pyramid':        return { x: s.x, y: s.y, w: s.base*1.2, h: s.h };
      case 'ellipse':       return { x: s.x, y: s.y, w: s.rx*2, h: s.ry*2 };
      case 'pentagon':
      case 'hexagon':
      case 'octagon':       return { x: s.x, y: s.y, w: s.r*2, h: s.r*2 };
      case 'kite':          return { x: s.x, y: s.y, w: s.w, h: s.h1 + s.h2 };
      case 'sphere':        return { x: s.x, y: s.y, w: s.r*2, h: s.r*2 };
      case 'cuboid':        return { x: s.x, y: s.y, w: s.w + s.d*0.4, h: s.h + s.d*0.4 };
      case 'protractor':    return { x: s.x, y: s.y, w: s.r*2, h: s.r };
      case 'triangle':     return { x: s.x, y: s.y, w: s.base, h: s.height };
      case 'trapezium':    return { x: s.x, y: s.y, w: s.b, h: s.h };
      case 'parallelogram':return { x: s.x, y: s.y, w: s.base + s.slant, h: s.h };
      case 'rhombus':      return { x: s.x, y: s.y, w: s.d1, h: s.d2 };
      case 'sector':       return { x: s.x, y: s.y, w: s.r*2, h: s.r*2 };
      case 'number-line':  return { x: s.x, y: s.y, w: s.length, h: 40 };
      case 'cube':         return { x: s.x, y: s.y, w: s.side * 1.35, h: s.side * 1.35 };
      case 'cylinder':     return { x: s.x, y: s.y, w: s.r*2, h: s.h };
      case 'cone':         return { x: s.x, y: s.y, w: s.r*2, h: s.h };
      case 'text-block': {
        const fs    = s.fontSize || 18;
        const lines = (s.text || '').split('\n').filter(Boolean);
        const w     = s.w || Math.max(lines.length ? lines[0].length * fs * 0.6 : 80, 80);
        const h     = s.h || Math.max(lines.length * fs * 1.35, fs + 10);
        return { x: s.x, y: s.y, w, h };
      }
      case 'measured-line': {
        const minX = Math.min(s.x1, s.x2);
        const minY = Math.min(s.y1, s.y2);
        const maxX = Math.max(s.x1, s.x2);
        const maxY = Math.max(s.y1, s.y2);
        return { x: minX - 10, y: minY - 10, w: Math.max(24, maxX - minX + 20), h: Math.max(24, maxY - minY + 20) };
      }
      case 'measured-angle': {
        const minX = Math.min(s.vx, s.ax, s.bx);
        const minY = Math.min(s.vy, s.ay, s.by);
        const maxX = Math.max(s.vx, s.ax, s.bx);
        const maxY = Math.max(s.vy, s.ay, s.by);
        return { x: minX - 14, y: minY - 14, w: Math.max(28, maxX - minX + 28), h: Math.max(28, maxY - minY + 28) };
      }
      case 'measured-circle': {
        return { x: s.cx - s.r, y: s.cy - s.r, w: s.r * 2, h: s.r * 2 };
      }
      case 'arrow': {
        const minX = Math.min(s.x1, s.x2);
        const minY = Math.min(s.y1, s.y2);
        const maxX = Math.max(s.x1, s.x2);
        const maxY = Math.max(s.y1, s.y2);
        return { x: minX - 10, y: minY - 10, w: Math.max(24, maxX - minX + 20), h: Math.max(24, maxY - minY + 20) };
      }
      case 'polygon': {
        if (!s.points || !s.points.length) return { x: s.x || 0, y: s.y || 0, w: s.w || 100, h: s.h || 100 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        s.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
        return { x: minX - 8, y: minY - 8, w: Math.max(20, maxX - minX + 16), h: Math.max(20, maxY - minY + 16) };
      }
      default:             return { x: s.x, y: s.y, w: s.w || 100, h: s.h || 100 };
    }
  }

  // ── Formula calculator ──
  function getFormula(s) {
    const sc = 0.1;
    switch (s.type) {
      case 'rectangle': {
        const l = +(s.w * sc).toFixed(2), b = +(s.h * sc).toFixed(2);
        return {
          name: 'Rectangle',
          expr: `A = l × b = ${l} × ${b}\nP = 2(l+b) = 2(${l}+${b})`,
          result: `Area = ${(l*b).toFixed(3)} cm²   |   Perimeter = ${(2*(l+b)).toFixed(2)} cm`
        };
      }
      case 'square': {
        const a = +(s.w * sc).toFixed(2);
        return {
          name: 'Square',
          expr: `A = a² = ${a}²\nP = 4a = 4 × ${a}`,
          result: `Area = ${(a*a).toFixed(3)} cm²   |   Perimeter = ${(4*a).toFixed(2)} cm`
        };
      }
      case 'circle': {
        const r = +(s.r * sc).toFixed(2);
        return {
          name: 'Circle',
          expr: `A = πr² = π × ${r}²\nC = 2πr = 2π × ${r}`,
          result: `Area = ${(Math.PI*r*r).toFixed(3)} cm²   |   Circumference = ${(2*Math.PI*r).toFixed(3)} cm`
        };
      }
      case 'triangle': {
        const b = +(s.base * sc).toFixed(2), h = +(s.height * sc).toFixed(2);
        return {
          name: 'Triangle',
          expr: `A = ½ × b × h\n  = ½ × ${b} × ${h}`,
          result: `Area = ${(0.5*b*h).toFixed(3)} cm²`
        };
      }
      case 'trapezium': {
        const a = +(s.a * sc).toFixed(2), b = +(s.b * sc).toFixed(2), h = +(s.h * sc).toFixed(2);
        return {
          name: 'Trapezium',
          expr: `A = ½(a+b)h = ½(${a}+${b})×${h}`,
          result: `Area = ${(0.5*(a+b)*h).toFixed(3)} cm²`
        };
      }
      case 'parallelogram': {
        const b = +(s.base * sc).toFixed(2), h = +(s.h * sc).toFixed(2);
        return {
          name: 'Parallelogram',
          expr: `A = b × h = ${b} × ${h}`,
          result: `Area = ${(b*h).toFixed(3)} cm²`
        };
      }
      case 'rhombus': {
        const d1 = +(s.d1 * sc).toFixed(2), d2 = +(s.d2 * sc).toFixed(2);
        return {
          name: 'Rhombus',
          expr: `A = ½ × d₁ × d₂ = ½ × ${d1} × ${d2}`,
          result: `Area = ${(0.5*d1*d2).toFixed(3)} cm²`
        };
      }
      case 'sector': {
        const r = +(s.r * sc).toFixed(2), t = s.angle;
        return {
          name: 'Sector',
          expr: `A = (θ/360)×πr² = (${t}/360)×π×${r}²\nArc = (θ/360)×2πr`,
          result: `Sector Area = ${((t/360)*Math.PI*r*r).toFixed(3)} cm²   |   Arc = ${((t/360)*2*Math.PI*r).toFixed(3)} cm`
        };
      }
      case 'equilateral': {
        const a = +(s.side*sc).toFixed(2);
        return { name:'Equilateral Triangle', expr:`A = (√3/4)a² = (√3/4)×${a}²\nP = 3a = 3×${a}`, result:`A = ${(Math.sqrt(3)/4*a*a).toFixed(3)} cm²  |  P = ${(3*a).toFixed(2)} cm` };
      }
      case 'rightTriangle': {
        const b = +(s.base*sc).toFixed(2), h = +(s.height*sc).toFixed(2);
        const hyp = Math.sqrt(b*b+h*h);
        return { name:'Right Triangle', expr:`A = ½bh = ½×${b}×${h}\nHypotenuse = √(b²+h²) = ${hyp.toFixed(3)}`, result:`A = ${(0.5*b*h).toFixed(3)} cm²  |  P = ${(b+h+hyp).toFixed(3)} cm` };
      }
      case 'hollowCylinder': {
        const R = +(s.R*sc).toFixed(2), r = +(s.r*sc).toFixed(2), h = +(s.h*sc).toFixed(2);
        return { name:'Hollow Cylinder', expr:`V = π(R²−r²)h = π(${R}²−${r}²)×${h}\nCSA = 2π(R+r)h`, result:`V = ${(Math.PI*(R*R-r*r)*h).toFixed(3)} cm³  |  CSA = ${(2*Math.PI*(R+r)*h).toFixed(3)} cm²` };
      }
      case 'hemisphere': {
        const r = +(s.r*sc).toFixed(2);
        return { name:'Hemisphere', expr:`V = ⅔πr³ = ⅔×π×${r}³\nCSA = 2πr²\nTSA = 3πr²`, result:`V = ${((2/3)*Math.PI*r*r*r).toFixed(3)} cm³  |  TSA = ${(3*Math.PI*r*r).toFixed(3)} cm²` };
      }
      case 'rectPrism': {
        const rl = +(s.w*sc).toFixed(2), rb = +(s.depth*sc).toFixed(2), rh = +(s.h*sc).toFixed(2);
        return { name:'Rectangular Prism', expr:`V = l×b×h = ${rl}×${rb}×${rh}\nTSA = 2(lb+bh+lh)`, result:`V = ${(rl*rb*rh).toFixed(3)} cm³  |  TSA = ${(2*(rl*rb+rb*rh+rl*rh)).toFixed(3)} cm²` };
      }
      case 'pentPrism': {
        const pr = +(s.r*sc).toFixed(2), pl = +(s.depth*sc).toFixed(2);
        const pa = 0.5 * 5 * pr * pr * Math.sin(2*Math.PI/5);
        return { name:'Pentagonal Prism', expr:`V = ½×5×r²×sin(72°)×l\n= ½×5×${pr}²×sin72°×${pl}`, result:`V = ${(pa*pl).toFixed(3)} cm³  |  Base A = ${pa.toFixed(3)} cm²` };
      }
      case 'hexPrism': {
        const hr = +(s.r*sc).toFixed(2), hl = +(s.depth*sc).toFixed(2);
        const ha = 0.5 * 6 * hr * hr * Math.sin(2*Math.PI/6);
        return { name:'Hexagonal Prism', expr:`V = ½×6×r²×sin(60°)×l\n= ½×6×${hr}²×sin60°×${hl}`, result:`V = ${(ha*hl).toFixed(3)} cm³  |  Base A = ${ha.toFixed(3)} cm²` };
      }
      case 'prism': {
        const b = +(s.base*sc).toFixed(2), h = +(s.height*sc).toFixed(2), l = +(s.depth*sc).toFixed(2);
        const ba = 0.5*b*h;
        return { name:'Triangular Prism', expr:`V = Base Area × l = ½bh × l\n= ½×${b}×${h}×${l}`, result:`V = ${(ba*l).toFixed(3)} cm³  |  Base A = ${ba.toFixed(3)} cm²` };
      }
      case 'pyramid': {
        const b = +(s.base*sc).toFixed(2), h = +(s.h*sc).toFixed(2);
        const sl = Math.sqrt(h*h + (b/2)*(b/2));
        return { name:'Square Pyramid', expr:`V = ⅓b²h = ⅓×${b}²×${h}\nTSA = b²+2bl  (l=${sl.toFixed(2)})`, result:`V = ${((1/3)*b*b*h).toFixed(3)} cm³  |  TSA = ${(b*b+2*b*sl).toFixed(3)} cm²` };
      }
      case 'ellipse': {
        const a = +(s.rx*sc).toFixed(2), b = +(s.ry*sc).toFixed(2);
        return { name:'Ellipse', expr:`A = π×a×b = π×${a}×${b}`, result:`A = ${(Math.PI*a*b).toFixed(3)} cm²` };
      }
      case 'pentagon': case 'hexagon': case 'octagon': {
        const n = s.sides, r = +(s.r*sc).toFixed(2);
        return { name:`Regular ${n}-gon`, expr:`A = ½nr²sin(2π/n)`, result:`A = ${(0.5*n*r*r*Math.sin(2*Math.PI/n)).toFixed(3)} cm²` };
      }
      case 'kite': {
        const d1 = +(s.w*sc).toFixed(2), d2 = +((s.h1+s.h2)*sc).toFixed(2);
        return { name:'Kite', expr:`A = ½d₁d₂ = ½×${d1}×${d2}`, result:`A = ${(0.5*d1*d2).toFixed(3)} cm²` };
      }
      case 'sphere': {
        const r = +(s.r*sc).toFixed(2);
        return { name:'Sphere', expr:`V = ⁴⁄₃πr³\nSA = 4πr²`, result:`V = ${((4/3)*Math.PI*r*r*r).toFixed(3)} cm³  |  SA = ${(4*Math.PI*r*r).toFixed(3)} cm²` };
      }
      case 'cuboid': {
        const l = +(s.w*sc).toFixed(2), h = +(s.h*sc).toFixed(2), d = +(s.d*sc).toFixed(2);
        return { name:'Cuboid', expr:`V = l×b×h = ${l}×${d}×${h}\nTSA = 2(lb+bh+lh)`, result:`V = ${(l*d*h).toFixed(3)} cm³  |  TSA = ${(2*(l*d+d*h+l*h)).toFixed(3)} cm²` };
      }
      case 'cube': {
        const a = +(s.side * sc).toFixed(2);
        return {
          name: 'Cube',
          expr: `V = a³ = ${a}³\nTSA = 6a² = 6×${a}²`,
          result: `Volume = ${(a**3).toFixed(3)} cm³   |   TSA = ${(6*a*a).toFixed(3)} cm²`
        };
      }
      case 'cylinder': {
        const r = +(s.r * sc).toFixed(2), h = +(s.h * sc).toFixed(2);
        return {
          name: 'Cylinder',
          expr: `V = πr²h = π×${r}²×${h}\nCSA = 2πrh\nTSA = 2πr(r+h)`,
          result: `Volume = ${(Math.PI*r*r*h).toFixed(3)} cm³   |   TSA = ${(2*Math.PI*r*(r+h)).toFixed(3)} cm²`
        };
      }
      case 'cone': {
        const r = +(s.r * sc).toFixed(2), h = +(s.h * sc).toFixed(2);
        const l = Math.sqrt(r*r + h*h);
        return {
          name: 'Cone',
          expr: `V = ⅓πr²h = ⅓×π×${r}²×${h}\nCSA = πrl  (l=${l.toFixed(2)})`,
          result: `Volume = ${((1/3)*Math.PI*r*r*h).toFixed(3)} cm³   |   CSA = ${(Math.PI*r*l).toFixed(3)} cm²`
        };
      }
      case 'measured-line': {
        const d = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        const len = (d * sc).toFixed(2);
        return {
          name: 'Measured Segment',
          expr: `Distance |${s.labelA || 'A'}${s.labelB || 'B'}| = √((x₂-x₁)² + (y₂-y₁)²)`,
          result: `Length = ${len} cm`
        };
      }
      case 'measured-angle': {
        const deg = s.degrees !== undefined ? s.degrees : Math.round(Math.abs((Math.atan2(s.by - s.vy, s.bx - s.vx) - Math.atan2(s.ay - s.vy, s.ax - s.vx)) * 180 / Math.PI));
        return {
          name: 'Measured Angle',
          expr: `∠${s.labelA || 'A'}${s.labelV || 'V'}${s.labelB || 'B'} = ${deg}°`,
          result: `Angle = ${deg}°`
        };
      }
      case 'measured-circle': {
        const r = +(s.r * sc).toFixed(2);
        return {
          name: 'Compass Circle',
          expr: `Radius r = ${r} cm\nCircumference C = 2πr\nArea A = πr²`,
          result: `Radius = ${r} cm  |  C = ${(2*Math.PI*r).toFixed(2)} cm  |  A = ${(Math.PI*r*r).toFixed(2)} cm²`
        };
      }
      case 'arrow': {
        const d = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        return {
          name: 'Arrow Vector',
          expr: `Length |AB| = √((x₂-x₁)² + (y₂-y₁)²)`,
          result: `Length = ${(d * sc).toFixed(2)} cm`
        };
      }
      case 'polygon': {
        return {
          name: s.polygonName || 'Polygon',
          expr: `Vertices: ${s.points?.length || 0}`,
          result: `${s.points?.length || 0}-sided Polygon`
        };
      }
      default: return null;
    }
  }

  function getBounds(s) {
    if (!s) return { x: 0, y: 0, w: 0, h: 0 };
    // ── Science shapes have their own getBounds ──
    if (typeof ScienceShapes !== 'undefined' && ScienceShapes.isScienceShape(s.type)) {
      return ScienceShapes.getBounds(s);
    }
    // ── Fallback to original getBounds logic ──
    return _mathGetBounds(s);
  }

  function getHandles(s) {
    if (!s) return [];
    if (s.type === 'measured-line' || s.type === 'arrow') {
      return [
        { id: 'p1', x: s.x1, y: s.y1, cursor: 'crosshair' },
        { id: 'p2', x: s.x2, y: s.y2, cursor: 'crosshair' }
      ];
    }
    if (s.type === 'measured-angle') {
      return [
        { id: 'v', x: s.vx, y: s.vy, cursor: 'crosshair' },
        { id: 'a', x: s.ax, y: s.ay, cursor: 'crosshair' },
        { id: 'b', x: s.bx, y: s.by, cursor: 'crosshair' }
      ];
    }
    if (s.type === 'measured-circle') {
      return [
        { id: 'r_edge', x: s.cx + s.r, y: s.cy, cursor: 'ew-resize' },
        { id: 'tl', x: s.cx - s.r - 4, y: s.cy - s.r - 4, cursor: 'nwse-resize' },
        { id: 'tr', x: s.cx + s.r + 4, y: s.cy - s.r - 4, cursor: 'nesw-resize' },
        { id: 'bl', x: s.cx - s.r - 4, y: s.cy + s.r + 4, cursor: 'nesw-resize' },
        { id: 'br', x: s.cx + s.r + 4, y: s.cy + s.r + 4, cursor: 'nwse-resize' }
      ];
    }
    const b = getBounds(s);
    const x0 = b.x - 6, y0 = b.y - 6;
    const x1 = b.x + b.w + 6, y1 = b.y + b.h + 6;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return [
      { id: 'tl', x: x0, y: y0, cursor: 'nwse-resize' },
      { id: 'tc', x: mx, y: y0, cursor: 'ns-resize' },
      { id: 'tr', x: x1, y: y0, cursor: 'nesw-resize' },
      { id: 'ml', x: x0, y: my, cursor: 'ew-resize' },
      { id: 'mr', x: x1, y: my, cursor: 'ew-resize' },
      { id: 'bl', x: x0, y: y1, cursor: 'nesw-resize' },
      { id: 'bc', x: mx, y: y1, cursor: 'ns-resize' },
      { id: 'br', x: x1, y: y1, cursor: 'nwse-resize' }
    ];
  }

  function getHandleAt(s, px, py, radius = 20) {
    if (!s) return null;
    const handles = getHandles(s);
    for (const h of handles) {
      if (Math.hypot(px - h.x, py - h.y) <= radius) return h;
    }
    return null;
  }

  return { draw, getBounds, getFormula, dimLabel, getHandles, getHandleAt };
})();