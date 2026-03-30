const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const GAMES_JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. 搜索游戏获取 AppID
async function searchSteamGame(title) {
  try {
    const response = await axios.get(`https://store.steampowered.com/search/results/?term=${encodeURIComponent(title)}&l=schinese`);
    const $ = cheerio.load(response.data);
    
    const firstResult = $('#search_resultsRows a').first();
    if (!firstResult.length) return null;

    const href = firstResult.attr('href');
    const match = href.match(/\/app\/(\d+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error(`搜索游戏 [${title}] 失败:`, error.message);
    return null;
  }
}

// 2. 获取玩家自定义热门标签 (User Tags)
async function getUserTags(appId) {
  try {
    // 必须带上绕过年龄限制的 Cookie，否则像赛博朋克2077这种游戏会重定向到年龄确认页
    const response = await axios.get(`https://store.steampowered.com/app/${appId}?l=schinese`, {
      headers: {
        'Cookie': 'birthtime=288057601; mature_content=1;'
      }
    });
    const $ = cheerio.load(response.data);
    
    const tags = [];
    // 抓取页面上的热门标签
    $('a.app_tag').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag && tag !== '+') {
        tags.push(tag);
      }
    });
    
    // 返回排名前 6 的热门标签
    return tags.slice(0, 6);
  } catch (error) {
    console.error(`获取用户标签 [AppID: ${appId}] 失败:`, error.message);
    return [];
  }
}

// 3. 下载高清竖版封面
async function downloadCover(appId, gameId) {
  const coverUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`;
  const fileName = `${gameId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);

  try {
    const response = await axios({
      url: coverUrl,
      method: 'GET',
      responseType: 'stream'
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve(`/covers/${fileName}`));
      writer.on('error', reject);
    });
  } catch (error) {
    try {
      const fallbackUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`;
      const response = await axios({
        url: fallbackUrl,
        method: 'GET',
        responseType: 'stream'
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', () => resolve(`/covers/${fileName}`));
        writer.on('error', reject);
      });
    } catch (fallbackError) {
      console.error(`下载封面 [AppID: ${appId}] 失败:`, fallbackError.message);
      return null;
    }
  }
}

// 主函数
async function main() {
  console.log('🚀 开始抓取 Steam 数据...');
  
  let games = [];
  try {
    games = JSON.parse(fs.readFileSync(GAMES_JSON_PATH, 'utf8'));
  } catch (error) {
    console.error('读取 games.json 失败:', error.message);
    return;
  }

  let updatedCount = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(`\n[${i + 1}/${games.length}] 正在处理: ${game.title}`);

    let appId = game.appId;
    if (!appId) {
      appId = await searchSteamGame(game.title);
    } else {
      console.log(`ℹ️ 使用手动指定的 AppID: ${appId}`);
    }

    if (!appId) {
      console.log(`❌ 未找到游戏 [${game.title}] 的 Steam AppID，跳过。`);
      continue;
    }
    if (!game.appId) console.log(`✅ 自动搜索到 AppID: ${appId}`);

    // 获取硬核玩家标签
    const steamTags = await getUserTags(appId);
    if (steamTags && steamTags.length > 0) {
      // 保留自定义的特殊标签，清除旧的泛泛标签，合并新的硬核标签
      const customTags = game.tags.filter(t => ['小想法', '实战项目'].includes(t));
      game.tags = [...new Set([...customTags, ...steamTags])];
      console.log(`✅ 更新硬核 Tags: ${steamTags.join(', ')}`);
    }

    const coverPath = await downloadCover(appId, game.id);
    if (coverPath) {
      game.cover = coverPath;
      console.log(`✅ 封面下载成功: ${coverPath}`);
    }

    updatedCount++;
    await delay(2000);
  }

  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2));
  console.log(`\n🎉 抓取完成！共更新了 ${updatedCount} 款游戏的数据。`);
}

main();