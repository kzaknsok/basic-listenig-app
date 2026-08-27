const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

try {
  // ルートディレクトリ内のファイル一覧を取得
  const files = fs.readdirSync(rootDir);
  const pairs = {};

  // .mp3 と .json のペアを抽出
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);

    // アプリ本体の構成ファイルやマニフェスト自体は除外
    if (baseName === 'lessons' || baseName === 'package' || baseName === 'package-lock') {
      return;
    }

    if (ext === '.mp3' || ext === '.json') {
      if (!pairs[baseName]) {
        pairs[baseName] = { mp3: false, json: false };
      }
      if (ext === '.mp3') pairs[baseName].mp3 = true;
      if (ext === '.json') pairs[baseName].json = true;
    }
  });

  // mp3 と json の両方が揃っているものだけを抽出し、ソートして整形
  const manifest = Object.keys(pairs)
    .filter(baseName => pairs[baseName].mp3 && pairs[baseName].json)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(baseName => {
      // ファイル名（例: lesson_01, lesson-01, lesson1）を読みやすい表示名に変換
      const formattedTitle = baseName
        .replace(/[_-]/g, ' ')
        .replace(/^lesson\s*/i, 'Lesson ');

      return {
        id: baseName,
        title: formattedTitle
      };
    });

  // lessons.json として書き出し
  const outputPath = path.join(rootDir, 'lessons.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\x1b[32m[Success]\x1b[0m lessons.json を正常に生成しました。（登録件数: ${manifest.length}件）`);
} catch (error) {
  console.error('\x1b[31m[Error]\x1b[0m マニフェスト生成中にエラーが発生しました:', error);
  process.exit(1);
}