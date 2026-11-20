<script setup lang="ts">
import { inject } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppConfirmModal from '@/infrastructure/ui/AppConfirmModal.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'
import LoginMigrationDialog from '@/pages/shared/LoginMigrationDialog.vue'
import type { SettingsPageController } from '@/pages/settings/use-settings-page'

defineOptions({ name: 'SettingsPageDialogs' })

const {
  accountEmail,
  closeConfirmDialog,
  closeDeleteAccountDialog,
  closeSignOutDialog,
  confirmDeleteAccount,
  confirmDialogBody,
  confirmDialogBodyLinkHref,
  confirmDialogBodyLinkLabel,
  confirmDialogError,
  confirmDialogLoading,
  confirmDialogOpen,
  confirmDialogTitle,
  confirmDialogTone,
  confirmSignOut,
  confirmSignOutAnywayAfterFlushFail,
  dataError,
  dataWorking,
  deleteAccountDialogOpen,
  dismissDeleteAfterExport,
  dismissLoginMigration,
  exportBeforeSignOutAfterFlushFail,
  exportWorking,
  loginMigrationBookmarkCount,
  loginMigrationDeleteAfterExportOpen,
  loginMigrationError,
  loginMigrationExcerptCount,
  loginMigrationLoading,
  loginMigrationOpen,
  runConfirmDialog,
  runLoginMigrationDelete,
  runLoginMigrationExport,
  runLoginMigrationImport,
  showSignOutClearAction,
  showSignOutFlushAction,
  signOutDeleteLocalExcerpts,
  signOutDialogOpen,
  signOutError,
  signOutFlushFailed,
  signingOut,
  syncAccountOwnerCount,
  syncLocalProfileOwnerCount,
  syncRemoteCount,
  t
} = inject<SettingsPageController>('settingsPage')!
</script>

<template>
  <LoginMigrationDialog
    :open="loginMigrationOpen"
    :loading="loginMigrationLoading"
    :error="loginMigrationError"
    :excerpt-count="loginMigrationExcerptCount"
    :bookmark-count="loginMigrationBookmarkCount"
    :delete-after-export-open="loginMigrationDeleteAfterExportOpen"
    @import="runLoginMigrationImport"
    @export="runLoginMigrationExport"
    @delete="runLoginMigrationDelete"
    @later="dismissLoginMigration"
    @dismiss-delete-after-export="dismissDeleteAfterExport"
    @confirm-delete-after-export="runLoginMigrationDelete"
  />

  <AppModal
    :open="signOutDialogOpen"
    :title="t('settings_sign_out_dialog_title')"
    :loading="signingOut"
    size="md"
    @close="closeSignOutDialog"
  >
    <p v-if="accountEmail" class="settings-section-copy">{{ accountEmail }}</p>
    <p class="settings-section-copy">{{ t('settings_sign_out_dialog_copy') }}</p>
    <p class="settings-sync-counts">
      {{
        t('settings_sign_out_dialog_counts', [
          String(syncAccountOwnerCount),
          String(syncLocalProfileOwnerCount),
          String(syncRemoteCount)
        ])
      }}
    </p>

    <label class="settings-sign-out-opt-in">
      <input v-model="signOutDeleteLocalExcerpts" type="checkbox" :disabled="signingOut" />
      <span>{{ t('settings_sign_out_delete_excerpts_opt_in') }}</span>
    </label>

    <div class="settings-sign-out-options">
      <AppButton
        v-if="showSignOutFlushAction"
        type="button"
        :disabled="signingOut"
        variant="filled"
        @click="confirmSignOut('flush_then_keep')"
      >
        {{ t('settings_sign_out_flush_then_keep') }}
      </AppButton>
      <p v-if="showSignOutFlushAction" class="settings-sign-out-option-hint">
        {{ t('settings_sign_out_flush_then_keep_hint') }}
      </p>

      <AppButton
        type="button"
        :disabled="signingOut"
        :variant="showSignOutFlushAction ? 'outlined' : 'filled'"
        @click="confirmSignOut('keep_local')"
      >
        {{ t('settings_sign_out_keep_local') }}
      </AppButton>
      <p class="settings-sign-out-option-hint">{{ t('settings_sign_out_keep_local_hint') }}</p>

      <template v-if="showSignOutClearAction">
        <AppButton
          type="button"
          :disabled="signingOut"
          variant="outlined"
          @click="confirmSignOut('clear_local')"
        >
          {{ t('settings_sign_out_clear_local') }}
        </AppButton>
        <p class="settings-sign-out-option-hint">
          {{ t('settings_sign_out_clear_local_hint') }}
        </p>
      </template>
    </div>

    <template v-if="signOutError" #error>{{ signOutError }}</template>

    <template #actions>
      <template v-if="signOutFlushFailed">
        <AppButton
          type="button"
          :disabled="signingOut || exportWorking"
          variant="outlined"
          @click="exportBeforeSignOutAfterFlushFail"
        >
          {{ t('settings_sign_out_flush_failed_export') }}
        </AppButton>
        <AppButton
          type="button"
          :disabled="signingOut"
          variant="filled"
          @click="confirmSignOutAnywayAfterFlushFail"
        >
          {{ t('settings_sign_out_flush_failed_still') }}
        </AppButton>
      </template>
      <AppButton type="button" :disabled="signingOut" variant="text" @click="closeSignOutDialog">
        {{ t('settings_sign_out_cancel') }}
      </AppButton>
    </template>
  </AppModal>

  <AppConfirmModal
    :open="deleteAccountDialogOpen"
    :title="t('settings_privacy_delete_account')"
    :description="t('settings_privacy_delete_account_hint')"
    :body="t('settings_privacy_delete_account_confirm')"
    :cancel-label="t('settings_sign_out_cancel')"
    :confirm-label="t('settings_privacy_delete_account')"
    :confirm-loading-label="t('settings_privacy_working')"
    confirm-tone="danger"
    :error="dataError || undefined"
    :loading="dataWorking"
    @close="closeDeleteAccountDialog"
    @confirm="confirmDeleteAccount"
  />

  <AppConfirmModal
    :open="confirmDialogOpen"
    :title="confirmDialogTitle"
    :body="confirmDialogBody"
    :body-link-href="confirmDialogBodyLinkHref"
    :body-link-label="confirmDialogBodyLinkLabel"
    :cancel-label="t('settings_sign_out_cancel')"
    :confirm-label="confirmDialogTitle"
    :confirm-tone="confirmDialogTone"
    :error="confirmDialogError || undefined"
    :loading="confirmDialogLoading"
    @close="closeConfirmDialog"
    @confirm="runConfirmDialog"
  />
</template>

<style scoped src="./settings-panel.css"></style>
<style scoped>
.settings-sign-out-opt-in {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0.75rem 0 1rem;
  font-size: 0.875rem;
  line-height: 1.4;
  cursor: pointer;
}

.settings-sign-out-opt-in input {
  margin-top: 0.15rem;
  flex-shrink: 0;
}
</style>
