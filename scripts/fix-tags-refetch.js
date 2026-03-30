/**
 * 补全标签脚本 - 从 Steam 页面抓取完整用户标签
 * 只处理标签数 ≤ 3 且有 Steam AppID 的游戏
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const GAMES_JSON = path.join(__dirname, '../data/games.json');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function getSteamPageTags(appId) {
  try {
    const url = `https://store.steampowered.com/app/${appId}?l=schinese`;
    const r = await axios.get(url, {
      headers: {
        'Cookie': 'birthtime=288057601; mature_content=1; wants_mature_content=1;',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const tags = [];
    $('a.app_tag').each(function () {
      const t = $(this).text().trim();
      if (t && t !== '+') tags.push(t);
    });
    return tags.slice(0, 8); // 取前8个最热门标签
  } catch (e) {
    return [];
  }
}

async function main() {
  const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));

  // 筛选需要补全的游戏
  const needFix = [];
  games.forEach((g, i) => {
    if (!g) return;
    const tagCount = (g.tags || []).length;
    const hasAppId = g.appId && !String(g.appId).startsWith('999');
    if (tagCount <= 3 && hasAppId) {
      needFix.push({ game: g, index: i });
    }
  });

  console.log(`🔧 需要补全标签的游戏: ${needFix.length} 个`);
  let fixed = 0, failed = 0;

  for (let i = 0; i < needFix.length; i++) {
    const { game } = needFix[i];
    const appId = game.appId;

    process.stdout.write(`[${i + 1}/${needFix.length}] ${game.title} (${appId})...`);

    const tags = await getSteamPageTags(appId);

    if (tags.length > 0) {
      // 保留原有自定义标签（如 Mobile, 小想法, 实战项目）
      const customTags = (game.tags || []).filter(t =>
        ['Mobile', '小想法', '实战项目'].includes(t)
      );
      game.tags = [...new Set([...customTags, ...tags])];
      console.log(` ✅ ${tags.length}个 → ${tags.slice(0, 4).join(', ')}...`);
      fixed++;
    } else {
      console.log(` ❌ 无法获取`);
      failed++;
    }

    // 每30个保存一次
    if (i % 30 === 29) {
      fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');
      console.log(`\n💾 进度保存 (${i + 1}/${needFix.length})\n`);
    }

    await delay(1200); // 限速避免被封
  }

  fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 补全完成！`);
  console.log(`  ✅ 成功: ${fixed}`);
  console.log(`  ❌ 失败: ${failed}`);

  // 统计最终结果
  const final = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
  const still = final.filter(g => g && g.tags && g.tags.length <= 3);
  console.log(`  📊 仍然 ≤3 标签: ${still.length}`);
}

main().catch(console.error);
