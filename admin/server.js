/**
 * Game List Admin Panel - 本地管理服务器
 * 启动: npm run admin
 * 访问: http://localhost:4000
 *
 * 安全模型：
 * - 仅监听 127.0.0.1 回环地址，局域网内其他设备无法访问
 * - 每次启动生成一次性管理令牌，注入页面后经 x-admin-key 头校验
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const multer = require('multer');
const { exec } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');
const { generateId, validateGame } = require('../scripts/lib/utils');

const execAsync = promisify(exec);

const app = express();
const PORT = 4000;
const ROOT = path.join(__dirname, '..');
const GAMES_JSON = path.join(ROOT, 'data', 'games.json');
const COVERS_DIR = path.join(ROOT, 'public', 'covers');
const BACKUP_DIR = path.join(ROOT, 'data', 'backup');

// 每次启动生成一次性管理令牌：
// 通过注入到 index.html 传给前端，API 请求必须携带 x-admin-key 头
const ADMIN_TOKEN = crypto.randomBytes(16).toString('hex');

// 中间件
app.use(express.json({ limit: '10mb' }));

// 首页：注入管理令牌后再下发（必须在 express.static 之前注册）
app.get('/', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  res.type('html').send(
    html.replace('</head>', `<script>window.__ADMIN_TOKEN__="${ADMIN_TOKEN}";</script></head>`)
  );
});

app.use(express.static(path.join(__dirname, 'public')));
// 让封面图片可以预览（nosniff 防止上传文件被嗅探成 HTML 执行）
app.use('/covers', express.static(COVERS_DIR, {
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// API 鉴权：所有 /api 请求必须携带启动时生成的一次性令牌
app.use('/api', (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (typeof key === 'string' && key.length === ADMIN_TOKEN.length &&
      crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_TOKEN))) {
    return next();
  }
  res.status(401).json({ error: 'unauthorized' });
});

// 封面上传配置
// 扩展名由服务端按 mimetype 决定，不信任客户端文件名（防止扩展名伪造）
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: COVERS_DIR,
    filename: (req, file, cb) => {
      const gameId = req.params.id.replace(/[<>:"/\\|?*]/g, '_');
      const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
      cb(null, `${gameId}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('只允许上传 jpg/png/webp/gif 图片'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// schema 校验中间件：POST 的游戏数据必须通过校验
function validateGamePayload(req, res, next) {
  const { valid, errors } = validateGame(req.body);
  if (!valid) return res.status(400).json({ error: '数据校验失败: ' + errors.join('; ') });
  next();
}

// ==========================================
// API: 游戏管理
// ==========================================

// 获取所有游戏
app.get('/api/games', (req, res) => {
  try {
    const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
    res.json(games.filter(g => g !== null));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取单个游戏
app.get('/api/games/:id', (req, res) => {
  const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
  const game = games.find(g => g && g.id === req.params.id);
  if (!game) return res.status(404).json({ error: '游戏不存在' });
  res.json(game);
});

// 更新游戏（字段白名单合并 + schema 校验，id 不可被覆盖）
app.put('/api/games/:id', (req, res) => {
  try {
    const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
    const idx = games.findIndex(g => g && g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '游戏不存在' });

    // 只允许更新白名单字段，忽略其余输入（包括 id）
    const UPDATABLE = ['title', 'appId', 'cover', 'playtime', 'showPlaytime', 'playStatus',
      'tags', 'isAnchor', 'orderWeight', 'reviewFile', 'pros', 'cons', 'remark'];
    const patch = {};
    for (const field of UPDATABLE) {
      if (req.body[field] !== undefined) patch[field] = req.body[field];
    }
    const updatedGame = { ...games[idx], ...patch };

    const { valid, errors } = validateGame(updatedGame);
    if (!valid) return res.status(400).json({ error: '数据校验失败: ' + errors.join('; ') });

    games[idx] = updatedGame;
    fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');
    res.json({ success: true, game: updatedGame });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 添加游戏（id 统一由 generateId 生成，schema 校验后写入）
app.post('/api/games', validateGamePayload, (req, res) => {
  try {
    const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
    const newGame = {
      id: generateId(req.body.title),
      title: req.body.title,
      appId: req.body.appId || '',
      cover: req.body.cover || '',
      playtime: req.body.playtime || '',
      showPlaytime: req.body.showPlaytime || false,
      playStatus: req.body.playStatus || 'playing',
      tags: req.body.tags || [],
      isAnchor: req.body.isAnchor || false,
      orderWeight: req.body.orderWeight || 0,
      reviewFile: req.body.reviewFile || null,
      pros: req.body.pros || null,
      cons: req.body.cons || null,
      remark: req.body.remark || null,
    };

    // 检查是否重复
    if (games.find(g => g && g.id === newGame.id)) {
      return res.status(400).json({ error: '游戏ID已存在' });
    }

    games.push(newGame);
    fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');
    res.json({ success: true, game: newGame });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除游戏
app.delete('/api/games/:id', (req, res) => {
  try {
    const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
    const idx = games.findIndex(g => g && g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '游戏不存在' });

    const removed = games.splice(idx, 1)[0];
    fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');
    res.json({ success: true, removed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// API: 封面管理
// ==========================================

// 上传封面
app.post('/api/covers/:id', upload.single('cover'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '没有文件' });

    const coverPath = `/covers/${req.file.filename}`;
    // 更新 games.json
    const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
    const game = games.find(g => g && g.id === req.params.id);
    if (game) {
      game.cover = coverPath;
      fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');
    }
    res.json({ success: true, cover: coverPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 从 Steam 下载封面
app.post('/api/covers/:id/steam', async (req, res) => {
  try {
    const { appId } = req.body;
    if (!appId) return res.status(400).json({ error: '缺少 appId' });

    const gameId = req.params.id.replace(/[<>:"/\\|?*]/g, '_');
    const fileName = `${gameId}.jpg`;
    const filePath = path.join(COVERS_DIR, fileName);

    const urls = [
      `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
      `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`,
    ];

    for (const url of urls) {
      try {
        const r = await axios({ url, responseType: 'stream', timeout: 15000 });
        if (!(r.headers['content-type'] || '').includes('image')) continue;
        await new Promise((resolve, reject) => {
          const w = fs.createWriteStream(filePath);
          r.data.pipe(w);
          w.on('finish', resolve);
          w.on('error', reject);
        });

        const coverPath = `/covers/${fileName}`;
        const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));
        const game = games.find(g => g && g.id === req.params.id);
        if (game) {
          game.cover = coverPath;
          game.appId = appId;
          fs.writeFileSync(GAMES_JSON, JSON.stringify(games, null, 2), 'utf8');
        }
        return res.json({ success: true, cover: coverPath });
      } catch (e) { continue; }
    }
    res.status(500).json({ error: '所有Steam CDN都下载失败' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 从 Steam 抓取标签
app.post('/api/tags/steam/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const url = `https://store.steampowered.com/app/${appId}?l=schinese`;
    const r = await axios.get(url, {
      headers: {
        'Cookie': 'birthtime=288057601; mature_content=1; wants_mature_content=1;',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const tags = [];
    $('a.app_tag').each(function () {
      const t = $(this).text().trim();
      if (t && t !== '+') tags.push(t);
    });
    const name = $('div.apphub_AppName').text().trim();
    res.json({ tags: tags.slice(0, 10), name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// API: 统计信息
// ==========================================
app.get('/api/stats', (req, res) => {
  const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8')).filter(g => g);
  const statusCount = {};
  const tagCount = {};
  let missingCovers = 0;

  games.forEach(g => {
    statusCount[g.playStatus || 'unknown'] = (statusCount[g.playStatus || 'unknown'] || 0) + 1;
    (g.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
    if (g.cover && !fs.existsSync(path.join(ROOT, 'public', g.cover))) missingCovers++;
  });

  res.json({
    total: games.length,
    statusCount,
    tagCount: Object.entries(tagCount).sort((a, b) => b[1] - a[1]),
    missingCovers,
    anchors: games.filter(g => g.isAnchor).length,
    reviews: games.filter(g => g.reviewFile).length,
  });
});

// ==========================================
// API: 备份 & 部署
// ==========================================

// 备份
app.post('/api/backup', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `games_${timestamp}.json`);
    fs.copyFileSync(GAMES_JSON, backupPath);
    res.json({ success: true, path: backupPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取备份列表
app.get('/api/backups', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 恢复备份（文件名白名单校验 + 目录逃逸检查 + 内容兼容性检查）
app.post('/api/restore/:file', (req, res) => {
  try {
    const file = path.basename(req.params.file);
    if (!/^[\w.-]+\.json$/.test(file)) {
      return res.status(400).json({ error: '非法的备份文件名' });
    }
    const backupPath = path.resolve(BACKUP_DIR, file);
    if (!backupPath.startsWith(path.resolve(BACKUP_DIR) + path.sep)) {
      return res.status(400).json({ error: '非法的备份路径' });
    }
    if (!fs.existsSync(backupPath)) return res.status(404).json({ error: '备份不存在' });

    // 恢复前校验备份内容与当前 schema 兼容（防止用旧格式备份覆盖丢字段）
    let backupData;
    try {
      backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    } catch (e) {
      return res.status(400).json({ error: '备份文件不是有效 JSON' });
    }
    if (!Array.isArray(backupData) || backupData.length === 0) {
      return res.status(400).json({ error: '备份格式错误：应为非空游戏数组' });
    }
    const bad = backupData.find(g => !g || typeof g.id !== 'string' || typeof g.title !== 'string');
    if (bad) {
      return res.status(400).json({ error: '备份格式错误：存在缺少 id/title 的记录' });
    }

    fs.copyFileSync(backupPath, GAMES_JSON);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 构建 & 部署（同步等待真实结果，不再静默失败）
app.post('/api/deploy', async (req, res) => {
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    return res.status(400).json({ success: false, error: '当前目录不是 git 仓库，请先执行 git init 并配置远程仓库' });
  }
  try {
    // 无改动时 commit 会失败，用 git diff --cached --quiet 判断是否需要提交
    const cmd = 'npm run build && git add -A && (git diff --cached --quiet || git commit -m "update via admin panel") && git push origin main';
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: ROOT,
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024
    });
    res.json({ success: true, message: '部署成功', output: (stdout + stderr).slice(-300) });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message.split('\n')[0],
      output: ((e.stderr || '') + (e.stdout || '')).slice(-300)
    });
  }
});

// ==========================================
// 启动（仅绑定回环地址，不暴露到局域网）
// ==========================================
app.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🎮 Game List Admin Panel               ║');
  console.log(`║   http://localhost:${PORT}                  ║`);
  console.log('║   （仅限本机访问，令牌已自动生成）         ║');
  console.log('║   Ctrl+C 退出                             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // 自动打开浏览器
  const { platform } = process;
  const cmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${cmd} http://localhost:${PORT}`);
});
