const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { execSync } = require('child_process');

const CSV_PATH = path.join(__dirname, '../data/games.csv');
const JSON_PATH = path.join(__dirname, '../data/games.json');

// 检查 CSV 文件是否存在
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ 找不到 CSV 文件: ${CSV_PATH}`);
  console.log('请先将你的在线表格导出为 games.csv，并放在 data 目录下。');
  console.log('\n=== CSV 表头格式与控制说明 ===');
  console.log('title        : 游戏名 (必填)');
  console.log('appId        : Steam AppID (选填，如果搜索不到或搜错，可手动指定)');
  console.log('playtime     : 游玩时长 (如 "150h")');
  console.log('showPlaytime : 是否显示时长 (填 true 或 false)');
  console.log('playStatus   : 游玩状态 (cleared=通关, completed=全成就, playing=游玩中, on-hold=搁置, dropped=放弃)');
  console.log('tags         : 标签 (逗号分隔，包含"小想法"会自动变绿并排在第一位)');
  console.log('isAnchor     : 是否为参与研发的项目 (填 true 会单独在顶部区域显示，并带🔥图标)');
  console.log('orderWeight  : 排序权重 (数字越大越靠前)');
  console.log('reviewFile   : 拆解文档文件名 (如 sekiro.md，有值才会显示跳转按钮)');
  console.log('pros         : 优点评价 (有值才会在详情页显示蓝色推荐卡片)');
  console.log('cons         : 缺点评价 (有值才会在详情页显示红色不推荐卡片)');
  console.log('==============================\n');
  process.exit(1);
}

const games = [];

console.log('🚀 开始读取 CSV 文件...');

fs.createReadStream(CSV_PATH)
  .pipe(csv())
  .on('data', (row) => {
    const id = row.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').toLowerCase() || `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    games.push({
      id: id,
      title: row.title.trim(),
      appId: row.appId ? row.appId.trim() : null,
      cover: `/covers/${id}.jpg`,
      playtime: row.playtime ? row.playtime.trim() : '',
      showPlaytime: row.showPlaytime === 'true' || row.showPlaytime === '1',
      playStatus: row.playStatus ? row.playStatus.trim() : 'playing',
      tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(t => t) : [],
      isAnchor: row.isAnchor === 'true' || row.isAnchor === '1',
      orderWeight: parseInt(row.orderWeight) || 0,
      reviewFile: row.reviewFile ? row.reviewFile.trim() : null,
      pros: row.pros ? row.pros.trim() : null,
      cons: row.cons ? row.cons.trim() : null
    });
  })
  .on('end', () => {
    console.log(`✅ CSV 读取完成，共解析了 ${games.length} 款游戏。`);
    
    fs.writeFileSync(JSON_PATH, JSON.stringify(games, null, 2));
    console.log(`✅ 已生成 ${JSON_PATH}`);

    console.log('\n🚀 开始自动抓取 Steam 封面和官方 Tag...');
    try {
      execSync('npm run fetch-steam', { stdio: 'inherit' });
      console.log('\n🎉 所有流程执行完毕！你的游戏库已经更新。');
    } catch (error) {
      console.error('❌ 抓取 Steam 数据时发生错误:', error.message);
    }
  });