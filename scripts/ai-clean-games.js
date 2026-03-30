const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');

// ==========================================
// AI 配置 (请填入你的 API Key)
// ==========================================
const API_KEY = 'YOUR_API_KEY_HERE'; // 替换为你的 DeepSeek 或 OpenAI API Key
const API_URL = 'https://api.deepseek.com/v1/chat/completions'; // 以 DeepSeek 为例

async function cleanGamesBatch(gamesBatch) {
  const prompt = `
你是一个资深的游戏数据库专家。我有一批玩家口语化的游戏名称，可能包含错别字、简称或别名。
请帮我将它们规范化为【Steam 官方英文名】或【最准确的官方中文名】，并提供它们的【Steam AppID】。
如果是手游或主机独占（Steam 上绝对没有），AppID 填 null。

输入列表：
${JSON.stringify(gamesBatch, null, 2)}

请严格按照以下 JSON 数组格式输出，不要输出任何其他废话：
[
  {
    "originalTitle": "原名",
    "standardTitle": "规范化后的官方名 (优先英文，如 Grand Theft Auto V)",
    "appId": "Steam AppID (如 271590，如果没有则为 null)"
  }
]
`;

  try {
    const response = await axios.post(API_URL, {
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1 // 极低温度，保证准确性
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error(`❌ AI 清洗失败:`, error.message);
    return null;
  }
}

async function main() {
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️ 请先在 scripts/ai-clean-games.js 中填入你的 API Key！');
    return;
  }

  console.log('🚀 开始 AI 批量清洗游戏名称...');
  const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);

  // 过滤出需要清洗的游戏 (没有 appId 的)
  const gamesToClean = rawData.filter(g => !g.appId && g.title);
  console.log(`需要清洗的游戏数量: ${gamesToClean.length}`);

  // 分批处理，每批 20 个，防止 Token 超限
  const batchSize = 20;
  let updatedCount = 0;

  for (let i = 0; i < gamesToClean.length; i += batchSize) {
    const batch = gamesToClean.slice(i, i + batchSize).map(g => g.title);
    console.log(`\n正在处理第 ${i + 1} 到 ${Math.min(i + batchSize, gamesToClean.length)} 个游戏...`);
    
    const cleanedBatch = await cleanGamesBatch(batch);
    
    if (cleanedBatch) {
      cleanedBatch.forEach(cleaned => {
        // 在原数据中找到对应的游戏并更新
        const game = rawData.find(g => g.title === cleaned.originalTitle);
        if (game) {
          console.log(`   ✅ [${cleaned.originalTitle}] -> [${cleaned.standardTitle}] (AppID: ${cleaned.appId})`);
          game.title = cleaned.standardTitle; // 更新为规范名
          if (cleaned.appId) {
            game.appId = cleaned.appId.toString();
          }
          updatedCount++;
        }
      });
    }
    
    // 稍微延迟，防止 API 频率限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (updatedCount > 0) {
    console.log('\n🚀 正在将清洗后的数据写回 Excel...');
    const newWorksheet = xlsx.utils.json_to_sheet(rawData);
    workbook.Sheets[sheetName] = newWorksheet;
    xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
    console.log(`✅ Excel 已更新！共清洗了 ${updatedCount} 款游戏。`);
  } else {
    console.log('\n🎉 没有需要清洗的游戏。');
  }
}

main();