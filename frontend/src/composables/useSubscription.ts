/**
 * 订阅管理 Composable
 *
 * 职责：
 * - 管理订阅状态
 * - 提供订阅操作接口
 * - 与 UI 组件集成
 *
 * 缓存策略（与官网一致）：
 * - 首次加载：立即从缓存读取（避免闪烁），然后从 Supabase 刷新
 * - 后续加载：先显示缓存，后台刷新
 * - 缓存时长：15 分钟
 */

import { ref, computed, watchEffect } from "vue";
import { subscriptionAppService } from "@/application/subscription/subscription-app-service";
import { useSupabaseAuth } from "./useSupabaseAuth";
import { chromeStorage } from "@/infrastructure/storage/chrome-storage";
import type {
  Subscription,
  UserSubscriptionStatus,
} from "@/infrastructure/supabase/types";
import { GUMROAD_CONFIG } from "@/infrastructure/gumroad/client";

/**
 * 缓存配置
 */
const CACHE_KEY = "acuity_subscription_cache";
const CACHE_DURATION = 15 * 60 * 1000; // 15 分钟

interface SubscriptionCache {
  subscription: Subscription | null;
  subscriptionStatus: UserSubscriptionStatus | null;
  timestamp: number;
  userId: string;
}

/**
 * 订阅管理 Composable
 */
