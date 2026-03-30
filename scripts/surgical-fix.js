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

console.log('🚀 开始执行精准数据手术 (包含强制插入)...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
let rawData = xlsx.utils.sheet_to_json(worksheet);

// 1. 精确删除《光环无限（战役）》
const initialLength = rawData.length;
rawData = rawData.filter(game => {
  if (!game.title) return false;
  return !game.title.toString().includes('光环无限（战役）');
});
console.log(`✅ 已删除 ${initialLength - rawData.length} 款游戏 (光环无限战役)`);

// 2. 强制插入缺失的研发游戏
const requiredGames = [
  { title: '七日世界 (Once Human)', appId: '2139460', tags: '实战项目, 小想法, 免费开玩, 生存, 多人, 开放世界生存制作, 合作, 开放世界' },
  { title: 'Blood Storm: Alien Purge', appId: '3483190', tags: '实战项目, 小想法, 轨道射击, 射击, 第一人称, 血腥, 暴力, 外星人' }
];

requiredGames.forEach(reqGame => {
  const exists = rawData.some(g => g.title && g.title.toString().includes(reqGame.title.split(' ')[0]));
  if (!exists) {
    console.log(`   ➕ 强制插入缺失游戏: [${reqGame.title}]`);
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
});

// 3. 精确标记参与研发的游戏
const anchorGames = ['香肠派对', '七日世界', 'Blood Storm: Alien Purge'];
let anchorCount = 0;

rawData.forEach(game => {
  const title = game.title.toString().trim();
  if (anchorGames.some(ag => title.includes(ag))) {
    game.isAnchor = 'TRUE';
    game.orderWeight = 999;
    console.log(`   ⚓ 标记参与研发: [${title}]`);
    anchorCount++;
  }
});

// 4. 智能识别手游 (TapTap 验证 + 补充名单)
const mobileExplicitList = ['穿越火线枪战王者', '绝地求生刺激战场', '帕斯卡契约', 'ICEY', '艾希', '火影忍者', '深空之眼', '非人学园', '宝可梦大集结'];

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
  let mobileCount = 0;
  
  for (let i = 0; i < rawData.length; i++) {
    const game = rawData[i];
    const title = game.title.toString().trim();
    const tags = game.tags ? game.tags.toString() : '';
    
    let isMobile = false;
    
    if (title.includes('手游') || title.includes('移动版')) {
      isMobile = true;
    } else if (mobileExplicitList.some(g => title.includes(g))) {
      isMobile = true;
    } else {
      isMobile = await checkIsMobileOnTapTap(title);
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
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const newWorksheet = xlsx.utils.json_to_sheet(rawData);
  workbook.Sheets[sheetName] = newWorksheet;
  xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);

  console.log(`\n🎉 数据手术完成！`);
  console.log(`- 标记了 ${anchorCount} 款参与研发的游戏`);
  console.log(`- 智能识别了 ${mobileCount} 款移动端游戏`);
  console.log(`👉 请运行 npm run import-excel 将数据同步到网页。`);
}

processMobileGames();