const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');

const STANDARD_EXCEL_PATH = path.join(__dirname, '../data/Standard_Game_List.xlsx');

// ==========================================
// AI 配置 (请填入你的 API Key)
// ==========================================
// 推荐使用 DeepSeek (便宜且中文好) 或 OpenAI
const API_KEY = 'YOUR_API_KEY_HERE'; 
const API_URL = 'https://api.deepseek.com/v1/chat/completions'; 

async function generateReview(gameTitle, tags) {
  const prompt = `
你是一个资深的硬核游戏策划。请为游戏《${gameTitle}》（标签：${tags}）写一段简短的评价。
要求：
1. 必须包含一个核心优点（pros）和一个核心缺点（cons）。
2. 语气要专业、客观，像是在做竞品分析，不要用玩家视角的口水话。
3. 优点和缺点各控制在 50 字以内。
4. 严格按照以下 JSON 格式输出，不要输出任何其他废话：
{
  "pros": "优点内容...",
  "cons": "缺点内容..."
}
`;

  try {
    const response = await axios.post(API_URL, {
      model: "deepseek-chat", // 如果用 OpenAI，改为 gpt-3.5-turbo 或 gpt-4o
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const content = response.data.choices[0].message.content;
    // 尝试解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error(`   ❌ 生成 ${gameTitle} 评价失败:`, error.message);
    return null;
  }
}

async function main() {
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️ 请先在 scripts/generate-ai-reviews.js 中填入你的 API Key！');
    console.log('如果你没有 API Key，可以去 platform.deepseek.com 免费注册一个。');
    return;
  }

  console.log('🚀 开始 AI 批量生成评价...');
  const workbook = xlsx.readFile(STANDARD_EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const games = xlsx.utils.sheet_to_json(worksheet);

  let updatedCount = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    
    // 只为没有评价的游戏生成，并且跳过不显示的游戏
    const isShowRaw = game.isShow;
    const isShow = isShowRaw === undefined ? true : (isShowRaw === true || isShowRaw === 'TRUE' || isShowRaw === 'true' || isShowRaw === 1);
    
    if (!game.pros && !game.cons && isShow && game.title) {
      console.log(`\n[${i + 1}/${games.length}] 正在为《${game.title}》生成评价...`);
      
      const review = await generateReview(game.title, game.tags || '');
      if (review) {
        game.pros = review.pros;
        game.cons = review.cons;
        console.log(`   ✅ 优点: ${game.pros}`);
        console.log(`   ✅ 缺点: ${game.cons}`);
        updatedCount++;
      }
      
      // 延迟防止触发 API 频率限制 (DeepSeek 通常限制 100次/分钟)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (updatedCount > 0) {
    console.log('\n🚀 正在将生成的评价写回 Excel...');
    const newWorksheet = xlsx.utils.json_to_sheet(games);
    workbook.Sheets[sheetName] = newWorksheet;
    xlsx.writeFile(workbook, STANDARD_EXCEL_PATH);
    console.log(`✅ Excel 已更新！共生成了 ${updatedCount} 条评价。`);
    console.log('👉 请运行 npm run import-excel 将数据同步到网页。');
  } else {
    console.log('\n🎉 没有需要生成评价的游戏。');
  }
}

main();