const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

try {
  const files = fs.readdirSync(rootDir);
  const pairs = {};

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);

    // ルール1: package.json と 自身(manifest.json) は除外
    if (file === 'package.json' || file === 'manifest.json' || baseName === 'package-lock') {
      return;
    }

    // ルール2: .json はすべてテキスト（字幕データ）として扱う
    if (ext === '.json') {
      if (!pairs[baseName]) pairs[baseName] = { audioExt: null, hasJson: false };
      pairs[baseName].hasJson = true;
    }

    // ルール3: .wav または .mp3 はすべて音声ファイルとして扱う
    if (ext === '.wav' || ext === '.mp3') {
      if (!pairs[baseName]) pairs[baseName] = { audioExt: null, hasJson: false };
      pairs[baseName].audioExt = ext;
    }
  });

  // 音声とJSON(テキスト)のペアが揃っているものだけを全自動抽出
  const manifest = Object.keys(pairs)
    .filter(baseName => pairs[baseName].hasJson && pairs[baseName].audioExt)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(baseName => ({
      id: baseName,
      title: baseName.replace(/[_-]/g, ' '), // アンダースコアやハイフンを綺麗に整形
      audioExt: pairs[baseName].audioExt
    }));

  // manifest.json として出力
  const outputPath = path.join(rootDir, 'manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\x1b[32m[Success]\x1b[0m ${manifest.length} 件のペア（音声+テキスト）を全自動検出して登録しました。`);
} catch (error) {
  console.error('\x1b[31m[Error]\x1b[0m 生成エラー:', error);
  process.exit(1);
}