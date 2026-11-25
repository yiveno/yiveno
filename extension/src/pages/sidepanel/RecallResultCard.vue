<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import type { RecallHighlightPart } from '@/core/recall/highlight-recall-text'
import { isOpenableExternalSourceUrl } from '@/infrastructure/browser/active-tab-reader'
import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import { t } from '@/infrastructure/i18n/t'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import {
  buildRecallEvidencePayload,
  scheduleRecallEvidenceWhenVisible
} from '@/pages/sidepanel/recall-result-card-evidence'
import { isFaviconBroken, withBrokenFavicon } from '@/pages/sidepanel/recall-result-card-favicon'
import { resolveRecallCardClickAction } from '@/pages/sidepanel/recall-result-card-interaction'
import {
  bindHoverPreviewScrollDismiss,
  createHoverPreviewDelayController,
  resolveRecallHoverPreviewScrollRoot
} from '@/pages/sidepanel/recall-card-hover-preview'
import RecallCardHoverPreview from '@/pages/sidepanel/RecallCardHoverPreview.vue'
import RecallHighlightText from '@/pages/sidepanel/RecallHighlightText.vue'

/** 找回结果卡展示模型（含可选折叠组）。 */
export interface RecallCardModel {
  id: string
  /** 条目种类：驱动摘录 / 书签两套视觉 */
  itemKind: 'bookmark' | 'text_excerpt'
  title: string
  subtitle: string
  url: string
  /**
   * 摘录源站 URL（可见次要动作「打开原文」）；书签无——主 `url` 已是源站。
   * 契约：与 MemoryItem.payload.sourceUrl 一致，不经展示缩短。
   */
  sourceUrl?: string
  excerpt?: string
  note?: string
  typeLabel: string
  titleParts: RecallHighlightPart[]
  subtitleParts: RecallHighlightPart[]
  excerptParts: RecallHighlightPart[]
  noteParts: RecallHighlightPart[]
  /** ≥2 时展示集合样式 */
  duplicateTotalCount?: number
  duplicateLabel?: string
  siblings?: RecallCardModel[]
  /** ISO 保存时间（TTE ECS 打分） */
  savedAtIso?: string
  /** 保存时间展示（相对，经 i18n） */
  savedAtLabel?: string
  /** 保存时间绝对值（title / 读屏） */
  savedAtTitle?: string
  /** 命中理由单行（Explain；TTE ECS） */
  reasonLine?: string
  /** 匹配字段键（TTE reason codes） */
  reasonCodes?: string[]
  /**
   * 命题转述行（Q1，已决策）：label 为 memory_note 字段短标签，text 为命题文本（≤200 字符）。
   * 仅命题命中的卡有此字段。
   */
  noteProvenanceLine?: { label: string; text: string }
  /** 候选排序位（TTE rank） */
  telemetryRank?: number
}

defineOptions({ name: 'RecallResultCard' })

const props = defineProps<{
  card: RecallCardModel
  resultDomId: string
  keyboardSelected: boolean
  topPick?: boolean
  compact?: boolean
  expanded: boolean
  expandLabel: string
  collapseLabel: string
  noteFieldLabel: string
  /** detail export 多选：点卡面切换选中 */
  showDetailExportSelection?: boolean
  detailExportItemSelected?: (memoryItemId: string) => boolean
  detailExportItemDisabled?: (memoryItemId: string) => boolean
}>()

const emit = defineEmits<{
  open: [payload: { id: string; url: string; openInNewTab: boolean; rank?: number }]
  toggleExpand: []
  evidenceVisible: [
    payload: {
      memoryItemId: string
      rank: number
      ecs: number
      reasonCodes?: string[]
      anchor?: string
    }
  ]
  toggleDetailExportSelection: [memoryItemId: string]
}>()

const isCollection = computed(() => (props.card.duplicateTotalCount ?? 0) >= 2)

const moreActionLabel = computed(() => (props.expanded ? props.collapseLabel : props.expandLabel))

const reasonAriaLabel = computed(() => {
  const reason = props.card.reasonLine?.trim()
  if (!reason) {
    return undefined
  }
  return t('recall_card_match_reason_aria', reason)
})

/** 书签角标用 Chrome 缓存 favicon；失败回退 Lucide bookmark。 */
const brokenFaviconIds = ref<ReadonlySet<string>>(new Set())

const kindIcon = computed<AppIconName>(() =>
  props.card.itemKind === 'bookmark' ? 'bookmark' : 'format_quote'
)

