const { BrowserWindow, Menu, shell, clipboard } = require('electron');
const { getMainWindow } = require('./window');

// サービスのメインURL（認証完了の判定に使用）
const serviceMainUrls = [
  'app.slack.com',
  'chat.google.com',
  'teams.microsoft.com',
  'www.chatwork.com'
];

// 認証関連のドメイン（これらのドメインは認証ポップアップで開く）
const authDomains = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'login.windows.net',
  'aadcdn.msftauth.net',
  'aadcdn.msauth.net',
  'appleid.apple.com',
  'accounts.firefox.com'
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

// ホスト名からベースドメインを取得（例: "app.slack.com" → "slack.com"）
function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

// 2つのURLが同じベースドメインかチェック
function isSameBaseDomain(url1, url2) {
  try {
    const host1 = new URL(url1).hostname;
    const host2 = new URL(url2).hostname;
    return getBaseDomain(host1) === getBaseDomain(host2);
  } catch {
    return false;
  }
}

// URLが認証関連かどうかをチェック
function isAuthUrl(url) {
  try {
    const urlObj = new URL(url);
    return authDomains.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// 認証ポップアップウィンドウを作成
function createAuthWindow(url, contents) {
  const mainWindow = getMainWindow();
  const originalSession = contents.session;

  const authWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      session: originalSession
    }
  });

  authWindow.loadURL(url);

  // 認証完了を検知（サービスのメインURLにリダイレクトされたら）
  authWindow.webContents.on('will-redirect', (e, redirectUrl) => {
    if (isServiceMainUrl(redirectUrl)) {
      authWindow.close();
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.webContents.send('auth-completed', redirectUrl);
      }
    }
  });

  authWindow.webContents.on('did-navigate', (e, navigatedUrl) => {
    if (isServiceMainUrl(navigatedUrl)) {
      authWindow.close();
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.webContents.send('auth-completed', navigatedUrl);
      }
    }
  });
}

// 認証ポップアップウィンドウのハンドラーを設定
function setupWindowOpenHandler(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    // 無効なURLやjavascript:は無視
    if (!url || url === 'about:blank' || url.startsWith('javascript:')) {
      return { action: 'deny' };
    }

    const currentUrl = contents.getURL();

    // 認証URLの場合は認証ポップアップで開く
    if (isAuthUrl(url)) {
      createAuthWindow(url, contents);
      return { action: 'deny' };
    }

    // 同じサービスのドメインの場合は認証ポップアップで開く（サービス内ポップアップ）
    if (isSameBaseDomain(url, currentUrl)) {
      createAuthWindow(url, contents);
      return { action: 'deny' };
    }

    // その他の外部リンクはデフォルトブラウザで開く
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ナビゲーションハンドラーを設定（外部リンクをデフォルトブラウザで開く）
function setupNavigationHandler(contents) {
  contents.on('will-navigate', (event, url) => {
    // webviewコンテンツのみ処理
    if (contents.getType() !== 'webview') return;

    const currentUrl = contents.getURL();

    // 同じベースドメインへのナビゲーションは許可
    if (isSameBaseDomain(url, currentUrl)) return;

    // 認証ドメインへのナビゲーションは許可
    if (isAuthUrl(url)) return;

    // サービスのメインURLへのナビゲーションは許可（認証完了後のリダイレクトなど）
    if (isServiceMainUrl(url)) return;

    // その他の外部URLはデフォルトブラウザで開く
    event.preventDefault();
    shell.openExternal(url);
  });
}

// コンテキストメニューを設定
function setupContextMenu(contents) {
  const mainWindow = getMainWindow();

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
          label: 'AIに送る',
          click: () => {
            const mainWin = getMainWindow();
            if (mainWin) {
              mainWin.webContents.send('send-to-ai', params.selectionText);
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
          label: 'リンクをブラウザで開く',
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
}

// web-contents-createdイベントで呼び出すセキュリティ設定
function setupWebContentsSecurity(contents) {
  setupWindowOpenHandler(contents);
  setupNavigationHandler(contents);
  setupContextMenu(contents);
}

module.exports = {
  setupWebContentsSecurity,
  isServiceMainUrl
};
