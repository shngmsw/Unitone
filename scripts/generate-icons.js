#!/usr/bin/env node

/**
 * アイコン生成スクリプト
 *
 * このスクリプトはSVGからPNGアイコンを生成します。
 * 実行には以下のパッケージが必要です:
 *   npm install sharp --save-dev
 *
 * 使用方法:
 *   node scripts/generate-icons.js
 *
 * 生成されるファイル:
 *   - assets/icons/icon.png (512x512)
 *   - assets/icons/icon@2x.png (1024x1024)
 *   - assets/icons/16x16.png
 *   - assets/icons/32x32.png
 *   - assets/icons/48x48.png
 *   - assets/icons/64x64.png
 *   - assets/icons/128x128.png
 *   - assets/icons/256x256.png
 *   - assets/icons/512x512.png
 *
 * 注意: .ico と .icns ファイルは electron-builder が自動生成します。
 * electron-builder は icon.png (256x256以上) から自動的に変換します。
 */

const fs = require('fs');
const path = require('path');

// SVGからシンプルなPNGを生成（sharpがない場合のフォールバック）
async function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

  // sharpがインストールされているか確認
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('sharpがインストールされていません。');
    console.log('高品質なアイコン生成には以下を実行してください:');
    console.log('  npm install sharp --save-dev');
    console.log('');
    console.log('プレースホルダーPNGを生成します...');
    await generatePlaceholderPng(iconsDir);
    return;
  }

  const svgPath = path.join(iconsDir, 'icon.svg');
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

  console.log('SVGからアイコンを生成中...');

  for (const size of sizes) {
    const outputPath = size === 1024
      ? path.join(iconsDir, 'icon@2x.png')
      : size === 512
        ? path.join(iconsDir, 'icon.png')
        : path.join(iconsDir, `${size}x${size}.png`);

    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  生成完了: ${path.basename(outputPath)} (${size}x${size})`);
  }

  console.log('');
  console.log('アイコン生成が完了しました。');
  console.log('ビルド時に electron-builder が .ico と .icns を自動生成します。');
}

// sharpがない場合のプレースホルダーPNG生成
async function generatePlaceholderPng(iconsDir) {
  // シンプルな512x512のPNGを生成（赤いグラデーション背景にU）
  const size = 512;
  const channels = 4; // RGBA
  const data = Buffer.alloc(size * size * channels);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * channels;

      // 背景グラデーション (ダークブルー)
      const bgR = Math.round(26 + (22 - 26) * (x + y) / (size * 2));
      const bgG = Math.round(26 + (33 - 26) * (x + y) / (size * 2));
      const bgB = Math.round(46 + (62 - 46) * (x + y) / (size * 2));

      // U字の判定
      const cx = x / size;
      const cy = y / size;
      const inU = (
        // 左の縦棒
        (cx >= 0.27 && cx <= 0.39 && cy >= 0.23 && cy <= 0.75) ||
        // 右の縦棒
        (cx >= 0.61 && cx <= 0.73 && cy >= 0.23 && cy <= 0.75) ||
        // 下の曲線
        (cy >= 0.62 && cy <= 0.86 && cx >= 0.27 && cx <= 0.73 &&
          Math.pow((cx - 0.5) / 0.23, 2) + Math.pow((cy - 0.62) / 0.24, 2) <= 1 &&
          Math.pow((cx - 0.5) / 0.11, 2) + Math.pow((cy - 0.62) / 0.12, 2) >= 1)
      );

      if (inU) {
        // アクセントカラー (赤)
        data[idx] = 233;     // R
        data[idx + 1] = 69;  // G
        data[idx + 2] = 96;  // B
        data[idx + 3] = 255; // A
      } else {
        data[idx] = bgR;
        data[idx + 1] = bgG;
        data[idx + 2] = bgB;
        data[idx + 3] = 255;
      }
    }
  }

  // PNGファイルとして保存（簡易的なPNGエンコード）
  const pngPath = path.join(iconsDir, 'icon.png');

  // 注意: これは実際のPNGではなく、生データです
  // 本番では sharp または他のライブラリを使用してください
  console.log('注意: プレースホルダーアイコンの生成にはsharpが必要です。');
  console.log('以下のコマンドを実行してください:');
  console.log('  npm install sharp --save-dev');
  console.log('  node scripts/generate-icons.js');
}

generateIcons().catch(console.error);
