<script setup lang="ts">
import { inject } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppConfirmModal from '@/infrastructure/ui/AppConfirmModal.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'
import type { SettingsPageController } from '@/pages/settings/use-settings-page'

defineOptions({ name: 'SettingsPageDialogs' })

const {
  accountEmail,
  closeConfirmDialog,
  closeDeleteAccountDialog,
  closeSignOutDialog,
  confirmDeleteAccount,
  confirmDialogBody,
  confirmDialogError,
  confirmDialogLoading,
  confirmDialogOpen,
  confirmDialogTitle,
  confirmDialogTone,
  confirmSignOut,
  dataError,
  dataWorking,
  deleteAccountDialogOpen,
  runConfirmDialog,
  showSignOutDataActions,
  signOutDialogOpen,
  signOutError,
  signingOut,
  syncAccountOwnerCount,
  syncLocalProfileOwnerCount,
  syncRemoteCount,
  t
} = inject<SettingsPageController>('settingsPage')!
</script>

<template>
  <AppModal
    :open="signOutDialogOpen"
    :title="t('settings_sign_out_dialog_title')"
    :loading="signingOut"
    close-on-backdrop
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

    <div class="settings-sign-out-options">
      <AppButton
        type="button"
        :disabled="signingOut"
        @click="confirmSignOut('keep_local')"
        variant="filled"
      >
        {{ t('settings_sign_out_keep_local') }}
      </AppButton>
      <p class="settings-sign-out-option-hint">{{ t('settings_sign_out_keep_local_hint') }}</p>

      <template v-if="showSignOutDataActions">
        <AppButton
          type="button"
          :disabled="signingOut"
          @click="confirmSignOut('clear_local')"
          variant="outlined"
        >
          {{ t('settings_sign_out_clear_local') }}
        </AppButton>
        <p class="settings-sign-out-option-hint">
          {{ t('settings_sign_out_clear_local_hint') }}
        </p>

        <AppButton
          type="button"
          :disabled="signingOut"
          @click="confirmSignOut('sync_then_clear_local')"
          variant="outlined"
        >
          {{ t('settings_sign_out_sync_then_clear') }}
        </AppButton>
        <p class="settings-sign-out-option-hint">
          {{ t('settings_sign_out_sync_then_clear_hint') }}
        </p>
      </template>
    </div>

    <template v-if="signOutError" #error>{{ signOutError }}</template>

    <template #actions>
      <AppButton type="button" :disabled="signingOut" @click="closeSignOutDialog" variant="text">
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
