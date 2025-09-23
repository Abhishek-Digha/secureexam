const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

let mainWindow;
let isExamMode = false;

const userDataPath = path.join(os.homedir(), 'SecureExamPortal');
app.setPath('userData', userDataPath);

app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    kiosk: true,   
     frame: false, 
      webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      webSecurity: true,
      cache: false
    },
    show: false,
    autoHideMenuBar: true,
    // icon: path.join(__dirname, 'assets/icon.ico')
  });
  mainWindow.maximize(); // ✅ Open maximized
  mainWindow.loadFile('renderer/index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

   mainWindow.on('blur', () => {
    if (isExamMode) {
      console.log('Window lost focus');
      dialog.showErrorBox('Exam Terminated', 'Exam has been terminated due to security violation.');
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
}

// --- SECURE MODE HANDLERS ---

function enableSecureExamMode() {
  isExamMode = true;

  // Close browsers and apps for Windows
  if (process.platform === 'win32') {
    const browsers = ['chrome.exe', 'firefox.exe', 'msedge.exe', 'opera.exe', 'safari.exe'];
    browsers.forEach(browser => {
      exec(`taskkill /IM ${browser} /F`, (error) => {
        // Ignore errors if process not found
      });
    });
  }

  if (process.platform === 'darwin') {
  const browsers = [
    'Google Chrome',
    'Firefox',
    'Microsoft Edge',
    'Opera',
    'Safari'
  ];

  browsers.forEach(browser => {
    exec(`killall "${browser}"`, (error) => {
      // Ignore errors if process not found
    });
  });
}

  // Set fullscreen and always on top
  mainWindow.setFullScreen(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setMenu(null);

  // Monitor exit-fullscreen violation
  mainWindow.on('leave-full-screen', () => {
    if (isExamMode) {
      dialog.showErrorBox('Exam Terminated', 'Exam has been terminated due to security violation.');
      app.quit();
    }
  });
}

function disableSecureExamMode() {
  isExamMode = false;
  mainWindow.setFullScreen(false);
  mainWindow.setAlwaysOnTop(false);
}

// --- END SECURE MODE HANDLERS ---

// Only enable secure mode when renderer requests it (e.g., only for user exam, NOT for admin)
ipcMain.handle('enable-secure-mode', () => {
  enableSecureExamMode();
});

ipcMain.handle('disable-secure-mode', () => {
  disableSecureExamMode();
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  const fs = require('fs');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


