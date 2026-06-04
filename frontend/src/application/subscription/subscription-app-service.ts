/**
 * 订阅应用服务
 *
 * 职责：
 * - 管理用户订阅状态
 * - 处理订阅创建与状态同步
 * - 与 Supabase 和 Gumroad 集成
 *
 * 数据获取策略：
 * - 直接查询 Supabase subscriptions 表（与官网一致）
 * - 不再通过后端 API 中转，减少网络请求
 */

import {
  buildCheckoutUrl,
  getManageSubscriptionUrl,
  type GumroadBillingFrequency
} from '@/infrastructure/gumroad/client'
import {
  getSubscriptionFromSupabase,
  isProUser as checkIsProUser
} from '@/infrastructure/supabase/subscription-repository'
import type { Subscription, UserSubscriptionStatus } from '@/infrastructure/supabase/types'

/**
 * 订阅应用服务类
 */
export class SubscriptionAppService {
  /**
   * 获取用户当前订阅状态
   *
   * ✅ 直接查询 Supabase（与官网一致）
   * ❌ 不再通过后端 API 中转
   *
   * @param userId - Supabase 用户 ID
   * @returns 订阅状态
   */
  async getUserSubscription(userId: string): Promise<UserSubscriptionStatus | null> {
    try {
      // ✅ 直接查询 Supabase subscriptions 表
      const subscription = await getSubscriptionFromSupabase(userId)

      if (!subscription) {
        return {
          tier: 'free',
          status: 'expired',
          current_period_end: new Date().toISOString(),
          cancel_at_period_end: false
        }
      }

      return {
        tier: subscription.tier,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end
      }
    } catch (error) {
      console.error('[SubscriptionAppService] 获取订阅状态异常:', error)
      // 降级：返回免费用户状态
      return {
        tier: 'free',
        status: 'expired',
        current_period_end: new Date().toISOString(),
        cancel_at_period_end: false
      }
    }
  }

  /**
   * 获取用户订阅详情
   *
   * ✅ 直接查询 Supabase（与官网一致）
   *
   * @param userId - Supabase 用户 ID
   * @returns 订阅详情
   */
  async getSubscriptionDetails(userId: string): Promise<Subscription | null> {
    try {
      // ✅ 直接查询 Supabase subscriptions 表
      const subscription = await getSubscriptionFromSupabase(userId)

      if (!subscription) {
        return null
      }

      // Supabase 返回的数据已经是完整的 Subscription 类型
      return subscription
    } catch (error) {
      console.error('[SubscriptionAppService] 获取订阅详情异常:', error)
      return null
    }
  }

  /**
   * 构建支付链接
   *
   * @param billingFrequency - Gumroad 订阅周期
   * @param userId - Supabase 用户 ID
   * @param email - 用户邮箱
   * @returns 支付链接
   */
  async createCheckoutLink(
    billingFrequency: GumroadBillingFrequency,
    userId: string,
    email: string
  ): Promise<string> {
    try {
      const checkoutUrl = buildCheckoutUrl(billingFrequency, userId, email)
      return checkoutUrl
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建支付链接失败'
      console.error('[SubscriptionAppService] 创建支付链接失败:', error)
      throw new Error(errorMessage)
    }
  }

  /**
   * 获取 Gumroad 订阅管理地址
   */
  getManagePortalUrl(): string {
    return getManageSubscriptionUrl()
  }

  /**
   * 检查用户是否为 Pro 用户
   *
   * ✅ 直接查询 Supabase（与官网一致）
   *
   * @param userId - Supabase 用户 ID
   * @returns 是否为 Pro 用户
   */
  async isProUser(userId: string): Promise<boolean> {
    return checkIsProUser(userId)
  }
}

/**
 * 默认订阅应用服务实例
 */
export const subscriptionAppService = new SubscriptionAppService()
