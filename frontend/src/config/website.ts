/**
 * 官网 URL 配置
 *
 * 插件中所有需要跳转到官网的地方都应该使用这个配置
 */

import { frontendEnv } from './env'

// 官网基础 URL
const WEBSITE_BASE_URL = frontendEnv.websiteUrl

/**
 * 官网 URL 配置
 */
export const websiteUrls = {
  /** 官网首页 */
  home: WEBSITE_BASE_URL,

  /** 登录页面 */
  login: `${WEBSITE_BASE_URL}/login`,

  /** 账户中心 */
  account: `${WEBSITE_BASE_URL}/account`,

  /** 订阅/定价页面 */
  pricing: `${WEBSITE_BASE_URL}/pricing`,

  /** 服务条款 */
  terms: `${WEBSITE_BASE_URL}/terms`,

  /** 隐私政策 */
  privacy: `${WEBSITE_BASE_URL}/privacy`
} as const

/**
 * 在新标签页中打开官网 URL
 *
 * @param url - 要打开的 URL
 */
export async function openWebsiteUrl(url: string): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    console.error('[Website] 打开 URL 失败:', error)
    // 降级方案：直接使用 window.open
    window.open(url, '_blank')
  }
}