/** 书签悬停：完整标题 + 路径（单行省略时靠 title 读全量） */
const bookmarkNativeTitle = computed(() => {
  if (props.card.itemKind !== 'bookmark') {
    return undefined
  }
  const title = props.card.title.trim()
  const path = props.card.subtitle.trim()
  if (title && path) {
    return `${title}\n${path}`
  }
  return title || path || undefined
})

function kindIconFor(kind: RecallCardModel['itemKind']): AppIconName {
  return kind === 'bookmark' ? 'bookmark' : 'format_quote'
}

function bookmarkFaviconSrc(url: string): string {
  return getChromeFaviconUrl(url, 32)
}

function isCardFaviconBroken(id: string): boolean {
  return isFaviconBroken(brokenFaviconIds.value, id)
}

function markFaviconBroken(id: string): void {
  brokenFaviconIds.value = withBrokenFavicon(brokenFaviconIds.value, id)
}

function siblingNativeTitle(sibling: RecallCardModel): string | undefined {
  if (sibling.itemKind !== 'bookmark') {
    return undefined
  }
  const title = sibling.title.trim()
  const path = sibling.subtitle.trim()
  if (title && path) {
    return `${title}\n${path}`
  }
  return title || path || undefined
}

function handleOpen(event: MouseEvent, id: string, url: string, rank?: number): void {
  event.preventDefault()
  const action = resolveRecallCardClickAction({
    showDetailExportSelection: props.showDetailExportSelection,
    detailExportDisabled: isDetailExportItemDisabled(id),
    memoryItemId: id,
    url,
    ...(rank !== undefined ? { rank } : {}),
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey
  })

  if (action.type === 'noop') {
    return
  }
  if (action.type === 'toggle-export') {
    emit('toggleDetailExportSelection', action.memoryItemId)
    return
  }
  emit('open', action.payload)
}

function isDetailExportItemSelected(id: string): boolean {
  return props.detailExportItemSelected?.(id) === true
}

function isDetailExportItemDisabled(id: string): boolean {
  return props.detailExportItemDisabled?.(id) === true
}

const cardGroupRef = ref<HTMLElement | null>(null)
let stopEvidenceObserver: (() => void) | undefined

/** 悬停预览：延迟后出浮层；导出多选模式关闭；会话区滚动即收起 */
const hoverPreviewVisible = ref(false)
const hoverAnchorRect = ref<DOMRect | null>(null)
const hoverPanelRect = ref<DOMRect | null>(null)
const hoverPreviewController = createHoverPreviewDelayController()
/** 解绑会话区 scroll → 收起预览 */
let stopHoverPreviewScrollDismiss: (() => void) | undefined

function readHoverRects(): { anchor: DOMRect; panel: DOMRect } | null {
  const shell = cardGroupRef.value?.querySelector('.recall-card-shell') as HTMLElement | null
  const anchorEl = shell ?? cardGroupRef.value
  if (!anchorEl) {
    return null
  }
  const panelEl =
    (anchorEl.closest('.recall-shell') as HTMLElement | null) ?? document.documentElement
  return { anchor: anchorEl.getBoundingClientRect(), panel: panelEl.getBoundingClientRect() }
}

function detachHoverPreviewScrollDismiss(): void {
  stopHoverPreviewScrollDismiss?.()
  stopHoverPreviewScrollDismiss = undefined
}

/** 指针仍在卡上时滚轮也会滚列表；须靠 scroll 收起，不能只靠 pointerleave。 */
function dismissHoverPreview(): void {
  detachHoverPreviewScrollDismiss()
  hoverPreviewController.cancelAll()
  hoverPreviewVisible.value = false
  hoverAnchorRect.value = null
  hoverPanelRect.value = null
}

function attachHoverPreviewScrollDismiss(): void {
  detachHoverPreviewScrollDismiss()
  stopHoverPreviewScrollDismiss = bindHoverPreviewScrollDismiss(
    resolveRecallHoverPreviewScrollRoot(cardGroupRef.value),
    dismissHoverPreview
  )
}

function handlePreviewPointerEnter(): void {
  if (props.showDetailExportSelection) {
    return
  }
  // 延迟未出层时滚动也要取消：进入即绑 scroll
  attachHoverPreviewScrollDismiss()
  hoverPreviewController.enter(props.card.id, () => {
    const rects = readHoverRects()
    if (!rects) {
      return
    }
    hoverAnchorRect.value = rects.anchor
    hoverPanelRect.value = rects.panel
    hoverPreviewVisible.value = true
  })
}

