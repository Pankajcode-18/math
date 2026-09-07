const { ipcRenderer } = require('electron');

window.electronAPI = {
  saveSnapshot:      (dataUrl)           => ipcRenderer.invoke('save-snapshot', dataUrl),
  saveBoard:         (data)              => ipcRenderer.invoke('save-board', data),
  loadBoard:         ()                  => ipcRenderer.invoke('load-board'),
  savePdf:           (pages, title)      => ipcRenderer.invoke('save-pdf', { pages, title }),
  libraryList:       ()                  => ipcRenderer.invoke('library-list'),
  librarySave:       (id, data)          => ipcRenderer.invoke('library-save', { id, data }),
  libraryLoad:       (filePath)          => ipcRenderer.invoke('library-load', { filePath }),
  libraryDelete:     (filePath)          => ipcRenderer.invoke('library-delete', { filePath }),
  libraryRename:     (filePath, newName) => ipcRenderer.invoke('library-rename', { filePath, newName }),
  libraryOpenFolder: ()                  => ipcRenderer.invoke('library-open-folder'),
  isElectron:        true
};