# Unitone

複数のチャットツールを1つにまとめるデスクトップアプリ

## 概要

Unitoneは、Slack、Google Chat、Microsoft Teams、Chatworkなど、複数のチャットサービスを1つのウィンドウで管理できるElectronベースのデスクトップアプリケーションです。

## 機能

- **マルチサービス対応**: Slack、Google Chat、Teams、Chatworkをサポート
- **カスタムサービス追加**: 任意のWebベースチャットサービスを追加可能
- **AIコンパニオン**: Geminiを使用したAIアシスタント機能
- **クロスプラットフォーム**: macOS、Windows、Linuxに対応
- **システムトレイ**: バックグラウンド動作対応
- **通知バッジ**: 各サービスの未読数を表示

## 必要要件

- Node.js 18以上
- npm または yarn

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/shngmsw/Unitone.git
cd Unitone

# 依存関係をインストール
npm install
```

## 使い方

### 開発モード

```bash
npm run dev
```

### 通常起動

```bash
npm start
```

### ビルド

```bash
# 全プラットフォーム向けビルド
npm run build:all

# プラットフォーム別ビルド
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## プロジェクト構成

```
Unitone/
├── assets/           # アイコン等のアセット
├── scripts/          # ビルドスクリプト
├── src/
│   ├── main/         # Electronメインプロセス
│   ├── preload/      # プリロードスクリプト
│   └── renderer/     # レンダラープロセス（UI）
└── package.json
```

## 対応サービス

| サービス | URL |
|---------|-----|
| Slack | https://app.slack.com |
| Google Chat | https://chat.google.com |
| Microsoft Teams | https://teams.microsoft.com |
| Chatwork | https://www.chatwork.com |

## ライセンス

MIT License
