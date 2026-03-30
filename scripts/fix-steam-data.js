/**
 * 增强版数据修复脚本
 * 1. 验证/修正 Steam AppID
 * 2. 抓取 Steam 官方标签 (genres + user tags)
 * 3. 下载正确的封面图
 * 4. 对非 Steam 游戏尝试 TapTap 搜索
 * 5. 增量保存进度
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const GAMES_JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');
const PROGRESS_PATH = path.join(__dirname, '../data/fix_progress.json');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 工具函数
// ==========================================

/**
 * 判断 appId 是否是"伪造的"（非真实 Steam AppID）
 * 真实 Steam AppID 通常是 5-7 位数，不会以 900 或 999 开头超过 8 位
 */
function isFakeAppId(appId) {
  if (!appId) return true;
  const id = Number(appId);
  if (isNaN(id)) return true;
  // 以 900 开头且大于 9000000 的通常是 TapTap/好游快爆 等平台 ID
  if (id >= 90000000) return true;
  // 以 999 开头的也是伪造的
  if (String(appId).startsWith('999') && id > 9990000) return true;
  return false;
}

// ==========================================
// Steam 相关 API
// ==========================================

/**
 * 使用 Steam API 验证 AppID 并获取官方 genres
 */
async function validateSteamAppId(appId) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=schinese`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data[String(appId)];
    
    if (!data || !data.success) return null;
    
    const appData = data.data;
    const genres = (appData.genres || []).map(g => g.description);
    const name = appData.name;
    
    return { valid: true, name, genres, appId };
  } catch (error) {
    console.error(`  ❌ Steam API 验证失败 [${appId}]:`, error.message);
    return null;
  }
}

/**
 * 从 Steam 商店页面抓取热门用户标签（更详细）
 */
async function getSteamUserTags(appId) {
  try {
    const response = await axios.get(`https://store.steampowered.com/app/${appId}?l=schinese`, {
      headers: {
        'Cookie': 'birthtime=288057601; mature_content=1; wants_mature_content=1;',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    const $ = cheerio.load(response.data);
    
    const tags = [];
    $('a.app_tag').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag && tag !== '+') {
        tags.push(tag);
      }
    });
    
    return tags.slice(0, 8); // 取前 8 个热门标签
  } catch (error) {
    return [];
  }
}

/**
 * 改进版 Steam 搜索 - 尝试多种搜索策略
 */
async function searchSteamGameEnhanced(title) {
  // 清理标题中的特殊字符
  const cleanTitle = title
    .replace(/[（）()【】\[\]「」『』：:·！!？?～~—–\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 搜索策略列表
  const searchTerms = [cleanTitle];
  
  // 如果标题包含中文副标题/别名，也单独搜索主标题
  const mainTitle = cleanTitle.split(/\s/)[0];
  if (mainTitle.length >= 2 && mainTitle !== cleanTitle) {
    searchTerms.push(mainTitle);
  }

  for (const term of searchTerms) {
    try {
      const response = await axios.get(
        `https://store.steampowered.com/search/results/?term=${encodeURIComponent(term)}&l=schinese&cc=cn`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': 'birthtime=288057601; mature_content=1;'
          },
          timeout: 10000
        }
      );
      const $ = cheerio.load(response.data);
      
      // 遍历搜索结果，找最匹配的
      const results = [];
      $('#search_resultsRows a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/app\/(\d+)/);
        const gameName = $(el).find('.title').text().trim();
        if (match && gameName) {
          results.push({ appId: match[1], name: gameName });
        }
      });

      if (results.length > 0) {
        // 优先精确匹配
        const exactMatch = results.find(r => 
          r.name.toLowerCase() === title.toLowerCase() ||
          r.name.toLowerCase() === cleanTitle.toLowerCase()
        );
        if (exactMatch) return exactMatch;
        
        // 否则返回第一个结果
        return results[0];
      }
    } catch (error) {
      // 继续尝试下一个搜索词
    }
    await delay(1000);
  }
  
  return null;
}

/**
 * 下载 Steam 封面
 */
