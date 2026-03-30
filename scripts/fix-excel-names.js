const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始自动接受小黑盒建议，修正 Excel 游戏名称...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = xlsx.utils.sheet_to_json(worksheet);

async function getStandardNameFromHeybox(title) {
  try {
    const searchUrl = `https://api.xiaoheihe.cn/game/search/?q=${encodeURIComponent(title)}&os_type=web`;
    const response = await axios.get(searchUrl, { timeout: 5000 });
    
    if (response.data && response.data.result && response.data.result.games && response.data.result.games.length > 0) {
      const firstGame = response.data.result.games[0];
      return {
        standardName: firstGame.name,
        appId: firstGame.steam_appid ? firstGame.steam_appid.toString() : null
      };
    }
  } catch (error) {}
  return null;
}

async function main() {
  let updatedCount = 0;

  for (let i = 0; i < rawData.length; i++) {
    const game = rawData[i];
    if (!game.title) continue;

    const originalTitle = game.title.toString().trim();
    
    // 如果已经有 appId，说明之前已经完全匹配过了，跳过
    if (game.appId) continue;

    console.log(`[${i + 1}/${rawData.length}] 正在校验: ${originalTitle}`);
    
    const heyboxData = await getStandardNameFromHeybox(originalTitle);
    
    if (heyboxData && heyboxData.standardName) {
      // 自动接受小黑盒的建议名称
      if (heyboxData.standardName !== originalTitle) {
        console.log(`   ✅ 自动修正: [${originalTitle}] -> [${heyboxData.standardName}]`);
        game.title = heyboxData.standardName;
        updatedCount++;
      }
      
      // 自动填入 AppID
      if (heyboxData.appId) {
        game.appId = heyboxData.appId;
        console.log(`   ✅ 填入 AppID: ${heyboxData.appId}`);
        updatedCount++;
      }
    } else {
      console.log(`   ❌ 未找到建议，保持原样`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (updatedCount > 0) {
    console.log('\n🚀 正在将修正后的数据写回 Excel...');
    const newWorksheet = xlsx.utils.json_to_sheet(rawData);
    workbook.Sheets[sheetName] = newWorksheet;
    xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
    console.log(`✅ Excel 已永久更新！共自动修正了 ${updatedCount} 处数据。`);
  } else {
    console.log('\n🎉 所有游戏都已处理完毕。');
  }
}

main();