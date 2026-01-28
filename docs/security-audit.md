# Unitone セキュリティ監査レポート

**監査日時**: 2026-01-29T01:24:41
**監査対象**: Unitone v1.0.0
**Electron**: v35.7.5
**監査担当**: ashigaru4 (セキュリティエンジニア)

---

## エグゼクティブサマリー

| 重要度 | 件数 | 状態 |
|--------|------|------|
| 🔴 Critical | 0 | - |
| 🟠 High | 3 | 要対応 |
| 🟡 Medium | 2 | 推奨対応 |
| 🟢 Low | 2 | 検討推奨 |

**総評**: Electronのコアセキュリティ設定は適切に構成されている。主な懸念点はXSS脆弱性の可能性と依存パッケージの脆弱性である。

---

## 1. Electronセキュリティ設定

### 1.1 BrowserWindow設定 ✅ 良好

**ファイル**: `src/main/main.js:46-52`

```javascript
webPreferences: {
  preload: path.join(__dirname, '../preload/preload.js'),
  contextIsolation: true,    // ✅ 有効
  nodeIntegration: false,    // ✅ 無効
  webviewTag: true,          // ⚠️ 有効（機能上必要）
  backgroundThrottling: true
}
```

| 設定 | 値 | 評価 | 備考 |
|------|-----|------|------|
| contextIsolation | true | ✅ | メイン/レンダラー分離 |
| nodeIntegration | false | ✅ | Node.js API無効化 |
| webviewTag | true | ⚠️ | 機能上必要だがリスク認識要 |

### 1.2 認証ポップアップウィンドウ ✅ 良好

**ファイル**: `src/main/main.js:559-600`

認証用ポップアップも同様に安全な設定が適用されている:
- `nodeIntegration: false`
- `contextIsolation: true`

---

## 2. Content Security Policy (CSP)

### 2.1 現在の設定

**ファイル**: `src/renderer/index.html:6`

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' https: data: file:;">
```

### 2.2 評価

| ディレクティブ | 評価 | 備考 |
|----------------|------|------|
| default-src 'self' | ✅ | 適切 |
| script-src 'self' | ✅ | 外部スクリプト禁止 |
| style-src 'self' 'unsafe-inline' | 🟡 | unsafe-inline は潜在的リスク |
| img-src 'self' https: data: file: | ✅ | favicon等に必要 |

### 2.3 推奨事項 [Medium]

`unsafe-inline` を削除し、外部CSSファイルのみ使用を推奨。
動的スタイル変更が必要な場合は `nonce` または `hash` 方式を検討。

---

## 3. XSS脆弱性チェック

### 3.1 発見された問題 🟠 High

#### 問題1: 設定画面でのinnerHTML使用

**ファイル**: `src/renderer/renderer.js:694-707`

```javascript
item.innerHTML = `
  <div class="service-info">
    <span class="service-icon">${service.icon}</span>
    <div>
      <div class="service-name">${service.name}</div>
      <div class="service-url">${service.url}</div>
    </div>
  </div>
  ...
`;
```

**リスク**: ユーザーがカスタムサービスを追加する際、`service.name` や `service.url` に悪意あるスクリプトを含められる可能性。

**攻撃例**:
```
サービス名: <img src=x onerror="alert('XSS')">
```

#### 問題2: AIドロップダウンでのinnerHTML使用

**ファイル**: `src/renderer/renderer.js:268-277`

```javascript
list.innerHTML = this.aiServices.map(service => {
  return `
    <div class="ai-dropdown-item ${isActive ? 'active' : ''}" data-id="${service.id}">
      <span>${service.name}</span>
      ...
    </div>
  `;
}).join('');
```

**リスク**: 同上

### 3.2 安全に実装されている箇所 ✅

| ファイル | 行 | 方法 | 評価 |
|----------|-----|------|------|
| renderer.js | 89 | textContent | ✅ |
| renderer.js | 126-127 | JSON.stringify | ✅ |
| renderer.js | 375, 378 | JSON.stringify | ✅ |

### 3.3 修正提案

```javascript
// ユーティリティ関数を追加
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 使用例
item.innerHTML = `
  <div class="service-name">${escapeHtml(service.name)}</div>
  <div class="service-url">${escapeHtml(service.url)}</div>
`;
```

または、より安全なDOM API使用:

```javascript
const nameDiv = document.createElement('div');
nameDiv.className = 'service-name';
nameDiv.textContent = service.name;  // 自動的にエスケープ
```

---

## 4. Preloadスクリプトセキュリティ

### 4.1 preload.js ✅ 良好

**ファイル**: `src/preload/preload.js`

優れたセキュリティ実装:

1. **ホワイトリスト方式のIPCチャンネル制限**
```javascript
const ALLOWED_INVOKE_CHANNELS = [
  'get-services', 'add-service', ...
];
```

2. **安全なラッパー関数**
```javascript
const safeInvoke = (channel, ...args) => {
  if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
    return ipcRenderer.invoke(channel, ...args);
  }
  return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
};
```

3. **contextBridgeの適切な使用**

### 4.2 webview-preload.js ✅ 許容範囲

- `ipcRenderer.sendToHost` のみ使用
- Notification APIオーバーライドは通知検知のため（機能上必要）

---

## 5. 依存パッケージの脆弱性

### 5.1 npm audit 結果 🟠 High

```
21 vulnerabilities (1 low, 20 high)
```

### 5.2 主な脆弱性

| パッケージ | 重要度 | 脆弱性 | 影響 |
|------------|--------|--------|------|
| tar | High | Arbitrary File Overwrite, Symlink Poisoning | ビルド時 |
| glob | High | Command Injection via CLI | ビルド時 |
| diff | Moderate | DoS in parsePatch | ビルド時 |

### 5.3 影響範囲

これらの脆弱性は主に **開発時・ビルド時** の依存関係（semantic-release, electron-builder）に存在する。
**本番環境での直接的なリスクは限定的** だが、CI/CDパイプラインや開発環境が攻撃対象となる可能性がある。

### 5.4 修正方法

```bash
# 自動修正可能なもの
npm audit fix

