const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始修正 GAAS 游戏状态...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// 明确的 GAAS 游戏名单
const gaasExplicitList = [
  'Arena Breakout: Infinite', 'Squad', 'Ready or Not', 'War Thunder', 'THE FINALS', 'Fallout 76', 'Evolve Stage 2', 
  'Apex', 'CS:GO', 'Dota 2', '原神', '崩坏：星穹铁道', '绝地求生', '守望先锋', '英雄联盟', '无畏契约', '炉石传说', 
  '万智牌：竞技场', '游戏王：大师决斗', '三国杀', 'KARDS-二战卡牌游戏', '战地', 'Battlefield', '使命召唤', 'Call of Duty',
  '彩虹六号', 'Rainbow Six', '命运2', 'Destiny 2', '星际战甲', 'Destiny', '逃离塔科夫', 'Escape from Tarkov',
  '永劫无间', 'NARAKA', '黎明杀机', 'Dead by Daylight', 'Rust', '腐蚀', 'DayZ', '方舟：生存进化', 'ARK',
  '七日世界', '香肠派对', 'Blood Storm'
];

let gaasCount = 0;

rawData.forEach(game => {
  if (!game.title) return;
  const title = game.title.toString().trim();
  
  let isGaas = false;
  if (gaasExplicitList.some(g => title.includes(g))) {
    isGaas = true;
  }

  if (isGaas) {
    if (game.playStatus === 'cleared' || game.playStatus === 'completed') {
      console.log(`   🔄 修正 GAAS 游戏状态: [${title}] (已通关 -> 游玩中)`);
      game.playStatus = 'playing';
      gaasCount++;
    }
  }
});

// 写回 Excel
const newWorksheet = xlsx.utils.json_to_sheet(rawData);
workbook.Sheets[sheetName] = newWorksheet;
xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);

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

console.log(`\n🎉 修正完成！共修正了 ${gaasCount} 款 GAAS 游戏的状态。`);