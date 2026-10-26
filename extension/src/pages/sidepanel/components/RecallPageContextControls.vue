<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import AppHoverTip from '@/infrastructure/ui/AppHoverTip.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'

defineOptions({ name: 'RecallPageContextControls' })

const props = defineProps<{
  /** 当前浏览页域名；内置页 / 新标签时为空，图标仍显示 */
  domain: string | null
  combineWithPage: boolean
  onlyThisSite: boolean
  /** 来源范围；默认 all */
  sourceScope: 'all' | 'text_excerpt' | 'bookmark'
  expanded: boolean
  disabled?: boolean
  toggleLabel: string
  dismissLabel: string
  combineLabel: string
  combineHint: string
  onlySiteLabel: string
  onlySiteHint: string
  noSiteHint: string
  sourceAllLabel: string
  sourceAllHint: string
  sourceExcerptsLabel: string
  sourceExcerptsHint: string
  sourceBookmarksLabel: string
  sourceBookmarksHint: string
}>()

const emit = defineEmits<{
  'update:expanded': [value: boolean]
  'update:combineWithPage': [value: boolean]
  'update:onlyThisSite': [value: boolean]
  'update:sourceScope': [value: 'all' | 'text_excerpt' | 'bookmark']
}>()

const hasActiveOption = computed(
  () =>
    (Boolean(props.domain) && (props.combineWithPage || props.onlyThisSite)) ||
    props.sourceScope !== 'all'
)

const pageUnavailable = computed(() => !props.domain)

const sourceSummary = computed(() => {
  if (props.sourceScope === 'text_excerpt') {
    return props.sourceExcerptsLabel
  }
  if (props.sourceScope === 'bookmark') {
    return props.sourceBookmarksLabel
  }
  return ''
})

const summary = computed(() => {
  const source = sourceSummary.value
  if (props.domain && props.onlyThisSite) {
    const site = `Only ${props.domain}`
    return source ? `${source} · ${site}` : site
  }
  if (props.domain && props.combineWithPage) {
    const site = `With ${props.domain}`
    return source ? `${source} · ${site}` : site
  }
  return source || props.toggleLabel
})

const combineHintLine = computed(() => {
  if (!props.domain) {
    return props.noSiteHint
  }
  return `${props.domain} · ${props.combineHint}`
})

const onlySiteHintLine = computed(() => (props.domain ? props.onlySiteHint : props.noSiteHint))

/** 悬浮面板根节点：点外部收起 */
const rootRef = ref<HTMLElement | null>(null)

function toggleExpanded(): void {
  if (props.disabled) {
    return
  }
  emit('update:expanded', !props.expanded)
}

function toggleCombine(): void {
  if (props.disabled || !props.domain) {
    return
  }
  emit('update:combineWithPage', !props.combineWithPage)
}

function toggleOnlySite(): void {
  if (props.disabled || !props.domain) {
    return
  }
  emit('update:onlyThisSite', !props.onlyThisSite)
}

function selectSource(scope: 'all' | 'text_excerpt' | 'bookmark'): void {
  if (props.disabled) {
    return
  }
  emit('update:sourceScope', scope)
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node) || !rootRef.value) {
    return
  }
  if (!rootRef.value.contains(target)) {
    emit('update:expanded', false)
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('update:expanded', false)
  }
}

function setOutsideInert(active: boolean): void {
  const root = rootRef.value
  if (!root) {
    return
  }
  const dock = root.closest('.recall-composer-dock')
  const main = dock?.parentElement
  if (main) {
    for (const child of main.children) {
      if (child === dock) {
        continue
      }
      if (active) {
        child.setAttribute('inert', '')
      } else {
        child.removeAttribute('inert')
      }
    }
  }
  const form = root.parentElement
  if (!form) {
    return
  }
  for (const child of form.children) {
    if (child === root) {
      continue
    }
    if (active) {
      child.setAttribute('inert', '')
    } else {
      child.removeAttribute('inert')
    }
  }
}

watch(
  () => props.expanded,
  expanded => {
    setOutsideInert(expanded)
    if (expanded) {
      document.addEventListener('pointerdown', onDocumentPointerDown)
      document.addEventListener('keydown', onDocumentKeydown)
      return
    }
    document.removeEventListener('pointerdown', onDocumentPointerDown)
    document.removeEventListener('keydown', onDocumentKeydown)
  }
)

