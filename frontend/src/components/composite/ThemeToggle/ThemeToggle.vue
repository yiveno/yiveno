<!--
  主题切换组件
  - 支持三种模式：跟随系统、明亮、暗黑
  - Hover 显示下拉菜单
  - 可独立使用，不依赖特定页面结构
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import {
  globalStateManager,
  type ThemeMode
} from '@/infrastructure/global-state/global-state-manager'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { applyColorPresetToDocument } from '@/composables/useThemeSync'
import { LucideIcon } from '@/components'

// 当前主题状态（从全局状态管理器获取）
const currentTheme = ref<ThemeMode>('system')

// 菜单显示状态
const showMenu = ref(false)

// 按钮引用（用于获取点击位置）
const toggleBtnRef = ref<HTMLElement | null>(null)

// 菜单引用
const menuRef = ref<HTMLElement | null>(null)

// 系统主题变化监听器（MediaQueryList）
let systemThemeQuery: MediaQueryList | null = null

// 🔒 主题切换锁：防止动画进行中时重复触发
const isToggling = ref(false)

// 主题选项配置
const themeOptions = [
  { value: 'system' as ThemeMode, label: '跟随系统', icon: 'sync' },
  { value: 'light' as ThemeMode, label: '浅色主题', icon: 'sun' },
  { value: 'dark' as ThemeMode, label: '暗黑主题', icon: 'moon' }
]

// 计算当前主题的图标（Lucide Icons）
const currentThemeIconLucide = computed(() => {
  if (currentTheme.value === 'system') {
    // 跟随系统时，显示当前实际主题的图标
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return systemIsDark ? 'moon' : 'sun'
  }
  return currentTheme.value === 'dark' ? 'moon' : 'sun'
})

// 计算当前主题的标签
const currentThemeLabel = computed(() => {
  const option = themeOptions.find(opt => opt.value === currentTheme.value)
  return option?.label || '主题设置'
})

// 选择主题
const selectTheme = async (theme: ThemeMode) => {
  // 🔒 如果正在切换中，忽略点击
  if (isToggling.value) {
    logger.debug('ThemeToggle', '主题切换进行中，忽略点击')
    return
  }

  // 关闭菜单
  showMenu.value = false

  // 如果选择的是当前主题，不执行切换
  if (theme === currentTheme.value) {
    return
  }

  logger.info('ThemeToggle', '用户选择主题', { from: currentTheme.value, to: theme })

  // 执行主题切换
  await toggleTheme(theme)
}

/**
 * 获取圆形扩散动画的参数
 * @param x 点击位置 X
 * @param y 点击位置 Y
 * @returns 覆盖整个页面所需的最大半径
 */
const getCircleRadius = (x: number, y: number): number => {
  // 计算从点击位置到页面四个角的距离，取最大值
  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  return Math.hypot(maxX, maxY)
}

// 主题切换逻辑
const toggleTheme = async (newTheme: ThemeMode) => {
  // 🔒 设置切换锁
  isToggling.value = true

  try {
    // 确定实际要应用的主题（如果是 system，需要获取系统主题）
    let actualTheme: 'light' | 'dark'
    if (newTheme === 'system') {
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      actualTheme = systemIsDark ? 'dark' : 'light'
    } else {
      actualTheme = newTheme
    }

    const isDark = actualTheme === 'dark'

    logger.info('ThemeToggle', '开始切换主题', {
      current: currentTheme.value,
      next: newTheme,
      actualTheme
    })

    // 获取按钮位置（用于圆形扩散动画）
    let x = window.innerWidth - 50 // 默认右上角
    let y = 50
    if (toggleBtnRef.value) {
      const rect = toggleBtnRef.value.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
    }

    // 检查是否支持 View Transitions API
    const isViewTransitionSupported =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (isViewTransitionSupported) {
      // 使用 View Transitions API 实现圆形扩散动画
      const radius = getCircleRadius(x, y)
      const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]

      // 设置 CSS 变量供动画使用
      document.documentElement.style.setProperty('--theme-transition-x', `${x}px`)
      document.documentElement.style.setProperty('--theme-transition-y', `${y}px`)

      const transition = (
        document as unknown as {
          startViewTransition: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> }
        }
      ).startViewTransition(() => {
        currentTheme.value = newTheme
        applyTheme(actualTheme)
      })

      // 等待动画准备完成
      await transition.ready

      // 暗黑模式：新视图从小圆扩散到大圆
      // 明亮模式：旧视图从大圆收缩到小圆
      const animation = document.documentElement.animate(
        {
          clipPath: isDark ? clipPath : [...clipPath].reverse()
        },
        {
          duration: 400,
          easing: 'ease-out',
          // 保持动画结束状态，避免闪烁
          fill: 'forwards',
          pseudoElement: isDark ? '::view-transition-new(root)' : '::view-transition-old(root)'
        }
      )

      // 🔒 等待动画完成后再释放锁
      await animation.finished
    } else {
      // 不支持 View Transitions，直接切换
      currentTheme.value = newTheme
      applyTheme(actualTheme)

      // 🔒 模拟动画时间，避免切换过快
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    try {
      // 使用全局状态管理器设置主题（异步，不阻塞UI）
      await globalStateManager.setTheme(newTheme)
      logger.info('ThemeToggle', '全局状态管理器设置成功')
    } catch (error) {
      logger.error('ThemeToggle', '全局状态管理器设置失败，但UI已更新', error)
      // 全局状态管理器失败不影响用户体验，UI已经更新了
    }

    // 发送主题切换事件，通知其他组件
    emitEvent('theme:changed', { theme: actualTheme })

    logger.info('ThemeToggle', `主题已切换: ${currentTheme.value}`)
  } finally {
    // 🔒 无论成功或失败，都要释放锁
    isToggling.value = false
  }
}

