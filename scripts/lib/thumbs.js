/**
 * 封面缩略图管线
 *
 * 卡位实际显示宽约 150-300px，此前却下载 512-600px 图源，
 * 国内冷缓存下白白多等几秒。现生成 300px 宽缩略图放在
 * public/covers/thumbs/，前端用 srcset 双档自选：
 * 普通屏下小图（~15-30KB），高清屏/放大自动上原图。
 *
 * 生成时机：
 * - scripts/generate-thumbs.js 批量同步存量
 * - admin 上传/抓取封面后自动 ensureThumb（管线自洽）
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const THUMB_WIDTH = 300;
const THUMB_QUALITY = 75;

/** 源文件路径 → 缩略图路径（covers/thumbs/ 子目录，同名） */
function thumbPathFor(filePath) {
  return path.join(path.dirname(filePath), 'thumbs', path.basename(filePath));
}

/** cover URL（/covers/xxx.jpg）→ 缩略图 URL（/covers/thumbs/xxx.jpg） */
function thumbUrlFor(coverUrl) {
  if (!coverUrl || !coverUrl.startsWith('/covers/')) return null;
  return coverUrl.replace('/covers/', '/covers/thumbs/');
}

/**
 * 确保缩略图存在且不比源图旧；失败返回 null（不阻塞主流程）
 * @param {string} filePath 封面源文件绝对路径
 * @returns {Promise<string|null>} 缩略图绝对路径
 */
async function ensureThumb(filePath) {
  const thumbPath = thumbPathFor(filePath);
  try {
    if (!fs.existsSync(filePath)) return null;
    // 已存在且不比源图旧则跳过
    if (fs.existsSync(thumbPath) &&
        fs.statSync(thumbPath).mtimeMs >= fs.statSync(filePath).mtimeMs) {
      return thumbPath;
    }
    fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
    const tmpPath = thumbPath + '.tmp';
    await sharp(filePath)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY, progressive: true })
      .toFile(tmpPath);
    fs.renameSync(tmpPath, thumbPath);
    return thumbPath;
  } catch (e) {
    return null;
  }
}

module.exports = { THUMB_WIDTH, thumbPathFor, thumbUrlFor, ensureThumb };
