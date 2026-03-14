/**
 * RFC3339 / Unix 时间戳解析与格式化（新 API 规范）
 * @module utils/time
 */

/**
 * 将 RFC3339 或 Unix 秒数字符串转为 Unix 秒数
 * @param {string} [input] - 如 "2026-03-14T09:00:00Z" 或 "1715000000"
 * @returns {{ ok: true, unix: number } | { ok: false, error: string }}
 */
function parseToUnixSeconds(input) {
  if (input == null || input === '') {
    return { ok: false, error: 'timestamp must be RFC3339 or unix seconds' };
  }
  const s = String(input).trim();
  const num = Number(s);
  if (Number.isFinite(num) && String(Math.floor(num)) === String(num)) {
    return { ok: true, unix: Math.floor(num) };
  }
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: 'timestamp must be RFC3339 or unix seconds' };
  }
  return { ok: true, unix: Math.floor(date.getTime() / 1000) };
}

/**
 * Unix 秒数转 RFC3339 字符串（UTC）
 * @param {number} unix
 * @returns {string}
 */
function unixToRFC3339(unix) {
  return new Date(Number(unix) * 1000).toISOString();
}

module.exports = {
  parseToUnixSeconds,
  unixToRFC3339
};
