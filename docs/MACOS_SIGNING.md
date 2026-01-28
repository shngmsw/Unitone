# macOS コード署名・公証 セットアップガイド

macOSでアプリを配布するには、Apple Developer証明書による署名とAppleへの公証（notarization）が必要です。
このドキュメントでは、GitHub ActionsでmacOSビルドの署名・公証を有効にする手順を説明します。

## 前提条件

- **Apple Developer Program** への登録（年間 $99 USD）
  - https://developer.apple.com/programs/

## 1. Developer ID Application 証明書の作成

1. [Apple Developer](https://developer.apple.com/account) にログイン
2. **Certificates, Identifiers & Profiles** > **Certificates** に移動
3. **+** ボタンをクリックして新しい証明書を作成
4. **Software** セクションの **Developer ID Application** を選択
5. CSR（Certificate Signing Request）をアップロード
   - macOSの「キーチェーンアクセス」アプリで作成可能
6. 証明書をダウンロード（.cerファイル）

## 2. 証明書を .p12 形式でエクスポート

1. ダウンロードした .cer ファイルをダブルクリックしてキーチェーンにインストール
2. 「キーチェーンアクセス」アプリを開く
3. 左側で「自分の証明書」を選択
4. **Developer ID Application: ...** 証明書を右クリック
5. **書き出す** を選択
6. **.p12** 形式で保存し、パスワードを設定

## 3. App-specific Password の作成

Apple IDの2要素認証を使用している場合、公証には専用のパスワードが必要です。

1. [appleid.apple.com](https://appleid.apple.com) にログイン
2. **サインインとセキュリティ** > **アプリ用パスワード** に移動
3. **アプリ用パスワードを生成** をクリック
4. 名前を入力（例: "Unitone Notarization"）
5. 生成されたパスワードをコピー（一度だけ表示されます）

## 4. Team ID の確認

1. [Apple Developer](https://developer.apple.com/account) にログイン
2. **Membership** セクションを開く
3. **Team ID** をコピー（10文字の英数字）

## 5. GitHub Secrets の設定

リポジトリの **Settings** > **Secrets and variables** > **Actions** で以下のシークレットを追加:

| シークレット名 | 説明 |
|--------------|------|
| `CSC_LINK` | .p12 証明書ファイルをBase64エンコードした文字列 |
| `CSC_KEY_PASSWORD` | .p12 ファイルのパスワード |
| `APPLE_ID` | Apple Developer アカウントのメールアドレス |
| `APPLE_ID_PASSWORD` | App-specific password（手順3で作成） |
| `APPLE_TEAM_ID` | Team ID（手順4で確認） |

### CSC_LINK の作成方法

ターミナルで以下のコマンドを実行:

```bash
base64 -i certificate.p12 | pbcopy
```

これでBase64エンコードされた証明書がクリップボードにコピーされます。
それを `CSC_LINK` シークレットの値として貼り付けてください。

## 6. ローカルビルドでの署名・公証

ローカルでmacOSビルドを署名・公証する場合は、環境変数を設定してビルドを実行:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

npm run build:mac
```

証明書はキーチェーンに既にインストールされていれば、electron-builderが自動的に検出します。

## トラブルシューティング

### 「Apple cannot check it for malicious software」エラー

署名または公証が正しく行われていません。以下を確認:

1. GitHub Secretsが正しく設定されているか
2. 証明書が有効期限内か
3. Team IDが正しいか

### 公証がタイムアウトする

Appleの公証サーバーが混雑している可能性があります。数分後に再試行してください。

### 「The signature is invalid」エラー

entitlements設定が正しくない可能性があります。`assets/mac/entitlements.mac.plist` を確認してください。

## 参考リンク

- [Apple Developer Documentation - Notarizing macOS Software Before Distribution](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [@electron/notarize](https://github.com/electron/notarize)
