const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始强制修复研发游戏的标签...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// 强制指定的完美标签组合
const perfectTags = {
  '七日世界 (Once Human)': '实战项目, 小想法, 动作, 冒险, 角色扮演, 模拟',
  'Blood Storm: Alien Purge': '实战项目, 小想法, 动作, 冒险, 射击',
  '香肠派对': '实战项目, 小想法, 动作, 射击, Mobile'
};

let fixCount = 0;

rawData.forEach(game => {
  if (!game.title) return;
  const title = game.title.toString().trim();
  
  for (const [key, tags] of Object.entries(perfectTags)) {
    if (title.includes(key)) {
      game.tags = tags;
      console.log(`   ✅ 强制修复 Tag: [${title}] -> [${game.tags}]`);
      fixCount++;
      break;
    }
  }
});

if (fixCount > 0) {
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
  console.log(`\n🎉 修复完成！请刷新浏览器查看。`);
}