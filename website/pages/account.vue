<script setup lang="ts">
import { formatDateTime, formatDate } from '@/utils/date-formatter'
import { gumroadUrls, chromeStoreUrls } from '@/config/external-links'

const { user, isAuthenticated, signOut, initialize } = useAuth()
const { isPro, expiryDate, isInitialized } = useSubscription()
const isLoading = ref(false)
const avatarLoadFailed = ref(false)

// 🔒 未登录自动跳转到登录页
watchEffect(() => {
  if (!isAuthenticated.value && !user.value) {
    navigateTo('/login')
  }
})

onMounted(() => {
  initialize()
})

const userName = computed(() => {
  if (!user.value) return '未知用户'
  const metadata = user.value.user_metadata
  if (metadata?.full_name) return metadata.full_name
  if (metadata?.name) return metadata.name
  if (user.value.email) return user.value.email.split('@')[0]
  return '未知用户'
})

const userAvatar = computed(() => {
  if (!user.value) return null
  const metadata = user.value.user_metadata
  return metadata?.avatar_url || metadata?.picture || null
})

const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const loginProvider = computed(() => {
  if (!user.value) return '未知'
  const appMetadata = user.value.app_metadata
  const provider = appMetadata?.provider
  if (provider === 'google') return 'Google'
  if (provider === 'azure') return 'Microsoft'
  return provider || '未知'
})

const createdAt = computed(() => {
  if (!user.value?.created_at) return '未知'
  return formatDate(user.value.created_at)
})

const lastSignIn = computed(() => {
  if (!user.value?.last_sign_in_at) return '未知'
  return formatDateTime(user.value.last_sign_in_at)
})

const handleSignOut = async () => {
  try {
    isLoading.value = true
    await signOut()
    await navigateTo('/')
  } catch (error) {
    console.error('[Account] 退出登录失败:', error)
    alert('退出登录失败，请重试')
  } finally {
    isLoading.value = false
  }
}

// 删除账户
const handleDeleteAccount = () => {
  const confirmed = confirm(
    '⚠️ 警告：删除账户是不可逆的操作！\n\n' +
      '删除后将永久清除：\n' +
      '• 您的所有书签数据\n' +
      '• 订阅信息\n' +
      '• 账户设置\n\n' +
      '确定要继续吗？'
  )

  if (confirmed) {
    const doubleConfirm = confirm('最后确认：您真的要删除账户吗？\n\n' + '此操作无法撤销！')

    if (doubleConfirm) {
      // TODO: 调用删除账户 API
      alert('账户删除功能开发中...\n\n请联系客服协助删除账户。')
    }
  }
}
</script>

