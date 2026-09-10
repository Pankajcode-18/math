const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveBoard:         (data, defaultName, savePath) => ipcRenderer.invoke('save-board', { data, defaultName, savePath }),
  loadBoard:         (defaultDir)                  => ipcRenderer.invoke('load-board', { defaultDir }),
  saveSnapshot:      (dataUrl)                     => ipcRenderer.invoke('save-snapshot', dataUrl),
  savePdf:           (pages, title)                => ipcRenderer.invoke('save-pdf', { pages, title }),
  openFolder:        (folderPath)                  => ipcRenderer.invoke('open-folder', folderPath),
  libraryList:       ()                            => ipcRenderer.invoke('library-list'),
  librarySave:       (id, data)                    => ipcRenderer.invoke('library-save', { id, data }),
  libraryLoad:       (filePath)                    => ipcRenderer.invoke('library-load', { filePath }),
  libraryDelete:     (filePath)                    => ipcRenderer.invoke('library-delete', { filePath }),
  libraryRename:     (filePath, newName)           => ipcRenderer.invoke('library-rename', { filePath, newName }),
  libraryOpenFolder: ()                            => ipcRenderer.invoke('library-open-folder'),
  uploadPptx:        ()                            => ipcRenderer.invoke('upload-pptx'),
  changePptx:        ()                            => ipcRenderer.invoke('change-pptx'),
  isElectron:        true
});