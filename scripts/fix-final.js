/**
 * 终极修复脚本 - 处理所有剩余问题
 * 策略1: 已知正确的 Steam AppID 直接修正
 * 策略2: RAWG.io API 获取非 Steam 游戏数据
 * 策略3: TapTap 搜索手机游戏
 * 策略4: 手动标签映射兜底
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const GAMES_JSON_PATH = path.join(__dirname, '../data/games.json');
const COVERS_DIR = path.join(__dirname, '../public/covers');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 策略1: 已知正确的 Steam AppID 映射
// 这些游戏在 Steam 上但之前搜索失败或被错配
// ==========================================
const STEAM_CORRECTIONS = {
  '脑航员2':         { appId: '607080',  english: 'Psychonauts 2' },
  '未转变者':        { appId: '304930',  english: 'Unturned' },
  '刺客信条3重制版': { appId: '911400',  english: 'Assassins Creed III Remastered' },
  '火炬之光：无限':  { appId: '1974050', english: 'Torchlight: Infinite' },
  '星球大战原力释放2': { appId: '32500', english: 'SW Force Unleashed II' },
  '火星求生 重制版':  { appId: '3215050', english: 'Surviving Mars: Relaunched' },
  '牧场物语 来吧！风之繁华集市': { appId: '2508780', english: 'Story of Seasons' },
  '奇异人生:重逢':   { appId: '2624870', english: 'Life is Strange: Reunion' },
  'There Is No Game: Wrong Dimension': { appId: '1240210', english: 'There Is No Game' },
  'Slay the Princess — The Pristine Cut': { appId: '1989270', english: 'Slay the Princess' },
  'Halo: The Master Chief Collection': { appId: '976730', english: 'Halo: MCC' },
  '匹诺曹的谎言':    { appId: '1627720', english: 'Lies of P' },
  '堕落之王':        { appId: '265300',  english: 'Lords of the Fallen (2014)' },
  '地狱即我们':      { appId: '1620730', english: 'No Rest for the Wicked' },
  '星球大战 绝地：陨落的武士团': { appId: '1172380', english: 'Star Wars Jedi: Fallen Order' },
  '荣耀战魂':        { appId: '304390',  english: 'For Honor' },
  '铁拳8':           { appId: '1778820', english: 'TEKKEN 8' },
  '拳皇15':          { appId: '1498570', english: 'THE KING OF FIGHTERS XV' },
  '街头霸王6':       { appId: '1364780', english: 'Street Fighter 6' },
  '罪恶装备 -奋战-': { appId: '1384160', english: 'GUILTY GEAR -STRIVE-' },
  '不义联盟2':       { appId: '627270',  english: 'Injustice 2' },
  '真人快打1':       { appId: '1971870', english: 'Mortal Kombat 1' },
  '怪物猎人：世界':  { appId: '582010',  english: 'Monster Hunter: World' },
  '骑马与砍杀2：霸主': { appId: '261550', english: 'Mount & Blade II: Bannerlord' },
  'CRISIS CORE –FINAL FANTASY VII– REUNION': { appId: '1608070', english: 'Crisis Core FF7' },
  '神之天平':        { appId: '1832080', english: 'Astlibra Revision' },
  '二之国2：亡灵之国': { appId: '589360', english: 'Ni no Kuni II' },
  '上古卷轴5：天际特别版': { appId: '489830', english: 'Skyrim Special Edition' },
  '星球大战：旧共和国的武士': { appId: '32370', english: 'KOTOR' },
  '天国拯救':        { appId: '379430',  english: 'Kingdom Come: Deliverance' },
  '哈迪斯':          { appId: '1145360', english: 'Hades' },
  '巫师2：国王刺客加强版': { appId: '20920', english: 'The Witcher 2' },
  '霍格沃茨之遗':    { appId: '990080',  english: 'Hogwarts Legacy' },
  'ELEX':            { appId: '411300',  english: 'ELEX' },
  '贪婪之秋2':       { appId: '2484510', english: 'GreedFall 2' },
  '暗黑破坏神 4':    { appId: '2344520', english: 'Diablo IV' },
  '恐怖黎明':        { appId: '219990',  english: 'Grim Dawn' },
  '绝地悍将':        { appId: '545130',  english: 'Zenith' },
  '极乐迪斯科：最终剪辑版': { appId: '632470', english: 'Disco Elysium' },
  '永恒之柱2：死亡之火': { appId: '560130', english: 'Pillars of Eternity II' },
  '神界：原罪2':     { appId: '435150',  english: 'Divinity: Original Sin 2' },
  '博德之门3':       { appId: '1086940', english: 'Baldurs Gate 3' },
  '开拓者正义之怒':  { appId: '1184370', english: 'Pathfinder: Wrath of the Righteous' },
  '女神异闻录5皇家版': { appId: '1687950', english: 'Persona 5 Royal' },
  '最终幻想7 重制版': { appId: '1462040', english: 'FINAL FANTASY VII REMAKE' },
  '伊苏8：达娜的安魂曲': { appId: '579180', english: 'Ys VIII' },
  '狂战传说':        { appId: '429660',  english: 'Tales of Berseria' },
  '空之轨迹 the 1st': { appId: '3066550', english: 'Trails in the Sky FC' },
  '进化之地：传奇版': { appId: '233470', english: 'Evoland' },
  '洞窟物语':        { appId: '200900',  english: 'Cave Story+' },
  '真·女神转生 Ⅴ Vengeance': { appId: '2400510', english: 'SMT V Vengeance' },
  '地狱边境':        { appId: '48000',   english: 'LIMBO' },
  '雷曼：传奇':      { appId: '242550',  english: 'Rayman Legends' },
  '超级食肉男孩':    { appId: '40800',   english: 'Super Meat Boy' },
  '毁灭战士-永恒':   { appId: '782330',  english: 'DOOM Eternal' },
  '时光之帽':        { appId: '253230',  english: 'A Hat in Time' },
  '蔚蓝':            { appId: '504230',  english: 'Celeste' },
  '三位一体4：梦魇王子': { appId: '842100', english: 'Trine 4' },
  '人类一败涂地':    { appId: '477160',  english: 'Human: Fall Flat' },
  '链在一起':        { appId: '1412770', english: 'Chained Together' },
  '瘟疫传说：安魂曲': { appId: '1182900', english: 'A Plague Tale: Requiem' },
  'Only Up！':       { appId: '2381590', english: 'Only Up!' },
  '逃生：试炼':      { appId: '2307550', english: 'The Outlast Trials' },
  '小小梦魇2':       { appId: '860510',  english: 'Little Nightmares II' },
  '琉隐九绝':        { appId: '2378900', english: 'Nine Sols' },
  '死亡细胞':        { appId: '588650',  english: 'Dead Cells' },
  '动物井':          { appId: '813230',  english: 'Animal Well' },
  '空洞骑士':        { appId: '367520',  english: 'Hollow Knight' },
  '暗影火炬城':      { appId: '1330470', english: 'F.I.S.T.' },
  '赤痕：夜之仪式':  { appId: '692850',  english: 'Bloodstained: Ritual of the Night' },
  '茶杯头':          { appId: '268910',  english: 'Cuphead' },
  '家园：高清重制版合集': { appId: '244160', english: 'Homeworld Remastered' },
  '英雄连2':         { appId: '231430',  english: 'Company of Heroes 2' },
  '战锤 40000：战争黎明 - 终极版': { appId: '3556750', english: 'WH40K Dawn of War' },
  '要塞十字军东征：决定版': { appId: '1657160', english: 'Stronghold Crusader' },
  '帝国时代3：决定版': { appId: '933110', english: 'Age of Empires III: DE' },
  '沙丘：觉醒':      { appId: '1605220', english: 'Dune: Spice Wars' },
  '灰蛊':            { appId: '290790',  english: 'Grey Goo' },
  '太阳帝国的原罪：反叛': { appId: '204880', english: 'Sins of a Solar Empire: Rebellion' },
  '神话时代：重述版': { appId: '1934680', english: 'Age of Mythology: Retold' },
  '亿万僵尸':        { appId: '632360',  english: 'They Are Billions' },
  '要战便战':        { appId: '1451960', english: 'Wanna Survive' },
  '蚂蚁帝国':        { appId: '2600010', english: 'Empire of the Ants' },
  '战锤40K：战争黎明3': { appId: '285190', english: 'WH40K Dawn of War III' },
  '光环战争：终极版': { appId: '459220',  english: 'Halo Wars: DE' },
  'Wires And Whiskers': { appId: '3874440', english: 'Wires And Whiskers' },
  '终结者: 黑暗命运 - 反抗': { appId: '2065320', english: 'Terminator Dark Fate' },
  '闪电战2 合集':    { appId: '313500',  english: 'Blitzkrieg Anthology' },
  '影子战术：将军之刃': { appId: '418240', english: 'Shadow Tactics' },
  '战争游戏：欧洲扩张': { appId: '251060', english: 'Wargame: European Escalation' },
  '全面战争：三国':   { appId: '779340',  english: 'Total War: THREE KINGDOMS' },
  '破门而入2：北方特遣队': { appId: '1788630', english: 'Door Kickers 2' },
  '断箭':            { appId: '266760',  english: 'Broken Arrow' },
  '突袭4':           { appId: '258550',  english: 'Sudden Strike 4' },
  '蚁托邦':          { appId: '2446080', english: 'Empires of the Undergrowth' },
  '刀塔2':           { appId: '570',     english: 'Dota 2' },
  '永恒轮回':        { appId: '1049590', english: 'Eternal Return' },
  '幽浮2':           { appId: '268500',  english: 'XCOM 2' },
  '皇家骑士团：重生': { appId: '1451090', english: 'Tactics Ogre: Reborn' },
  '凤凰点':          { appId: '839770',  english: 'Phoenix Point' },
  '陷阵之志':        { appId: '590380',  english: 'Into the Breach' },
  '席德·梅尔的文明VII': { appId: '1295660', english: 'Sid Meiers Civilization VII' },
  '奇迹时代4':       { appId: '1669000', english: 'Age of Wonders 4' },
  '命运之手':        { appId: '224600',  english: 'Hand of Fate' },
  '以撒的结合：重生': { appId: '250900', english: 'Binding of Isaac: Rebirth' },
  '循环英雄':        { appId: '1282730', english: 'Loop Hero' },
  '背包乱斗：福西法的宝藏': { appId: '1970580', english: 'Backpack Battles' },
  '暗黑地牢':        { appId: '262060',  english: 'Darkest Dungeon' },
  '土豆兄弟':        { appId: '1917030', english: 'Brotato' },
  '暖雪':            { appId: '1436010', english: 'Warm Snow' },
  '吸血鬼幸存者':    { appId: '1794680', english: 'Vampire Survivors' },
  '王国保卫战 5：联盟': { appId: '2049970', english: 'Kingdom Rush 5' },
  '兽人必须死3':     { appId: '1069690', english: 'Orcs Must Die! 3' },
  '重装前哨':        { appId: '1948780', english: 'Heavy Assault Outpost' },
  '幽闭圣地2':       { appId: '236110',  english: 'Dungeon Defenders II' },
  '防御阵型：觉醒':  { appId: '218040',  english: 'Defense Grid 2' },
  '异形：地球战区':  { appId: '1549970', english: 'Aliens: Dark Descent' },
  '游戏王：大师决斗': { appId: '1449850', english: 'Yu-Gi-Oh! Master Duel' },
  '邪恶冥刻':        { appId: '1092790', english: 'Inscryption' },
  '妖精股份公司':    { appId: '1770400', english: 'Fae Farm' },
  '密教模拟器':      { appId: '718670',  english: 'Cultist Simulator' },
  '巫师之昆特牌：王权的陨落': { appId: '973760', english: 'Thronebreaker' },
  '小丑牌':          { appId: '2379780', english: 'Balatro' },
  'KARDS-二战卡牌游戏': { appId: '544810', english: 'KARDS' },
  '再来一张':        { appId: '2459170', english: 'Luck be a Landlord' },
  '杀戮尖塔':        { appId: '646570',  english: 'Slay the Spire' },
  '海岛大亨6':       { appId: '492720',  english: 'Tropico 6' },
  '模拟人生4':       { appId: '1222670', english: 'The Sims 4' },
  '脑叶公司｜模拟怪物管理': { appId: '568220', english: 'Lobotomy Corporation' },
  '边缘世界':        { appId: '294100',  english: 'RimWorld' },
  '波西亚时光':      { appId: '666140',  english: 'My Time at Portia' },
  '冰汽时代':        { appId: '323190',  english: 'Frostpunk' },
  '戴森球计划':      { appId: '1366540', english: 'Dyson Sphere Program' },
  '异星工厂':        { appId: '427520',  english: 'Factorio' },
  '幸福工厂':        { appId: '526870',  english: 'Satisfactory' },
  '异形工厂':        { appId: '1318690', english: 'shapez' },
  '深圳IO':          { appId: '504210',  english: 'SHENZHEN I/O' },
  'VA-11 Hall-A: 赛博朋克酒保行动': { appId: '447530', english: 'VA-11 Hall-A' },
  '房产达人':        { appId: '613100',  english: 'House Flipper' },
  '坦克机械师模拟器': { appId: '407130', english: 'Tank Mechanic Simulator' },
  '星露谷物语':      { appId: '413150',  english: 'Stardew Valley' },
  'Coffee Talk':      { appId: '914800', english: 'Coffee Talk' },
  '死亡搁浅：导演剪辑版': { appId: '1850570', english: 'DEATH STRANDING DC' },
  '腐蚀':            { appId: '252490',  english: 'Rust' },
  '泰拉瑞亚':        { appId: '105600',  english: 'Terraria' },
  '僵尸毁灭工程':    { appId: '108600',  english: 'Project Zomboid' },
  '英灵神殿':        { appId: '892970',  english: 'Valheim' },
  '深海迷航':        { appId: '264710',  english: 'Subnautica' },
  '风之旅人':        { appId: '638230',  english: 'Journey' },
  '蔚蓝倒影 幻舞少女之剑': { appId: '658260', english: 'Blue Reflection' },
  '逃出生天':        { appId: '1222700', english: 'A Way Out' },
  'Plushie from the Sky Demo': { appId: '1737780', english: 'Plushie from the Sky' },
  '水晶物语2':       { appId: '919750',  english: 'Crystal Story II' },
  '风暴崛起':        { appId: '1258220', english: 'Against the Storm' },
  '植物大战僵尸':    { appId: '3590',    english: 'Plants vs. Zombies GOTY' },
  '月圆之夜':        { appId: 'Mo_YuanZhiYe', skip_steam: true },
  '三国杀':          { appId: 'SanGuoSha', skip_steam: true },
  '战意':            { appId: '489520',  english: 'Conquerors Blade' },
  '暗黑之门：伦敦':  { appId: '暗黑之门', skip_steam: true },
  '史诗幻想5':       { appId: 'EpicBattle5', skip_steam: true },
};

// ==========================================
// 策略4: 手动标签兜底 (非 Steam 游戏)
// ==========================================
const MANUAL_TAGS = {
  '马里奥赛车8 豪华版': ['竞速', '多人', '派对游戏', '休闲', '本地合作'],
  '超级马里奥：奥德赛': ['3D 平台', '冒险', '开放世界', '单人', '收集'],
  '皮克敏':           ['策略', '冒险', '实时战略', '可爱', '探索'],
  '火焰之纹章 风花雪月': ['战棋', '策略角色扮演', '回合制', '剧情丰富', '角色扮演'],
  '银河战士':         ['类银河战士', '科幻', '探索', '动作', '平台游戏'],
  '口袋妖怪':         ['角色扮演', '回合制', '收集', '冒险', '多人'],
  '异界锁链':         ['动作', '砍杀', '冒险', '科幻', '单人'],
  'SHADOW OF THE COLOSSUS 汪达与巨像': ['动作', '冒险', '开放世界', 'Boss战', '单人'],
  '战国BASARA4 皇 - The Best': ['动作', '砍杀', '无双', '历史', '日式'],
  '星际争霸II':       ['即时战略', '科幻', '多人', '电子竞技', '策略'],
  '魔兽争霸3：重制版': ['即时战略', '奇幻', '多人', '策略', '经典'],
  '风暴英雄':         ['MOBA', '多人', '团队合作', '免费开玩', '策略'],
  '炉石传说':         ['卡牌', '策略', '回合制', '免费开玩', '多人'],
  '堡垒之夜':         ['大逃杀', '射击', '建造', '多人', '免费开玩'],
  '无畏契约':         ['战术射击', '多人', '第一人称射击', '电子竞技', '免费开玩'],
  '穿越火线':         ['第一人称射击', '多人', '竞技', '免费开玩', '经典'],
  '不羁联盟':         ['MOBA', '射击', '多人', '团队合作', '竞技'],
  'Minecraft':        ['沙盒', '生存', '建造', '开放世界', '多人', '创意'],
  '万智牌：竞技场':   ['卡牌', '策略', '回合制', '免费开玩', '多人'],
  '我还活着':         ['动作', '生存', '冒险', '后末日', '单人'],
  '梦幻模拟战':       ['战棋', '策略角色扮演', '回合制', '日式RPG', '多人'],
  '雷顿教授与不可思议的小镇': ['解谜', '冒险', '推理', '剧情丰富', '休闲'],
  '重装机兵 Leynos 2 Saturn 致敬精选辑': ['动作', '射击', '复古', '2D', '街机'],
  'GTI赛车':          ['竞速', '模拟', '赛车', '单人', '体育'],
  'FIFA 23':          ['足球', '体育', '模拟', '多人', '竞技'],
  '穹顶突击队':       ['射击', '多人', '战术', '动作', '团队合作'],
  '月圆之夜':         ['卡牌', 'Roguelike', '策略', '奇幻', '单人'],
  '三国杀':           ['卡牌', '策略', '多人', '三国', '桌游'],
  '暗黑之门：伦敦':   ['动作RPG', '射击', '科幻', '多人', 'Roguelike'],
  '史诗幻想5':        ['回合制RPG', '奇幻', '策略', '独立', '冒险'],
  '水晶物语2':        ['回合制RPG', '冒险', '奇幻', '独立', '休闲'],
  '合金装备-崛起-复仇': ['动作', '砍杀', '科幻', '单人', '快节奏'],
  '火炬之光：无限':   ['动作RPG', '刷宝', 'Hack and Slash', '奇幻', '多人'],
  // 手机游戏
  '萤火突击(国服)':    ['射击', '战术射击', '多人', 'Mobile'],
  '绝地求生刺激战场':  ['大逃杀', '射击', '多人', 'Mobile'],
  '尘白禁区':         ['动作', '射击', '科幻', 'Mobile'],
  '火力苏达T3':       ['射击', '动作', '多人', 'Mobile'],
  '王牌战士':         ['射击', '多人', '竞技', 'Mobile'],
  '穿越火线枪战王者':  ['射击', '多人', '竞技', 'Mobile'],
  '使命召唤手游':      ['射击', '多人', '大逃杀', 'Mobile'],
  '高能英雄':         ['射击', '多人', '战术', 'Mobile'],
  '地下城与勇士 起源': ['动作RPG', '格斗', '多人', 'Mobile'],
  '绝区零':           ['动作', '都市奇幻', '角色扮演', 'Mobile'],
  '战双帕弥什':       ['动作', '科幻', '角色扮演', 'Mobile'],
  '深空之眼':         ['动作', '角色扮演', '科幻', 'Mobile'],
  '龙之谷手游':       ['动作RPG', '奇幻', '多人', 'Mobile'],
  '火影忍者':         ['格斗', '动作', '多人', 'Mobile'],
  '天天酷跑':         ['跑酷', '休闲', '动作', 'Mobile'],
  '疯狂机械师':       ['休闲', '解谜', '模拟', 'Mobile'],
  '英雄联盟 手游':    ['MOBA', '多人', '竞技', 'Mobile'],
  '宝可梦大集结':     ['MOBA', '多人', '策略', 'Mobile'],
  '王者荣耀':         ['MOBA', '多人', '竞技', 'Mobile'],
  '非人学园':         ['MOBA', '多人', '动作', 'Mobile'],
  '少女前线2：追放':  ['策略', '角色扮演', '战术', 'Mobile'],
  '艾希':             ['动作', '砍杀', '独立', 'Mobile'],
  '鸣潮':             ['动作RPG', '开放世界', '角色扮演', 'Mobile'],
  '香肠派对':         ['大逃杀', '射击', '休闲', 'Mobile'],
  '开罗拉面店 (The Ramen Sensei)': ['模拟', '经营', '休闲', '像素图形', 'Mobile'],
};

// ==========================================
// Steam 抓取函数
// ==========================================
async function getSteamTags(appId) {
  try {
    const r = await axios.get(`https://store.steampowered.com/app/${appId}?l=schinese`, {
      headers: { 'Cookie': 'birthtime=288057601; mature_content=1;', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const tags = [];
    $('a.app_tag').each(function (i, el) {
      const t = $(el).text().trim();
      if (t && t !== '+') tags.push(t);
    });
    return tags.slice(0, 8);
  } catch (e) { return []; }
}

async function downloadSteamCover(appId, gameId) {
  const safeId = gameId.replace(/[<>:"/\\|?*]/g, '_');
  const fileName = `${safeId}.jpg`;
  const filePath = path.join(COVERS_DIR, fileName);
  
  const urls = [
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
  ];
  
  for (const url of urls) {
    try {
      const r = await axios({ url, method: 'GET', responseType: 'stream', timeout: 10000 });
      if (!(r.headers['content-type'] || '').includes('image')) continue;
      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(filePath);
        r.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
      });
      return `/covers/${fileName}`;
    } catch (e) { continue; }
  }
  return null;
}

// ==========================================
// RAWG.io API (免费游戏数据库，用于非 Steam 游戏)
// ==========================================
async function searchRAWG(title) {
  try {
    // RAWG 公开搜索页面（无需 API key）
    const url = `https://rawg.io/search?query=${encodeURIComponent(title)}`;
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });
    const $ = cheerio.load(r.data);
    
    // 尝试从页面提取游戏数据
    const gameCard = $('a[href*="/games/"]').first();
    if (gameCard.length) {
      const href = gameCard.attr('href');
      const imgEl = gameCard.find('img').first();
      const imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
      return { slug: href, coverUrl: imgSrc };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ==========================================
// 主流程
// ==========================================
async function main() {
  console.log('🚀 终极修复脚本启动');
  console.log('='.repeat(60));

  const games = JSON.parse(fs.readFileSync(GAMES_JSON_PATH, 'utf8'));
  
  let stats = { steam_fixed: 0, manual_tags: 0, covers_fixed: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    if (!game) continue;

    const title = game.title;
    const hasTags = game.tags && game.tags.length > 0 && !game.tags.every(t => ['Mobile', '小想法', '实战项目'].includes(t));
    const hasBingCover = game.cover && game.cover.includes('bing_');
    const needsWork = !hasTags || hasBingCover;

    if (!needsWork) {
      continue; // 跳过不需要处理的
    }

    console.log(`\n[${i + 1}/${games.length}] 🔧 ${title}`);

    // ---- 策略1: Steam 修正 ----
    const correction = STEAM_CORRECTIONS[title];
    if (correction && !correction.skip_steam) {
      console.log(`  📦 Steam 修正: AppID ${correction.appId} (${correction.english})`);
      game.appId = correction.appId;

      // 获取 Steam 标签
      if (!hasTags) {
        const tags = await getSteamTags(correction.appId);
        if (tags.length > 0) {
          const custom = (game.tags || []).filter(t => ['小想法', '实战项目', 'Mobile'].includes(t));
          game.tags = [...new Set([...custom, ...tags])];
          console.log(`  ✅ Steam 标签: ${tags.slice(0, 5).join(', ')}...`);
          stats.steam_fixed++;
        } else {
          // 后备: 用手动标签
          if (MANUAL_TAGS[title]) {
            const custom = (game.tags || []).filter(t => ['小想法', '实战项目'].includes(t));
            game.tags = [...new Set([...custom, ...MANUAL_TAGS[title]])];
            console.log(`  ✅ 手动标签: ${MANUAL_TAGS[title].join(', ')}`);
            stats.manual_tags++;
          }
        }
        await delay(1500);
      }

      // 下载 Steam 封面
      if (hasBingCover) {
        const coverPath = await downloadSteamCover(correction.appId, game.id);
        if (coverPath) {
          game.cover = coverPath;
          console.log(`  ✅ Steam 封面: ${coverPath}`);
          stats.covers_fixed++;
        } else {
          console.log(`  ⚠️ Steam 封面下载失败`);
        }
        await delay(1000);
      }
      continue;
    }

    // ---- 策略4: 手动标签兜底 ----
    if (!hasTags && MANUAL_TAGS[title]) {
      const custom = (game.tags || []).filter(t => ['小想法', '实战项目'].includes(t));
      game.tags = [...new Set([...custom, ...MANUAL_TAGS[title]])];
      console.log(`  ✅ 手动标签: ${MANUAL_TAGS[title].join(', ')}`);
      stats.manual_tags++;
    }

    // 每 20 个保存一次
    if (i % 20 === 19) {
      fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2), 'utf8');
      console.log(`\n💾 进度已保存 (${i + 1}/${games.length})`);
    }
  }

  // 最终保存
  fs.writeFileSync(GAMES_JSON_PATH, JSON.stringify(games, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 终极修复完成！');
  console.log(`  ✅ Steam 修正: ${stats.steam_fixed}`);
  console.log(`  🏷️ 手动标签: ${stats.manual_tags}`);
  console.log(`  🖼️ 封面修复: ${stats.covers_fixed}`);
  console.log(`  💥 错误: ${stats.errors}`);
}

main().catch(console.error);
