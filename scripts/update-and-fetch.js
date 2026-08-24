const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const { generateId, parseBool, parseNullableString, coverNameFor } = require('./lib/utils');
const { fetchMobileCover } = require('./lib/mobile-fetcher');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// 现有记录索引：Excel 没有 idSource 等字段，重写 JSON 时必须继承，
// 否则迁移成果（ID 来源区分）会被冲掉
let EXISTING_BY_ID = {};
try {
  const existingGames = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  EXISTING_BY_ID = Object.fromEntries(existingGames.filter(g => g).map(g => [g.id, g]));
} catch (e) { /* 首次导入视为空库 */ }

// 辅助函数：实时更新 JSON
function updateJsonRealtime(gamesArray) {
  const jsonGames = gamesArray.map(row => {
    if (!row.title) return null;
    if (!parseBool(row.isShow, true)) return null;

    const id = generateId(row.title);

    // idSource 继承：已有记录沿用；新记录按 Mobile 标签推断
    const existing = EXISTING_BY_ID[id];
    const isMobileRow = row.tags ? row.tags.toString().includes('Mobile') : false;
    const idSource = existing && existing.idSource !== undefined
      ? existing.idSource
      : (isMobileRow ? (row.appId ? 'heybox' : null) : (row.appId ? 'steam' : null));

    return {
      id: id,
      title: row.title.toString().trim(),
      appId: parseNullableString(row.appId),
      idSource: idSource,
      cover: row.cover || `/covers/${coverNameFor(id)}`,
      playtime: row.playtime ? row.playtime.toString().trim() : '',
      showPlaytime: parseBool(row.showPlaytime),
      playStatus: row.playStatus ? row.playStatus.toString().trim() : 'cleared',
      tags: row.tags ? row.tags.toString().split(',').map(t => t.trim()).filter(t => t) : [],
      isAnchor: parseBool(row.isAnchor),
      orderWeight: parseInt(row.orderWeight) || 0,
      reviewFile: parseNullableString(row.reviewFile),
      pros: parseNullableString(row.pros),
      cons: parseNullableString(row.cons),
      remark: parseNullableString(row.remark)
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
  const fileName = coverNameFor(gameId);
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

// TapTap / 好游快爆 / Bing 抓取逻辑已统一移入 scripts/lib/mobile-fetcher.js

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
      const id = generateId(title);
      
      let appId = game.appId ? game.appId.toString().trim() : null;
      let coverPath = null;
      const isMobileGame = game.tags ? game.tags.toString().includes('Mobile') : false;
      const idSource = (EXISTING_BY_ID[id] && EXISTING_BY_ID[id].idSource) ||
        (isMobileGame ? (appId ? 'heybox' : null) : (appId ? 'steam' : null));

      // 1. Steam 游戏：tags + 封面走 Steam（手游的小黑盒 ID 绝不请求 Steam！）
      if (!isMobileGame && appId && appId !== 'null') {
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

      // 2. 手游（或 Steam 无图）：小黑盒 → TapTap → 好游快爆 → Bing 级联
      if (!coverPath) {
        const hit = await fetchMobileCover({ id, title, appId, idSource }, COVERS_DIR, console.log);
        if (hit) {
          coverPath = hit.coverPath;
          console.log(`   ✅ [${title}] 封面抓取成功（来源: ${hit.source}）`);
        }
      }

      // 4. 结算
      if (coverPath) {
        game.cover = coverPath;
        updatedCount++;
      } else {
        console.log(`   ❌ [${title}] 彻底抓取失败`);
        game.cover = `/covers/${coverNameFor(id)}`; // 占位图
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