export function useSubscription() {
  const { user, isAuthenticated } = useSupabaseAuth();

  const subscription = ref<Subscription | null>(null);
  const subscriptionStatus = ref<UserSubscriptionStatus | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loadingTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const isInitialized = ref(false); // 是否已初始化

  /**
   * 从缓存读取订阅数据（带用户 ID 验证）
   */
  const loadFromCache = async (
    userId: string,
  ): Promise<SubscriptionCache | null> => {
    try {
      const cached = await chromeStorage.getLocal<SubscriptionCache>(CACHE_KEY);
      if (!cached) return null;

      const now = Date.now();

      // 检查用户 ID 是否匹配
      if (cached.userId !== userId) {
        console.log("[useSubscription] 缓存用户不匹配，清除缓存");
        await chromeStorage.removeLocal(CACHE_KEY);
        return null;
      }

      // 检查缓存是否过期
      if (now - cached.timestamp > CACHE_DURATION) {
        console.log("[useSubscription] 缓存已过期");
        await chromeStorage.removeLocal(CACHE_KEY);
        return null;
      }

      console.log("[useSubscription] 使用缓存数据");
      return cached;
    } catch (err) {
      console.error("[useSubscription] 读取缓存失败:", err);
      return null;
    }
  };

  /**
   * 保存订阅数据到缓存
   */
  const saveToCache = async (
    userId: string,
    subscriptionData: Subscription | null,
    statusData: UserSubscriptionStatus | null,
  ) => {
    try {
      const cache: SubscriptionCache = {
        subscription: subscriptionData,
        subscriptionStatus: statusData,
        timestamp: Date.now(),
        userId,
      };
      await chromeStorage.setLocal(CACHE_KEY, cache);
      console.log("[useSubscription] 已缓存订阅数据");
    } catch (err) {
      console.error("[useSubscription] 保存缓存失败:", err);
    }
  };

  /**
   * 清除缓存（用于强制刷新）
   */
  const clearCache = async () => {
    try {
      await chromeStorage.removeLocal(CACHE_KEY);
      console.log("[useSubscription] 已清除缓存");
    } catch (err) {
      console.error("[useSubscription] 清除缓存失败:", err);
    }
  };

  /**
   * 错误消息（用于显示）
   */
  const errorMessage = computed(() => error.value);

  /**
   * 是否为 Pro 用户
   */
  const isPro = computed(() => {
    return (
      subscriptionStatus.value?.tier === "pro" &&
      subscriptionStatus.value?.status === "active"
    );
  });

  /**
   * 订阅是否即将到期
   */
  const isExpiringSoon = computed(() => {
    if (!subscriptionStatus.value?.current_period_end) {
      return false;
    }
    const endDate = new Date(subscriptionStatus.value.current_period_end);
    const daysUntilExpiry =
      (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  });

  /**
   * 订阅是否已取消但仍在有效期内
   */
  const isCancelledButActive = computed(() => {
    return (
      subscriptionStatus.value?.cancel_at_period_end === true &&
      subscriptionStatus.value?.status === "active"
    );
  });

  /**
   * 加载订阅状态（带缓存）
   *
   * 策略：
   * 1. 首次加载：先从缓存读取（立即显示），然后后台刷新
   * 2. 强制刷新：跳过缓存，直接查询 Supabase
   */
  const loadSubscription = async (forceRefresh = false) => {
    const userId = user.value?.id;

    if (!isAuthenticated.value || !userId) {
      subscription.value = null;
      subscriptionStatus.value = null;
      isInitialized.value = true;
      return;
    }

    try {
      // 先尝试从缓存同步加载（立即显示，避免闪烁）
      if (!forceRefresh && !isInitialized.value) {
        const cached = await loadFromCache(userId);
        if (cached) {
          subscription.value = cached.subscription;
          subscriptionStatus.value = cached.subscriptionStatus;
          // eslint-disable-next-line require-atomic-updates -- 缓存加载后设置初始化状态是安全的
          isInitialized.value = true;
          console.log("[useSubscription] 立即显示缓存数据");

          // 后台刷新（不阻塞 UI，不改变 loading 状态）
          Promise.all([
            subscriptionAppService.getSubscriptionDetails(userId),
            subscriptionAppService.getUserSubscription(userId),
          ])
            .then(([details, status]) => {
              subscription.value = details;
              subscriptionStatus.value = status;
              if (details || status) {
                void saveToCache(userId, details, status);
              } else {
                // 如果后台刷新发现订阅已过期，清除缓存
                void clearCache();
              }
            })
            .catch((err) => {
              console.error("[useSubscription] 后台刷新失败:", err);
            });

          return;
        }
      }

      // 缓存未命中，显示 loading 并从 Supabase 获取
      loading.value = true;
      error.value = null;

      const [details, status] = await Promise.all([
        subscriptionAppService.getSubscriptionDetails(userId),
        subscriptionAppService.getUserSubscription(userId),
      ]);

      subscription.value = details;
      subscriptionStatus.value = status;

      if (details || status) {
        await saveToCache(userId, details, status);
      }
    } catch (err) {
      const subscriptionError =
        err instanceof Error ? err.message : "加载订阅状态失败";
      error.value = subscriptionError;
      console.error("[useSubscription] 加载订阅状态失败:", err);

      // 降级：设置为免费用户
      subscription.value = null;
      subscriptionStatus.value = {
        tier: "free",
        status: "expired",
        current_period_end: new Date().toISOString(),
        cancel_at_period_end: false,
      };
    } finally {
      loading.value = false;
      // eslint-disable-next-line require-atomic-updates -- isInitialized 只在 finally 块中设置一次，不会有竞态条件
      isInitialized.value = true;
    }
  };

  /**
   * 创建支付链接并跳转
   *
   * @param variantId - Gumroad 计划 ID
   */
  const checkout = async (variantId: string) => {
    if (!isAuthenticated.value || !user.value) {
      throw new Error("请先登录");
    }

    try {
      loading.value = true;
      error.value = null;

      const checkoutUrl = await subscriptionAppService.createCheckoutLink(
        variantId,
        user.value.id,
        user.value.email || "",
      );

      // 在新标签页打开支付链接
      window.open(checkoutUrl, "_blank");
    } catch (err) {
      const checkoutError =
        err instanceof Error ? err.message : "创建支付链接失败";
      error.value = checkoutError;
      throw new Error(checkoutError);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 打开订阅管理页面（由 Gumroad 提供）
   */
  const openManagePortal = () => {
    const manageUrl = subscriptionAppService.getManagePortalUrl();
    window.open(manageUrl, "_blank", "noopener");
  };

  /**
   * 便捷方法：订阅月度 Pro
   */
  const subscribeMonthly = () => {
    return checkout(GUMROAD_CONFIG.planIds.PRO_MONTHLY);
  };

  /**
   * 便捷方法：订阅年度 Pro
   */
  const subscribeYearly = () => {
    return checkout(GUMROAD_CONFIG.planIds.PRO_YEARLY);
  };

  // 初始化时加载订阅状态（使用 watchEffect 监听登录状态变化）
  watchEffect(() => {
    if (isAuthenticated.value && user.value) {
      // 清除之前的定时器，避免重复调用
      if (loadingTimer.value) {
        clearTimeout(loadingTimer.value);
      }
      // 延迟加载，避免多个组件同时挂载时重复调用
      loadingTimer.value = setTimeout(() => {
        void loadSubscription();
      }, 200);
    } else {
      // 未登录时清空状态
      subscription.value = null;
      subscriptionStatus.value = null;
      isInitialized.value = true;
      void clearCache();
      if (loadingTimer.value) {
        clearTimeout(loadingTimer.value);
        loadingTimer.value = null;
      }
    }
  });

  return {
    // 状态
    subscription: computed(() => subscription.value),
    subscriptionStatus: computed(() => subscriptionStatus.value),
    loading: computed(() => loading.value),
    error: errorMessage,
    isInitialized: computed(() => isInitialized.value),
    isPro,
    isExpiringSoon,
    isCancelledButActive,

    // 方法
    loadSubscription,
    clearCache, // 暴露给外部，用于强制刷新
    checkout,
    openManagePortal,
    subscribeMonthly,
    subscribeYearly,
  };
}