async function downloadSteamCover(appId, gameId) {
  const urls = [
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
  ];

  // 清理文件名中的非法字符
  const safeGameId = gameId.replace(/[<>:"/\\|?*]/g, '_');
  const fileName = `${safeGameId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);

  for (const url of urls) {
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 15000
      });

      // 检查返回的不是错误页面
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('image')) continue;

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', () => resolve(`/covers/${fileName}`));
        writer.on('error', reject);
      });
    } catch (error) {
      continue;
    }
  }
  return null;
}

// ==========================================
// TapTap 搜索 (手机游戏)
// ==========================================

async function searchTapTap(title) {
  try {
    const url = `https://www.taptap.cn/search/${encodeURIComponent(title)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    // TapTap 的搜索结果页面结构
    const firstResult = $('a[href*="/app/"]').first();
    if (firstResult.length) {
      const href = firstResult.attr('href');
      const match = href.match(/\/app\/(\d+)/);
      if (match) {
        return { taptapId: match[1], platform: 'taptap' };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function downloadTapTapCover(taptapId, gameId) {
  try {
    const url = `https://www.taptap.cn/app/${taptapId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    // 尝试获取封面图
    const coverImg = $('img[src*="img.tapimg.net"]').first();
    if (coverImg.length) {
      const coverUrl = coverImg.attr('src');
      const safeGameId = gameId.replace(/[<>:"/\\|?*]/g, '_');
      const fileName = `${safeGameId}.jpg`;
      const filePath = path.join(COVERS_DIR, fileName);
      
      const imgRes = await axios({ url: coverUrl, method: 'GET', responseType: 'stream', timeout: 10000 });
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        imgRes.data.pipe(writer);
        writer.on('finish', () => resolve(`/covers/${fileName}`));
        writer.on('error', reject);
      });
    }
    return null;
  } catch (error) {
    return null;
  }
}

// ==========================================
// 主流程
// ==========================================

async function processGame(game, index, total) {
  const title = game.title;
  const currentAppId = game.appId;
  const hasTags = game.tags && game.tags.length > 0 && !game.tags.every(t => ['Mobile', '小想法', '实战项目'].includes(t));
  const hasBingCover = game.cover && game.cover.includes('bing_');
  const isFake = isFakeAppId(currentAppId);
  const isMobileTag = game.tags && game.tags.includes('Mobile');
  
  // 跳过已有完整数据的游戏
  if (hasTags && !hasBingCover && !isFake) {
    return { status: 'skipped', reason: '数据完整' };
  }

  console.log(`\n[${index + 1}/${total}] 🔍 处理: ${title}`);
  console.log(`  当前状态: appId=${currentAppId}, fake=${isFake}, hasTags=${hasTags}, bingCover=${hasBingCover}, mobile=${isMobileTag}`);

  let validAppId = null;
  let steamName = null;

  // ========== 步骤1: 确定有效的 Steam AppID ==========
  
  if (!isFake && currentAppId) {
    // 已有看起来合法的 AppID，用 API 验证
    console.log(`  📡 验证现有 AppID: ${currentAppId}`);
    const validation = await validateSteamAppId(currentAppId);
    if (validation) {
      validAppId = currentAppId;
      steamName = validation.name;
      console.log(`  ✅ AppID 有效: ${steamName}`);
    } else {
      console.log(`  ⚠️ AppID 无效，将重新搜索`);
    }
    await delay(1000);
  }

  if (!validAppId && !isMobileTag) {
    // 重新搜索 Steam
    console.log(`  🔎 Steam 搜索: "${title}"`);
    const searchResult = await searchSteamGameEnhanced(title);
    
    if (searchResult) {
      // 验证搜索到的 AppID
      console.log(`  📡 验证搜索结果: ${searchResult.name} (${searchResult.appId})`);
      const validation = await validateSteamAppId(searchResult.appId);
      if (validation) {
        validAppId = searchResult.appId;
        steamName = validation.name;
        console.log(`  ✅ 找到 Steam 游戏: ${steamName} (AppID: ${validAppId})`);
      }
      await delay(1000);
    } else {
      console.log(`  ⚠️ Steam 搜索无结果`);
    }
  }

  // ========== 步骤2: 获取标签和封面 ==========

  if (validAppId) {
    // --- Steam 游戏 ---
    
    // 获取标签
    if (!hasTags) {
      console.log(`  🏷️ 抓取 Steam 标签...`);
      const userTags = await getSteamUserTags(validAppId);
      
      if (userTags.length > 0) {
        // 保留自定义特殊标签
        const customTags = (game.tags || []).filter(t => ['小想法', '实战项目', 'Mobile'].includes(t));
        game.tags = [...new Set([...customTags, ...userTags])];
        console.log(`  ✅ 标签: ${userTags.join(', ')}`);
      } else {
        // 尝试从 API 获取 genres 作为后备
        const validation = await validateSteamAppId(validAppId);
        if (validation && validation.genres.length > 0) {
          const customTags = (game.tags || []).filter(t => ['小想法', '实战项目', 'Mobile'].includes(t));
          game.tags = [...new Set([...customTags, ...validation.genres])];
          console.log(`  ✅ 使用 API genres: ${validation.genres.join(', ')}`);
        } else {
          console.log(`  ⚠️ 未能获取标签`);
        }
      }
      await delay(1500);
    }

    // 下载封面（如果是 bing 封面或者 appId 变了）
    if (hasBingCover || String(game.appId) !== String(validAppId)) {
      console.log(`  🖼️ 下载 Steam 封面...`);
      const coverPath = await downloadSteamCover(validAppId, game.id);
      if (coverPath) {
        game.cover = coverPath;
        console.log(`  ✅ 封面: ${coverPath}`);
      } else {
        console.log(`  ⚠️ 封面下载失败，保持现有封面`);
      }
      await delay(1000);
    }

    // 更新 appId
    game.appId = validAppId;
    
    return { status: 'updated_steam', name: steamName };

  } else {
    // --- 非 Steam 游戏 (尝试 TapTap) ---
    
    if (!hasTags || hasBingCover) {
      console.log(`  📱 尝试 TapTap 搜索...`);
      const taptapResult = await searchTapTap(title);
      
      if (taptapResult) {
        console.log(`  ✅ TapTap 找到 (ID: ${taptapResult.taptapId})`);
        
        // 下载 TapTap 封面
        if (hasBingCover) {
          const coverPath = await downloadTapTapCover(taptapResult.taptapId, game.id);
          if (coverPath) {
            game.cover = coverPath;
            console.log(`  ✅ TapTap 封面: ${coverPath}`);
          }
        }
        
        // 确保有 Mobile 标签
        if (!game.tags) game.tags = [];
        if (!game.tags.includes('Mobile')) {
          game.tags.push('Mobile');
        }
        
        return { status: 'updated_taptap' };
      } else {
        console.log(`  ❌ TapTap 也未找到，保持现状`);
        return { status: 'not_found' };
      }
    }
    
    return { status: 'skipped', reason: '已标记为 Mobile 且有标签' };
  }
}

async function main() {
  console.log('🚀 增强版数据修复脚本启动');
  console.log('='.repeat(60));
  
  let games = [];
  try {
    games = JSON.parse(fs.readFileSync(GAMES_JSON_PATH, 'utf8'));
  } catch (error) {
    console.error('❌ 读取 games.json 失败:', error.message);
    return;
  }

  // 加载进度
  let processed = new Set();
  try {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    processed = new Set(progress.processed || []);
    console.log(`📋 加载已有进度: ${processed.size} 个游戏已处理`);
  } catch (e) {
    console.log('📋 无已有进度，从头开始');
  }

  // 统计需要处理的游戏
  const needsWork = games.filter(g => {
    if (!g) return false;
    if (processed.has(g.id)) return false;
    const hasTags = g.tags && g.tags.length > 0 && !g.tags.every(t => ['Mobile', '小想法', '实战项目'].includes(t));
    const hasBingCover = g.cover && g.cover.includes('bing_');
    const isFake = isFakeAppId(g.appId);
    return !hasTags || hasBingCover || isFake;
  });

  console.log(`\n📊 统计:`);
  console.log(`  总游戏数: ${games.length}`);
  console.log(`  需要处理: ${needsWork.length}`);
  console.log(`  已跳过:   ${processed.size}`);
  console.log('='.repeat(60));

  const stats = { updated_steam: 0, updated_taptap: 0, not_found: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    if (!game) continue;
    if (processed.has(game.id)) continue;

    try {
      const result = await processGame(game, i, games.length);
      stats[result.status] = (stats[result.status] || 0) + 1;
      
      if (result.status !== 'skipped') {
        processed.add(game.id);
      }
    } catch (error) {
      console.error(`  ❌ 处理异常: ${error.message}`);
      stats.errors++;
    }

    // 每处理 10 个游戏保存一次进度
    if (i % 10 === 9) {
      fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ processed: [...processed] }), 'utf8');
      console.log(`\n💾 进度已保存 (${i + 1}/${games.length})`);
    }
  }

  // 最终保存
  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ processed: [...processed] }), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 修复完成！统计:');
  console.log(`  ✅ Steam 更新: ${stats.updated_steam || 0}`);
  console.log(`  📱 TapTap 更新: ${stats.updated_taptap || 0}`);
  console.log(`  ❌ 未找到: ${stats.not_found || 0}`);
  console.log(`  ⏭️ 跳过: ${stats.skipped || 0}`);
  console.log(`  💥 错误: ${stats.errors || 0}`);
}

main().catch(console.error);
