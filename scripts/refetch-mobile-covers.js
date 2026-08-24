/**
 * 批量重抓移动端游戏封面
 *
 * 背景：历史 Bing 搜图给大量手游配了完全错误的封面（错游戏/截图/真人照片）。
 * 现用新级联（iTunes 官方图 → 小黑盒 → 好游快爆 → Bing）统一重抓。
 *
 * 规则：
 * - 只处理 Mobile 标签且 idSource !== 'steam' 的记录
 *   （双平台游戏已有正确的 Steam 竖图，不动）
 * - 抓到新封面才替换；替换后旧封面若无人引用则删除
 * - 每抓完一条立即写回 games.json（中断可续跑）
 *
 * 用法: node scripts/refetch-mobile-covers.js
 */
const fs = require('fs');
const path = require('path');
const { fetchMobileCover } = require('./lib/mobile-fetcher');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'games.json');
const COVERS_DIR = path.join(ROOT, 'public', 'covers');

async function main() {
  const games = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const targets = games.filter(g => g && (g.tags || []).includes('Mobile') && g.idSource !== 'steam');
  console.log(`待重抓手游: ${targets.length} 个\n`);

  const referencedSet = () => new Set(
    games.filter(g => g).map(g => (g.cover || '').replace('/covers/', '')).filter(Boolean)
  );

  let changed = 0;
  for (const g of targets) {
    const oldCover = g.cover;
    const hit = await fetchMobileCover(g, COVERS_DIR);
    if (hit && hit.coverPath !== oldCover) {
      const oldFile = (oldCover || '').replace('/covers/', '');
      g.cover = hit.coverPath;
      // 旧封面无人引用时清理
      const ref = referencedSet();
      if (oldFile && !ref.has(oldFile)) {
        const p = path.join(COVERS_DIR, oldFile);
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) { /* 忽略 */ }
        }
      }
      changed++;
      console.log(`✅ ${g.title}: → ${hit.coverPath}（${hit.source}）`);
    } else {
      console.log(`⏭️  ${g.title}: 未抓到新封面，保留原图`);
    }
    fs.writeFileSync(JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n完成: 替换 ${changed} 张封面`);
}

main().catch(e => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
