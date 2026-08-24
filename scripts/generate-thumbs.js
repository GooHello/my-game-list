/**
 * 批量同步封面缩略图：public/covers/*.jpg → public/covers/thumbs/*.jpg
 * 已存在且不比源图旧的自动跳过（可重复运行、中断可续）
 *
 * 用法: node scripts/generate-thumbs.js
 */
const fs = require('fs');
const path = require('path');
const { ensureThumb } = require('./lib/thumbs');

const COVERS_DIR = path.join(__dirname, '..', 'public', 'covers');

async function main() {
  const files = fs.readdirSync(COVERS_DIR)
    .filter(f => f.toLowerCase().endsWith('.jpg') && fs.statSync(path.join(COVERS_DIR, f)).isFile());
  console.log(`封面源文件: ${files.length} 个`);

  let created = 0, skipped = 0, failed = 0;
  let savedKb = 0;
  for (const f of files) {
    const src = path.join(COVERS_DIR, f);
    const existed = fs.existsSync(path.join(COVERS_DIR, 'thumbs', f));
    const thumb = await ensureThumb(src);
    if (!thumb) { failed++; console.log(`  ❌ ${f}`); continue; }
    if (existed) skipped++; else created++;
    savedKb += (fs.statSync(src).size - fs.statSync(thumb).size) / 1024;
  }

  const thumbDir = path.join(COVERS_DIR, 'thumbs');
  const thumbCount = fs.existsSync(thumbDir) ? fs.readdirSync(thumbDir).filter(f => f.endsWith('.jpg')).length : 0;
  console.log(`处理 ${created} 个，失败 ${failed} 个`);
  console.log(`缩略图总数: ${thumbCount} | 相比源图共省约 ${(savedKb / 1024).toFixed(1)}MB/次全量加载`);
}

main().catch(e => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
