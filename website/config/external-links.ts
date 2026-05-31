/**
 * 外部链接配置
 *
 * 统一管理所有外部服务的 URL
 */

/**
 * Gumroad 相关链接
 */
export const gumroadUrls = {
  /** Gumroad 订阅管理页面 */
  subscriptions: 'https://app.gumroad.com/subscriptions'

  /** Gumroad 产品页面（如果有的话） */
  // product: 'https://gumroad.com/your-product-id',
} as const

/**
 * Chrome Web Store 链接
 */
export const chromeStoreUrls = {
  /** 扩展详情页（完整链接） */
  extension: 'https://chrome.google.com/webstore/detail/ottersage/gdjcmpenmogdikhnnaebmddhmdgbfcgl',

  /** Chrome Web Store 首页 */
  home: 'https://chrome.google.com/webstore',

  /** 扩展 ID */
  extensionId: 'gdjcmpenmogdikhnnaebmddhmdgbfcgl'
} as const

/**
 * 社交媒体链接
 */
export const socialUrls = {
  // twitter: 'https://twitter.com/ottersage',
  // github: 'https://github.com/ottersage',
} as const

/**
 * 所有外部链接
 */
export const externalLinks = {
  gumroad: gumroadUrls,
  chromeStore: chromeStoreUrls,
  social: socialUrls
} as const
