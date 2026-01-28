const { Tray, Menu, nativeImage } = require('electron');
const { isMac, isWindows } = require('./store');
const { getMainWindow } = require('./window');

let tray = null;

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

// Windows用バッジアイコン生成（キャッシュ対応）
const badgeIconCache = new Map();

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

function createTray(app) {
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
        const mainWindow = getMainWindow();
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
    const mainWindow = getMainWindow();
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
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  return tray;
}

function getTray() {
  return tray;
}

module.exports = {
  createTray,
  getTray,
  createTrayIcon,
  createBadgeIcon
};
