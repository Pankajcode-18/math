'use strict';
// ═══════════════════════════════════════════════
// UI — builds all dynamic HTML, manages panels
// ═══════════════════════════════════════════════
const UI = (() => {

  let panelOpen = false;

  const BOARD_COLORS = [
    { id:'green', bg:'#0e2419', line:'rgba(255,255,255,0.075)', major:'rgba(255,255,255,0.15)', label:'Chalkboard Green' },
    { id:'black', bg:'#0b0d13', line:'rgba(255,255,255,0.07)',  major:'rgba(255,255,255,0.14)', label:'Blackboard' },
    { id:'navy',  bg:'#0a1224', line:'rgba(148,163,184,0.08)', major:'rgba(148,163,184,0.16)', label:'Cosmic Navy' },
    { id:'white', bg:'#ffffff', line:'rgba(15,23,42,0.07)',    major:'rgba(15,23,42,0.13)',    label:'Whiteboard' },
  ];

  // ─────────────────────────────────────────────
  function getCurriculumChapters() {
    if (typeof CurriculumStore !== 'undefined') {
      const storeChapters = CurriculumStore.getChapters();
      if (storeChapters && storeChapters.length) return storeChapters;
    }
    if (typeof CURRICULUM_DATA !== 'undefined' && typeof App !== 'undefined') {
      const subj = CURRICULUM_DATA.subjects.find(s => s.id === App.activeSubject);
      if (subj && subj.chapters) return subj.chapters;
    }
    return typeof CHAPTERS !== 'undefined' ? CHAPTERS : [];
  }

  function getSubjectChapters(subjectId) {
    if (typeof CurriculumStore !== 'undefined') {
      const storeChapters = CurriculumStore.getChapters('grade-10', subjectId);
      if (storeChapters && storeChapters.length) return storeChapters;
    }
    if (typeof CURRICULUM_DATA !== 'undefined') {
      const subj = CURRICULUM_DATA.subjects.find(s => s.id === subjectId);
      if (subj && subj.chapters) return subj.chapters;
    }
    return [];
  }

  function renderTopChapters() {
    const mathMenu = document.getElementById('math-chapters-menu');
    const sciMenu  = document.getElementById('sci-chapters-menu');

    const mathChapters = getSubjectChapters('mathematics');
    const sciChapters  = getSubjectChapters('science');

    if (mathMenu) {
      mathMenu.innerHTML = `
        <div class="ch-dd-header">
          <div class="ch-dd-subj-title">📐 Grade 10 Mathematics</div>
          <span class="ch-dd-count">${mathChapters.length} Chapters</span>
        </div>
        <div class="ch-dd-scroll">
          ${mathChapters.map((ch, idx) => {
            const isActive = (typeof App !== 'undefined' && App.activeSubject === 'mathematics') &&
              (ch.id === App.activeChapter || +ch.id === +App.activeChapter);
            const num = String(idx + 1).padStart(2, '0');
            const nepali = ch.nepaliName ? `<span class="ch-dd-nepali">${ch.nepaliName}</span>` : '';
            return `
              <button class="ch-dd-item${isActive ? ' active' : ''}" onclick="App.switchSubject('mathematics'); App.selectChapter(${ch.id}); UI.closeAllDropdowns();">
                <span class="ch-dd-num">${num}</span>
                <div class="ch-dd-body">
                  <span class="ch-dd-name">${ch.name}</span>
                  ${nepali}
                </div>
                ${isActive ? '<span class="ch-dd-check">✓</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (sciMenu) {
      sciMenu.innerHTML = `
        <div class="ch-dd-header">
          <div class="ch-dd-subj-title">🔬 Grade 10 Science & Technology</div>
          <span class="ch-dd-count">${sciChapters.length} Chapters</span>
        </div>
        <div class="ch-dd-scroll">
          ${sciChapters.map((ch, idx) => {
            const isActive = (typeof App !== 'undefined' && App.activeSubject === 'science') &&
              (ch.id === App.activeChapter || +ch.id === +App.activeChapter);
            const num = String(idx + 1).padStart(2, '0');
            const nepali = ch.nepaliName ? `<span class="ch-dd-nepali">${ch.nepaliName}</span>` : '';
            return `
              <button class="ch-dd-item${isActive ? ' active' : ''}" onclick="App.switchSubject('science'); App.selectChapter(${ch.id}); UI.closeAllDropdowns();">
                <span class="ch-dd-num">${num}</span>
                <div class="ch-dd-body">
                  <span class="ch-dd-name">${ch.name}</span>
                  ${nepali}
                </div>
                ${isActive ? '<span class="ch-dd-check">✓</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    updateTopChapterBadge();
  }

  function updateTopChapterBadge() {
    const chapters = getCurriculumChapters();
    if (!chapters || !chapters.length) return;
    const ch = chapters.find(c => c.id === App.activeChapter || +c.id === +App.activeChapter) || chapters[0];
    if (!ch) return;

    const idx = chapters.findIndex(c => c.id === ch.id || +c.id === +ch.id);
    const tagEl = document.getElementById('top-ch-tag');
    if (tagEl) tagEl.textContent = `Unit ${(idx >= 0 ? idx + 1 : ch.id)} / ${chapters.length}`;

    const lblEl = document.getElementById('active-ch-label');
    if (lblEl) {
      const nep = ch.nepaliName ? ` (${ch.nepaliName})` : '';
      lblEl.textContent = `Ch ${ch.id}: ${ch.name}${nep}`;
      lblEl.title = `Ch ${ch.id}: ${ch.name}`;
    }
  }

  function toggleSubjectDropdown(subjectId, ddId) {
    if (typeof App !== 'undefined' && App.activeSubject !== subjectId) {
      App.switchSubject(subjectId);
    }
    toggleDropdown(ddId);
  }

  function buildSidebar() {
    renderTopChapters();
  }

  function updateSidebarCard() {
    updateTopChapterBadge();
  }

  function prevChapter() {
    const chapters = getCurriculumChapters();
    if (!chapters || !chapters.length) return;
    const curIdx = chapters.findIndex(c => c.id === App.activeChapter || +c.id === +App.activeChapter);
    if (curIdx > 0) {
      App.selectChapter(chapters[curIdx - 1].id);
    }
  }

  function nextChapter() {
    const chapters = getCurriculumChapters();
    if (!chapters || !chapters.length) return;
    const curIdx = chapters.findIndex(c => c.id === App.activeChapter || +c.id === +App.activeChapter);
    if (curIdx >= 0 && curIdx < chapters.length - 1) {
      App.selectChapter(chapters[curIdx + 1].id);
    }
  }

  // ─────────────────────────────────────────────
  // Rebuild sidebar + shape grid for a new subject
  // ─────────────────────────────────────────────
  function rebuildForSubject(subjectId) {
    if (typeof CurriculumStore !== 'undefined') {
      CurriculumStore.setActiveSubject(subjectId);
    }
    renderTopChapters();
    buildShapeGrid();
  }


  // ─────────────────────────────────────────────
  function buildBoardSwatches() {
    const wrap = document.getElementById('board-swatches');
    if (!wrap) return;
    wrap.innerHTML = '';

    const curBoardId = (typeof Canvas !== 'undefined' && Canvas.getBoardColorId) ? Canvas.getBoardColorId() : 'green';

    BOARD_COLORS.forEach(bc => {
      const s = document.createElement('div');
      s.className = 'bswatch' + (bc.id === curBoardId ? ' active' : '');
      s.dataset.id = bc.id;
      s.style.background = bc.bg;
      s.title = `${bc.label} (${bc.bg})`;
      if (bc.bg === '#ffffff' || bc.bg === '#fdf6e3' || bc.bg === '#f1f5f9') {
        s.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.18)';
      }
      s.addEventListener('click', () => {
        Canvas.setBoardColor(bc.id, bc.bg, bc.line, bc.major);
        document.querySelectorAll('.bswatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        const customDot = document.getElementById('board-custom-swatch');
        if (customDot) customDot.classList.remove('active');
      });
      wrap.appendChild(s);
    });

    // Custom Color Picker Swatch (+)
    const customLabel = document.createElement('label');
    customLabel.className = 'bswatch bswatch-custom';
    customLabel.id = 'board-custom-swatch';
    customLabel.title = 'Pick Custom Board Color…';
    customLabel.innerHTML = `
      <input type="color" id="board-custom-color-input" value="#0a1f0a" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;">
      <span class="bswatch-custom-icon">+</span>
    `;
    const colorInput = customLabel.querySelector('input');
    colorInput.addEventListener('change', (e) => {
      const hex = e.target.value;
      Canvas.setBoardColor('custom', hex);
      document.querySelectorAll('.bswatch').forEach(x => x.classList.remove('active'));
      customLabel.classList.add('active');
      customLabel.style.background = hex;
      const r = parseInt(hex.slice(1,3), 16) || 0;
      const g = parseInt(hex.slice(3,5), 16) || 0;
      const b = parseInt(hex.slice(5,7), 16) || 0;
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
      const icon = customLabel.querySelector('.bswatch-custom-icon');
      if (lum > 0.5) {
        customLabel.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.2)';
        if (icon) icon.style.color = '#000000';
      } else {
        customLabel.style.boxShadow = 'none';
        if (icon) icon.style.color = '#ffffff';
      }
    });
    wrap.appendChild(customLabel);
  }
  // ─────────────────────────────────────────────
  function syncPenPanel() {
    const curSize = (typeof App !== 'undefined') ? App.penSize : 2;
    const curColor = (typeof App !== 'undefined') ? App.currentColor : '#ffffff';

    // Synchronize 3 pen size buttons (active ring + colored dot inside)
    document.querySelectorAll('.fp-size-ring').forEach(btn => {
      const sz = Number(btn.dataset.size);
      const isActive = sz === curSize;
      btn.classList.toggle('active', isActive);
      const dot = btn.querySelector('.fp-size-dot');
      if (dot) {
        dot.style.background = curColor;
        if (curColor.toLowerCase() === '#ffffff' || curColor.toLowerCase() === '#fff') {
          dot.style.border = '1px solid #94a3b8';
        } else {
          dot.style.border = 'none';
        }
      }
    });

    // Synchronize quick color dots
    document.querySelectorAll('.fp-color-dot').forEach(d => {
      if (!d.dataset.hex) return;
      const isMatch = d.dataset.hex.toLowerCase() === curColor.toLowerCase();
      d.classList.toggle('active', isMatch);
    });

    // Synchronize eraser size buttons
    const curEraserSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : 26;
    document.querySelectorAll('.fp-eraser-size-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.esize) === Number(curEraserSize));
    });
  }

  function selectPenSize(sz) {
    if (typeof App !== 'undefined') {
      App.penSize = sz;
    }
    syncPenPanel();
  }

  function selectEraserSize(sz) {
    if (typeof App !== 'undefined') {
      App.eraserSize = sz;
    }
    syncPenPanel();
  }

  let shapesSectionHidden = false;
  function toggleShapesSection() {
    shapesSectionHidden = !shapesSectionHidden;
    const grid = document.getElementById('shape-grid');
    const btn = document.getElementById('rp-shapes-hide-btn');
    if (grid) grid.style.display = shapesSectionHidden ? 'none' : 'grid';
    if (btn) btn.textContent = shapesSectionHidden ? 'Show' : 'Hide';
  }

  // ─────────────────────────────────────────────
  // FLYOUT CONTROLS (Left Floating Palette Popovers)
  // ─────────────────────────────────────────────
  function togglePenFlyout() {
    const p = document.getElementById('flyout-pen');
    if (!p) return;
    const isHidden = p.classList.contains('hidden');
    closeAllFlyouts();
    if (isHidden) {
      p.classList.remove('hidden');
      if (typeof App !== 'undefined' && !['pen','highlighter'].includes(App.currentTool)) {
        App.setTool('pen');
      }
      syncPenPanel();
    }
  }

  function openPenFlyout() {
    const p = document.getElementById('flyout-pen');
    if (p) {
      closeShapesFlyout();
      closeEraserFlyout();
      closeInsertFlyout();
      p.classList.remove('hidden');
      syncPenPanel();
    }
  }

  function closePenFlyout() {
    const p = document.getElementById('flyout-pen');
    if (p) p.classList.add('hidden');
  }

  function toggleEraserFlyout() {
    const ep = document.getElementById('flyout-eraser');
    if (!ep) return;
    const isHidden = ep.classList.contains('hidden');
    closeAllFlyouts();
    if (isHidden) {
      ep.classList.remove('hidden');
      if (typeof App !== 'undefined' && App.currentTool !== 'eraser') {
        App.setTool('eraser');
      }
      syncPenPanel();
    }
  }

  function openEraserFlyout() {
    const ep = document.getElementById('flyout-eraser');
    if (ep) {
      closePenFlyout();
      closeShapesFlyout();
      closeInsertFlyout();
      ep.classList.remove('hidden');
      syncPenPanel();
    }
  }

  function closeEraserFlyout() {
    const ep = document.getElementById('flyout-eraser');
    if (ep) ep.classList.add('hidden');
  }

  function toggleShapesFlyout() {
    const s = document.getElementById('flyout-shapes');
    if (!s) return;
    const isHidden = s.classList.contains('hidden');
    closeAllFlyouts();
    if (isHidden) {
      s.classList.remove('hidden');
      switchShapesDomain(activeShapesDomain);
    }
  }

  function openShapesFlyout() {
    const s = document.getElementById('flyout-shapes');
    if (s) {
      closePenFlyout();
      closeEraserFlyout();
      closeInsertFlyout();
      s.classList.remove('hidden');
      switchShapesDomain(activeShapesDomain);
    }
  }

  function closeShapesFlyout() {
    const s = document.getElementById('flyout-shapes');
    if (s) s.classList.add('hidden');
  }

  function closeAllFlyouts() {
    const p = document.getElementById('flyout-pen');
    const e = document.getElementById('flyout-eraser');
    const s = document.getElementById('flyout-shapes');
    const i = document.getElementById('flyout-insert');
    if (p) p.classList.add('hidden');
    if (e) e.classList.add('hidden');
    if (s) s.classList.add('hidden');
    if (i) i.classList.add('hidden');
  }

  function toggleInsertFlyout() {
    const i = document.getElementById('flyout-insert');
    if (!i) return;
    const isHidden = i.classList.contains('hidden');
    closeAllFlyouts();
    if (isHidden) {
      i.classList.remove('hidden');
    }
  }

  function openInsertFlyout() {
    const i = document.getElementById('flyout-insert');
    if (i) {
      closePenFlyout();
      closeShapesFlyout();
      i.classList.remove('hidden');
    }
  }

  function closeInsertFlyout() {
    const i = document.getElementById('flyout-insert');
    if (i) i.classList.add('hidden');
  }

  function openPdfPicker() {
    const inp = document.getElementById('pdf-file-input');
    if (inp) {
      inp.value = '';
      inp.click();
    }
  }

  async function handlePdfSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (typeof App !== 'undefined' && App.showToast) App.showToast(`Loading PDF: ${file.name}...`);
    try {
      if (typeof pdfjsLib === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = () => {
            if (window.pdfjsLib) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            resolve();
          };
          s.onerror = () => reject(new Error('Failed to load PDF engine'));
          document.head.appendChild(s);
        });
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const slides = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        slides.push({
          index: i,
          name: `Page ${i}`,
          dataUrl: canvas.toDataURL('image/jpeg', 0.92)
        });
      }
      if (slides.length > 0) {
        if (typeof PptPresenter !== 'undefined' && PptPresenter.loadDeck) {
          PptPresenter.loadDeck({
            success: true,
            fileName: file.name,
            slideCount: slides.length,
            slides: slides
          });
          if (typeof App !== 'undefined' && App.showToast) App.showToast(`✓ Imported PDF (${slides.length} pages)`);
        } else if (typeof Canvas !== 'undefined' && Canvas.setBgImage) {
          Canvas.setBgImage(slides[0].dataUrl);
        }
      }
    } catch (err) {
      console.error('PDF error:', err);
      alert('Could not render PDF slides: ' + err.message);
    }
    e.target.value = '';
  }

  function selectSubtool(sub) {
    if (typeof App === 'undefined') return;
    if (sub === 'pen') {
      App.setTool('pen');
    } else if (sub === 'highlighter') {
      App.setTool('highlighter');
    } else if (sub === 'eraser') {
      App.setTool('eraser');
    } else if (sub === 'select') {
      App.setTool('select');
      closePenFlyout();
    }
    syncSubtoolButtons(sub);
  }

  function syncSubtoolButtons(activeSub) {
    document.querySelectorAll('.fp-sub-btn').forEach(btn => {
      const match = btn.id === `subtool-${activeSub}` || btn.dataset.sub === activeSub;
      btn.classList.toggle('active', match);
    });
  }

  function cyclePenSize() {
    if (typeof App === 'undefined') return;
    const SIZES = [
      { sz: 2, dot: 3, label: 'Fine (2px)' },
      { sz: 4, dot: 6, label: 'Medium (4px)' },
      { sz: 8, dot: 9, label: 'Bold (8px)' },
      { sz: 16, dot: 14, label: 'Marker (16px)' }
    ];
    let currIdx = SIZES.findIndex(s => s.sz === App.penSize);
    if (currIdx === -1) currIdx = 0;
    const next = SIZES[(currIdx + 1) % SIZES.length];
    App.penSize = next.sz;

    const ring = document.getElementById('fp-size-ring');
    const dot = document.getElementById('fp-size-dot');
    if (ring) ring.title = `Stroke Size: ${next.label} (click to cycle)`;
    if (dot) {
      dot.style.width = `${next.dot}px`;
      dot.style.height = `${next.dot}px`;
    }
    document.querySelectorAll('.pen-sz').forEach(b => {
      b.classList.toggle('active', b.title === `${next.sz}px`);
    });
  }

  function selectFlyoutColor(hex) {
    if (typeof App === 'undefined') return;
    App.setColor(hex);
    document.querySelectorAll('.fp-color-dot').forEach(d => {
      const isMatch = (d.dataset.hex && d.dataset.hex.toLowerCase() === hex.toLowerCase()) ||
                      (d.style.background && rgbToHex(d.style.background) === hex.toLowerCase());
      d.classList.toggle('active', isMatch);
    });
  }

  function clearDrawingStrokes() {
    if (typeof Drawing !== 'undefined' && Drawing.clearDrawings) {
      Drawing.clearDrawings();
    }
    const dc = document.getElementById('draw-canvas');
    if (dc) {
      const ctx = dc.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, dc.width, dc.height);
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Drawing strokes cleared');
    }
  }

  function filterShapesCategory(cat) {
    document.querySelectorAll('.fsc-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.cat === cat || t.getAttribute('onclick')?.includes(`'${cat}'`));
    });

    const searchInput = document.getElementById('fsc-search-input');
    if (searchInput) searchInput.value = '';

    const items = document.querySelectorAll('#shape-grid .shape-btn, #shape-grid .fsc-sec-hdr');
    items.forEach(el => {
      if (cat === 'all') {
        el.style.display = el.classList.contains('fsc-sec-hdr') ? 'flex' : 'flex';
      } else {
        const itemCat = el.dataset.cat;
        if (itemCat === cat) {
          el.style.display = el.classList.contains('fsc-sec-hdr') ? 'flex' : 'flex';
        } else {
          el.style.display = 'none';
        }
      }
    });
  }

  function searchShapes(query) {
    const q = (query || '').toLowerCase().trim();
    const items = document.querySelectorAll('#shape-grid .shape-btn');
    const hdrs = document.querySelectorAll('#shape-grid .fsc-sec-hdr');
    if (!q) {
      const activeTab = document.querySelector('.fsc-tab.active');
      const cat = activeTab ? activeTab.dataset.cat : 'all';
      filterShapesCategory(cat);
      return;
    }
    hdrs.forEach(h => h.style.display = 'none');
    items.forEach(b => {
      const title = (b.title || '').toLowerCase();
      const label = (b.querySelector('.sl')?.textContent || '').toLowerCase();
      const match = title.includes(q) || label.includes(q);
      b.style.display = match ? 'flex' : 'none';
    });
  }

  function rgbToHex(rgb) {
    if (!rgb) return '';
    if (rgb.startsWith('#')) return rgb.toLowerCase();
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return rgb;
    return '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join('').toLowerCase();
  }

  let activeShapesDomain = 'math';

  function renderQuickShelf(domain) {
    const shelf = document.getElementById('fsc-quick-shelf-container');
    if (!shelf) return;
    shelf.classList.remove('domain-physics', 'domain-science');
    if (domain === 'physics') shelf.classList.add('domain-physics');
    else if (domain === 'science') shelf.classList.add('domain-science');

    if (domain === 'math') {
      shelf.innerHTML = `
        <div class="fsc-shelf-header">
          <span class="fsc-shelf-title">⭐ QUICK MATH INSTRUMENTS &amp; LABS</span>
          <span class="fsc-shelf-tag">Live Tools</span>
        </div>
        <div class="fsc-quick-grid">
          <button class="fsc-quick-tool-btn" onclick="App.setTool('measure-line'); UI.closeShapesFlyout(); App.showToast('📏 Ruler: Drag between points to measure distance (cm)');" title="Ruler / Measured Line (cm)">
            <svg viewBox="0 0 32 32" fill="none"><line x1="4" y1="26" x2="28" y2="6" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round"/><circle cx="4" cy="26" r="2.5" fill="#0284c7"/><circle cx="28" cy="6" r="2.5" fill="#0284c7"/><rect x="11" y="11" width="10" height="7" rx="1.5" fill="#38bdf8" fill-opacity=".3"/><text x="16" y="16.5" text-anchor="middle" font-size="6" font-weight="bold" fill="#0284c7">cm</text></svg>
            <span class="qlabel">Ruler (cm)</span>
          </button>
          <button class="fsc-quick-tool-btn" onclick="App.setTool('compass'); UI.closeShapesFlyout(); App.showToast('🧭 Compass: Drag from center to draw circle with live radius');" title="Geometry Compass (r)">
            <svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#0284c7" stroke-width="1.8" stroke-dasharray="3,2" fill="#0284c7" fill-opacity=".08"/><line x1="16" y1="16" x2="27" y2="16" stroke="#eab308" stroke-width="1.5"/><circle cx="16" cy="16" r="2.2" fill="#ef4444"/><circle cx="27" cy="16" r="2" fill="#38bdf8"/><text x="21" y="13" font-size="6.5" font-weight="bold" fill="#eab308">r</text></svg>
            <span class="qlabel">Compass</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="MathVisualizer.show('unitcircle'); UI.closeShapesFlyout();" title="⭕ Unit Circle &amp; Sine Wave Visualizer">
            <svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" stroke="#0284c7" stroke-width="2" fill="none"/><line x1="16" y1="16" x2="23" y2="9" stroke="#eab308" stroke-width="2"/><circle cx="23" cy="9" r="2.5" fill="#ef4444"/><line x1="23" y1="9" x2="23" y2="16" stroke="#4ade80" stroke-width="1.5"/><line x1="16" y1="16" x2="23" y2="16" stroke="#38bdf8" stroke-width="1.8"/></svg>
            <span class="qlabel">Unit Circle</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="MathVisualizer.show('calculus'); UI.closeShapesFlyout();" title="∫ Calculus, Tangents &amp; Integrals">
            <svg viewBox="0 0 32 32" fill="none"><path d="M4,24 Q14,24 16,14 T28,4" stroke="#e8c96b" stroke-width="2" fill="none"/><line x1="8" y1="22" x2="24" y2="6" stroke="#f43f5e" stroke-width="1.8"/><rect x="11" y="15" width="4" height="9" fill="#38bdf8" fill-opacity=".3"/><rect x="15" y="11" width="4" height="13" fill="#38bdf8" fill-opacity=".3"/></svg>
            <span class="qlabel">Calculus</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="GraphEngine.show(); UI.closeShapesFlyout();" title="📈 Live Graphs &amp; Statistics (Line, Bar, Pie, Scatter, Stats)">
            <svg viewBox="0 0 32 32" fill="none"><polyline points="3,25 9,15 15,19 21,9 29,13" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="15" r="2.2" fill="#10b981"/><circle cx="15" cy="19" r="2.2" fill="#10b981"/><circle cx="21" cy="9" r="2.2" fill="#10b981"/><line x1="2" y1="28" x2="30" y2="28" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/></svg>
            <span class="qlabel">Live Graphs</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="MathVisualizer.show('geometry'); UI.closeShapesFlyout();" title="△ Dynamic Geometry Proofs (180° Sum, Pythagoras)">
            <svg viewBox="0 0 32 32" fill="none"><polygon points="16,4 28,26 4,26" stroke="#0284c7" stroke-width="2" fill="none"/><circle cx="16" cy="4" r="2.5" fill="#facc15"/><circle cx="28" cy="26" r="2.5" fill="#facc15"/><circle cx="4" cy="26" r="2.5" fill="#facc15"/><path d="M7,26 A8,8 0 0,0 12,23" stroke="#38bdf8" stroke-width="1.5" fill="none"/></svg>
            <span class="qlabel">Geo Proofs</span>
          </button>
        </div>`;
    } else if (domain === 'physics') {
      shelf.innerHTML = `
        <div class="fsc-shelf-header">
          <span class="fsc-shelf-title" style="color:#b45309;">⚡ QUICK PHYSICS SIMULATIONS</span>
          <span class="fsc-shelf-tag" style="background:#d97706;">Interactive</span>
        </div>
        <div class="fsc-quick-grid">
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="PhysicsLab.show('projectile'); UI.closeShapesFlyout();" title="🚀 Projectile Motion Lab">
            <svg viewBox="0 0 32 32" fill="none"><path d="M4,27 Q16,5 28,27" stroke="#d97706" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="10.5" r="3" fill="#f59e0b"/><line x1="2" y1="27" x2="30" y2="27" stroke="#78350f" stroke-width="1.8"/><circle cx="28" cy="27" r="2" fill="#ef4444"/></svg>
            <span class="qlabel">Projectile</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="PhysicsLab.show('pendulum'); UI.closeShapesFlyout();" title="⏱ Simple & Damped Pendulum">
            <svg viewBox="0 0 32 32" fill="none"><line x1="8" y1="4" x2="24" y2="4" stroke="#78350f" stroke-width="2"/><line x1="16" y1="4" x2="23" y2="21" stroke="#d97706" stroke-width="1.8"/><circle cx="23" cy="21" r="5" fill="#f59e0b" stroke="#78350f" stroke-width="1.2"/><path d="M11,21 Q16,25 21,21" stroke="#d97706" stroke-width="1" stroke-dasharray="2,2"/></svg>
            <span class="qlabel">Pendulum</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="PhysicsLab.show('collision'); UI.closeShapesFlyout();" title="💥 1D/2D Collisions Lab">
            <svg viewBox="0 0 32 32" fill="none"><line x1="2" y1="23" x2="30" y2="23" stroke="#78350f" stroke-width="1.8"/><rect x="4" y="13" width="9" height="7" rx="1.5" fill="#0284c7"/><rect x="19" y="13" width="9" height="7" rx="1.5" fill="#ea580c"/><circle cx="16" cy="16.5" r="3" fill="#eab308"/></svg>
            <span class="qlabel">Collision</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="PhysicsLab.show('incline'); UI.closeShapesFlyout();" title="📐 Inclined Plane & FBD">
            <svg viewBox="0 0 32 32" fill="none"><polygon points="4,26 28,26 28,10" stroke="#78350f" stroke-width="1.8" fill="#fef3c7"/><rect x="13" y="12" width="7" height="6" transform="rotate(-33 13 12)" fill="#0284c7"/><line x1="15" y1="13" x2="11" y2="7" stroke="#ef4444" stroke-width="1.5"/></svg>
            <span class="qlabel">Incline</span>
          </button>
          <button class="fsc-quick-tool-btn is-sim-btn" onclick="PhysicsLab.show('optics'); UI.closeShapesFlyout();" title="🔍 Optics & Thin Lens Ray Tracer">
            <svg viewBox="0 0 32 32" fill="none"><line x1="4" y1="16" x2="28" y2="16" stroke="#c9a84c" stroke-width="1.5"/><line x1="16" y1="4" x2="16" y2="28" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/><line x1="6" y1="8" x2="16" y2="16" stroke="#ef4444" stroke-width="1.8"/><line x1="16" y1="16" x2="24" y2="26" stroke="#38bdf8" stroke-width="1.8"/></svg>
            <span class="qlabel">Optics</span>
          </button>
        </div>`;
    } else {
      shelf.innerHTML = `
        <div class="fsc-shelf-header">
          <span class="fsc-shelf-title">⭐ QUICK SCIENCE INSTRUMENTS</span>
          <span class="fsc-shelf-tag" style="background:#10b981;">Science</span>
        </div>
        <div class="fsc-quick-grid">
          <button class="fsc-quick-tool-btn" onclick="Canvas.addShape('sc-battery'); UI.closeShapesFlyout();" title="Battery Source">
            <svg viewBox="0 0 32 32" fill="none"><line x1="4" y1="16" x2="28" y2="16" stroke="#10b981" stroke-width="1.5"/><line x1="10" y1="10" x2="10" y2="22" stroke="#10b981" stroke-width="2.5"/><line x1="16" y1="12" x2="16" y2="20" stroke="#10b981" stroke-width="1.5"/><line x1="22" y1="10" x2="22" y2="22" stroke="#10b981" stroke-width="2.5"/><line x1="26" y1="12" x2="26" y2="20" stroke="#10b981" stroke-width="1.5"/></svg>
            <span class="qlabel">Battery</span>
          </button>
          <button class="fsc-quick-tool-btn" onclick="Canvas.addShape('sc-bulb'); UI.closeShapesFlyout();" title="Light Bulb">
            <svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="14" r="9" stroke="#10b981" stroke-width="1.5" fill="#10b981" fill-opacity=".1"/><line x1="12" y1="11" x2="20" y2="17" stroke="#10b981" stroke-width="1.2"/><line x1="20" y1="11" x2="12" y2="17" stroke="#10b981" stroke-width="1.2"/><line x1="13" y1="23" x2="19" y2="23" stroke="#10b981" stroke-width="1.5"/><line x1="14" y1="26" x2="18" y2="26" stroke="#10b981" stroke-width="1.5"/></svg>
            <span class="qlabel">Bulb</span>
          </button>
          <button class="fsc-quick-tool-btn" onclick="Canvas.addShape('sc-resistor'); UI.closeShapesFlyout();" title="Resistor">
            <svg viewBox="0 0 32 32" fill="none"><line x1="2" y1="16" x2="7" y2="16" stroke="#10b981" stroke-width="1.5"/><rect x="7" y="11" width="18" height="10" stroke="#10b981" stroke-width="1.5" fill="#10b981" fill-opacity=".12"/><line x1="25" y1="16" x2="30" y2="16" stroke="#10b981" stroke-width="1.5"/></svg>
            <span class="qlabel">Resistor</span>
          </button>
          <button class="fsc-quick-tool-btn" onclick="Canvas.addShape('sc-bar-magnet'); UI.closeShapesFlyout();" title="Bar Magnet (N-S)">
            <svg viewBox="0 0 32 32" fill="none"><rect x="2" y="11" width="28" height="10" rx="2" stroke="#10b981" stroke-width="1.5" fill="none"/><rect x="2" y="11" width="14" height="10" fill="#10b981" fill-opacity=".3"/><text x="9" y="19" text-anchor="middle" font-size="8" fill="#10b981" font-weight="700">N</text><text x="23" y="19" text-anchor="middle" font-size="8" fill="#10b981">S</text></svg>
            <span class="qlabel">Magnet</span>
          </button>
          <button class="fsc-quick-tool-btn" onclick="Canvas.addShape('sc-beaker'); UI.closeShapesFlyout();" title="Lab Beaker">
            <svg viewBox="0 0 32 32" fill="none"><path d="M8,4 L8,22 Q8,28 16,28 Q24,28 24,22 L24,4" stroke="#10b981" stroke-width="1.5" fill="#10b981" fill-opacity=".1"/><line x1="6" y1="4" x2="26" y2="4" stroke="#10b981" stroke-width="2"/></svg>
            <span class="qlabel">Beaker</span>
          </button>
        </div>`;
    }
  }

  function renderShapesTabs(domain) {
    const tabsCont = document.getElementById('fsc-tabs-container');
    if (!tabsCont) return;
    if (domain === 'math') {
      tabsCont.innerHTML = `
        <button class="fsc-tab active" data-cat="all" onclick="UI.filterShapesCategory('all')">All</button>
        <button class="fsc-tab" data-cat="labs" onclick="UI.filterShapesCategory('labs')">⭐ Visual Labs</button>
        <button class="fsc-tab" data-cat="tools" onclick="UI.filterShapesCategory('tools')">📐 Tools</button>
        <button class="fsc-tab" data-cat="2d" onclick="UI.filterShapesCategory('2d')">🔷 2D Shapes</button>
        <button class="fsc-tab" data-cat="3d" onclick="UI.filterShapesCategory('3d')">🧊 3D Solids</button>
        <button class="fsc-tab" data-cat="lines" onclick="UI.filterShapesCategory('lines')">↗️ Lines</button>
      `;
    } else if (domain === 'physics') {
      tabsCont.innerHTML = `
        <button class="fsc-tab active" data-cat="all" onclick="UI.filterShapesCategory('all')">All</button>
        <button class="fsc-tab" data-cat="mechanics" onclick="UI.filterShapesCategory('mechanics')">🚀 Mechanics</button>
        <button class="fsc-tab" data-cat="oscillations" onclick="UI.filterShapesCategory('oscillations')">⏱ Oscillations</button>
        <button class="fsc-tab" data-cat="optics" onclick="UI.filterShapesCategory('optics')">🔍 Optics</button>
        <button class="fsc-tab" data-cat="circuits" onclick="UI.filterShapesCategory('circuits')">⚡ E&M</button>
        <button class="fsc-tab" data-cat="thermo" onclick="UI.filterShapesCategory('thermo')">🔥 Thermo</button>
      `;
    } else {
      tabsCont.innerHTML = `
        <button class="fsc-tab active" data-cat="all" onclick="UI.filterShapesCategory('all')">All</button>
        <button class="fsc-tab" data-cat="circuits" onclick="UI.filterShapesCategory('circuits')">⚡ Circuits</button>
        <button class="fsc-tab" data-cat="physics" onclick="UI.filterShapesCategory('physics')">⚙ Physics</button>
        <button class="fsc-tab" data-cat="optics" onclick="UI.filterShapesCategory('optics')">🔍 Optics</button>
        <button class="fsc-tab" data-cat="bio" onclick="UI.filterShapesCategory('bio')">🧬 Biology</button>
        <button class="fsc-tab" data-cat="chem" onclick="UI.filterShapesCategory('chem')">🧪 Chemistry</button>
        <button class="fsc-tab" data-cat="earth" onclick="UI.filterShapesCategory('earth')">🌍 Earth</button>
      `;
    }
  }

  function switchShapesDomain(domain) {
    activeShapesDomain = domain || 'math';
    const btnMath = document.getElementById('fsc-btn-math');
    const btnSci = document.getElementById('fsc-btn-science');
    const btnPhys = document.getElementById('fsc-btn-physics');
    if (btnMath) btnMath.classList.toggle('active', activeShapesDomain === 'math');
    if (btnSci) btnSci.classList.toggle('active', activeShapesDomain === 'science');
    if (btnPhys) btnPhys.classList.toggle('active', activeShapesDomain === 'physics');

    renderQuickShelf(activeShapesDomain);
    renderShapesTabs(activeShapesDomain);
    buildShapeGrid();

    const searchInput = document.getElementById('fsc-search-input');
    if (searchInput) searchInput.value = '';
  }

  // ─────────────────────────────────────────────
  function buildShapeGrid() {
    const grid = document.getElementById('shape-grid');
    if (!grid) return;

    // Flyout header indicator
    const fscTitle = document.getElementById('fsc-title-text');
    const fscIcon = document.getElementById('fsc-subject-icon');
    if (fscTitle) fscTitle.textContent = activeShapesDomain === 'physics' ? 'Physics' : (activeShapesDomain === 'science' ? 'Science' : 'Shapes');
    if (fscIcon) fscIcon.textContent = activeShapesDomain === 'physics' ? '⚡' : (activeShapesDomain === 'science' ? '🔬' : '🔷');

    const MATH_SECTIONS = [
      {
        label: '⭐ Interactive Visual Math Labs',
        cat: 'labs',
        shapes: [
          { isGraphTool: true, t:'tool-graphs', l:'Live Graphs', desc:'Line, Bar, Pie, Scatter & Statistics', svg:'<polyline points="3,25 9,15 15,19 21,9 29,13" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="15" r="2.2" fill="#10b981"/><circle cx="15" cy="19" r="2.2" fill="#10b981"/><circle cx="21" cy="9" r="2.2" fill="#10b981"/><line x1="2" y1="28" x2="30" y2="28" stroke="currentColor" stroke-width="1.5"/>' },
          { isMathLab: true, modId: 'unitcircle', t:'lab-unitcircle', l:'Unit Circle', desc:'Trig Coordinates & Live Sine Wave', svg:'<circle cx="16" cy="16" r="11" stroke="#0284c7" stroke-width="2" fill="none"/><line x1="16" y1="16" x2="24" y2="9" stroke="#eab308" stroke-width="2"/><circle cx="24" cy="9" r="2.5" fill="#ef4444"/><line x1="24" y1="9" x2="24" y2="16" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="2,1"/><line x1="16" y1="16" x2="24" y2="16" stroke="#38bdf8" stroke-width="1.8"/>' },
          { isMathLab: true, modId: 'calculus',   t:'lab-calculus',   l:'Calculus Lab', desc:'Tangents, Derivatives & Integrals', svg:'<path d="M4,24 Q14,24 16,14 T28,4" stroke="#e8c96b" stroke-width="2" fill="none"/><line x1="8" y1="22" x2="24" y2="6" stroke="#f43f5e" stroke-width="1.8"/><rect x="11" y="15" width="4" height="9" fill="#38bdf8" fill-opacity=".3"/><rect x="15" y="11" width="4" height="13" fill="#38bdf8" fill-opacity=".3"/>' },
          { isMathLab: true, modId: 'geometry',   t:'lab-geometry',   l:'Geometry Proofs', desc:'180° Sum, Circle Angle, Pythagoras', svg:'<polygon points="16,4 28,26 4,26" stroke="#c9a84c" stroke-width="2" fill="currentColor" fill-opacity=".08"/><circle cx="16" cy="4" r="2.5" fill="#facc15"/><circle cx="28" cy="26" r="2.5" fill="#facc15"/><circle cx="4" cy="26" r="2.5" fill="#facc15"/><path d="M7,26 A8,8 0 0,0 12,23" stroke="#38bdf8" stroke-width="1.5" fill="none"/>' },
          { isMathLab: true, modId: 'vectors',    t:'lab-vectors',    l:'Vectors 2D', desc:'Vector Addition & Parallelogram', svg:'<line x1="6" y1="24" x2="24" y2="8" stroke="#facc15" stroke-width="2.2"/><polygon points="24,8 18,9 23,14" fill="#facc15"/><line x1="6" y1="24" x2="22" y2="24" stroke="#38bdf8" stroke-width="1.8"/><line x1="6" y1="24" x2="10" y2="10" stroke="#4ade80" stroke-width="1.8"/>' },
          { isMathLab: true, modId: 'sequences',  t:'lab-sequences',  l:'Sequences ∑', desc:'Arithmetic & Geometric Series', svg:'<line x1="4" y1="26" x2="28" y2="26" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="22" r="2" fill="#e8c96b"/><circle cx="13" cy="18" r="2" fill="#e8c96b"/><circle cx="18" cy="13" r="2" fill="#e8c96b"/><circle cx="23" cy="7" r="2" fill="#e8c96b"/><line x1="8" y1="22" x2="23" y2="7" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="2,2"/>' },
          { isMathLab: true, modId: 'transforms', t:'lab-transforms', l:'Transforms ↻', desc:'Rotations, Scale & Reflections', svg:'<polygon points="16,8 24,22 8,22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2" fill="none"/><polygon points="22,14 26,24 12,20" stroke="#e8c96b" stroke-width="2" fill="#c9a84c" fill-opacity=".2"/><path d="M22,6 A10,10 0 0,1 26,14" stroke="#38bdf8" stroke-width="1.5" fill="none"/>' }
        ]
      },
      {
        label: '📐 Geometry Instruments',
        cat: 'tools',
        shapes: [
          { t:'measure-line',  l:'Ruler (cm)',    isTool: true, svg:'<line x1="4" y1="26" x2="28" y2="6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="4" cy="26" r="2.5" fill="currentColor"/><circle cx="28" cy="6" r="2.5" fill="currentColor"/><rect x="11" y="11" width="10" height="7" rx="1.5" fill="#38bdf8" fill-opacity=".3"/><text x="16" y="16.5" text-anchor="middle" font-size="6" font-weight="bold" fill="currentColor">cm</text>' },
          { t:'compass',       l:'Compass (r)',   isTool: true, svg:'<circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3,2" fill="currentColor" fill-opacity=".08"/><line x1="16" y1="16" x2="27" y2="16" stroke="#eab308" stroke-width="1.5"/><circle cx="16" cy="16" r="2.2" fill="#ef4444"/><circle cx="27" cy="16" r="2" fill="#38bdf8"/><text x="21" y="13" font-size="6.5" font-weight="bold" fill="#eab308">r</text></svg>' },
          { t:'measure-angle', l:'Angle (θ°)',    isTool: true, svg:'<line x1="4" y1="26" x2="28" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="26" x2="24" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14,26 A10,10 0 0,0 12,18" stroke="#f59e0b" stroke-width="1.8" fill="none"/><text x="17" y="19" font-size="7" font-weight="bold" fill="#f59e0b">θ°</text>' },
          { t:'protractor',    l:'Protractor',    svg:'<path d="M4,20 A12,12 0 0,1 28,20 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><line x1="4" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="20" x2="16" y2="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>' },
          { t:'number-line',   l:'Number Line',   svg:'<line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="2.5"/><line x1="10" y1="11" x2="10" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="11" x2="16" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="11" x2="22" y2="21" stroke="currentColor" stroke-width="1.5"/>' },
        ]
      },
      {
        label: '2D Shapes',
        cat: '2d',
        shapes: [
          { t:'rectangle',     l:'Rectangle',   svg:'<rect x="2" y="6" width="28" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'square',        l:'Square',      svg:'<rect x="5" y="5" width="22" height="22" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'circle',        l:'Circle',      svg:'<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'triangle',      l:'Triangle',    svg:'<polygon points="16,3 30,29 2,29" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'equilateral',   l:'Equilat.',    svg:'<polygon points="16,2 30,28 2,28" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/>' },
          { t:'rightTriangle', l:'Right Tri.',  svg:'<polygon points="2,2 2,30 30,30" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"></polygon><rect x="2" y="17" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2"/>' },
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
        label: '3D Solids',
        cat: '3d',
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
        label: 'Lines & Rays',
        cat: 'lines',
        shapes: [
          { t:'line',          l:'Line',        svg:'<line x1="4" y1="28" x2="28" y2="4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
          { t:'dashed',        l:'Dashed',      svg:'<line x1="4" y1="28" x2="28" y2="4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="4,3"/>' },
          { t:'dotted',        l:'Dotted',      svg:'<line x1="4" y1="28" x2="28" y2="4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="0.5,4"/>' },
          { t:'arrow',         l:'Arrow',       svg:'<line x1="4" y1="28" x2="28" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polygon points="28,4 20,5 27,12" fill="currentColor"/>' },
          { t:'dbl-arrow',     l:'Double Arrow',svg:'<line x1="4" y1="28" x2="28" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polygon points="28,4 20,5 27,12" fill="currentColor"/><polygon points="4,28 12,27 5,20" fill="currentColor"/>' },
        ]
      }
    ];

    const SCIENCE_SECTIONS = [
      {
        label: '⚡ Circuit Schematics',
        cat: 'circuits',
        shapes: [
          { t:'sc-battery',       l:'Battery',      svg:'<line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="10" x2="10" y2="22" stroke="currentColor" stroke-width="2.5"/><line x1="16" y1="12" x2="16" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/><line x1="26" y1="12" x2="26" y2="20" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-resistor',      l:'Resistor',     svg:'<line x1="2" y1="16" x2="7" y2="16" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="11" width="18" height="10" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".12"/><line x1="25" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-bulb',          l:'Bulb',         svg:'<circle cx="16" cy="14" r="9" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><line x1="12" y1="11" x2="20" y2="17" stroke="currentColor" stroke-width="1.2"/><line x1="20" y1="11" x2="12" y2="17" stroke="currentColor" stroke-width="1.2"/><line x1="13" y1="23" x2="19" y2="23" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="26" x2="18" y2="26" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-ammeter',       l:'Ammeter',      svg:'<circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".08"/><text x="16" y="20" text-anchor="middle" font-size="10" fill="currentColor" font-weight="700">A</text>' },
          { t:'sc-voltmeter',     l:'Voltmeter',    svg:'<circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".08"/><text x="16" y="20" text-anchor="middle" font-size="10" fill="currentColor" font-weight="700">V</text>' },
          { t:'sc-switch-open',   l:'Switch (O)',   svg:'<line x1="2" y1="20" x2="10" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="20" x2="30" y2="20" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="20" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="20" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="20" x2="20" y2="12" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-switch-closed', l:'Switch (C)',   svg:'<line x1="2" y1="20" x2="10" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="20" x2="30" y2="20" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="20" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="22" cy="20" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="10" y1="20" x2="22" y2="20" stroke="currentColor" stroke-width="2"/>' },
          { t:'sc-ground',        l:'Ground',       svg:'<line x1="16" y1="4" x2="16" y2="18" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="18" x2="26" y2="18" stroke="currentColor" stroke-width="2"/><line x1="10" y1="22" x2="22" y2="22" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="26" x2="19" y2="26" stroke="currentColor" stroke-width="1.2"/>' },
        ]
      },
      {
        label: '⚙ Physics & Vectors',
        cat: 'physics',
        shapes: [
          { t:'sc-force-vector',  l:'Force Vec.',   svg:'<line x1="4" y1="16" x2="26" y2="16" stroke="currentColor" stroke-width="2"/><polygon points="26,16 20,12 20,20" fill="currentColor"/><text x="14" y="11" text-anchor="middle" font-size="8" fill="currentColor">F</text>' },
          { t:'sc-motion-arrow',  l:'Velocity',     svg:'<path d="M4,16 C10,8 20,8 26,16" stroke="currentColor" stroke-width="1.8" fill="none" stroke-dasharray="3,2"/><polygon points="27,16 21,13 22,19" fill="currentColor"/><text x="16" y="24" text-anchor="middle" font-size="8" fill="currentColor">v</text>' },
          { t:'sc-pulley',        l:'Pulley',       svg:'<circle cx="16" cy="11" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="9" y1="11" x2="9" y2="28" stroke="currentColor" stroke-width="1.2"/><line x1="23" y1="11" x2="23" y2="24" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="25" width="8" height="6" stroke="currentColor" stroke-width="1" fill="currentColor" fill-opacity=".2"/>' },
          { t:'sc-free-body',     l:'Free Body',    svg:'<circle cx="16" cy="16" r="5" fill="currentColor" fill-opacity=".3"/><line x1="16" y1="4" x2="16" y2="11" stroke="currentColor" stroke-width="1.5"/><polygon points="16,3 13,9 19,9" fill="currentColor"/><line x1="16" y1="21" x2="16" y2="29" stroke="currentColor" stroke-width="1.5"/><polygon points="16,30 13,24 19,24" fill="currentColor"/><line x1="4" y1="16" x2="11" y2="16" stroke="currentColor" stroke-width="1.5"/><polygon points="3,16 9,13 9,19" fill="currentColor"/>' },
          { t:'sc-bar-magnet',    l:'Magnet',       svg:'<rect x="2" y="11" width="28" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="2" y="11" width="14" height="10" fill="currentColor" fill-opacity=".3"/><text x="9" y="19" text-anchor="middle" font-size="8" fill="currentColor" font-weight="700">N</text><text x="23" y="19" text-anchor="middle" font-size="8" fill="currentColor">S</text>' },
          { t:'sc-compass',       l:'Compass',      svg:'<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="16,6 19,16 16,14 13,16" fill="currentColor"/><polygon points="16,26 19,16 16,14 13,16" fill="currentColor" fill-opacity=".3"/>' },
        ]
      },
      {
        label: '🔍 Optics & Waves',
        cat: 'optics',
        shapes: [
          { t:'sc-convex-lens',   l:'Conv.Lens',    svg:'<path d="M16,4 Q26,16 16,28 Q6,16 16,4" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".12"/><line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1" stroke-dasharray="3,2"/>' },
          { t:'sc-concave-lens',  l:'Conc.Lens',    svg:'<path d="M12,4 Q18,16 12,28" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M20,4 Q14,16 20,28" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1" stroke-dasharray="3,2"/>' },
          { t:'sc-optical-ray',   l:'Light Ray',    svg:'<line x1="3" y1="16" x2="27" y2="16" stroke="currentColor" stroke-width="2"/><polygon points="18,16 13,12 13,20" fill="currentColor"/>' },
        ]
      },
      {
        label: '🧬 Biology & Cells',
        cat: 'bio',
        shapes: [
          { t:'sc-plant-cell',    l:'Plant Cell',   svg:'<rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".08"/><ellipse cx="16" cy="16" rx="6" ry="5" stroke="currentColor" stroke-width="1.2" fill="currentColor" fill-opacity=".2"/>' },
          { t:'sc-animal-cell',   l:'Animal Cell',  svg:'<ellipse cx="16" cy="16" rx="12" ry="11" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".08"/><ellipse cx="16" cy="16" rx="5" ry="4" stroke="currentColor" stroke-width="1.2" fill="currentColor" fill-opacity=".2"/>' },
          { t:'sc-nucleus',       l:'Nucleus',      svg:'<circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2" fill="currentColor" fill-opacity=".15"/><circle cx="16" cy="16" r="4" fill="currentColor"/>' },
          { t:'sc-label-pointer', l:'Pointer',      svg:'<circle cx="6" cy="16" r="2.5" fill="currentColor"/><line x1="8" y1="16" x2="19" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="19" y1="16" x2="26" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="9" x2="30" y2="9" stroke="currentColor" stroke-width="1.5"/>' },
        ]
      },
      {
        label: '🧪 Chemistry & Lab',
        cat: 'chem',
        shapes: [
          { t:'sc-test-tube',     l:'Test Tube',    svg:'<path d="M12,4 L12,22 A4,4 0 0,0 20,22 L20,4" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><line x1="10" y1="4" x2="22" y2="4" stroke="currentColor" stroke-width="2"/><line x1="12" y1="15" x2="20" y2="15" stroke="currentColor" stroke-width="1" stroke-dasharray="2,1"/>' },
          { t:'sc-beaker',        l:'Beaker',       svg:'<path d="M8,4 L8,22 Q8,28 16,28 Q24,28 24,22 L24,4" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><line x1="6" y1="4" x2="26" y2="4" stroke="currentColor" stroke-width="2"/>' },
          { t:'sc-erlenmeyer',    l:'Flask',        svg:'<polygon points="13,4 19,4 27,26 5,26" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><line x1="11" y1="4" x2="21" y2="4" stroke="currentColor" stroke-width="2"/>' },
          { t:'sc-bunsen',        l:'Bunsen',       svg:'<line x1="16" y1="12" x2="16" y2="26" stroke="currentColor" stroke-width="3"/><line x1="8" y1="26" x2="24" y2="26" stroke="currentColor" stroke-width="2.5"/><path d="M16,12 Q19,6 16,2 Q13,6 16,12 Z" fill="currentColor" fill-opacity=".4"/>' },
          { t:'sc-atom-bohr',     l:'Bohr Atom',    svg:'<circle cx="16" cy="16" r="4" fill="currentColor" fill-opacity=".4"/><ellipse cx="16" cy="16" rx="14" ry="5" stroke="currentColor" stroke-width="1.2" fill="none"/><ellipse cx="16" cy="16" rx="14" ry="5" stroke="currentColor" stroke-width="1.2" fill="none" transform="rotate(60 16 16)"/><ellipse cx="16" cy="16" rx="14" ry="5" stroke="currentColor" stroke-width="1.2" fill="none" transform="rotate(120 16 16)"/>' },
        ]
      },
      {
        label: '🌍 Earth & Universe',
        cat: 'earth',
        shapes: [
          { t:'sc-earth',         l:'Earth',        svg:'<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><ellipse cx="16" cy="16" rx="12" ry="4" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2" fill="none"/><line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" stroke-width="1"/>' },
          { t:'sc-orbit',         l:'Orbit',        svg:'<ellipse cx="16" cy="16" rx="14" ry="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2" fill="none"/><circle cx="16" cy="16" r="3.5" fill="currentColor"/><circle cx="28" cy="13" r="2" fill="currentColor"/>' },
        ]
      }
    ];

    const PHYSICS_SECTIONS = [
      {
        label: '🚀 Mechanics & Kinematics',
        cat: 'mechanics',
        shapes: [
          { isSim: true, simId: 'projectile', t:'sim-projectile', l:'Projectile Lab', desc:'Trajectory, Drag & Apex', svg:'<path d="M4,27 Q16,5 28,27" stroke="#d97706" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="10.5" r="3.5" fill="#f59e0b"/><line x1="2" y1="27" x2="30" y2="27" stroke="currentColor" stroke-width="1.8"/><circle cx="28" cy="27" r="2" fill="#ef4444"/>' },
          { isSim: true, simId: 'pendulum', t:'sim-pendulum', l:'Pendulum Lab', desc:'Simple & Damped Harmonic', svg:'<line x1="8" y1="4" x2="24" y2="4" stroke="currentColor" stroke-width="2.2"/><line x1="16" y1="4" x2="24" y2="21" stroke="#d97706" stroke-width="2"/><circle cx="24" cy="21" r="5.5" fill="#f59e0b" stroke="currentColor" stroke-width="1.2"/><path d="M10,21 Q16,25 22,21" stroke="#d97706" stroke-width="1.2" stroke-dasharray="2,2"/>' },
          { isSim: true, simId: 'collision', t:'sim-collision', l:'Collisions 1D', desc:'Momentum & Restitution', svg:'<line x1="2" y1="23" x2="30" y2="23" stroke="currentColor" stroke-width="2"/><rect x="4" y="13" width="9" height="7" rx="1.5" fill="#0284c7"/><rect x="19" y="13" width="9" height="7" rx="1.5" fill="#ea580c"/><circle cx="16" cy="16.5" r="3" fill="#eab308"/><line x1="6" y1="9" x2="11" y2="9" stroke="#0284c7" stroke-width="1.5"/><line x1="26" y1="9" x2="21" y2="9" stroke="#ea580c" stroke-width="1.5"/>' },
          { isSim: true, simId: 'incline', t:'sim-incline', l:'Incline & FBD', desc:'Gravity, Friction & Slopes', svg:'<polygon points="4,26 28,26 28,10" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".12"/><rect x="13" y="12" width="8" height="6" rx="1" transform="rotate(-33 13 12)" fill="#0284c7"/><line x1="15" y1="13" x2="11" y2="7" stroke="#ef4444" stroke-width="1.8"/>' },
          { t:'sc-force-vector',  l:'Force Vector', svg:'<line x1="4" y1="16" x2="26" y2="16" stroke="currentColor" stroke-width="2"/><polygon points="26,16 20,12 20,20" fill="currentColor"/><text x="14" y="11" text-anchor="middle" font-size="8" fill="currentColor">F</text>' },
          { t:'sc-motion-arrow',  l:'Velocity',     svg:'<path d="M4,16 C10,8 20,8 26,16" stroke="currentColor" stroke-width="1.8" fill="none" stroke-dasharray="3,2"/><polygon points="27,16 21,13 22,19" fill="currentColor"/><text x="16" y="24" text-anchor="middle" font-size="8" fill="currentColor">v</text>' },
          { t:'sc-free-body',     l:'Free Body',    svg:'<circle cx="16" cy="16" r="5" fill="currentColor" fill-opacity=".3"/><line x1="16" y1="4" x2="16" y2="11" stroke="currentColor" stroke-width="1.5"/><polygon points="16,3 13,9 19,9" fill="currentColor"/><line x1="16" y1="21" x2="16" y2="29" stroke="currentColor" stroke-width="1.5"/><polygon points="16,30 13,24 19,24" fill="currentColor"/><line x1="4" y1="16" x2="11" y2="16" stroke="currentColor" stroke-width="1.5"/><polygon points="3,16 9,13 9,19" fill="currentColor"/>' },
          { t:'sc-pulley',        l:'Pulley Sys',   svg:'<circle cx="16" cy="11" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="9" y1="11" x2="9" y2="28" stroke="currentColor" stroke-width="1.2"/><line x1="23" y1="11" x2="23" y2="24" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="25" width="8" height="6" stroke="currentColor" stroke-width="1" fill="currentColor" fill-opacity=".2"/>' },
        ]
      },
      {
        label: '🌊 Waves & Superposition',
        cat: 'oscillations',
        shapes: [
          { isSim: true, simId: 'waves', t:'sim-waves', l:'Waves Lab', desc:'Standing & Traveling Harmonics', svg:'<path d="M3,16 Q9,6 16,16 T29,16" stroke="#38bdf8" stroke-width="2.5" fill="none"/><circle cx="3" cy="16" r="2.5" fill="#ef4444"/><circle cx="16" cy="16" r="2.5" fill="#ef4444"/><circle cx="29" cy="16" r="2.5" fill="#ef4444"/><circle cx="9.5" cy="11" r="2" fill="#4ade80"/><circle cx="22.5" cy="21" r="2" fill="#4ade80"/>' },
          { t:'sc-compass',       l:'Compass',      svg:'<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="16,6 19,16 16,14 13,16" fill="currentColor"/><polygon points="16,26 19,16 16,14 13,16" fill="currentColor" fill-opacity=".3"/>' },
        ]
      },
      {
        label: '🔍 Optics & Snell\'s Law',
        cat: 'optics',
        shapes: [
          { isSim: true, simId: 'optics', t:'sim-optics', l:'Optics Lab', desc:'Refraction & Thin Lens Tracer', svg:'<line x1="4" y1="16" x2="28" y2="16" stroke="#c9a84c" stroke-width="2"/><line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2,2"/><line x1="6" y1="7" x2="16" y2="16" stroke="#ef4444" stroke-width="2.2"/><line x1="16" y1="16" x2="25" y2="27" stroke="#38bdf8" stroke-width="2.2"/><circle cx="16" cy="16" r="2.5" fill="#facc15"/>' },
          { t:'sc-convex-lens',   l:'Conv.Lens',    svg:'<path d="M16,4 Q26,16 16,28 Q6,16 16,4" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".12"/><line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1" stroke-dasharray="3,2"/>' },
          { t:'sc-concave-lens',  l:'Conc.Lens',    svg:'<path d="M12,4 Q18,16 12,28" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M20,4 Q14,16 20,28" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1" stroke-dasharray="3,2"/>' },
          { t:'sc-optical-ray',   l:'Light Ray',    svg:'<line x1="3" y1="16" x2="27" y2="16" stroke="currentColor" stroke-width="2"/><polygon points="18,16 13,12 13,20" fill="currentColor"/>' },
        ]
      },
      {
        label: '⚡ Electricity & Lorentz Force',
        cat: 'circuits',
        shapes: [
          { isSim: true, simId: 'circuits', t:'sim-circuits', l:'Circuits Lab', desc:'Ohm\'s Law & B-Field Motion', svg:'<rect x="5" y="7" width="22" height="18" rx="2" stroke="#64748b" stroke-width="2" fill="none"/><line x1="12" y1="7" x2="14" y2="4" stroke="#e8c96b" stroke-width="2"/><line x1="14" y1="4" x2="18" y2="10" stroke="#e8c96b" stroke-width="2"/><line x1="18" y1="10" x2="20" y2="7" stroke="#e8c96b" stroke-width="2"/><circle cx="16" cy="25" r="2.5" fill="#38bdf8"/>' },
          { t:'sc-battery',       l:'Battery',      svg:'<line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="10" x2="10" y2="22" stroke="currentColor" stroke-width="2.5"/><line x1="16" y1="12" x2="16" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/><line x1="26" y1="12" x2="26" y2="20" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-resistor',      l:'Resistor',     svg:'<line x1="2" y1="16" x2="7" y2="16" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="11" width="18" height="10" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".12"/><line x1="25" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-bulb',          l:'Bulb',         svg:'<circle cx="16" cy="14" r="9" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><line x1="12" y1="11" x2="20" y2="17" stroke="currentColor" stroke-width="1.2"/><line x1="20" y1="11" x2="12" y2="17" stroke="currentColor" stroke-width="1.2"/><line x1="13" y1="23" x2="19" y2="23" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="26" x2="18" y2="26" stroke="currentColor" stroke-width="1.5"/>' },
          { t:'sc-bar-magnet',    l:'Bar Magnet',   svg:'<rect x="2" y="11" width="28" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="2" y="11" width="14" height="10" fill="currentColor" fill-opacity=".3"/><text x="9" y="19" text-anchor="middle" font-size="8" fill="currentColor" font-weight="700">N</text><text x="23" y="19" text-anchor="middle" font-size="8" fill="currentColor">S</text>' },
        ]
      },
      {
        label: '🔥 Thermodynamics & Gas Laws',
        cat: 'thermo',
        shapes: [
          { isSim: true, simId: 'thermodynamics', t:'sim-thermodynamics', l:'Thermo Lab', desc:'Kinetic Gas & P-V Chamber', svg:'<rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".08"/><line x1="20" y1="6" x2="20" y2="26" stroke="#c9a84c" stroke-width="2.5"/><circle cx="10" cy="12" r="2" fill="#ef4444"/><circle cx="15" cy="19" r="2" fill="#38bdf8"/><circle cx="8" cy="21" r="2" fill="#facc15"/><circle cx="13" cy="9" r="2" fill="#4ade80"/>' },
          { t:'sc-bunsen',        l:'Bunsen',       svg:'<line x1="16" y1="12" x2="16" y2="26" stroke="currentColor" stroke-width="3"/><line x1="8" y1="26" x2="24" y2="26" stroke="currentColor" stroke-width="2.5"/><path d="M16,12 Q19,6 16,2 Q13,6 16,12 Z" fill="currentColor" fill-opacity=".4"/>' },
          { t:'sc-erlenmeyer',    l:'Flask',        svg:'<polygon points="13,4 19,4 27,26 5,26" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity=".1"/><line x1="11" y1="4" x2="21" y2="4" stroke="currentColor" stroke-width="2"/>' },
        ]
      }
    ];

    const SECTIONS = activeShapesDomain === 'physics'
      ? PHYSICS_SECTIONS
      : (activeShapesDomain === 'science' ? SCIENCE_SECTIONS : MATH_SECTIONS);

    grid.innerHTML = '';
    SECTIONS.forEach(sec => {
      // Section label
      const lbl = document.createElement('div');
      lbl.className = 'fsc-sec-hdr';
      lbl.dataset.cat = sec.cat || (activeShapesDomain === 'physics' ? 'mechanics' : (activeShapesDomain === 'science' ? 'circuits' : '2d'));
      lbl.innerHTML = `<span>${sec.label}</span><span class="fsc-badge">${sec.shapes.length}</span>`;
      grid.appendChild(lbl);

      sec.shapes.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'shape-btn';
        if (s.isTool) btn.classList.add('is-tool-btn');
        if (s.isSim || s.isMathLab) btn.classList.add('is-sim-btn');
        btn.dataset.cat = sec.cat || (activeShapesDomain === 'physics' ? 'mechanics' : (activeShapesDomain === 'science' ? 'circuits' : '2d'));
        btn.title = s.l + (s.desc ? ` - ${s.desc}` : '');
        btn.innerHTML = `<svg viewBox="0 0 32 32" fill="none" style="color:currentColor">${s.svg}</svg><span class="sl">${s.l}</span>`;
        btn.addEventListener('click', () => {
          if (s.isGraphTool) {
            if (typeof GraphEngine !== 'undefined' && GraphEngine.show) {
              GraphEngine.show();
              UI.closeShapesFlyout();
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('📈 Opened Live Graphs & Statistics!');
              }
            }
          } else if (s.isMathLab) {
            if (typeof MathVisualizer !== 'undefined' && MathVisualizer.show) {
              MathVisualizer.show(s.modId);
              UI.closeShapesFlyout();
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`📐 Opened ${s.l}!`);
              }
            }
          } else if (s.isSim) {
            if (typeof PhysicsLab !== 'undefined' && PhysicsLab.show) {
              PhysicsLab.show(s.simId);
              UI.closeShapesFlyout();
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`⚡ Opened ${s.l} simulation!`);
              }
            }
          } else if (s.isTool) {
            if (typeof App !== 'undefined' && App.setTool) {
              App.setTool(s.t);
              UI.closeShapesFlyout();
              if (s.t === 'measure-line') App.showToast('📏 Measured Line: Drag between points (snaps to vertices)');
              else if (s.t === 'measure-angle') App.showToast('📐 Angle Tool: Click Vertex, then 2 arms');
              else if (s.t === 'compass') App.showToast('🧭 Compass: Drag from center to draw circle/arc');
            }
          } else {
            Canvas.addShape(s.t);
          }
        });
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
    if (pal) {
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
    }
    const cc = document.getElementById('custom-color');
    if (cc) cc.addEventListener('input', e => App.setColor(e.target.value));
  }

  // ─────────────────────────────────────────────
  function buildPenSizes() {
    const wrap = document.getElementById('pen-sizes');
    if (wrap) {
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

    // Edit Text button for text blocks
    if (shape.type === 'text-block') {
      const editBtn = document.createElement('button');
      editBtn.innerHTML = `
        <svg viewBox="0 0 18 18" fill="none" style="width:13px;height:13px">
          <path d="M13 2.5l2.5 2.5L5 15H2.5v-2.5L13 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        Edit Text Content`;
      editBtn.style.cssText = `
        width:100%;margin-top:10px;padding:8px 12px;
        border-radius:6px;border:1px solid rgba(201,168,76,.4);
        background:rgba(201,168,76,.12);color:#e8c96b;
        font-size:12px;font-weight:600;cursor:pointer;
        display:flex;align-items:center;justify-content:center;gap:6px;
        transition:all .15s;font-family:'Inter',sans-serif;
      `;
      editBtn.addEventListener('click', () => Drawing.editText(shape));
      cnt.appendChild(editBtn);
    }

    // Image Action Buttons for image shapes
    if (shape.type === 'image') {
      const fitBtn = document.createElement('button');
      fitBtn.innerHTML = `
        <svg viewBox="0 0 18 18" fill="none" style="width:13px;height:13px">
          <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6 9h6M9 6v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Fit to Screen`;
      fitBtn.style.cssText = `
        width:100%;margin-top:8px;padding:7px 10px;border-radius:6px;
        border:1px solid rgba(56,189,248,.4);background:rgba(56,189,248,.1);
        color:#7dd3fc;font-size:11.5px;font-weight:600;cursor:pointer;
        display:flex;align-items:center;justify-content:center;gap:6px;
        transition:all .15s;font-family:'Inter',sans-serif;
      `;
      fitBtn.addEventListener('click', () => {
        if (typeof ImageTool !== 'undefined') ImageTool.fitToScreen(shape);
      });
      cnt.appendChild(fitBtn);

      const bgBtn = document.createElement('button');
      bgBtn.innerHTML = `
        <svg viewBox="0 0 18 18" fill="none" style="width:13px;height:13px">
          <rect x="2" y="3" width="14" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="6" cy="7" r="1.5" fill="currentColor"/>
          <path d="M3 12l4-3 5 4" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        Set as Board Background`;
      bgBtn.style.cssText = `
        width:100%;margin-top:6px;padding:7px 10px;border-radius:6px;
        border:1px solid rgba(201,168,76,.4);background:rgba(201,168,76,.1);
        color:#e8c96b;font-size:11.5px;font-weight:600;cursor:pointer;
        display:flex;align-items:center;justify-content:center;gap:6px;
        transition:all .15s;font-family:'Inter',sans-serif;
      `;
      bgBtn.addEventListener('click', () => {
        if (typeof ImageTool !== 'undefined') ImageTool.setAsBackground(shape);
      });
      cnt.appendChild(bgBtn);
    }

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
      image:        [{ label:'Width', key:'w' },{ label:'Height', key:'h' }],
      'text-block': [{ label:'Font Size', key:'fontSize', min:8, max:160 }],
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
    if (panel) panel.classList.toggle('open', panelOpen);
    if (panelOpen) renderChapterPanel();
  }

  function openChapterPanel() {
    panelOpen = true;
    const panel = document.getElementById('chapter-panel');
    if (panel) {
      panel.classList.add('open');
      renderChapterPanel();
    }
  }

  function closeChapterPanel() {
    panelOpen = false;
    const panel = document.getElementById('chapter-panel');
    if (panel) panel.classList.remove('open');
  }

  function isChapterPanelOpen() {
    return panelOpen;
  }

  function renderScienceChapterPanel() {
    let chapters = [];
    if (typeof CurriculumStore !== 'undefined') {
      chapters = CurriculumStore.getChapters();
    }
    if (!chapters || !chapters.length) {
      if (typeof CURRICULUM_DATA !== 'undefined') {
        const sci = CURRICULUM_DATA.subjects.find(s => s.id === 'science');
        chapters = sci ? sci.chapters : [];
      }
    }
    const ch = (chapters && chapters.length)
      ? (chapters.find(c => c.id === App.activeChapter || +c.id === +App.activeChapter) || chapters[0])
      : null;
    if (!ch) return;

    const titleEl = document.getElementById('cp-title');
    if (titleEl) {
      titleEl.innerHTML = `<span style="color:#38bdf8;font-weight:700">🔬 Science &bull; Ch ${ch.id}:</span> ${ch.name}${ch.nepaliName ? ` <span style="font-size:12px;opacity:.7;font-weight:400">(${ch.nepaliName})</span>` : ''}`;
    }

    const bodyEl = document.getElementById('cp-body');
    if (bodyEl && typeof ScienceCalculators !== 'undefined') {
      bodyEl.innerHTML = ScienceCalculators.buildContent(ch);
    }
  }

  function renderChapterPanel() {
    const isScienceActive = (typeof App !== 'undefined' && App.activeSubject === 'science') ||
      ((typeof CurriculumStore !== 'undefined') && (CurriculumStore.getActiveSubject() || {}).id === 'science');

    if (isScienceActive) {
      renderScienceChapterPanel();
      return;
    }

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
  // TOPBAR DROPDOWNS
  // ─────────────────────────────────────────────
  function toggleDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const wasOpen = el.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) el.classList.add('open');
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.tb-dropdown').forEach(d => d.classList.remove('open'));
  }

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.tb-dropdown')) {
      closeAllDropdowns();
    }
    if (!e.target.closest('#flyout-shapes') && !e.target.closest('#btn-fp-shapes') && !e.target.closest('#subtool-smart-shape')) {
      closeShapesFlyout();
    }
    if (!e.target.closest('#flyout-insert') && !e.target.closest('#btn-fp-insert')) {
      closeInsertFlyout();
    }
    if (!e.target.closest('#flyout-eraser') && !e.target.closest('#btn-fp-eraser')) {
      closeEraserFlyout();
    }
  });

  // ─────────────────────────────────────────────
  function updateStatus() {
    const t = document.getElementById('sb-tool');
    const o = document.getElementById('sb-objs');
    if (t) {
      const toolMap = {
        'smart-draw': '✨ Smart Draw',
        'pen': 'Pen',
        'highlighter': 'Highlighter',
        'eraser': 'Eraser',
        'select': 'Select',
        'text': 'Text'
      };
      t.innerHTML = toolMap[App.currentTool] || App.currentTool;
    }
    if (o) o.innerHTML = Canvas.getShapeCount();
  }

  // ─────────────────────────────────────────────
  return {
    buildSidebar, updateSidebarCard, prevChapter, nextChapter,
    buildShapeGrid, buildColorPalette, buildPenSizes,
    buildBoardSwatches, syncPenPanel,
    showPropPanel, hidePropPanel,
    toggleShapesSection,
    toggleDropdown, closeAllDropdowns,
    toggleChapterPanel, openChapterPanel, closeChapterPanel, isChapterPanelOpen, renderChapterPanel, renderScienceChapterPanel,
    updateStatus, rebuildForSubject,
    renderTopChapters, updateTopChapterBadge, toggleSubjectDropdown,
    togglePenFlyout, openPenFlyout, closePenFlyout,
    toggleEraserFlyout, openEraserFlyout, closeEraserFlyout,
    toggleShapesFlyout, openShapesFlyout, closeShapesFlyout, closeAllFlyouts,
    toggleInsertFlyout, openInsertFlyout, closeInsertFlyout, openPdfPicker, handlePdfSelect,
    selectSubtool, syncSubtoolButtons, cyclePenSize, selectFlyoutColor,
    selectPenSize, selectEraserSize,
    clearDrawingStrokes, filterShapesCategory, searchShapes, switchShapesDomain
  };
})();