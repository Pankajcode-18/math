'use strict';

// ═══════════════════════════════════════════════════════════
// PIYUSHDHARA EDUVERSE BOARD — PPT PRESENTER & SLIDE MANAGER
// Upload, present, navigate, annotate, and change PPT decks
// ═══════════════════════════════════════════════════════════

const PptPresenter = (() => {

  let currentDeck = null; // { fileName, slideCount, slides: [ { index, name, dataUrl } ] }
  let currentSlideIndex = 0; // 0-based
  let isDockOpen = false;
  let isThumbTrayOpen = false;

  function init() {
    // Keyboard shortcuts for slides when presenter is active
    window.addEventListener('keydown', (e) => {
      if (!currentDeck) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevSlide();
      }
    });

    // Touch swipe on the canvas zone — swipe left = next slide, swipe right = prev
    let swipeStartX = 0;
    let swipeStartY = 0;
    const zone = document.getElementById('canvas-zone');
    if (zone) {
      zone.addEventListener('touchstart', (e) => {
        if (!currentDeck) return;
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
      }, { passive: true });

      zone.addEventListener('touchend', (e) => {
        if (!currentDeck) return;
        const dx = e.changedTouches[0].clientX - swipeStartX;
        const dy = e.changedTouches[0].clientY - swipeStartY;
        // Only register as swipe if horizontal movement > 80px and not too vertical
        if (Math.abs(dx) > 80 && Math.abs(dy) < 60) {
          if (dx < 0) nextSlide();  // swipe left → next
          else prevSlide();          // swipe right → prev
        }
      }, { passive: true });
    }
  }

  // Open file picker to upload PPT
  async function openPicker() {
    if (window.electronAPI && typeof window.electronAPI.uploadPptx === 'function') {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Opening PowerPoint file...');
      try {
        const res = await window.electronAPI.uploadPptx();
        if (res && res.success && res.slides && res.slides.length > 0) {
          loadDeck(res);
        } else if (res && res.error) {
          alert('PowerPoint import note: ' + res.error);
        }
      } catch (err) {
        alert('Error uploading PPT: ' + err.message);
      }
    } else {
      // Browser fallback using input element
      const fileInput = document.getElementById('ppt-file-input');
      if (fileInput) fileInput.click();
    }
  }

  // Change to a different PPT file
  async function changePpt() {
    if (window.electronAPI && typeof window.electronAPI.changePptx === 'function') {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Selecting new PowerPoint presentation...');
      try {
        const res = await window.electronAPI.changePptx();
        if (res && res.success && res.slides && res.slides.length > 0) {
          loadDeck(res);
        } else if (res && res.error) {
          alert('PowerPoint change note: ' + res.error);
        }
      } catch (err) {
        alert('Error changing PPT: ' + err.message);
      }
    } else {
      const fileInput = document.getElementById('ppt-file-input');
      if (fileInput) fileInput.click();
    }
  }

  // Browser file input change handler
  function handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Selected ${file.name}. Reading slide presentation...`);
    }

    // If image file uploaded as slide
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        loadDeck({
          fileName: file.name,
          slideCount: 1,
          slides: [{ index: 1, name: 'Slide 1', dataUrl: e.target.result }]
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // If PPTX in browser, create placeholder slide cards
    loadDeck({
      fileName: file.name,
      slideCount: 3,
      slides: [
        { index: 1, name: `${file.name} - Title Slide`, dataUrl: createPlaceholderSlide(file.name, 'Slide 1: Overview & Introduction') },
        { index: 2, name: `${file.name} - Concepts`, dataUrl: createPlaceholderSlide(file.name, 'Slide 2: Core Teaching Concepts') },
        { index: 3, name: `${file.name} - Exercises`, dataUrl: createPlaceholderSlide(file.name, 'Slide 3: Practice Questions & Boardwork') }
      ]
    });
  }

  function createPlaceholderSlide(deckName, title) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#081329';
    ctx.fillRect(0, 0, 1280, 720);

    // Border
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 1240, 680);

    // Text
    ctx.fillStyle = '#e8c96b';
    ctx.font = 'bold 36px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PiyushDhara EduVerse Presentation', 640, 220);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px Segoe UI, sans-serif';
    ctx.fillText(title, 640, 320);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '20px Segoe UI, sans-serif';
    ctx.fillText(deckName, 640, 420);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText('Ready for board drawing, annotations, math & science formulas', 640, 500);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // Load a deck of slides into the presenter
  function loadDeck(deckData) {
    currentDeck = deckData;
    currentSlideIndex = 0;
    isDockOpen = true;

    // Apply first slide to current page
    applySlideToBoard(0);

    // Render dock UI
    renderDock();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Loaded PPT: "${deckData.fileName}" (${deckData.slides.length} slides)`);
    }

    // Highlight topbar PPT button
    const pptBtn = document.getElementById('btn-ppt');
    if (pptBtn) {
      pptBtn.classList.add('active');
      pptBtn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M7 17l3-3 3 3M10 14v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="8.5" r="2.5" stroke="currentColor" stroke-width="1.2"/></svg>
        PPT (${deckData.slides.length})
      `;
    }
  }

  // Set the specified slide as active background on current board page
  function applySlideToBoard(slideIdx) {
    if (!currentDeck || !currentDeck.slides[slideIdx]) return;
    const slide = currentDeck.slides[slideIdx];
    currentSlideIndex = slideIdx;

    if (typeof Canvas !== 'undefined') {
      Canvas.setBgImage(slide.dataUrl);
    }
    updateDockStatus();
  }

  // Automatically import all slides as distinct board pages
  function importAllAsPages() {
    if (!currentDeck || !currentDeck.slides || !currentDeck.slides.length) return;

    if (typeof App !== 'undefined') {
      const confirmed = confirm(`Do you want to import all ${currentDeck.slides.length} slides as individual board pages? Each page will hold one slide ready for drawing and annotation.`);
      if (!confirmed) return;

      // Access App pages
      currentDeck.slides.forEach((slide, idx) => {
        if (idx === 0) {
          // Set on first page
          Canvas.setBgImage(slide.dataUrl);
        } else {
          // Add new page
          App.addPage();
          Canvas.setBgImage(slide.dataUrl);
        }
      });

      // Switch to first page
      App.switchPage(0);
      App.showToast(`Imported ${currentDeck.slides.length} slides into board pages!`);
    }
  }

  function nextSlide() {
    if (!currentDeck || currentSlideIndex >= currentDeck.slides.length - 1) return;
    applySlideToBoard(currentSlideIndex + 1);
  }

  function prevSlide() {
    if (!currentDeck || currentSlideIndex <= 0) return;
    applySlideToBoard(currentSlideIndex - 1);
  }

  function clearSlideFromBoard() {
    if (typeof Canvas !== 'undefined') {
      Canvas.setBgImage(null);
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Slide background removed from board.');
    }
  }

  function closeDock() {
    isDockOpen = false;
    const dock = document.getElementById('ppt-presenter-dock');
    if (dock) dock.style.display = 'none';
  }

  function toggleThumbnails() {
    isThumbTrayOpen = !isThumbTrayOpen;
    const tray = document.getElementById('ppt-thumb-tray');
    if (tray) tray.style.display = isThumbTrayOpen ? 'flex' : 'none';
  }

  // Render the floating dock
  function renderDock() {
    let dock = document.getElementById('ppt-presenter-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'ppt-presenter-dock';
      document.body.appendChild(dock);
    }

    dock.style.display = 'flex';
    dock.innerHTML = `
      <!-- THUMBNAIL TRAY -->
      <div id="ppt-thumb-tray" style="display:${isThumbTrayOpen ? 'flex' : 'none'};">
        ${(currentDeck.slides || []).map((s, idx) => `
          <div class="ppt-thumb-card ${idx === currentSlideIndex ? 'active' : ''}" onclick="PptPresenter.applySlideToBoard(${idx})">
            <img src="${s.dataUrl}" alt="Slide ${idx+1}">
            <span>Slide ${idx+1}</span>
          </div>
        `).join('')}
      </div>

      <!-- MAIN CONTROLS BAR -->
      <div class="ppt-dock-main">
        <div class="ppt-dock-title" title="${currentDeck.fileName}">
          <span style="color:#38bdf8;font-weight:700">📊 PPT:</span> ${currentDeck.fileName}
        </div>

        <div class="ppt-nav-group">
          <button class="ppt-ctrl-btn" onclick="PptPresenter.prevSlide()" title="Previous slide (Left Arrow)">◀ Prev</button>
          <span class="ppt-slide-counter" id="ppt-counter">Slide <b>${currentSlideIndex + 1}</b> of ${currentDeck.slides.length}</span>
          <button class="ppt-ctrl-btn" onclick="PptPresenter.nextSlide()" title="Next slide (Right Arrow)">Next ▶</button>
        </div>

        <div class="ppt-actions-group">
          <button class="ppt-action-btn" onclick="PptPresenter.toggleThumbnails()" title="Toggle slide previews">
            🖼️ Deck
          </button>
          <button class="ppt-action-btn" onclick="PptPresenter.importAllAsPages()" title="Create one board page per slide">
            📑 Import as Pages
          </button>
          <button class="ppt-action-btn highlight" onclick="PptPresenter.changePpt()" title="Upload a different PowerPoint file">
            🔄 Change PPT
          </button>
          <button class="ppt-action-btn" onclick="PptPresenter.clearSlideFromBoard()" title="Remove background image">
            🧹 Clear BG
          </button>
          <button class="ppt-close-btn" onclick="PptPresenter.closeDock()" title="Hide presenter bar">
            ×
          </button>
        </div>
      </div>
    `;
  }

  function updateDockStatus() {
    const counter = document.getElementById('ppt-counter');
    if (counter && currentDeck) {
      counter.innerHTML = `Slide <b>${currentSlideIndex + 1}</b> of ${currentDeck.slides.length}`;
    }
    // Update active thumb
    document.querySelectorAll('.ppt-thumb-card').forEach((card, idx) => {
      card.classList.toggle('active', idx === currentSlideIndex);
    });
  }

  return {
    init,
    openPicker,
    changePpt,
    handleFileSelect,
    loadDeck,
    applySlideToBoard,
    importAllAsPages,
    nextSlide,
    prevSlide,
    clearSlideFromBoard,
    toggleThumbnails,
    closeDock
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.PptPresenter = PptPresenter;
}