function handlePreviewPointerLeave(): void {
  detachHoverPreviewScrollDismiss()
  hoverPreviewController.leave(props.card.id)
  hoverPreviewVisible.value = false
  hoverAnchorRect.value = null
  hoverPanelRect.value = null
}

/** 主卡正文/标题展开（本地态；勿复用 expanded prop——那是重复组兄弟列表） */
const isBodyExpanded = ref(false)
const isBodyTruncated = ref(false)
const bodyClampRef = ref<HTMLElement | null>(null)
let bodyResizeObserver: ResizeObserver | undefined

const showBodyExpandControl = computed(
  () => !props.showDetailExportSelection && (isBodyExpanded.value || isBodyTruncated.value)
)

/** 线夹 / 单行省略均可能截断：line-clamp 看高度，书签标题看宽度 */
function measureBodyTruncation(): void {
  const el = bodyClampRef.value
  if (!el) {
    isBodyTruncated.value = false
    return
  }
  if (isBodyExpanded.value) {
    return
  }
  isBodyTruncated.value = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth
}

function setupBodyClampObserver(): void {
  bodyResizeObserver?.disconnect()
  const el = bodyClampRef.value
  if (!el || typeof ResizeObserver === 'undefined') {
    return
  }
  bodyResizeObserver = new ResizeObserver(() => {
    measureBodyTruncation()
  })
  bodyResizeObserver.observe(el)
}

async function remountBodyClampMeasure(): Promise<void> {
  await nextTick()
  measureBodyTruncation()
  setupBodyClampObserver()
}

function handleToggleBodyExpand(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  isBodyExpanded.value = !isBodyExpanded.value
  if (!isBodyExpanded.value) {
    void remountBodyClampMeasure()
  }
}

onMounted(() => {
  stopEvidenceObserver = scheduleRecallEvidenceWhenVisible(
    () => cardGroupRef.value,
    () => {
      const payload = buildRecallEvidencePayload(props.card)
      if (payload) {
        emit('evidenceVisible', payload)
      }
    }
  )
  void remountBodyClampMeasure()
})

onUnmounted(() => {
  stopEvidenceObserver?.()
  bodyResizeObserver?.disconnect()
  dismissHoverPreview()
})

watch(
  () =>
    [
      props.card.id,
      props.card.excerpt,
      props.card.title,
      props.compact,
      props.card.itemKind
    ] as const,
  () => {
    isBodyExpanded.value = false
    void remountBodyClampMeasure()
  }
)

function handleMoreClick(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  emit('toggleExpand')
}

/** 摘录次要动作：开源站（默认新标签，保留 Side Panel）；不经详情页。 */
function handleOpenSource(event: MouseEvent, id: string, sourceUrl: string, rank?: number): void {
  event.preventDefault()
  event.stopPropagation()
  if (props.showDetailExportSelection) {
    return
  }
  emit('open', {
    id,
    url: sourceUrl,
    openInNewTab: true,
    ...(rank !== undefined ? { rank } : {})
  })
}
</script>

