/**
 * 数据校验脚本：npm run validate-data
 *
 * 把 CHANGELOG 里"改完必须验证"的纪律落地成工具：
 * 任何修改 games.json / 封面 / 标签配置的操作之后，跑一遍这个脚本。
 *
 * 校验项：
 * 1. games.json 每条记录通过 schema 校验（14 字段、类型、playStatus 枚举）
 * 2. 无重复 id
 * 3. cover 路径指向 public/covers 下真实存在的文件（路径必须实际校验原则）
 * 4. public/covers 无孤儿文件（有则列出，不视为致命错误）
 * 5. data/tag-config.json 结构完整，mapping 目标都在导航标签内
 *
 * 退出码：0=全部通过；1=存在致命错误
 */
const fs = require('fs');
const path = require('path');
const { validateGame } = require('./lib/utils');

const ROOT = path.join(__dirname, '..');
const GAMES_JSON = path.join(ROOT, 'data', 'games.json');
const COVERS_DIR = path.join(ROOT, 'public', 'covers');
const TAG_CONFIG = path.join(ROOT, 'data', 'tag-config.json');

let errors = 0;
let warnings = 0;
const fail = (msg) => { errors++; console.error(`  ❌ ${msg}`); };
const warn = (msg) => { warnings++; console.warn(`  ⚠️  ${msg}`); };
const ok = (msg) => console.log(`  ✅ ${msg}`);

console.log('🔍 校验 data/games.json ...');
let games = [];
try {
  games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
} catch (e) {
  console.error(`  ❌ games.json 无法解析: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(games)) {
  console.error('  ❌ games.json 顶层应为数组');
  process.exit(1);
}

// 1. schema 校验
let schemaBad = 0;
games.forEach((g, i) => {
  if (g === null) return;
  const { valid, errors: errs } = validateGame(g);
  if (!valid) {
    schemaBad++;
    if (schemaBad <= 5) fail(`第 ${i} 条 [${g && g.id}] 字段不合法: ${errs.join('; ')}`);
  }
});
if (schemaBad === 0) ok(`${games.filter(g => g).length} 条记录全部通过 schema 校验`);
else fail(`共 ${schemaBad} 条记录字段不合法`);

// 2. 重复 id
const ids = games.filter(g => g).map(g => g.id);
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupIds.length === 0) ok('无重复 id');
else fail(`重复 id: ${[...new Set(dupIds)].join(', ')}`);

// 3. cover 路径必须指向真实文件
const coverFiles = new Set(fs.existsSync(COVERS_DIR) ? fs.readdirSync(COVERS_DIR) : []);
const missing = [];
for (const g of games) {
  if (!g) continue;
  if (!g.cover) { missing.push(`${g.id} -> (cover 为空)`); continue; }
  const file = g.cover.replace(/^\/covers\//, '');
  if (!g.cover.startsWith('/covers/') || !coverFiles.has(file)) {
    missing.push(`${g.id} -> ${g.cover}`);
  }
}
if (missing.length === 0) ok('所有 cover 路径都指向真实存在的封面文件');
else {
  missing.slice(0, 10).forEach(m => fail(`封面缺失: ${m}`));
  if (missing.length > 10) fail(`... 等共 ${missing.length} 条封面缺失`);
}

// 4. 孤儿封面（警告，不致命）
const referenced = new Set(games.filter(g => g).map(g => (g.cover || '').replace(/^\/covers\//, '')).filter(Boolean));
const orphans = [...coverFiles].filter(f => !referenced.has(f));
if (orphans.length === 0) ok('public/covers 无孤儿文件');
else warn(`${orphans.length} 张孤儿封面（无游戏引用）: ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? ' ...' : ''}`);

// 5. 标签配置完整性
console.log('🔍 校验 data/tag-config.json ...');
try {
  const cfg = JSON.parse(fs.readFileSync(TAG_CONFIG, 'utf8'));
  const tiers = cfg.tiers || {};
  const navTags = new Set([...(tiers.core || []), ...(tiers.sub || []), ...(tiers.mode || [])]);
  if (!cfg.mobileTag) fail('缺少 mobileTag 配置');
  if (navTags.size === 0) fail('tiers 为空');
  else ok(`导航标签 ${navTags.size} 个（core/sub/mode 三行齐全: ${!!tiers.core && !!tiers.sub && !!tiers.mode}）`);
  const deadTargets = [...new Set(Object.values(cfg.mapping || {}))].filter(t => !navTags.has(t));
  if (deadTargets.length === 0) ok('mapping 所有目标标签都在导航体系内（无死映射）');
  else fail(`mapping 目标不在导航标签内（死映射）: ${deadTargets.join(', ')}`);
  if (!navTags.has(cfg.mapping[cfg.mobileTag])) fail(`mobileTag "${cfg.mobileTag}" 的映射目标不在导航内`);
} catch (e) {
  fail(`tag-config.json 无法解析: ${e.message}`);
}

// 汇总
console.log('');
if (errors === 0) {
  console.log(`🎉 校验通过（${warnings} 条警告）`);
  process.exit(0);
} else {
  console.log(`💥 校验失败：${errors} 个错误，${warnings} 条警告`);
  process.exit(1);
}
