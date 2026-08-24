/**
 * 移动端游戏封面抓取模块（小黑盒 → TapTap → 好游快爆 → Bing 兜底）
 *
 * 背景：手游在 Steam 上查不到。此前脚本把小黑盒 ID 当 Steam AppID 去请求
 * Steam CDN，必然 404，最后全落到 Bing 搜图（质量差）。
 * 现在按数据源分级抓取，封面文件按来源加前缀：heybox_/taptap_/haoyou_/bing_
 *
 * admin/server.js 与 scripts/update-and-fetch.js 共用本模块。
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { coverNameFor } = require('./utils');

const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

// 小黑盒 ID 特征：手游 ID 为 999xxxxx / 900xxxxxx 等大号段，
// 但判定依据以 Steam 商店页实测为准（见 checkSteamAppId），此正则仅作快速提示
const HEYBOX_ID_PATTERN = /^(999\d{5}|900\d{6})$/;

/**
 * 小黑盒搜索（JSON 接口）
 * @returns {Promise<{id:string, name:string, image:string, platforms:string[]}|null>}
 */
async function searchHeybox(title) {
  try {
    const searchUrl = `https://api.xiaoheihe.cn/game/search/?q=${encodeURIComponent(title)}&os_type=web`;
    const r = await axios.get(searchUrl, { timeout: 8000, headers: { 'User-Agent': UA_PC } });
    const games = r.data && r.data.result && r.data.result.games;
    if (!games || games.length === 0) return null;
    const first = games[0];
    return {
      id: first.steam_appid ? first.steam_appid.toString() : null,
      name: first.name || '',
      image: first.image || null,
      platforms: first.platforms || [],
    };
  } catch (e) {
    return null;
  }
}

/**
 * 校验 appId 是否为真实 Steam AppID
 * 用官方 appdetails API（success: true/false），比抓商店页稳定得多，
 * 失败自动重试（Steam 接口偶发限流）
 * 用于区分「Steam ID」与「小黑盒手游 ID」
 */
async function checkSteamAppId(appId) {
  if (!appId) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`, {
        timeout: 10000,
        headers: { 'User-Agent': UA_PC },
      });
      const entry = r.data && r.data[appId];
      if (entry && typeof entry.success === 'boolean') return entry.success;
    } catch (e) { /* 重试 */ }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  return false;
}

/**
 * 从指定 URL 下载封面（写入 COVERS_DIR）
 * @returns {Promise<string|null>} 成功返回 /covers/xxx.jpg
 */
// 文件名统一走 coverNameFor（短 ASCII，规避 Pages 长编码路径 404）
async function downloadCover(url, gameId, coversDir, referer) {
  const fileName = coverNameFor(gameId);
  const filePath = path.join(coversDir, fileName);
  try {
    const r = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 10000,
      headers: { 'User-Agent': UA_MOBILE, ...(referer ? { Referer: referer } : {}) },
    });
    const ctype = r.headers['content-type'] || '';
    if (!ctype.includes('image')) return null;
    return await new Promise((resolve, reject) => {
      const w = fs.createWriteStream(filePath);
      r.data.pipe(w);
      w.on('finish', () => resolve(`/covers/${fileName}`));
      w.on('error', reject);
    });
  } catch (e) {
    return null;
  }
}

/**
 * 来源 1：小黑盒（首选，官方图）
 * 按标题搜索；ID 不一致时用名称重合度兜底判断（数据中的黑盒 ID 可能过期，
 * 或双平台游戏在小黑盒上返回 Steam 条目），完全不相关才放弃
 */
async function fetchHeyboxCover(game, coversDir) {
  const hit = await searchHeybox(game.title);
  if (!hit || !hit.image) return null;
  if (game.appId && hit.id !== game.appId) {
    const norm = s => String(s || '').replace(/[^一-龥a-z0-9]/gi, '').toLowerCase();
    const a = norm(hit.name), b = norm(game.title);
    const related = a && b && (a.includes(b) || b.includes(a) || a.includes(b.split(/[：:]/)[0]));
    if (!related) return null; // 搜索结果与目标游戏无关，宁可不抓
  }
  return downloadCover(hit.image, game.id, coversDir);
}

/**
 * 来源 2（首选）：Apple iTunes Search API
 * 官方 JSON 接口无反爬，返回 512x512 官方封面（方形，3:4 卡位裁切友好）。
 * 顶部命中需与标题名称重合，防止抓错游戏。
 * 注：TapTap 网页爬虫因官网 DOM 改版失效，已下线（2026-08）。
 */
async function fetchItunesCover(game, coversDir) {
  try {
    const r = await axios.get('https://itunes.apple.com/search', {
      params: { term: game.title, country: 'cn', entity: 'software', limit: 3 },
      timeout: 10000,
    });
    const results = (r.data && r.data.results) || [];
    const norm = s => String(s || '').replace(/[^一-龥a-z0-9]/gi, '').toLowerCase();
    const target = norm(game.title);
    const hit = results.find(x => {
      const n = norm(x.trackName);
      return n && target && (n.includes(target) || target.includes(n) || n.includes(target.split(/[：:]/)[0]));
    });
    if (!hit || !hit.artworkUrl512) return null;
    return downloadCover(hit.artworkUrl512, game.id, coversDir);
  } catch (e) {
    return null;
  }
}

/**
 * 来源 3：好游快爆（移动端站点 m.3839.com）
 * 按名称匹配搜索结果，取官方图标
 */
async function fetchHaoyouCover(game, coversDir) {
  try {
    const searchUrl = `https://m.3839.com/search/?ac=search_result&q=${encodeURIComponent(game.title)}`;
    const r = await axios.get(searchUrl, { headers: { 'User-Agent': UA_MOBILE }, timeout: 8000 });
    const $ = cheerio.load(r.data);
    const title = game.title.toLowerCase();
    let imgUrl = null;
    $('a.gameli').each(function () {
      if (imgUrl) return;
      const name = ($(this).find('.sp-name').text() || $(this).find('.name').text() || '').trim();
      // 名称互相包含即视为同一游戏（快爆标题常带版本后缀，如"鸣潮-3.6版本预约"）
      const nameNorm = name.toLowerCase();
      if (nameNorm.includes(title) || title.includes(nameNorm.split('-')[0])) {
        const src = $(this).find('img.img').attr('src') || '';
        if (src) imgUrl = src.startsWith('//') ? 'https:' + src : src;
      }
    });
    if (!imgUrl) return null;
    return downloadCover(imgUrl, game.id, coversDir, 'https://m.3839.com/');
  } catch (e) {
    return null;
  }
}

