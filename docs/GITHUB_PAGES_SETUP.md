# GitHub Pages 設定手順書

> **作成日**: 2026-01-29
> **対象リポジトリ**: shngmsw/Unitone

## 概要

本書はUnitoneプロジェクトのドキュメントサイトをGitHub Pagesで公開するための手順を説明する。

---

## 1. GitHub Pages の有効化

### 1.1 Settings ページへのアクセス

1. GitHubでリポジトリ（`shngmsw/Unitone`）を開く
2. 上部メニューの **Settings** タブをクリック
3. 左サイドバーの **Pages** をクリック

### 1.2 ソースの設定

GitHub Pagesには2つの公開方法がある。

#### 方法A: ブランチからデプロイ（推奨・シンプル）

静的HTMLファイルを直接公開する場合：

1. **Source** セクションで以下を設定：
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`（または `gh-pages`）
   - **Folder**: `/docs`（ドキュメントフォルダ）
2. **Save** をクリック

> **注意**: `/docs/site` フォルダを公開する場合、ルートに `docs/site/index.html` が必要。
> GitHubの設定では `/` または `/docs` のみ選択可能なため、`/docs` を選択し、
> `docs/index.html` から `site/` へリダイレクトするか、`docs/` 直下にファイルを配置する。

#### 方法B: GitHub Actions からデプロイ（高度な制御）

ビルドプロセスが必要な場合（Jekyll、MkDocs等）：

1. **Source** セクションで以下を設定：
   - **Source**: `GitHub Actions`
2. ワークフローテンプレートを選択、またはカスタムワークフローを作成

**カスタムワークフロー例** (`.github/workflows/pages.yml`):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'docs/site'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 1.3 設定の反映を待つ

- 設定後、数分待つとデプロイが完了する
- **Actions** タブでデプロイ状況を確認可能

---

## 2. 公開URLの確認

### 2.1 デフォルトURL

GitHub Pagesは以下の形式でURLが生成される：

```
https://<username>.github.io/<repository>/
```

Unitoneの場合：
```
https://shngmsw.github.io/Unitone/
```

### 2.2 URLの確認方法

1. **Settings** > **Pages** を開く
2. 上部に「Your site is live at ...」と表示される
3. **Visit site** ボタンをクリックで確認

### 2.3 サブパスについて

- `/docs` フォルダを公開した場合、`docs/` 内のファイルがルートになる
- 例: `docs/site/index.html` → `https://shngmsw.github.io/Unitone/site/index.html`

---

## 3. カスタムドメイン設定（オプション）

独自ドメイン（例: `unitone.example.com`）を使用する場合。

### 3.1 DNSレコードの設定

ドメインのDNS管理画面で以下を設定：

#### Apex ドメイン（example.com）の場合

Aレコードを追加：
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

#### サブドメイン（docs.example.com）の場合

CNAMEレコードを追加：
```
CNAME  docs  shngmsw.github.io
```

### 3.2 GitHub側の設定

1. **Settings** > **Pages** を開く
2. **Custom domain** にドメインを入力（例: `unitone.example.com`）
3. **Save** をクリック
4. DNS確認が完了するまで待つ（最大24時間）

### 3.3 HTTPS の強制

1. DNS確認完了後、**Enforce HTTPS** にチェックを入れる
2. Let's Encryptにより自動でSSL証明書が発行される

### 3.4 CNAME ファイルの自動作成

カスタムドメイン設定時、リポジトリに `CNAME` ファイルが自動作成される：

```
docs/CNAME
```

内容：
```
unitone.example.com
```

> **注意**: このファイルを削除するとカスタムドメイン設定が解除される。

---

## 4. トラブルシューティング

### 4.1 404エラーが表示される

**原因と対処**:
- `index.html` が存在しない → ルートに `index.html` を作成
- パスが間違っている → フォルダ設定を確認
- デプロイが完了していない → Actions タブで状況確認

### 4.2 CSSやJSが読み込まれない

**原因と対処**:
- 相対パスの問題 → 絶対パス（`/Unitone/css/style.css`）に変更
- ベースパスの設定漏れ → `<base href="/Unitone/">` をHTMLに追加

### 4.3 更新が反映されない

**原因と対処**:
- キャッシュ → ブラウザのキャッシュをクリア（Ctrl+Shift+R）
- CDNキャッシュ → 10分程度待つ
- ビルドエラー → Actions タブでログを確認

### 4.4 カスタムドメインが機能しない

**原因と対処**:
- DNS伝播待ち → 最大24-48時間待つ
- CNAME削除 → `docs/CNAME` ファイルが存在するか確認
- DNS設定ミス → `dig` や `nslookup` で確認

```bash
# DNS確認コマンド
dig unitone.example.com +short
nslookup unitone.example.com
```

---

## 5. 推奨構成

### 5.1 シンプルな静的サイト

```
docs/
├── index.html          # トップページ
├── CNAME               # カスタムドメイン用（オプション）
└── site/
    ├── index.html      # ドキュメントトップ
    ├── css/
    │   └── style.css
    └── js/
        └── main.js
```

### 5.2 GitHub Pages設定

| 項目 | 設定値 |
|------|--------|
| Source | Deploy from a branch |
| Branch | main |
| Folder | /docs |

---

## 参考リンク

- [GitHub Pages ドキュメント](https://docs.github.com/ja/pages)
- [カスタムドメインの設定](https://docs.github.com/ja/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GitHub Actions でのデプロイ](https://docs.github.com/ja/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)