<template>
  <div
    ref="cardGroupRef"
    class="recall-card-group"
    :class="{
      'is-collection': isCollection,
      'is-expanded': expanded
    }"
  >
    <div
      class="recall-card-shell"
      :class="{
        'recall-card-shell--top': topPick,
        'recall-card-shell--excerpt': card.itemKind === 'text_excerpt',
        'recall-card-shell--bookmark': card.itemKind === 'bookmark',
        'recall-card-shell--detail-export-mode': showDetailExportSelection,
        'recall-card-shell--detail-export-selected':
          showDetailExportSelection && isDetailExportItemSelected(card.id),
        'recall-card-shell--has-open-source':
          card.itemKind === 'text_excerpt' && Boolean(card.sourceUrl) && !showDetailExportSelection,
        'recall-card-shell--has-expand': showBodyExpandControl,
        'is-keyboard-selected': keyboardSelected
      }"
      @pointerenter="handlePreviewPointerEnter"
      @pointerleave="handlePreviewPointerLeave"
    >
      <span
        v-if="showDetailExportSelection && isDetailExportItemSelected(card.id)"
        class="recall-card-selected-mark"
        aria-hidden="true"
      >
        <AppIcon name="check_circle" size="16px" />
      </span>
      <span
        class="recall-type-chip recall-type-chip--corner"
        :class="
          card.itemKind === 'bookmark' ? 'recall-type-chip--bookmark' : 'recall-type-chip--excerpt'
        "
        :title="card.typeLabel"
        :aria-label="card.typeLabel"
      >
        <img
          v-if="card.itemKind === 'bookmark' && card.url && !isCardFaviconBroken(card.id)"
          class="recall-card-favicon"
          :src="bookmarkFaviconSrc(card.url)"
          alt=""
          width="14"
          height="14"
          loading="lazy"
          decoding="async"
          @error="markFaviconBroken(card.id)"
        />
        <AppIcon v-else :name="kindIcon" size="14px" />
        <span class="recall-type-chip__label">{{ card.typeLabel }}</span>
      </span>

      <a
        :id="resultDomId"
        class="recall-card"
        :class="{
          'recall-card--compact': compact,
          'recall-card--has-more': isCollection,
          'recall-card--excerpt': card.itemKind === 'text_excerpt',
          'recall-card--bookmark': card.itemKind === 'bookmark',
          'recall-card--detail-export-mode': showDetailExportSelection
        }"
        :href="card.url"
        :title="bookmarkNativeTitle"
        rel="noopener noreferrer"
        :aria-selected="showDetailExportSelection ? isDetailExportItemSelected(card.id) : undefined"
        @click="handleOpen($event, card.id, card.url, card.telemetryRank)"
      >
        <!-- 摘录：正文 → 出处+时间同排 → 附注 → 理由；书签：标题 → 附注 → 理由 → 域名+时间同排 -->
        <p
          v-if="card.excerpt"
          ref="bodyClampRef"
          class="recall-card-body"
          :class="{
            'recall-card-body--compact': compact,
            'recall-card-body--expanded': isBodyExpanded
          }"
        >
          <RecallHighlightText :parts="card.excerptParts" />
        </p>
        <component
          :is="topPick ? 'h2' : 'h3'"
          v-else
          ref="bodyClampRef"
          class="recall-card-title"
          :class="{
            'recall-card-title--compact': compact,
            'recall-card-title--expanded': isBodyExpanded
          }"
          :title="card.itemKind === 'bookmark' ? card.title : undefined"
        >
          <RecallHighlightText :parts="card.titleParts" />
        </component>
        <p
          v-if="card.noteProvenanceLine"
          class="recall-card-note"
          :class="{ 'recall-card-note--compact': compact }"
        >
          <span class="recall-card-note-label">{{ card.noteProvenanceLine.label }}</span>
          {{ card.noteProvenanceLine.text }}
        </p>
        <div
          v-if="card.itemKind === 'text_excerpt' && card.subtitle"
          class="recall-card-provenance-row"
          :class="{ 'recall-card-provenance-row--compact': compact }"
        >
          <p class="recall-card-subtitle recall-card-subtitle--provenance" :title="card.subtitle">
            <span class="recall-card-subtitle-text">
              <RecallHighlightText :parts="card.subtitleParts" />
            </span>
          </p>
          <p v-if="card.savedAtLabel" class="recall-card-saved recall-card-saved--inline">
            <time :datetime="card.savedAtIso" :title="card.savedAtTitle">{{
              card.savedAtLabel
            }}</time>
          </p>
        </div>
        <p
          v-if="card.note"
          class="recall-card-note"
          :class="{ 'recall-card-note--compact': compact }"
        >
          <span class="recall-card-note-label">{{ noteFieldLabel }}</span>
          <RecallHighlightText :parts="card.noteParts" />
        </p>
        <p
          v-if="card.reasonLine"
          class="recall-card-reason"
          :class="{ 'recall-card-reason--compact': compact }"
          :aria-label="reasonAriaLabel"
        >
          {{ card.reasonLine }}
        </p>
        <div
          v-if="card.itemKind === 'bookmark'"
          class="recall-card-provenance-row"
          :class="{ 'recall-card-provenance-row--compact': compact }"
        >
          <p class="recall-card-subtitle" :title="card.subtitle || undefined">
            <span class="recall-card-subtitle-text">
              <RecallHighlightText :parts="card.subtitleParts" />
            </span>
          </p>
          <p v-if="card.savedAtLabel" class="recall-card-saved recall-card-saved--inline">
            <time :datetime="card.savedAtIso" :title="card.savedAtTitle">{{
              card.savedAtLabel
            }}</time>
          </p>
        </div>
      </a>

      <!-- 正文/标题展开：在 <a> 外，避免可交互嵌套；仅截断时出现 -->
      <button
        v-if="showBodyExpandControl"
        type="button"
        class="recall-card-body-expand"
        :aria-expanded="isBodyExpanded"
        :title="isBodyExpanded ? t('recall_card_body_collapse') : t('recall_card_body_expand')"
        :aria-label="isBodyExpanded ? t('recall_card_body_collapse') : t('recall_card_body_expand')"
        @click="handleToggleBodyExpand"
      >
        {{ isBodyExpanded ? t('recall_card_body_collapse') : t('recall_card_body_expand') }}
      </button>

      <!-- 次要热区：在 <a> 外，避免可交互嵌套；减「详情再点打开原文」一步 -->
      <button
        v-if="
          card.itemKind === 'text_excerpt' &&
          card.sourceUrl &&
          isOpenableExternalSourceUrl(card.sourceUrl) &&
          !showDetailExportSelection
        "
        type="button"
        class="recall-card-open-source"
        :title="t('detail_open_source')"
        :aria-label="t('detail_open_source')"
        @click="handleOpenSource($event, card.id, card.sourceUrl, card.telemetryRank)"
      >
        <AppIcon name="open_in_new" size="14px" />
        <span>{{ t('detail_open_source') }}</span>
      </button>
      <button
        v-if="isCollection"
        type="button"
        class="recall-duplicate-more"
        :title="card.duplicateLabel ?? moreActionLabel"
        :aria-label="moreActionLabel"
        :aria-expanded="expanded"
        @click="handleMoreClick"
      >
        <AppIcon name="stacks" size="16px" />
        <span class="recall-duplicate-more-count">{{ card.duplicateTotalCount }}</span>
      </button>
    </div>

    <ul
      v-if="expanded && isCollection && card.siblings && card.siblings.length > 0"
      class="recall-duplicate-siblings"
    >
      <li
        v-for="sibling in card.siblings"
        :key="sibling.id"
        class="recall-sibling-item"
        :class="{
          'recall-sibling-item--detail-export-selected':
            showDetailExportSelection && isDetailExportItemSelected(sibling.id),
          'recall-sibling-item--has-open-source':
            sibling.itemKind === 'text_excerpt' &&
            Boolean(sibling.sourceUrl) &&
            !showDetailExportSelection
        }"
      >
        <span
          class="recall-type-chip recall-type-chip--corner"
          :class="
            sibling.itemKind === 'bookmark'
              ? 'recall-type-chip--bookmark'
              : 'recall-type-chip--excerpt'
          "
          :title="sibling.typeLabel"
          :aria-label="sibling.typeLabel"
        >
          <img
            v-if="
              sibling.itemKind === 'bookmark' && sibling.url && !isCardFaviconBroken(sibling.id)
            "
            class="recall-card-favicon"
            :src="bookmarkFaviconSrc(sibling.url)"
            alt=""
            width="14"
            height="14"
            loading="lazy"
            decoding="async"
            @error="markFaviconBroken(sibling.id)"
          />
          <AppIcon v-else :name="kindIconFor(sibling.itemKind)" size="14px" />
          <span class="recall-type-chip__label">{{ sibling.typeLabel }}</span>
        </span>
        <a
          class="recall-card recall-card--sibling"
          :class="{
            'recall-card--excerpt': sibling.itemKind === 'text_excerpt',
            'recall-card--bookmark': sibling.itemKind === 'bookmark',
            'recall-card--detail-export-mode': showDetailExportSelection
          }"
          :href="sibling.url"
          :title="siblingNativeTitle(sibling)"
          rel="noopener noreferrer"
          :aria-selected="
            showDetailExportSelection ? isDetailExportItemSelected(sibling.id) : undefined
          "
          @click="handleOpen($event, sibling.id, sibling.url, sibling.telemetryRank)"
        >
          <p v-if="sibling.excerpt" class="recall-card-body recall-card-body--compact">
            <RecallHighlightText :parts="sibling.excerptParts" />
          </p>
          <h3
            v-else
            class="recall-card-title recall-card-title--compact"
            :title="sibling.itemKind === 'bookmark' ? sibling.title : undefined"
          >
            <RecallHighlightText :parts="sibling.titleParts" />
          </h3>
          <div
            v-if="sibling.itemKind === 'text_excerpt' && sibling.subtitle"
            class="recall-card-provenance-row recall-card-provenance-row--compact"
          >
            <p
              class="recall-card-subtitle recall-card-subtitle--provenance recall-card-subtitle--compact"
              :title="sibling.subtitle"
            >
              <span class="recall-card-subtitle-text">
                <RecallHighlightText :parts="sibling.subtitleParts" />
              </span>
            </p>
            <p
              v-if="sibling.savedAtLabel"
              class="recall-card-saved recall-card-saved--inline recall-card-saved--compact"
            >
              <time :datetime="sibling.savedAtIso" :title="sibling.savedAtTitle">
                {{ sibling.savedAtLabel }}
              </time>
            </p>
          </div>
          <p v-if="sibling.note" class="recall-card-note recall-card-note--compact">
            <span class="recall-card-note-label">{{ noteFieldLabel }}</span>
            <RecallHighlightText :parts="sibling.noteParts" />
          </p>
          <p
            v-if="sibling.reasonLine"
            class="recall-card-reason recall-card-reason--compact"
            :aria-label="
              sibling.reasonLine
                ? t('recall_card_match_reason_aria', sibling.reasonLine)
                : undefined
            "
          >
            {{ sibling.reasonLine }}
          </p>
          <div
            v-if="sibling.itemKind === 'bookmark'"
            class="recall-card-provenance-row recall-card-provenance-row--compact"
          >
            <p class="recall-card-subtitle" :title="sibling.subtitle || undefined">
              <span class="recall-card-subtitle-text">
                <RecallHighlightText :parts="sibling.subtitleParts" />
              </span>
            </p>
            <p
              v-if="sibling.savedAtLabel"
              class="recall-card-saved recall-card-saved--inline recall-card-saved--compact"
            >
              <time :datetime="sibling.savedAtIso" :title="sibling.savedAtTitle">
                {{ sibling.savedAtLabel }}
              </time>
            </p>
          </div>
        </a>
        <button
          v-if="
            sibling.itemKind === 'text_excerpt' &&
            sibling.sourceUrl &&
            isOpenableExternalSourceUrl(sibling.sourceUrl) &&
            !showDetailExportSelection
          "
          type="button"
          class="recall-card-open-source recall-card-open-source--sibling"
          :title="t('detail_open_source')"
          :aria-label="t('detail_open_source')"
          @click="
            sibling.sourceUrl
              ? handleOpenSource($event, sibling.id, sibling.sourceUrl, sibling.telemetryRank)
              : undefined
          "
        >
          <AppIcon name="open_in_new" size="14px" />
          <span>{{ t('detail_open_source') }}</span>
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <RecallCardHoverPreview
        :card="card"
        :visible="hoverPreviewVisible"
        :anchor-rect="hoverAnchorRect"
        :panel-rect="hoverPanelRect"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.recall-card-group {
  display: grid;
  gap: var(--space-xs);
  min-width: 0;
  max-width: 100%;
  content-visibility: auto;
  contain-intrinsic-size: auto 5.25rem;
}