<template>
  <div class="account-page">
    <!-- 已登录状态：双栏布局 -->
    <div v-if="isAuthenticated" class="account-layout">
      <!-- 左侧：用户信息面板 -->
      <aside class="profile-sidebar">
        <div class="profile-card">
          <!-- 头像 -->
          <div class="avatar-wrap">
            <img
              v-if="userAvatar && !avatarLoadFailed"
              :src="userAvatar"
              :alt="userName"
              class="avatar-img"
              @error="avatarLoadFailed = true"
            />
            <div v-else class="avatar-fallback">{{ userInitial }}</div>
            <div class="avatar-ring"></div>
          </div>

          <!-- 用户名 & 邮箱 -->
          <h2 class="profile-name">{{ userName }}</h2>
          <p class="profile-email">{{ user?.email }}</p>

          <!-- 标签 -->
          <div class="profile-tags">
            <span class="tag tag--provider">{{ loginProvider }}</span>
            <!-- 订阅状态加载中显示骨架屏 -->
            <span v-if="!isInitialized" class="tag tag--loading">
              <span class="loading-shimmer"></span>
            </span>
            <span v-else class="tag tag--plan" :class="{ 'tag--pro': isPro }">
              {{ isPro ? 'PRO' : '免费版' }}
            </span>
          </div>

          <!-- 分隔线 -->
          <div class="divider"></div>

          <!-- 元信息 -->
          <div class="profile-meta">
            <div class="meta-row">
              <span class="meta-key">注册时间</span>
              <span class="meta-val">{{ createdAt }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">最后登录</span>
              <span class="meta-val">{{ lastSignIn }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">邮箱验证</span>
              <span class="meta-val">
                <span v-if="user?.email_confirmed_at" class="badge badge--success">✓ 已验证</span>
                <span v-else class="badge badge--warning">⚠ 未验证</span>
              </span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="profile-actions">
            <button
              class="account-button account-button--danger"
              :disabled="isLoading"
              @click="handleSignOut"
            >
              <span v-if="!isLoading">退出登录</span>
              <span v-else>退出中…</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- 右侧：内容区 -->
      <main class="account-main">
        <!-- 订阅状态卡片 -->
        <section class="content-card subscription-card">
          <div class="card-header">
            <h3 class="card-title">订阅状态</h3>
          </div>

          <!-- 加载中状态（骨架屏） -->
          <div v-if="!isInitialized" class="subscription-body">
            <div class="plan-info">
              <div class="plan-icon-skeleton"></div>
              <div class="plan-text">
                <div class="skeleton-line skeleton-line--title"></div>
                <div class="skeleton-line skeleton-line--desc"></div>
              </div>
            </div>
            <div class="subscription-actions">
              <div class="skeleton-button"></div>
            </div>
          </div>

          <!-- 加载完成后显示内容 -->
          <div v-else class="subscription-body">
            <div class="plan-info">
              <div class="plan-icon">{{ isPro ? '👑' : '🆓' }}</div>
              <div class="plan-text">
                <div class="plan-name">{{ isPro ? 'PRO 方案' : '免费版' }}</div>
                <div class="plan-desc">
                  <template v-if="isPro && expiryDate">
                    到期时间：{{ formatDateTime(expiryDate) }}
                  </template>
                  <template v-else> 升级到 Pro，解锁 AI 标签、无限书签同步等高级功能 </template>
                </div>
              </div>
            </div>
            <div class="subscription-actions">
              <NuxtLink v-if="!isPro" to="/pricing" class="account-button account-button--primary">
                升级到 Pro →
              </NuxtLink>
              <template v-else>
                <!-- 主按钮：查看方案对比 -->
                <NuxtLink to="/pricing" class="account-button account-button--primary">
                  查看方案对比
                </NuxtLink>
                <!-- 次要链接：续费/管理 -->
                <a
                  :href="gumroadUrls.subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="subscription-link"
                  title="在 Gumroad 续费或管理订阅（取消订阅、更新支付方式等）"
                >
                  续费或管理订阅 →
                </a>
              </template>
            </div>
          </div>
        </section>

        <!-- 快捷操作卡片 -->
        <section class="content-card">
          <div class="card-header">
            <h3 class="card-title">快捷操作</h3>
          </div>
          <div class="quick-grid">
            <a
              :href="chromeStoreUrls.extension"
              target="_blank"
              rel="noopener noreferrer"
              class="quick-item"
            >
              <span class="quick-icon">🔌</span>
              <div class="quick-text">
                <div class="quick-title">安装扩展</div>
                <div class="quick-sub">Chrome Web Store</div>
              </div>
              <span class="quick-arrow">→</span>
            </a>
            <NuxtLink to="/docs" class="quick-item">
              <span class="quick-icon">📚</span>
              <div class="quick-text">
                <div class="quick-title">使用文档</div>
                <div class="quick-sub">查看帮助与教程</div>
              </div>
              <span class="quick-arrow">→</span>
            </NuxtLink>
            <NuxtLink to="/support" class="quick-item">
              <span class="quick-icon">💬</span>
              <div class="quick-text">
                <div class="quick-title">联系支持</div>
                <div class="quick-sub">获取客服帮助</div>
              </div>
              <span class="quick-arrow">→</span>
            </NuxtLink>
          </div>
        </section>

        <!-- 数据管理卡片 -->
        <section class="content-card danger-zone">
          <div class="card-header">
            <h3 class="card-title">数据管理</h3>
          </div>
          <div class="danger-actions">
            <button class="danger-action-item" @click="handleDeleteAccount">
              <div class="danger-action-content">
                <div class="danger-action-title">🗑️ 删除账户</div>
                <div class="danger-action-desc">永久删除您的账户和所有数据</div>
              </div>
              <span class="danger-action-arrow">→</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

/* ===== 响应式 ===== */
@media (width <= 768px) {
  .account-page {
    padding: var(--md-sys-spacing-md) var(--md-sys-spacing-sm);
  }

  .account-layout {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    position: static;
  }

  .subscription-body {
    flex-direction: column;
    align-items: flex-start;
  }

  .subscription-actions {
    width: 100%;
  }

  .subscription-actions .account-button {
    width: 100%;
  }

  .subscription-link {
    width: 100%;
  }
}

.account-page {
  min-height: 100vh;
  padding: var(--md-sys-spacing-lg) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-background);
}

/* ===== 双栏布局 ===== */
.account-layout {
  display: grid;
  align-items: start;
  gap: var(--md-sys-spacing-lg);
  grid-template-columns: 280px 1fr;
  max-width: 1000px;
  margin: 0 auto;
}

/* ===== 左侧 Profile 卡片 ===== */
.profile-sidebar {
  position: sticky;
  top: calc(80px + var(--md-sys-spacing-md));
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  padding: var(--md-sys-spacing-xl) var(--md-sys-spacing-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-extra-large);
  text-align: center;
  background-color: var(--md-sys-color-surface-variant);
}

/* 头像 */
.avatar-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: var(--md-sys-spacing-xs);
}

