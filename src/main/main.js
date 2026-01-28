const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// モジュールをインポート
const { store, isMac } = require('./store');
const { createWindow, getMainWindow } = require('./window');
const { createTray } = require('./tray');
const { setupIpcHandlers } = require('./ipc-handlers');
const { setupWebContentsSecurity } = require('./security');
const { initAutoUpdater } = require('./updater');

// IPCハンドラーを設定
setupIpcHandlers();

// アプリ起動
app.whenReady().then(async () => {
  // WebView用のプリロードスクリプトを設定
  const services = store.get('services');
  services.forEach(service => {
    const ses = session.fromPartition(`persist:${service.id}`);
    ses.setPreloads([path.join(__dirname, '../preload/webview-preload.js')]);
  });

  // AI用のセッションにもプリロードを設定
  const aiSession = session.fromPartition('persist:ai');
  aiSession.setPreloads([path.join(__dirname, '../preload/webview-preload.js')]);

  createWindow();
  createTray(app);

  // 自動更新の初期化（開発モードでは無効）
  if (!process.argv.includes('--dev')) {
    const mainWindow = getMainWindow();
    initAutoUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.show();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

// セキュリティ: 新しいウィンドウを開く際の制限とコンテキストメニュー
app.on('web-contents-created', (event, contents) => {
  setupWebContentsSecurity(contents);
});
