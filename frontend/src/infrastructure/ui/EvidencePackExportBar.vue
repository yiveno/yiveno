<script setup lang="ts">
import { computed } from 'vue'

import {
  EVIDENCE_PACK_MAX_ITEMS,
  EVIDENCE_PACK_MIN_ITEMS
} from '@/infrastructure/recall/evidence-pack-selection'
import { t } from '@/infrastructure/i18n/t'
import AppButton from '@/infrastructure/ui/AppButton.vue'

defineOptions({ name: 'EvidencePackExportBar' })

const props = defineProps<{
  selectedCount: number
  exporting?: boolean
  errorMessage?: string
  successMessage?: string
}>()

const emit = defineEmits<{
  exportJson: []
  exportMarkdown: []
  clear: []
}>()

const exportReady = computed(
  () =>
    props.selectedCount >= EVIDENCE_PACK_MIN_ITEMS && props.selectedCount <= EVIDENCE_PACK_MAX_ITEMS
)

const statusLabel = computed(() =>
  t('evidence_pack_selection_status', [
    String(props.selectedCount),
    String(EVIDENCE_PACK_MIN_ITEMS),
    String(EVIDENCE_PACK_MAX_ITEMS)
  ])
)

const showError = computed(() => Boolean(props.errorMessage?.trim()))
const showSuccess = computed(() => Boolean(props.successMessage?.trim()))
</script>

<template>
  <div class="evidence-pack-bar" role="region" :aria-label="t('evidence_pack_export_bar_aria')">
    <p class="evidence-pack-bar__status" role="status">{{ statusLabel }}</p>
    <p
      v-if="showError"
      class="evidence-pack-bar__feedback evidence-pack-bar__feedback--error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <p
      v-else-if="showSuccess"
      class="evidence-pack-bar__feedback evidence-pack-bar__feedback--success"
      role="status"
    >
      {{ successMessage }}
    </p>
    <div class="evidence-pack-bar__actions">
      <AppButton
        type="button"
        variant="outlined"
        :disabled="!exportReady || exporting"
        @click="emit('exportJson')"
      >
        {{ t('evidence_pack_export_json') }}
      </AppButton>
      <AppButton
        type="button"
        variant="filled"
        :disabled="!exportReady || exporting"
        @click="emit('exportMarkdown')"
      >
        {{ t('evidence_pack_export_markdown') }}
      </AppButton>
      <AppButton type="button" variant="text" :disabled="exporting" @click="emit('clear')">
        {{ t('evidence_pack_cancel_export') }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.evidence-pack-bar {
  display: grid;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--border);
  background: var(--surface-white);
}

.evidence-pack-bar__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.evidence-pack-bar__feedback {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}

.evidence-pack-bar__feedback--error {
  color: var(--danger);
}

.evidence-pack-bar__feedback--success {
  color: var(--on-surface-muted);
}

.evidence-pack-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-sm);
  align-items: center;
}
</style>
