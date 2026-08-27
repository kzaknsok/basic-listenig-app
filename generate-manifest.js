const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

try {
  const files = fs.readdirSync(rootDir);
  const pairs = {};

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);

    if (['lessons', 'package', 'package-lock'].includes(baseName)) return;

    if (['.mp3', '.wav', '.json'].includes(ext)) {
      if (!pairs[baseName]) {
        pairs[baseName] = { audio: null, json: false };
      }
      if (ext === '.mp3' || ext === '.wav') pairs[baseName].audio = ext;
      if (ext === '.json') pairs[baseName].json = true;
    }
  });

  const manifest = Object.keys(pairs)
    .filter(baseName => pairs[baseName].audio && pairs[baseName].json)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(baseName => {
      const formattedTitle = baseName
        .replace(/[_-]/g, ' ')
        .replace(/^lesson\s*/i, 'Lesson ');

      return {
        id: baseName,
        title: formattedTitle,
        ext: pairs[baseName].audio
      };
    });

  const outputPath = path.join(rootDir, 'lessons.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\x1b[32m[Success]\x1b[0m lessons.json を正常生成（${manifest.length}件）`);
} catch (error) {
  console.error('\x1b[31m[Error]\x1b[0m 生成エラー:', error);
  process.exit(1);
}