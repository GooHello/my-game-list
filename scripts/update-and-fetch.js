const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const cheerio = require('cheerio');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// 辅助函数：实时更新 JSON
function updateJsonRealtime(gamesArray) {
  const jsonGames = gamesArray.map(row => {
    if (!row.title) return null;
    const isShowRaw = row.isShow;
    const isShow = isShowRaw === undefined ? true : (isShowRaw === true || isShowRaw === 'TRUE' || isShowRaw === 'true' || isShowRaw === 1);
    if (!isShow) return null;

    const id = row.title.toString().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').toLowerCase() || `game-${Date.now()}`;

    return {
      id: id,
      title: row.title.toString().trim(),
      appId: row.appId ? row.appId.toString().trim() : null,
      cover: row.cover || `/covers/${id}.jpg`,
      playtime: row.playtime ? row.playtime.toString().trim() : '',
      showPlaytime: row.showPlaytime === true || row.showPlaytime === 'TRUE' || row.showPlaytime === 'true' || row.showPlaytime === 1,
      playStatus: row.playStatus ? row.playStatus.toString().trim() : 'cleared',
      tags: row.tags ? row.tags.toString().split(',').map(t => t.trim()).filter(t => t) : [],
      isAnchor: row.isAnchor === true || row.isAnchor === 'TRUE' || row.isAnchor === 'true' || row.isAnchor === 1,
      orderWeight: parseInt(row.orderWeight) || 0,
      reviewFile: row.reviewFile ? row.reviewFile.toString().trim() : null,
      pros: row.pros ? row.pros.toString().trim() : null,
      cons: row.cons ? row.cons.toString().trim() : null
    };
  }).filter(game => game !== null);

  fs.writeFileSync(JSON_PATH, JSON.stringify(jsonGames, null, 2));
}

// ==========================================
// 终极智能抓取逻辑 (小黑盒 + Steam + TapTap + Bing)
// ==========================================

// 1. 小黑盒 (Heybox) 智能搜索 (解决错别字、别名、获取准确 AppID)
async function searchHeybox(title) {
  console.log(`   🔍 正在小黑盒智能匹配: ${title}`);
  try {
    // 小黑盒网页端搜索接口
    const searchUrl = `https://api.xiaoheihe.cn/game/search/?q=${encodeURIComponent(title)}&os_type=web`;
    const response = await axios.get(searchUrl, { timeout: 5000 });
    
    if (response.data && response.data.result && response.data.result.games && response.data.result.games.length > 0) {
      const firstGame = response.data.result.games[0];
      console.log(`   ✅ 小黑盒匹配成功: [${firstGame.name}] (AppID: ${firstGame.steam_appid || '无'})`);
      return {
        appId: firstGame.steam_appid ? firstGame.steam_appid.toString() : null,
        standardName: firstGame.name,
        heyboxCover: firstGame.image // 小黑盒的高清封面
      };
    }
  } catch (error) {
    console.log(`   ❌ 小黑盒搜索失败`);
  }
  return null;
}

// 2. Steam 标签抓取
async function getSteamTags(appId) {
  try {
    const response = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=schinese`, { timeout: 5000 });
    const data = response.data[appId];
    if (!data || !data.success || !data.data || !data.data.genres) return [];
    const tags = new Set();
    data.data.genres.forEach(g => {
      const genre = g.description.trim();
      if (genre !== '独立' && genre !== '抢先体验' && genre !== '免费开玩') tags.add(genre);
    });
    return Array.from(tags).slice(0, 4);
  } catch (error) {
    return [];
  }
}

// 3. Steam 封面下载 (原生竖图)
async function downloadSteamCover(appId, gameId) {
  const coverUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`;
  const fileName = `${gameId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);
  try {
    const response = await axios({ url: coverUrl, method: 'GET', responseType: 'stream', timeout: 8000 });
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve(`/covers/${fileName}`));
      writer.on('error', reject);
    });
  } catch (error) {
    return null; // 严格要求竖图，如果没有竖图，返回 null，让后面的逻辑去抓
  }
}

// 4. 下载任意 URL 的图片
async function downloadImage(url, gameId, prefix = '') {
  const fileName = `${prefix}${gameId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);
  try {
    const response = await axios({ url: url, method: 'GET', responseType: 'stream', timeout: 8000 });
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve(`/covers/${fileName}`));
      writer.on('error', reject);
    });
  } catch (error) {
    return null;
  }
}