.recall-card-shell {
  position: relative;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

.recall-card-shell--detail-export-mode .recall-card {
  cursor: pointer;
}

.recall-card-shell--detail-export-selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
  background: var(--surface-accent-soft);
}

.recall-card-selected-mark {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  z-index: 2;
  display: inline-flex;
  color: var(--yiveno-semantic-success);
  pointer-events: none;
}

/*
 * 邻域卡壳：书签/摘录同底同描边同 hover，避免类型染色造成斑马纹与双套交互态。
 * 类型区分靠角标（quote / favicon）+ 微文字 + 内容形；摘录另加 1px 左侧 accent（非整卡铺色）。
 */
.recall-card-shell--bookmark,
.recall-card-shell--excerpt {
  border-color: var(--border);
  background: var(--surface-white);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 6%, transparent);
}

.recall-card-shell--excerpt {
  box-shadow:
    inset 1px 0 0 color-mix(in srgb, var(--accent) 55%, var(--border)),
    0 1px 2px color-mix(in srgb, var(--ink) 6%, transparent);
}

/*
 * Top Pick：仅视觉略强调（产品 §0.1.1）；禁止「就是它 / most likely」文案。
 * 不用左侧加粗轨（易读成引用条/选中态，单卡时尤吵）→ 一圈细 accent 描边 + 浅底 wash。
 * 弱于键盘选中（inset 2px ring）；摘录类型仍保留自有 ≤1px 左轨，不叠厚。
 */
