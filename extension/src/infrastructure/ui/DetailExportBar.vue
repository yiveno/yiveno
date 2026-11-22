<script setup lang="ts">
import { computed } from 'vue'

import { DETAIL_EXPORT_MIN_ITEMS } from '@/infrastructure/recall/detail-export-selection'
import { t } from '@/infrastructure/i18n/t'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppMenuButton, { type AppMenuPlacement } from '@/infrastructure/ui/AppMenuButton.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'

defineOptions({ name: 'DetailExportBar' })

const props = withDefaults(
  defineProps<{
    selectedCount: number
    exporting?: boolean
    /** 格式菜单弹出方向；底栏默认向上 */
    menuPlacement?: AppMenuPlacement
    /** 是否显示全选/反选入口（Side Panel 用；Library 不传） */
    showBulkAction?: boolean
    /** 当前 bulk 动作 */
    bulkAction?: 'selectAll' | 'invert'
  }>(),
  {
    menuPlacement: 'top',
    showBulkAction: false,
    bulkAction: 'selectAll'
  }
)

const emit = defineEmits<{
  copyJson: []
  copyMarkdown: []
  downloadJson: []
  downloadMarkdown: []
  clear: []
  bulk: []
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

const bulkLabel = computed(() =>
  props.bulkAction === 'selectAll'
    ? t('detail_export_select_all')
    : t('detail_export_invert_selection')
)

const bulkHint = computed(() =>
  props.bulkAction === 'selectAll'
    ? t('detail_export_select_all_hint')
    : t('detail_export_invert_selection_hint')
)

const bulkIcon = computed((): AppIconName =>
  props.bulkAction === 'selectAll' ? 'list_checks' : 'flip_vertical'
)

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
      <AppButton
        v-if="showBulkAction"
        type="button"
        variant="outlined"
        :title="bulkHint"
        :aria-label="bulkLabel"
        :disabled="exporting"
        @click="emit('bulk')"
      >
        <span class="detail-export-bar__bulk-inner">
          <AppIcon :name="bulkIcon" size="16px" />
          <span>{{ bulkLabel }}</span>
        </span>
      </AppButton>
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
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
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

.detail-export-bar__bulk-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}
</style>
