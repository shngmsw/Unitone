# Windows公開手順書

> **作成日**: 2026-01-29
> **対象アプリ**: Unitone (Electron v35.7.5 / electron-builder v25.0.0)

## 概要

本書はUnitoneをWindows向けに配布するための手順書である。以下の2つの配布方法について説明する：

1. **Microsoft Store公開** - ストア経由での配布（推奨）
2. **直接配布** - Webサイト等からの直接ダウンロード

---

## 1. Microsoft Store公開

### 1.1 必要な費用

| 項目 | 費用 | 備考 |
|------|------|------|
| Microsoft開発者アカウント（個人） | $19（約2,900円） | **1回限り**、更新不要 |
| Microsoft開発者アカウント（企業） | $99（約15,000円） | **1回限り**、更新不要 |
| コード署名証明書 | **不要** | ストア提出時にMicrosoftが署名 |

### 1.2 必要期間

| フェーズ | 期間 |
|----------|------|
| 開発者アカウント登録 | 1-2日（本人確認含む） |
| パッケージ準備 | 1日 |
| Microsoft審査 | 2-3営業日 |
| **合計** | **約1週間** |

### 1.3 事前準備チェックリスト

- [ ] Microsoft アカウントの作成
- [ ] Microsoft Partner Center への開発者登録
- [ ] アプリ名の予約（「Unitone」）
- [ ] Product Identity情報の取得

### 1.4 アセット準備

以下のアイコン/画像を `assets/appx/` に配置：

| ファイル名 | サイズ | 用途 |
|------------|--------|------|
| StoreLogo.png | 50x50px | ストアロゴ |
| Square44x44Logo.png | 44x44px | タイルアイコン |
| Square150x150Logo.png | 150x150px | タイルアイコン |
| Wide310x150Logo.png | 310x150px | ワイドタイル |
| LargeTile.png | 310x310px | ラージタイル |

### 1.5 package.json の設定

```json
{
  "build": {
    "appx": {
      "identityName": "XXXXX.Unitone",
      "publisher": "CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
      "publisherDisplayName": "Your Publisher Name",
      "applicationId": "Unitone",
      "displayName": "Unitone",
      "languages": ["ja-JP", "en-US"],
      "backgroundColor": "#464646"
    },
    "win": {
      "target": [
        {
          "target": "appx",
          "arch": ["x64"]
        }
      ]
    }
  }
}
```

**注意**: `identityName`, `publisher`, `publisherDisplayName` は Partner Center の「Product Identity」ページから取得した値を使用すること。

### 1.6 ビルドコマンド

```bash
# AppXパッケージのビルド
npm run build -- --win appx
```

### 1.7 提出手順

1. Partner Center にログイン
2. 「アプリとゲーム」→「新しいアプリ」
3. アプリ名を予約
4. Product Identity から以下をコピー：
   - Package/Identity/Name
   - Package/Identity/Publisher
   - Package/Identity/PublisherDisplayName
5. package.json に設定を反映
6. ビルド実行
7. Partner Center で「申請の開始」
8. 「パッケージ」セクションで .appx ファイルをアップロード
9. ストア登録情報（説明文、スクリーンショット等）を入力
10. 「ストアに提出」

### 1.8 runFullTrust 警告への対応

審査中に「runFullTrust capability が必要な理由」を問われた場合：

> "This is an Electron application that requires full trust to function properly as a desktop application."

と回答する。

---

## 2. 直接配布（Webサイト等）

### 2.1 コード署名が必要な理由

直接配布の場合、コード署名なしだと：
- Windows SmartScreen が警告を表示
- 「WindowsによってPCが保護されました」と表示
- ユーザーが「詳細情報」→「実行」を選択する必要がある

### 2.2 コード署名証明書の種類

| 種類 | 費用/年 | 特徴 |
|------|---------|------|
| OV証明書 | $200-300 | 基本的な検証。SmartScreen警告は徐々に減少 |
| EV証明書 | $300-500 | 拡張検証。以前は即時信頼されたが、2024年3月以降は段階的信頼に変更 |

**注意**: 2023年6月以降、いずれの証明書もハードウェアトークン（USB）での保管が必須（FIPS 140-2 Level 2準拠）。

### 2.3 証明書プロバイダーと費用

#### 従来の証明書プロバイダー

| プロバイダー | OV証明書（1年） | EV証明書（1年） | 備考 |
|--------------|-----------------|-----------------|------|
| DigiCert | $474 | $699 | 大手・信頼性高 |
| Sectigo | $299 | $399 | コスパ良好 |
| SSL.com | $249 | $319 | 最安クラス |
| SignMyCode | $216 | $280 | リセラー価格 |

**追加費用**:
- ハードウェアトークン: $50-100
- 送料: $30-50

#### Azure Trusted Signing（推奨）

