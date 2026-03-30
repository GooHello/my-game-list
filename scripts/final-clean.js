const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始执行终极暴力数据清洗...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// ==========================================
// 1. 暴力精确删除《光环无限（战役）》
// ==========================================
const initialLength = rawData.length;
rawData = rawData.filter(game => {
  if (!game.title) return false;
  const title = game.title.toString().trim();
  // 匹配各种可能的变体
  return !(title.includes('光环无限（战役）') || title === '光环：无限 (战役)' || title === 'Halo Infinite (Campaign)');
});
console.log(`✅ 任务 1: 已删除 ${initialLength - rawData.length} 款游戏 (光环无限战役)`);

// ==========================================
// 2. 暴力手游白名单分类 (绝对控制)
// ==========================================
const mobileWhiteList = [
  '穿越火线枪战王者', '绝地求生刺激战场', '帕斯卡契约', 'ICEY', '艾希', '火影忍者', '深空之眼', '非人学园', '宝可梦大集结',
  '火力苏打', '王牌战士', '高能英雄', '萤火突击', '尘白禁区', '香肠派对', '和平精英', '使命召唤手游', '明日之后', '黎明觉醒', 
  '星球重启', '原神', '崩坏：星穹铁道', '绝区零', '鸣潮', '幻塔', '战双帕弥什', '明日方舟', '无期迷途', '重返未来：1999', 
  '白荆回廊', '少女前线', '碧蓝航线', '阴阳师', 'FGO', '王者荣耀', '第五人格', '决战！平安京', '蛋仔派对', '光遇', 
  '哈利波特：魔法觉醒', '元梦之星', '逆水寒手游', '天涯明月刀手游', '一梦江湖', '剑网3', '天谕', '梦幻西游', '大话西游', 
  '问道', '神武', '天龙八部', '倩女幽魂', '诛仙', '完美世界', '天下', '斗罗大陆', '新笑傲江湖', '龙族幻想', '庆余年',
  '暗区突围' // 注意：暗区突围无限是PC，暗区突围是手游
];

let mobileCount = 0;

rawData.forEach(game => {
  const title = game.title.toString().trim();
  let tags = game.tags ? game.tags.toString() : '';
  let existingTags = tags.split(',').map(t => t.trim()).filter(t => t);
  
  let isMobile = false;
  
  // 规则 1: 名字包含明确的手游后缀
  if (title.includes('手游') || title.includes('移动版') || title.endsWith(' M') || title.endsWith(' Mobile')) {
    isMobile = true;
  } 
  // 规则 2: 在绝对白名单中
  else if (mobileWhiteList.some(g => title === g || title.includes(g))) {
    // 特殊处理：排除《暗区突围无限》(PC端)
    if (title.includes('暗区突围无限') || title.includes('Arena Breakout: Infinite')) {
      isMobile = false;
    } else {
      isMobile = true;
    }
  }

  if (isMobile) {
    if (!existingTags.includes('Mobile')) {
      existingTags.push('Mobile');
      game.tags = existingTags.join(', ');
      console.log(`   📱 强制标记为手游: [${title}]`);
      mobileCount++;
    }
  }
});
console.log(`✅ 任务 2: 共强制标记了 ${mobileCount} 款移动端游戏`);

// ==========================================
// 3. 暴力清洗误伤 (绝对黑名单)
// ==========================================
const mobileBlackList = ['Halo', 'DOOM', '光环', '毁灭战士', 'Minecraft', '我的世界', '泰拉瑞亚', 'Terraria'];
let cleanCount = 0;

rawData.forEach(game => {
  const title = game.title.toString().trim();
  let tags = game.tags ? game.tags.toString() : '';
  let existingTags = tags.split(',').map(t => t.trim()).filter(t => t);
  
  if (mobileBlackList.some(b => title.toLowerCase().includes(b.toLowerCase()))) {
    if (existingTags.includes('Mobile')) {
      existingTags = existingTags.filter(t => t !== 'Mobile');
      game.tags = existingTags.join(', ');
      console.log(`   🧹 强制剥夺手游标签: [${title}]`);
      cleanCount++;
    }
  }
});
console.log(`✅ 任务 3: 共清洗了 ${cleanCount} 款被误伤的游戏`);

// ==========================================
// 4. 写回 Excel 并同步 JSON
// ==========================================
console.log('\n🚀 正在将最终数据写回标准配表...');
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
console.log(`\n🎉 终极暴力清洗完成！请刷新浏览器查看。`);