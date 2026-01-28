# 自動更新機能 実装計画書

> **作成日**: 2026-01-29
> **タスクID**: subtask_007
> **担当**: ashigaru7

## 1. 概要

Unitoneに自動更新機能を実装し、ユーザーが常に最新バージョンを利用できるようにする。

### 1.1 現状分析

| 項目 | 現在の状態 |
|------|-----------|
| Electron | v35.7.5 |
| electron-builder | v25.0.0 |
| semantic-release | v24.0.0（設定済み） |
| 自動更新 | 未実装 |

### 1.2 目標

- GitHub Releasesと連携した自動更新
- Windows/macOS両対応
- ユーザーフレンドリーな更新通知UI
- バックグラウンドでの更新ダウンロード

---

## 2. electron-updater 導入方法

### 2.1 パッケージインストール

```bash
npm install electron-updater
```

### 2.2 依存関係

```json
{
  "dependencies": {
    "electron-updater": "^6.3.0"
  }
}
```

**注意**: `electron-updater`は`dependencies`に追加（`devDependencies`ではない）

### 2.3 package.json への設定追加

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "shngmsw",
      "repo": "Unitone"
    }
  }
}
```

---

## 3. GitHub Releases 連携方法

### 3.1 必要な設定

#### 3.1.1 GitHub Personal Access Token (PAT)

リリース用に`GH_TOKEN`環境変数が必要:

```bash
export GH_TOKEN=your_github_token
```

必要な権限:
- `repo` (プライベートリポジトリの場合)
- `public_repo` (パブリックリポジトリの場合)

#### 3.1.2 semantic-release との統合

既存の`semantic-release`設定を拡張:

```json
{
  "release": {
    "branches": ["main"],
    "plugins": [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      ["@semantic-release/npm", { "npmPublish": false }],
      "@semantic-release/github"
    ]
  }
}
```

### 3.2 リリースフロー

```
1. mainブランチへプッシュ
   ↓
2. semantic-releaseがバージョン決定
   ↓
3. electron-builderがビルド実行
   ↓
4. GitHub Releasesにアセットアップロード
   ↓
5. アプリがupdaterで更新チェック
```

### 3.3 GitHub Actions ワークフロー（推奨）

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build and Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS署名用（オプション）
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          # Apple公証用（オプション）
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
        run: npm run build
```

---

## 4. コード変更概要

### 4.1 新規ファイル

#### `src/main/updater.js`

```javascript
const { autoUpdater } = require('electron-updater');
const { ipcMain, BrowserWindow } = require('electron');

// ログ設定
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// 自動ダウンロード設定
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function initAutoUpdater(mainWindow) {
  // 更新チェック（起動時）
  autoUpdater.checkForUpdates();

  // イベントハンドラー
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow(mainWindow, 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow(mainWindow, 'available', info);
  });

  autoUpdater.on('update-not-available', () => {
    sendStatusToWindow(mainWindow, 'not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToWindow(mainWindow, 'progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow(mainWindow, 'downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow(mainWindow, 'error', err.message);
  });
}

function sendStatusToWindow(mainWindow, status, data = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, data });
  }
}

// IPCハンドラー
ipcMain.handle('check-for-updates', () => {
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('download-update', () => {
  return autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-current-version', () => {
  return autoUpdater.currentVersion.version;
});

module.exports = { initAutoUpdater };
```

### 4.2 main.js への統合

```javascript
// main.js に追加
const { initAutoUpdater } = require('./updater');

app.whenReady().then(async () => {
  // 既存のコード...

  createWindow();
  createTray();

  // 自動更新の初期化（開発モードでは無効）
  if (!process.argv.includes('--dev')) {
    initAutoUpdater(mainWindow);
  }
});
```

### 4.3 preload.js への追加

```javascript
// preload.js に追加
contextBridge.exposeInMainWorld('updater', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  }
});
```

---

## 5. 更新通知UI 設計案

### 5.1 UI コンポーネント

#### 5.1.1 更新通知バナー

```
┌─────────────────────────────────────────────────────┐
│ 🔄 新しいバージョン v1.2.0 が利用可能です          │
│                                                     │
│ [後で]  [ダウンロード]                              │
└─────────────────────────────────────────────────────┘
```

#### 5.1.2 ダウンロード進捗

```
┌─────────────────────────────────────────────────────┐
│ ⬇️ ダウンロード中... 45%                            │
│ ████████████░░░░░░░░░░░░                            │
│                                                     │
│ [キャンセル]                                        │
└─────────────────────────────────────────────────────┘
```

#### 5.1.3 インストール準備完了

```
┌─────────────────────────────────────────────────────┐
│ ✅ アップデートの準備ができました                   │
│                                                     │
│ 再起動すると v1.2.0 がインストールされます          │
│                                                     │
│ [後で再起動]  [今すぐ再起動]                        │
└─────────────────────────────────────────────────────┘
```

### 5.2 トースト通知（非侵襲的）

