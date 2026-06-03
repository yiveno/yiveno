/**
 * Supabase 客户端工具（后端使用）
 *
 * 职责：
 * - 创建 Supabase 管理客户端（使用 service_role key）
 * - 提供订阅和支付记录的 CRUD 操作
 * - 处理 Supabase 错误
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../types/env'
import type { Subscription, PaymentRecord } from '@ottersage/types'
import { warn } from '../utils/logger'

// Re-export types for use in other files
export type { Subscription, PaymentRecord }

/**
 * 创建 Supabase 管理客户端
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @returns {SupabaseClient | null} Supabase 客户端实例，如果配置缺失返回 null
 */
export function createSupabaseClient(env: Env): SupabaseClient | null {
  const supabaseUrl = env.SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    warn('[Supabase] 配置缺失，无法创建客户端', {
      hasUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(supabaseServiceKey)
    })
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * 检查 Supabase 是否已配置
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @returns {boolean} 如果配置完整返回 true
 */
export function hasSupabase(env: Env): boolean {
  const hasUrl = Boolean(env.SUPABASE_URL)
  const hasServiceKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY)

  if (!hasUrl || !hasServiceKey) {
    warn('[Supabase] 配置缺失', { hasUrl, hasServiceKey })
  }

  return hasUrl && hasServiceKey
}

/**
 * 获取用户当前订阅状态
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户 ID (Supabase UUID)
 * @returns {Promise<Subscription | null>} 订阅记录或 null
 */
export async function getUserSubscription(env: Env, userId: string): Promise<Subscription | null> {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过查询')
    return null
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle<Subscription>()

    if (error) {
      console.error('[Supabase] 查询订阅失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Supabase] 查询订阅异常:', error)
    return null
  }
}

/**
 * 获取用户订阅详情
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户 ID
 * @returns {Promise<Subscription | null>} 订阅详情或 null
 */
export async function getSubscriptionDetails(
  env: Env,
  userId: string
): Promise<Subscription | null> {
  if (!hasSupabase(env)) return null

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle<Subscription>()

    if (error) {
      console.error('[Supabase] 查询订阅详情失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Supabase] 查询订阅详情异常:', error)
    return null
  }
}

/**
 * 插入或更新订阅记录
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @param {Partial<Subscription>} subscription - 订阅对象
 * @returns {Promise<Subscription>} 更新后的订阅记录
 */
export async function upsertSubscription(
  env: Env,
  subscription: Partial<Subscription>
): Promise<Subscription> {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过插入订阅')
    return subscription as Subscription
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return subscription as Subscription

  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('gumroad_subscription_id', subscription.gumroad_subscription_id!)
      .maybeSingle()

    const subscriptionData = {
      user_id: subscription.user_id,
      gumroad_subscription_id: subscription.gumroad_subscription_id,
      gumroad_order_id: subscription.gumroad_order_id || null,
      gumroad_variant_id: subscription.gumroad_variant_id || null,
      status: subscription.status,
      tier: subscription.tier,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      cancelled_at: subscription.cancelled_at || null
    }

    let result: Subscription | null = null
    if (existing?.id) {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existing.id)
        .select()
        .single<Subscription>()

      if (error) {
        console.error('[Supabase] 更新订阅失败:', error)
        throw error
      }
      result = data
    } else {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single<Subscription>()

      if (error) {
        console.error('[Supabase] 插入订阅失败:', error)
        throw error
      }
      result = data
    }

    if (!result) {
      throw new Error('Upsert operation failed to return a result.')
    }
    return result
  } catch (error) {
    console.error('[Supabase] 插入订阅异常:', error)
    throw error
  }
}

/**
 * 更新订阅取消状态
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @param {string} subscriptionId - Gumroad 订阅 ID
 * @param {boolean} cancelAtPeriodEnd - 是否在周期结束时取消
 * @returns {Promise<Subscription>} 更新后的订阅记录
 */
export async function updateSubscriptionCancelStatus(
  env: Env,
  subscriptionId: string,
  cancelAtPeriodEnd: boolean
): Promise<Subscription> {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过更新订阅')
    return { id: subscriptionId } as Subscription
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return { id: subscriptionId } as Subscription

  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('gumroad_subscription_id', subscriptionId)
      .maybeSingle()

    const targetId = existing?.id || subscriptionId

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetId)
      .select()
      .single<Subscription>()

    if (error) {
      console.error('[Supabase] 更新订阅取消状态失败:', error)
      throw error
    }

    if (!data) {
      throw new Error('Update operation failed to return a result.')
    }
    return data
  } catch (error) {
    console.error('[Supabase] 更新订阅取消状态异常:', error)
    throw error
  }
}

/**
 * 插入支付记录
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @param {PaymentRecord} payment - 支付对象
 * @returns {Promise<PaymentRecord>} 插入的支付记录
 */
export async function insertPaymentRecord(
  env: Env,
  payment: PaymentRecord
): Promise<PaymentRecord> {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过插入支付记录')
    return payment
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return payment

  try {
    const paymentData: Omit<PaymentRecord, 'id'> & { id?: string } = {
      user_id: payment.user_id,
      gumroad_subscription_id: payment.gumroad_subscription_id || null,
      gumroad_order_id: payment.gumroad_order_id,
      gumroad_payment_id: payment.gumroad_payment_id || null,
      amount: payment.amount,
      currency: payment.currency || 'USD',
      status: payment.status,
      payment_method: payment.payment_method || null,
      event_type: payment.event_type,
      metadata: payment.metadata || null
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (payment.id && uuidRegex.test(payment.id)) {
      paymentData.id = payment.id
    }

    const { data, error } = await supabase
      .from('payment_records')
      .insert(paymentData)
      .select()
      .single<PaymentRecord>()

    if (error) {
      console.error('[Supabase] 插入支付记录失败:', error)
      throw error
    }

    if (!data) {
      throw new Error('Insert operation failed to return a result.')
    }
    return data
  } catch (error) {
    console.error('[Supabase] 插入支付记录异常:', error)
    throw error
  }
}

/**
 * 根据 Gumroad subscription_id 查找订阅记录
 *
 * @param {Env} env - Cloudflare Worker 环境对象
 * @param {string} gumroadSubscriptionId - Gumroad 订阅 ID
 * @returns {Promise<Subscription|null>} 订阅记录或 null
 */
export async function getSubscriptionByGumroadId(
  env: Env,
  gumroadSubscriptionId: string
): Promise<Subscription | null> {
  if (!hasSupabase(env)) return null

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('gumroad_subscription_id', gumroadSubscriptionId)
      .maybeSingle<Subscription>()

    if (error) {
      console.error('[Supabase] 查询订阅失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Supabase] 查询订阅异常:', error)
    return null
  }
}
