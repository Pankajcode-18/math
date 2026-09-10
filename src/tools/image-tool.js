'use strict';

// ═══════════════════════════════════════════════
// IMAGE TOOL — Import, drag-and-drop, resize, background
// ═══════════════════════════════════════════════

const ImageTool = (() => {

  function init() {
    initDragAndDrop();
  }

  function openPicker() {
    const inp = document.getElementById('image-file-input');
    if (inp) {
      inp.value = '';
      inp.click();
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = '';
  }

  function processImageFile(file, dropX, dropY) {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        insertImageOnBoard(dataUrl, file.name, img.naturalWidth, img.naturalHeight, dropX, dropY);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function insertImageOnBoard(dataUrl, name, natW, natH, dropX, dropY) {
    const sz = Canvas.getCanvasSize ? Canvas.getCanvasSize() : { W: window.innerWidth, H: window.innerHeight };
    const maxW = Math.min(520, sz.W * 0.65);
    const maxH = Math.min(420, sz.H * 0.65);

    let w = natW || 400;
    let h = natH || 300;

    const scale = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    const x = (dropX !== undefined && dropX !== null) ? Math.round(dropX - w / 2) : Math.round(sz.W / 2 - w / 2);
    const y = (dropY !== undefined && dropY !== null) ? Math.round(dropY - h / 2) : Math.round(sz.H / 2 - h / 2);

    const shape = {
      id: Date.now(),
      type: 'image',
      src: dataUrl,
      fileName: name || 'Image',
      x: Math.max(10, x),
      y: Math.max(10, y),
      w: Math.max(40, w),
      h: Math.max(40, h),
      origW: natW,
      origH: natH,
      selected: true
    };

    Canvas.addShapeObject(shape);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✓ Imported image: ${name || 'diagram'}`);
    }
  }

  function fitToScreen(shape) {
    if (!shape || shape.type !== 'image') return;
    const sz = Canvas.getCanvasSize();
    const margin = 40;
    const maxW = sz.W - margin * 2;
    const maxH = sz.H - margin * 2;
    const baseW = shape.origW || shape.w;
    const baseH = shape.origH || shape.h;
    const scale = Math.min(maxW / baseW, maxH / baseH);
    shape.w = Math.round(baseW * scale);
    shape.h = Math.round(baseH * scale);
    shape.x = Math.round((sz.W - shape.w) / 2);
    shape.y = Math.round((sz.H - shape.h) / 2);
    Canvas.renderShapes();
    UI.showPropPanel(shape);
    if (typeof App !== 'undefined' && App.showToast) App.showToast('Fitted image to screen');
  }

  function setAsBackground(shape) {
    if (!shape || shape.type !== 'image') return;
    Canvas.setBgImage(shape.src);
    Canvas.deleteShape();
    if (typeof App !== 'undefined' && App.showToast) App.showToast('Image set as board background layer');
  }

  function resetOriginalSize(shape) {
    if (!shape || shape.type !== 'image') return;
    if (shape.origW && shape.origH) {
      shape.w = shape.origW;
      shape.h = shape.origH;
      Canvas.renderShapes();
      UI.showPropPanel(shape);
    }
  }

  function initDragAndDrop() {
    const zone = document.getElementById('canvas-zone');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.style.boxShadow = 'inset 0 0 0 3px rgba(201,168,76,0.6)';
    });

    zone.addEventListener('dragleave', () => {
      zone.style.boxShadow = 'none';
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.boxShadow = 'none';
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const rect = zone.getBoundingClientRect();
          const dropX = e.clientX - rect.left;
          const dropY = e.clientY - rect.top;
          processImageFile(file, dropX, dropY);
        } else if (file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) {
          if (typeof PptPresenter !== 'undefined') {
            PptPresenter.handleFileSelect({ target: { files: [file] } });
          }
        }
      }
    });
  }

  return {
    init,
    openPicker,
    handleFileSelect,
    processImageFile,
    insertImageOnBoard,
    fitToScreen,
    setAsBackground,
    resetOriginalSize
  };
})();
