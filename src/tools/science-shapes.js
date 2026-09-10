'use strict';

// ═══════════════════════════════════════════════════════════
// PIYUSHDHARA EDUVERSE BOARD — SCIENCE DIAGRAM SHAPES
// Physics, Circuit Schematics, Biology, Chemistry & Earth
// ═══════════════════════════════════════════════════════════

const ScienceShapes = (() => {

  const SCIENCE_SHAPE_DEFS = {
    // ── CIRCUITS ──
    'sc-battery':       { label: 'DC Battery',     w: 120, h: 60,  voltage: 12, labelText: '12V' },
    'sc-resistor':      { label: 'Resistor',       w: 120, h: 40,  resistance: 10, labelText: '10 Ω' },
    'sc-switch-open':   { label: 'Open Switch',    w: 90,  h: 50,  state: 'open' },
    'sc-switch-closed': { label: 'Closed Switch',  w: 90,  h: 40,  state: 'closed' },
    'sc-bulb':          { label: 'Electric Bulb',  w: 70,  h: 70,  labelText: 'L1', power: 60 },
    'sc-ammeter':       { label: 'Ammeter (A)',    w: 70,  h: 70,  current: 2.5, labelText: '2.5 A' },
    'sc-voltmeter':     { label: 'Voltmeter (V)',  w: 70,  h: 70,  voltage: 220, labelText: '220 V' },
    'sc-ground':        { label: 'Earth Ground',   w: 60,  h: 50 },

    // ── PHYSICS & FORCES ──
    'sc-force-vector':  { label: 'Force Vector',   w: 140, h: 50,  force: 50, angle: 0, labelText: 'F = 50 N' },
    'sc-motion-arrow':  { label: 'Velocity Vector',w: 130, h: 40,  velocity: 20, labelText: 'v = 20 m/s' },
    'sc-pulley':        { label: 'Pulley System',  w: 70,  h: 120, r: 30, load: 100 },
    'sc-convex-lens':   { label: 'Convex Lens',    w: 40,  h: 140, focalLength: 15 },
    'sc-concave-lens':  { label: 'Concave Lens',   w: 40,  h: 140, focalLength: -15 },
    'sc-optical-ray':   { label: 'Light Ray',      w: 140, h: 30,  color: '#e8c96b' },
    'sc-bar-magnet':    { label: 'Bar Magnet',     w: 140, h: 50,  poleN: 'N', poleS: 'S' },
    'sc-compass':       { label: 'Compass',        w: 80,  h: 80,  r: 40 },
    'sc-free-body':     { label: 'Free Body Diag', w: 120, h: 120, fn: 100, fg: 100, fa: 40, ff: 15 },

    // ── BIOLOGY ──
    'sc-plant-cell':    { label: 'Plant Cell',     w: 160, h: 120, cellType: 'plant' },
    'sc-animal-cell':   { label: 'Animal Cell',    w: 140, h: 120, cellType: 'animal' },
    'sc-nucleus':       { label: 'Cell Nucleus',   w: 80,  h: 80,  r: 40 },
    'sc-label-pointer': { label: 'Leader Label',   w: 130, h: 50,  text: 'Organelle' },

    // ── CHEMISTRY & LAB ──
    'sc-test-tube':     { label: 'Test Tube',      w: 36,  h: 130, liquidLevel: 65, color: '#38bdf8' },
    'sc-beaker':        { label: 'Beaker (250ml)', w: 90,  h: 110, volume: 150, liquidLevel: 60, color: '#34d399' },
    'sc-erlenmeyer':    { label: 'Conical Flask',  w: 100, h: 120, liquidLevel: 50, color: '#f472b6' },
    'sc-bunsen':        { label: 'Bunsen Burner',  w: 60,  h: 120, flame: true },
    'sc-atom-bohr':     { label: 'Bohr Atom',      w: 120, h: 120, r: 50, electrons: 6, element: 'C' },

    // ── EARTH & UNIVERSE ──
    'sc-earth':         { label: 'Earth Globe',    w: 100, h: 100, r: 50 },
    'sc-orbit':         { label: 'Planetary Orbit',w: 180, h: 100, rx: 90, ry: 50 }
  };

  function isScienceShape(type) {
    return !!SCIENCE_SHAPE_DEFS[type];
  }

  function getBounds(s) {
    const def = SCIENCE_SHAPE_DEFS[s.type] || { w: 100, h: 100 };
    return {
      x: s.x,
      y: s.y,
      w: s.w || def.w || 100,
      h: s.h || def.h || 100
    };
  }

  // ─────────────────────────────────────────────
  // DRAW DISPATCHER FOR SCIENCE SHAPES
  // ─────────────────────────────────────────────
  function draw(ctx, s) {
    ctx.save();
    ctx.strokeStyle = s.color || '#38bdf8';
    ctx.fillStyle   = (s.color || '#38bdf8') + '22';
    ctx.lineWidth   = s.selected ? 2.5 : 2;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';

    const x = s.x, y = s.y;
    const w = s.w || 100, h = s.h || 60;

    switch (s.type) {

      // ── BATTERY ──
      case 'sc-battery': {
        const midY = y + h / 2;
        // Lead in wire
        ctx.beginPath();
        ctx.moveTo(x, midY); ctx.lineTo(x + w * 0.35, midY);
        ctx.moveTo(x + w * 0.65, midY); ctx.lineTo(x + w, midY);
        ctx.stroke();

        // Positive long line
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.35, y + 8);
        ctx.lineTo(x + w * 0.35, y + h - 8);
        ctx.stroke();

        // Negative short thick line
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.47, y + h * 0.28);
        ctx.lineTo(x + w * 0.47, y + h * 0.72);
        ctx.stroke();

        // Second cell
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.55, y + 8);
        ctx.lineTo(x + w * 0.55, y + h - 8);
        ctx.stroke();

        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.65, y + h * 0.28);
        ctx.lineTo(x + w * 0.65, y + h * 0.72);
        ctx.stroke();

        // Signs & Voltage text
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('+', x + w * 0.32, y + 6);
        ctx.fillStyle = '#93c5fd';
        ctx.fillText('−', x + w * 0.67, y + 6);

        ctx.fillStyle = s.color || '#e8c96b';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(s.labelText || `${s.voltage || 12}V`, x + w * 0.38, y + h + 14);
        break;
      }

      // ── RESISTOR ──
      case 'sc-resistor': {
        const midY = y + h / 2;
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(x + 20, midY);

        // Zig-zag
        const seg = (w - 40) / 6;
        const amp = h * 0.35;
        ctx.lineTo(x + 20 + seg * 0.5, midY - amp);
        ctx.lineTo(x + 20 + seg * 1.5, midY + amp);
        ctx.lineTo(x + 20 + seg * 2.5, midY - amp);
        ctx.lineTo(x + 20 + seg * 3.5, midY + amp);
        ctx.lineTo(x + 20 + seg * 4.5, midY - amp);
        ctx.lineTo(x + 20 + seg * 5.5, midY + amp);
        ctx.lineTo(x + w - 20, midY);
        ctx.lineTo(x + w, midY);
        ctx.stroke();

        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = s.color || '#e8c96b';
        ctx.fillText(s.labelText || `${s.resistance || 10} Ω`, x + w * 0.35, y - 6);
        break;
      }

      // ── SWITCH OPEN ──
      case 'sc-switch-open': {
        const midY = y + h * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, midY); ctx.lineTo(x + 24, midY);
        ctx.moveTo(x + w - 24, midY); ctx.lineTo(x + w, midY);
        ctx.stroke();

        // Terminal dots
        ctx.beginPath(); ctx.arc(x + 24, midY, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + w - 24, midY, 4, 0, Math.PI * 2); ctx.stroke();

        // Blade open
        ctx.beginPath();
        ctx.moveTo(x + 24, midY);
        ctx.lineTo(x + w - 30, y + 10);
        ctx.stroke();

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Switch (Open)', x + w * 0.15, y - 2);
        break;
      }

      // ── SWITCH CLOSED ──
      case 'sc-switch-closed': {
        const midY = y + h / 2;
        ctx.beginPath();
        ctx.moveTo(x, midY); ctx.lineTo(x + w, midY);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 24, midY, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + w - 24, midY, 4, 0, Math.PI * 2); ctx.stroke();

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#86efac';
        ctx.fillText('Switch (Closed)', x + w * 0.12, y - 4);
        break;
      }

      // ── BULB ──
      case 'sc-bulb': {
        const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.38;
        // Connecting wires
        ctx.beginPath();
        ctx.moveTo(x, cy); ctx.lineTo(cx - r, cy);
        ctx.moveTo(cx + r, cy); ctx.lineTo(x + w, cy);
        ctx.stroke();

        // Outer circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253, 224, 71, 0.15)';
        ctx.fill();
        ctx.stroke();

        // Cross / filament inside
        const d = r * 0.65;
        ctx.beginPath();
        ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d);
        ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d);
        ctx.stroke();

        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = s.color || '#fef08a';
        ctx.fillText(s.labelText || 'Bulb', cx - 12, y - 4);
        break;
      }

      // ── AMMETER ──
      case 'sc-ammeter': {
        const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.42;
        ctx.beginPath();
        ctx.moveTo(x, cy); ctx.lineTo(cx - r, cy);
        ctx.moveTo(cx + r, cy); ctx.lineTo(x + w, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', cx, cy);

        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(s.labelText || `${s.current || 2.5} A`, cx, y + h + 12);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        break;
      }

      // ── VOLTMETER ──
      case 'sc-voltmeter': {
        const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.42;
        ctx.beginPath();
        ctx.moveTo(x, cy); ctx.lineTo(cx - r, cy);
        ctx.moveTo(cx + r, cy); ctx.lineTo(x + w, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(234, 88, 12, 0.1)';
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#fb923c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('V', cx, cy);

        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(s.labelText || `${s.voltage || 220} V`, cx, y + h + 12);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        break;
      }

      // ── GROUND ──
      case 'sc-ground': {
        const cx = x + w / 2;
        ctx.beginPath();
        ctx.moveTo(cx, y); ctx.lineTo(cx, y + h * 0.5);
        ctx.moveTo(cx - 22, y + h * 0.5); ctx.lineTo(cx + 22, y + h * 0.5);
        ctx.moveTo(cx - 14, y + h * 0.72); ctx.lineTo(cx + 14, y + h * 0.72);
        ctx.moveTo(cx - 6, y + h * 0.94);  ctx.lineTo(cx + 6, y + h * 0.94);
        ctx.stroke();
        break;
      }

      // ── FORCE VECTOR ──
      case 'sc-force-vector': {
        const midY = y + h / 2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 10, midY);
        ctx.lineTo(x + w - 18, midY);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(x + w - 24, midY - 8);
        ctx.lineTo(x + w - 4, midY);
        ctx.lineTo(x + w - 24, midY + 8);
        ctx.fillStyle = s.color || '#38bdf8';
        ctx.fill();

        // Tail point
        ctx.beginPath();
        ctx.arc(x + 10, midY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(s.labelText || `F = ${s.force || 50} N`, x + 20, midY - 10);
        break;
      }

      // ── MOTION ARROW ──
      case 'sc-motion-arrow': {
        const midY = y + h / 2;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(x + 8, midY);
        ctx.lineTo(x + w - 16, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Double arrowhead
        ctx.beginPath();
        ctx.moveTo(x + w - 24, midY - 7);
        ctx.lineTo(x + w - 12, midY);
        ctx.lineTo(x + w - 24, midY + 7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + w - 16, midY - 7);
        ctx.lineTo(x + w - 4, midY);
        ctx.lineTo(x + w - 16, midY + 7);
        ctx.fillStyle = s.color || '#4ade80';
        ctx.fill();

        ctx.font = 'italic 600 11px Inter, sans-serif';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(s.labelText || `v = ${s.velocity || 20} m/s`, x + 15, midY - 9);
        break;
      }

      // ── PULLEY ──
      case 'sc-pulley': {
        const cx = x + w / 2, r = s.r || 24;
        const cy = y + 36;
        // Ceiling mount
        ctx.beginPath();
        ctx.moveTo(cx - 26, y + 4); ctx.lineTo(cx + 26, y + 4);
        ctx.moveTo(cx, y + 4); ctx.lineTo(cx, cy);
        ctx.stroke();

        // Wheel
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

        // Strings
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r, y + h - 24);
        ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r, y + h - 4);
        ctx.stroke();

        // Hanging Load box
        ctx.fillStyle = 'rgba(201,168,76,0.2)';
        ctx.fillRect(cx - r - 16, y + h - 24, 32, 22);
        ctx.strokeRect(cx - r - 16, y + h - 24, 32, 22);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#e8c96b';
        ctx.fillText('M', cx - r - 5, y + h - 9);

        // Effort arrow
        ctx.beginPath();
        ctx.moveTo(cx + r, y + h - 4); ctx.lineTo(cx + r, y + h + 10);
        ctx.stroke();
        break;
      }

      // ── CONVEX LENS ──
      case 'sc-convex-lens': {
        const cx = x + w / 2, cy = y + h / 2;
        // Principal axis (dashed)
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(x - 30, cy); ctx.lineTo(x + w + 30, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lens body
        ctx.strokeStyle = s.color || '#38bdf8';
        ctx.fillStyle = 'rgba(56,189,248,0.18)';
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(x + w, cy, cx, y + h);
        ctx.quadraticCurveTo(x, cy, cx, y);
        ctx.fill();
        ctx.stroke();

        // Optical Center O
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Convex Lens', cx - 28, y - 8);
        break;
      }

      // ── CONCAVE LENS ──
      case 'sc-concave-lens': {
        const cx = x + w / 2, cy = y + h / 2;
        // Principal axis
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(x - 30, cy); ctx.lineTo(x + w + 30, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lens body
        ctx.strokeStyle = s.color || '#38bdf8';
        ctx.fillStyle = 'rgba(56,189,248,0.18)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.quadraticCurveTo(cx + 4, cy, x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.quadraticCurveTo(cx - 4, cy, x, y);
        ctx.fill();
        ctx.stroke();

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Concave Lens', cx - 28, y - 8);
        break;
      }

      // ── BAR MAGNET ──
      case 'sc-bar-magnet': {
        const midX = x + w / 2;
        // North half (Red)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = '#ef4444';
        ctx.fillRect(x, y, w / 2, h);
        ctx.strokeRect(x, y, w / 2, h);

        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#fee2e2';
        ctx.fillText('N', x + w * 0.2, y + h * 0.65);

        // South half (Blue)
        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.strokeStyle = '#3b82f6';
        ctx.fillRect(midX, y, w / 2, h);
        ctx.strokeRect(midX, y, w / 2, h);

        ctx.fillStyle = '#dbeafe';
        ctx.fillText('S', midX + w * 0.2, y + h * 0.65);
        break;
      }

      // ── COMPASS ──
      case 'sc-compass': {
        const cx = x + w / 2, cy = y + h / 2, r = s.r || 35;
        // Dial
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.stroke();

        // Needle (North Red, South Blue)
        ctx.beginPath();
        ctx.moveTo(cx, cy - r + 6);
        ctx.lineTo(cx - 6, cy);
        ctx.lineTo(cx + 6, cy);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy + r - 6);
        ctx.lineTo(cx - 6, cy);
        ctx.lineTo(cx + 6, cy);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();

        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('N', cx - 3, cy - r + 15);
        ctx.fillText('S', cx - 3, cy + r - 8);
        break;
      }

      // ── FREE BODY DIAGRAM ──
      case 'sc-free-body': {
        const cx = x + w / 2, cy = y + h / 2;
        const boxSize = 36;
        // Center mass box
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(cx - boxSize/2, cy - boxSize/2, boxSize, boxSize);
        ctx.strokeRect(cx - boxSize/2, cy - boxSize/2, boxSize, boxSize);

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('m', cx - 5, cy + 4);

        // Arrows: Up (Normal), Down (Gravity), Right (Applied), Left (Friction)
        ctx.lineWidth = 2;
        // Up Fn
        ctx.beginPath(); ctx.moveTo(cx, cy - boxSize/2); ctx.lineTo(cx, y + 6); ctx.stroke();
        ctx.fillText('Fn', cx + 6, y + 14);

        // Down Fg
        ctx.beginPath(); ctx.moveTo(cx, cy + boxSize/2); ctx.lineTo(cx, y + h - 6); ctx.stroke();
        ctx.fillText('Fg', cx + 6, y + h - 8);

        // Right Fa
        ctx.beginPath(); ctx.moveTo(cx + boxSize/2, cy); ctx.lineTo(x + w - 6, cy); ctx.stroke();
        ctx.fillText('Fa', x + w - 18, cy - 6);

        // Left Ff
        ctx.beginPath(); ctx.moveTo(cx - boxSize/2, cy); ctx.lineTo(x + 6, cy); ctx.stroke();
        ctx.fillText('Ff', x + 8, cy - 6);
        break;
      }

      // ── PLANT CELL ──
      case 'sc-plant-cell': {
        // Hexagonal / rigid rounded outer wall
        ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14);
        else ctx.rect(x, y, w, h);
        ctx.fill(); ctx.stroke();

        // Inner membrane
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        if (ctx.roundRect) ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 10);
        ctx.stroke();

        // Large central vacuole
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.beginPath();
        ctx.ellipse(x + w * 0.48, y + h * 0.52, w * 0.28, h * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nucleus
        ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
        ctx.beginPath();
        ctx.arc(x + w * 0.8, y + h * 0.35, 12, 0, Math.PI * 2);
        ctx.fill();

        // Chloroplasts (green dots)
        ctx.fillStyle = '#22c55e';
        [[x+24,y+24],[x+32,y+h-30],[x+w-30,y+h-26],[x+w*0.5,y+18]].forEach(([px, py]) => {
          ctx.beginPath(); ctx.ellipse(px, py, 6, 3.5, 0.4, 0, Math.PI*2); ctx.fill();
        });

        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = '#86efac';
        ctx.fillText('Plant Cell', x + 10, y + h + 14);
        break;
      }

      // ── ANIMAL CELL ──
      case 'sc-animal-cell': {
        // Flexible rounded membrane
        ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
        ctx.strokeStyle = '#ec4899';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Central Nucleus
        ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.48, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nucleolus
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.48, 6, 0, Math.PI * 2);
        ctx.fill();

        // Mitochondria (orange beans)
        ctx.fillStyle = '#f97316';
        [[x+w*0.25,y+h*0.35],[x+w*0.75,y+h*0.6],[x+w*0.3,y+h*0.68]].forEach(([px, py]) => {
          ctx.beginPath(); ctx.ellipse(px, py, 7, 4, 0.6, 0, Math.PI*2); ctx.fill();
        });

        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = '#f472b6';
        ctx.fillText('Animal Cell', x + 10, y + h + 14);
        break;
      }

      // ── LEADER LABEL ──
      case 'sc-label-pointer': {
        const midY = y + h / 2;
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = s.color || '#e8c96b';
        ctx.beginPath();
        ctx.arc(x + 5, midY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.moveTo(x + 5, midY);
        ctx.lineTo(x + 35, midY);
        ctx.lineTo(x + 55, y + 16);
        ctx.lineTo(x + w, y + 16);
        ctx.stroke();

        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = s.color || '#e8c96b';
        ctx.fillText(s.text || 'Label', x + 58, y + 12);
        break;
      }

      // ── TEST TUBE ──
      case 'sc-test-tube': {
        const cx = x + w / 2, r = w / 2 - 4;
        const bottomY = y + h - r - 4;

        // Tube body
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + 4, bottomY);
        ctx.arc(cx, bottomY, r, Math.PI, 0, true);
        ctx.lineTo(x + w - 4, y + 4);
        ctx.stroke();

        // Lip / rim
        ctx.beginPath();
        ctx.ellipse(cx, y + 4, r + 3, 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Liquid inside
        const liquidH = (h - 20) * ((s.liquidLevel || 60) / 100);
        const liquidTopY = y + h - liquidH - 8;
        ctx.fillStyle = s.color || 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.moveTo(x + 6, liquidTopY);
        ctx.lineTo(x + 6, bottomY);
        ctx.arc(cx, bottomY, r - 2, Math.PI, 0, true);
        ctx.lineTo(x + w - 6, liquidTopY);
        ctx.closePath();
        ctx.fill();
        break;
      }

      // ── BEAKER ──
      case 'sc-beaker': {
        // Rim
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 6);
        ctx.lineTo(x, y + 4); // spout
        ctx.lineTo(x + 6, y + 12);
        ctx.lineTo(x + 6, y + h - 8);
        ctx.quadraticCurveTo(x + 6, y + h, x + 16, y + h);
        ctx.lineTo(x + w - 16, y + h);
        ctx.quadraticCurveTo(x + w - 6, y + h, x + w - 6, y + h - 8);
        ctx.lineTo(x + w - 6, y + 6);
        ctx.stroke();

        // Liquid
        const liquidY = y + h - (h - 25) * ((s.liquidLevel || 55) / 100);
        ctx.fillStyle = s.color || 'rgba(52, 211, 153, 0.35)';
        ctx.fillRect(x + 8, liquidY, w - 16, (y + h - 2) - liquidY);

        // Graduation marks
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        [0.3, 0.5, 0.7].forEach(f => {
          const gy = y + h - (h - 25) * f;
          ctx.beginPath();
          ctx.moveTo(x + 8, gy); ctx.lineTo(x + 22, gy);
          ctx.stroke();
        });

        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('250 mL', x + w - 42, y + 20);
        break;
      }

      // ── BOHR ATOM ──
      case 'sc-atom-bohr': {
        const cx = x + w / 2, cy = y + h / 2;
        // Nucleus
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.element || 'C', cx, cy);

        // Elliptical electron shells
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        [0, Math.PI / 3, (2 * Math.PI) / 3].forEach(angle => {
          ctx.beginPath();
          ctx.ellipse(cx, cy, w * 0.45, h * 0.22, angle, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Electrons (blue dots)
        ctx.fillStyle = '#38bdf8';
        [[cx-w*0.4, cy],[cx+w*0.35, cy+14],[cx-10, cy-h*0.38],[cx+22, cy+h*0.32]].forEach(([ex, ey]) => {
          ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
        });

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        break;
      }

      // ── EARTH GLOBE ──
      case 'sc-earth': {
        const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.44;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.stroke();

        // Continents (green patches)
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(cx - 10, cy - 8, r * 0.45, r * 0.35, 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(cx + 14, cy + 12, r * 0.35, r * 0.28, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Axis line
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(cx - 6, y + 2); ctx.lineTo(cx + 6, y + h - 2);
        ctx.stroke();
        break;
      }

      default:
        ctx.strokeRect(x, y, w, h);
        break;
    }

    ctx.restore();
  }

  return {
    SCIENCE_SHAPE_DEFS,
    isScienceShape,
    getBounds,
    draw
  };
})();

if (typeof window !== 'undefined') {
  window.ScienceShapes = ScienceShapes;
}