.avatar-img {
  position: relative;
  z-index: 1;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-fallback {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--md-sys-color-on-primary);
  background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary));
}

.avatar-ring {
  position: absolute;
  inset: -3px;
  z-index: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary));
}

/* 用户名 & 邮箱 */
.profile-name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.profile-email {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  word-break: break-all;
}

/* 标签 */
.profile-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--md-sys-spacing-xs);
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.tag--provider {
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent);
  color: var(--md-sys-color-primary);
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}

.tag--plan {
  border: 1px solid color-mix(in srgb, var(--md-sys-color-on-surface-variant) 30%, transparent);
  color: var(--md-sys-color-on-surface-variant);
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 15%, transparent);
}

.tag--pro {
  border: 1px solid #ffd700;
  font-weight: 600;
  color: #000;
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  box-shadow: 0 2px 8px rgb(255 215 0 / 30%);
}

.tag--loading {
  width: 60px;
  height: 24px;
  padding: 0;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 15%, transparent);
  overflow: hidden;
}

.loading-shimmer {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--md-sys-color-on-surface-variant) 30%, transparent) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

/* 分隔线 */
.divider {
  width: 100%;
  height: 1px;
  margin: var(--md-sys-spacing-xs) 0;
  background-color: var(--md-sys-color-outline-variant);
}

/* 元信息列表 */
.profile-meta {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
  width: 100%;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
}

.meta-key {
  flex-shrink: 0;
  font-size: 0.75rem;
  white-space: nowrap;
  color: var(--md-sys-color-on-surface-variant);
}

.meta-val {
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: right;
  color: var(--md-sys-color-on-surface);
}

.meta-val.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

/* 状态徽章 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge--success {
  color: #22c55e;
  background-color: rgb(34 197 94 / 12%);
}

.badge--warning {
  color: #f59e0b;
  background-color: rgb(245 158 11 / 12%);
}

/* 操作按钮区 */
.profile-actions {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-xs);
  width: 100%;
  margin-top: var(--md-sys-spacing-xs);
}

/* ===== 通用按钮 ===== */
.account-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 10px 20px;
  border: none;
  border-radius: var(--md-sys-shape-corner-medium);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.account-button--primary {
  color: var(--md-sys-color-on-primary);
  background-color: var(--md-sys-color-primary);
}

.account-button--primary:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-primary), black 8%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
}

.account-button--danger {
  border: 1px solid color-mix(in srgb, var(--md-sys-color-error) 25%, transparent);
  color: var(--md-sys-color-error);
  background-color: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
}

.account-button--danger:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 20%, transparent);
  transform: translateY(-1px);
}

.account-button--ghost {
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  background-color: transparent;
}

.account-button--ghost:hover {
  color: var(--md-sys-color-on-surface);
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
}

.account-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ===== 右侧内容区 ===== */
.account-main {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-md);
}

