/**
 * 应用程序配置常量
 * 基于产品文档的设计理念，优化性能和用户体验
 */

// === 性能配置 ===
export const PERFORMANCE_CONFIG = {
  // 数据缓存时间（毫秒）- 平衡性能和数据新鲜度
  DATA_CACHE_TIME: 5000,

  // 书签悬停防抖时间（毫秒）- 优化交互响应性
  HOVER_DEBOUNCE_TIME: 200,

  // 筛选防抖时间（毫秒）- 减少API调用频率
  SEARCH_DEBOUNCE_TIME: 300,

  // 页面关闭延迟（毫秒）- 确保操作完成
  PAGE_CLOSE_DELAY: 1000,

  // AI组织页面关闭延迟（毫秒）
  AI_PAGE_CLOSE_DELAY: 1500,

  // 复制操作模拟延迟（毫秒）- 提升用户体验
  COPY_SIMULATION_DELAY: 300,

  // 指纹校验延迟（毫秒）- 避免初始化冲突
  FINGERPRINT_CHECK_DELAY: 300
} as const

// === 通知系统配置 ===
/**
 * 通知系统统一配置
 *
 * 包含 Toast 提示和系统通知的所有时间相关配置
 * 统一管理避免魔法数字分散在代码中
 */
export const NOTIFICATION_CONFIG = {
  /**
   * Toast 默认显示时长（毫秒）
   *
   * @default 3000 (3秒)
   */
  DEFAULT_TOAST_TIMEOUT: 3000,

  /**
   * Toast 最大生命周期（毫秒）
   *
   * @default 9999000 (9999秒)
   * @reasoning 即使用户悬停暂停倒计时，也会在此时间后强制关闭，防止通知永久残留
   */
  MAX_TOAST_LIFETIME: 9999000,

  /**
   * 系统通知默认显示时长（毫秒）
   *
   * @default 5000 (5秒)
   * @reasoning 系统通知由操作系统管理，5秒是合理的默认值
   */
  DEFAULT_SYSTEM_NOTIFICATION_TIMEOUT: 5000,

  /**
   * 通知抑制窗口期（毫秒）
   *
   * @default 1200 (1.2秒)
   * @reasoning 防止短时间内重复显示相同内容的通知
   */
  SUPPRESS_WINDOW: 1200,

  /**
   * Toast 位置顶部偏移（像素）
   *
   * @default 157
   * @reasoning 避免遮挡顶部 UI 元素
   */
  TOAST_OFFSET_TOP: 157,

  /**
   * ✨ 徽章颜色配置（根据通知级别）
   *
   * ✅ 使用 Material Design 3 和语义色（从 design-tokens 包导入）
   * 注意：这些颜色用于 Chrome Extension Badge API，无法使用 CSS 变量
   * 通过导入 TypeScript 常量，确保与 design-tokens 包自动同步
   *
   * 提供语义化的徽章颜色，确保视觉一致性
   */
  BADGE_COLORS: (() => {
    // 动态导入 design-tokens 包的颜色（避免循环依赖）
    // 这里使用立即执行函数，在运行时获取颜色值
    const getColors = () => {
      try {
        // prettier-ignore
        /* eslint-disable @typescript-eslint/no-var-requires */
        const {
          materialColors,
          semanticColors,
        } = require("@acuity-bookmarks/design-tokens/colors");
        /* eslint-enable @typescript-eslint/no-var-requires */
        return {
          /** 信息徽章：使用 MD3 Primary 色 */
          info: materialColors.primary.rgb,
          /** 成功徽章：使用语义 Success 色 */
          success: semanticColors.success.rgb,
          /** 警告徽章：使用语义 Warning 色 */
          warning: semanticColors.warning.rgb,
          /** 错误徽章：使用 MD3 Error 色 */
          error: materialColors.error.rgb
        }
      } catch {
        // 降级方案：如果导入失败，使用硬编码值
        return {
          info: 'rgb(68, 94, 145)',
          success: 'rgb(87, 94, 113)',
          warning: 'rgb(113, 85, 115)',
          error: 'rgb(186, 26, 26)'
        }
      }
    }
    return getColors()
  })() as {
    info: string
    success: string
    warning: string
    error: string
  },

  /**
   * ✨ 徽章自动清除延迟（毫秒）
   *
   * @default 0 (立即清除)
   * @reasoning 徽章通常用于持久状态，默认不自动清除
   */
  BADGE_AUTO_CLEAR_DELAY: 0
} as const

