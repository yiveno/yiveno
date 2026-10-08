<script setup lang="ts">
import { computed } from 'vue'

import { DETAIL_EXPORT_MIN_ITEMS } from '@/infrastructure/recall/detail-export-selection'
import { t } from '@/infrastructure/i18n/t'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppMenuButton, { type AppMenuPlacement } from '@/infrastructure/ui/AppMenuButton.vue'

defineOptions({ name: 'DetailExportBar' })

const props = withDefaults(
  defineProps<{
    selectedCount: number
    exporting?: boolean
    /** 格式菜单弹出方向；底栏默认向上 */
    menuPlacement?: AppMenuPlacement
  }>(),
  {
    menuPlacement: 'top'
  }
)

const emit = defineEmits<{
  copyJson: []
  copyMarkdown: []
  downloadJson: []
  downloadMarkdown: []
  clear: []
}>()

const exportReady = computed(() => props.selectedCount >= DETAIL_EXPORT_MIN_ITEMS)
const menuDisabled = computed(() => !exportReady.value || props.exporting === true)

const statusLabel = computed(() =>
  t('detail_export_selection_status', [String(props.selectedCount)])
)

const formatMenuItems = computed(() => [
  { id: 'markdown', label: t('detail_export_format_markdown') },
  { id: 'json', label: t('detail_export_format_json') }
])

function handleCopySelect(id: string): void {
  if (id === 'json') {
    emit('copyJson')
    return
  }
  emit('copyMarkdown')
}

function handleDownloadSelect(id: string): void {
  if (id === 'json') {
    emit('downloadJson')
    return
  }
  emit('downloadMarkdown')
}
</script>

<template>
  <div class="detail-export-bar" role="region" :aria-label="t('detail_export_bar_aria')">
    <div class="detail-export-bar__lead">
      <p class="detail-export-bar__status" role="status">{{ statusLabel }}</p>
    </div>
    <div class="detail-export-bar__actions">
      <AppMenuButton
        :label="t('detail_export_copy')"
        icon="content_copy"
        variant="outlined"
        :placement="menuPlacement"
        :items="formatMenuItems"
        :disabled="menuDisabled"
        :aria-label="t('detail_export_copy_menu_aria')"
        @select="handleCopySelect"
      />
      <AppMenuButton
        :label="t('detail_export_download')"
        icon="download"
        variant="outlined"
        :placement="menuPlacement"
        :items="formatMenuItems"
        :disabled="menuDisabled"
        :aria-label="t('detail_export_download_menu_aria')"
        @select="handleDownloadSelect"
      />
      <AppButton type="button" variant="text" :disabled="exporting" @click="emit('clear')">
        {{ t('detail_export_cancel') }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.detail-export-bar {
  display: flex;
  flex-wrap: var(--detail-export-bar-wrap, wrap);
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  box-sizing: border-box;
  height: var(--detail-export-bar-height, auto);
  min-height: var(--detail-export-bar-height, 0);
  max-height: var(--detail-export-bar-height, none);
  padding: var(--space-sm) var(--space-md);
  background: var(--surface-white);
  overflow: visible;
}

.detail-export-bar__lead {
  flex: 1;
  min-width: 0;
}

.detail-export-bar__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  color: var(--on-surface-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-export-bar__actions {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-xs) var(--space-sm);
  margin-left: auto;
}
</style>
