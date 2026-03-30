const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始智能分类 GAAS 游戏和移动端游戏...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = xlsx.utils.sheet_to_json(worksheet);

// 常见的 GAAS 游戏关键词或明确名单
const gaasKeywords = ['多人', '免费开玩', '大型多人在线', 'MMO', '竞技', '大逃杀', '服务型'];
const gaasExplicitList = ['Arena Breakout: Infinite', 'Squad', 'Ready or Not', 'War Thunder', 'THE FINALS', 'Fallout 76', 'Evolve Stage 2', 'Apex', 'CS:GO', 'Dota 2', '原神', '崩坏：星穹铁道', '绝地求生', '守望先锋', '英雄联盟', '无畏契约', '炉石传说', '万智牌：竞技场', '游戏王：大师决斗', '三国杀', 'KARDS-二战卡牌游戏'];

// 常见的移动端游戏关键词或明确名单
const mobileKeywords = ['手游', '移动端', 'Android', 'iOS'];
const mobileExplicitList = ['香肠派对 (Sausage Man)', '高能英雄', '暗区突围', '萤火突击', '尘白禁区', '王牌战士', '和平精英', '使命召唤手游', '明日之后', '黎明觉醒', '星球重启', '原神', '崩坏：星穹铁道', '绝区零', '鸣潮', '幻塔', '战双帕弥什', '明日方舟', '无期迷途', '重返未来：1999', '白荆回廊', '少女前线', '碧蓝航线', '阴阳师', 'FGO', '王者荣耀', '第五人格', '决战！平安京', '蛋仔派对', '光遇', '哈利波特：魔法觉醒', '元梦之星', '逆水寒手游', '天涯明月刀手游', '一梦江湖', '剑网3', '天谕', '梦幻西游', '大话西游', '问道', '神武', '天龙八部', '倩女幽魂', '诛仙', '完美世界', '天下', '斗罗大陆', '新笑傲江湖', '龙族幻想', '庆余年', '天谕手游', '天涯明月刀', '逆水寒', '一梦江湖', '剑网3：指尖江湖', '梦幻西游手游', '大话西游手游', '问道手游', '神武4手游', '天龙八部手游', '倩女幽魂手游', '诛仙手游', '完美世界手游', '天下手游', '斗罗大陆：魂师对决', '新笑傲江湖手游', '龙族幻想手游', '庆余年手游'];

let gaasCount = 0;
let mobileCount = 0;

rawData.forEach(game => {
  if (!game.title) return;
  const title = game.title.toString().trim();
  const tags = game.tags ? game.tags.toString() : '';
  
  // 1. 识别并处理 GAAS 游戏
  let isGaas = false;
  if (gaasExplicitList.some(g => title.includes(g))) {
    isGaas = true;
  } else if (gaasKeywords.some(kw => tags.includes(kw))) {
    isGaas = true;
  }

  if (isGaas) {
    // 如果是 GAAS 游戏，且状态是“已通关(cleared)”或“全成就(completed)”，则强制改为“游玩中(playing)”
    if (game.playStatus === 'cleared' || game.playStatus === 'completed') {
      console.log(`   🔄 修正 GAAS 游戏状态: [${title}] (已通关 -> 游玩中)`);
      game.playStatus = 'playing';
      gaasCount++;
    }
  }

  // 2. 识别并处理移动端游戏
  let isMobile = false;
  if (mobileExplicitList.some(g => title.includes(g))) {
    isMobile = true;
  } else if (mobileKeywords.some(kw => tags.includes(kw))) {
    isMobile = true;
  }

  if (isMobile) {
    // 给移动端游戏打上特殊的内部 Tag: "Mobile"
    const existingTags = tags.split(',').map(t => t.trim()).filter(t => t);
    if (!existingTags.includes('Mobile')) {
      existingTags.push('Mobile');
      game.tags = existingTags.join(', ');
      console.log(`   📱 标记移动端游戏: [${title}]`);
      mobileCount++;
    }
  }
});

// 写回 Excel
const newWorksheet = xlsx.utils.json_to_sheet(rawData);
workbook.Sheets[sheetName] = newWorksheet;
xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);

console.log(`\n🎉 智能分类完成！`);
console.log(`- 修正了 ${gaasCount} 款 GAAS 游戏的状态`);
console.log(`- 标记了 ${mobileCount} 款移动端游戏`);
console.log(`👉 请运行 npm run import-excel 将数据同步到网页。`);