const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const cheerio = require('cheerio');

const RAW_EXCEL_PATH = 'D:\\My Game List.xlsx';
const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 强化版抓取逻辑 (Steam + IGDB 模糊搜索)
// ==========================================

function cleanTitleForSearch(title) {
  let cleaned = title.replace(/（.*?）|\(.*?\)/g, '').trim();
  cleaned = cleaned.split('：')[0].split(':')[0].trim();
  cleaned = cleaned.split('-')[0].trim();
  return cleaned;
}

async function searchSteamGame(originalTitle) {
  const searchTerms = [originalTitle, cleanTitleForSearch(originalTitle)];
  for (const term of searchTerms) {
    if (!term) continue;
    try {
      const response = await axios.get(`https://store.steampowered.com/search/results/?term=${encodeURIComponent(term)}&l=schinese`);
      const $ = cheerio.load(response.data);
      const firstResult = $('#search_resultsRows a').first();
      if (firstResult.length) {
        const href = firstResult.attr('href');
        const match = href.match(/\/app\/(\d+)/);
        if (match) return match[1];
      }
    } catch (error) {}
  }
  return null;
}

async function getSteamTags(appId) {
  try {
    const response = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=schinese`);
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

async function fetchNonSteamData(originalTitle, gameId) {
  const searchTerms = [originalTitle, cleanTitleForSearch(originalTitle)];
  for (const term of searchTerms) {
    if (!term) continue;
    console.log(`   ⚠️ 尝试在全平台数据库中模糊搜索: ${term}`);
    try {
      const searchUrl = `https://www.igdb.com/search?utf8=%E2%9C%93&q=${encodeURIComponent(term)}`;
      const searchRes = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const $ = cheerio.load(searchRes.data);
      const gameLink = $('.media-object a').first().attr('href');
      if (gameLink) {
        const gameUrl = `https://www.igdb.com${gameLink}`;
        const gameRes = await axios.get(gameUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $$ = cheerio.load(gameRes.data);
        let coverUrl = $$('.cover_big').attr('src');
        if (coverUrl) {
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
          const tags = [];
          $$('.gamepage-tabs p').each((i, el) => {
            const text = $$(el).text();
            if (text.includes('Genre')) {
              $$(el).find('a').each((j, a) => tags.push($$(a).text().trim()));
            }
          });
          return { coverPath: `/covers/${fileName}`, tags: tags.slice(0, 4) };
        }
      }
    } catch (error) {}
  }
  return null;
}

