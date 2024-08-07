const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readDirectory: (path) => ipcRenderer.invoke('get-directory-content', path),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  editFile: (filePath) => ipcRenderer.invoke('choose-app-to-open-file', filePath),
  renameFile: (filePath, newName, oldName, isDirectory) => ipcRenderer.invoke('rename-file', filePath, newName, oldName, isDirectory),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  massDeleteFile: (filePath) => ipcRenderer.invoke('mass-delete-file', filePath),
  copyItem: (sourcePath, destinationPath) => ipcRenderer.invoke('copy-item', sourcePath, destinationPath),
  massCopyItem: (sourcePath, destinationPath) => ipcRenderer.invoke('mass-copy-item', sourcePath, destinationPath),
  moveItem: (sourcePath, destinationPath) => ipcRenderer.invoke('move-item', sourcePath, destinationPath),
  massMoveItem: (sourcePath, destinationPath) => ipcRenderer.invoke('mass-move-item', sourcePath, destinationPath),
  readTags: () => ipcRenderer.invoke('read-tags'),
  writeTags: (tags, color, path) => ipcRenderer.invoke('write-tags', tags, color, path),
  massWriteTags: (tags, color, path) => ipcRenderer.invoke('mass-write-tags', tags, color, path),
  getFileProperties: (filePath) => ipcRenderer.invoke('get-file-properties', filePath),
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
  close: () => ipcRenderer.invoke('close'),
  readRecents: () => ipcRenderer.invoke('read-recents'),
  writeRecents: (recents) => ipcRenderer.invoke('write-recents', recents),
  readSettings: () => ipcRenderer.invoke('read-settings'),
  writeSettings: (recents) => ipcRenderer.invoke('write-settings', recents),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  onOperationProgress: (callback) => ipcRenderer.on('operation-progress', callback)
});
