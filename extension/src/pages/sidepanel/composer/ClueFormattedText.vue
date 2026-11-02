<script setup lang="ts">
/**
 * 将 clue 纯文本渲染为文字 + URL 芯片（气泡等只读面）。
 * 标题异步：本机库 / 打开中 tab；未命中保持缩短 host/path。
 */
import { computed, ref, watch } from 'vue'

import { resolveClueUrlChipLabel } from '@/core/recall/clue-url-display'
import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import { navigateActiveTab } from '@/infrastructure/messaging/background-client'
import { fetchClueUrlDisplayTitles } from '@/pages/sidepanel/composer/enrich-clue-url-chips'
import { parseCluePlainSegments } from '@/pages/sidepanel/composer/clue-url'

import '@/pages/sidepanel/composer/clue-url-chip.css'

defineOptions({ name: 'ClueFormattedText' })

const props = defineProps<{
  text: string
}>()

const segments = computed(() => parseCluePlainSegments(props.text, { chipTrailing: true }))

/** href → 解析到的标题（无则缺省）。 */
const resolvedTitles = ref<ReadonlyMap<string, string>>(new Map())
let resolveGeneration = 0

watch(
  segments,
  async segs => {
    const hrefs = segs.filter(s => s.kind === 'url').map(s => s.href)
    if (hrefs.length === 0) {
      resolvedTitles.value = new Map()
      return
    }
    const generation = ++resolveGeneration
    const titles = await fetchClueUrlDisplayTitles(hrefs)
    if (generation !== resolveGeneration) {
      return
    }
    resolvedTitles.value = titles
  },
  { immediate: true }
)

function chipLabel(href: string): string {
  return resolveClueUrlChipLabel(href, resolvedTitles.value.get(href))
}

function faviconSrc(href: string): string {
  try {
    return getChromeFaviconUrl(href, 16)
  } catch {
    return ''
  }
}

function openUrl(href: string, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  // 与 composer 芯片一致：默认新开；Shift → 当前活动标签
  const disposition =
    event.shiftKey && !event.metaKey && !event.ctrlKey ? 'currentTab' : 'newForegroundTab'
  void navigateActiveTab({
    url: href,
    disposition
  }).catch(() => {
    // 忽略：导航失败不打断会话
  })
}

function onChipKeydown(href: string, event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }
  event.preventDefault()
  void navigateActiveTab({ url: href, disposition: 'newForegroundTab' }).catch(() => {
    // 忽略
  })
}
</script>

<template>
  <span class="clue-formatted-text">
    <template v-for="(segment, index) in segments" :key="index">
      <template v-if="segment.kind === 'text'">{{ segment.text }}</template>
      <button
        v-else
        type="button"
        class="clue-url-chip"
        :aria-label="segment.href"
        :title="segment.href"
        @click="openUrl(segment.href, $event)"
        @keydown="onChipKeydown(segment.href, $event)"
      >
        <img
          v-if="faviconSrc(segment.href)"
          class="clue-url-chip__favicon"
          :src="faviconSrc(segment.href)"
          alt=""
          draggable="false"
          @error="($event.target as HTMLImageElement).hidden = true"
        />
        <span class="clue-url-chip__label">{{ chipLabel(segment.href) }}</span>
      </button>
    </template>
  </span>
</template>

<style scoped>
.clue-formatted-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
