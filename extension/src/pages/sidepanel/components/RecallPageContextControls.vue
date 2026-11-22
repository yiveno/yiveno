<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import type { PageContextMode } from '@/core/recall/page-context-mode'
import AppHoverTip from '@/infrastructure/ui/AppHoverTip.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import { setPageContextOutsideInert } from '@/pages/sidepanel/page-context-outside-inert'

defineOptions({ name: 'RecallPageContextControls' })

const props = defineProps<{
  /** 当前浏览页域名；内置页 / 新标签时为空，图标仍显示 */
  domain: string | null
  /** 页上下文三态：none / boost / restrict（互斥单选） */
  mode: PageContextMode
  /** 来源范围；默认 all */
  sourceScope: 'all' | 'text_excerpt' | 'bookmark'
  expanded: boolean
  disabled?: boolean
  toggleLabel: string
  dismissLabel: string
  noneLabel: string
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
  'update:mode': [value: PageContextMode]
  'update:sourceScope': [value: 'all' | 'text_excerpt' | 'bookmark']
}>()

const hasActiveOption = computed(
  () => (Boolean(props.domain) && props.mode !== 'none') || props.sourceScope !== 'all'
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

/** 有生效选项时拼进 a11y，可见层仅图标。 */
const toggleAriaLabel = computed(() => {
  const source = sourceSummary.value
  let active = ''
  if (props.domain && props.mode === 'restrict') {
    active = source ? `${source} · Only ${props.domain}` : `Only ${props.domain}`
  } else if (props.domain && props.mode === 'boost') {
    active = source ? `${source} · With ${props.domain}` : `With ${props.domain}`
  } else if (source) {
    active = source
  }
  return active ? `${props.toggleLabel}. ${active}` : props.toggleLabel
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

function selectMode(mode: PageContextMode): void {
  if (props.disabled) {
    return
  }
  if (mode !== 'none' && !props.domain) {
    return
  }
  emit('update:mode', mode)
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

/** 面板外 inert：排除含 root 的 toolbar / float-dock，勿把 root 所在子树标 inert。 */
function setOutsideInert(active: boolean): void {
  setPageContextOutsideInert(rootRef.value, active)
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
      :class="{ 'page-context__toggle--active': hasActiveOption || props.expanded }"
      :title="props.toggleLabel"
      :aria-label="toggleAriaLabel"
      :aria-expanded="props.expanded"
      :disabled="props.disabled"
      @click="toggleExpanded"
    >
      <AppIcon name="settings" size="18px" />
    </button>

    <div
      v-if="props.expanded"
      class="page-context__panel"
      role="group"
      :aria-label="props.toggleLabel"
    >
      <div class="page-context__context" role="radiogroup" :aria-label="props.toggleLabel">
        <AppHoverTip fill align="start" :title="props.noneLabel" :hint="props.noneLabel">
          <button
            type="button"
            class="page-context__source"
            :class="{ 'page-context__source--on': props.mode === 'none' }"
            role="radio"
            :aria-checked="props.mode === 'none'"
            :aria-label="props.noneLabel"
            :disabled="props.disabled"
            @click="selectMode('none')"
          >
            <AppIcon name="radio_unchecked" size="18px" />
          </button>
        </AppHoverTip>
        <AppHoverTip
          fill
          :title="props.domain ? props.combineLabel : ''"
          :hint="props.domain ? combineHintLine : ''"
        >
          <button
            type="button"
            class="page-context__source"
            :class="{
              'page-context__source--on': props.mode === 'boost' && Boolean(props.domain),
              'page-context__source--unavailable': pageUnavailable
            }"
            role="radio"
            :aria-checked="props.mode === 'boost'"
            :aria-disabled="pageUnavailable || props.disabled"
            :aria-label="`${props.combineLabel}. ${combineHintLine}`"
            :disabled="props.disabled || pageUnavailable"
            @click="selectMode('boost')"
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
            class="page-context__source"
            :class="{
              'page-context__source--on': props.mode === 'restrict' && Boolean(props.domain),
              'page-context__source--unavailable': pageUnavailable
            }"
            role="radio"
            :aria-checked="props.mode === 'restrict'"
            :aria-disabled="pageUnavailable || props.disabled"
            :aria-label="`${props.onlySiteLabel}. ${onlySiteHintLine}`"
            :disabled="props.disabled || pageUnavailable"
            @click="selectMode('restrict')"
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
/* 坐在 composer 工具条左侧；面板相对壳定位（父级 .recall-composer-shell position:relative） */
.page-context {
  position: static;
  flex-shrink: 0;
  width: auto;
  margin: 0;
  padding: 0;
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
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.page-context__toggle--active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.page-context__toggle:hover:not(:disabled) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.page-context__toggle--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.page-context__toggle:disabled {
  opacity: 0.5;
  cursor: default;
}

.page-context__toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.page-context__panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2xs));
  left: 0;
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

.page-context__source:hover:not(:disabled, .page-context__source--unavailable) {
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

.page-context__source:disabled,
.page-context__source--unavailable {
  opacity: 0.4;
  cursor: default;
}

.page-context__source--unavailable:hover {
  color: var(--on-surface-muted);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}

.page-context__source:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
