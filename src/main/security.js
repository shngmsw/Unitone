const { BrowserWindow, Menu, shell, clipboard } = require('electron');
const { getMainWindow } = require('./window');

// サービスのメインURL（認証完了の判定に使用）
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

// 認証ポップアップウィンドウのハンドラーを設定
function setupWindowOpenHandler(contents) {
  const mainWindow = getMainWindow();

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

    return { action: 'deny' };
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
}

// web-contents-createdイベントで呼び出すセキュリティ設定
function setupWebContentsSecurity(contents) {
  setupWindowOpenHandler(contents);
  setupContextMenu(contents);
}

module.exports = {
  setupWebContentsSecurity,
  isServiceMainUrl
};
