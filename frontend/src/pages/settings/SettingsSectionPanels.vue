<script setup lang="ts">
import { inject, type ComponentPublicInstance } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import AppSwitch from '@/infrastructure/ui/AppSwitch.vue'
import SettingsActionRow from '@/pages/settings/SettingsActionRow.vue'
import type { SettingsPageController } from '@/pages/settings/use-settings-page'

defineOptions({ name: 'SettingsSectionPanels' })

const page = inject<SettingsPageController>('settingsPage')!

/** 模板 ref 绑定：controller 内为 Ref，须写 .value。 */
function bindRaindropFileInput(el: Element | ComponentPublicInstance | null): void {
  page.raindropFileInputRef.value = el as HTMLInputElement | null
}

function bindPocketFileInput(el: Element | ComponentPublicInstance | null): void {
  page.pocketFileInputRef.value = el as HTMLInputElement | null
}

const {
  accountDisplayName,
  accountEmail,
  activeSection,
  aiFeaturesEnabled,
  chromeBookmarkIngestEnabled,
  commandRows,
  commandsError,
  commandsState,
  dataWorking,
  exportWorking,
  handleAiFeaturesToggle,
  handleChromeBookmarkIngestToggle,
  handleClearLocalMemory,
  handleClearOrphans,
  handleDeleteCloudMemory,
  handleExportLocalMemory,
  handleExportOrphans,
  handleMcpReadOnlyToggle,
  handleOpenShortcutsPage,
  handlePickPocketImportFile,
  handlePickRaindropImportFile,
  handlePocketFileSelected,
  handleRaindropFileSelected,
  handleRestoreLatestSyncBackup,
  handleRunIncrementalSync,
  handleSelectionToolbarToggle,
  handleSyncToggle,
  hasOrphanOwners,
  hostedQuotaError,
  hostedQuotaLoading,
  hostedQuotaText,
  mcpReadOnlyEnabled,
  openDeleteAccountDialog,
  openExternalUrl,
  openShortcutsError,
  openSignOutDialog,
  openingShortcuts,
  orphanActiveCount,
  orphanBucketCount,
  orphanWorking,
  privacyPolicyUrl,
  restoringSyncBackup,
  runningIncrementalSync,
  savingAiFeatures,
  savingChromeBookmarkIngest,
  savingMcpReadOnly,
  savingSelectionToolbar,
  savingSync,
  selectionToolbarEnabled,
  settingsError,
  settingsState,
  signedIn,
  signingOut,
  subscriptionError,
  subscriptionIsPro,
  subscriptionManageUrl,
  subscriptionPlanRowTitle,
  subscriptionUpgradeUrl,
  syncEnabled,
  syncLastPulledAt,
  syncLocalCount,
  syncRemoteCount,
  t,
  termsOfServiceUrl,
  thirdPartyImportWorking
} = inject<SettingsPageController>('settingsPage')!
</script>

