const { autoUpdater } = require('electron-updater');
const { ipcMain, dialog } = require('electron');

// 自動ダウンロード設定
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;

function initAutoUpdater(window) {
  mainWindow = window;

  // 起動時に更新チェック（30秒後）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30000);

  // 定期チェック（6時間ごと）
  const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL);

  // イベントハンドラー
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('available', info);
  });

  autoUpdater.on('update-not-available', () => {
    sendStatusToWindow('not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToWindow('progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow('error', err.message);
  });
}

function sendStatusToWindow(status, data = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, data });
  }
}

// IPCハンドラー
ipcMain.handle('check-for-updates', async () => {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    return await autoUpdater.downloadUpdate();
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-current-version', () => {
  return autoUpdater.currentVersion?.version || '1.0.0';
});

module.exports = { initAutoUpdater };
