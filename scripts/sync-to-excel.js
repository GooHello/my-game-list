/**
 * 将 games.json 的数据同步回 Excel 表格
 * 更新 tags, appId, cover 等字段
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const GAMES_JSON_PATH = path.join(__dirname, '../data/games.json');
const EXCEL_PATH = path.join(__dirname, '../data/backup/Standard_Game_List_Backup.xlsx');
const OUTPUT_PATH = path.join(__dirname, '../data/Standard_Game_List_Updated.xlsx');

// 读取 games.json
const games = JSON.parse(fs.readFileSync(GAMES_JSON_PATH, 'utf8'));

// 构建表头
const headers = [
  'title', 'isShow', 'appId', 'playtime', 'showPlaytime', 'playStatus',
  'tags', 'isAnchor', 'orderWeight', 'reviewFile', 'pros', 'cons', 'remark', 'cover'
];

const headerLabels = [
  '游戏名称(必填)', '是否显示(TRUE/FALSE)', 'Steam AppID(选填)', '游玩时长',
  '显示时长(TRUE/FALSE)', '游玩状态(cleared/completed/playing/on-hold/dropped)',
  '标签(逗号分隔)', '参与研发(TRUE/FALSE)', '排序权重(数字)', '拆解文档(如 sekiro.md)',
  '优点评价', '缺点评价', '个人备注(不展示)', '封面路径'
];

// 构建数据行
const rows = [headers, headerLabels];

for (const game of games) {
  if (!game) continue;
  const row = [
    game.title || '',
    game.isShow !== false ? 'TRUE' : 'FALSE',
    game.appId || '',
    game.playtime || '',
    game.showPlaytime ? 'TRUE' : 'FALSE',
    game.playStatus || '',
    (game.tags || []).join(', '),
    game.isAnchor ? 'TRUE' : 'FALSE',
    game.orderWeight || 0,
    game.reviewFile || '',
    game.pros || '',
    game.cons || '',
    game.remark || '',
    game.cover || ''
  ];
  rows.push(row);
}

// 创建工作簿
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

// 设置列宽
ws['!cols'] = [
  { wch: 40 }, // title
  { wch: 10 }, // isShow
  { wch: 12 }, // appId
  { wch: 12 }, // playtime
  { wch: 12 }, // showPlaytime
  { wch: 12 }, // playStatus
  { wch: 60 }, // tags
  { wch: 10 }, // isAnchor
  { wch: 10 }, // orderWeight
  { wch: 20 }, // reviewFile
  { wch: 30 }, // pros
  { wch: 30 }, // cons
  { wch: 20 }, // remark
  { wch: 40 }, // cover
];

XLSX.utils.book_append_sheet(wb, ws, 'GameList');
XLSX.writeFile(wb, OUTPUT_PATH);

console.log(`✅ Excel 表格已更新！`);
console.log(`   输出: ${OUTPUT_PATH}`);
console.log(`   游戏数: ${games.length}`);
console.log(`   有标签: ${games.filter(g => g && g.tags && g.tags.length > 0).length}`);