// === 书签管理配置 ===
export const BOOKMARK_CONFIG = {
  // 筛选结果限制 - 基于用户体验优化
  SEARCH_LIMIT: 20,

  // 大数据集阈值 - 超过此数量启用性能优化
  LARGE_DATASET_THRESHOLD: 1000,

  // 批量处理大小 - 避免阻塞UI
  BATCH_PROCESS_SIZE: 100,

  // IntersectionObserver根边距 - 优化懒加载
  OBSERVER_ROOT_MARGIN: '100px',

  // IntersectionObserver阈值
  OBSERVER_THRESHOLD: 0.01,

  // 筛选历史最大长度
  MAX_SEARCH_HISTORY: 10
} as const

// === UI交互配置 ===
export const UI_CONFIG = {
  // 等待元素出现超时时间（毫秒）
  ELEMENT_WAIT_TIMEOUT: 1500,

  // 滚动行为配置
  SCROLL_BEHAVIOR: {
    behavior: 'smooth' as const,
    block: 'nearest' as const,
    inline: 'center' as const
  }
} as const

// === Chrome API配置 ===
export const CHROME_CONFIG = {
  // 书签栏ID
  BOOKMARKS_BAR_ID: '1',

  // 其他书签ID
  OTHER_BOOKMARKS_ID: '2',

  // API调用重试次数
  API_RETRY_COUNT: 3,

  // API调用超时时间（毫秒）
  API_TIMEOUT: 10000,

  // 并发API调用限制
  MAX_CONCURRENT_CALLS: 5
} as const

// === 错误处理配置 ===
export const ERROR_CONFIG = {
  // 默认错误消息
  DEFAULT_ERROR_MESSAGE: '操作失败，请重试',

  // Chrome API错误消息映射
  CHROME_ERROR_MESSAGES: {
    'Extension context invalidated': '扩展上下文已失效，请刷新页面',
    'Cannot access contents of the page': '无法访问页面内容，请检查权限',
    'The operation was interrupted': '操作被中断，请重试'
  },

  // 错误重试间隔（毫秒）
  RETRY_DELAY: 1000,

  // 最大重试次数
  MAX_RETRY_ATTEMPTS: 3
} as const

// === 调试配置 ===
export const DEBUG_CONFIG = {
  // 开发环境标识
  IS_DEVELOPMENT: import.meta.env.DEV,

  // 性能监控启用状态
  PERFORMANCE_MONITORING: true,

  // 详细日志启用状态
  VERBOSE_LOGGING: false
} as const

