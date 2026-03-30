const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

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

    const isShowRaw = row.isShow;
    const isShow = isShowRaw === undefined ? true : (isShowRaw === true || isShowRaw === 'TRUE' || isShowRaw === 'true' || isShowRaw === 1);
    if (!isShow) return null;

    const id = row.title.toString().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').toLowerCase() || `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 智能匹配真实的图片路径
    let finalCoverPath = `/covers/${id}.jpg`; // 默认路径
    
    // 检查是否存在带前缀的图片 (比如 bing_id.jpg, taptap_id.jpg, heybox_id.jpg)
    const possibleFiles = [
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
      appId: row.appId ? row.appId.toString().trim() : null,
      cover: finalCoverPath,
      playtime: row.playtime ? row.playtime.toString().trim() : '',
      showPlaytime: row.showPlaytime === true || row.showPlaytime === 'TRUE' || row.showPlaytime === 'true' || row.showPlaytime === 1,
      playStatus: row.playStatus ? row.playStatus.toString().trim() : 'cleared',
      tags: row.tags ? row.tags.toString().split(',').map(t => t.trim()).filter(t => t) : [],
      isAnchor: row.isAnchor === true || row.isAnchor === 'TRUE' || row.isAnchor === 'true' || row.isAnchor === 1,
      orderWeight: parseInt(row.orderWeight) || 0,
      reviewFile: row.reviewFile ? row.reviewFile.toString().trim() : null,
      pros: row.pros ? row.pros.toString().trim() : null,
      cons: row.cons ? row.cons.toString().trim() : null,
      remark: row.remark ? row.remark.toString().trim() : null
    };
  }).filter(game => game !== null);

  console.log(`✅ Excel 读取完成，共解析了 ${games.length} 款需要显示的游戏。`);
  
  fs.writeFileSync(JSON_PATH, JSON.stringify(games, null, 2));
  console.log(`✅ 已生成 ${JSON_PATH}`);
  console.log('\n🎉 网页数据已更新！请刷新浏览器查看。');

} catch (error) {
  console.error('❌ 处理 Excel 文件时发生错误:', error.message);
}