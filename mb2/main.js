const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Disable Electron background network calls ──
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('disable-component-update');
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

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
    title: 'PiyushDhara MathBoard',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    backgroundColor: '#0a1628',
    show: false,
    titleBarStyle: 'default'
  });

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

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

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

// IPC: Save board state (JSON)
ipcMain.handle('save-board', async (event, data) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Board Session',
    defaultPath: `MathBoard-Session-${Date.now()}.json`,
    filters: [{ name: 'MathBoard Session', extensions: ['json'] }]
  });
  if (!filePath) return { success: false };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Load board state
ipcMain.handle('load-board', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Board Session',
    filters: [{ name: 'MathBoard Session', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!filePaths || !filePaths[0]) return { success: false };
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    return { success: true, data };
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



app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});