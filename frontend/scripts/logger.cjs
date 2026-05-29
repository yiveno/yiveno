/**
 * 轻量 CLI Logger（前端脚本用）
 * - 支持日志级别：debug、info、warn、error、silent
 * - 作用域标签：便于区分不同脚本输出
 * - 通过环境变量 LOG_LEVEL/NODE_ENV 控制默认级别
 */

const LOG_LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const DEFAULT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

function createLogger(scope = 'Script') {
  let level = DEFAULT_LEVEL;
  const shouldLog = (lvl) => LOG_LEVEL_ORDER[lvl] >= LOG_LEVEL_ORDER[level];

  return {
    setLevel(newLevel) {
      if (newLevel in LOG_LEVEL_ORDER) level = newLevel;
    },
    info(...args) {
      if (!shouldLog('info')) return;
      console.info(`[${scope}]`, ...args);
    },
    warn(...args) {
      if (!shouldLog('warn')) return;
      console.warn(`[${scope}]`, ...args);
    },
    error(...args) {
      if (!shouldLog('error')) return;
      console.error(`[${scope}]`, ...args);
    },
    debug(...args) {
      if (!shouldLog('debug')) return;
      (console.debug || console.log)(`[${scope}]`, ...args);
    },
  };
}

module.exports = { createLogger };