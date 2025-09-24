const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

let mainWindow;
let isExamMode = false;

let currentSessionId = null;

ipcMain.on('set-session-id', (event, sessionId) => {
  currentSessionId = sessionId;
  console.log('Session ID set in main process:', currentSessionId);
});

const userDataPath = path.join(os.homedir(), 'SecureExamPortal');
app.setPath('userData', userDataPath);

app.disableHardwareAcceleration();

function checkMultipleScreens() {
  const displays = screen.getAllDisplays();
  if (displays.length > 1 && isExamMode) {
    console.log(`Multiple screens detected (${displays.length}). Stopping exam.`);
     app.quit();
  }
}

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


  
  // // Close DevTools if already opened
  // if (mainWindow.webContents.isDevToolsOpened()) {
  //     mainWindow.webContents.closeDevTools();
  // }

  // Block opening DevTools via shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {

      if (
        input.key === 'F12' || 
        (input.control && input.shift && input.key.toLowerCase() === 'i')
      ) {
        event.preventDefault();
      }
  });
   // Check initially on app ready
  checkMultipleScreens();

  // Listen for display changes dynamically
  screen.on('display-added', () => {
     if (isExamMode) {
    console.log('Display added');
    checkMultipleScreens();
     }
  });

  screen.on('display-removed', () => {
     if (isExamMode) {
    console.log('Display removed');
    checkMultipleScreens();
     }
  });

   mainWindow.on('blur', async () => {
  if (isExamMode) {
    console.log('Window lost focus - terminating session');
    try {
      await terminateSession(currentSessionId);
    } catch (err) {
      console.error('Error terminating session:', err);
    }
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


const fetch = require('node-fetch'); // install with `npm i node-fetch` if not installed

async function terminateSession(sessionId) {
  try {
    const response = await fetch(`https://secureexam.onrender.com/api/admin/sessions/${sessionId}/terminate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      // Optionally log full response body (may be HTML)
      const text = await response.text();
      console.error(`HTTP error ${response.status}:`, text);
      throw new Error(`Failed to terminate session: ${response.status}`);
    }
  } catch (error) {
    console.error('Error terminating session:', error);
  }
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


