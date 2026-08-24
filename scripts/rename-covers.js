/**
 * 一次性迁移：封面文件名统一为短 ASCII 名
 *
 * 背景：GitHub Pages 对 percent-编码后超 ~60 字符的路径返回 404（2026-08 实测），
 * 中文文件名编码后每字 9 字符极易超限。迁移后：
 * - id 为 ≤28 字符纯 ASCII → <id>.jpg
 * - 否则 → c<8位哈希>.jpg
 *
 * 行为：重命名 covers/ 与 covers/thumbs/ 下对应文件，更新 games.json 的 cover 字段。
 * 旧文件不保留（git 历史可找回）。可重复运行（幂等）。
 *
 * 用法: node scripts/rename-covers.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { coverNameFor } = require('./lib/utils');

const ROOT = path.join(__dirname, '..');
const COVERS_DIR = path.join(ROOT, 'public', 'covers');
const THUMB_DIR = path.join(COVERS_DIR, 'thumbs');
const JSON_PATH = path.join(ROOT, 'data', 'games.json');
const dryRun = process.argv.includes('--dry-run');

function main() {
  const games = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const seen = new Map(); // name -> id，冲突检测
  let renamed = 0, unchanged = 0, missing = 0;

  for (const g of games) {
    if (!g) continue;
    const newName = coverNameFor(g.id);
    if (seen.has(newName) && seen.get(newName) !== g.id) {
      console.error(`❌ 文件名冲突: ${newName} 被 [${seen.get(newName)}] 和 [${g.id}] 同时映射`);
      process.exit(1);
    }
    seen.set(newName, g.id);

    const oldName = (g.cover || '').replace('/covers/', '');
    if (oldName === newName) { unchanged++; continue; }

    const oldPath = path.join(COVERS_DIR, oldName);
    const newPath = path.join(COVERS_DIR, newName);
    const oldThumb = path.join(THUMB_DIR, oldName);
    const newThumb = path.join(THUMB_DIR, newName);

    if (!fs.existsSync(oldPath)) {
      missing++;
      console.log(`  ⚠️ [${g.id}] 旧封面不存在: ${oldName}（仅更新字段）`);
    } else if (!dryRun) {
      fs.renameSync(oldPath, newPath);
      if (fs.existsSync(oldThumb)) fs.renameSync(oldThumb, newThumb);
    }
    g.cover = `/covers/${newName}`;
    renamed++;
  }

  console.log(`改名: ${renamed} | 已合规: ${unchanged} | 旧文件缺失: ${missing}`);
  if (dryRun) {
    console.log('(dry-run 模式，未写盘)');
    return;
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
  console.log(`✅ games.json 已更新`);
}

main();
