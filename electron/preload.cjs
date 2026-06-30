const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveChartScript: (projectId, scriptContent) => ipcRenderer.invoke('save-chart-script', projectId, scriptContent),
  loadChartScript: (projectId) => ipcRenderer.invoke('load-chart-script', projectId),
  selectZipFile: (defaultName) => ipcRenderer.invoke('select-zip-file', defaultName),
  saveMatlabFigures: (data) => ipcRenderer.invoke('save-matlab-figures', data)
});