.recall-card-shell--top {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--border));
  background: color-mix(in srgb, var(--surface-accent-soft) 70%, var(--surface-white));
  box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 7%, transparent);
}

.recall-card-shell--top.recall-card-shell--excerpt {
  box-shadow:
    inset 1px 0 0 color-mix(in srgb, var(--accent) 55%, var(--border)),
    0 1px 3px color-mix(in srgb, var(--ink) 7%, transparent);
}

.recall-card-shell--top:hover {
  background: color-mix(in srgb, var(--surface-accent-soft) 55%, var(--surface-chrome));
}

.recall-card-shell.is-keyboard-selected {
  /* 用内描边，避免 outline-offset 被 .recall-body overflow 裁切 */
  border-color: var(--accent);
  box-shadow: inset 0 0 0 2px var(--accent);
  background: var(--surface-accent-soft);
}

.recall-card-shell--bookmark:hover,
.recall-card-shell--excerpt:hover {
  background: var(--surface-chrome);
}

.recall-card-shell.is-keyboard-selected:hover {
  background: var(--surface-accent-soft);
}

.recall-card {
  display: block;
  min-width: 0;
  max-width: 100%;
  padding: var(--space-sm);
  text-decoration: none;
  color: inherit;
  background: transparent;
}

.recall-card--excerpt {
  /* 引文感：正文略内缩；左侧类型靠角标 + shell 1px accent */
  padding-left: var(--space-md);
}