// 应用主题到页面
const applyTheme = (theme: 'light' | 'dark') => {
  const root = document.documentElement

  if (theme === 'dark') {
    root.style.colorScheme = 'dark'
    root.setAttribute('data-theme', 'dark')
  } else if (theme === 'light') {
    root.style.colorScheme = 'light'
    root.setAttribute('data-theme', 'light')
  }
}

// 系统主题变化处理函数
const handleSystemThemeChange = async (e: MediaQueryListEvent) => {
  try {
    // 只有当前设置为跟随系统时，才响应系统主题变化
    if (currentTheme.value !== 'system') {
      logger.debug('ThemeToggle', '当前未设置为跟随系统，忽略系统主题变化')
      return
    }

    // 根据系统主题设置
    const systemTheme: 'light' | 'dark' = e.matches ? 'dark' : 'light'
    logger.info('ThemeToggle', '检测到系统主题变化，自动跟随', {
      systemTheme
    })

    // 应用主题
    applyTheme(systemTheme)

    // 发送主题切换事件
    emitEvent('theme:changed', { theme: systemTheme })
  } catch (error) {
    logger.error('ThemeToggle', '处理系统主题变化失败', error)
  }
}

// 启动系统主题监控
const startSystemThemeMonitoring = () => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    logger.warn('ThemeToggle', '当前环境不支持系统主题监控')
    return
  }

  try {
    // 创建媒体查询以监听系统主题
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')

    // 添加监听器（现代浏览器都支持 addEventListener）
    systemThemeQuery.addEventListener('change', handleSystemThemeChange)
    logger.info('ThemeToggle', '系统主题监控已启动')
  } catch (error) {
    logger.error('ThemeToggle', '启动系统主题监控失败', error)
  }
}

// 停止系统主题监控
const stopSystemThemeMonitoring = () => {
  if (!systemThemeQuery) return

  try {
    systemThemeQuery.removeEventListener('change', handleSystemThemeChange)
    logger.info('ThemeToggle', '系统主题监控已停止')
    systemThemeQuery = null
  } catch (error) {
    logger.error('ThemeToggle', '停止系统主题监控失败', error)
  }
}

// 初始化主题
const initializeTheme = async () => {
  try {
    logger.info('ThemeToggle', '开始初始化主题...')

    // 立即设置默认值，确保UI尽快显示
    currentTheme.value = 'system' // 默认跟随系统
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(systemIsDark ? 'dark' : 'light')

    try {
      // 尝试从全局状态管理器获取保存的主题
      await globalStateManager.initialize()
      const savedTheme = globalStateManager.getTheme()
      logger.info('ThemeToggle', '全局状态管理器初始化完成，获取到保存的主题', {
        savedTheme
      })

      currentTheme.value = savedTheme

      // 应用主题
      if (savedTheme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(systemPrefersDark ? 'dark' : 'light')
      } else {
        applyTheme(savedTheme)
      }

      applyColorPresetToDocument(globalStateManager.getColorPreset())

      logger.info('ThemeToggle', '使用保存的主题', { theme: savedTheme })
    } catch (globalStateError) {
      logger.warn('ThemeToggle', '全局状态管理器初始化失败，使用默认跟随系统', globalStateError)
      // 全局状态管理器失败不影响组件正常工作，已经设置了默认主题
    }

    logger.info('ThemeToggle', '主题初始化完成', { theme: currentTheme.value })
  } catch (error) {
    logger.error('ThemeToggle', '主题初始化完全失败，使用默认跟随系统', error)
    currentTheme.value = 'system'
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(systemIsDark ? 'dark' : 'light')
  }
}

