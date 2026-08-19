/**
 * 共享工具模块：admin/server.js 与 scripts/ 下的活脚本统一引用
 * 目的：ID 生成、字段解析等逻辑只维护一份（单一数据源原则）
 */

/**
 * 统一的游戏 ID 生成策略
 * - 只保留字母、数字、中文
 * - 统一转小写（避免同一游戏因大小写产生重复记录）
 * - 空结果时兜底为 game-<时间戳>
 * @param {string} title 游戏标题
 * @returns {string} 游戏 ID
 */
function generateId(title) {
  const base = String(title || '')
    .replace(/[^a-zA-Z0-9一-龥]/g, '')
    .toLowerCase();
  return base || `game-${Date.now()}`;
}

/**
 * 解析 Excel 单元格中的布尔值（兼容 TRUE/'true'/1 等多种形态）
 * @param {*} raw Excel 单元格原始值
 * @param {boolean} defaultValue 未定义时的默认值
 * @returns {boolean}
 */
function parseBool(raw, defaultValue = false) {
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  return raw === true || raw === 'TRUE' || raw === 'true' || raw === 1;
}

/**
 * 解析 Excel 单元格为 trimmed 字符串，空值返回 null
 * @param {*} raw Excel 单元格原始值
 * @returns {string|null}
 */
function parseNullableString(raw) {
  if (raw === undefined || raw === null) return null;
  const s = raw.toString().trim();
  return s ? s : null;
}

/**
 * 游戏记录 schema 定义（唯一一份）
 * 字段顺序即标准顺序；types 用于校验
 */
const GAME_SCHEMA = {
  id: 'string',
  title: 'string',
  appId: 'string|null',
  cover: 'string',
  playtime: 'string',
  showPlaytime: 'boolean',
  playStatus: 'string',
  tags: 'array',
  isAnchor: 'boolean',
  orderWeight: 'number',
  reviewFile: 'string|null',
  pros: 'string|null',
  cons: 'string|null',
  remark: 'string|null',
};

const VALID_PLAY_STATUS = ['cleared', 'completed', 'playing', 'on-hold', 'dropped'];

/**
 * 校验一条游戏记录是否合法
 * @param {*} game 待校验对象
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateGame(game) {
  const errors = [];
  if (!game || typeof game !== 'object' || Array.isArray(game)) {
    return { valid: false, errors: ['记录不是对象'] };
  }
  if (typeof game.id !== 'string' || !game.id) errors.push('id 必须是非空字符串');
  if (typeof game.title !== 'string' || !game.title.trim()) errors.push('title 必须是非空字符串');
  if (game.appId !== null && typeof game.appId !== 'string') errors.push('appId 必须是字符串或 null');
  if (typeof game.cover !== 'string') errors.push('cover 必须是字符串');
  if (typeof game.playtime !== 'string') errors.push('playtime 必须是字符串');
  if (typeof game.showPlaytime !== 'boolean') errors.push('showPlaytime 必须是布尔值');
  if (typeof game.playStatus !== 'string' || !VALID_PLAY_STATUS.includes(game.playStatus)) {
    errors.push(`playStatus 必须是 ${VALID_PLAY_STATUS.join('/')} 之一`);
  }
  if (!Array.isArray(game.tags) || game.tags.some(t => typeof t !== 'string')) {
    errors.push('tags 必须是字符串数组');
  }
  if (typeof game.isAnchor !== 'boolean') errors.push('isAnchor 必须是布尔值');
  if (typeof game.orderWeight !== 'number' || Number.isNaN(game.orderWeight)) {
    errors.push('orderWeight 必须是数字');
  }
  for (const field of ['reviewFile', 'pros', 'cons', 'remark']) {
    if (game[field] !== null && typeof game[field] !== 'string') {
      errors.push(`${field} 必须是字符串或 null`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  generateId,
  parseBool,
  parseNullableString,
  GAME_SCHEMA,
  VALID_PLAY_STATUS,
  validateGame,
};