/* 书签：标题 / URL 单行省略；完整内容靠原生 title；展开后见 --expanded */
.recall-card--bookmark .recall-card-title {
  margin: 0 0 var(--space-2xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recall-card--bookmark .recall-card-title--expanded {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}

.recall-card--bookmark .recall-card-subtitle {
  min-width: 0;
  margin-top: 2px;
  overflow: hidden;
}

.recall-card--bookmark .recall-card-subtitle-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recall-card--has-more {
  /* 给右上角 stacks 控件留空，避免与类型/标题重叠 */
  padding-right: 2.75rem;
}

.recall-card--sibling {
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 5%, transparent);
}

.recall-card--sibling.recall-card--excerpt {
  box-shadow:
    inset 1px 0 0 color-mix(in srgb, var(--accent) 55%, var(--border)),
    0 1px 2px color-mix(in srgb, var(--ink) 5%, transparent);
}

.recall-card--sibling:hover,
.recall-card--sibling.recall-card--excerpt:hover {
  background: var(--surface-chrome);
}

.recall-sibling-item {
  position: relative;
  min-width: 0;
}

.recall-sibling-item--has-open-source > .recall-card {
  /* 与主卡 pill「Open original」同宽右留白，避免盖住域名/正文 */
  padding-right: 9rem;
}

.recall-sibling-item--detail-export-selected > .recall-card {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.recall-type-chip {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2xs);
  width: auto;
  min-height: 24px;
  padding: 0 var(--space-xs);
  border-radius: var(--radius-full);
  line-height: 1;
}

/* 角落种类标记：不占文档流高度；图标 + 可见 typeLabel 微文字 */
.recall-type-chip--corner {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  z-index: 1;
  pointer-events: none;
}

.recall-type-chip__label {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.recall-type-chip--bookmark {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--surface-chrome) 88%, var(--surface-white));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 80%, transparent);
}

.recall-type-chip .app-icon,
.recall-card-favicon {
  flex-shrink: 0;
}

.recall-card-favicon {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;
  border-radius: var(--radius-xs);
}

.recall-type-chip--excerpt {
  color: var(--accent);
  background: color-mix(in srgb, var(--surface-white) 70%, var(--surface-accent-soft));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

/*
 * 主卡 / sibling 为角标 pill 让出左侧，避免压住标题首字。
 * pill 宽含 en「Text excerpt」（12 字符 caption）；约 120px 起跳。
 */
.recall-card-shell:has(> .recall-type-chip--corner) > .recall-card {
  padding-left: calc(var(--space-3xl) + var(--space-xl) + var(--space-lg));
}

.recall-sibling-item:has(> .recall-type-chip--corner) > .recall-card {
  padding-left: calc(var(--space-3xl) + var(--space-xl) + var(--space-md));
}

.recall-card-title {
  margin: 0 0 var(--space-2xs);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-snug);
  overflow-wrap: anywhere;
}

.recall-card-title--compact {
  font-size: var(--text-body);
}

.recall-card-body {
  display: -webkit-box;
  margin: 0 0 var(--space-2xs);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface);
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
}

