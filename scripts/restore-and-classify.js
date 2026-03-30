const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const BACKUP_EXCEL_PATH = path.join(__dirname, '../data/backup/Standard_Game_List_Backup.xlsx');
const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');

if (!fs.existsSync(BACKUP_EXCEL_PATH)) {
  console.error(`❌ 找不到备份文件: ${BACKUP_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始从备份恢复数据并执行精准修改...');

const workbook = xlsx.readFile(BACKUP_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// 1. 删除《光环无限（战役）》
const initialLength = rawData.length;
rawData = rawData.filter(game => {
  if (!game.title) return false;
  return !game.title.toString().includes('光环无限（战役）');
});
console.log(`✅ 已删除 ${initialLength - rawData.length} 款游戏 (光环无限战役)`);

// 2. 强制设置参与研发的游戏
const anchorGames = ['香肠派对', '七日世界', 'Blood Storm: Alien Purge'];
let anchorCount = 0;

rawData.forEach(game => {
  const title = game.title.toString().trim();
  
  // 检查是否为参与研发的游戏
  if (anchorGames.some(ag => title.includes(ag))) {
    game.isAnchor = 'TRUE';
    game.orderWeight = 999; // 确保排在最前面
    console.log(`   ⚓ 标记参与研发: [${title}]`);
    anchorCount++;
  }
});

// 3. 智能识别手游并打上 Mobile 标签 (不破坏原有标签)
const mobileKeywords = ['手游', '移动版', 'M', 'Mobile'];
const mobileExplicitList = ['穿越火线枪战王者', '绝地求生刺激战场', '帕斯卡契约', 'ICEY', '艾希', '火影忍者', '深空之眼', '原神', '崩坏：星穹铁道', '绝区零', '鸣潮', '幻塔', '战双帕弥什', '明日方舟', '无期迷途', '重返未来：1999', '白荆回廊', '少女前线', '碧蓝航线', '阴阳师', 'FGO', '王者荣耀', '第五人格', '决战！平安京', '蛋仔派对', '光遇', '哈利波特：魔法觉醒', '元梦之星', '逆水寒手游', '天涯明月刀手游', '一梦江湖', '剑网3', '天谕', '梦幻西游', '大话西游', '问道', '神武', '天龙八部', '倩女幽魂', '诛仙', '完美世界', '天下', '斗罗大陆', '新笑傲江湖', '龙族幻想', '庆余年'];

let mobileCount = 0;

rawData.forEach(game => {
  const title = game.title.toString().trim();
  const tags = game.tags ? game.tags.toString() : '';
  
  let isMobile = false;
  
  // 规则 1: 名字包含手游关键词
  if (mobileKeywords.some(kw => title.includes(kw))) {
    isMobile = true;
  } 
  // 规则 2: 在明确的手游名单中
  else if (mobileExplicitList.some(g => title.includes(g))) {
    isMobile = true;
  }
  // 规则 3: 之前抓取时，如果 Steam 没搜到，但 TapTap 搜到了，说明大概率是手游
  // 我们通过检查 cover 路径是否包含 taptap 来判断
  else if (game.cover && game.cover.includes('taptap')) {
    isMobile = true;
  }

  if (isMobile) {
    const existingTags = tags.split(',').map(t => t.trim()).filter(t => t);
    if (!existingTags.includes('Mobile')) {
      existingTags.push('Mobile');
      game.tags = existingTags.join(', ');
      console.log(`   📱 智能识别为手游: [${title}]`);
      mobileCount++;
    }
  }
});

// 写回 Excel
const newWorksheet = xlsx.utils.json_to_sheet(rawData);
workbook.Sheets[sheetName] = newWorksheet;
xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);

console.log(`\n🎉 数据恢复与智能分类完成！`);
console.log(`- 标记了 ${anchorCount} 款参与研发的游戏`);
console.log(`- 智能识别了 ${mobileCount} 款移动端游戏`);
console.log(`👉 请运行 npm run import-excel 将数据同步到网页。`);