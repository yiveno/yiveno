<script setup lang="ts">
import { computed } from 'vue'

import type { RecallHighlightPart } from '@/core/recall/highlight-recall-text'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'
import RecallHighlightText from '@/pages/sidepanel/RecallHighlightText.vue'

/** 找回结果卡展示模型（含可选折叠组）。 */
export interface RecallCardModel {
  id: string
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
        'is-keyboard-selected': keyboardSelected
      }"
    >
      <a
        :id="resultDomId"
        class="recall-card"
        :class="{
          'recall-card--compact': compact,
          'recall-card--has-more': isCollection
        }"
        :href="card.url"
        target="_blank"
        rel="noopener noreferrer"
        @click="handleOpen(card.id, card.url)"
      >
        <div class="recall-card-meta">
          <span class="recall-type">{{ card.typeLabel }}</span>
        </div>
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
        <p class="recall-card-subtitle">
          <RecallHighlightText :parts="card.subtitleParts" />
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
      <li v-for="sibling in card.siblings" :key="sibling.id">
        <a
          class="recall-card recall-card--sibling"
          :href="sibling.url"
          target="_blank"
          rel="noopener noreferrer"
          @click="handleOpen(sibling.id, sibling.url)"
        >
          <div class="recall-card-meta">
            <span class="recall-type">{{ sibling.typeLabel }}</span>
          </div>
          <p v-if="sibling.excerpt" class="recall-card-body recall-card-body--compact">
            <RecallHighlightText :parts="sibling.excerptParts" />
          </p>
          <h3 v-else class="recall-card-title recall-card-title--compact">
            <RecallHighlightText :parts="sibling.titleParts" />
          </h3>
          <p v-if="sibling.note" class="recall-card-note recall-card-note--compact">
            <span class="recall-card-note-label">{{ noteFieldLabel }}</span>
            <RecallHighlightText :parts="sibling.noteParts" />
          </p>
          <p class="recall-card-subtitle">
            <RecallHighlightText :parts="sibling.subtitleParts" />
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

.recall-card-shell--top {
  border-color: var(--accent);
}

.recall-card-shell.is-keyboard-selected {
  /* 用内描边，避免 outline-offset 被 .recall-body overflow 裁切 */
  border-color: var(--accent);
  box-shadow: inset 0 0 0 2px var(--accent);
  background: var(--surface-accent-soft);
}

.recall-card-shell:hover {
  background: var(--surface-chrome);
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

.recall-card--sibling:hover {
  background: var(--surface-chrome);
}

.recall-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.recall-type {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
}

.recall-card-title {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.recall-card-title--compact {
  font-size: 14px;
}

.recall-card-body {
  display: -webkit-box;
  margin: 0 0 4px;
  font-size: 15px;
  line-height: 1.45;
  color: var(--on-surface);
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
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
  margin: 0;
  font-size: 12px;
  color: var(--on-surface-muted);
  overflow-wrap: anywhere;
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
