const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Disable Electron background network calls ──
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('disable-component-update');
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// ── Disable default application menu bar (File, Edit, View, Window, Help) ──
Menu.setApplicationMenu(null);

// ── Catch unhandled errors — show dialog instead of silent crash ──
process.on('uncaughtException', (err) => {
  dialog.showErrorBox('MathBoard Error', err.message + '\n\n' + err.stack);
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'PiyushDhara EduVerse Board',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    backgroundColor: '#0a1628',
    show: false,
    autoHideMenuBar: true
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  // Load index.html — works in both dev mode and packaged asar
  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'src', 'index.html')
    : path.join(__dirname, 'src', 'index.html');

  mainWindow.loadFile(indexPath).catch(err => {
    // Fallback — try relative path
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html')).catch(err2 => {
      dialog.showErrorBox('Load Error',
        'Could not load app.\n\nTried:\n' + indexPath + '\n\n' + err2.message);
    });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    dialog.showErrorBox('Load Failed', `Error ${code}: ${desc}`);
  });

  // Log renderer console errors to terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  // Always open DevTools so we can see errors
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Presentation Library ──
// Stored in: Documents/PiyushDhara MathBoard/Presentations/

function getLibraryDir() {
  const { app: electronApp } = require('electron');
  const dir = path.join(electronApp.getPath('documents'), 'PiyushDhara MathBoard', 'Presentations');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// List all saved presentations
ipcMain.handle('library-list', () => {
  try {
    const dir   = getLibraryDir();
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.mbp'));
    const list  = files.map(f => {
      const filePath = path.join(dir, f);
      const stat     = fs.statSync(filePath);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          id:        f.replace('.mbp',''),
          name:      data.name || f.replace('.mbp',''),
          chapter:   data.chapter || 0,
          pageCount: (data.pages || []).length,
          modified:  stat.mtime.toISOString(),
          filePath,
        };
      } catch(e) {
        return { id: f, name: f, pageCount: 0, modified: stat.mtime.toISOString(), filePath };
      }
    }).sort((a,b) => new Date(b.modified) - new Date(a.modified));
    return { success: true, list };
  } catch(err) {
    return { success: false, error: err.message, list: [] };
  }
});

