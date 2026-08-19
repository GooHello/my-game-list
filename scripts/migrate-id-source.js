/**
 * 一次性迁移脚本：为 games.json 每条记录添加 idSource 字段
 *
 * 背景：appId 字段长期混用——Steam 游戏存 Steam AppID，
 * 手游存小黑盒 ID（999xxxxx/900xxxxxx），两者无法区分，
 * 导致抓取脚本拿小黑盒 ID 请求 Steam CDN 必然失败。
 *
 * 判定方法（不靠猜，实测为准）：
 * - 无 Mobile 标签的游戏：历史上都从 Steam 抓取 → idSource='steam'
 * - 有 Mobile 标签的游戏：实测 Steam 商店页
 *     商店页可达 → 'steam'（双平台游戏，如香肠派对/鸣潮）
 *     商店页不存在 → 'heybox'（小黑盒手游 ID）
 *     无 appId → null
 * - 对 'heybox' 的记录再用小黑盒搜索 API 交叉验证 ID 是否匹配
 *
 * 用法: node scripts/migrate-id-source.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { checkSteamAppId, searchHeybox, HEYBOX_ID_PATTERN } = require('./lib/mobile-fetcher');

const JSON_PATH = path.join(__dirname, '..', 'data', 'games.json');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const games = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const mobiles = games.filter(g => g && (g.tags || []).includes('Mobile'));
  console.log(`共 ${games.filter(g => g).length} 条记录，其中 Mobile 标签 ${mobiles.length} 条需要实测\n`);

  let steamCount = 0, heyboxCount = 0, noneCount = 0, mismatch = [];

  for (const g of games) {
    if (!g) continue;
    const isMobile = (g.tags || []).includes('Mobile');

    if (!isMobile) {
      g.idSource = g.appId ? 'steam' : null;
      if (g.appId) steamCount++; else noneCount++;
      continue;
    }

    // Mobile 标签：实测 Steam 商店页
    if (!g.appId) {
      g.idSource = null;
      noneCount++;
      console.log(`  ⚪ ${g.title}: 无 appId → idSource=null`);
      continue;
    }

    let isSteam = await checkSteamAppId(g.appId);
    // Steam 接口偶发限流导致假阴性：对「不像黑盒 ID 段」的存疑结果加长重试
    if (!isSteam && !HEYBOX_ID_PATTERN.test(g.appId)) {
      console.log(`  🔁 ${g.title}: 首次校验失败但 ID 像 Steam 格式，3 秒后复核...`);
      await new Promise(r => setTimeout(r, 3000));
      isSteam = await checkSteamAppId(g.appId);
    }
    if (isSteam) {
      g.idSource = 'steam';
      steamCount++;
      console.log(`  🔵 ${g.title}: appId=${g.appId} Steam 商店页存在 → steam（双平台）`);
    } else {
      g.idSource = 'heybox';
      heyboxCount++;
      const patternOk = HEYBOX_ID_PATTERN.test(g.appId) ? '' : '（⚠️ 非典型黑盒 ID 段）';
      console.log(`  🟠 ${g.title}: appId=${g.appId} Steam 不存在 → heybox${patternOk}`);
      // 交叉验证：小黑盒搜索该游戏，看返回 ID 是否匹配
      const hit = await searchHeybox(g.title);
      if (hit && hit.id && hit.id !== g.appId) {
        mismatch.push({ title: g.title, stored: g.appId, heyboxNow: hit.id });
        console.log(`      ⚠️ 小黑盒当前搜索返回 ID=${hit.id}，与数据中 ${g.appId} 不一致（记录待人工核对）`);
      } else if (hit && hit.id === g.appId) {
        console.log(`      ✅ 小黑盒搜索确认 ID 匹配`);
      }
    }
    await new Promise(r => setTimeout(r, 1200)); // 温和限速，防 Steam 接口限流
  }

  console.log(`\n汇总: steam=${steamCount} heybox=${heyboxCount} null=${noneCount}`);
  if (mismatch.length > 0) {
    console.log(`\n⚠️ ${mismatch.length} 条 ID 与小黑盒当前数据不一致，请人工核对：`);
    mismatch.forEach(m => console.log(`   ${m.title}: 数据=${m.stored} 黑盒=${m.heyboxNow}`));
  }

  if (dryRun) {
    console.log('\n(dry-run 模式，未写文件)');
    return;
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
  console.log(`\n✅ 已写入 ${JSON_PATH}`);
}

main().catch(e => {
  console.error('❌ 迁移失败:', e.message);
  process.exit(1);
});