onUnmounted(() => {
  setOutsideInert(false)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div ref="rootRef" class="page-context">
    <button
      v-if="props.expanded"
      type="button"
      class="page-context__mask"
      :aria-label="props.dismissLabel"
      @click="emit('update:expanded', false)"
    />
    <button
      type="button"
      class="page-context__toggle"
      :class="{ 'page-context__toggle--active': hasActiveOption }"
      :aria-expanded="props.expanded"
      :disabled="props.disabled"
      @click="toggleExpanded"
    >
      <AppIcon
        class="page-context__chevron"
        :name="props.expanded ? 'chevron_up' : 'expand_more'"
        size="14px"
      />
      <span class="page-context__summary">{{ summary }}</span>
    </button>

    <div
      v-if="props.expanded"
      class="page-context__panel"
      role="group"
      :aria-label="props.toggleLabel"
    >
      <div class="page-context__context">
        <AppHoverTip
          fill
          align="start"
          :title="props.domain ? props.combineLabel : ''"
          :hint="props.domain ? combineHintLine : ''"
        >
          <button
            type="button"
            class="page-context__card"
            :class="{
              'page-context__card--on': props.combineWithPage && Boolean(props.domain),
              'page-context__card--unavailable': pageUnavailable
            }"
            role="switch"
            :aria-checked="props.combineWithPage"
            :aria-disabled="pageUnavailable || props.disabled"
            :aria-label="`${props.combineLabel}. ${combineHintLine}`"
            :disabled="props.disabled"
            @click="toggleCombine"
          >
            <AppIcon name="globe" size="18px" />
          </button>
        </AppHoverTip>
        <AppHoverTip
          fill
          align="end"
          :title="props.domain ? props.onlySiteLabel : ''"
          :hint="props.domain ? onlySiteHintLine : ''"
        >
          <button
            type="button"
            class="page-context__card"
            :class="{
              'page-context__card--on': props.onlyThisSite && Boolean(props.domain),
              'page-context__card--unavailable': pageUnavailable
            }"
            role="switch"
            :aria-checked="props.onlyThisSite"
            :aria-disabled="pageUnavailable || props.disabled"
            :aria-label="`${props.onlySiteLabel}. ${onlySiteHintLine}`"
            :disabled="props.disabled"
            @click="toggleOnlySite"
          >
            <AppIcon name="funnel" size="18px" />
          </button>
        </AppHoverTip>
      </div>

      <hr class="page-context__rule" />

      <div class="page-context__sources" role="radiogroup" :aria-label="props.toggleLabel">
        <AppHoverTip fill align="start" :title="props.sourceAllLabel" :hint="props.sourceAllHint">
          <button
            type="button"
            class="page-context__source"
            :class="{ 'page-context__source--on': props.sourceScope === 'all' }"
            role="radio"
            :aria-checked="props.sourceScope === 'all'"
            :aria-label="`${props.sourceAllLabel}. ${props.sourceAllHint}`"
            :disabled="props.disabled"
            @click="selectSource('all')"
          >
            <AppIcon name="stacks" size="18px" />
          </button>
        </AppHoverTip>
        <AppHoverTip fill :title="props.sourceExcerptsLabel" :hint="props.sourceExcerptsHint">
          <button
            type="button"
            class="page-context__source"
            :class="{ 'page-context__source--on': props.sourceScope === 'text_excerpt' }"
            role="radio"
            :aria-checked="props.sourceScope === 'text_excerpt'"
            :aria-label="`${props.sourceExcerptsLabel}. ${props.sourceExcerptsHint}`"
            :disabled="props.disabled"
            @click="selectSource('text_excerpt')"
          >
            <AppIcon name="format_quote" size="18px" />
          </button>
        </AppHoverTip>
        <AppHoverTip
          fill
          align="end"
          :title="props.sourceBookmarksLabel"
          :hint="props.sourceBookmarksHint"
        >
          <button
            type="button"
            class="page-context__source"
            :class="{ 'page-context__source--on': props.sourceScope === 'bookmark' }"
            role="radio"
            :aria-checked="props.sourceScope === 'bookmark'"
            :aria-label="`${props.sourceBookmarksLabel}. ${props.sourceBookmarksHint}`"
            :disabled="props.disabled"
            @click="selectSource('bookmark')"
          >
            <AppIcon name="bookmark" size="18px" />
          </button>
        </AppHoverTip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-context {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  margin: 0 0 var(--space-2xs);
  padding: 0 var(--space-2xs);
}

.page-context__mask {
  position: fixed;
  inset: 0;
  z-index: 4;
  margin: 0;
  padding: 0;
  border: 0;
  background: color-mix(in srgb, var(--ink) 32%, transparent);
  cursor: default;
}

.page-context__toggle {
  position: relative;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  max-width: 100%;
  margin: 0;
  padding: var(--space-2xs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
}

.page-context__toggle--active {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.page-context__toggle:hover:not(:disabled) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}

.page-context__toggle--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.page-context__toggle:disabled {
  opacity: 0.5;
  cursor: default;
}

.page-context__toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.page-context__chevron {
  flex-shrink: 0;
}

.page-context__summary {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-context__panel {
  position: absolute;
  right: var(--space-2xs);
  bottom: calc(100% + var(--space-2xs));
  left: var(--space-2xs);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface-white);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent),
    0 12px 28px color-mix(in srgb, var(--ink) 14%, transparent);
}

.page-context__context {
  display: flex;
  gap: var(--space-xs);
}

.page-context__card {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: var(--space-sm) var(--space-xs);
  border: 0;
  border-radius: var(--radius-lg);
  color: var(--on-surface-muted);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  cursor: pointer;
  font: inherit;
}

.page-context__card:hover:not(:disabled, .page-context__card--unavailable) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.page-context__card--on {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--surface-white));
}

.page-context__card--on:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 22%, var(--surface-white));
}

.page-context__card:disabled,
.page-context__card--unavailable {
  opacity: 0.4;
  cursor: default;
}

.page-context__card--unavailable:hover {
  color: var(--on-surface-muted);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}

.page-context__card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.page-context__rule {
  height: 1px;
  margin: var(--space-2xs) 0;
  border: 0;
  background: var(--border);
}

.page-context__sources {
  display: flex;
  gap: var(--space-xs);
}

.page-context__source {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: var(--space-sm) var(--space-xs);
  border: 0;
  border-radius: var(--radius-lg);
  color: var(--on-surface-muted);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  cursor: pointer;
  font: inherit;
}

.page-context__source:hover:not(:disabled) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.page-context__source--on {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--surface-white));
}

.page-context__source--on:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 22%, var(--surface-white));
}

.page-context__source:disabled {
  opacity: 0.5;
  cursor: default;
}

.page-context__source:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
