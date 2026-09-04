const fs = require('fs');
const path = require('path');

// ★ ルートではなく resources ディレクトリを対象にする
const rootDir = __dirname;
const resourcesDir = path.join(rootDir, 'resources');

try {
  // resources ディレクトリが存在しない場合の安全装置
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir);
  }

  const files = fs.readdirSync(resourcesDir);
  const pairs = {};

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);

    // 除外ルール
    if (file === 'package.json' || file === 'manifest.json' || baseName === 'package-lock') {
      return;
    }

    // .json はすべてテキスト（字幕データ）として扱う
    if (ext === '.json') {
      if (!pairs[baseName]) pairs[baseName] = { audioExt: null, hasJson: false };
      pairs[baseName].hasJson = true;
    }

    // .wav または .mp3 はすべて音声ファイルとして扱う
    if (ext === '.wav' || ext === '.mp3') {
      if (!pairs[baseName]) pairs[baseName] = { audioExt: null, hasJson: false };
      pairs[baseName].audioExt = ext;
    }
  });

  // 音声とJSONのペアが揃っているものを抽出
  const manifest = Object.keys(pairs)
    .filter(baseName => pairs[baseName].hasJson && pairs[baseName].audioExt)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(baseName => ({
      id: baseName,
      title: baseName.replace(/[_-]/g, ' '),
      audioExt: pairs[baseName].audioExt
    }));

  // ルート直下に manifest.json を出力
  const outputPath = path.join(rootDir, 'manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\x1b[32m[Success]\x1b[0m resources/ 内から ${manifest.length} 件のペア（音声+テキスト）を検出して登録しました。`);
} catch (error) {
  console.error('\x1b[31m[Error]\x1b[0m 生成エラー:', error);
  process.exit(1);
}