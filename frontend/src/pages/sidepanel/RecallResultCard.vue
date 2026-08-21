<script setup lang="ts">
import { computed } from 'vue'

import type { RecallHighlightPart } from '@/core/recall/highlight-recall-text'
import type { MaterialSymbolName } from '@/infrastructure/ui/icons/material-symbol'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'
import RecallHighlightText from '@/pages/sidepanel/RecallHighlightText.vue'

/** 找回结果卡展示模型（含可选折叠组）。 */
export interface RecallCardModel {
  id: string
  /** 条目种类：驱动摘录 / 书签两套视觉 */
  itemKind: 'bookmark' | 'text_excerpt'
  title: string
  subtitle: string
  url: string
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
}>()

const emit = defineEmits<{
  open: [payload: { id: string; url: string }]
  toggleExpand: []
}>()

const isCollection = computed(() => (props.card.duplicateTotalCount ?? 0) >= 2)

const moreActionLabel = computed(() => (props.expanded ? props.collapseLabel : props.expandLabel))

const kindIcon = computed<MaterialSymbolName>(() =>
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

function kindIconFor(kind: RecallCardModel['itemKind']): MaterialSymbolName {
  return kind === 'bookmark' ? 'bookmark' : 'format_quote'
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

function handleOpen(id: string, url: string): void {
  emit('open', { id, url })
}

function handleMoreClick(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  emit('toggleExpand')
}
</script>

<template>
  <div
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
        'is-keyboard-selected': keyboardSelected
      }"
    >
      <span
        class="recall-type-chip recall-type-chip--corner"
        :class="
          card.itemKind === 'bookmark' ? 'recall-type-chip--bookmark' : 'recall-type-chip--excerpt'
        "
        :title="card.typeLabel"
        :aria-label="card.typeLabel"
      >
        <MaterialSymbolIcon :name="kindIcon" size="14px" />
      </span>

      <a
        :id="resultDomId"
        class="recall-card"
        :class="{
          'recall-card--compact': compact,
          'recall-card--has-more': isCollection,
          'recall-card--excerpt': card.itemKind === 'text_excerpt',
          'recall-card--bookmark': card.itemKind === 'bookmark'
        }"
        :href="card.url"
        :title="bookmarkNativeTitle"
        target="_blank"
        rel="noopener noreferrer"
        @click="handleOpen(card.id, card.url)"
      >
        <p
          v-if="card.excerpt"
          class="recall-card-body"
          :class="{ 'recall-card-body--compact': compact }"
        >
          <RecallHighlightText :parts="card.excerptParts" />
        </p>
        <component
          :is="topPick ? 'h2' : 'h3'"
          v-else
          class="recall-card-title"
          :class="{ 'recall-card-title--compact': compact }"
          :title="card.itemKind === 'bookmark' ? card.title : undefined"
        >
          <RecallHighlightText :parts="card.titleParts" />
        </component>
        <p
          v-if="card.note"
          class="recall-card-note"
          :class="{ 'recall-card-note--compact': compact }"
        >
          <span class="recall-card-note-label">{{ noteFieldLabel }}</span>
          <RecallHighlightText :parts="card.noteParts" />
        </p>
        <p
          class="recall-card-subtitle"
          :title="card.itemKind === 'bookmark' ? card.subtitle : undefined"
        >
          <MaterialSymbolIcon
            v-if="card.itemKind === 'bookmark'"
            class="recall-card-subtitle-icon"
            name="open_in_new"
            size="12px"
          />
          <span class="recall-card-subtitle-text">
            <RecallHighlightText :parts="card.subtitleParts" />
          </span>
        </p>
      </a>

      <button
        v-if="isCollection"
        type="button"
        class="recall-duplicate-more"
        :title="card.duplicateLabel ?? moreActionLabel"
        :aria-label="moreActionLabel"
        :aria-expanded="expanded"
        @click="handleMoreClick"
      >
        <MaterialSymbolIcon name="stacks" size="16px" />
        <span class="recall-duplicate-more-count">{{ card.duplicateTotalCount }}</span>
      </button>
    </div>

    <ul
      v-if="expanded && isCollection && card.siblings && card.siblings.length > 0"
      class="recall-duplicate-siblings"
    >
      <li v-for="sibling in card.siblings" :key="sibling.id" class="recall-sibling-item">
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
          <MaterialSymbolIcon :name="kindIconFor(sibling.itemKind)" size="14px" />
        </span>
        <a
          class="recall-card recall-card--sibling"
          :class="{
            'recall-card--excerpt': sibling.itemKind === 'text_excerpt',
            'recall-card--bookmark': sibling.itemKind === 'bookmark'
          }"
          :href="sibling.url"
          :title="siblingNativeTitle(sibling)"
          target="_blank"
          rel="noopener noreferrer"
          @click="handleOpen(sibling.id, sibling.url)"
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
          <p v-if="sibling.note" class="recall-card-note recall-card-note--compact">
            <span class="recall-card-note-label">{{ noteFieldLabel }}</span>
            <RecallHighlightText :parts="sibling.noteParts" />
          </p>
          <p
            class="recall-card-subtitle"
            :title="sibling.itemKind === 'bookmark' ? sibling.subtitle : undefined"
          >
            <MaterialSymbolIcon
              v-if="sibling.itemKind === 'bookmark'"
              class="recall-card-subtitle-icon"
              name="open_in_new"
              size="12px"
            />
            <span class="recall-card-subtitle-text">
              <RecallHighlightText :parts="sibling.subtitleParts" />
            </span>
          </p>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.recall-card-group {
  display: grid;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.recall-card-shell {
  position: relative;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

/* 书签：干净白底 + 略强描边，像「可打开的链接页」 */
.recall-card-shell--bookmark {
  border-color: color-mix(in srgb, var(--border) 70%, var(--charcoal) 30%);
  background: var(--surface-white);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 6%, transparent);
}

/* 摘录：浅 sage 底，像「从页里撕下的引文」 */
.recall-card-shell--excerpt {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  background: var(--surface-accent-soft);
}

.recall-card-shell--top {
  border-color: var(--accent);
}

.recall-card-shell.is-keyboard-selected {
  /* 用内描边，避免 outline-offset 被 .recall-body overflow 裁切 */
  border-color: var(--accent);
  box-shadow: inset 0 0 0 2px var(--accent);
  background: var(--surface-accent-soft);
}

.recall-card-shell--bookmark:hover {
  background: var(--surface-chrome);
}

.recall-card-shell--excerpt:hover {
  background: color-mix(in srgb, var(--surface-accent-soft) 72%, var(--surface-white));
}

.recall-card-shell.is-keyboard-selected:hover {
  background: var(--surface-accent-soft);
}

.recall-card {
  display: block;
  min-width: 0;
  max-width: 100%;
  padding: 12px;
  text-decoration: none;
  color: inherit;
  background: transparent;
}

.recall-card--excerpt {
  /* 引文感：正文略内缩，左侧 1px accent（不超过 craft 对粗色条的禁令） */
  padding-left: 14px;
  border-left: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
}

/* 书签：标题 / URL 单行省略；完整内容靠原生 title */
.recall-card--bookmark .recall-card-title {
  margin: 0 0 4px;
  overflow: hidden;
  font-weight: 700;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recall-card--bookmark .recall-card-subtitle {
  min-width: 0;
  margin-top: 2px;
  overflow: hidden;
}

.recall-card--bookmark .recall-card-subtitle-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recall-card--has-more {
  /* 给右上角 stacks 控件留空，避免与类型/标题重叠 */
  padding-right: 2.75rem;
}

.recall-card--sibling {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

.recall-card--sibling.recall-card--excerpt {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  background: var(--surface-accent-soft);
}

.recall-card--sibling.recall-card--bookmark {
  border-color: color-mix(in srgb, var(--border) 70%, var(--charcoal) 30%);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 5%, transparent);
}

.recall-card--sibling:hover {
  background: var(--surface-chrome);
}

.recall-card--sibling.recall-card--excerpt:hover {
  background: color-mix(in srgb, var(--surface-accent-soft) 72%, var(--surface-white));
}

.recall-sibling-item {
  position: relative;
  min-width: 0;
}

.recall-type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 999px;
  line-height: 1;
}

/* 角落种类标记：不占文档流高度 */
.recall-type-chip--corner {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
  pointer-events: none;
}

.recall-type-chip--bookmark {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--surface-chrome) 88%, var(--surface-white));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 80%, transparent);
}

