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
  subscriptions: 'https://app.gumroad.com/subscriptions',
  
  /** Gumroad 产品页面（如果有的话） */
  // product: 'https://gumroad.com/your-product-id',
} as const

/**
 * Chrome Web Store 链接
 */
export const chromeStoreUrls = {
  /** 扩展详情页 */
  extension: 'https://chrome.google.com/webstore',
} as const

/**
 * 社交媒体链接
 */
export const socialUrls = {
  // twitter: 'https://twitter.com/acuitybookmarks',
  // github: 'https://github.com/acuitybookmarks',
} as const

/**
 * 所有外部链接
 */
export const externalLinks = {
  gumroad: gumroadUrls,
  chromeStore: chromeStoreUrls,
  social: socialUrls,
} as const