.recall-card--excerpt .recall-card-body {
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

.recall-card-body--compact {
  font-size: var(--text-meta);
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.recall-card-body--expanded {
  display: block;
  -webkit-line-clamp: unset;
  line-clamp: unset;
  overflow: visible;
}

.recall-card-note {
  display: -webkit-box;
  margin: 0 0 var(--space-2xs);
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--on-surface);
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.recall-card-note--compact {
  font-size: var(--text-caption);
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.recall-card-note-label {
  margin-right: var(--space-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--accent);
}

.recall-card-reason {
  display: -webkit-box;
  margin: 0 0 var(--space-2xs);
  font-size: var(--text-meta);
  line-height: var(--leading-relaxed);

  /* 与出处 .recall-card-subtitle--provenance 同级 78%，扫读「为何贴合」不糊成灰墙 */
  color: color-mix(in srgb, var(--on-surface) 78%, var(--on-surface-muted));
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.recall-card-reason--compact {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.recall-card-subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  margin: 0;
  font-size: var(--text-caption);
  color: var(--on-surface-muted);
  overflow-wrap: anywhere;
}

/* 出处/域名 + 时间同排：摘录出处（--provenance）或书签域名（caption muted）左，时间右 */
.recall-card-provenance-row {
  display: flex;
  align-items: center;
  gap: var(--space-2xs) var(--space-xs);
  min-width: 0;
  margin: 0 0 var(--space-2xs);
}

.recall-card-provenance-row--compact {
  margin-bottom: var(--space-2xs);
}

.recall-card-provenance-row > .recall-card-subtitle {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
}

.recall-card-subtitle--provenance {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  color: color-mix(in srgb, var(--on-surface) 78%, var(--on-surface-muted));
  overflow: hidden;
}

.recall-card-subtitle--provenance .recall-card-subtitle-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recall-card-subtitle--compact {
  font-size: var(--text-caption);
}

.recall-card-subtitle-text {
  min-width: 0;
}

.recall-card-saved {
  margin: var(--space-2xs) 0 0;
  font-size: var(--text-caption);
  line-height: var(--leading-snug);
  color: var(--on-surface-muted);
}

.recall-card-saved--inline {
  flex: 0 0 auto;
  margin: 0;
  white-space: nowrap;
}

.recall-card-saved--compact {
  font-size: var(--text-caption);
}

.recall-card-saved time {
  font: inherit;
  color: inherit;
}

.recall-card-shell--has-open-source > .recall-card {
  /* 容纳英文最长「Open original」pill + 余量 */
  padding-right: 9rem;
}

.recall-card-shell--has-expand > .recall-card {
  padding-bottom: calc(var(--space-sm) + 2rem);
}

.recall-card-body-expand {
  position: absolute;
  bottom: var(--space-xs);
  left: var(--space-xs);
  z-index: 1;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: 2rem;
  margin: 0;
  padding: 0 var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-meta);
  white-space: nowrap;
  color: var(--on-surface);
  background: var(--surface-chrome);
  cursor: pointer;
}

.recall-card-body-expand:hover {
  background: color-mix(in srgb, var(--surface-chrome) 80%, var(--sage-muted) 20%);
}

.recall-card-body-expand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-card-open-source {
  position: absolute;
  right: var(--space-xs);
  bottom: var(--space-xs);
  z-index: 1;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2xs);
  min-height: 2rem;
  margin: 0;
  padding: 0 var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-meta);
  white-space: nowrap;
  color: var(--on-surface);
  background: var(--surface-chrome);
  cursor: pointer;
}

.recall-card-open-source:hover {
  background: color-mix(in srgb, var(--surface-chrome) 80%, var(--sage-muted) 20%);
}

.recall-card-open-source:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-card-open-source--sibling {
  bottom: var(--space-xs);
}

.recall-duplicate-more {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  z-index: 1;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1px;
  min-width: 1.75rem;
  margin: 0;
  padding: var(--space-2xs) var(--space-2xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  color: var(--on-surface);
  background: var(--surface-chrome);
  cursor: pointer;
}

.recall-duplicate-more:hover {
  background: color-mix(in srgb, var(--surface-chrome) 80%, var(--sage-muted) 20%);
}

.recall-duplicate-more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-card-group.is-expanded .recall-duplicate-more {
  border-color: var(--accent);
}

.recall-duplicate-more-count {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.recall-duplicate-siblings {
  display: grid;
  gap: var(--space-xs);

  /* 约 5 条 sibling；超出内部滚动，避免撑破 Side Panel 可视区 */
  max-height: calc(5 * 5.25rem + 4 * var(--space-xs));
  margin: 0;
  padding: 0;
  animation: recall-siblings-enter var(--motion-duration-short) var(--motion-easing-standard) both;
  overflow: hidden auto;
  list-style: none;
  overscroll-behavior: contain;
}

@keyframes recall-siblings-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recall-duplicate-siblings {
    animation: none;
  }
}
</style>
