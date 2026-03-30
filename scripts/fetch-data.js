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

// ==========================================
// IGDB API 配置 (全平台游戏数据库)
// ==========================================
// 注意：这是临时测试 Token，如果失效，请去 Twitch 开发者平台申请
const IGDB_CLIENT_ID = 'y1234567890abcdefghijklmnopqrs'; // 占位符，实际需要真实ID
const IGDB_ACCESS_TOKEN = '1234567890abcdefghijklmnopqrst'; // 占位符，实际需要真实Token
// 由于我无法在这里提供长期有效的真实 Twitch Token，
// 我将使用一个公开的、无需认证的第三方游戏数据库 API (RAWG) 作为替代方案，
// 或者使用更简单的网页爬虫方案来抓取非 Steam 游戏。

// 为了保证稳定性，对于非 Steam 游戏，我们将使用 DuckDuckGo/Google 图片搜索的爬虫方案
// 来获取封面，并使用简单的关键词匹配来生成 Tag。
// ==========================================

// 1. Steam 搜索
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
    return null;
  }
}

// 2. Steam 标签抓取
async function getSteamTags(appId) {
  try {
    const response = await axios.get(`https://store.steampowered.com/app/${appId}?l=schinese`, {
      headers: { 'Cookie': 'birthtime=288057601; mature_content=1;' }
    });
    const $ = cheerio.load(response.data);
    const tags = [];
    $('a.app_tag').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag && tag !== '+') tags.push(tag);
    });
    return tags.slice(0, 6);
  } catch (error) {
    return [];
  }
}

// 3. Steam 封面下载
async function downloadSteamCover(appId, gameId) {
  const coverUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`;
  const fileName = `${gameId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);

  try {
    const response = await axios({ url: coverUrl, method: 'GET', responseType: 'stream' });
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve(`/covers/${fileName}`));
      writer.on('error', reject);
    });
  } catch (error) {
    try {
      const fallbackUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`;
      const response = await axios({ url: fallbackUrl, method: 'GET', responseType: 'stream' });
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', () => resolve(`/covers/${fileName}`));
        writer.on('error', reject);
      });
    } catch (fallbackError) {
      return null;
    }
  }
}

// 4. 降级方案：非 Steam 游戏封面抓取 (通过公开的 IGDB 网页版爬取)
async function fetchNonSteamData(title, gameId) {
  console.log(`   ⚠️ 尝试在全平台数据库中模糊搜索: ${title}`);
  try {
    // 模拟搜索 IGDB 网页版
    const searchUrl = `https://www.igdb.com/search?utf8=%E2%9C%93&q=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(searchRes.data);
    
    // 找到第一个游戏结果的链接
    const gameLink = $('.media-object a').first().attr('href');
    if (!gameLink) return null;

    // 访问游戏详情页
    const gameUrl = `https://www.igdb.com${gameLink}`;
    const gameRes = await axios.get(gameUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $$ = cheerio.load(gameRes.data);

    // 抓取封面图 (IGDB 的封面通常是高质量的竖版)
    let coverUrl = $$('.cover_big').attr('src');
    if (coverUrl) {
      // 将缩略图 URL 转换为高清图 URL (t_cover_big -> t_1080p)
      coverUrl = 'https:' + coverUrl.replace('t_cover_big', 't_1080p');
      
      const fileName = `${gameId}.jpg`;
      const filePath = path.join(COVERS_DIR, fileName);
      
      const imgRes = await axios({ url: coverUrl, method: 'GET', responseType: 'stream' });
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        imgRes.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // 抓取类型标签 (Genres)
      const tags = [];
      $$('.gamepage-tabs p').each((i, el) => {
        const text = $$(el).text();
        if (text.includes('Genre')) {
          $$(el).find('a').each((j, a) => tags.push($$(a).text().trim()));
        }
      });

      return {
        coverPath: `/covers/${fileName}`,
        tags: tags.slice(0, 4) // 取前 4 个标签
      };
    }
    return null;
  } catch (error) {
    console.error(`   ❌ 全平台抓取失败:`, error.message);
    return null;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始全平台自动化抓取...');
  
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

    // 优先使用手动指定的 AppID
    let appId = game.appId;
    if (!appId) {
      appId = await searchSteamGame(game.title);
    } else {
      console.log(`   ℹ️ 使用手动指定的 Steam AppID: ${appId}`);
    }

    // 策略 1：Steam 抓取
    if (appId) {
      if (!game.appId) console.log(`   ✅ 自动搜索到 Steam AppID: ${appId}`);

      const steamTags = await getSteamTags(appId);
      if (steamTags && steamTags.length > 0) {
        const customTags = game.tags.filter(t => ['小想法', '实战项目'].includes(t));
        game.tags = [...new Set([...customTags, ...steamTags])];
        console.log(`   ✅ 更新 Steam Tags: ${steamTags.join(', ')}`);
      }

      const coverPath = await downloadSteamCover(appId, game.id);
      if (coverPath) {
        game.cover = coverPath;
        console.log(`   ✅ Steam 封面下载成功`);
      }
      updatedCount++;
    } 
    // 策略 2：降级到全平台抓取 (IGDB)
    else {
      console.log(`   ⚠️ 未找到 Steam 数据，启动全平台降级抓取...`);
      const nonSteamData = await fetchNonSteamData(game.title, game.id);
      
      if (nonSteamData) {
        if (nonSteamData.tags.length > 0) {
          const customTags = game.tags.filter(t => ['小想法', '实战项目'].includes(t));
          game.tags = [...new Set([...customTags, ...nonSteamData.tags])];
          console.log(`   ✅ 更新全平台 Tags: ${nonSteamData.tags.join(', ')}`);
        }
        if (nonSteamData.coverPath) {
          game.cover = nonSteamData.coverPath;
          console.log(`   ✅ 全平台封面下载成功`);
        }
        updatedCount++;
      } else {
        console.log(`   ❌ 彻底抓取失败，将使用默认占位图。`);
      }
    }

    await delay(2000); // 防封禁延迟
  }

  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2));
  console.log(`\n🎉 抓取完成！共更新了 ${updatedCount} 款游戏的数据。`);
}

main();