# Breaking changeを含む修正
npm audit fix --force
# ※ semantic-release 21.1.2, electron-builder 26.6.0 へダウングレード
```

**推奨**: `package-lock.json` を更新し、互換性をテストした上で修正を適用。

---

## 6. URLバリデーション ✅ 良好

### 6.1 サービスURL更新時のバリデーション

**ファイル**: `src/main/main.js:288-311`

```javascript
try {
  const parsedUrl = new URL(url);
  // http/httpsのみ許可
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    console.error('Invalid update-service-url request: invalid protocol');
    return store.get('services');
  }
} catch {
  console.error('Invalid update-service-url request: invalid URL format');
  return store.get('services');
}
```

✅ `javascript:` や `file:` プロトコルを適切にブロック

### 6.2 favicon URL検証

**ファイル**: `src/renderer/renderer.js:494-502`

```javascript
isValidFaviconUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'data:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}
```

✅ `javascript:` プロトコルをブロック

---

## 7. その他のセキュリティ考慮事項

### 7.1 electron-store 🟢 Low

設定データは暗号化されずにローカルに保存される。
機密情報（APIキー等）を保存する場合は `encryptionKey` オプションの使用を検討。

### 7.2 外部リンク処理 ✅ 良好

`shell.openExternal()` で外部ブラウザを開く実装は適切。

---

## 8. 推奨対応一覧

### 優先度: 高 🟠

| # | 問題 | 対応 | 影響箇所 |
|---|------|------|----------|
| 1 | XSS脆弱性（innerHTML） | HTMLエスケープ関数の導入 | renderer.js |
| 2 | 依存パッケージ脆弱性 | npm audit fix 実行 | package.json |
| 3 | XSS脆弱性（AIドロップダウン） | HTMLエスケープ関数の導入 | renderer.js |

### 優先度: 中 🟡

| # | 問題 | 対応 | 影響箇所 |
|---|------|------|----------|
| 4 | CSP unsafe-inline | 外部CSS移行またはnonce使用 | index.html |
| 5 | Input validation強化 | フロントエンドでも入力検証追加 | renderer.js |

### 優先度: 低 🟢

| # | 問題 | 対応 | 影響箇所 |
|---|------|------|----------|
| 6 | electron-store暗号化 | 機密データ保存時に検討 | main.js |
| 7 | ログ出力のサニタイズ | ユーザー入力のログ出力時に注意 | 全体 |

---

## 9. 結論

Unitoneは **Electronセキュリティのベストプラクティスに概ね準拠** している。
特に `contextIsolation` と `nodeIntegration` の設定、preloadスクリプトでのホワイトリスト方式は優秀である。

**最優先で対応すべき** は、innerHTMLを使用した箇所でのXSS脆弱性対策である。
これはユーザー入力を適切にエスケープすることで解決可能。

依存パッケージの脆弱性は開発環境に限定されるが、サプライチェーン攻撃のリスクを考慮し、
定期的な `npm audit` の実行と更新を推奨する。

---

**監査完了**
