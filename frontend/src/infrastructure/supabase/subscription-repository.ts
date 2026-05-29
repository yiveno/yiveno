/**
 * Supabase 订阅数据仓库
 *
 * 职责：
 * - 直接查询 Supabase subscriptions 表
 * - 与官网查询逻辑保持一致
 * - 提供类型安全的订阅数据访问
 */

import { supabase, isSupabaseConfigured } from "./client";
import { logger } from "@/infrastructure/logging/logger";
import type { Subscription } from "./types";

/**
 * 从 Supabase 查询用户的有效订阅信息
 *
 * 查询逻辑与官网完全一致：
 * - 只查询 status = 'active' 的订阅
 * - 只查询未过期的订阅（current_period_end > now）
 * - 按到期时间倒序排序，取最新的一条
 *
 * @param userId - Supabase 用户 ID
 * @returns 订阅信息，如果没有有效订阅则返回 null
 */
export async function getSubscriptionFromSupabase(
  userId: string,
): Promise<Subscription | null> {
  if (!isSupabaseConfigured()) {
    logger.warn("[SubscriptionRepository] Supabase 未配置，跳过查询");
    return null;
  }

  if (!userId) {
    logger.warn("[SubscriptionRepository] userId 为空，跳过查询");
    return null;
  }

  try {
    logger.debug("[SubscriptionRepository] 开始查询订阅信息:", { userId });

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("[SubscriptionRepository] 查询订阅失败:", error);
      throw error;
    }

    logger.debug("[SubscriptionRepository] 查询订阅成功:", {
      hasSubscription: !!data,
      tier: data?.tier,
      status: data?.status,
    });

    return data;
  } catch (error) {
    logger.error("[SubscriptionRepository] 查询订阅异常:", error);
    throw error;
  }
}

/**
 * 检查用户是否为 Pro 用户
 *
 * @param userId - Supabase 用户 ID
 * @returns 是否为 Pro 用户
 */
export async function isProUser(userId: string): Promise<boolean> {
  try {
    const subscription = await getSubscriptionFromSupabase(userId);
    return (
      subscription?.tier === "pro" &&
      subscription?.status === "active" &&
      new Date(subscription.current_period_end) > new Date()
    );
  } catch (error) {
    logger.error("[SubscriptionRepository] 检查 Pro 状态失败:", error);
    return false;
  }
}
