<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppConfirmModal from '@/infrastructure/ui/AppConfirmModal.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'
import { t } from '@/infrastructure/i18n/t'

defineOptions({ name: 'LoginMigrationDialog' })

const props = defineProps<{
  open: boolean
  loading: boolean
  error: string
  excerptCount: number
  bookmarkCount: number
  deleteAfterExportOpen: boolean
}>()

const emit = defineEmits<{
  import: []
  export: []
  delete: []
  later: []
  dismissDeleteAfterExport: []
  confirmDeleteAfterExport: []
}>()

/** Delete 二次确认（与「导出后删」分开）。 */
const deleteConfirmOpen = ref(false)

watch(
  () => props.open,
  open => {
    if (!open) {
      deleteConfirmOpen.value = false
    }
  }
)

function openDeleteConfirm(): void {
  if (props.loading) {
    return
  }
  deleteConfirmOpen.value = true
}

function dismissDeleteConfirm(): void {
  deleteConfirmOpen.value = false
}

function confirmDelete(): void {
  deleteConfirmOpen.value = false
  emit('delete')
}
</script>

<template>
  <AppModal
    :open="open"
    :title="t('settings_login_migration_title')"
    :loading="loading"
    :close-on-escape="true"
    size="md"
    @close="emit('later')"
  >
    <p class="settings-section-copy">{{ t('settings_login_migration_copy') }}</p>
    <p class="settings-sync-counts">
      {{ t('settings_login_migration_counts_excerpts', [String(excerptCount)]) }}
    </p>
    <p class="settings-sync-counts">
      {{ t('settings_login_migration_counts_bookmarks', [String(bookmarkCount)]) }}
    </p>

    <div class="settings-sign-out-options">
      <AppButton type="button" :disabled="loading" variant="filled" @click="emit('import')">
        {{ t('settings_login_migration_import') }}
      </AppButton>
      <p class="settings-sign-out-option-hint">{{ t('settings_login_migration_import_hint') }}</p>

      <AppButton type="button" :disabled="loading" variant="outlined" @click="emit('export')">
        {{ t('settings_login_migration_export') }}
      </AppButton>
      <p class="settings-sign-out-option-hint">{{ t('settings_login_migration_export_hint') }}</p>

      <AppButton type="button" :disabled="loading" variant="outlined" @click="openDeleteConfirm">
        {{ t('settings_login_migration_delete') }}
      </AppButton>
      <p class="settings-sign-out-option-hint">{{ t('settings_login_migration_delete_hint') }}</p>

      <AppButton type="button" :disabled="loading" variant="text" @click="emit('later')">
        {{ t('settings_login_migration_later') }}
      </AppButton>
    </div>

    <template v-if="error" #error>{{ error }}</template>
  </AppModal>

  <AppConfirmModal
    :open="deleteConfirmOpen"
    :title="t('settings_login_migration_delete_confirm_title')"
    :body="t('settings_login_migration_delete_confirm_body', [String(excerptCount)])"
    :cancel-label="t('settings_sign_out_cancel')"
    :confirm-label="t('settings_login_migration_delete')"
    confirm-tone="danger"
    :loading="loading"
    @close="dismissDeleteConfirm"
    @confirm="confirmDelete"
  />

  <AppConfirmModal
    :open="deleteAfterExportOpen"
    :title="t('settings_login_migration_delete_after_export_title')"
    :body="t('settings_login_migration_delete_after_export_body')"
    :cancel-label="t('settings_login_migration_keep_copies')"
    :confirm-label="t('settings_login_migration_delete')"
    confirm-tone="danger"
    :loading="loading"
    @close="emit('dismissDeleteAfterExport')"
    @confirm="emit('confirmDeleteAfterExport')"
  />
</template>

<style scoped src="../settings/settings-panel.css"></style>
