# Asset Requirements / アセット要件リスト

**Last Updated / 最終更新日**: 2026-01-29
**App Name / アプリ名**: Unitone

---

## 1. App Icons / アプリアイコン

### Existing Assets / 既存アセット
現在 `assets/icons/` に以下が存在：
- 各種PNGサイズ（16x16 〜 512x512）
- icon.ico（Windows用）

### Requirements by Platform / プラットフォーム別要件

| Platform | Format | Size | Notes |
|----------|--------|------|-------|
| Windows | .ico | 256x256 (含む16,32,48,256) | 既存あり |
| macOS | .icns または .png | 512x512, 1024x1024 | 1024x1024推奨 |
| Linux | .png | 512x512 | 既存あり |

---

## 2. Screenshots / スクリーンショット

### Microsoft Store Requirements / Microsoft Store 要件

**Source**: [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images)

| Item | Requirement |
|------|-------------|
| Format | PNG |
| File Size | 最大 50MB |
| Minimum | 1枚（必須） |
| Recommended | 5-8枚 per device family |
| Orientation | Landscape または Portrait |

**Recommended Desktop Sizes**:
- 1366 x 768 px
- 1920 x 1080 px
- 2560 x 1440 px

### Mac App Store Requirements / Mac App Store 要件

**Source**: [Apple Developer](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)

| Item | Requirement |
|------|-------------|
| Format | PNG, JPEG |
| Aspect Ratio | 16:10 |
| Required | 1-10枚 |
| Same Size | 全て同じサイズ必須 |

**Accepted Sizes (16:10 aspect ratio)**:
| Size | Display Type |
|------|--------------|
| 1280 x 800 px | Minimum |
| 1440 x 900 px | Standard |
| 2560 x 1600 px | Retina |
| **2880 x 1800 px** | Retina (Recommended) |

### Linux (Snapcraft/Flathub) / Linux ストア要件

| Item | Requirement |
|------|-------------|
| Format | PNG |
| Recommended Size | 1280 x 720 px or larger |
| Minimum | 1枚 |
| Maximum | 5枚（Snapcraft） |

---

## 3. Screenshot Content Checklist / スクリーンショット内容チェックリスト

撮影すべき画面：

- [ ] **メイン画面**: 複数サービスのサイドバー表示
- [ ] **サービス切替**: タブ間の切り替えデモ
- [ ] **通知バッジ**: 未読表示の様子
- [ ] **設定画面**: カスタマイズオプション
- [ ] **サービス追加**: 新規サービス追加画面
- [ ] **ドラッグ&ドロップ**: 並べ替え機能
- [ ] **システムトレイ**: トレイアイコンとメニュー
- [ ] **AIコンパニオン**: Gemini機能（オプション）

### Screenshot Guidelines / スクリーンショットガイドライン

1. **実際のアプリ画面を使用** - モックアップ禁止（Apple要件）
2. **機密情報を除去** - チャット内容、メールアドレス等をマスク
3. **一貫したテーマ** - ライト/ダークモードを統一
4. **高解像度** - Retinaディスプレイ対応サイズ推奨

---

## 4. Store Listing Images / ストア掲載画像

### Microsoft Store

| Asset | Size | Required |
|-------|------|----------|
| Store Logo | 300 x 300 px | Yes |
| Poster Art | 2400 x 1200 px | No |
| Hero Image | 1920 x 1080 px | No |
| Promotional Image (414) | 414 x 180 px | No |
| Promotional Image (846) | 846 x 468 px | No |

### Mac App Store

| Asset | Size | Required |
|-------|------|----------|
| App Icon | 1024 x 1024 px | Yes |
| App Preview (Video) | 1920 x 1080 / 1080 x 1920 | No |

---

## 5. Priority Checklist / 優先度チェックリスト

### High Priority (Required for Submission) / 高優先度（申請必須）

- [ ] スクリーンショット 最低1枚（各ストア）
- [ ] アプリアイコン 1024x1024 (macOS)
- [ ] Store Logo 300x300 (Microsoft)

### Medium Priority (Recommended) / 中優先度（推奨）

- [ ] スクリーンショット 5-8枚（機能紹介）
- [ ] Hero Image（Microsoft Store）
- [ ] 多言語対応スクリーンショット（日本語/英語）

### Low Priority (Optional) / 低優先度（オプション）

- [ ] App Preview動画
- [ ] プロモーション画像
- [ ] バナー画像

---

## 6. File Naming Convention / ファイル命名規則

推奨フォルダ構造：
```
assets/
├── icons/
│   ├── icon.ico
│   ├── icon.icns
│   └── 512x512.png
├── screenshots/
│   ├── windows/
│   │   ├── 01-main-view.png
│   │   ├── 02-service-switch.png
│   │   └── ...
│   ├── macos/
│   │   ├── 01-main-view.png
│   │   ├── 02-service-switch.png
│   │   └── ...
│   └── linux/
│       └── ...
└── store/
    ├── microsoft/
    │   ├── store-logo-300x300.png
    │   └── hero-1920x1080.png
    └── apple/
        └── app-icon-1024x1024.png
```

---

## 7. Action Items / 対応事項

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | 1024x1024 アイコン作成（macOS用） | High | TODO |
| 2 | Windows用スクリーンショット撮影（1920x1080） | High | TODO |
| 3 | macOS用スクリーンショット撮影（2880x1800） | High | TODO |
| 4 | スクリーンショット内の機密情報マスク処理 | High | TODO |
| 5 | Store Logo 300x300 作成 | Medium | TODO |
| 6 | 英語版スクリーンショット作成 | Medium | TODO |
| 7 | Hero Image作成（オプション） | Low | TODO |

---

## References / 参考リンク

- [Microsoft Store: Screenshots and Images](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images)
- [Apple: Screenshot Specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)
- [Snapcraft: Listing Your App](https://snapcraft.io/docs/listing-your-app)