// ==========================================
// 主流程
// ==========================================
async function main() {
  console.log('🚀 开始读取原始 Excel 文件...');
  
  if (!fs.existsSync(RAW_EXCEL_PATH)) {
    console.error(`❌ 找不到原始 Excel 文件: ${RAW_EXCEL_PATH}`);
    return;
  }

  const workbook = xlsx.readFile(RAW_EXCEL_PATH);
  const gameTitles = new Set();
  
  const filterKeywords = [
    '多人在线', '射击游戏', '移动端', 'Android', 'PC端', '主机端', 'iOS',
    'FPS', 'TPS', 'RPG', 'ACT', '撤离射击', '第三人称', '英雄射击', '单机', '网游',
    '游戏名称', 'title', 'Name', '分类', '平台'
  ];

  // 遍历所有 Sheet
  for (const sheetName of workbook.SheetNames) {
    console.log(`📄 正在解析 Sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    // 恢复为按二维数组读取，以适配脑图结构
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;
      
      for (let j = 0; j < row.length; j++) {
        const cellValue = row[j];
        if (cellValue && typeof cellValue === 'string') {
          const title = cellValue.trim();
          
          if (title.length > 1 && isNaN(title)) {
            let isCategory = false;
            for (const kw of filterKeywords) {
              if (title.includes(kw) && title.length < 15) {
                isCategory = true;
                break;
              }
            }
            
            if (!isCategory) {
              gameTitles.add(title);
            }
          }
        }
      }
    }
  }

  const finalTitles = Array.from(gameTitles);
  console.log(`✅ 成功从所有 Sheet 中提取到 ${finalTitles.length} 款游戏名称。开始全网抓取并生成标准配表...`);

  // 预置我们之前的测试数据，确保它们不被覆盖
  const preConfiguredGames = {
    "七日世界 (Once Human)": {
      appId: "2139460", playtime: "11个月 (研发)", showPlaytime: "FALSE", playStatus: "playing",
      tags: "实战项目, 小想法, 免费开玩, 生存, 多人, 开放世界生存制作, 合作, 开放世界",
      isAnchor: "TRUE", orderWeight: 100, reviewFile: "once-human-combat.md",
      pros: "战斗异常物系统极大地丰富了 SOC 游戏的战斗维度；被动 BD 构建深度足够，长线养成有奔头；主机端交互适配丝滑，没有明显的移植生涩感。",
      cons: "部分异常物的数值平衡在后期容易崩坏；大世界探索的引导性在某些区域略显薄弱，容易让玩家产生目标迷失感。"
    },
    "香肠派对 (Sausage Man)": {
      appId: "2404260", playtime: "5个月 (研发)", showPlaytime: "FALSE", playStatus: "cleared",
      tags: "实战项目, 小想法, TPS, 吃鸡, 街机模式, 战斗道具, IP监修",
      isAnchor: "TRUE", orderWeight: 90, reviewFile: "sausage-man-gameplay.md",
      pros: "街机模式的副玩法设计极大地缓解了吃鸡模式的挫败感；战斗道具（如飞高高、传送胶囊）的脑洞极大，战术博弈空间深；IP 联动包装非常契合游戏搞怪的调性。",
      cons: "部分新道具的加入容易打破原有的 TTK（击杀时间）平衡；街机模式的匹配机制在低活跃时段体验不佳。"
    },
    "Blood Storm: Alien Purge": {
      appId: "3483190", playtime: "研发中", showPlaytime: "TRUE", playStatus: "playing",
      tags: "实战项目, 小想法, 轨道射击, 射击, 第一人称, 血腥, 暴力, 外星人",
      isAnchor: "TRUE", orderWeight: 110, reviewFile: "", pros: "", cons: ""
    },
    "只狼：影逝二度": {
      appId: "814380", playtime: "150h", showPlaytime: "TRUE", playStatus: "completed",
      tags: "小想法, 类魂系列, 困难, 忍者, 单人, 动作, 冒险",
      isAnchor: "FALSE", orderWeight: 80, reviewFile: "sekiro-combat.md",
      pros: "ACT 游戏战斗交互的巅峰之作。完美的 Input Buffer（输入缓冲）设计，极度精准的 Hitbox 判定，以及将防守（弹反）转化为进攻（架势槽）的革命核心循环。",
      cons: "RPG 养成要素过于薄弱，导致多周目除了挑战自我外缺乏实质性的驱动力；部分双 Boss 战的视角锁定逻辑存在缺陷。"
    }
  };

  const standardGames = [];

  for (let i = 0; i < finalTitles.length; i++) {
    const title = finalTitles[i];
    console.log(`\n[${i + 1}/${finalTitles.length}] 正在处理: ${title}`);
    
    const id = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').toLowerCase() || `game-${Date.now()}`;
    
    // 初始化标准数据结构
    let gameData = {
      title: title,
      isShow: 'TRUE', // 默认显示
      appId: '',
      playtime: '',
      showPlaytime: 'FALSE',
      playStatus: 'cleared',
      tags: '',
      isAnchor: 'FALSE',
      orderWeight: 0,
      reviewFile: '',
      pros: '',
      cons: '',
      remark: '', // 个人备注
      _id: id,
      _cover: `/covers/${id}.jpg`
    };

    // 如果是预置的测试数据，合并预置配置
    if (preConfiguredGames[title]) {
      console.log(`   ℹ️ 使用预置的测试数据配置`);
      gameData = { ...gameData, ...preConfiguredGames[title] };
      if (gameData.appId) await downloadSteamCover(gameData.appId, id);
      standardGames.push(gameData);
      continue;
    }

    const appId = await searchSteamGame(title);
    if (appId) {
      console.log(`   ✅ 找到 Steam AppID: ${appId}`);
      gameData.appId = appId;
      
      const steamTags = await getSteamTags(appId);
      if (steamTags.length > 0) {
        gameData.tags = steamTags.join(', ');
        console.log(`   ✅ 抓取到 Steam Tags`);
      }

      const coverPath = await downloadSteamCover(appId, id);
      if (coverPath) console.log(`   ✅ Steam 封面下载成功`);
    } else {
      console.log(`   ⚠️ 未找到 Steam 数据，尝试全平台抓取...`);
      const nonSteamData = await fetchNonSteamData(title, id);
      if (nonSteamData) {
        if (nonSteamData.tags.length > 0) {
          gameData.tags = nonSteamData.tags.join(', ');
          console.log(`   ✅ 抓取到全平台 Tags`);
        }
        if (nonSteamData.coverPath) console.log(`   ✅ 全平台封面下载成功`);
      } else {
        console.log(`   ❌ 抓取失败，需手动处理。`);
      }
    }

    standardGames.push(gameData);
    await delay(2000);
  }

  console.log('\n🚀 正在生成标准 Excel 配表...');
  const newWorkbook = xlsx.utils.book_new();
  
  // 准备写入 Excel 的数据，包含表头和备注
  const headers = ['title', 'isShow', 'appId', 'playtime', 'showPlaytime', 'playStatus', 'tags', 'isAnchor', 'orderWeight', 'reviewFile', 'pros', 'cons', 'remark'];
  const comments = ['游戏名称(必填)', '是否显示(TRUE/FALSE)', 'Steam AppID(选填)', '游玩时长', '显示时长(TRUE/FALSE)', '游玩状态(cleared/completed/playing/on-hold/dropped)', '标签(逗号分隔)', '参与研发(TRUE/FALSE)', '排序权重(数字)', '拆解文档(如 sekiro.md)', '优点评价', '缺点评价', '个人备注(不展示)'];
  
  const excelData = [
    headers,
    comments,
    ...standardGames.map(g => [
      g.title, g.isShow, g.appId, g.playtime, g.showPlaytime, g.playStatus,
      g.tags, g.isAnchor, g.orderWeight, g.reviewFile, g.pros, g.cons, g.remark
    ])
  ];

  const newWorksheet = xlsx.utils.aoa_to_sheet(excelData);
  
  newWorksheet['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 50 }, { wch: 50 }, { wch: 30 }
  ];

  xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'GameList');
  xlsx.writeFile(newWorkbook, STANDARD_EXCEL_PATH);
  console.log(`✅ 标准配表已生成: ${STANDARD_EXCEL_PATH}`);

  // 仅将 isShow 为 TRUE 的游戏写入 JSON
  const jsonGames = standardGames.filter(g => g.isShow === 'TRUE').map(g => ({
    id: g._id,
    title: g.title,
    appId: g.appId || null,
    cover: g._cover,
    playtime: g.playtime,
    showPlaytime: g.showPlaytime === 'TRUE',
    playStatus: g.playStatus,
    tags: g.tags ? g.tags.split(',').map(t => t.trim()) : [],
    isAnchor: g.isAnchor === 'TRUE',
    orderWeight: parseInt(g.orderWeight) || 0,
    reviewFile: g.reviewFile || null,
    pros: g.pros || null,
    cons: g.cons || null
  }));

  fs.writeFileSync(JSON_PATH, JSON.stringify(jsonGames, null, 2));
  console.log(`✅ 网页数据已更新: ${JSON_PATH}`);
  console.log('\n🎉 策划配表工作流执行完毕！以后请维护 data/Standard_Game_List.xlsx');
}

main();