/**
 * 来源 4：Bing 图片搜索（终极兜底）
 */
async function fetchBingCover(game, coversDir) {
  try {
    const query = encodeURIComponent(`${game.title} 游戏海报 竖版`);
    const searchUrl = `https://cn.bing.com/images/search?q=${query}&form=HDRSC2&first=1`;
    const r = await axios.get(searchUrl, { headers: { 'User-Agent': UA_PC }, timeout: 8000 });
    const $ = cheerio.load(r.data);
    let imageUrl = null;
    $('a.iusc').each((i, el) => {
      if (imageUrl) return;
      const mData = $(el).attr('m');
      if (mData) {
        try {
          const mJson = JSON.parse(mData);
          if (mJson.murl && (mJson.murl.endsWith('.jpg') || mJson.murl.endsWith('.png'))) {
            imageUrl = mJson.murl;
          }
        } catch (e) {}
      }
    });
    if (!imageUrl) return null;
    return downloadCover(imageUrl, game.id, coversDir);
  } catch (e) {
    return null;
  }
}

/**
 * 手游封面级联抓取：iTunes 官方图 → 小黑盒 → 好游快爆 → Bing
 * （2026-08 调整：历史 Bing 搜图产生大量错图；iTunes 官方接口最可靠）
 * @param {object} game 游戏记录（需含 id/title/appId/idSource）
 * @param {string} coversDir 封面目录绝对路径
 * @param {function} [log] 日志函数
 * @returns {Promise<{coverPath:string, source:string}|null>}
 */
async function fetchMobileCover(game, coversDir, log = () => {}) {
  const sources = [
    ['itunes', fetchItunesCover],
    ['heybox', fetchHeyboxCover],
    ['haoyou', fetchHaoyouCover],
    ['bing', fetchBingCover],
  ];
  for (const [name, fn] of sources) {
    log(`   📱 [${name}] 尝试抓取: ${game.title}`);
    const coverPath = await fn(game, coversDir);
    if (coverPath) {
      log(`   ✅ [${name}] 成功`);
      return { coverPath, source: name };
    }
  }
  return null;
}

module.exports = {
  HEYBOX_ID_PATTERN,
  searchHeybox,
  checkSteamAppId,
  fetchHeyboxCover,
  fetchItunesCover,
  fetchHaoyouCover,
  fetchBingCover,
  fetchMobileCover,
};
