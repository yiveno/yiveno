/**
 * Side Panel 滚动胶水：浮底间隙、黏底、邻域锚点、跳转钮、ResizeObserver。
 * 从 SidePanel.vue 机械抽出；纯滚动工具仍见 recall-shell-scroll.ts。
 */

import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'

import { t } from '@/infrastructure/i18n/t'
import type { ConversationTurn } from '@/pages/sidepanel/recall-conversation-types'
import {
  createRecallShellScrollListener,
  readRecallShellScrollState,
  resolveRecallShellScrollJumpDirection,
  scheduleRecallShellScrollChildToStart,
  scheduleRecallShellScrollToBottom,
  scrollRecallShellToBottom,
  scrollRecallShellToTop,
  type RecallShellScrollJumpDirection,
  type RecallShellScrollState
} from '@/pages/sidepanel/recall-shell-scroll'

export type UseRecallShellScrollOptions = {
  recallBodyRef: Ref<HTMLElement | null>
  recallFloatDockRef: Ref<HTMLElement | null>
  recallScrollRegionRef: Ref<HTMLElement | null>
  conversationTurns: Ref<ConversationTurn[]>
  isRecallRefreshing: Ref<boolean>
}

export type UseRecallShellScrollResult = {
  stickToBottom: Ref<boolean>
  scrollJumpDirection: Ref<RecallShellScrollJumpDirection | null>
  scrollJumpLabel: ComputedRef<string>
  recallShellScrollListener: (event: Event) => void
  scrollRecallToBottom: () => void
  scrollRecallAfterConversationUpdate: () => void
  handleScrollJump: () => void
  syncRecallFloatDockClearance: () => void
  syncRecallShellScrollState: () => void
}

