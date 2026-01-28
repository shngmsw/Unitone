# Mac公開手順書 - Unitone

## 概要

本ドキュメントでは、UnitoneをmacOSで配布するための2つの方法と、それぞれの要件・手順を説明する。

## 配布方法の比較

| 項目 | 直接配布（DMG/ZIP） | Mac App Store |
|------|---------------------|---------------|
| 初期費用 | $99/年（Apple Developer Program） | $99/年（同左） |
| 審査 | なし（自動公証のみ） | Appleによる審査あり |
| 審査期間 | 数分〜数時間（公証） | 1〜7日（審査） |
| サンドボックス | 不要 | 必須 |
| 更新の自由度 | 自由 | 審査が必要 |
| 発見しやすさ | 低い（自サイト等で配布） | 高い（Store検索） |
| 支払い処理 | 自前で実装 | Apple経由（手数料15-30%） |

### 推奨

**直接配布を推奨**。理由：
- Unitoneは無料アプリであり、Store手数料の問題がない
- サンドボックス制約により、一部機能が制限される可能性
- 審査なしで迅速な更新が可能
- 既存ドキュメント（MACOS_SIGNING.md）で設定済み

Mac App Storeは将来的にユーザー数拡大を狙う場合に検討。

---

## セクション1: Apple Developer Program 登録

### 登録要件

#### 個人の場合
- Apple ID（2ファクタ認証有効）
- 本人確認書類
- クレジットカード/デビットカード

#### 法人の場合
- Apple ID（2ファクタ認証有効）
- D-U-N-S番号（企業識別番号）
- 法的な契約を結ぶ権限を持つ担当者
- 組織のWebサイト

### 登録手順

1. [Apple Developer Program](https://developer.apple.com/programs/) にアクセス
2. 「登録」をクリック
3. Apple IDでサインイン
4. 開発者情報を入力
5. 年会費を支払い（$99 USD）
6. 承認を待つ（通常48時間以内）

### 費用詳細

| 項目 | 費用 | 備考 |
|------|------|------|
| Apple Developer Program | $99/年 | 約15,000円（為替による） |
| D-U-N-S番号取得 | 無料 | 法人のみ必要、取得に2-4週間 |

---

## セクション2: 直接配布（推奨）

既存の `docs/MACOS_SIGNING.md` を参照。主な手順は以下：

### 必要な証明書
- **Developer ID Application** - アプリの署名
- **Developer ID Installer** - インストーラー（PKG）の署名（任意）

### 設定済み項目（package.json）
```json
{
  "mac": {
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "assets/mac/entitlements.mac.plist",
    "entitlementsInherit": "assets/mac/entitlements.mac.inherit.plist"
  }
}
```

### 公証（Notarization）

macOS 10.15（Catalina）以降、公証が必須。electron-builderが自動で処理。

必要な環境変数：
```bash
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App-specific password
APPLE_TEAM_ID=XXXXXXXXXX
```

---

## セクション3: Mac App Store 公開

### 追加要件

Mac App Storeでは直接配布より厳しい要件がある。

#### 1. サンドボックス必須
- 全てのMASアプリはApp Sandbox内で動作
- ファイルアクセス、ネットワーク等に制限
- `mas`ターゲットでビルドが必要

#### 2. 追加証明書
| 証明書 | 用途 |
|--------|------|
| 3rd Party Mac Developer Application | アプリの署名 |
| 3rd Party Mac Developer Installer | インストーラーの署名 |
| Apple Distribution | 配布用署名（代替） |
| Provisioning Profile | アプリの識別 |

#### 3. Electronバージョン要件
- Electron 8.0.2以上が必須
- 現在使用中: Electron 35.7.5（OK）

### electron-builder 設定（MAS用）

```json
{
  "mac": {
    "target": [
      {
        "target": "mas",
        "arch": ["x64", "arm64"]
      }
    ],
    "category": "public.app-category.productivity",
    "entitlements": "assets/mac/entitlements.mas.plist",
    "entitlementsInherit": "assets/mac/entitlements.mas.inherit.plist",
    "provisioningProfile": "embedded.provisionprofile"
  },
  "mas": {
    "entitlements": "assets/mac/entitlements.mas.plist",
    "entitlementsInherit": "assets/mac/entitlements.mas.inherit.plist",
    "hardenedRuntime": false
  }
}
```

### MAS用 Entitlements ファイル

`assets/mac/entitlements.mas.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### App Store Connect 設定

1. [App Store Connect](https://appstoreconnect.apple.com/) にログイン
2. 「マイApp」→「+」→「新規App」
3. 以下を設定：
   - アプリ名: Unitone
   - プライマリ言語: 日本語
   - バンドルID: com.unitone.app
   - SKU: unitone-mac-001
4. 必須情報を入力：
   - プライバシーポリシーURL
   - サポートURL
   - スクリーンショット
   - アプリ説明文

### 提出手順

1. Xcode または `xcrun altool` でアップロード
2. App Store Connect で審査提出
3. 審査結果を待つ（1〜7日）
4. 承認後、リリース日を設定

---

## セクション4: 費用見積もり

### 初期費用

| 項目 | 費用（USD） | 費用（JPY概算） |
|------|-------------|-----------------|
| Apple Developer Program | $99/年 | ¥15,000/年 |
| **合計** | **$99/年** | **¥15,000/年** |

### ランニングコスト

| 項目 | 費用 | 備考 |
|------|------|------|
| Apple Developer Program 更新 | $99/年 | 毎年更新必須 |
| Mac App Store 手数料 | 15-30% | 有料アプリのみ |

### 法人の場合の追加

| 項目 | 費用 | 期間 |
|------|------|------|
| D-U-N-S番号取得 | 無料 | 2-4週間 |

---

## セクション5: チェックリスト

### Apple Developer Program 登録
- [ ] Apple ID 作成（2ファクタ認証有効）
- [ ] Apple Developer Program 申請
- [ ] 年会費支払い（$99）
- [ ] 承認完了確認

### 直接配布（DMG）準備
- [ ] Developer ID Application 証明書作成
- [ ] 証明書を .p12 でエクスポート
- [ ] App-specific password 作成
- [ ] Team ID 確認
- [ ] GitHub Secrets 設定（CI/CDの場合）
- [ ] entitlements.mac.plist 作成
- [ ] ローカルビルドテスト
- [ ] 公証（Notarization）確認

### Mac App Store 準備（任意）
- [ ] 3rd Party Mac Developer Application 証明書作成
- [ ] 3rd Party Mac Developer Installer 証明書作成
- [ ] Provisioning Profile 作成
- [ ] entitlements.mas.plist 作成
- [ ] サンドボックス対応のテスト
- [ ] App Store Connect でアプリ登録
- [ ] スクリーンショット準備
- [ ] プライバシーポリシーURL 準備
- [ ] サポートURL 準備
- [ ] アプリ説明文作成
- [ ] MASビルド作成・アップロード
- [ ] 審査提出

---

## セクション6: 所要期間目安

| フェーズ | 期間 |
|----------|------|
| Apple Developer Program 登録 | 1-2日 |
| 証明書・設定準備 | 1日 |
| 直接配布ビルド・テスト | 1日 |
| Mac App Store 追加準備 | 2-3日 |
| App Store 審査 | 1-7日 |

**直接配布のみの場合**: 約3-4日
**Mac App Store含む場合**: 約7-14日

---

## 参考リンク

- [Apple Developer Program](https://developer.apple.com/programs/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Electron Mac App Store Submission Guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [electron-builder macOS Code Signing](https://www.electron.build/code-signing-mac.html)
- [Notarizing macOS Software Before Distribution](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