// 5. TapTap 网页爬虫 (专治国内手游)
async function fetchFromTapTap(title, gameId) {
  console.log(`   📱 尝试在 TapTap 搜索手游: ${title}`);
  try {
    const searchUrl = `https://www.taptap.cn/search/${encodeURIComponent(title)}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    
    const firstImg = $('.search-item-game img').first();
    if (firstImg.length) {
      let imgUrl = firstImg.attr('src') || firstImg.attr('data-src');
      if (imgUrl) {
        imgUrl = imgUrl.split('?')[0];
        const coverPath = await downloadImage(imgUrl, gameId, 'taptap_');
        
        const tags = [];
        $('.search-item-game .game-tags a').each((i, el) => {
          tags.push($(el).text().trim());
        });
        
        return { coverPath, tags: tags.slice(0, 3) };
      }
    }
  } catch (error) {}
  return null;
}

// 6. Bing 图片搜索 (终极兜底)
async function fetchImageFromBing(title, gameId) {
  console.log(`   🔍 尝试使用 Bing 图片搜索兜底: ${title}`);
  try {
    const query = encodeURIComponent(`${title} 游戏海报 竖版`);
    const searchUrl = `https://cn.bing.com/images/search?q=${query}&form=HDRSC2&first=1`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    let imageUrl = null;
    $('a.iusc').each((i, el) => {
      if (imageUrl) return;
      const mData = $(el).attr('m');
      if (mData) {
        try {
          const mJson = JSON.parse(mData);
          if (mJson.murl && (mJson.murl.endsWith('.jpg') || mJson.murl.endsWith('.png'))) {
            imageUrl = mJson.murl;
          }
        } catch (e) {}
      }
    });

    if (imageUrl) {
      return await downloadImage(imageUrl, gameId, 'bing_');
    }
  } catch (error) {}
  return null;
}

// ==========================================
// 主流程 (全速并发版)
// ==========================================
async function main() {
  console.log('🚀 开始全速、并发、实时更新抓取...');
  
  if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
    console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
    return;
  }

  const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);

  console.log(`✅ 成功读取到 ${rawData.length} 款游戏数据。`);

  let updatedCount = 0;
  
  // 过滤出需要处理的游戏
  const gamesToProcess = rawData.filter(game => {
    if (!game.title) return false;
    const isShowRaw = game.isShow;
    return isShowRaw === undefined ? true : (isShowRaw === true || isShowRaw === 'TRUE' || isShowRaw === 'true' || isShowRaw === 1);
  });

  console.log(`⚡ 共有 ${gamesToProcess.length} 款游戏需要抓取。`);

  // 并发控制：每次同时处理 10 款游戏
  const CONCURRENCY_LIMIT = 10;
  
  for (let i = 0; i < gamesToProcess.length; i += CONCURRENCY_LIMIT) {
    const batch = gamesToProcess.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`\n[${i + 1} - ${Math.min(i + CONCURRENCY_LIMIT, gamesToProcess.length)} / ${gamesToProcess.length}] 正在并发抓取...`);
    
    // 并发执行当前批次
    await Promise.all(batch.map(async (game) => {
      const title = game.title.toString().trim();
      const id = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').toLowerCase() || `game-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      
      let appId = game.appId ? game.appId.toString().trim() : null;
      let coverPath = null;

      // 1. 如果有 AppID，直接秒抓 Steam
      if (appId && appId !== 'null') {
        const steamTags = await getSteamTags(appId);
        if (steamTags.length > 0) {
          const existingTags = game.tags ? game.tags.toString().split(',').map(t => t.trim()) : [];
          const customTags = existingTags.filter(t => ['小想法', '实战项目'].includes(t));
          game.tags = [...new Set([...customTags, ...steamTags])].join(', ');
        }
        
        coverPath = await downloadSteamCover(appId, id);
        if (coverPath) {
          console.log(`   ✅ [${title}] Steam 原生竖图下载成功`);
        }
      }

      // 2. 如果没有 AppID (手游/独占)，或者 Steam 没图，走 TapTap
      if (!coverPath) {
        const tapTapData = await fetchFromTapTap(title, id);
        if (tapTapData) {
          if (tapTapData.tags.length > 0 && (!game.tags || !game.tags.includes(tapTapData.tags[0]))) {
            const existingTags = game.tags ? game.tags.toString().split(',').map(t => t.trim()) : [];
            const customTags = existingTags.filter(t => ['小想法', '实战项目'].includes(t));
            game.tags = [...new Set([...customTags, ...tapTapData.tags])].join(', ');
          }
          coverPath = tapTapData.coverPath;
          if (coverPath) console.log(`   ✅ [${title}] TapTap 封面下载成功`);
        }
      }

      // 3. 终极兜底：Bing 图片搜索
      if (!coverPath) {
        coverPath = await fetchImageFromBing(title, id);
        if (coverPath) console.log(`   ✅ [${title}] Bing 兜底封面下载成功`);
      }

      // 4. 结算
      if (coverPath) {
        game.cover = coverPath;
        updatedCount++;
      } else {
        console.log(`   ❌ [${title}] 彻底抓取失败`);
        game.cover = `/covers/${id}.jpg`; // 占位图
      }
    }));

    // 每批次完成后，实时更新 JSON
    updateJsonRealtime(rawData);
  }

  console.log('\n🚀 正在将最终数据写回标准配表...');
  const newWorksheet = xlsx.utils.json_to_sheet(rawData);
  workbook.Sheets[sheetName] = newWorksheet;
  xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
  console.log(`✅ 标准配表已更新: ${STANDARD_EXCEL_PATH}`);
  console.log(`\n🎉 全速并发抓取完成！共更新了 ${updatedCount} 款游戏的数据。`);
}

main();