- 右下に表示
- 5秒後に自動で消える
- クリックで詳細表示

### 5.3 設定画面への追加

```
設定 > アップデート
├── 自動で更新をチェック: [ON/OFF]
├── バックグラウンドでダウンロード: [ON/OFF]
├── 現在のバージョン: v1.0.0
└── [今すぐ更新を確認]
```

---

## 6. プラットフォーム別の動作確認事項

### 6.1 Windows

| 確認項目 | 詳細 |
|---------|------|
| NSISインストーラー | 更新時にインストーラーが正常起動するか |
| UAC昇格 | 管理者権限なしでも更新できるか（perMachine: false） |
| 差分更新 | blockmap使用時の差分ダウンロード |
| プロセス終了 | 更新時にアプリが正常終了するか |
| ショートカット | 更新後もショートカットが維持されるか |

### 6.2 macOS

| 確認項目 | 詳細 |
|---------|------|
| DMG/ZIP | 更新ファイル形式の動作確認 |
| コード署名 | 署名済みアプリの更新 |
| 公証（Notarization） | Apple公証済みの更新 |
| Gatekeeper | 初回起動時の警告表示 |
| Apple Silicon | arm64/x64両対応 |

### 6.3 共通確認事項

| 確認項目 | 詳細 |
|---------|------|
| ネットワークエラー | オフライン時の挙動 |
| 途中キャンセル | ダウンロード中断と再開 |
| ダウングレード防止 | 古いバージョンへの更新防止 |
| 設定の保持 | 更新後もユーザー設定が維持されるか |

---

## 7. 推奨アーキテクチャ

### 7.1 ファイル構成（実装後）

```
src/
├── main/
│   ├── main.js          # メインプロセス（updater初期化を追加）
│   └── updater.js       # 【新規】自動更新モジュール
├── preload/
│   └── preload.js       # IPCブリッジ（updater追加）
└── renderer/
    ├── index.html
    ├── styles.css
    └── renderer.js      # UI更新通知（追加）
```

### 7.2 データフロー

```
┌──────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ updater.js  │───▶│ autoUpdater │───▶│  GitHub     │  │
│  │             │◀───│  (events)   │◀───│  Releases   │  │
│  └──────┬──────┘    └─────────────┘    └─────────────┘  │
│         │ IPC                                            │
└─────────┼────────────────────────────────────────────────┘
          │
┌─────────▼────────────────────────────────────────────────┐
│                   Renderer Process                        │
│  ┌─────────────┐    ┌─────────────┐                      │
│  │ preload.js  │───▶│ renderer.js │                      │
│  │ (bridge)    │    │ (UI更新)    │                      │
│  └─────────────┘    └─────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### 7.3 更新チェックのタイミング

1. **アプリ起動時**: 30秒後に初回チェック
2. **定期チェック**: 6時間ごと（バックグラウンド）
3. **手動チェック**: ユーザー操作時

```javascript
// 推奨実装
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6時間

setTimeout(() => autoUpdater.checkForUpdates(), 30000);
setInterval(() => autoUpdater.checkForUpdates(), CHECK_INTERVAL);
```

---

## 8. セキュリティ考慮事項

### 8.1 必須対応

| 項目 | 対応方法 |
|------|---------|
| コード署名 | Windows: EV証明書推奨 / macOS: Developer ID |
| HTTPS | GitHub Releasesは標準でHTTPS |
| チェックサム | electron-builderが自動生成 |

### 8.2 推奨対応

- 更新サーバーのSSL証明書検証
- ダウンロードファイルの整合性チェック
- 更新ログの保存

---

## 9. 実装ステップ

### Phase 1: 基本機能（優先度: 高）

1. `electron-updater`のインストール
2. `updater.js`の作成
3. `main.js`への統合
4. package.jsonのpublish設定追加

### Phase 2: UI実装（優先度: 中）

1. 更新通知UIコンポーネント
2. 進捗表示
3. 設定画面への追加

### Phase 3: CI/CD（優先度: 中）

1. GitHub Actionsワークフロー作成
2. 署名設定（Windows/macOS）
3. テストリリース

### Phase 4: 品質保証（優先度: 高）

1. 各プラットフォームでのテスト
2. エラーハンドリング強化
3. ドキュメント整備

---

## 10. 参考リソース

- [electron-updater 公式ドキュメント](https://www.electron.build/auto-update)
- [electron-builder publish設定](https://www.electron.build/configuration/publish)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [semantic-release](https://semantic-release.gitbook.io/)

---

## 11. 備考

### 11.1 既存コードとの親和性

- `electron-store`による設定管理と互換性あり
- 既存のIPC通信パターンを踏襲
- semantic-releaseが既に設定済みのため、統合が容易

### 11.2 注意点

- macOSでの公証（Notarization）は別途Apple Developer登録が必要
- Windows署名にはコード署名証明書が必要（EV証明書推奨）
- プライベートリポジトリの場合、`GH_TOKEN`に適切な権限が必要