onMounted(async () => {
  try {
    // 初始化全局状态管理器
    await globalStateManager.initialize()

    // 初始化主题（先获取当前主题）
    await initializeTheme()

    // 始终启动系统主题监控（当设置为 system 时会自动响应）
    startSystemThemeMonitoring()
  } catch (error) {
    logger.error('ThemeToggle', '组件挂载失败', error)
  }
})

// 清理监听器
onUnmounted(() => {
  stopSystemThemeMonitoring()
})
</script>

<template>
  <div class="theme-toggle">
    <md-icon-button
      id="theme-toggle-anchor"
      ref="toggleBtnRef"
      class="theme-toggle__button"
      :style="{ '--md-icon-button-icon-size': '30px' }"
      :title="currentThemeLabel"
      :aria-label="currentThemeLabel"
      @click="showMenu = !showMenu"
    >
      <LucideIcon :name="currentThemeIconLucide" :size="30" />
    </md-icon-button>

    <!-- Material Design 3 Menu -->
    <md-menu
      id="theme-menu"
      ref="menuRef"
      anchor="theme-toggle-anchor"
      :open="showMenu"
      :quick="true"
      @closed="showMenu = false"
    >
      <md-menu-item
        v-for="option in themeOptions"
        :key="option.value"
        :selected="currentTheme === option.value"
        @click="selectTheme(option.value)"
      >
        <!-- 必须用原生元素承载 slot="start"：Vue 子组件上的 slot 可能无法交给 md-menu-item，图标会掉进 default 槽，从而在 headline 上方单独一行 -->
        <span slot="start" class="theme-menu-item__start">
          <LucideIcon :name="option.icon" :size="15" />
        </span>
        <!-- headline：避免使用 slot="end"（Material 会先渲染 end，对勾会夹在图标与文字之间） -->
        <span slot="headline" class="theme-menu-item__headline">
          <span class="theme-menu-item__label">{{ option.label }}</span>
          <LucideIcon
            v-if="currentTheme === option.value"
            name="check-circle"
            :size="16"
            class="theme-menu-item__selected-icon"
            aria-hidden="true"
          />
        </span>
      </md-menu-item>
    </md-menu>
  </div>
</template>

<style scoped>
.theme-toggle {
  position: relative;
}

.theme-toggle__button {
  padding: 0;
  color: var(--color-text-secondary);
  transition: color var(--md-sys-motion-duration-short2);
}

.theme-toggle__button:hover {
  color: var(--color-text-primary);
}

/* Material Design 3 Menu：紧凑尺寸（popup 等小视口） */
md-menu {
  --md-menu-container-color: var(--md-sys-color-surface-container);
  --md-menu-container-shape: var(--radius-md);
  --md-menu-container-elevation: 2;

  /* 菜单列表上下内边距（默认各 8px） */
  --md-menu-top-space: 4px;
  --md-menu-bottom-space: 4px;

  min-width: 148px;
  max-width: min(100vw - 16px, 220px);
}

md-menu-item {
  --md-menu-item-label-text-color: var(--md-sys-color-on-surface);
  --md-menu-item-label-text-font: var(--font-family-base);
  --md-menu-item-label-text-size: var(--text-sm);
  --md-menu-item-label-text-line-height: 1.125rem;

  /* 选中行背景（仅内部 .selected 行消费，未选中项不受影响） */
  --md-menu-item-selected-container-color: var(--md-sys-color-primary-container);

  /* 默认 min-height 56px + 上下各 12px padding，整体偏大 */
  --md-menu-item-one-line-container-height: 34px;
  --md-menu-item-top-space: 4px;
  --md-menu-item-bottom-space: 4px;
  --md-menu-item-leading-space: 10px;
  --md-menu-item-trailing-space: 10px;

  margin: 0;
  border-radius: var(--radius-sm);
}

/* hover 状态 */
md-menu-item:hover {
  --md-menu-item-container-color: var(--md-sys-color-surface-variant);
}

.theme-menu-item__start {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  color: var(--md-sys-color-on-surface-variant);
}

.theme-menu-item__headline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  min-width: 0;
}

.theme-menu-item__label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-menu-item__selected-icon {
  flex-shrink: 0;
  color: var(--md-sys-color-primary);
}
</style>
