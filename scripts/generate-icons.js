#!/usr/bin/env node

/**
 * アイコン生成スクリプト
 *
 * このスクリプトはSVGからPNG、ICOアイコンを生成します。
 * 実行には以下のパッケージが必要です:
 *   npm install sharp png-to-ico --save-dev
 *
 * 使用方法:
 *   node scripts/generate-icons.js
 *
 * 生成されるファイル:
 *   - assets/icons/icon.png (512x512)
 *   - assets/icons/icon@2x.png (1024x1024)
 *   - assets/icons/icon.ico (Windows用)
 *   - assets/icons/16x16.png
 *   - assets/icons/32x32.png
 *   - assets/icons/48x48.png
 *   - assets/icons/64x64.png
 *   - assets/icons/128x128.png
 *   - assets/icons/256x256.png
 *   - assets/icons/512x512.png
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

  // sharpがインストールされているか確認
  let sharp;
  let pngToIco;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('sharpがインストールされていません。');
    console.log('以下を実行してください:');
    console.log('  npm install sharp --save-dev');
    process.exit(1);
  }

  try {
    const pngToIcoModule = require('png-to-ico');
    pngToIco = pngToIcoModule.default || pngToIcoModule.imagesToIco || pngToIcoModule;
  } catch (e) {
    console.log('png-to-icoがインストールされていません。');
    console.log('以下を実行してください:');
    console.log('  npm install png-to-ico --save-dev');
    process.exit(1);
  }

  const svgPath = path.join(iconsDir, 'icon.svg');
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngBuffersForIco = [];

  console.log('SVGからアイコンを生成中...');

  for (const size of sizes) {
    const outputPath = size === 1024
      ? path.join(iconsDir, 'icon@2x.png')
      : size === 512
        ? path.join(iconsDir, 'icon.png')
        : path.join(iconsDir, `${size}x${size}.png`);

    const pngBuffer = await sharp(svgPath)
      .resize(size, size)
      .png()
      .toBuffer();

    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`  生成完了: ${path.basename(outputPath)} (${size}x${size})`);

    // ICO用にバッファを保存
    if (icoSizes.includes(size)) {
      pngBuffersForIco.push(pngBuffer);
    }
  }

  // 512x512.pngも生成
  const png512Path = path.join(iconsDir, '512x512.png');
  const png512Buffer = await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toBuffer();
  fs.writeFileSync(png512Path, png512Buffer);
  console.log('  生成完了: 512x512.png (512x512)');

  // ICOファイルを生成
  console.log('');
  console.log('ICOファイルを生成中...');
  const icoBuffer = await pngToIco(pngBuffersForIco);
  const icoPath = path.join(iconsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`  生成完了: icon.ico`);

  console.log('');
  console.log('アイコン生成が完了しました。');
}

generateIcons().catch(console.error);