// === API 基础配置（新增：支持线上/本地环境切换） ===
function getApiBase(): string {
  // 优先使用显式配置，其次使用开发环境默认值
  console.log('🔧 import.meta.env:', import.meta.env)
  let apiBase =
    // 优先显式变量（两者都支持）
    (import.meta.env.VITE_CLOUDFLARE_MODE === 'true'
      ? import.meta.env.VITE_CLOUDFLARE_WORKER_URL || import.meta.env.VITE_API_BASE_URL
      : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_CLOUDFLARE_WORKER_URL) ||
    // 开发默认走 Cloudflare 本地（wrangler dev 默认 8787）
    // 强制使用 HTTPS 模式：避免 Chrome Extension CSP 限制
    // 已完全禁用 HTTP，默认使用 HTTPS
    (import.meta.env.DEV ? 'https://localhost:8787' : 'https://api.acuitybookmarks.com')

  // 🚨 运行时检查：如果检测到 HTTP，自动转换为 HTTPS（防止缓存问题）
  // 热构建模式下，watch-build.js 已经确保是 HTTPS，但可能因为缓存导致旧值
  if (apiBase.startsWith('http://')) {
    // 仅在开发环境显示警告（生产环境不应该有 HTTP）
    if (import.meta.env.DEV) {
      console.debug(
        `🔧 检测到 HTTP URL，自动转换为 HTTPS: ${apiBase} → ${apiBase.replace('http://', 'https://')}`
      )
    }
    apiBase = apiBase.replace('http://', 'https://')
  }

  console.log('🔧 apiBase:', apiBase)

  // ⚠️ 仅在使用远程模式（bun run dev --remote）但配置指向本地时给出警告
  // 如果明确使用本地模式（bun run dev:local）或设置了 VITE_HOT_BUILD，则不警告
  if (
    import.meta.env.DEV &&
    apiBase.includes('localhost:8787') &&
    !apiBase.includes('127.0.0.1') &&
    !import.meta.env.VITE_HOT_BUILD && // 热构建模式（build:hot）不警告
    !import.meta.env.VITE_USE_REMOTE && // 明确不使用远程模式时不警告
    import.meta.env.VITE_API_BASE_URL?.includes('localhost') // 只有明确设置了本地 URL 时才警告
  ) {
    // 这个警告仅用于提醒：如果后端运行在远程模式（--remote），应该使用远程 Worker URL
    // 但如果用户明确使用本地模式（dev:local），这个警告是误报，应该忽略
    console.debug(
      '💡 提示：当前使用本地 URL，如果后端运行在远程模式（bun run dev --remote），建议使用远程 Worker URL'
    )
    console.debug('   远程 Worker URL: https://acuitybookmarks.cqw547847.workers.dev')
  }

  return apiBase
}

export const API_CONFIG = {
  // 使用函数动态获取，确保运行时强制 HTTPS
  get API_BASE() {
    return getApiBase()
  }
} as const

