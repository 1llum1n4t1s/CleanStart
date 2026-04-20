// Chrome Web Store 用スクリーンショット & プロモーションタイル生成スクリプト
// RaindropShortcut の同等スクリプトを CleanStart 用に流用。
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, 'images');

const HTML_CONFIGS = [
  // スクリーンショット: 1280x800 (Chrome Web Store の標準サイズ)
  {
    input: path.join(TEMPLATE_DIR, '01-feature-overview.html'),
    output: '01-feature-overview-1280x800.png',
    width: 1280,
    height: 800,
    type: 'screenshot'
  },
  {
    input: path.join(TEMPLATE_DIR, '02-how-to-use.html'),
    output: '02-how-to-use-1280x800.png',
    width: 1280,
    height: 800,
    type: 'screenshot'
  },
  {
    input: path.join(TEMPLATE_DIR, '03-hero-promo.html'),
    output: '03-hero-promo-1280x800.png',
    width: 1280,
    height: 800,
    type: 'screenshot'
  },
  // プロモーションタイル (小): 440x280
  {
    input: path.join(TEMPLATE_DIR, '04-promo-small.html'),
    output: 'promo-small-440x280.png',
    width: 440,
    height: 280,
    type: 'promo-small'
  },
  // マーキープロモーションタイル: 1400x560
  {
    input: path.join(TEMPLATE_DIR, '05-promo-marquee.html'),
    output: 'promo-marquee-1400x560.png',
    width: 1400,
    height: 560,
    type: 'promo-marquee'
  }
];

async function generateScreenshot(browser, htmlPath, outputPath, width, height) {
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: width,
      height: height,
      deviceScaleFactor: 1
    });

    const absolutePath = path.resolve(htmlPath);
    await page.goto(`file://${absolutePath}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.screenshot({
      path: outputPath,
      type: 'png',
      omitBackground: false,
      clip: { x: 0, y: 0, width: width, height: height }
    });

    console.log(`✅ 生成完了: ${outputPath} (${width}x${height})`);
  } catch (error) {
    console.error(`❌ エラー: ${htmlPath} -> ${outputPath}`);
    console.error(error);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🎨 Chrome Web Store 用スクリーンショットを生成中...\n');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 300000
  });

  try {
    for (const config of HTML_CONFIGS) {
      const outputPath = path.join(OUTPUT_DIR, config.output);
      await generateScreenshot(browser, config.input, outputPath, config.width, config.height);
    }
  } finally {
    await browser.close();
  }

  console.log('\n✨ すべての画像生成が完了したよ！');
  console.log(`\n📂 生成された画像は ${OUTPUT_DIR} にあるよ。`);

  console.log('\n📋 生成された画像一覧:');
  const files = fs.readdirSync(OUTPUT_DIR);
  files.forEach((file) => {
    const filePath = path.join(OUTPUT_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   - ${file} (${sizeKB} KB)`);
  });

  console.log('\n📝 Chrome Web Store アップロード仕様:');
  console.log('   ✓ スクリーンショット: 1280x800 または 640x400');
  console.log('   ✓ プロモーションタイル (小): 440x280');
  console.log('   ✓ マーキープロモーションタイル: 1400x560');
  console.log('   ✓ 形式: PNG (24bit, アルファなし)');
}

main().catch((error) => {
  console.error('❌ エラーが発生したよ:', error);
  process.exit(1);
});
