const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { generateId, parseBool, parseNullableString, coverNameFor } = require('./lib/utils');

const EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');
const JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始读取标准配表并智能匹配图片路径...');

try {
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);
  
  // 获取 covers 目录下所有真实存在的文件名
  const existingCovers = fs.existsSync(COVERS_DIR) ? fs.readdirSync(COVERS_DIR) : [];
  
  const games = rawData.map(row => {
    if (!row.title) return null;
    if (!parseBool(row.isShow, true)) return null;

    const id = generateId(row.title);

    // 智能匹配真实的图片路径（新命名优先，兼容迁移前的旧前缀文件）
    let finalCoverPath = `/covers/${coverNameFor(id)}`; // 默认路径

    const possibleFiles = [
      coverNameFor(id),
      `${id}.jpg`,
      `bing_${id}.jpg`,
      `taptap_${id}.jpg`,
      `heybox_${id}.jpg`
    ];
    
    for (const file of possibleFiles) {
      if (existingCovers.includes(file)) {
        finalCoverPath = `/covers/${file}`;
        break;
      }
    }

    return {
      id: id,
      title: row.title.toString().trim(),
      appId: parseNullableString(row.appId),
      cover: finalCoverPath,
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

  console.log(`✅ Excel 读取完成，共解析了 ${games.length} 款需要显示的游戏。`);
  
  fs.writeFileSync(JSON_PATH, JSON.stringify(games, null, 2));
  console.log(`✅ 已生成 ${JSON_PATH}`);
  console.log('\n🎉 网页数据已更新！请刷新浏览器查看。');

} catch (error) {
  console.error('❌ 处理 Excel 文件时发生错误:', error.message);
}