// 开发环境调试：输出 API 配置
if (import.meta.env.DEV) {
  console.log('🔧 API_CONFIG.API_BASE:', API_CONFIG.API_BASE)
  console.log('🔧 VITE_USE_LOCAL_HTTPS:', import.meta.env.VITE_USE_LOCAL_HTTPS)
  console.log('🔧 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
  console.log('🔧 VITE_CLOUDFLARE_WORKER_URL:', import.meta.env.VITE_CLOUDFLARE_WORKER_URL)
}

// === 爬虫配置（新增：本地-only、限速与调度） ===
export const CRAWLER_CONFIG = {
  // 模式：'local' | 'hybrid' | 'serverless'
  MODE: (import.meta.env.VITE_CRAWLER_MODE as 'local' | 'hybrid' | 'serverless') || 'local',

  // 并发与批量控制（避免影响用户网络体验）
  CONCURRENCY: Number(import.meta.env.VITE_CRAWLER_CONCURRENCY || 2),
  PER_DOMAIN_CONCURRENCY: Number(import.meta.env.VITE_CRAWLER_PER_DOMAIN_CONCURRENCY || 1),
  BATCH_SIZE: Number(import.meta.env.VITE_CRAWLER_BATCH_SIZE || 5),
  BATCH_INTERVAL_MS: Number(import.meta.env.VITE_CRAWLER_BATCH_INTERVAL_MS || 1500),

  // 频率控制
  DAILY_LIMIT: Number(import.meta.env.VITE_CRAWLER_DAILY_LIMIT || 200),
  FAILED_RETRY_INTERVAL_MS: 24 * 60 * 60 * 1000,

  // 调度策略
  USE_IDLE_SCHEDULING: import.meta.env.VITE_CRAWLER_USE_IDLE_SCHEDULING === 'false' ? false : true,
  IDLE_DELAY_MS: Number(import.meta.env.VITE_CRAWLER_IDLE_DELAY_MS || 3000),

  // 请求头
  REQUEST_HEADERS: {
    userAgent: 'AcuityBookmarks-Extension/1.0',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
} as const

// === AI配置（新增：支持提供者选择与自动检测） ===
export const AI_CONFIG = {
  // 默认温度与最大tokens
  DEFAULT_TEMPERATURE: 0.6,
  DEFAULT_MAX_TOKENS: 256,
  DEFAULT_TOP_K: 40,
  // 初始提示（系统指令等），用于会话初始化
  INITIAL_PROMPTS: (() => {
    const raw = import.meta.env.VITE_AI_INITIAL_PROMPTS as string | undefined
    if (raw?.trim()) {
      // 约定以 \n\n 分隔多段初始提示
      return raw
        .split('\n\n')
        .map(s => s.trim())
        .filter(Boolean)
    }
    return [
      'You are AcuityBookmarks assistant. Help organize and search bookmarks efficiently.',
      'Prefer concise, actionable answers. Chinese UI; respond in Chinese by default.'
    ]
  })(),
  TAG_GENERATION_PROMPT: `You are a bookmark tagging assistant. Based on the bookmark's title and content, generate 2-3 relevant tags.
- Tags should be concise and high-level (e.g., "React", "JavaScript", "Web Development").
- Output only a JSON array of strings, with no extra explanations.
- Example input: "useCallback - React", content: "useCallback is a React Hook..."
- Example output: ["React", "Hook", "Performance"]`
} as const

// === 动画与过渡配置 ===
/**
 * 动画与过渡效果统一配置
 *
 * 包含所有动画时长、缓动函数等配置
 * 便于全局调整动画风格和性能
 */
export const ANIMATION_CONFIG = {
  /**
   * 动画时长（毫秒）
   */
  DURATION: {
    /** 极快动画 - 用于即时反馈 */
    INSTANT: 100,
    /** 快速动画 - 用于小元素和轻量交互 */
    FAST: 200,
    /** 正常动画 - 标准过渡效果 */
    NORMAL: 300,
    /** 慢速动画 - 用于重要元素和复杂过渡 */
    SLOW: 500,
    /** 极慢动画 - 用于页面级过渡 */
    VERY_SLOW: 1000,

    // 特定组件动画
    /** Toast 入场动画 */
    TOAST_ENTER: 240,
    /** Toast 离场动画 */
    TOAST_LEAVE: 200,
    /** Ripple 水波纹效果 */
    RIPPLE: 600,
    /** 旋转加载动画 */
    SPINNER: 1000,
    /** 进度条 Shimmer 效果 */
    SHIMMER: 2000,
    /** 环形进度条旋转 */
    CIRCLE_ROTATE: 1400
  },

  /**
   * 缓动函数（Easing Functions）
   */
  EASING: {
    /** 标准缓动 - 推荐用于大多数场景 */
    STANDARD: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** 强调缓动 - 入场动画 */
    EMPHASIZED: 'cubic-bezier(0.23, 1, 0.32, 1)',
    /** 减速缓动 - 离场动画 */
    DECELERATE: 'cubic-bezier(0, 0, 0.2, 1)',
    /** 加速缓动 - 元素移出 */
    ACCELERATE: 'cubic-bezier(0.4, 0, 1, 1)',
    /** 阴影过渡专用 */
    SHADOW: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    /** 线性缓动 */
    LINEAR: 'linear',
    /** 淡入淡出 */
    EASE_IN_OUT: 'ease-in-out'
  }
} as const

// === 尺寸与间距配置 ===
/**
 * UI 组件尺寸与间距统一配置
 *
 * 定义所有组件的标准尺寸、图标大小、间距等
 * 确保整个应用的视觉一致性
 */
export const SIZE_CONFIG = {
  /**
   * 图标尺寸（像素）
   */
  ICON: {
    /** 极小图标 - 12px */
    XS: 12,
    /** 小图标 - 16px */
    SM: 16,
    /** 中图标 - 20px */
    MD: 20,
    /** 标准图标 - 22px */
    NORMAL: 22,
    /** 大图标 - 24px */
    LG: 24,
    /** 极大图标 - 32px */
    XL: 32
  },

  /**
   * 间距尺寸（像素）
   */
  SPACING: {
    /** 无间距 */
    NONE: 0,
    /** 极小间距 - 4px */
    XS: 4,
    /** 小间距 - 8px */
    SM: 8,
    /** 中间距 - 12px */
    MD: 12,
    /** 标准间距 - 16px */
    NORMAL: 16,
    /** 大间距 - 20px */
    LG: 20,
    /** 极大间距 - 24px */
    XL: 24,
    /** 超大间距 - 32px */
    XXL: 32
  },

  /**
   * 边框圆角（像素）
   */
  RADIUS: {
    /** 无圆角 */
    NONE: 0,
    /** 小圆角 - 4px */
    SM: 4,
    /** 标准圆角 - 8px */
    NORMAL: 8,
    /** 大圆角 - 12px */
    LG: 12,
    /** 完全圆角 */
    FULL: 9999
  },

  /**
   * Toast 组件尺寸
   */
  TOAST: {
    /** 最小宽度 */
    MIN_WIDTH: 320,
    /** 最大宽度 */
    MAX_WIDTH: 480,
    /** 关闭按钮尺寸 */
    CLOSE_BUTTON: 28,
    /** 间距 */
    GAP: 12,
    /** 外边距 */
    MARGIN: 16
  },

  /**
   * 进度条尺寸
   */
  PROGRESS: {
    /** 线性进度条高度 */
    LINEAR_HEIGHT: 8,
    /** 环形进度条尺寸 */
    CIRCULAR: {
      SM: 32,
      MD: 40,
      LG: 48,
      XL: 60
    },
    /** 环形进度条线宽 */
    STROKE_WIDTH: {
      SM: 2.5,
      MD: 3,
      LG: 3.5,
      XL: 4
    }
  }
} as const

// === 超时与延迟配置 ===
/**
 * 超时与延迟统一配置
 *
 * 包含所有异步操作、API 调用、重试机制的时间配置
 * 统一管理避免分散在代码各处
 */
export const TIMEOUT_CONFIG = {
  /**
   * API 请求超时（毫秒）
   */
  API: {
    /** 标准请求超时 */
    STANDARD: 10000,
    /** 快速请求超时 */
    FAST: 5000,
    /** 慢速请求超时（大数据量） */
    SLOW: 30000,
    /** 同步操作超时 */
    SYNC: 30000
  },

  /**
   * 爬虫相关超时（毫秒）
   */
  CRAWLER: {
    /** 单次请求超时 */
    REQUEST: 10000,
    /** HTML 解析超时 */
    PARSE: 3000,
    /** 元数据提取超时 */
    METADATA: 5000,
    /** 空闲等待超时 */
    IDLE_WAIT: 5000
  },

  /**
   * 延迟执行（毫秒）
   */
  DELAY: {
    /** 立即执行（下一个事件循环） */
    IMMEDIATE: 0,
    /** 极短延迟 - 50ms */
    TINY: 50,
    /** 短延迟 - 100ms */
    SHORT: 100,
    /** 中等延迟 - 200ms */
    MEDIUM: 200,
    /** 标准延迟 - 500ms */
    STANDARD: 500,
    /** 长延迟 - 1000ms */
    LONG: 1000,
    /** 极长延迟 - 1500ms */
    VERY_LONG: 1500,

    // 特定场景延迟
    /** 书签操作延迟 - 确保 Chrome API 完成 */
    BOOKMARK_OP: 350,
    /** 初始化延迟 */
    BOOTSTRAP: 500,
    /** 爬虫批次间隔 */
    CRAWLER_BATCH: 1500,
    /** 爬虫任务等待 */
    CRAWLER_TASK_WAIT: 1000,
    /** 爬虫任务重试 */
    CRAWLER_TASK_RETRY: 500
  },

  /**
   * 重试机制（毫秒）
   */
  RETRY: {
    /** 重试间隔 */
    INTERVAL: 1000,
    /** 最大重试次数 */
    MAX_ATTEMPTS: 3,
    /** 失败后重试间隔（24小时） */
    FAILED_INTERVAL: 24 * 60 * 60 * 1000
  },

  /**
   * 缓存时长（毫秒）
   */
  CACHE: {
    /** 短期缓存 - 5秒 */
    SHORT: 5000,
    /** 中期缓存 - 15分钟 */
    MEDIUM: 15 * 60 * 1000,
    /** 长期缓存 - 1小时 */
    LONG: 60 * 60 * 1000,
    /** 极长缓存 - 24小时 */
    VERY_LONG: 24 * 60 * 60 * 1000
  },

  /**
   * 性能监控间隔（毫秒）
   */
  MONITORING: {
    /** 内存使用更新间隔 */
    MEMORY_UPDATE: 5000
  }
} as const

// === Worker 与并发配置 ===
/**
 * Worker 与并发控制统一配置
 *
 * 包含所有 Worker 相关的并发、批次、队列配置
 * 统一管理以优化性能和资源使用
 */
export const WORKER_CONFIG = {
  /**
   * 批次处理配置
   */
  BATCH: {
    /** 标准批次大小 */
    STANDARD: 100,
    /** 小批次大小 */
    SMALL: 5,
    /** 大批次大小 */
    LARGE: 2000,
    /** 爬虫批次大小 */
    CRAWLER: 5
  },

  /**
   * 并发控制
   */
  CONCURRENCY: {
    /** 标准并发数 */
    STANDARD: 5,
    /** 爬虫全局并发 */
    CRAWLER_GLOBAL: 2,
    /** 爬虫单域名并发 */
    CRAWLER_PER_DOMAIN: 1
  },

  /**
   * Worker 通信超时（毫秒）
   */
  COMMUNICATION: {
    /** 标准超时 */
    STANDARD: 10000,
    /** 快速超时 */
    FAST: 5000
  }
} as const

// === 限制与阈值配置 ===
/**
 * 各类限制与阈值统一配置
 *
 * 包含数据量限制、频率限制、性能阈值等
 */
export const LIMIT_CONFIG = {
  /**
   * 数据量限制
   */
  DATA: {
    /** 搜索结果限制 */
    SEARCH_RESULTS: 20,
    /** 搜索历史最大长度 */
    SEARCH_HISTORY: 10,
    /** 大数据集阈值 */
    LARGE_DATASET: 1000
  },

  /**
   * 爬虫限制
   */
  CRAWLER: {
    /** 每日爬取限制 */
    DAILY_LIMIT: 200
  }
} as const

// === 导出类型 ===
export type PerformanceConfig = typeof PERFORMANCE_CONFIG
export type NotificationConfig = typeof NOTIFICATION_CONFIG
export type BookmarkConfig = typeof BOOKMARK_CONFIG
export type UIConfig = typeof UI_CONFIG
export type ChromeConfig = typeof CHROME_CONFIG
export type ErrorConfig = typeof ERROR_CONFIG
export type DebugConfig = typeof DEBUG_CONFIG
export type ApiConfig = typeof API_CONFIG
export type CrawlerConfig = typeof CRAWLER_CONFIG
export type AiConfig = typeof AI_CONFIG
export type AnimationConfig = typeof ANIMATION_CONFIG
export type SizeConfig = typeof SIZE_CONFIG
export type TimeoutConfig = typeof TIMEOUT_CONFIG
export type WorkerConfig = typeof WORKER_CONFIG
export type LimitConfig = typeof LIMIT_CONFIG
