const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const cheerio = require('cheerio');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始清洗研发游戏的自定义 Tag (保留实战项目和小想法，重抓官方 Tag)...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// 必须保留的特殊 Tag
const keepTags = ['实战项目', '小想法', 'Mobile'];

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

async function getTapTapTags(title) {
  try {
    const searchUrl = `https://www.taptap.cn/search/${encodeURIComponent(title)}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    const tags = [];
    $('.search-item-game .game-tags a').each((i, el) => {
      tags.push($(el).text().trim());
    });
    return tags.slice(0, 3);
  } catch (error) {
    return [];
  }
}

async function main() {
  let cleanCount = 0;

  for (let i = 0; i < rawData.length; i++) {
    const game = rawData[i];
    if (!game.title) continue;
    const title = game.title.toString().trim();
    
    // 只针对这三款游戏
    if (title.includes('七日世界') || title.includes('Blood Storm') || title.includes('香肠派对')) {
      let tags = game.tags ? game.tags.toString() : '';
      let existingTags = tags.split(',').map(t => t.trim()).filter(t => t);
      
      // 1. 提取出需要保留的特殊 Tag
      const specialTags = existingTags.filter(t => keepTags.includes(t));
      
      // 2. 重新抓取官方 Tag
      let officialTags = [];
      if (game.appId) {
        officialTags = await getSteamTags(game.appId);
      }
      if (officialTags.length === 0) {
        officialTags = await getTapTapTags(title);
      }
      
      // 3. 合并特殊 Tag 和官方 Tag
      const newTags = [...new Set([...specialTags, ...officialTags])];
      
      game.tags = newTags.join(', ');
      console.log(`   🧹 清洗 Tag: [${title}] -> [${game.tags}]`);
      cleanCount++;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (cleanCount > 0) {
    // 写回 Excel
    const newWorksheet = xlsx.utils.json_to_sheet(rawData);
    workbook.Sheets[sheetName] = newWorksheet;
    xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
    console.log(`✅ 标准配表已更新: ${STANDARD_EXCEL_PATH}`);

    // 同步 JSON
    const jsonGames = rawData.map(row => {
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
    console.log(`✅ 网页数据已同步更新: ${JSON_PATH}`);
    console.log(`\n🎉 清洗完成！请刷新浏览器查看。`);
  } else {
    console.log(`\n🎉 没有找到需要清洗的游戏。`);
  }
}

main();