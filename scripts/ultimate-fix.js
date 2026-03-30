const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const cheerio = require('cheerio');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始执行终极修复手术 (全量扫描 + 严格验证)...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// ==========================================
// 1. 精确删除《光环无限（战役）》
// ==========================================
const initialLength = rawData.length;
rawData = rawData.filter(game => {
  if (!game.title) return false;
  return !game.title.toString().includes('光环无限（战役）');
});
console.log(`✅ 任务 1: 已删除 ${initialLength - rawData.length} 款游戏 (光环无限战役)`);

// ==========================================
// 2. 强制插入并标记参与研发的游戏
// ==========================================
const requiredGames = [
  { title: '七日世界 (Once Human)', appId: '2139460', tags: '实战项目, 小想法, 免费开玩, 生存, 多人, 开放世界生存制作, 合作, 开放世界' },
  { title: 'Blood Storm: Alien Purge', appId: '3483190', tags: '实战项目, 小想法, 轨道射击, 射击, 第一人称, 血腥, 暴力, 外星人' },
  { title: '香肠派对 (Sausage Man)', appId: '2404260', tags: '实战项目, 小想法, TPS, 吃鸡, 街机模式, 战斗道具, IP监修' }
];

let anchorCount = 0;
requiredGames.forEach(reqGame => {
  // 查找是否已存在 (模糊匹配前几个字)
  const searchKey = reqGame.title.split(' ')[0];
  let existingGame = rawData.find(g => g.title && g.title.toString().includes(searchKey));
  
  if (existingGame) {
    existingGame.isAnchor = 'TRUE';
    existingGame.orderWeight = 999;
    console.log(`   ⚓ 找到并标记参与研发: [${existingGame.title}]`);
  } else {
    console.log(`   ➕ 强制插入并标记参与研发: [${reqGame.title}]`);
    rawData.push({
      title: reqGame.title,
      isShow: 'TRUE',
      appId: reqGame.appId,
      playtime: '',
      showPlaytime: 'FALSE',
      playStatus: 'playing',
      tags: reqGame.tags,
      isAnchor: 'TRUE',
      orderWeight: 999,
      reviewFile: '',
      pros: '',
      cons: '',
      remark: ''
    });
  }
  anchorCount++;
});
console.log(`✅ 任务 2: 共处理了 ${anchorCount} 款参与研发的游戏`);

// ==========================================
// 3. 全量扫描并智能识别手游 (TapTap 验证 + 补充名单 + 排除误伤)
// ==========================================
const mobileExplicitList = ['穿越火线枪战王者', '绝地求生刺激战场', '帕斯卡契约', 'ICEY', '艾希', '火影忍者', '深空之眼', '非人学园', '宝可梦大集结'];
const excludeList = ['Halo', 'DOOM']; // 明确排除的主机/PC游戏

async function checkIsMobileOnTapTap(title) {
  try {
    const searchUrl = `https://www.taptap.cn/search/${encodeURIComponent(title)}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    
    let isMobile = false;
    $('.search-item-game .game-tags a').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag.includes('手游') || tag.includes('移动')) {
        isMobile = true;
      }
    });
    return isMobile;
  } catch (error) {
    return false;
  }
}

async function processMobileGames() {
  console.log(`\n🚀 开始全量扫描 TapTap 识别手游 (共 ${rawData.length} 款)...`);
  let mobileCount = 0;
  
  for (let i = 0; i < rawData.length; i++) {
    const game = rawData[i];
    const title = game.title.toString().trim();
    const tags = game.tags ? game.tags.toString() : '';
    
    let isMobile = false;
    
    // 规则 0: 排除误伤名单
    if (excludeList.some(ex => title.toLowerCase().includes(ex.toLowerCase()))) {
      isMobile = false;
    }
    // 规则 1: 名字包含手游关键词
    else if (title.includes('手游') || title.includes('移动版')) {
      isMobile = true;
    } 
    // 规则 2: 在明确的手游名单中
    else if (mobileExplicitList.some(g => title.includes(g))) {
      isMobile = true;
    } 
    // 规则 3: TapTap 全量验证
    else {
      isMobile = await checkIsMobileOnTapTap(title);
    }

    if (isMobile) {
      const existingTags = tags.split(',').map(t => t.trim()).filter(t => t);
      if (!existingTags.includes('Mobile')) {
        existingTags.push('Mobile');
        game.tags = existingTags.join(', ');
        console.log(`   📱 识别为手游: [${title}]`);
        mobileCount++;
      }
    }
    
    // 稍微延迟，防止被 TapTap 封禁
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`✅ 任务 3: 共识别出 ${mobileCount} 款移动端游戏`);

  // ==========================================
  // 4. 写回 Excel 并同步 JSON
  // ==========================================
  console.log('\n🚀 正在将最终数据写回标准配表...');
  const newWorksheet = xlsx.utils.json_to_sheet(rawData);
  workbook.Sheets[sheetName] = newWorksheet;
  xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
  console.log(`✅ 标准配表已更新: ${STANDARD_EXCEL_PATH}`);

  console.log('\n🎉 终极修复手术完成！请运行 npm run import-excel 将数据同步到网页。');
}

processMobileGames();