<template>
  <template v-if="activeSection === 'capture'">
    <div class="settings-block" aria-labelledby="settings-capture-heading">
      <div class="settings-section-head">
        <h2 id="settings-capture-heading" class="settings-section-title">
          {{ t('settings_section_capture') }}
        </h2>
        <p class="settings-section-copy">{{ t('settings_section_capture_copy') }}</p>
      </div>

      <p v-if="settingsState === 'loading'" class="settings-status" role="status">
        {{ t('settings_loading') }}
      </p>
      <p v-else-if="settingsState === 'error'" class="settings-error" role="alert">
        {{ settingsError }}
      </p>

      <template v-else>
        <div class="settings-card-stack">
          <div class="settings-toggle">
            <div class="settings-toggle-copy">
              <span class="settings-toggle-title">{{
                t('settings_toggle_selection_toolbar')
              }}</span>
              <span class="settings-toggle-hint">{{
                t('settings_toggle_selection_toolbar_hint')
              }}</span>
            </div>
            <AppSwitch
              :aria-label="t('settings_toggle_selection_toolbar')"
              :model-value="selectionToolbarEnabled"
              :disabled="savingSelectionToolbar"
              @update:model-value="handleSelectionToolbarToggle"
            />
          </div>
          <div class="settings-toggle">
            <div class="settings-toggle-copy">
              <span class="settings-toggle-title">{{
                t('settings_toggle_chrome_bookmark_ingest')
              }}</span>
              <span class="settings-toggle-hint">{{
                t('settings_toggle_chrome_bookmark_ingest_hint')
              }}</span>
            </div>
            <AppSwitch
              :aria-label="t('settings_toggle_chrome_bookmark_ingest')"
              :model-value="chromeBookmarkIngestEnabled"
              :disabled="savingChromeBookmarkIngest"
              @update:model-value="handleChromeBookmarkIngestToggle"
            />
          </div>
        </div>
      </template>
      <p v-if="settingsState === 'ready' && settingsError" class="settings-error" role="alert">
        {{ settingsError }}
      </p>
    </div>
  </template>

  <template v-else-if="activeSection === 'shortcuts'">
    <div class="settings-block" aria-labelledby="settings-shortcuts-heading">
      <div class="settings-section-head">
        <h2 id="settings-shortcuts-heading" class="settings-section-title">
          {{ t('settings_section_shortcuts') }}
        </h2>
        <p class="settings-section-copy">{{ t('settings_section_shortcuts_copy') }}</p>
      </div>

      <p v-if="commandsState === 'loading'" class="settings-status" role="status">
        {{ t('settings_commands_loading') }}
      </p>
      <p v-else-if="commandsState === 'error'" class="settings-error" role="alert">
        {{ commandsError }}
      </p>

      <template v-else>
        <ul class="settings-command-list">
          <li v-for="row in commandRows" :key="row.name" class="settings-command-row">
            <div class="settings-command-meta">
              <p class="settings-command-title">{{ row.title }}</p>
            </div>
            <p
              class="settings-command-shortcut"
              :class="{ 'settings-command-shortcut--unbound': row.unbound }"
            >
              {{ row.shortcutLabel }}
            </p>
          </li>
        </ul>

        <SettingsActionRow
          :title="t('settings_open_shortcuts')"
          :subtitle="t('settings_shortcuts_open_hint')"
        >
          <AppButton
            type="button"
            :disabled="openingShortcuts"
            :title="t('settings_open_shortcuts')"
            variant="outlined"
            @click="handleOpenShortcutsPage"
          >
            {{
              openingShortcuts
                ? t('settings_opening_shortcuts')
                : t('settings_open_shortcuts_action')
            }}
          </AppButton>
        </SettingsActionRow>
      </template>
      <p v-if="openShortcutsError" class="settings-error" role="alert">
        {{ openShortcutsError }}
      </p>
    </div>
  </template>

  <template v-else-if="activeSection === 'account_sync'">
    <div class="settings-block" aria-labelledby="settings-sync-heading">
      <div class="settings-section-head">
        <h2 id="settings-sync-heading" class="settings-section-title">
          {{ t('settings_section_sync') }}
        </h2>
        <p class="settings-section-copy">{{ t('settings_section_sync_copy') }}</p>
      </div>

      <div class="settings-toggle">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_sync_toggle') }}</span>
          <span class="settings-toggle-hint">{{ t('settings_sync_toggle_hint') }}</span>
        </div>
        <AppSwitch
          :aria-label="t('settings_sync_toggle')"
          :model-value="syncEnabled"
          :disabled="savingSync || !signedIn || !subscriptionIsPro"
          @update:model-value="handleSyncToggle"
        />
      </div>
      <p v-if="signedIn && !subscriptionIsPro" class="settings-status" role="status">
        {{ t('settings_sync_pro_required_hint') }}
      </p>

      <div v-if="signedIn" class="settings-status-strip">
        <p class="settings-status-strip__line">
          {{ t('settings_sync_local_count', [String(syncLocalCount)]) }}
          ·
          {{ t('settings_sync_remote_count', [String(syncRemoteCount)]) }}
          <template v-if="syncEnabled && syncLastPulledAt">
            ·
            {{ t('settings_sync_last_pulled', [syncLastPulledAt]) }}
          </template>
        </p>
        <p
          v-if="accountDisplayName || accountEmail"
          class="settings-status-strip__line settings-status-strip__line--account"
        >
          {{ accountDisplayName || accountEmail }}
          <template v-if="accountDisplayName && accountEmail"> · {{ accountEmail }}</template>
        </p>
      </div>
      <p v-else class="settings-status">{{ t('settings_sync_sign_in_required') }}</p>

      <div v-if="signedIn && syncEnabled" class="settings-actions">
        <AppButton
          type="button"
          :disabled="runningIncrementalSync || savingSync || signingOut || orphanWorking"
          :title="t('settings_sync_now')"
          variant="outlined"
          @click="handleRunIncrementalSync"
        >
          {{ runningIncrementalSync ? t('settings_sync_now_working') : t('settings_sync_now') }}
        </AppButton>
      </div>

      <div class="settings-subsection" aria-labelledby="settings-subscription-heading">
        <h3 id="settings-subscription-heading" class="settings-subsection-title">
          {{ t('settings_subscription_title') }}
        </h3>
        <SettingsActionRow
          v-if="signedIn"
          :title="subscriptionPlanRowTitle"
          :subtitle="t('settings_subscription_hybrid_hint')"
        >
          <AppButton
            v-if="!subscriptionIsPro && subscriptionUpgradeUrl"
            type="button"
            :title="t('settings_subscription_upgrade')"
            variant="outlined"
            @click="openExternalUrl(subscriptionUpgradeUrl)"
          >
            {{ t('settings_subscription_upgrade') }}
          </AppButton>
          <AppButton
            v-else-if="subscriptionIsPro && subscriptionManageUrl"
            type="button"
            :title="t('settings_subscription_manage')"
            variant="outlined"
            @click="openExternalUrl(subscriptionManageUrl)"
          >
            {{ t('settings_subscription_manage') }}
          </AppButton>
        </SettingsActionRow>
        <p v-else class="settings-status">{{ t('settings_subscription_sign_in_hint') }}</p>
        <p v-if="subscriptionError" class="settings-error" role="alert">
          {{ subscriptionError }}
        </p>
      </div>

      <div v-if="signedIn" class="settings-subsection" aria-labelledby="settings-advanced-heading">
        <h3 id="settings-advanced-heading" class="settings-subsection-title">
          {{ t('settings_section_advanced') }}
        </h3>
        <div class="settings-card-stack">
          <SettingsActionRow
            :title="t('settings_sync_restore_backup')"
            :subtitle="t('settings_sync_restore_backup_hint')"
          >
            <AppButton
              type="button"
              :disabled="
                restoringSyncBackup ||
                savingSync ||
                signingOut ||
                orphanWorking ||
                runningIncrementalSync
              "
              :title="t('settings_sync_restore_backup')"
              variant="outlined"
              @click="handleRestoreLatestSyncBackup"
            >
              {{
                restoringSyncBackup
                  ? t('settings_orphan_working')
                  : t('settings_sync_restore_backup_action')
              }}
            </AppButton>
          </SettingsActionRow>

          <div v-if="hasOrphanOwners" class="settings-orphan">
            <p class="settings-orphan-title">{{ t('settings_orphan_title') }}</p>
            <p class="settings-section-copy settings-orphan-copy">
              {{
                t('settings_orphan_copy', [String(orphanBucketCount), String(orphanActiveCount)])
              }}
            </p>
            <div class="settings-actions">
              <AppButton
                type="button"
                :disabled="orphanWorking || signingOut || savingSync"
                :title="t('settings_orphan_export')"
                variant="outlined"
                @click="handleExportOrphans"
              >
                {{ orphanWorking ? t('settings_orphan_working') : t('settings_orphan_export') }}
              </AppButton>
              <AppButton
                type="button"
                :disabled="orphanWorking || signingOut || savingSync"
                :title="t('settings_orphan_clear')"
                variant="outlined"
                @click="handleClearOrphans"
              >
                {{ orphanWorking ? t('settings_orphan_working') : t('settings_orphan_clear') }}
              </AppButton>
            </div>
          </div>
        </div>
      </div>

      <div v-if="signedIn" class="settings-actions settings-actions--spaced">
        <AppButton
          type="button"
          :disabled="signingOut || savingSync || orphanWorking"
          :title="t('settings_account_sign_out')"
          variant="outlined"
          @click="openSignOutDialog"
        >
          {{ signingOut ? t('settings_account_signing_out') : t('settings_account_sign_out') }}
        </AppButton>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'data'">
    <div class="settings-block" aria-labelledby="settings-data-heading">
      <div class="settings-section-head">
        <h2 id="settings-data-heading" class="settings-section-title">
          {{ t('settings_tab_data') }}
        </h2>
        <p class="settings-section-copy">{{ t('settings_data_intro') }}</p>
      </div>

      <div class="settings-card-stack">
        <SettingsActionRow
          :title="t('settings_privacy_export')"
          :subtitle="t('settings_privacy_export_hint')"
        >
          <AppButton
            type="button"
            :disabled="exportWorking || dataWorking || thirdPartyImportWorking || signingOut"
            :title="t('settings_privacy_export')"
            variant="outlined"
            @click="handleExportLocalMemory"
          >
            {{
              exportWorking ? t('settings_privacy_working') : t('settings_privacy_export_action')
            }}
          </AppButton>
        </SettingsActionRow>

        <SettingsActionRow
          :title="t('settings_data_import_raindrop')"
          :subtitle="t('settings_data_import_raindrop_hint')"
        >
          <input
            :ref="bindRaindropFileInput"
            type="file"
            class="settings-file-input"
            accept=".html,.htm,.csv,.json,text/html,text/csv,application/json"
            :aria-label="t('settings_data_import_raindrop')"
            @change="handleRaindropFileSelected"
          />
          <AppButton
            type="button"
            :disabled="thirdPartyImportWorking || dataWorking || exportWorking || signingOut"
            :title="t('settings_data_import_raindrop')"
            variant="outlined"
            @click="handlePickRaindropImportFile"
          >
            {{
              thirdPartyImportWorking
                ? t('settings_privacy_working')
                : t('settings_data_import_action')
            }}
          </AppButton>
        </SettingsActionRow>

        <SettingsActionRow
          :title="t('settings_data_import_pocket')"
          :subtitle="t('settings_data_import_pocket_hint')"
        >
          <input
            :ref="bindPocketFileInput"
            type="file"
            class="settings-file-input"
            accept=".html,.htm,text/html"
            :aria-label="t('settings_data_import_pocket')"
            @change="handlePocketFileSelected"
          />
          <AppButton
            type="button"
            :disabled="thirdPartyImportWorking || dataWorking || exportWorking || signingOut"
            :title="t('settings_data_import_pocket')"
            variant="outlined"
            @click="handlePickPocketImportFile"
          >
            {{
              thirdPartyImportWorking
                ? t('settings_privacy_working')
                : t('settings_data_import_action')
            }}
          </AppButton>
        </SettingsActionRow>

        <SettingsActionRow
          :title="t('settings_data_clear_local')"
          :subtitle="t('settings_data_clear_local_hint')"
        >
          <AppButton
            type="button"
            :disabled="dataWorking || exportWorking || thirdPartyImportWorking || signingOut"
            :title="t('settings_data_clear_local')"
            variant="outlined"
            @click="handleClearLocalMemory"
          >
            {{
              dataWorking ? t('settings_privacy_working') : t('settings_data_clear_local_action')
            }}
          </AppButton>
        </SettingsActionRow>

        <template v-if="signedIn">
          <SettingsActionRow
            :title="t('settings_privacy_delete_cloud')"
            :subtitle="t('settings_privacy_delete_cloud_hint')"
            tone="danger"
          >
            <AppButton
              type="button"
              :disabled="dataWorking || signingOut || savingSync"
              :title="t('settings_privacy_delete_cloud')"
              variant="outlined"
              tone="danger"
              @click="handleDeleteCloudMemory"
            >
              {{
                dataWorking
                  ? t('settings_privacy_working')
                  : t('settings_privacy_delete_cloud_action')
              }}
            </AppButton>
          </SettingsActionRow>

          <SettingsActionRow
            :title="t('settings_privacy_delete_account')"
            :subtitle="t('settings_privacy_delete_account_hint')"
            tone="danger"
          >
            <AppButton
              type="button"
              tone="danger"
              :disabled="dataWorking || signingOut || savingSync"
              :title="t('settings_privacy_delete_account')"
              variant="outlined"
              @click="openDeleteAccountDialog"
            >
              {{
                dataWorking
                  ? t('settings_privacy_working')
                  : t('settings_privacy_delete_account_action')
              }}
            </AppButton>
          </SettingsActionRow>
        </template>
      </div>
      <p v-if="!signedIn" class="settings-status">
        {{ t('settings_privacy_delete_cloud_sign_in') }}
      </p>
    </div>
  </template>

  <template v-else-if="activeSection === 'privacy'">
    <div class="settings-block" aria-labelledby="settings-privacy-heading">
      <div class="settings-section-head">
        <h2 id="settings-privacy-heading" class="settings-section-title">
          {{ t('settings_tab_privacy') }}
        </h2>
        <p class="settings-section-copy">{{ t('settings_privacy_intro') }}</p>
      </div>

      <details class="settings-details">
        <summary class="settings-details__summary">
          <span class="settings-details__summary-label">
            {{ t('settings_privacy_details_summary') }}
          </span>
          <span class="settings-details__chevrons" aria-hidden="true">
            <AppIcon
              class="settings-details__chevron settings-details__chevron--down"
              name="expand_more"
              size="18px"
            />
            <AppIcon
              class="settings-details__chevron settings-details__chevron--up"
              name="chevron_up"
              size="18px"
            />
          </span>
        </summary>
        <ul class="settings-details__list">
          <li>{{ t('settings_privacy_bullet_local') }}</li>
          <li>{{ t('settings_privacy_bullet_ownership') }}</li>
          <li>{{ t('settings_privacy_bullet_export') }}</li>
          <li>{{ t('settings_privacy_bullet_cloud') }}</li>
          <li>{{ t('settings_privacy_bullet_account') }}</li>
          <li>{{ t('settings_privacy_bullet_ai') }}</li>
          <li>{{ t('settings_privacy_bullet_not_collected') }}</li>
        </ul>
      </details>

      <div class="settings-toggle settings-card-stack--spaced">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_mcp_toggle') }}</span>
          <span class="settings-toggle-hint">{{ t('settings_mcp_toggle_hint') }}</span>
        </div>
        <AppSwitch
          :model-value="mcpReadOnlyEnabled"
          :disabled="savingMcpReadOnly || settingsState !== 'ready'"
          :aria-label="t('settings_mcp_toggle')"
          @update:model-value="handleMcpReadOnlyToggle"
        />
      </div>

      <p v-if="mcpReadOnlyEnabled" class="settings-section-copy">
        {{ t('settings_mcp_howto') }}
      </p>

      <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>

      <div class="settings-card-stack settings-card-stack--spaced">
        <SettingsActionRow
          :title="t('settings_privacy_open_policy')"
          :subtitle="t('settings_privacy_open_policy_hint')"
        >
          <AppButton
            :href="privacyPolicyUrl"
            :title="t('settings_privacy_open_policy')"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
          >
            {{ t('settings_privacy_open_policy_action') }}
          </AppButton>
        </SettingsActionRow>
        <SettingsActionRow
          :title="t('settings_privacy_open_terms')"
          :subtitle="t('settings_privacy_open_terms_hint')"
        >
          <AppButton
            :href="termsOfServiceUrl"
            :title="t('settings_privacy_open_terms')"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
          >
            {{ t('settings_privacy_open_terms_action') }}
          </AppButton>
        </SettingsActionRow>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'ai'">
    <div class="settings-block" aria-labelledby="settings-ai-heading">
      <div class="settings-section-head">
        <h2 id="settings-ai-heading" class="settings-section-title">
          {{ t('settings_tab_ai') }}
        </h2>
        <p class="settings-section-copy">{{ t('settings_ai_intro') }}</p>
      </div>

      <div class="settings-toggle">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_ai_toggle') }}</span>
          <span class="settings-toggle-hint">{{ t('settings_ai_toggle_hint') }}</span>
        </div>
        <AppSwitch
          :model-value="aiFeaturesEnabled"
          :disabled="savingAiFeatures || settingsState !== 'ready'"
          :aria-label="t('settings_ai_toggle')"
          @update:model-value="handleAiFeaturesToggle"
        />
      </div>

      <details class="settings-details">
        <summary class="settings-details__summary">
          <span class="settings-details__summary-label">
            {{ t('settings_ai_details_summary') }}
          </span>
          <span class="settings-details__chevrons" aria-hidden="true">
            <AppIcon
              class="settings-details__chevron settings-details__chevron--down"
              name="expand_more"
              size="18px"
            />
            <AppIcon
              class="settings-details__chevron settings-details__chevron--up"
              name="chevron_up"
              size="18px"
            />
          </span>
        </summary>
        <p class="settings-details__lead">{{ t('settings_ai_model_note') }}</p>
        <ul class="settings-details__list">
          <li>{{ t('settings_ai_bullet_clue') }}</li>
          <li>{{ t('settings_ai_bullet_enrichment') }}</li>
          <li>{{ t('settings_ai_bullet_boundary') }}</li>
        </ul>
      </details>

      <div
        v-if="hostedQuotaLoading || hostedQuotaText || hostedQuotaError"
        class="settings-status-strip settings-status-strip--spaced"
      >
        <p v-if="hostedQuotaLoading" class="settings-status-strip__line" role="status">
          {{ t('settings_ai_quota_loading') }}
        </p>
        <p v-else-if="hostedQuotaText" class="settings-status-strip__line" role="status">
          {{ hostedQuotaText }}
        </p>
        <p v-if="hostedQuotaError" class="settings-status-strip__line settings-error" role="alert">
          {{ hostedQuotaError }}
        </p>
      </div>

      <div class="settings-card-stack settings-card-stack--spaced">
        <SettingsActionRow
          :title="t('settings_privacy_open_policy')"
          :subtitle="t('settings_privacy_open_policy_hint')"
        >
          <AppButton
            :href="privacyPolicyUrl"
            :title="t('settings_privacy_open_policy')"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
          >
            {{ t('settings_privacy_open_policy_action') }}
          </AppButton>
        </SettingsActionRow>
      </div>

      <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
    </div>
  </template>
</template>

<style scoped src="./settings-panel.css"></style>
