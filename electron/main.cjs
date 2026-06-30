const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exportMatlabFigures } = require('./matlabExport.cjs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    // In dev, assuming Vite runs on 3000 by default (as per our package.json script)
    // Wait a bit for Vite to start before loading
    setTimeout(() => {
      win.loadURL('http://localhost:3000').catch(() => {
        // Fallback or retry
        setTimeout(() => win.loadURL('http://localhost:3000'), 2000);
      });
    }, 1000);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// IPC Handler: save-chart-script
ipcMain.handle('save-chart-script', async (event, projectId, scriptContent) => {
  try {
    const pluginsDir = path.join(app.getPath('userData'), 'plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
    const filePath = path.join(pluginsDir, projectId + '_chart.js');
    fs.writeFileSync(filePath, scriptContent);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC Handler: load-chart-script
ipcMain.handle('load-chart-script', async (event, projectId) => {
  try {
    const pluginsDir = path.join(app.getPath('userData'), 'plugins');
    const filePath = path.join(pluginsDir, projectId + '_chart.js');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { ok: true, content };
    }
    return { ok: true, content: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC Handler: select-zip-file
ipcMain.handle('select-zip-file', async (event, defaultName) => {
  const result = await dialog.showSaveDialog({
    title: 'Save MATLAB Export ZIP',
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
    defaultPath: defaultName || 'MATLAB_Export.zip'
  });
  return result.canceled ? null : result.filePath;
});

// IPC Handler: save-matlab-figures
ipcMain.handle('save-matlab-figures', async (event, payload) => {
  return exportMatlabFigures(payload);
});
