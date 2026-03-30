/**
 * 手动修正被错误匹配的游戏
 * 1. 修正确认正确的 Steam AppID
 * 2. 重新抓取标签和封面
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const GAMES_JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getTags(appId) {
  try {
    const r = await axios.get(`https://store.steampowered.com/app/${appId}?l=schinese`, {
      headers: { 'Cookie': 'birthtime=288057601; mature_content=1;', 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const tags = [];
    $('a.app_tag').each(function (i, el) {
      const t = $(el).text().trim();
      if (t && t !== '+') tags.push(t);
    });
    return tags.slice(0, 8);
  } catch (e) {
    return [];
  }
}

async function downloadCover(appId, gameId) {
  const safeId = gameId.replace(/[<>:"/\\|?*]/g, '_');
  const fileName = `${safeId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);
  
  const urls = [
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
  ];
  
  for (const url of urls) {
    try {
      const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 10000 });
      const ct = response.headers['content-type'] || '';
      if (!ct.includes('image')) continue;
      
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      return `/covers/${fileName}`;
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function main() {
  const games = JSON.parse(fs.readFileSync(GAMES_JSON_PATH, 'utf8'));
  
  // 确认正确的修正列表（这些 appId 经过验证是正确的）
  const corrections = [
    // 旧 appId 是伪造的，新 appId 是正确的
    { title: 'DOOM II', appId: '2280' },
    { title: '死亡空间', appId: '1693980' },
    { title: '破坏者', appId: '24880' },
    { title: '红霞岛', appId: '1294810' },
    // 旧 appId 实际上是正确的（虽然已下架）
    { title: '合金装备-崛起-复仇', appId: '235460' },
  ];

  for (const c of corrections) {
    const game = games.find(g => g && g.title === c.title);
    if (!game) {
      console.log(`⚠️ 未找到: ${c.title}`);
      continue;
    }

    console.log(`\n🔧 修正: ${c.title} -> AppID ${c.appId}`);
    game.appId = c.appId;

    // 获取标签
    const tags = await getTags(c.appId);
    if (tags.length > 0) {
      const custom = (game.tags || []).filter(t => ['小想法', '实战项目', 'Mobile'].includes(t));
      game.tags = [...new Set([...custom, ...tags])];
      console.log(`  ✅ 标签: ${tags.join(', ')}`);
    } else {
      console.log(`  ⚠️ 无法获取标签`);
    }
    await delay(1500);

    // 下载封面
    const coverPath = await downloadCover(c.appId, game.id);
    if (coverPath) {
      game.cover = coverPath;
      console.log(`  ✅ 封面: ${coverPath}`);
    } else {
      console.log(`  ⚠️ 封面下载失败`);
    }
    await delay(1000);
  }

  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
  console.log('\n✅ 手动修正完成！');
}

main().catch(console.error);
