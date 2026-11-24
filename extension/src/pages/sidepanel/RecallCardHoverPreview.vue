<script setup lang="ts">
/**
 * 结果卡悬停预览浮层：有图显示截图；无图骨架 + favicon/标题/摘录/域名/时间/命中线索。
 * 不访问目标站；仅读本机 GET_PAGE_PREVIEW。
 */
import { computed, onUnmounted, ref, watch } from 'vue'

import { isOpenableExternalSourceUrl } from '@/infrastructure/browser/active-tab-reader'
import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import { t } from '@/infrastructure/i18n/t'
import { getPagePreview } from '@/infrastructure/messaging/background-client'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import {
  placeHoverPreviewInPanel,
  type HoverPreviewPlacement
} from '@/pages/sidepanel/recall-card-hover-preview'

defineOptions({ name: 'RecallCardHoverPreview' })

const props = defineProps<{
  card: RecallCardModel
  visible: boolean
  anchorRect: DOMRect | null
  panelRect: DOMRect | null
}>()

const objectUrl = ref<string | null>(null)
const loadState = ref<'idle' | 'loading' | 'ready' | 'missing'>('idle')
const placement = ref<HoverPreviewPlacement | null>(null)

const kindIcon = computed<AppIconName>(() =>
  props.card.itemKind === 'bookmark' ? 'bookmark' : 'format_quote'
)

/**
 * 悬停预览查图 / 域名用的外部 URL。
 * 摘录卡 `card.url` 多为 detail.html；截图按 sourceUrl 存，须优先读 sourceUrl。
 */
function resolveHoverPreviewLookupUrl(card: RecallCardModel): string | null {
  const fromSource = card.sourceUrl?.trim()
  if (fromSource && isOpenableExternalSourceUrl(fromSource)) {
    return fromSource
  }
  const fromCardUrl = card.url?.trim()
  if (fromCardUrl && isOpenableExternalSourceUrl(fromCardUrl)) {
    return fromCardUrl
  }
  return null
}

const domainLine = computed(() => {
  const sub = props.card.subtitle.trim()
  if (sub) {
    return sub
  }
  try {
    const lookup = resolveHoverPreviewLookupUrl(props.card)
    if (lookup) {
      return new URL(lookup).hostname
    }
  } catch {
    // ignore
  }
  return ''
})

const previewStyle = computed(() => {
  const p = placement.value
  if (!p) {
    return undefined
  }
  return {
    top: `${p.top}px`,
    left: `${p.left}px`,
    width: `${p.width}px`,
    maxHeight: `${p.maxHeight}px`
  }
})

/**
 * 释放 objectUrl。
 * data: URL 上 URL.revokeObjectURL 是无操作，无需特判——勿「修复」成跳过。
 */
function revokeObjectUrl(): void {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

function recomputePlacement(): void {
  if (!props.anchorRect || !props.panelRect) {
    placement.value = null
    return
  }
  placement.value = placeHoverPreviewInPanel({
    anchor: props.anchorRect,
    panel: props.panelRect
  })
}

async function loadPreview(): Promise<void> {
  revokeObjectUrl()
  loadState.value = 'loading'
  const url = resolveHoverPreviewLookupUrl(props.card)
  if (!url) {
    loadState.value = 'missing'
    return
  }
  try {
    const response = await getPagePreview({ url })
    if (!props.visible) {
      return
    }
    // SW 回传 data URL（消息通道 JSON 序列化；Blob/ArrayBuffer 到不了面板）
    const dataUrl =
      response.ok && 'dataUrl' in response && typeof response.dataUrl === 'string'
        ? response.dataUrl
        : undefined
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      objectUrl.value = dataUrl
      loadState.value = 'ready'
      return
    }
    console.warn('[HoverPreview] loadPreview missing', {
      ok: response.ok,
      dataUrlType: dataUrl == null ? String(dataUrl) : Object.prototype.toString.call(dataUrl),
      dataUrlLength: typeof dataUrl === 'string' ? dataUrl.length : undefined,
      dataUrlPrefix: typeof dataUrl === 'string' ? dataUrl.slice(0, 30) : undefined,
      width: 'width' in response ? response.width : undefined,
      height: 'height' in response ? response.height : undefined
    })
    loadState.value = 'missing'
  } catch (error) {
    console.warn('[HoverPreview] loadPreview catch', {
      error: error instanceof Error ? error.message : String(error),
      ok: undefined,
      dataUrlType: undefined,
      dataUrlLength: undefined,
      dataUrlPrefix: undefined,
      width: undefined,
      height: undefined
    })
    if (props.visible) {
      loadState.value = 'missing'
    }
  }
}

