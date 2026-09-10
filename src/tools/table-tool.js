'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED TABLE TOOL — Interactive SmartBoard Tables
// Full touch support for 65" interactive whiteboard displays
// Supports: Rows, Columns, Resize, Colspan, Rowspan, Merge, Split,
//           Cell Text, Alignment, Borders, Backgrounds, Undo/Redo & Export.
// ═══════════════════════════════════════════════════════════════════════════

const TableTool = (() => {

  // Minimum dimensions for 65" touch grab
  const MIN_COL_W = 55;
  const MIN_ROW_H = 38;
  const DIVIDER_HIT_DIST = 14;

  let activeTable = null; // currently selected table
  let selectedCells = []; // array of { r, c }
  let isSelectingCells = false;
  let selectStartCell = null;
  let draggingDivider = null; // { type: 'col'|'row', index: number, startPos: number, startSizes: number[] }
  let inlineEditor = null; // currently active cell inline editor textarea

  // ─────────────────────────────────────────────
  // 1. DATA MODEL FACTORY
  // ─────────────────────────────────────────────
  function createTable(numRows, numCols, x, y, options = {}) {
    const rows = Math.max(1, Math.min(15, parseInt(numRows) || 3));
    const cols = Math.max(1, Math.min(12, parseInt(numCols) || 3));

    // Calculate initial dimensions suitable for classroom viewing
    const defaultColW = Math.max(120, Math.min(200, Math.round(720 / cols)));
    const defaultRowH = Math.max(50, Math.min(80, Math.round(360 / rows)));

    const colWidths = Array(cols).fill(defaultColW);
    const rowHeights = Array(rows).fill(defaultRowH);

    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const totalH = rowHeights.reduce((a, b) => a + b, 0);

    const preset = options.preset || 'classroom';
    const isDark = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId)
      ? Canvas.getBoardColorId() !== 'white'
      : true;

    // Presets configuration
    let defaultBorderColor = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.4)';
    let defaultHeaderBg    = isDark ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.22)';
    let defaultCellBg      = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)';
    let defaultTextColor   = isDark ? '#ffffff' : '#0f172a';

    if (preset === 'math') {
      defaultHeaderBg = isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.25)';
    }

    const cells = [];
    for (let r = 0; r < rows; r++) {
      const rowArr = [];
      const isHdr = (r === 0 && options.hasHeader !== false);
      for (let c = 0; c < cols; c++) {
        rowArr.push({
          row: r,
          col: c,
          rowSpan: 1,
          colSpan: 1,
          text: '',
          bold: isHdr,
          italic: false,
          fontSize: isHdr ? 20 : 18,
          fontFamily: 'Noto Sans, sans-serif',
          color: defaultTextColor,
          bg: isHdr ? defaultHeaderBg : defaultCellBg,
          align: isHdr ? 'center' : 'left',
          valign: 'middle',
          padding: 10,
          borders: { top: true, right: true, bottom: true, left: true },
          borderColor: defaultBorderColor,
          borderWidth: 1.5,
          borderStyle: 'solid',
          isMergedPlaceholder: false,
          mergedInto: null
        });
      }
      cells.push(rowArr);
    }

    return {
      id: Date.now(),
      type: 'table',
      x: x !== undefined ? x : 100,
      y: y !== undefined ? y : 100,
      w: totalW,
      h: totalH,
      rows,
      cols,
      colWidths,
      rowHeights,
      cells,
      isHeaderRow: options.hasHeader !== false,
      borderColor: defaultBorderColor,
      borderWidth: 2,
      borderStyle: 'solid',
      tableBg: 'transparent',
      selected: true,
      selectedCells: [{ r: 0, c: 0 }]
    };
  }

  // ─────────────────────────────────────────────
  // 2. GEOMETRY & COORDINATES CALCULATIONS
  // ─────────────────────────────────────────────
  function getCellRect(table, r, c) {
    if (!table || !table.colWidths || !table.rowHeights) return null;
    let cx = table.x;
    for (let i = 0; i < c; i++) cx += (table.colWidths[i] || MIN_COL_W);

    let cy = table.y;
    for (let j = 0; j < r; j++) cy += (table.rowHeights[j] || MIN_ROW_H);

    const cell = table.cells?.[r]?.[c];
    if (!cell) {
      return {
        x: cx, y: cy,
        w: table.colWidths[c] || MIN_COL_W,
        h: table.rowHeights[r] || MIN_ROW_H
      };
    }

    let cw = 0;
    for (let i = 0; i < (cell.colSpan || 1); i++) {
      cw += (table.colWidths[c + i] || MIN_COL_W);
    }

    let ch = 0;
    for (let j = 0; j < (cell.rowSpan || 1); j++) {
      ch += (table.rowHeights[r + j] || MIN_ROW_H);
    }

    return { x: cx, y: cy, w: cw, h: ch };
  }

  // ─────────────────────────────────────────────
  // 3. CANVAS RENDERING
  // ─────────────────────────────────────────────
  function draw(ctx, table) {
    if (!table || !table.cells) return;

    ctx.save();

    // Ensure total table dimensions stay in sync with row/col widths
    table.w = table.colWidths.reduce((a, b) => a + b, 0);
    table.h = table.rowHeights.reduce((a, b) => a + b, 0);

    // Optional overall table background
    if (table.tableBg && table.tableBg !== 'transparent') {
      ctx.fillStyle = table.tableBg;
      ctx.fillRect(table.x, table.y, table.w, table.h);
    }

    // ── First Pass: Draw cell backgrounds and content ──
    for (let r = 0; r < table.rows; r++) {
      for (let c = 0; c < table.cols; c++) {
        const cell = table.cells[r]?.[c];
        if (!cell || cell.isMergedPlaceholder) continue;

        const rect = getCellRect(table, r, c);
        if (!rect) continue;

        // Cell background
        if (cell.bg && cell.bg !== 'transparent') {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }

        // Selected cell highlight
        const isSelectedCell = table.selected && table.selectedCells?.some(sc => sc.r === r && sc.c === c);
        if (isSelectedCell) {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }

        // Draw Cell Text
        if (cell.text && !cell._editing) {
          drawCellText(ctx, cell, rect);
        }
      }
    }

    // ── Second Pass: Draw Grid Borders ──
    ctx.lineWidth = table.borderWidth || 1.5;
    ctx.strokeStyle = table.borderColor || 'rgba(255, 255, 255, 0.4)';
    ctx.lineCap = 'butt';

    for (let r = 0; r < table.rows; r++) {
      for (let c = 0; c < table.cols; c++) {
        const cell = table.cells[r]?.[c];
        if (!cell || cell.isMergedPlaceholder) continue;

        const rect = getCellRect(table, r, c);
        if (!rect) continue;

        ctx.save();
        ctx.strokeStyle = cell.borderColor || table.borderColor;
        ctx.lineWidth = cell.borderWidth || table.borderWidth || 1.5;
        if (cell.borderStyle === 'dashed') ctx.setLineDash([6, 4]);
        else if (cell.borderStyle === 'dotted') ctx.setLineDash([2, 3]);
        else ctx.setLineDash([]);

        const b = cell.borders || { top: true, right: true, bottom: true, left: true };
        ctx.beginPath();
        if (b.top)    { ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x + rect.w, rect.y); }
        if (b.bottom) { ctx.moveTo(rect.x, rect.y + rect.h); ctx.lineTo(rect.x + rect.w, rect.y + rect.h); }
        if (b.left)   { ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x, rect.y + rect.h); }
        if (b.right)  { ctx.moveTo(rect.x + rect.w, rect.y); ctx.lineTo(rect.x + rect.w, rect.y + rect.h); }
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Third Pass: Selection Outline & Handles ──
    if (table.selected) {
      drawTableSelection(ctx, table);
    }

    ctx.restore();
  }

  function drawCellText(ctx, cell, rect) {
    ctx.save();
    ctx.beginPath();
    // Clip to cell bounds so long text never bleeds into other cells
    ctx.rect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.clip();

    const pad = cell.padding || 8;
    const availW = rect.w - pad * 2;
    const isBold = cell.bold ? '700' : '400';
    const isItalic = cell.italic ? 'italic' : 'normal';
    const fs = cell.fontSize || 18;
    const fontFam = cell.fontFamily || 'Noto Sans, sans-serif';

    ctx.font = `${isItalic} ${isBold} ${fs}px ${fontFam}`;
    ctx.fillStyle = cell.color || '#ffffff';
    ctx.textBaseline = 'middle';

    // Word wrap text
    const rawLines = String(cell.text).split('\n');
    const wrappedLines = [];
    for (const raw of rawLines) {
      if (!raw) { wrappedLines.push(''); continue; }
      const words = raw.split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (availW > 40 && ctx.measureText(test).width > availW) {
          if (cur) wrappedLines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) wrappedLines.push(cur);
    }

    const lineH = fs * 1.32;
    const totalTextH = wrappedLines.length * lineH;

    // Vertical alignment calculation
    let startY = rect.y + rect.h / 2 - totalTextH / 2 + lineH / 2;
    if (cell.valign === 'top') {
      startY = rect.y + pad + lineH / 2;
    } else if (cell.valign === 'bottom') {
      startY = rect.y + rect.h - pad - totalTextH + lineH / 2;
    }

    // Draw lines
    wrappedLines.forEach((line, idx) => {
      let lineX = rect.x + pad;
      if (cell.align === 'center') {
        ctx.textAlign = 'center';
        lineX = rect.x + rect.w / 2;
      } else if (cell.align === 'right') {
        ctx.textAlign = 'right';
        lineX = rect.x + rect.w - pad;
      } else {
        ctx.textAlign = 'left';
      }

      ctx.fillText(line, lineX, startY + idx * lineH);
    });

    ctx.restore();
  }

  function drawTableSelection(ctx, table) {
    ctx.save();
    // Bounding box dashed line
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.strokeRect(table.x - 4, table.y - 4, table.w + 8, table.h + 8);
    ctx.setLineDash([]);

    // 8 SmartBoard large resize handles (20px hit radius)
    const pts = [
      { id: 'tl', x: table.x - 4, y: table.y - 4 },
      { id: 'tc', x: table.x + table.w / 2, y: table.y - 4 },
      { id: 'tr', x: table.x + table.w + 4, y: table.y - 4 },
      { id: 'ml', x: table.x - 4, y: table.y + table.h / 2 },
      { id: 'mr', x: table.x + table.w + 4, y: table.y + table.h / 2 },
      { id: 'bl', x: table.x - 4, y: table.y + table.h + 4 },
      { id: 'bc', x: table.x + table.w / 2, y: table.y + table.h + 4 },
      { id: 'br', x: table.x + table.w + 4, y: table.y + table.h + 4 }
    ];

    pts.forEach(p => {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    });

    // Top move bar indicator (for dragging table safely without selecting cells)
    const barW = Math.min(160, table.w * 0.5);
    const barH = 14;
    const barX = table.x + table.w / 2 - barW / 2;
    const barY = table.y - 20;

    ctx.fillStyle = 'rgba(234, 179, 8, 0.85)';
    if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 6);
    else ctx.rect(barX, barY, barW, barH);
    ctx.fill();

    ctx.fillStyle = '#060a14';
    ctx.font = '600 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⋮⋮ DRAG TABLE', barX + barW / 2, barY + barH / 2);

    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // 4. HIT TESTING & TOUCH INTERACTIONS
  // ─────────────────────────────────────────────
  function hitTest(table, px, py) {
    if (!table) return null;

    // 1. Move bar on top of table
    const barW = Math.min(160, table.w * 0.5);
    const barX = table.x + table.w / 2 - barW / 2;
    const barY = table.y - 24;
    if (px >= barX - 10 && px <= barX + barW + 10 && py >= barY - 6 && py <= barY + 22) {
      return { type: 'move-handle', table };
    }

    // 2. Corner resize handles
    const handles = [
      { id: 'tl', x: table.x - 4, y: table.y - 4, cursor: 'nwse-resize' },
      { id: 'tc', x: table.x + table.w / 2, y: table.y - 4, cursor: 'ns-resize' },
      { id: 'tr', x: table.x + table.w + 4, y: table.y - 4, cursor: 'nesw-resize' },
      { id: 'ml', x: table.x - 4, y: table.y + table.h / 2, cursor: 'ew-resize' },
      { id: 'mr', x: table.x + table.w + 4, y: table.y + table.h / 2, cursor: 'ew-resize' },
      { id: 'bl', x: table.x - 4, y: table.y + table.h + 4, cursor: 'nesw-resize' },
      { id: 'bc', x: table.x + table.w / 2, y: table.y + table.h + 4, cursor: 'ns-resize' },
      { id: 'br', x: table.x + table.w + 4, y: table.y + table.h + 4, cursor: 'nwse-resize' }
    ];
    for (const h of handles) {
      if (Math.hypot(px - h.x, py - h.y) <= 16) {
        return { type: 'handle', handle: h.id, cursor: h.cursor, table };
      }
    }

    // 3. Internal Column dividers (for dragging col width)
    let curX = table.x;
    for (let c = 0; c < table.cols - 1; c++) {
      curX += table.colWidths[c];
      if (Math.abs(px - curX) <= DIVIDER_HIT_DIST && py >= table.y && py <= table.y + table.h) {
        return { type: 'col-divider', colIndex: c, dividerX: curX, table };
      }
    }

    // 4. Internal Row dividers (for dragging row height)
    let curY = table.y;
    for (let r = 0; r < table.rows - 1; r++) {
      curY += table.rowHeights[r];
      if (Math.abs(py - curY) <= DIVIDER_HIT_DIST && px >= table.x && px <= table.x + table.w) {
        return { type: 'row-divider', rowIndex: r, dividerY: curY, table };
      }
    }

    // 5. Check cell interiors
    if (px >= table.x && px <= table.x + table.w && py >= table.y && py <= table.y + table.h) {
      for (let r = 0; r < table.rows; r++) {
        for (let c = 0; c < table.cols; c++) {
          const rect = getCellRect(table, r, c);
          if (rect && px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
            const cell = table.cells[r]?.[c];
            if (cell?.isMergedPlaceholder && cell.mergedInto) {
              return { type: 'cell', r: cell.mergedInto.r, c: cell.mergedInto.c, table };
            }
            return { type: 'cell', r, c, table };
          }
        }
      }
      return { type: 'table-body', table };
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // 5. ROW & COLUMN MUTATION METHODS
  // ─────────────────────────────────────────────
  function insertRow(table, atIndex, insertAbove = false) {
    if (!table || !table.cells) return;
    Canvas.saveHistory();

    const targetIdx = insertAbove ? atIndex : atIndex + 1;
    const newRowIdx = Math.max(0, Math.min(table.rows, targetIdx));
    const newHeight = Math.max(MIN_ROW_H, table.rowHeights[atIndex] || 50);

    table.rowHeights.splice(newRowIdx, 0, newHeight);
    table.rows += 1;

    const newRow = [];
    const isDark = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId)
      ? Canvas.getBoardColorId() !== 'white'
      : true;

    for (let c = 0; c < table.cols; c++) {
      newRow.push({
        row: newRowIdx,
        col: c,
        rowSpan: 1,
        colSpan: 1,
        text: '',
        bold: false,
        italic: false,
        fontSize: 18,
        fontFamily: 'Noto Sans, sans-serif',
        color: isDark ? '#ffffff' : '#0f172a',
        bg: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
        align: 'left',
        valign: 'middle',
        padding: 10,
        borders: { top: true, right: true, bottom: true, left: true },
        borderColor: table.borderColor || 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1.5,
        borderStyle: 'solid',
        isMergedPlaceholder: false,
        mergedInto: null
      });
    }

    table.cells.splice(newRowIdx, 0, newRow);

    // Re-index cell row numbers
    for (let r = 0; r < table.rows; r++) {
      for (let c = 0; c < table.cols; c++) {
        if (table.cells[r][c]) table.cells[r][c].row = r;
      }
    }

    table.h = table.rowHeights.reduce((a, b) => a + b, 0);
    Canvas.renderShapes();
    showTableContextToolbar(table);
    App.showToast(`Row inserted at ${newRowIdx + 1}`);
  }

  function deleteRow(table, atIndex) {
    if (!table || !table.cells || table.rows <= 1) {
      App.showToast('Table must have at least 1 row');
      return;
    }
    Canvas.saveHistory();

    table.rowHeights.splice(atIndex, 1);
    table.cells.splice(atIndex, 1);
    table.rows -= 1;

    // Re-index
    for (let r = 0; r < table.rows; r++) {
      for (let c = 0; c < table.cols; c++) {
        const cell = table.cells[r][c];
        if (cell) {
          cell.row = r;
          if (cell.isMergedPlaceholder && cell.mergedInto?.r >= atIndex) {
            cell.isMergedPlaceholder = false;
            cell.mergedInto = null;
          }
        }
      }
    }

    table.h = table.rowHeights.reduce((a, b) => a + b, 0);
    table.selectedCells = [{ r: Math.min(atIndex, table.rows - 1), c: 0 }];
    Canvas.renderShapes();
    showTableContextToolbar(table);
    App.showToast('Row deleted');
  }

  function insertCol(table, atIndex, insertLeft = false) {
    if (!table || !table.cells) return;
    Canvas.saveHistory();

    const targetIdx = insertLeft ? atIndex : atIndex + 1;
    const newColIdx = Math.max(0, Math.min(table.cols, targetIdx));
    const newWidth = Math.max(MIN_COL_W, table.colWidths[atIndex] || 120);

    table.colWidths.splice(newColIdx, 0, newWidth);
    table.cols += 1;

    const isDark = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId)
      ? Canvas.getBoardColorId() !== 'white'
      : true;

    for (let r = 0; r < table.rows; r++) {
      table.cells[r].splice(newColIdx, 0, {
        row: r,
        col: newColIdx,
        rowSpan: 1,
        colSpan: 1,
        text: '',
        bold: false,
        italic: false,
        fontSize: 18,
        fontFamily: 'Noto Sans, sans-serif',
        color: isDark ? '#ffffff' : '#0f172a',
        bg: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
        align: 'left',
        valign: 'middle',
        padding: 10,
        borders: { top: true, right: true, bottom: true, left: true },
        borderColor: table.borderColor || 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1.5,
        borderStyle: 'solid',
        isMergedPlaceholder: false,
        mergedInto: null
      });

      // Re-index cols
      for (let c = 0; c < table.cols; c++) {
        if (table.cells[r][c]) table.cells[r][c].col = c;
      }
    }

    table.w = table.colWidths.reduce((a, b) => a + b, 0);
    Canvas.renderShapes();
    showTableContextToolbar(table);
    App.showToast(`Column inserted at ${newColIdx + 1}`);
  }

  function deleteCol(table, atIndex) {
    if (!table || !table.cells || table.cols <= 1) {
      App.showToast('Table must have at least 1 column');
      return;
    }
    Canvas.saveHistory();

    table.colWidths.splice(atIndex, 1);
    table.cols -= 1;

    for (let r = 0; r < table.rows; r++) {
      table.cells[r].splice(atIndex, 1);
      for (let c = 0; c < table.cols; c++) {
        const cell = table.cells[r][c];
        if (cell) {
          cell.col = c;
          if (cell.isMergedPlaceholder && cell.mergedInto?.c >= atIndex) {
            cell.isMergedPlaceholder = false;
            cell.mergedInto = null;
          }
        }
      }
    }

    table.w = table.colWidths.reduce((a, b) => a + b, 0);
    table.selectedCells = [{ r: 0, c: Math.min(atIndex, table.cols - 1) }];
    Canvas.renderShapes();
    showTableContextToolbar(table);
    App.showToast('Column deleted');
  }

  // ─────────────────────────────────────────────
  // 6. MERGE & SPLIT CELLS
  // ─────────────────────────────────────────────
  function canMerge(table, cellsList) {
    if (!table || !cellsList || cellsList.length < 2) return false;

    let minR = Infinity, maxR = -Infinity;
    let minC = Infinity, maxC = -Infinity;

    cellsList.forEach(({ r, c }) => {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    });

    // Must form a solid rectangle of selected cells
    const expectedCount = (maxR - minR + 1) * (maxC - minC + 1);
    if (cellsList.length !== expectedCount) return false;

    // Check all slots in rectangle belong to the selection
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!cellsList.some(sc => sc.r === r && sc.c === c)) return false;
      }
    }

    return true;
  }

  function mergeCells(table) {
    const list = table.selectedCells;
    if (!canMerge(table, list)) {
      App.showToast('Selected cells must form a continuous rectangle to merge.');
      return;
    }

    Canvas.saveHistory();

    let minR = Infinity, maxR = -Infinity;
    let minC = Infinity, maxC = -Infinity;
    const combinedTexts = [];

    list.forEach(({ r, c }) => {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;

      const cell = table.cells[r][c];
      if (cell && cell.text) combinedTexts.push(cell.text.trim());
    });

    const masterCell = table.cells[minR][minC];
    masterCell.rowSpan = (maxR - minR + 1);
    masterCell.colSpan = (maxC - minC + 1);
    masterCell.text = combinedTexts.join(' ');
    masterCell.isMergedPlaceholder = false;
    masterCell.mergedInto = null;

    // Mark covered cells as placeholders
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r === minR && c === minC) continue;
        const cell = table.cells[r][c];
        if (cell) {
          cell.isMergedPlaceholder = true;
          cell.mergedInto = { r: minR, c: minC };
          cell.text = '';
        }
      }
    }

    table.selectedCells = [{ r: minR, c: minC }];
    Canvas.renderShapes();
    showTableContextToolbar(table);
    App.showToast(`Merged ${masterCell.rowSpan}×${masterCell.colSpan} cells`);
  }

  function splitCell(table, r, c) {
    const masterCell = table.cells[r]?.[c];
    if (!masterCell || (masterCell.rowSpan <= 1 && masterCell.colSpan <= 1)) {
      App.showToast('This cell is not merged.');
      return;
    }

    Canvas.saveHistory();

    const origText = masterCell.text;
    const rs = masterCell.rowSpan;
    const cs = masterCell.colSpan;

    masterCell.rowSpan = 1;
    masterCell.colSpan = 1;

    for (let dr = 0; dr < rs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        const rowIdx = r + dr;
        const colIdx = c + dc;
        const cell = table.cells[rowIdx]?.[colIdx];
        if (cell) {
          cell.rowSpan = 1;
          cell.colSpan = 1;
          cell.isMergedPlaceholder = false;
          cell.mergedInto = null;
        }
      }
    }

    masterCell.text = origText;
    Canvas.renderShapes();
    showTableContextToolbar(table);
    App.showToast('Cell split successfully');
  }

  // ─────────────────────────────────────────────
  // 7. INLINE TOUCH TEXT EDITOR FOR CELLS
  // ─────────────────────────────────────────────
  function editActiveCell() {
    if (!activeTable) return;
    const sel = (activeTable.selectedCells && activeTable.selectedCells.length)
      ? activeTable.selectedCells[0]
      : { r: 0, c: 0 };
    editCell(activeTable, sel.r, sel.c);
  }

  function editCell(table, r, c) {
    const cell = table.cells?.[r]?.[c];
    if (!cell || cell.isMergedPlaceholder) return;

    closeInlineEditor();

    const rect = getCellRect(table, r, c);
    if (!rect) return;

    cell._editing = true;
    table.selectedCells = [{ r, c }];
    Canvas.renderShapes();

    const zone = document.getElementById('canvas-zone');
    const vp = document.getElementById('canvas-viewport');
    const parent = vp || zone;

    const textarea = document.createElement('textarea');
    textarea.id = 'table-cell-active-editor';
    textarea.className = 'table-cell-editor';
    textarea.value = cell.text || '';
    textarea.placeholder = 'Type text...';
    textarea.setAttribute('inputmode', 'text');
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('spellcheck', 'false');

    const pad = cell.padding || 8;
    const isDark = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId)
      ? Canvas.getBoardColorId() !== 'white'
      : true;

    const bgCol = (cell.bg && cell.bg !== 'transparent')
      ? cell.bg
      : (isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff');
    const textCol = cell.color || (isDark ? '#ffffff' : '#0f172a');
    const fs = Math.max(16, cell.fontSize || 18);

    textarea.style.cssText = `
      position: absolute;
      left: ${rect.x}px;
      top: ${rect.y}px;
      width: ${rect.w}px;
      height: ${rect.h}px;
      padding: ${pad}px;
      background: ${bgCol};
      color: ${textCol};
      font-family: ${cell.fontFamily || 'Noto Sans, sans-serif'};
      font-size: ${fs}px;
      font-weight: ${cell.bold ? '700' : '400'};
      font-style: ${cell.italic ? 'italic' : 'normal'};
      text-align: ${cell.align || 'left'};
      border: 2px solid #eab308;
      border-radius: 4px;
      outline: none;
      resize: none;
      box-sizing: border-box;
      z-index: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(234, 179, 8, 0.4);
      touch-action: auto;
      caret-color: #eab308;
      line-height: 1.35;
    `;

    // Prevent board canvas from intercepting touch / clicks while typing
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'].forEach(evtName => {
      textarea.addEventListener(evtName, (e) => e.stopPropagation());
    });

    parent.appendChild(textarea);
    inlineEditor = { textarea, table, r, c, cell };

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 40);

    function commitValue() {
      if (!inlineEditor) return;
      const val = textarea.value;
      if (val !== cell.text) {
        Canvas.saveHistory();
        cell.text = val;
      }
    }

    function commitAndClose() {
      if (!inlineEditor) return;
      commitValue();
      delete cell._editing;
      textarea.remove();
      inlineEditor = null;
      Canvas.renderShapes();
      showTableContextToolbar(table);
    }

    textarea.addEventListener('blur', () => {
      setTimeout(() => {
        if (inlineEditor && inlineEditor.textarea === textarea) {
          commitAndClose();
        }
      }, 100);
    });

    textarea.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        commitAndClose();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitValue();
        delete cell._editing;
        textarea.remove();
        inlineEditor = null;
        Canvas.renderShapes();

        if (e.shiftKey) {
          // Move to previous cell
          let prevC = c - 1;
          let prevR = r;
          if (prevC < 0) {
            prevC = table.cols - 1;
            prevR = r - 1;
          }
          if (prevR >= 0) {
            editCell(table, prevR, prevC);
          } else {
            showTableContextToolbar(table);
          }
        } else {
          // Move to next cell
          let nextC = c + 1;
          let nextR = r;
          if (nextC >= table.cols) {
            nextC = 0;
            nextR = r + 1;
          }
          if (nextR >= table.rows) {
            insertRow(table, table.rows - 1, false);
            nextR = table.rows - 1;
            nextC = 0;
          }
          editCell(table, nextR, nextC);
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Plain Enter moves down to cell below
        e.preventDefault();
        commitValue();
        delete cell._editing;
        textarea.remove();
        inlineEditor = null;
        Canvas.renderShapes();

        let nextR = r + 1;
        if (nextR >= table.rows) {
          insertRow(table, table.rows - 1, false);
          nextR = table.rows - 1;
        }
        editCell(table, nextR, c);
      }
    });
  }

  function closeInlineEditor() {
    if (inlineEditor) {
      const { textarea, cell } = inlineEditor;
      if (cell) {
        cell.text = textarea.value;
        delete cell._editing;
      }
      textarea.remove();
      inlineEditor = null;
      Canvas.renderShapes();
    }
  }

  // ─────────────────────────────────────────────
  // 8. TABLE FLOATING CONTEXT TOOLBAR (65" UI)
  // ─────────────────────────────────────────────
  function showTableContextToolbar(table) {
    hideTableContextToolbar();
    if (!table || !table.selected) return;

    activeTable = table;

    const existingBar = document.getElementById('table-floating-toolbar');
    if (existingBar) existingBar.remove();

    const bar = document.createElement('div');
    bar.id = 'table-floating-toolbar';
    bar.className = 'table-touch-toolbar';

    const selCell = (table.selectedCells && table.selectedCells.length) ? table.selectedCells[0] : { r: 0, c: 0 };
    const curCell = table.cells[selCell.r]?.[selCell.c] || {};

    const canMergeCells = canMerge(table, table.selectedCells);
    const isMergedCell = (curCell.rowSpan > 1 || curCell.colSpan > 1);

    bar.innerHTML = `
      <!-- Prominent 1-Tap Write Text button -->
      <div class="ttt-group">
        <button class="ttt-btn ttt-btn-type" onclick="TableTool.editActiveCell()" title="Type or edit text inside selected cell (Enter / Tab)">
          <span style="font-size:14px;">✏️</span>
          <span style="font-weight:700;color:#fef08a;">Write Text</span>
        </button>
      </div>

      <div class="ttt-div"></div>

      <div class="ttt-group">
        <button class="ttt-btn" onclick="TableTool.promptAddRow(false)" title="Insert Row Below">
          <span>＋ Row</span>
        </button>
        <button class="ttt-btn" onclick="TableTool.deleteActiveRow()" title="Delete Current Row">
          <span>－ Row</span>
        </button>
        <button class="ttt-btn" onclick="TableTool.promptAddCol(false)" title="Insert Column Right">
          <span>＋ Col</span>
        </button>
        <button class="ttt-btn" onclick="TableTool.deleteActiveCol()" title="Delete Current Column">
          <span>－ Col</span>
        </button>
      </div>

      <div class="ttt-div"></div>

      <div class="ttt-group">
        ${canMergeCells ? `
          <button class="ttt-btn ttt-btn-accent" onclick="TableTool.mergeCells(TableTool.getActiveTable())" title="Merge Selected Cells">
            <span>⛶ Merge</span>
          </button>
        ` : ''}
        ${isMergedCell ? `
          <button class="ttt-btn ttt-btn-accent" onclick="TableTool.splitActiveCell()" title="Split Merged Cell">
            <span>✁ Split</span>
          </button>
        ` : ''}
      </div>

      <div class="ttt-div"></div>

      <!-- Text Formatting -->
      <div class="ttt-group">
        <button class="ttt-btn ${curCell.bold ? 'active' : ''}" onclick="TableTool.toggleBold()" title="Bold">
          <strong>B</strong>
        </button>
        <button class="ttt-btn ${curCell.italic ? 'active' : ''}" onclick="TableTool.toggleItalic()" title="Italic">
          <em>I</em>
        </button>
        <button class="ttt-btn" onclick="TableTool.cycleAlign()" title="Horizontal Align (Left/Center/Right)">
          <span>≡ ${curCell.align || 'left'}</span>
        </button>
        <button class="ttt-btn" onclick="TableTool.cycleValign()" title="Vertical Align (Top/Middle/Bottom)">
          <span>⬍ ${curCell.valign || 'mid'}</span>
        </button>
      </div>

      <div class="ttt-div"></div>

      <!-- Color Pickers -->
      <div class="ttt-group">
        <label class="ttt-color-btn" title="Cell Background Color">
          <span style="font-size:11px;">🎨 BG</span>
          <input type="color" onchange="TableTool.setCellBg(this.value)" value="${curCell.bg && curCell.bg.startsWith('#') ? curCell.bg : '#1e293b'}" style="opacity:0;position:absolute;width:1px;height:1px;">
        </label>
        <label class="ttt-color-btn" title="Text Color">
          <span style="font-size:11px;">🔤 Text</span>
          <input type="color" onchange="TableTool.setTextColor(this.value)" value="${curCell.color && curCell.color.startsWith('#') ? curCell.color : '#ffffff'}" style="opacity:0;position:absolute;width:1px;height:1px;">
        </label>
        <button class="ttt-btn" onclick="TableTool.cycleBorder()" title="Toggle Borders (All / Outer / None)">
          <span>⬜ Borders</span>
        </button>
      </div>

      <div class="ttt-div"></div>

      <!-- Delete Table -->
      <div class="ttt-group">
        <button class="ttt-btn ttt-btn-danger" onclick="TableTool.deleteTable()" title="Delete Table">
          <span>🗑 Delete</span>
        </button>
      </div>
    `;

    // Calculate smart positioning within canvas area
    const zone = document.getElementById('canvas-zone');
    if (!zone) return;
    zone.appendChild(bar);

    const barW = bar.offsetWidth || 560;
    const barH = bar.offsetHeight || 44;

    let posX = table.x + table.w / 2 - barW / 2;
    let posY = table.y - barH - 26;

    // Viewport bounds clamp
    if (posY < 10) posY = table.y + table.h + 16;
    if (posX < 10) posX = 10;
    if (posX + barW > zone.offsetWidth - 10) posX = zone.offsetWidth - barW - 10;

    bar.style.left = `${Math.round(posX)}px`;
    bar.style.top = `${Math.round(posY)}px`;
  }

  function hideTableContextToolbar() {
    const bar = document.getElementById('table-floating-toolbar');
    if (bar) bar.remove();
  }

  // ─────────────────────────────────────────────
  // 9. TOOLBAR ACTION HANDLERS
  // ─────────────────────────────────────────────
  function promptAddRow(above = false) {
    if (!activeTable) return;
    const r = activeTable.selectedCells?.[0]?.r ?? (activeTable.rows - 1);
    insertRow(activeTable, r, above);
  }

  function deleteActiveRow() {
    if (!activeTable) return;
    const r = activeTable.selectedCells?.[0]?.r ?? (activeTable.rows - 1);
    deleteRow(activeTable, r);
  }

  function promptAddCol(left = false) {
    if (!activeTable) return;
    const c = activeTable.selectedCells?.[0]?.c ?? (activeTable.cols - 1);
    insertCol(activeTable, c, left);
  }

  function deleteActiveCol() {
    if (!activeTable) return;
    const c = activeTable.selectedCells?.[0]?.c ?? (activeTable.cols - 1);
    deleteCol(activeTable, c);
  }

  function splitActiveCell() {
    if (!activeTable) return;
    const sc = activeTable.selectedCells?.[0];
    if (sc) splitCell(activeTable, sc.r, sc.c);
  }

  function toggleBold() {
    if (!activeTable) return;
    Canvas.saveHistory();
    const cells = activeTable.selectedCells || [];
    const curVal = activeTable.cells[cells[0]?.r]?.[cells[0]?.c]?.bold;
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) cell.bold = !curVal;
    });
    Canvas.renderShapes();
    showTableContextToolbar(activeTable);
  }

  function toggleItalic() {
    if (!activeTable) return;
    Canvas.saveHistory();
    const cells = activeTable.selectedCells || [];
    const curVal = activeTable.cells[cells[0]?.r]?.[cells[0]?.c]?.italic;
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) cell.italic = !curVal;
    });
    Canvas.renderShapes();
    showTableContextToolbar(activeTable);
  }

  function cycleAlign() {
    if (!activeTable) return;
    Canvas.saveHistory();
    const map = { left: 'center', center: 'right', right: 'left' };
    const cells = activeTable.selectedCells || [];
    const cur = activeTable.cells[cells[0]?.r]?.[cells[0]?.c]?.align || 'left';
    const next = map[cur] || 'center';
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) cell.align = next;
    });
    Canvas.renderShapes();
    showTableContextToolbar(activeTable);
  }

  function cycleValign() {
    if (!activeTable) return;
    Canvas.saveHistory();
    const map = { middle: 'top', top: 'bottom', bottom: 'middle' };
    const cells = activeTable.selectedCells || [];
    const cur = activeTable.cells[cells[0]?.r]?.[cells[0]?.c]?.valign || 'middle';
    const next = map[cur] || 'middle';
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) cell.valign = next;
    });
    Canvas.renderShapes();
    showTableContextToolbar(activeTable);
  }

  function setCellBg(hex) {
    if (!activeTable) return;
    Canvas.saveHistory();
    const cells = activeTable.selectedCells || [];
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) cell.bg = hex;
    });
    Canvas.renderShapes();
  }

  function setTextColor(hex) {
    if (!activeTable) return;
    Canvas.saveHistory();
    const cells = activeTable.selectedCells || [];
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) cell.color = hex;
    });
    Canvas.renderShapes();
  }

  function cycleBorder() {
    if (!activeTable) return;
    Canvas.saveHistory();
    const cells = activeTable.selectedCells || [];
    cells.forEach(({ r, c }) => {
      const cell = activeTable.cells[r]?.[c];
      if (cell) {
        const allOn = cell.borders.top && cell.borders.bottom && cell.borders.left && cell.borders.right;
        if (allOn) {
          // Switch to none
          cell.borders = { top: false, bottom: false, left: false, right: false };
        } else {
          // Switch to all
          cell.borders = { top: true, bottom: true, left: true, right: true };
        }
      }
    });
    Canvas.renderShapes();
    showTableContextToolbar(activeTable);
  }

  function deleteTable() {
    if (!activeTable) return;
    Canvas.saveHistory();
    Canvas.deleteShape();
    hideTableContextToolbar();
    closeInlineEditor();
  }

  // ─────────────────────────────────────────────
  // 10. CREATE TABLE MODAL DIALOG
  // ─────────────────────────────────────────────
  function openCreateModal() {
    closeCreateModal();

    const overlay = document.createElement('div');
    overlay.id = 'table-create-modal';
    overlay.className = 'table-create-overlay';

    let curRows = 3;
    let curCols = 4;
    let curPreset = 'classroom';

    overlay.innerHTML = `
      <div class="table-modal-card">
        <div class="tmc-header">
          <div class="tmc-title-wrap">
            <span class="tmc-icon">📊</span>
            <span class="tmc-title">Insert Classroom Table</span>
          </div>
          <button class="tmc-close" onclick="TableTool.closeCreateModal()">✕</button>
        </div>

        <div class="tmc-body">
          <!-- Quick Grid Selector -->
          <div class="tmc-grid-sec">
            <span class="tmc-lbl">Touch Grid Size: <strong id="tmc-grid-dim">3 × 4</strong></span>
            <div class="tmc-interactive-grid" id="tmc-grid-matrix"></div>
          </div>

          <!-- Steppers -->
          <div class="tmc-steppers-row">
            <div class="tmc-stepper-box">
              <span class="tmc-slabel">Rows</span>
              <div class="tmc-stepper">
                <button type="button" class="tmc-sbtn" id="tmc-r-minus">−</button>
                <span class="tmc-sval" id="tmc-rows-val">3</span>
                <button type="button" class="tmc-sbtn" id="tmc-r-plus">＋</button>
              </div>
            </div>

            <div class="tmc-stepper-box">
              <span class="tmc-slabel">Columns</span>
              <div class="tmc-stepper">
                <button type="button" class="tmc-sbtn" id="tmc-c-minus">−</button>
                <span class="tmc-sval" id="tmc-cols-val">4</span>
                <button type="button" class="tmc-sbtn" id="tmc-c-plus">＋</button>
              </div>
            </div>
          </div>

          <!-- Preset Themes -->
          <div class="tmc-presets-sec">
            <span class="tmc-lbl">Table Preset</span>
            <div class="tmc-presets-pills">
              <button type="button" class="tmc-preset-btn active" data-preset="classroom">Classroom</button>
              <button type="button" class="tmc-preset-btn" data-preset="math">Mathematics</button>
              <button type="button" class="tmc-preset-btn" data-preset="simple">Minimal Grid</button>
            </div>
          </div>
        </div>

        <div class="tmc-footer">
          <button type="button" class="tmc-btn-cancel" onclick="TableTool.closeCreateModal()">Cancel</button>
          <button type="button" class="tmc-btn-create" id="tmc-btn-insert">Insert Table</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Build 6x6 interactive visual grid
    const matrix = overlay.querySelector('#tmc-grid-matrix');
    const dimLbl = overlay.querySelector('#tmc-grid-dim');
    const rowsLbl = overlay.querySelector('#tmc-rows-val');
    const colsLbl = overlay.querySelector('#tmc-cols-val');

    function updateSelection(r, c) {
      curRows = Math.max(1, Math.min(10, r));
      curCols = Math.max(1, Math.min(8, c));
      dimLbl.textContent = `${curRows} × ${curCols}`;
      rowsLbl.textContent = curRows;
      colsLbl.textContent = curCols;

      const cells = matrix.querySelectorAll('.tmc-cell');
      cells.forEach(el => {
        const er = parseInt(el.dataset.r);
        const ec = parseInt(el.dataset.c);
        el.classList.toggle('active', er <= curRows && ec <= curCols);
      });
    }

    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 6; c++) {
        const cell = document.createElement('div');
        cell.className = 'tmc-cell' + (r <= curRows && c <= curCols ? ' active' : '');
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('mouseenter', () => updateSelection(r, c));
        cell.addEventListener('click', () => updateSelection(r, c));
        matrix.appendChild(cell);
      }
    }

    // Stepper listeners
    overlay.querySelector('#tmc-r-minus').onclick = () => updateSelection(curRows - 1, curCols);
    overlay.querySelector('#tmc-r-plus').onclick  = () => updateSelection(curRows + 1, curCols);
    overlay.querySelector('#tmc-c-minus').onclick = () => updateSelection(curRows, curCols - 1);
    overlay.querySelector('#tmc-c-plus').onclick  = () => updateSelection(curRows, curCols + 1);

    // Presets
    overlay.querySelectorAll('.tmc-preset-btn').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.tmc-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        curPreset = btn.dataset.preset;
      };
    });

    // Insert action
    overlay.querySelector('#tmc-btn-insert').onclick = () => {
      const zone = document.getElementById('canvas-zone');
      const sz = Canvas.getCanvasSize ? Canvas.getCanvasSize() : { W: 1200, H: 800 };

      // Center table on current viewport
      const table = createTable(curRows, curCols, Math.round(sz.W / 2 - 320), Math.round(sz.H / 2 - 180), {
        preset: curPreset
      });

      Canvas.addShapeObject(table);
      closeCreateModal();
      showTableContextToolbar(table);
      App.showToast(`Table (${curRows} × ${curCols}) created`);
    };
  }

  function closeCreateModal() {
    const modal = document.getElementById('table-create-modal');
    if (modal) modal.remove();
  }

  return {
    createTable,
    draw,
    hitTest,
    getCellRect,
    insertRow,
    deleteRow,
    insertCol,
    deleteCol,
    mergeCells,
    splitCell,
    canMerge,
    editCell,
    editActiveCell,
    closeInlineEditor,
    openCreateModal,
    closeCreateModal,
    showTableContextToolbar,
    hideTableContextToolbar,
    getActiveTable: () => activeTable,
    promptAddRow,
    deleteActiveRow,
    promptAddCol,
    deleteActiveCol,
    splitActiveCell,
    toggleBold,
    toggleItalic,
    cycleAlign,
    cycleValign,
    setCellBg,
    setTextColor,
    cycleBorder,
    deleteTable
  };
})();
