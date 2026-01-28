/**
 * macOS公証（notarization）スクリプト
 *
 * electron-builderのafterSignフックとして実行され、
 * ビルドされたアプリをAppleに公証依頼します。
 *
 * 必要な環境変数:
 * - APPLE_ID: Apple Developer アカウントのメールアドレス
 * - APPLE_ID_PASSWORD: App-specific password（アプリ用パスワード）
 * - APPLE_TEAM_ID: Apple Developer Team ID
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // macOS以外はスキップ
  if (electronPlatformName !== 'darwin') {
    console.log('公証をスキップ: macOS以外のプラットフォーム');
    return;
  }

  // 必要な環境変数をチェック
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !appleTeamId) {
    console.log('公証をスキップ: Apple認証情報が設定されていません');
    console.log('  APPLE_ID:', appleId ? '設定済み' : '未設定');
    console.log('  APPLE_ID_PASSWORD:', appleIdPassword ? '設定済み' : '未設定');
    console.log('  APPLE_TEAM_ID:', appleTeamId ? '設定済み' : '未設定');
    return;
  }

  // package.jsonからアプリ名を取得
  const packageJson = require('../package.json');
  const appName = packageJson.build?.productName || packageJson.name;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`公証を開始: ${appPath}`);

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId: appleTeamId,
    });
    console.log('公証が完了しました');
  } catch (error) {
    console.error('公証に失敗しました:', error.message);
    throw error;
  }
};
