'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// STICKY NOTES TOOL — Interactive SmartBoard Sticky Notes
// Full touch support for 65" interactive whiteboard displays
// Supports: Create, Move, Resize, Rotate, Classroom Colors, Text Formatting,
//           Duplicate, Layering, Inline Editing, Undo/Redo & Export.
// ═══════════════════════════════════════════════════════════════════════════

const StickyNotesTool = (() => {

  const THEMES = {
    yellow: { bg: '#fef08a', text: '#1c1917', border: '#facc15', label: 'Yellow' },
    blue:   { bg: '#bae6fd', text: '#0369a1', border: '#38bdf8', label: 'Sky Blue' },
    green:  { bg: '#bbf7d0', text: '#15803d', border: '#4ade80', label: 'Mint Green' },
    pink:   { bg: '#fbcfe8', text: '#be185d', border: '#f472b6', label: 'Pink' },
    orange: { bg: '#fed7aa', text: '#c2410c', border: '#fb923c', label: 'Warm Orange' },
    purple: { bg: '#e9d5ff', text: '#7e22ce', border: '#c084fc', label: 'Lavender' }
  };

  let activeNote = null;
  let inlineEditor = null;
  let currentTheme = 'yellow';

  // ─────────────────────────────────────────────
  // 1. DATA MODEL FACTORY
  // ─────────────────────────────────────────────
  function createStickyNote(x, y, text = 'Type here…', theme = 'yellow') {
    const th = THEMES[theme] || THEMES.yellow;
    const w = 220;
    const h = 200;

    return {
      id: Date.now(),
      type: 'stickyNote',
      x: x !== undefined ? x : 150,
      y: y !== undefined ? y : 150,
      w,
      h,
      text: text || '',
      theme: theme || 'yellow',
      bg: th.bg,
      textColor: th.text,
      borderColor: th.border,
      fontSize: 22,
      fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
      bold: false,
      italic: false,
      align: 'left',
      rotation: 0, // degrees
      selected: true
    };
  }

  // ─────────────────────────────────────────────
  // 2. CANVAS RENDERING
  // ─────────────────────────────────────────────
  function draw(ctx, note) {
    if (!note) return;

    ctx.save();

    // Center coordinates for rotation
    const cx = note.x + note.w / 2;
    const cy = note.y + note.h / 2;

    ctx.translate(cx, cy);
    if (note.rotation) {
      ctx.rotate((note.rotation * Math.PI) / 180);
    }
    ctx.translate(-cx, -cy);

    // Soft drop shadow for paper elevation
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.shadowOffsetX = 2;

    // Note card body with subtle rounded corners
    const th = THEMES[note.theme] || THEMES.yellow;
    ctx.fillStyle = note.bg || th.bg;
    const r = 6;
    if (ctx.roundRect) ctx.roundRect(note.x, note.y, note.w, note.h, r);
    else ctx.rect(note.x, note.y, note.w, note.h);
    ctx.fill();

    // Reset shadow for crisp lines and text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowOffsetX = 0;

    // Top subtle taped / folded strip for realistic classroom look
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    if (ctx.roundRect) ctx.roundRect(note.x, note.y, note.w, 24, [r, r, 0, 0]);
    else ctx.fillRect(note.x, note.y, note.w, 24);
    ctx.fill();

    // Top pin/tape accent indicator
    const tapeW = Math.min(60, note.w * 0.35);
    const tapeX = note.x + note.w / 2 - tapeW / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    if (ctx.roundRect) ctx.roundRect(tapeX, note.y - 4, tapeW, 12, 3);
    else ctx.fillRect(tapeX, note.y - 4, tapeW, 12);
    ctx.fill();

    // Subtle outline border
    ctx.strokeStyle = note.borderColor || th.border || 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.2;
    if (ctx.roundRect) ctx.roundRect(note.x, note.y, note.w, note.h, r);
    else ctx.strokeRect(note.x, note.y, note.w, note.h);
    ctx.stroke();

    // Multi-line Reflowing Text
    if (note.text && !note._editing) {
      drawNoteText(ctx, note);
    }

    // Selection Handles & Rotation Pin
    if (note.selected) {
      drawSelection(ctx, note);
    }

    ctx.restore();
  }

  function drawNoteText(ctx, note) {
    ctx.save();
    ctx.beginPath();
    // Clip text to note padding area
    const pad = 16;
    const topPad = 28;
    ctx.rect(note.x + pad, note.y + topPad, note.w - pad * 2, note.h - topPad - pad);
    ctx.clip();

    const fs = note.fontSize || 20;
    const isBold = note.bold ? '700' : '500';
    const isItalic = note.italic ? 'italic' : 'normal';
    const fontFam = note.fontFamily || '"Plus Jakarta Sans", sans-serif';

    ctx.font = `${isItalic} ${isBold} ${fs}px ${fontFam}`;
    ctx.fillStyle = note.textColor || '#1c1917';
    ctx.textBaseline = 'top';

    const availW = note.w - pad * 2;
    const rawLines = String(note.text).split('\n');
    const wrappedLines = [];

    for (const raw of rawLines) {
      if (!raw) { wrappedLines.push(''); continue; }
      const words = raw.split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (availW > 30 && ctx.measureText(test).width > availW) {
          if (cur) wrappedLines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) wrappedLines.push(cur);
    }

    const lineH = fs * 1.36;
    let startY = note.y + topPad;

    wrappedLines.forEach((line, idx) => {
      let lineX = note.x + pad;
      if (note.align === 'center') {
        ctx.textAlign = 'center';
        lineX = note.x + note.w / 2;
      } else if (note.align === 'right') {
        ctx.textAlign = 'right';
        lineX = note.x + note.w - pad;
      } else {
        ctx.textAlign = 'left';
      }
      ctx.fillText(line, lineX, startY + idx * lineH);
    });

    ctx.restore();
  }

  function drawSelection(ctx, note) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(note.x - 4, note.y - 4, note.w + 8, note.h + 8);
    ctx.setLineDash([]);

    // 8 SmartBoard large resize handles
    const handles = [
      { id: 'tl', x: note.x - 4, y: note.y - 4 },
      { id: 'tc', x: note.x + note.w / 2, y: note.y - 4 },
      { id: 'tr', x: note.x + note.w + 4, y: note.y - 4 },
      { id: 'ml', x: note.x - 4, y: note.y + note.h / 2 },
      { id: 'mr', x: note.x + note.w + 4, y: note.y + note.h / 2 },
      { id: 'bl', x: note.x - 4, y: note.y + note.h + 4 },
      { id: 'bc', x: note.x + note.w / 2, y: note.y + note.h + 4 },
      { id: 'br', x: note.x + note.w + 4, y: note.y + note.h + 4 }
    ];

    handles.forEach(h => {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Rotation stem & knob at top
    const rotX = note.x + note.w / 2;
    const rotY = note.y - 26;

    ctx.beginPath();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.moveTo(rotX, note.y - 4);
    ctx.lineTo(rotX, rotY);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(rotX, rotY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // 3. HIT TESTING & HANDLES
  // ─────────────────────────────────────────────
  function hitTest(note, px, py) {
    if (!note) return null;

    // Check rotation stem handle first
    const cx = note.x + note.w / 2;
    const cy = note.y + note.h / 2;
    let localX = px, localY = py;

    if (note.rotation) {
      const rad = (-note.rotation * Math.PI) / 180;
      const dx = px - cx;
      const dy = py - cy;
      localX = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      localY = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }

    const rotX = cx;
    const rotY = note.y - 26;
    if (Math.hypot(localX - rotX, localY - rotY) <= 16) {
      return { type: 'rotate', note };
    }

    // Check corner resize handles
    const handles = [
      { id: 'tl', x: note.x - 4, y: note.y - 4, cursor: 'nwse-resize' },
      { id: 'tc', x: note.x + note.w / 2, y: note.y - 4, cursor: 'ns-resize' },
      { id: 'tr', x: note.x + note.w + 4, y: note.y - 4, cursor: 'nesw-resize' },
      { id: 'ml', x: note.x - 4, y: note.y + note.h / 2, cursor: 'ew-resize' },
      { id: 'mr', x: note.x + note.w + 4, y: note.y + note.h / 2, cursor: 'ew-resize' },
      { id: 'bl', x: note.x - 4, y: note.y + note.h + 4, cursor: 'nesw-resize' },
      { id: 'bc', x: note.x + note.w / 2, y: note.y + note.h + 4, cursor: 'ns-resize' },
      { id: 'br', x: note.x + note.w + 4, y: note.y + note.h + 4, cursor: 'nwse-resize' }
    ];

    for (const h of handles) {
      if (Math.hypot(localX - h.x, localY - h.y) <= 15) {
        return { type: 'handle', handle: h.id, cursor: h.cursor, note };
      }
    }

    // Check note body
    if (localX >= note.x && localX <= note.x + note.w && localY >= note.y && localY <= note.y + note.h) {
      return { type: 'body', note };
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // 4. INLINE TOUCH EDITING
  // ─────────────────────────────────────────────
  function editNote(note) {
    if (!note) return;
    closeInlineEditor();

    note._editing = true;
    Canvas.renderShapes();

    const zone = document.getElementById('canvas-zone');
    const vp = document.getElementById('canvas-viewport');
    const parent = vp || zone;

    const textarea = document.createElement('textarea');
    textarea.id = 'sticky-note-active-editor';
    textarea.className = 'sticky-note-editor';
    textarea.value = note.text || '';

    const pad = 16;
    const topPad = 28;

    textarea.style.cssText = `
      position: absolute;
      left: ${note.x + pad}px;
      top: ${note.y + topPad}px;
      width: ${note.w - pad * 2}px;
      height: ${note.h - topPad - pad}px;
      padding: 4px;
      background: transparent;
      color: ${note.textColor || '#1c1917'};
      font-family: ${note.fontFamily || '"Plus Jakarta Sans", sans-serif'};
      font-size: ${note.fontSize || 20}px;
      font-weight: ${note.bold ? '700' : '500'};
      font-style: ${note.italic ? 'italic' : 'normal'};
      text-align: ${note.align || 'left'};
      border: 1.5px dashed rgba(0,0,0,0.3);
      border-radius: 4px;
      outline: none;
      resize: none;
      z-index: 500;
      touch-action: auto;
      caret-color: #0284c7;
    `;

    parent.appendChild(textarea);
    inlineEditor = { textarea, note };

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 40);

    function commitAndClose() {
      if (!inlineEditor) return;
      const val = textarea.value;
      if (val !== note.text) {
        Canvas.saveHistory();
        note.text = val;
      }
      delete note._editing;
      textarea.remove();
      inlineEditor = null;
      Canvas.renderShapes();
      showNoteContextToolbar(note);
    }

    textarea.addEventListener('blur', commitAndClose);
    textarea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        delete note._editing;
        textarea.remove();
        inlineEditor = null;
        Canvas.renderShapes();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        commitAndClose();
      }
    });
  }

  function closeInlineEditor() {
    if (inlineEditor) {
      const { textarea, note } = inlineEditor;
      if (note) {
        note.text = textarea.value;
        delete note._editing;
      }
      textarea.remove();
      inlineEditor = null;
      Canvas.renderShapes();
    }
  }

  // ─────────────────────────────────────────────
  // 5. STICKY NOTE FLOATING CONTEXT TOOLBAR (65" UI)
  // ─────────────────────────────────────────────
  function showNoteContextToolbar(note) {
    hideNoteContextToolbar();
    if (!note || !note.selected) return;

    activeNote = note;

    const existingBar = document.getElementById('sticky-floating-toolbar');
    if (existingBar) existingBar.remove();

    const bar = document.createElement('div');
    bar.id = 'sticky-floating-toolbar';
    bar.className = 'sticky-touch-toolbar';

    bar.innerHTML = `
      <!-- Color theme swatches -->
      <div class="snt-swatches">
        ${Object.keys(THEMES).map(k => `
          <button type="button" class="snt-swatch ${note.theme === k ? 'active' : ''}" style="background:${THEMES[k].bg};border-color:${THEMES[k].border};" onclick="StickyNotesTool.setNoteTheme('${k}')" title="${THEMES[k].label}">
          </button>
        `).join('')}
      </div>

      <div class="snt-div"></div>

      <!-- Typography -->
      <div class="snt-group">
        <button class="snt-btn" onclick="StickyNotesTool.adjustFontSize(-2)" title="Decrease font size">A−</button>
        <button class="snt-btn" onclick="StickyNotesTool.adjustFontSize(2)" title="Increase font size">A＋</button>
        <button class="snt-btn ${note.bold ? 'active' : ''}" onclick="StickyNotesTool.toggleBold()" title="Bold">
          <strong>B</strong>
        </button>
        <button class="snt-btn ${note.italic ? 'active' : ''}" onclick="StickyNotesTool.toggleItalic()" title="Italic">
          <em>I</em>
        </button>
        <button class="snt-btn" onclick="StickyNotesTool.cycleAlign()" title="Alignment">
          <span>≡ ${note.align || 'left'}</span>
        </button>
      </div>

      <div class="snt-div"></div>

      <!-- Object management -->
      <div class="snt-group">
        <button class="snt-btn" onclick="StickyNotesTool.duplicateNote()" title="Duplicate Sticky Note">
          <span>📄 Duplicate</span>
        </button>
        <button class="snt-btn" onclick="StickyNotesTool.bringToFront()" title="Bring to Front">
          <span>⬆ Front</span>
        </button>
        <button class="snt-btn" onclick="StickyNotesTool.sendToBack()" title="Send to Back">
          <span>⬇ Back</span>
        </button>
        <button class="snt-btn snt-btn-danger" onclick="StickyNotesTool.deleteNote()" title="Delete Sticky Note">
          <span>🗑 Delete</span>
        </button>
      </div>
    `;

    const zone = document.getElementById('canvas-zone');
    if (!zone) return;
    zone.appendChild(bar);

    const barW = bar.offsetWidth || 480;
    const barH = bar.offsetHeight || 42;

    let posX = note.x + note.w / 2 - barW / 2;
    let posY = note.y - barH - 34;

    if (posY < 10) posY = note.y + note.h + 16;
    if (posX < 10) posX = 10;
    if (posX + barW > zone.offsetWidth - 10) posX = zone.offsetWidth - barW - 10;

    bar.style.left = `${Math.round(posX)}px`;
    bar.style.top = `${Math.round(posY)}px`;
  }

  function hideNoteContextToolbar() {
    const bar = document.getElementById('sticky-floating-toolbar');
    if (bar) bar.remove();
  }

  // ─────────────────────────────────────────────
  // 6. ACTION HANDLERS
  // ─────────────────────────────────────────────
  function setNoteTheme(themeKey) {
    if (!activeNote || !THEMES[themeKey]) return;
    Canvas.saveHistory();
    const th = THEMES[themeKey];
    activeNote.theme = themeKey;
    activeNote.bg = th.bg;
    activeNote.textColor = th.text;
    activeNote.borderColor = th.border;
    currentTheme = themeKey;
    Canvas.renderShapes();
    showNoteContextToolbar(activeNote);
  }

  function adjustFontSize(delta) {
    if (!activeNote) return;
    Canvas.saveHistory();
    activeNote.fontSize = Math.max(12, Math.min(64, (activeNote.fontSize || 20) + delta));
    Canvas.renderShapes();
  }

  function toggleBold() {
    if (!activeNote) return;
    Canvas.saveHistory();
    activeNote.bold = !activeNote.bold;
    Canvas.renderShapes();
    showNoteContextToolbar(activeNote);
  }

  function toggleItalic() {
    if (!activeNote) return;
    Canvas.saveHistory();
    activeNote.italic = !activeNote.italic;
    Canvas.renderShapes();
    showNoteContextToolbar(activeNote);
  }

  function cycleAlign() {
    if (!activeNote) return;
    Canvas.saveHistory();
    const map = { left: 'center', center: 'right', right: 'left' };
    activeNote.align = map[activeNote.align || 'left'] || 'center';
    Canvas.renderShapes();
    showNoteContextToolbar(activeNote);
  }

  function duplicateNote() {
    if (!activeNote) return;
    Canvas.saveHistory();
    const copy = {
      ...JSON.parse(JSON.stringify(activeNote)),
      id: Date.now(),
      x: activeNote.x + 30,
      y: activeNote.y + 30,
      selected: true
    };
    activeNote.selected = false;
    Canvas.addShapeObject(copy);
    showNoteContextToolbar(copy);
    App.showToast('Sticky note duplicated');
  }

  function bringToFront() {
    if (!activeNote) return;
    Canvas.saveHistory();
    const shapes = Canvas.getShapes();
    const idx = shapes.findIndex(s => s.id === activeNote.id);
    if (idx >= 0 && idx < shapes.length - 1) {
      shapes.splice(idx, 1);
      shapes.push(activeNote);
      Canvas.setShapes(shapes);
      Canvas.selectShape(activeNote);
    }
  }

  function sendToBack() {
    if (!activeNote) return;
    Canvas.saveHistory();
    const shapes = Canvas.getShapes();
    const idx = shapes.findIndex(s => s.id === activeNote.id);
    if (idx > 0) {
      shapes.splice(idx, 1);
      shapes.unshift(activeNote);
      Canvas.setShapes(shapes);
      Canvas.selectShape(activeNote);
    }
  }

  function deleteNote() {
    if (!activeNote) return;
    Canvas.saveHistory();
    Canvas.deleteShape();
    hideNoteContextToolbar();
    closeInlineEditor();
  }

  function activateOrAdd() {
    // If sticky note button is pressed, either switch tool or spawn note in center
    if (typeof App !== 'undefined') {
      App.setTool('sticky');
      App.showToast('Sticky Note Tool: Tap anywhere on board to place note');
    }
  }

  return {
    THEMES,
    createStickyNote,
    draw,
    hitTest,
    editNote,
    closeInlineEditor,
    showNoteContextToolbar,
    hideNoteContextToolbar,
    getActiveNote: () => activeNote,
    setNoteTheme,
    adjustFontSize,
    toggleBold,
    toggleItalic,
    cycleAlign,
    duplicateNote,
    bringToFront,
    sendToBack,
    deleteNote,
    activateOrAdd,
    getCurrentTheme: () => currentTheme
  };
})();