.content-card {
  padding: var(--md-sys-spacing-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-extra-large);
  background-color: var(--md-sys-color-surface-variant);
}

.card-header {
  margin-bottom: var(--md-sys-spacing-md);
}

.card-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

/* 订阅卡片 */
.subscription-card {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--md-sys-color-primary) 15%, var(--md-sys-color-surface-variant)) 0%,
    var(--md-sys-color-surface-variant) 100%
  );
}

/* 骨架屏样式 */
.plan-icon-skeleton {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: var(--md-sys-shape-corner-medium);
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 10%, transparent);
  overflow: hidden;
}

.plan-icon-skeleton::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--md-sys-color-on-surface-variant) 20%, transparent) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
  content: '';
}

.skeleton-line {
  position: relative;
  height: 16px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 10%, transparent);
  overflow: hidden;
}

.skeleton-line::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--md-sys-color-on-surface-variant) 20%, transparent) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
  content: '';
}

.skeleton-line--title {
  width: 80px;
  height: 20px;
  margin-bottom: 6px;
}

.skeleton-line--desc {
  width: 200px;
  height: 16px;
}

.skeleton-button {
  position: relative;
  width: 120px;
  height: 40px;
  border-radius: var(--md-sys-shape-corner-medium);
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 10%, transparent);
  overflow: hidden;
}

.skeleton-button::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--md-sys-color-on-surface-variant) 20%, transparent) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
  content: '';
}

.subscription-body {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--md-sys-spacing-md);
}

.subscription-actions {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: stretch;
  gap: var(--md-sys-spacing-xs);
}

.subscription-actions .account-button {
  width: auto;
  white-space: nowrap;
}

/* 订阅管理次要链接 */
.subscription-link {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: var(--md-sys-spacing-xs) 0;
  font-size: 0.8125rem;
  text-align: center;
  text-decoration: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s ease;
}

.subscription-link:hover {
  text-decoration: underline;
  color: var(--md-sys-color-primary);
}

.plan-info {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
}

.plan-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--md-sys-shape-corner-medium);
  font-size: 2rem;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 10%, transparent);
}

.plan-name {
  margin-bottom: 2px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.plan-desc {
  max-width: 280px;
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
}

/* 快捷操作 */
.quick-grid {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-xs);
}

.quick-item {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-md);
  border: 1px solid transparent;
  border-radius: var(--md-sys-shape-corner-large);
  text-decoration: none;
  color: var(--md-sys-color-on-surface);
  transition: all 0.18s ease;
}

.quick-item:hover {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent);
}

.quick-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--md-sys-shape-corner-small);
  font-size: 1.375rem;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
}

.quick-text {
  flex: 1;
}

.quick-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.quick-sub {
  margin-top: 1px;
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
}

.quick-arrow {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.quick-item:hover .quick-arrow {
  opacity: 1;
  transform: translateX(3px);
}

/* 数据管理（危险区域） */
.danger-zone {
  border-color: color-mix(in srgb, var(--md-sys-color-error) 30%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--md-sys-color-error) 5%, var(--md-sys-color-surface-variant)),
    var(--md-sys-color-surface-variant)
  );
}

.danger-actions {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-xs);
}

.danger-action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  width: 100%;
  padding: var(--md-sys-spacing-md);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-error) 20%, transparent);
  border-radius: var(--md-sys-shape-corner-large);
  text-align: left;
  color: var(--md-sys-color-on-surface);
  background-color: transparent;
  cursor: pointer;
  transition: all 0.18s ease;
}

.danger-action-item:hover {
  border-color: color-mix(in srgb, var(--md-sys-color-error) 40%, transparent);
  background-color: color-mix(in srgb, var(--md-sys-color-error) 8%, transparent);
}

.danger-action-content {
  flex: 1;
}

.danger-action-title {
  margin-bottom: 2px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--md-sys-color-error);
}

.danger-action-desc {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
}

.danger-action-arrow {
  font-size: 0.875rem;
  color: var(--md-sys-color-error);
  opacity: 0;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.danger-action-item:hover .danger-action-arrow {
  opacity: 1;
  transform: translateX(3px);
}

/* ===== 页面容器 ===== */
</style>
