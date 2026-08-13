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
import type { Subscription, PaymentRecord } from '@yiveno/types'
import { warn, error as logErrorMessage, toLogError } from '../utils/logger'

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
    warn('[Supabase] 未配置，跳过查询')
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
      logErrorMessage('[Supabase] 查询订阅失败', { detail: toLogError(error) })
      return null
    }

    return data
  } catch (err) {
    logErrorMessage('[Supabase] 查询订阅异常', { detail: toLogError(err) })
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
    warn('[Supabase] 未配置，跳过插入订阅')
    return subscription as Subscription
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return subscription as Subscription

  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('provider_subscription_id', subscription.provider_subscription_id!)
      .maybeSingle()

    const subscriptionData = {
      user_id: subscription.user_id,
      provider_subscription_id: subscription.provider_subscription_id,
      provider_transaction_id: subscription.provider_transaction_id || null,
      provider_price_id: subscription.provider_price_id || null,
      provider_customer_id: subscription.provider_customer_id || null,
      status: subscription.status,
      tier: subscription.tier,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      cancelled_at: subscription.cancelled_at || null,
      source: subscription.source ?? 'paddle_webhook',
      last_verified_at: subscription.last_verified_at ?? null,
      verification_status: subscription.verification_status ?? 'unverified',
      provider_status: subscription.provider_status ?? null
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
        logErrorMessage('[Supabase] 更新订阅失败', { detail: toLogError(error) })
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
        logErrorMessage('[Supabase] 插入订阅失败', { detail: toLogError(error) })
        throw error
      }
      result = data
    }

    if (!result) {
      throw new Error('Upsert operation failed to return a result.')
    }
    return result
  } catch (err) {
    logErrorMessage('[Supabase] 插入订阅异常', { detail: toLogError(err) })
    throw err
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
    warn('[Supabase] 未配置，跳过插入支付记录')
    return payment
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return payment

  try {
    const paymentData: Omit<PaymentRecord, 'id'> & { id?: string } = {
      user_id: payment.user_id,
      provider_subscription_id: payment.provider_subscription_id || null,
      provider_transaction_id: payment.provider_transaction_id,
      provider_payment_id: payment.provider_payment_id || null,
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
      if ((error as { code?: string }).code === '23505') {
        return payment
      }
      logErrorMessage('[Supabase] 插入支付记录失败', { detail: toLogError(error) })
      throw error
    }

    if (!data) {
      throw new Error('Insert operation failed to return a result.')
    }
    return data
  } catch (err) {
    logErrorMessage('[Supabase] 插入支付记录异常', { detail: toLogError(err) })
    throw err
  }
}

export type BillingEventInsert = {
  provider?: 'paddle'
  provider_event_id: string
  event_type?: string | null
  occurred_at?: string | null
  user_id?: string | null
  result: 'applied' | 'ignored' | 'rejected' | 'error'
  skip_reason?: string | null
  payload_hash?: string | null
}

/**
 * 写入计费入站事件账。true=首次写入；false=重复或失败。
 */
export async function insertBillingEvent(env: Env, event: BillingEventInsert): Promise<boolean> {
  if (!hasSupabase(env)) return false
  const supabase = createSupabaseClient(env)
  if (!supabase) return false

  try {
    const { error } = await supabase.from('billing_events').insert({
      provider: event.provider ?? 'paddle',
      provider_event_id: event.provider_event_id,
      event_type: event.event_type ?? null,
      occurred_at: event.occurred_at ?? null,
      user_id: event.user_id ?? null,
      result: event.result,
      skip_reason: event.skip_reason ?? null,
      payload_hash: event.payload_hash ?? null
    })

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return false
      }
      logErrorMessage('[Supabase] 写入 billing_events 失败', { detail: toLogError(error) })
      return false
    }
    return true
  } catch (err) {
    logErrorMessage('[Supabase] 写入 billing_events 异常', { detail: toLogError(err) })
    return false
  }
}

/** 处理失败时删除占位，便于 Provider 重试 */
export async function deleteBillingEvent(env: Env, providerEventId: string): Promise<void> {
  if (!hasSupabase(env)) return
  const supabase = createSupabaseClient(env)
  if (!supabase) return
  const { error } = await supabase
    .from('billing_events')
    .delete()
    .eq('provider', 'paddle')
    .eq('provider_event_id', providerEventId)
  if (error) {
    logErrorMessage('[Supabase] 删除 billing_events 失败', { detail: toLogError(error) })
  }
}

export async function getSubscriptionByProviderId(
  env: Env,
  providerSubscriptionId: string
): Promise<Subscription | null> {
  if (!hasSupabase(env)) return null
  const supabase = createSupabaseClient(env)
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle<Subscription>()
    if (error) {
      logErrorMessage('[Supabase] 按 provider id 查订阅失败', { detail: toLogError(error) })
      return null
    }
    return data
  } catch (err) {
    logErrorMessage('[Supabase] 按 provider id 查订阅异常', { detail: toLogError(err) })
    return null
  }
}

/**
 * 取用户最新一条订阅行（不限 status；供对账）
 */
export async function getLatestUserSubscriptionRow(
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
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<Subscription>()

    if (error) {
      logErrorMessage('[Supabase] 查询最新订阅行失败', { detail: toLogError(error) })
      return null
    }
    return data
  } catch (err) {
    logErrorMessage('[Supabase] 查询最新订阅行异常', { detail: toLogError(err) })
    return null
  }
}

/**
 * 列出需对账的 active 订阅（last_verified_at 为空或早于阈值）
 */
export async function listSubscriptionsNeedingVerify(
  env: Env,
  olderThanIso: string,
  limit = 50
): Promise<Subscription[]> {
  if (!hasSupabase(env)) return []
  const supabase = createSupabaseClient(env)
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .or(`last_verified_at.is.null,last_verified_at.lt."${olderThanIso}"`)
      .order('last_verified_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (error) {
      logErrorMessage('[Supabase] 列出待对账订阅失败', { detail: toLogError(error) })
      return []
    }
    return (data || []) as Subscription[]
  } catch (err) {
    logErrorMessage('[Supabase] 列出待对账订阅异常', { detail: toLogError(err) })
    return []
  }
}