// Save presentation to library
ipcMain.handle('library-save', (event, { id, data }) => {
  try {
    const dir      = getLibraryDir();
    const safeId   = id.replace(/[^a-zA-Z0-9_\- ]/g,'_');
    const filePath = path.join(dir, safeId + '.mbp');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { success: true, filePath };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Load presentation from library
ipcMain.handle('library-load', (event, { filePath }) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { success: true, data };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Delete presentation from library
ipcMain.handle('library-delete', (event, { filePath }) => {
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Rename presentation
ipcMain.handle('library-rename', (event, { filePath, newName }) => {
  try {
    const dir      = path.dirname(filePath);
    const safeId   = newName.replace(/[^a-zA-Z0-9_\- ]/g,'_');
    const newPath  = path.join(dir, safeId + '.mbp');
    const data     = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.name      = newName;
    fs.writeFileSync(newPath, JSON.stringify(data, null, 2));
    if (newPath !== filePath) fs.unlinkSync(filePath);
    return { success: true, filePath: newPath };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Open library folder in Explorer
ipcMain.handle('library-open-folder', () => {
  shell.openPath(getLibraryDir());
  return { success: true };
});


ipcMain.handle('save-snapshot', async (event, dataUrl) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Board Snapshot',
    defaultPath: `MathBoard-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (!filePath) return { success: false };
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Save board state (JSON) — returns filePath + fileName so renderer can rename tabs
ipcMain.handle('save-board', async (event, { data, defaultName, savePath }) => {
  let filePath = savePath || null;
  // If no existing savePath, show save dialog
  if (!filePath) {
    const safe = (defaultName || 'MathBoard-Session').replace(/[\\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Board Session',
      defaultPath: safe + '.mbp',
      filters: [{ name: 'MathBoard File', extensions: ['mbp'] }]
    });
    if (result.canceled || !result.filePath) return { success: false };
    filePath = result.filePath;
  }
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    const fileName = path.basename(filePath, path.extname(filePath));
    return { success: true, filePath, fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Open containing folder in Windows Explorer
ipcMain.handle('open-folder', (event, folderPath) => {
  shell.openPath(folderPath);
  return { success: true };
});

// IPC: Load board state — supports .mbp and .json, opens from last-used folder
ipcMain.handle('load-board', async (event, { defaultDir } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Board Session',
    defaultPath: defaultDir || undefined,
    filters: [{ name: 'MathBoard File', extensions: ['mbp', 'json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) return { success: false };
  try {
    const filePath = result.filePaths[0];
    const data     = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const fileName  = path.basename(filePath, path.extname(filePath));
    const folder    = path.dirname(filePath);
    return { success: true, data, filePath, fileName, folder };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Save PDF — builds a valid PDF from JPEG page images
ipcMain.handle('save-pdf', async (event, { pages, title }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export All Pages as PDF',
    defaultPath: `PiyushDhara-MathBoard-${Date.now()}.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
  });
  if (!filePath) return { success: false };

  try {
    const chunks  = [];
    const offsets = [];
    let   pos     = 0;
    let   objCount = 0;

    function push(buf) {
      if (typeof buf === 'string') buf = Buffer.from(buf, 'binary');
      chunks.push(buf);
      pos += buf.length;
    }

    function startObj() {
      objCount++;
      offsets.push(pos);
      push(`${objCount} 0 obj\n`);
      return objCount;
    }

    function endObj() { push('\nendobj\n'); }

    // PDF header
    push('%PDF-1.4\n');
    push('%\xE2\xE3\xCF\xD3\n'); // binary comment to flag as binary

    const catalogRef = objCount + 1;
    const pagesRef   = objCount + 2;

    // We'll fill catalog and pages after building page objects
    // Reserve obj slots
    const catalogObjStart = pos;
    offsets.push(pos); objCount++; // catalog placeholder
    push(`${objCount} 0 obj\n<< /Type /Catalog /Pages ${pagesRef} 0 R >>\nendobj\n`);

    const pagesObjStart = pos;
    offsets.push(pos); objCount++; // pages placeholder — fill kids later
    const pagesObjNum = objCount;
    push(`${pagesObjNum} 0 obj\n`); // content filled below after we know page refs

    const pageRefs = [];

    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      if (!pg.dataUrl || !pg.dataUrl.startsWith('data:image/jpeg')) {
        // Skip blank/invalid pages
        continue;
      }

      const jpegB64  = pg.dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const jpegBuf  = Buffer.from(jpegB64, 'base64');
      const imgW     = pg.w;
      const imgH     = pg.h;

      // PDF points (72dpi from 96dpi screen)
      const ptW = Math.round(imgW * 72 / 96);
      const ptH = Math.round(imgH * 72 / 96);

      // Image XObject
      offsets.push(pos); objCount++;
      const imgObjNum = objCount;
      push(`${imgObjNum} 0 obj\n`);
      push(`<< /Type /XObject /Subtype /Image `);
      push(`/Width ${imgW} /Height ${imgH} `);
      push(`/ColorSpace /DeviceRGB /BitsPerComponent 8 `);
      push(`/Filter /DCTDecode /Length ${jpegBuf.length} >>\n`);
      push('stream\n');
      push(jpegBuf);
      push('\nendstream\nendobj\n');

      // Content stream
      const cs = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im1 Do Q`;
      offsets.push(pos); objCount++;
      const csObjNum = objCount;
      push(`${csObjNum} 0 obj\n`);
      push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);

      // Page object
      offsets.push(pos); objCount++;
      const pageObjNum = objCount;
      push(`${pageObjNum} 0 obj\n`);
      push(`<< /Type /Page /Parent ${pagesObjNum} 0 R `);
      push(`/MediaBox [0 0 ${ptW} ${ptH}] `);
      push(`/Contents ${csObjNum} 0 R `);
      push(`/Resources << /XObject << /Im1 ${imgObjNum} 0 R >> >> >>\n`);
      push('endobj\n');

      pageRefs.push(pageObjNum);
    }

    // Now write Pages object (we left a placeholder)
    // We already pushed the placeholder — update via xref later
    // Actually re-emit pages obj at current position with correct kids
    offsets.push(pos); objCount++;
    const pagesObjNum2 = objCount;
    const kidsStr = pageRefs.map(r => `${r} 0 R`).join(' ');
    push(`${pagesObjNum2} 0 obj\n`);
    push(`<< /Type /Pages /Kids [${kidsStr}] /Count ${pageRefs.length} >>\n`);
    push('endobj\n');

    // Update catalog to point to correct pages obj
    offsets.push(pos); objCount++;
    push(`${objCount} 0 obj\n`);
    push(`<< /Type /Catalog /Pages ${pagesObjNum2} 0 R >>\n`);
    push('endobj\n');
    const realCatalogNum = objCount;

    // xref
    const xrefPos = pos;
    push(`xref\n0 ${objCount + 1}\n`);
    push('0000000000 65535 f \n');
    offsets.forEach(o => {
      push(String(o).padStart(10, '0') + ' 00000 n \n');
    });

    push(`trailer\n<< /Size ${objCount + 1} /Root ${realCatalogNum} 0 R >>\n`);
    push(`startxref\n${xrefPos}\n%%EOF\n`);

    fs.writeFileSync(filePath, Buffer.concat(chunks));
    return { success: true, filePath, pageCount: pageRefs.length };

  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── POWERPOINT PRESENTATION (PPT / PPTX) CONVERTER ──

async function convertPptToSlides(filePath) {
  const fileName = path.basename(filePath);
  const tempDir = path.join(app.getPath('temp'), 'eduverse_ppt_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Try PowerPoint COM Automation (High quality & windowless)
  try {
    const psScript = `
      $ErrorActionPreference = 'Stop'
      $ppt = New-Object -ComObject PowerPoint.Application
      try {
        $pres = $ppt.Presentations.Open('${filePath.replace(/'/g, "''").replace(/\\/g, '\\\\')}', [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
        $pres.SaveAs('${tempDir.replace(/'/g, "''").replace(/\\/g, '\\\\')}', 17)
        $count = $pres.Slides.Count
        $pres.Close()
        Write-Host "SUCCESS count=$count"
      } finally {
        $ppt.Quit()
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
      }
    `;
    const { execSync } = require('child_process');
    const psFile = path.join(tempDir, 'export.ps1');
    fs.writeFileSync(psFile, psScript);
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { timeout: 60000 });

    const files = fs.readdirSync(tempDir).filter(f => /\.(png|jpe?g)$/i.test(f));
    files.sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || [0])[0], 10);
      const numB = parseInt((b.match(/\d+/) || [0])[0], 10);
      return numA - numB;
    });

    if (files.length > 0) {
      const slides = files.map((f, idx) => {
        const full = path.join(tempDir, f);
        const buf = fs.readFileSync(full);
        const mime = f.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        return {
          index: idx + 1,
          name: `Slide ${idx + 1}`,
          dataUrl: `data:${mime};base64,${buf.toString('base64')}`
        };
      });

      setTimeout(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
      }, 8000);

      return { success: true, fileName, filePath, slideCount: slides.length, slides };
    }
  } catch (err) {
    console.error('[PPT Converter] COM Automation error, falling back:', err.message);
  }

  // 2. Fallback: Parse PPTX using yauzl for media images
  return new Promise((resolve) => {
    try {
      const yauzl = require('yauzl');
      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          return resolve({ success: false, error: 'Could not read PPT file: ' + err.message });
        }
        const mediaEntries = [];
        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          if (/^ppt\/media\/.*\.(png|jpe?g)$/i.test(entry.fileName)) {
            mediaEntries.push(entry);
          }
          zipfile.readEntry();
        });
        zipfile.on('end', async () => {
          if (mediaEntries.length === 0) {
            return resolve({
              success: false,
              error: 'PowerPoint slide export requires PowerPoint installed on Windows or a PPTX file with slide graphics.'
            });
          }
          const slides = [];
          for (let i = 0; i < mediaEntries.length; i++) {
            const entry = mediaEntries[i];
            const mime = entry.fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            const buf = await new Promise((res) => {
              zipfile.openReadStream(entry, (err, stream) => {
                if (err) return res(null);
                const chunks = [];
                stream.on('data', c => chunks.push(c));
                stream.on('end', () => res(Buffer.concat(chunks)));
              });
            });
            if (buf) {
              slides.push({
                index: slides.length + 1,
                name: `Slide ${slides.length + 1}`,
                dataUrl: `data:${mime};base64,${buf.toString('base64')}`
              });
            }
          }
          resolve({ success: true, fileName, filePath, slideCount: slides.length, slides });
        });
      });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

// IPC: Upload PowerPoint (.pptx, .ppt)
ipcMain.handle('upload-pptx', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open PowerPoint Presentation',
    filters: [
      { name: 'PowerPoint Files (*.pptx, *.ppt)', extensions: ['pptx', 'ppt'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { success: false, canceled: true };
  }
  return await convertPptToSlides(result.filePaths[0]);
});

// IPC: Change PowerPoint presentation
ipcMain.handle('change-pptx', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Change PowerPoint Presentation',
    filters: [
      { name: 'PowerPoint Files (*.pptx, *.ppt)', extensions: ['pptx', 'ppt'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { success: false, canceled: true };
  }
  return await convertPptToSlides(result.filePaths[0]);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});