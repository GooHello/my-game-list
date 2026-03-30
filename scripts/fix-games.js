const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');

if (!fs.existsSync(STANDARD_EXCEL_PATH)) {
  console.error(`❌ 找不到标准配表: ${STANDARD_EXCEL_PATH}`);
  process.exit(1);
}

console.log('🚀 开始精准修改 Excel 数据...');

const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = xlsx.utils.sheet_to_json(worksheet);

let updatedCount = 0;

// 精准修改映射表 (修改 title 或直接指定 appId)
const modifications = {
  "泰坦陨落2": { title: "Titanfall® 2", appId: "1237970" },
  "战地": { title: "Battlefield™ 2042", appId: "1517290" }, // 战地6 就是 2042
  "光环无限": { title: "Halo Infinite", appId: "1240440" },
  "风起云涌2越南": { title: "Rising Storm 2: Vietnam", appId: "418460" },
  "逆战": { title: "逆战", appId: "2788210" }, // 逆战最近上了 Steam
  "the finals（终极角逐）": { title: "THE FINALS", appId: "2073850" },
  "战争机器": { title: "Gears 5", appId: "1097840" },
  "辐射76": { title: "Fallout 76", appId: "1151340" },
  "project wingman": { title: "Project Wingman", appId: "895870" },
  "半条命": { title: "Half-Life 2", appId: "220" },
  "森林": { title: "The Forest", appId: "242760" },
  "神秘海域": { title: "UNCHARTED™: Legacy of Thieves Collection", appId: "1659420" },
  "正当防卫": { title: "Just Cause™ 3", appId: "225540" } // 假设你指的是最经典的 正当防卫3
};

for (let i = 0; i < rawData.length; i++) {
  const game = rawData[i];
  if (!game.title) continue;

  const originalTitle = game.title.toString().trim();
  
  // 查找是否在修改列表中 (支持模糊匹配，比如原表里叫 "半条命1"，这里也能匹配到 "半条命")
  for (const [key, mod] of Object.entries(modifications)) {
    if (originalTitle.includes(key) || key.includes(originalTitle)) {
      console.log(`✅ 修改: [${originalTitle}] -> [${mod.title}] (AppID: ${mod.appId})`);
      game.title = mod.title;
      game.appId = mod.appId;
      updatedCount++;
      break; // 修改完一个就跳出内层循环
    }
  }
}

if (updatedCount > 0) {
  const newWorksheet = xlsx.utils.json_to_sheet(rawData);
  workbook.Sheets[sheetName] = newWorksheet;
  xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
  console.log(`\n🎉 Excel 修改完成！共精准修正了 ${updatedCount} 款游戏。`);
} else {
  console.log(`\n⚠️ 没有找到需要修改的游戏。`);
}