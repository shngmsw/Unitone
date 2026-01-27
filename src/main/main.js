const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 設定ストア
const store = new Store({
  defaults: {
    services: [
      { id: 'slack', name: 'Slack', url: 'https://app.slack.com', icon: '💬', enabled: true },
      { id: 'gchat', name: 'Google Chat', url: 'https://chat.google.com', icon: '💭', enabled: true },
      { id: 'teams', name: 'Teams', url: 'https://teams.microsoft.com', icon: '👥', enabled: true },
      { id: 'chatwork', name: 'Chatwork', url: 'https://www.chatwork.com', icon: '📝', enabled: true }
    ],
    geminiUrl: 'https://gemini.google.com',
    windowBounds: { width: 1400, height: 900 },
    activeServiceId: 'slack',
    showAiCompanion: true
  }
});

let mainWindow = null;
let tray = null;

function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // ウィンドウ状態を保存
  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 開発時はDevToolsを開く
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  // シンプルなトレイアイコン（16x16の空画像）
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Unitoneを表示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Unitone');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC ハンドラー
ipcMain.handle('get-services', () => {
  return store.get('services');
});

ipcMain.handle('add-service', (event, service) => {
  const services = store.get('services');
  const newService = {
    id: `custom-${Date.now()}`,
    name: service.name,
    url: service.url,
    icon: service.icon || '🔗',
    enabled: true
  };
  services.push(newService);
  store.set('services', services);
  return services;
});

ipcMain.handle('remove-service', (event, serviceId) => {
  const services = store.get('services').filter(s => s.id !== serviceId);
  store.set('services', services);
  return services;
});

ipcMain.handle('update-service', (event, updatedService) => {
  const services = store.get('services').map(s =>
    s.id === updatedService.id ? updatedService : s
  );
  store.set('services', services);
  return services;
});

ipcMain.handle('get-active-service', () => {
  return store.get('activeServiceId');
});

ipcMain.handle('set-active-service', (event, serviceId) => {
  store.set('activeServiceId', serviceId);
  return serviceId;
});

ipcMain.handle('get-gemini-url', () => {
  return store.get('geminiUrl');
});

ipcMain.handle('get-show-ai-companion', () => {
  return store.get('showAiCompanion');
});

ipcMain.handle('set-show-ai-companion', (event, show) => {
  store.set('showAiCompanion', show);
  return show;
});

// 通知バッジ更新
ipcMain.on('update-badge', (event, { serviceId, count }) => {
  if (mainWindow) {
    mainWindow.webContents.send('badge-updated', { serviceId, count });
  }

  // macOSの場合はドックバッジも更新
  if (process.platform === 'darwin') {
    const totalCount = count > 0 ? count.toString() : '';
    app.dock.setBadge(totalCount);
  }
});

// アプリ起動
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// セキュリティ: 新しいウィンドウを開く際の制限
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // 外部リンクはデフォルトブラウザで開く
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});