watch(
  () => [props.visible, props.card.id, props.anchorRect, props.panelRect] as const,
  ([visible]) => {
    if (!visible) {
      revokeObjectUrl()
      loadState.value = 'idle'
      placement.value = null
      return
    }
    recomputePlacement()
    void loadPreview()
  }
)

onUnmounted(() => {
  revokeObjectUrl()
})
</script>

<template>
  <div
    v-if="visible && placement"
    class="recall-card-hover-preview"
    role="dialog"
    :aria-label="t('recall_card_preview_aria')"
    :style="previewStyle"
    @pointerdown.stop
  >
    <div v-if="loadState === 'ready' && objectUrl" class="recall-card-hover-preview__shot">
      <img :src="objectUrl" alt="" decoding="async" />
    </div>
    <div v-else class="recall-card-hover-preview__fallback">
      <div class="recall-card-hover-preview__skeleton" aria-hidden="true" />
      <div class="recall-card-hover-preview__meta">
        <div class="recall-card-hover-preview__title-row">
          <img
            v-if="card.url && card.itemKind === 'bookmark'"
            class="recall-card-hover-preview__favicon"
            :src="getChromeFaviconUrl(card.url, 32)"
            alt=""
            width="16"
            height="16"
            loading="lazy"
            decoding="async"
          />
          <AppIcon v-else :name="kindIcon" size="16px" />
          <p class="recall-card-hover-preview__title">{{ card.title }}</p>
        </div>
        <p v-if="card.excerpt" class="recall-card-hover-preview__excerpt">{{ card.excerpt }}</p>
        <p v-else-if="card.note" class="recall-card-hover-preview__excerpt">{{ card.note }}</p>
        <div class="recall-card-hover-preview__foot">
          <span v-if="domainLine" class="recall-card-hover-preview__domain">{{ domainLine }}</span>
          <time
            v-if="card.savedAtLabel"
            class="recall-card-hover-preview__saved"
            :datetime="card.savedAtIso"
            :title="card.savedAtTitle"
            >{{ card.savedAtLabel }}</time
          >
        </div>
        <p v-if="card.reasonLine" class="recall-card-hover-preview__reason">
          {{ card.reasonLine }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recall-card-hover-preview {
  position: fixed;
  z-index: 40;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-white);
  pointer-events: none;
  overflow: auto;
  box-shadow: var(--shadow-ink-sm);
}

.recall-card-hover-preview__shot img {
  display: block;
  width: 100%;
  height: auto;
  vertical-align: top;
}

.recall-card-hover-preview__fallback {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 8px);
  padding: var(--space-sm, 8px);
}

.recall-card-hover-preview__skeleton {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: var(--radius-sm, 6px);
  background: linear-gradient(
    90deg,
    var(--surface-2) 0%,
    var(--surface-raised) 50%,
    var(--surface-2) 100%
  );
  background-size: 200% 100%;
  animation: recall-preview-shimmer 1.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .recall-card-hover-preview__skeleton {
    animation: none;
  }
}

@keyframes recall-preview-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

.recall-card-hover-preview__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.recall-card-hover-preview__title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  min-width: 0;
}

.recall-card-hover-preview__favicon {
  flex: 0 0 auto;
  margin-top: 2px;
  border-radius: 2px;
}

.recall-card-hover-preview__title {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 600;
  line-height: 1.35;
  color: var(--charcoal);
  overflow-wrap: anywhere;
}

.recall-card-hover-preview__excerpt {
  display: -webkit-box;
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.45;
  color: var(--muted);
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

.recall-card-hover-preview__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--muted);
}

.recall-card-hover-preview__domain {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recall-card-hover-preview__saved {
  flex: 0 0 auto;
}

.recall-card-hover-preview__reason {
  display: -webkit-box;
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.4;
  color: var(--muted);
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
