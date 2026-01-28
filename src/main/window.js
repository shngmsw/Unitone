const { BrowserWindow } = require('electron');
const path = require('path');
const { store, isMac, isWindows } = require('./store');

let mainWindow = null;

function createWindow() {
  const bounds = store.get('windowBounds');

  // プラットフォームごとのウィンドウ設定
  const windowOptions = {
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
      webviewTag: true,
      // Apple Silicon最適化: バックグラウンドスロットリング有効
      backgroundThrottling: true
    },
    show: false, // ready-to-showで表示
    backgroundColor: '#1a1a2e'
  };

  // macOS: ネイティブのタイトルバーを使用（hiddenInset）
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 12, y: 12 };
  }
  // Windows: フレームレスウィンドウでカスタムタイトルバーを使用
  else if (isWindows) {
    windowOptions.frame = false;
    windowOptions.titleBarStyle = 'hidden';
    windowOptions.titleBarOverlay = {
      color: '#16213e',
      symbolColor: '#eeeeee',
      height: 32
    };
  }
  // Linux: 標準フレームを使用
  else {
    windowOptions.frame = true;
  }

  // アイコン設定（存在する場合のみ）
  const iconPath = isWindows
    ? path.join(__dirname, '../../assets/icons/icon.ico')
    : path.join(__dirname, '../../assets/icons/icon.png');
  windowOptions.icon = iconPath;

  mainWindow = new BrowserWindow(windowOptions);

  // ウィンドウ準備完了後に表示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

function setMainWindow(window) {
  mainWindow = window;
}

module.exports = {
  createWindow,
  getMainWindow,
  setMainWindow
};