/** Side Panel 会话区滚动胶水（模板 ref 仍由壳持有）。 */
export function useRecallShellScroll(
  options: UseRecallShellScrollOptions
): UseRecallShellScrollResult {
  const {
    recallBodyRef,
    recallFloatDockRef,
    recallScrollRegionRef,
    conversationTurns,
    isRecallRefreshing
  } = options

  /** 靠近底部时跟随新消息；用户上翻后暂停。 */
  const stickToBottom = ref(true)
  /** 单一跳转钮朝向：down=到底、up=置顶；null=隐藏。 */
  const scrollJumpDirection = ref<RecallShellScrollJumpDirection | null>(null)
  let recallBodyResizeObserver: ResizeObserver | null = null
  let recallFloatDockResizeObserver: ResizeObserver | null = null

  /** 浮底高度 → CSS 变量，供 body 底垫与跳转钮定位。 */
  function syncRecallFloatDockClearance(): void {
    const dock = recallFloatDockRef.value
    const region = recallScrollRegionRef.value
    if (!region) {
      return
    }
    const height = dock ? Math.ceil(dock.getBoundingClientRect().height) : 0
    // 跳转钮与浮底之间再留一小段空隙
    const clearance = Math.max(96, height + 12)
    region.style.setProperty('--recall-dock-clearance', `${clearance}px`)
  }

  function applyRecallShellScrollState(state: RecallShellScrollState): void {
    stickToBottom.value = state.nearBottom
    scrollJumpDirection.value = resolveRecallShellScrollJumpDirection(state)
  }

  function syncRecallShellScrollState(): void {
    const element = recallBodyRef.value
    if (!element) {
      scrollJumpDirection.value = null
      return
    }
    applyRecallShellScrollState(readRecallShellScrollState(element))
  }

  const scrollJumpLabel = computed(() =>
    scrollJumpDirection.value === 'up'
      ? t('sidepanel_scroll_to_top')
      : t('sidepanel_scroll_to_bottom')
  )

  const recallShellScrollListener = createRecallShellScrollListener(applyRecallShellScrollState)

  function scrollRecallToBottom(): void {
    scheduleRecallShellScrollToBottom(
      () => recallBodyRef.value,
      () => stickToBottom.value
    )
    requestAnimationFrame(() => {
      syncRecallShellScrollState()
    })
  }

  /** 最新助手轮是否带可点选邻域卡（有卡时滚锚点，勿盲黏底把首卡顶出视口）。 */
  function latestAssistantHasResultCards(): boolean {
    for (let index = conversationTurns.value.length - 1; index >= 0; index -= 1) {
      const turn = conversationTurns.value[index]
      if (!turn || turn.role !== 'assistant') {
        continue
      }
      if (turn.primaryCard || turn.relatedGuessCard || (turn.candidateCards?.length ?? 0) > 0) {
        return true
      }
      return false
    }
    return false
  }

  function lastNeighborhoodAnchor(): HTMLElement | null {
    const root = recallBodyRef.value
    if (!root) {
      return null
    }
    const anchors = root.querySelectorAll<HTMLElement>('[data-recall-neighborhood-anchor]')
    return anchors.length > 0 ? (anchors.item(anchors.length - 1) ?? null) : null
  }

  /**
   * 会话更新后滚动：
   * - 等待态：黏底（看见进展）
   * - 有邻域卡：取消黏底并滚到邻域锚点（避免迟到的 scrollToBottom 把首卡顶出视口）
   * - 无卡终局：仍黏底（若用户未上滚）
   * 用户已上滚且无「有卡需对位」时不抢滚动。
   */
  function scrollRecallAfterConversationUpdate(): void {
    if (isRecallRefreshing.value) {
      if (stickToBottom.value) {
        scrollRecallToBottom()
      }
      return
    }
    if (latestAssistantHasResultCards()) {
      // 先关黏底，让等待期已排队的 scheduleRecallShellScrollToBottom 在 rAF 里 no-op
      stickToBottom.value = false
      scheduleRecallShellScrollChildToStart(
        () => recallBodyRef.value,
        () => lastNeighborhoodAnchor(),
        () => !isRecallRefreshing.value
      )
      requestAnimationFrame(() => {
        syncRecallShellScrollState()
      })
      return
    }
    if (stickToBottom.value) {
      scrollRecallToBottom()
    }
  }

  function handleScrollJump(): void {
    if (scrollJumpDirection.value === 'up') {
      scrollRecallShellToTop(recallBodyRef.value)
      stickToBottom.value = false
    } else if (scrollJumpDirection.value === 'down') {
      stickToBottom.value = true
      scrollRecallShellToBottom(recallBodyRef.value)
    } else {
      return
    }
    requestAnimationFrame(() => {
      syncRecallShellScrollState()
    })
  }

  watch(
    () => [conversationTurns.value.length, isRecallRefreshing.value] as const,
    async () => {
      await nextTick()
      // 邻域卡挂载可能再晚一拍；多等一帧 DOM，减少锚点 query 空窗
      await nextTick()
      scrollRecallAfterConversationUpdate()
      syncRecallShellScrollState()
    }
  )

  watch(recallBodyRef, (element, _previous, onCleanup) => {
    recallBodyResizeObserver?.disconnect()
    recallBodyResizeObserver = null
    if (!element) {
      scrollJumpDirection.value = null
      return
    }
    syncRecallShellScrollState()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    recallBodyResizeObserver = new ResizeObserver(() => {
      syncRecallShellScrollState()
    })
    recallBodyResizeObserver.observe(element)
    onCleanup(() => {
      recallBodyResizeObserver?.disconnect()
      recallBodyResizeObserver = null
    })
  })

  watch(recallFloatDockRef, (element, _previous, onCleanup) => {
    recallFloatDockResizeObserver?.disconnect()
    recallFloatDockResizeObserver = null
    syncRecallFloatDockClearance()
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    recallFloatDockResizeObserver = new ResizeObserver(() => {
      syncRecallFloatDockClearance()
      syncRecallShellScrollState()
    })
    recallFloatDockResizeObserver.observe(element)
    onCleanup(() => {
      recallFloatDockResizeObserver?.disconnect()
      recallFloatDockResizeObserver = null
    })
  })

  return {
    stickToBottom,
    scrollJumpDirection,
    scrollJumpLabel,
    recallShellScrollListener,
    scrollRecallToBottom,
    scrollRecallAfterConversationUpdate,
    handleScrollJump,
    syncRecallFloatDockClearance,
    syncRecallShellScrollState
  }
}
