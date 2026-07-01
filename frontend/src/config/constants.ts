/**
 * 应用程序配置常量
 */

import { frontendEnv } from './env'

export const NOTIFICATION_CONFIG = {
  DEFAULT_TOAST_TIMEOUT: 3000,
  MAX_TOAST_LIFETIME: 9999000,
  DEFAULT_SYSTEM_NOTIFICATION_TIMEOUT: 5000,
  SUPPRESS_WINDOW: 1200,
  TOAST_OFFSET_TOP: 157,
  BADGE_COLORS: {
    info: 'rgb(68, 94, 145)',
    success: 'rgb(87, 94, 113)',
    warning: 'rgb(113, 85, 115)',
    error: 'rgb(186, 26, 26)'
  } as {
    info: string
    success: string
    warning: string
    error: string
  },
  BADGE_AUTO_CLEAR_DELAY: 0
} as const

function resolveApiBase(): string {
  return (
    frontendEnv.apiBaseUrl ||
    (import.meta.env.DEV ? 'http://localhost:8787' : 'https://api.yiveno.com')
  )
}

function shouldWarnLocalApiBase(apiBase: string): boolean {
  return (
    import.meta.env.DEV &&
    apiBase.includes('localhost:8787') &&
    !apiBase.includes('127.0.0.1') &&
    !frontendEnv.hotBuild &&
    !frontendEnv.useRemote &&
    Boolean(frontendEnv.apiBaseUrl?.includes('localhost'))
  )
}

function getApiBase(): string {
  const apiBase = resolveApiBase()

  if (shouldWarnLocalApiBase(apiBase)) {
    console.debug(
      '💡 提示：当前使用本地 Worker (localhost:8787)。托管 AI 需在 backend/.dev.vars 配置 DEEPSEEK_API_KEY（bun run env:sync:dev）'
    )
    console.debug(
      '   或使用已部署 API：在 .env.development.local 设置 VITE_API_BASE_URL=https://api.yiveno.com'
    )
  }

  return apiBase
}

export const API_CONFIG = {
  get API_BASE() {
    return getApiBase()
  }
} as const

if (import.meta.env.DEV) {
  console.debug('🔧 API_CONFIG.API_BASE:', API_CONFIG.API_BASE)
}

export const ANIMATION_CONFIG = {
  DURATION: {
    INSTANT: 100,
    FAST: 200,
    NORMAL: 300,
    SLOW: 500,
    VERY_SLOW: 1000,
    TOAST_ENTER: 240,
    TOAST_LEAVE: 200,
    RIPPLE: 600,
    SPINNER: 1000,
    SHIMMER: 2000,
    CIRCLE_ROTATE: 1400
  },
  EASING: {
    STANDARD: 'cubic-bezier(0.4, 0, 0.2, 1)',
    EMPHASIZED: 'cubic-bezier(0.23, 1, 0.32, 1)',
    DECELERATE: 'cubic-bezier(0, 0, 0.2, 1)',
    ACCELERATE: 'cubic-bezier(0.4, 0, 1, 1)',
    SHADOW: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    LINEAR: 'linear',
    EASE_IN_OUT: 'ease-in-out'
  }
} as const

export const TIMEOUT_CONFIG = {
  API: {
    STANDARD: 10000,
    FAST: 5000,
    SLOW: 30000,
    SYNC: 30000
  },
  CRAWLER: {
    REQUEST: 10000,
    PARSE: 3000,
    METADATA: 5000,
    IDLE_WAIT: 5000
  },
  DELAY: {
    IMMEDIATE: 0,
    TINY: 50,
    SHORT: 100,
    MEDIUM: 200,
    STANDARD: 500,
    LONG: 1000,
    VERY_LONG: 1500,
    BOOKMARK_OP: 350,
    BOOTSTRAP: 500,
    CRAWLER_BATCH: 1500,
    CRAWLER_TASK_WAIT: 1000,
    CRAWLER_TASK_RETRY: 500
  },
  RETRY: {
    INTERVAL: 1000,
    MAX_ATTEMPTS: 3,
    FAILED_INTERVAL: 24 * 60 * 60 * 1000
  },
  CACHE: {
    SHORT: 5000,
    MEDIUM: 15 * 60 * 1000,
    LONG: 60 * 60 * 1000,
    VERY_LONG: 24 * 60 * 60 * 1000
  },
  MONITORING: {
    MEMORY_UPDATE: 5000
  }
} as const