.recall-type-chip--excerpt {
  color: var(--accent);
  background: color-mix(in srgb, var(--surface-white) 70%, var(--surface-accent-soft));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

/* 主卡 / sibling 为角标让出左侧，避免压住标题首字 */
.recall-card-shell:has(> .recall-type-chip--corner) > .recall-card {
  padding-left: 40px;
}

.recall-sibling-item:has(> .recall-type-chip--corner) > .recall-card {
  padding-left: 38px;
}

.recall-card-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.recall-card-title--compact {
  font-size: 14px;
}

.recall-card-body {
  display: -webkit-box;
  margin: 0 0 6px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--on-surface);
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
}

.recall-card--excerpt .recall-card-body {
  font-size: 15px;
  line-height: 1.55;
}

.recall-card-body--compact {
  font-size: 13px;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.recall-card-note {
  display: -webkit-box;
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface);
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.recall-card-note--compact {
  font-size: 12px;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.recall-card-note-label {
  margin-right: 4px;
  font-weight: 600;
  color: var(--accent);
}

.recall-card-subtitle {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 12px;
  color: var(--on-surface-muted);
  overflow-wrap: anywhere;
}

.recall-card-subtitle-icon {
  flex-shrink: 0;
  color: var(--on-surface-muted);
  opacity: 0.85;
}

.recall-card-subtitle-text {
  min-width: 0;
}

.recall-duplicate-more {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1px;
  min-width: 1.75rem;
  margin: 0;
  padding: 4px 6px;
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
  outline-offset: 1px;
}

.recall-card-group.is-expanded .recall-duplicate-more {
  border-color: var(--accent);
}

.recall-duplicate-more-count {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.recall-duplicate-siblings {
  display: grid;
  gap: 6px;

  /* 约 5 条 sibling；超出内部滚动，避免撑破 Popup */
  max-height: calc(5 * 5.25rem + 4 * 6px);
  margin: 0;
  padding: 0;
  overflow: hidden auto;
  list-style: none;
  overscroll-behavior: contain;
}
</style>
