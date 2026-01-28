const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, session, shell, clipboard } = require('electron');
const path = require('path');
const Store = require('electron-store');

// プラットフォーム判定
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// 設定ストア
const store = new Store({
  defaults: {
    services: [
      { id: 'slack', name: 'Slack', url: 'https://slack.com/signin', icon: '💬', enabled: true },
      { id: 'gchat', name: 'Google Chat', url: 'https://chat.google.com', icon: '💭', enabled: true },
      { id: 'teams', name: 'Teams', url: 'https://teams.microsoft.com', icon: '👥', enabled: true },
      { id: 'chatwork', name: 'Chatwork', url: 'https://www.chatwork.com', icon: '📝', enabled: true }
    ],
    geminiUrl: 'https://gemini.google.com',
    windowBounds: { width: 1400, height: 900 },
    activeServiceId: 'slack',
    showAiCompanion: true,
    aiWidth: 400
  }
});

let mainWindow = null;
let tray = null;

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
}

function createTray() {
  // プラットフォームに応じたトレイアイコンを作成
  let icon;

  // Windows: 16x16のアイコンを使用
  if (isWindows) {
    icon = createTrayIcon();
  } else {
    // macOS/Linux: 空のアイコンまたはテンプレートアイコン
    icon = nativeImage.createEmpty();
  }

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

  tray.setToolTip('Unitone - チャット統合アプリ');
  tray.setContextMenu(contextMenu);

  // Windows: シングルクリックでウィンドウ表示
  // macOS: コンテキストメニュー表示がデフォルト
  tray.on('click', () => {
    if (mainWindow) {
      if (isWindows) {
        // Windowsではシングルクリックで表示/フォーカス
        mainWindow.show();
        mainWindow.focus();
      } else {
        // macOS/Linuxではトグル
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }
  });

  // Windows: ダブルクリックでもウィンドウ表示
  if (isWindows) {
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
}

// トレイアイコン生成
function createTrayIcon() {
  const size = 16;
  const data = Buffer.alloc(size * size * 4);

  // シンプルな「U」のアイコンを描画
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const inU = (
        // 左の縦線
        (x >= 3 && x <= 5 && y >= 2 && y <= 11) ||
        // 右の縦線
        (x >= 10 && x <= 12 && y >= 2 && y <= 11) ||
        // 下の曲線
        (y >= 10 && y <= 13 && x >= 3 && x <= 12 &&
          Math.sqrt(Math.pow(x - 7.5, 2) + Math.pow(y - 10, 2)) <= 5)
      );

      if (inU) {
        data[idx] = 233;     // R (accent color)
        data[idx + 1] = 69;  // G
        data[idx + 2] = 96;  // B
        data[idx + 3] = 255; // A
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(data, { width: size, height: size });
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

ipcMain.handle('get-ai-width', () => {
  return store.get('aiWidth', 400);
});

ipcMain.handle('set-ai-width', (event, width) => {
  store.set('aiWidth', width);
  return width;
});

// 通知バッジ更新
let totalBadgeCount = 0;
const serviceBadgeCounts = {};
// バッジアイコンキャッシュ（Apple Silicon最適化）
const badgeIconCache = new Map();

ipcMain.on('update-badge', (event, { serviceId, count }) => {
  if (mainWindow) {
    mainWindow.webContents.send('badge-updated', { serviceId, count });
  }

  // バッジカウントを更新
  serviceBadgeCounts[serviceId] = count;
  totalBadgeCount = Object.values(serviceBadgeCounts).reduce((sum, c) => sum + c, 0);

  // macOS: ドックバッジを更新
  if (isMac) {
    app.dock.setBadge(totalBadgeCount > 0 ? totalBadgeCount.toString() : '');
  }
  // Windows: タスクバーオーバーレイアイコンを更新
  else if (isWindows && mainWindow) {
    if (totalBadgeCount > 0) {
      // バッジ付きオーバーレイアイコンを作成
      const badgeIcon = createBadgeIcon(totalBadgeCount);
      mainWindow.setOverlayIcon(badgeIcon, `${totalBadgeCount} 件の通知`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
});

// Windows用バッジアイコン生成（キャッシュ対応）
function createBadgeIcon(count) {
  // キャッシュから取得（Apple Silicon最適化: 毎回の計算を回避）
  // バッジは赤い丸なので、カウント値に関係なく同じアイコンをキャッシュ
  const cacheKey = 'badge';
  if (badgeIconCache.has(cacheKey)) {
    return badgeIconCache.get(cacheKey);
  }

  // シンプルな赤い丸のアイコンを作成
  const size = 16;
  const data = Buffer.alloc(size * size * 4);
  const radius = size / 2;
  const radiusInner = radius - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - radius;
      const cy = y - radius;
      const distSq = cx * cx + cy * cy; // Math.sqrt を回避
      const radiusInnerSq = radiusInner * radiusInner;
      const radiusSq = radius * radius;

      if (distSq < radiusInnerSq) {
        // 赤い円
        data[idx] = 233;     // R
        data[idx + 1] = 69;  // G
        data[idx + 2] = 96;  // B
        data[idx + 3] = 255; // A
      } else if (distSq < radiusSq) {
        // アンチエイリアス（簡略化）
        data[idx] = 233;
        data[idx + 1] = 69;
        data[idx + 2] = 96;
        data[idx + 3] = 180; // 半透明
      }
    }
  }

  const icon = nativeImage.createFromBuffer(data, { width: size, height: size });
  badgeIconCache.set(cacheKey, icon);
  return icon;
}

// ウィンドウ操作IPC（Windows用カスタムタイトルバー）
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// プラットフォーム情報を送信
ipcMain.handle('get-platform', () => {
  return process.platform;
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
  if (!isMac) {
    app.quit();
  }
});

// サービスのメインURL（認証完了の判定に使用）
// ※gemini.google.comはAIコンパニオン用なので除外
const serviceMainUrls = [
  'app.slack.com',
  'chat.google.com',
  'teams.microsoft.com',
  'www.chatwork.com'
];

// URLがサービスのメインページかどうかをチェック
function isServiceMainUrl(url) {
  try {
    const urlObj = new URL(url);
    return serviceMainUrls.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// セキュリティ: 新しいウィンドウを開く際の制限
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url, frameName }) => {
    // 元のwebviewのセッションを取得して共有
    const originalSession = contents.session;

    // 認証ポップアップ用のウィンドウを作成
    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      parent: mainWindow,
      modal: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: originalSession // 元のwebviewと同じセッションを使用
      }
    });

    authWindow.loadURL(url);

    // 認証完了を検知（サービスのメインURLにリダイレクトされたら）
    authWindow.webContents.on('will-redirect', (e, redirectUrl) => {
      if (isServiceMainUrl(redirectUrl)) {
        // 認証完了：ポップアップを閉じて元のwebviewをそのURLにナビゲート
        authWindow.close();
        if (mainWindow) {
          mainWindow.webContents.send('auth-completed', redirectUrl);
        }
      }
    });

    authWindow.webContents.on('did-navigate', (e, navigatedUrl) => {
      if (isServiceMainUrl(navigatedUrl)) {
        authWindow.close();
        if (mainWindow) {
          mainWindow.webContents.send('auth-completed', navigatedUrl);
        }
      }
    });

    return { action: 'deny' };
  });

  // コンテキストメニュー（右クリックメニュー）
  contents.on('context-menu', (e, params) => {
    const menuItems = [];

    // ナビゲーション（戻る・進む・リロード）
    menuItems.push(
      {
        label: '戻る',
        enabled: contents.canGoBack(),
        click: () => contents.goBack()
      },
      {
        label: '進む',
        enabled: contents.canGoForward(),
        click: () => contents.goForward()
      },
      {
        label: '再読み込み',
        click: () => contents.reload()
      },
      { type: 'separator' }
    );

    // テキスト選択時
    if (params.selectionText) {
      menuItems.push(
        {
          label: 'コピー',
          role: 'copy'
        },
        {
          label: '「' + (params.selectionText.length > 15
            ? params.selectionText.substring(0, 15) + '...'
            : params.selectionText) + '」をWeb検索',
          click: () => {
            const query = encodeURIComponent(params.selectionText);
            shell.openExternal(`https://www.google.com/search?q=${query}`);
          }
        },
        {
          label: 'Geminiに送る',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('send-to-gemini', params.selectionText);
            }
          }
        },
        { type: 'separator' }
      );
    }

    // 編集可能なフィールド
    if (params.isEditable) {
      menuItems.push(
        { label: '元に戻す', role: 'undo' },
        { label: 'やり直し', role: 'redo' },
        { type: 'separator' },
        { label: '切り取り', role: 'cut' },
        { label: 'コピー', role: 'copy' },
        { label: '貼り付け', role: 'paste' },
        { type: 'separator' },
        { label: 'すべて選択', role: 'selectAll' },
        { type: 'separator' }
      );
    }

    // リンク
    if (params.linkURL) {
      menuItems.push(
        {
          label: 'リンクを新しいタブで開く',
          click: () => shell.openExternal(params.linkURL)
        },
        {
          label: 'リンクをコピー',
          click: () => clipboard.writeText(params.linkURL)
        },
        { type: 'separator' }
      );
    }

    // 画像
    if (params.mediaType === 'image') {
      menuItems.push(
        {
          label: '画像を新しいタブで開く',
          click: () => shell.openExternal(params.srcURL)
        },
        {
          label: '画像のURLをコピー',
          click: () => clipboard.writeText(params.srcURL)
        },
        { type: 'separator' }
      );
    }

    // 常に表示
    menuItems.push({
      label: 'ページのURLをコピー',
      click: () => clipboard.writeText(params.pageURL)
    });

    // 開発モード時
    if (process.argv.includes('--dev')) {
      menuItems.push(
        { type: 'separator' },
        {
          label: '要素を検証',
          click: () => contents.inspectElement(params.x, params.y)
        }
      );
    }

    const menu = Menu.buildFromTemplate(menuItems);
    menu.popup();
  });
});