| プラン | 月額費用 | 含まれる署名数 | 超過料金 |
|--------|----------|----------------|----------|
| Basic | $9.99 | 5,000回 | $0.005/回 |
| Premium | $99.99 | 100,000回 | $0.005/回 |

**メリット**:
- ハードウェアトークン不要
- クラウドベースで管理が容易
- SmartScreen即時信頼（Microsoftサービスのため）

**制約**:
- 利用可能地域: 米国、カナダ、EU、英国
- 法人の場合: 3年以上の税務履歴が必要
- 個人の場合: 米国またはカナダ居住者のみ

### 2.4 electron-builder での署名設定

#### 環境変数方式（PFXファイル使用）

```bash
# Linux/macOS
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password

# Windows (PowerShell)
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your_password"
```

#### package.json での設定（EV証明書）

```json
{
  "build": {
    "win": {
      "certificateSubjectName": "Your Company Name",
      "certificateSha1": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "signingHashAlgorithms": ["sha256"],
      "publisherName": "Your Company Name"
    }
  }
}
```

#### Azure Trusted Signing の設定

1. Azure Portal で Trusted Signing アカウントを作成
2. 証明書プロファイルを作成
3. カスタム署名スクリプトを作成

```javascript
// sign.js
const { execSync } = require('child_process');

exports.default = async function(configuration) {
  const filePath = configuration.path;

  execSync(`AzureSignTool sign -kvu "https://your-vault.vault.azure.net" -kvc "your-cert-name" -tr "http://timestamp.digicert.com" -td sha256 "${filePath}"`, {
    stdio: 'inherit'
  });
};
```

```json
{
  "build": {
    "win": {
      "sign": "./sign.js"
    }
  }
}
```

### 2.5 署名の確認

```powershell
# PowerShellで署名を確認
Get-AuthenticodeSignature ".\dist\Unitone Setup 1.0.0.exe"
```

---

## 3. 費用見積もり比較

### シナリオA: Microsoft Store のみ（推奨）

| 項目 | 初期費用 | 年間費用 |
|------|----------|----------|
| 開発者アカウント（個人） | $19 | $0 |
| 証明書 | 不要 | 不要 |
| **合計** | **$19（約2,900円）** | **$0** |

### シナリオB: 直接配布（Azure Trusted Signing）

| 項目 | 初期費用 | 年間費用 |
|------|----------|----------|
| Azure Trusted Signing (Basic) | $0 | $120（$9.99×12） |
| **合計** | **$0** | **$120（約18,000円）** |

### シナリオC: 直接配布（従来のOV証明書）

| 項目 | 初期費用 | 年間費用 |
|------|----------|----------|
| OV証明書（SSL.com） | $249 | $249 |
| ハードウェアトークン | $50 | $0 |
| 送料 | $40 | $0 |
| **合計** | **$339（約51,000円）** | **$249（約37,000円）** |

### シナリオD: 両方（Store + 直接配布）

| 項目 | 初期費用 | 年間費用 |
|------|----------|----------|
| 開発者アカウント | $19 | $0 |
| Azure Trusted Signing | $0 | $120 |
| **合計** | **$19（約2,900円）** | **$120（約18,000円）** |

---

## 4. 推奨アプローチ

### フェーズ1: Microsoft Store公開（即時）

1. Microsoft 開発者アカウント登録（$19）
2. AppX パッケージの作成
3. ストアに提出
4. 審査通過後、公開

### フェーズ2: 直接配布の検討（必要に応じて）

ストア外での配布が必要になった場合：
- Azure Trusted Signing の導入を検討
- 月額$9.99からスタート可能

---

## 5. 手続きチェックリスト

### Microsoft Store公開

- [ ] Microsoft アカウント作成
- [ ] Partner Center 開発者登録（$19支払い）
- [ ] 本人確認完了
- [ ] アプリ名「Unitone」予約
- [ ] Product Identity 取得
- [ ] ストア用アセット作成（ロゴ、スクリーンショット）
- [ ] package.json に appx 設定追加
- [ ] AppX パッケージビルド
- [ ] Windows App Certification Kit でテスト
- [ ] Partner Center に申請提出
- [ ] 審査対応（runFullTrust警告等）
- [ ] 公開完了

### 直接配布（オプション）

- [ ] 証明書プロバイダー選定
- [ ] 証明書購入・発行
- [ ] electron-builder 署名設定
- [ ] テスト署名・検証
- [ ] 本番ビルド・配布

---

## 参考リンク

- [Windows Store Guide | Electron](https://www.electronjs.org/docs/latest/tutorial/windows-store-guide)
- [AppX - electron-builder](https://www.electron.build/appx.html)
- [Code Signing - electron-builder](https://www.electron.build/code-signing.html)
- [Azure Trusted Signing](https://azure.microsoft.com/en-us/products/artifact-signing)
- [Microsoft Partner Center](https://partner.microsoft.com/)
