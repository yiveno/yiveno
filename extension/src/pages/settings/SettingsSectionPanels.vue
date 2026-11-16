<script setup lang="ts">
import { inject, type ComponentPublicInstance } from 'vue'
import { SETTINGS_HASH_CHROME_BOOKMARK_INGEST } from '@/core/settings/settings-sections'
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

function bindRestoreFileInput(el: Element | ComponentPublicInstance | null): void {
  page.restoreFileInputRef.value = el as HTMLInputElement | null
}

const {
  accountDisplayName,
  accountEmail,
  activeSection,
  aiFeaturesEnabled,
  linkStatusSweepEnabled,
  chromeBookmarkIngestEnabled,
  chromeBookmarkSyncEnabled,
  commandRows,
  commandsError,
  commandsState,
  dataWorking,
  exportWorking,
  handleAiFeaturesToggle,
  handleLinkStatusSweepToggle,
  handleChromeBookmarkSyncToggle,
  handleReimportChromeBookmarks,
  handleClearLocalMemory,
  handleClearLocalRecallAdaptation,
  handleClearOrphans,
  handleDeleteThirdPartyCorpus,
  handleRecallOutcomePairSoftAdjustToggle,
  handleDeleteCloudMemory,
  handleExportLocalMemory,
  handleExportOrphans,
  handleMcpReadOnlyToggle,
  handleOpenShortcutsPage,
  handlePickPocketImportFile,
  handlePickRaindropImportFile,
  handlePickRestoreBackupFile,
  handlePocketFileSelected,
  handleRaindropFileSelected,
  handleRestoreBackupFileSelected,
  handleRestoreLatestSyncBackup,
  handleRunIncrementalSync,
  handleSelectionToolbarToggle,
  handleSyncToggle,
  handleUiLocalePreferenceChange,
  hasOrphanOwners,
  hostedQuotaError,
  hostedQuotaLoading,
  hostedQuotaText,
  mcpReadOnlyEnabled,
  recallOutcomePairSoftAdjustEnabled,
  openDeleteAccountDialog,
  openShortcutsError,
  openSignOutDialog,
  openingShortcuts,
  orphanActiveCount,
  orphanBucketCount,
  orphanWorking,
  faqUrl,
  pricingUrl,
  privacyPolicyUrl,
  restoreWorking,
  supportUrl,
  restoringSyncBackup,
  runningIncrementalSync,
  savingAiFeatures,
  savingLinkStatusSweep,
  savingChromeBookmarkSync,
  reimportChromeBookmarksBusy,
  reimportChromeBookmarksDone,
  savingMcpReadOnly,
  savingRecallOutcomeSoftAdjust,
  savingSelectionToolbar,
  savingSync,
  savingUiLocale,
  selectionToolbarEnabled,
  uiLocalePreference,
  settingsError,
  settingsState,
  signedIn,
  signingOut,
  subscriptionIsPro,
  syncEnabled,
  syncLastPulledAt,
  syncLocalCount,
  syncRemoteCount,
  t,
  termsOfServiceUrl,
  thirdPartyCorpusSummary,
  thirdPartyDeleteWorking,
  thirdPartyImportWorking,
  thirdPartySourceStatusCopy
} = inject<SettingsPageController>('settingsPage')!
</script>

<template>
  <template v-if="activeSection === 'capture'">
    <div class="settings-block" aria-labelledby="settings-capture-heading">
      <div class="settings-section-head">
        <h2 id="settings-capture-heading" class="settings-section-title">
          {{ t('settings_section_capture') }}
        </h2>
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
            </div>
            <AppSwitch
              :aria-label="t('settings_toggle_selection_toolbar')"
              :model-value="selectionToolbarEnabled"
              :disabled="savingSelectionToolbar"
              @update:model-value="handleSelectionToolbarToggle"
            />
          </div>
          <div :id="SETTINGS_HASH_CHROME_BOOKMARK_INGEST" class="settings-toggle">
            <div class="settings-toggle-copy">
              <span class="settings-toggle-title">{{
                t('settings_toggle_chrome_bookmark_sync')
              }}</span>
            </div>
            <AppSwitch
              :aria-label="t('settings_toggle_chrome_bookmark_sync')"
              :model-value="chromeBookmarkSyncEnabled"
              :disabled="savingChromeBookmarkSync"
              @update:model-value="handleChromeBookmarkSyncToggle"
            />
          </div>
          <div v-if="chromeBookmarkIngestEnabled" class="settings-toggle">
            <div class="settings-toggle-copy">
              <span class="settings-toggle-title">{{
                t('settings_action_reimport_chrome_bookmarks')
              }}</span>
              <span v-if="reimportChromeBookmarksDone" class="settings-toggle-hint" role="status">
                {{ t('settings_reimport_chrome_bookmarks_done') }}
              </span>
            </div>
            <AppButton
              type="button"
              variant="tonal"
              :disabled="reimportChromeBookmarksBusy"
              :aria-label="t('settings_action_reimport_chrome_bookmarks')"
              @click="handleReimportChromeBookmarks"
            >
              {{ t('settings_action_reimport_chrome_bookmarks') }}
            </AppButton>
          </div>
        </div>
      </template>
      <p v-if="settingsState === 'ready' && settingsError" class="settings-error" role="alert">
        {{ settingsError }}
      </p>
    </div>
  </template>

  <template v-else-if="activeSection === 'third_party'">
    <div class="settings-block" aria-labelledby="settings-third-party-heading">
      <div class="settings-section-head">
        <h2 id="settings-third-party-heading" class="settings-section-title">
          {{ t('settings_tab_third_party') }}
        </h2>
      </div>

      <section class="settings-group" :aria-label="t('settings_data_import_raindrop')">
        <h3 class="settings-group__label">{{ t('settings_data_import_raindrop') }}</h3>
        <div class="settings-group__card">
          <SettingsActionRow surface="embedded" :title="t('settings_data_import_raindrop')">
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
              :disabled="
                thirdPartyImportWorking ||
                restoreWorking ||
                dataWorking ||
                exportWorking ||
                signingOut
              "
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
          <p class="settings-section-copy settings-third-party-status" role="status">
            {{ thirdPartySourceStatusCopy('raindrop') }}
          </p>
          <SettingsActionRow surface="embedded" :title="t('settings_third_party_delete_all')">
            <AppButton
              type="button"
              variant="outlined"
              :disabled="
                (thirdPartyCorpusSummary?.raindrop.count ?? 0) <= 0 ||
                thirdPartyDeleteWorking ||
                thirdPartyImportWorking ||
                dataWorking ||
                signingOut
              "
              :title="t('settings_third_party_delete_all')"
              @click="handleDeleteThirdPartyCorpus('raindrop')"
            >
              {{
                thirdPartyDeleteWorking
                  ? t('settings_privacy_working')
                  : t('settings_third_party_delete_all')
              }}
            </AppButton>
          </SettingsActionRow>
        </div>
      </section>

      <section class="settings-group" :aria-label="t('settings_data_import_pocket')">
        <h3 class="settings-group__label">{{ t('settings_data_import_pocket') }}</h3>
        <div class="settings-group__card">
          <SettingsActionRow surface="embedded" :title="t('settings_data_import_pocket')">
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
              :disabled="
                thirdPartyImportWorking ||
                restoreWorking ||
                dataWorking ||
                exportWorking ||
                signingOut
              "
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
          <p class="settings-section-copy settings-third-party-status" role="status">
            {{ thirdPartySourceStatusCopy('pocket') }}
          </p>
          <SettingsActionRow surface="embedded" :title="t('settings_third_party_delete_all')">
            <AppButton
              type="button"
              variant="outlined"
              :disabled="
                (thirdPartyCorpusSummary?.pocket.count ?? 0) <= 0 ||
                thirdPartyDeleteWorking ||
                thirdPartyImportWorking ||
                dataWorking ||
                signingOut
              "
              :title="t('settings_third_party_delete_all')"
              @click="handleDeleteThirdPartyCorpus('pocket')"
            >
              {{
                thirdPartyDeleteWorking
                  ? t('settings_privacy_working')
                  : t('settings_third_party_delete_all')
              }}
            </AppButton>
          </SettingsActionRow>
        </div>
      </section>
    </div>
  </template>

  <template v-else-if="activeSection === 'shortcuts'">
    <div class="settings-block" aria-labelledby="settings-shortcuts-heading">
      <div class="settings-section-head">
        <h2 id="settings-shortcuts-heading" class="settings-section-title">
          {{ t('settings_section_shortcuts') }}
        </h2>
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

        <SettingsActionRow :title="t('settings_open_shortcuts')">
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
      </div>

      <div
        class="settings-toggle"
        :title="!signedIn ? t('settings_sync_sign_in_required') : undefined"
      >
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_sync_toggle') }}</span>
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

      <div v-if="signedIn" class="settings-subsection" aria-labelledby="settings-advanced-heading">
        <h3 id="settings-advanced-heading" class="settings-subsection-title">
          {{ t('settings_section_advanced') }}
        </h3>
        <div class="settings-card-stack">
          <SettingsActionRow :title="t('settings_sync_restore_backup')">
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

  <template v-else-if="activeSection === 'privacy'">
    <div class="settings-block" aria-labelledby="settings-privacy-heading">
      <div class="settings-section-head">
        <h2 id="settings-privacy-heading" class="settings-section-title">
          {{ t('settings_tab_privacy') }}
        </h2>
      </div>

      <!-- 隐私说明卡置顶；完整披露正文在官网 /privacy -->
      <aside class="settings-privacy-banner" aria-labelledby="settings-privacy-banner-title">
        <AppIcon class="settings-privacy-banner__icon" name="shield_user" size="28px" />
        <div class="settings-privacy-banner__copy">
          <p id="settings-privacy-banner-title" class="settings-privacy-banner__title">
            {{ t('settings_privacy_banner_title') }}
          </p>
          <a
            class="settings-privacy-banner__link"
            :href="privacyPolicyUrl"
            :title="t('settings_privacy_open_policy')"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings_privacy_banner_learn_more') }}
          </a>
        </div>
      </aside>

      <div class="settings-toggle settings-card-stack--spaced">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_mcp_toggle') }}</span>
        </div>
        <AppSwitch
          :model-value="mcpReadOnlyEnabled"
          :disabled="savingMcpReadOnly || settingsState !== 'ready'"
          :aria-label="t('settings_mcp_toggle')"
          @update:model-value="handleMcpReadOnlyToggle"
        />
      </div>

      <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>

      <div class="settings-card-stack settings-card-stack--spaced">
        <section class="settings-group" :aria-label="t('settings_data_group_backup')">
          <h3 class="settings-group__label">{{ t('settings_data_group_backup') }}</h3>
          <div class="settings-group__card">
            <SettingsActionRow surface="embedded" :title="t('settings_privacy_export')">
              <AppButton
                type="button"
                :disabled="
                  exportWorking ||
                  restoreWorking ||
                  dataWorking ||
                  thirdPartyImportWorking ||
                  signingOut
                "
                :title="t('settings_privacy_export')"
                variant="outlined"
                @click="handleExportLocalMemory"
              >
                {{
                  exportWorking
                    ? t('settings_privacy_working')
                    : t('settings_privacy_export_action')
                }}
              </AppButton>
            </SettingsActionRow>
            <SettingsActionRow surface="embedded" :title="t('settings_privacy_restore')">
              <input
                :ref="bindRestoreFileInput"
                type="file"
                class="settings-file-input"
                accept=".json,application/json"
                :aria-label="t('settings_privacy_restore')"
                @change="handleRestoreBackupFileSelected"
              />
              <AppButton
                type="button"
                :disabled="
                  restoreWorking ||
                  exportWorking ||
                  dataWorking ||
                  thirdPartyImportWorking ||
                  signingOut
                "
                :title="t('settings_privacy_restore')"
                variant="outlined"
                @click="handlePickRestoreBackupFile"
              >
                {{
                  restoreWorking
                    ? t('settings_privacy_working')
                    : t('settings_privacy_restore_action')
                }}
              </AppButton>
            </SettingsActionRow>
          </div>
        </section>

        <section class="settings-group" :aria-label="t('settings_data_group_adaptation')">
          <h3 class="settings-group__label">{{ t('settings_data_group_adaptation') }}</h3>
          <div class="settings-group__card">
            <div class="settings-toggle">
              <div class="settings-toggle-copy">
                <span class="settings-toggle-title">{{
                  t('settings_data_outcome_soft_adjust_toggle')
                }}</span>
              </div>
              <AppSwitch
                :model-value="recallOutcomePairSoftAdjustEnabled"
                :disabled="
                  savingRecallOutcomeSoftAdjust || dataWorking || settingsState !== 'ready'
                "
                :aria-label="t('settings_data_outcome_soft_adjust_toggle')"
                @update:model-value="handleRecallOutcomePairSoftAdjustToggle"
              />
            </div>
            <SettingsActionRow
              surface="embedded"
              :title="t('settings_data_clear_recall_adaptation')"
            >
              <AppButton
                type="button"
                :disabled="
                  dataWorking ||
                  exportWorking ||
                  thirdPartyImportWorking ||
                  restoreWorking ||
                  signingOut
                "
                :title="t('settings_data_clear_recall_adaptation')"
                variant="outlined"
                @click="handleClearLocalRecallAdaptation"
              >
                {{
                  dataWorking
                    ? t('settings_privacy_working')
                    : t('settings_data_clear_recall_adaptation_action')
                }}
              </AppButton>
            </SettingsActionRow>
          </div>
        </section>

        <section class="settings-group" :aria-label="t('settings_data_group_remove')">
          <h3 class="settings-group__label">{{ t('settings_data_group_remove') }}</h3>
          <div class="settings-group__card settings-group__card--danger">
            <SettingsActionRow
              surface="embedded"
              tone="danger"
              :title="t('settings_data_clear_local')"
            >
              <AppButton
                type="button"
                :disabled="
                  dataWorking ||
                  exportWorking ||
                  thirdPartyImportWorking ||
                  restoreWorking ||
                  signingOut
                "
                :title="t('settings_data_clear_local')"
                variant="outlined"
                tone="danger"
                @click="handleClearLocalMemory"
              >
                {{
                  dataWorking
                    ? t('settings_privacy_working')
                    : t('settings_data_clear_local_action')
                }}
              </AppButton>
            </SettingsActionRow>
            <template v-if="signedIn">
              <SettingsActionRow
                surface="embedded"
                tone="danger"
                :title="t('settings_privacy_delete_cloud')"
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
                surface="embedded"
                tone="danger"
                :title="t('settings_privacy_delete_account')"
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
        </section>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'help'">
    <div class="settings-block" aria-labelledby="settings-help-heading">
      <div class="settings-section-head">
        <h2 id="settings-help-heading" class="settings-section-title">
          {{ t('settings_tab_help') }}
        </h2>
      </div>

      <!-- FAQ + Contact（官网 `/faq`；Support 软跳 `/faq#contact`） -->
      <div class="settings-group">
        <div class="settings-group__card">
          <SettingsActionRow surface="embedded" :title="t('settings_legal_link_faq')">
            <a
              class="settings-external-link"
              :href="faqUrl"
              :title="t('settings_legal_link_faq')"
              :aria-label="t('settings_legal_link_faq')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </SettingsActionRow>
          <SettingsActionRow surface="embedded" :title="t('settings_legal_link_support')">
            <a
              class="settings-external-link"
              :href="supportUrl"
              :title="t('settings_legal_link_support')"
              :aria-label="t('settings_legal_link_support')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </SettingsActionRow>
        </div>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'legal'">
    <div class="settings-block" aria-labelledby="settings-legal-heading">
      <div class="settings-section-head">
        <h2 id="settings-legal-heading" class="settings-section-title">
          {{ t('settings_tab_legal') }}
        </h2>
      </div>

      <!-- 定价 / 隐私政策 / 服务条款 -->
      <div class="settings-group">
        <div class="settings-group__card">
          <SettingsActionRow surface="embedded" :title="t('settings_legal_link_pricing')">
            <a
              class="settings-external-link"
              :href="pricingUrl"
              :title="t('settings_legal_link_pricing')"
              :aria-label="t('settings_legal_link_pricing')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </SettingsActionRow>
          <SettingsActionRow surface="embedded" :title="t('settings_legal_link_privacy')">
            <a
              class="settings-external-link"
              :href="privacyPolicyUrl"
              :title="t('settings_legal_link_privacy')"
              :aria-label="t('settings_legal_link_privacy')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </SettingsActionRow>
          <SettingsActionRow surface="embedded" :title="t('settings_legal_link_terms')">
            <a
              class="settings-external-link"
              :href="termsOfServiceUrl"
              :title="t('settings_legal_link_terms')"
              :aria-label="t('settings_legal_link_terms')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </SettingsActionRow>
        </div>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'ai'">
    <div class="settings-block" aria-labelledby="settings-ai-heading">
      <div class="settings-section-head">
        <h2 id="settings-ai-heading" class="settings-section-title">
          {{ t('settings_tab_ai') }}
        </h2>
      </div>

      <div class="settings-toggle">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_ai_toggle') }}</span>
        </div>
        <AppSwitch
          :model-value="aiFeaturesEnabled"
          :disabled="savingAiFeatures || settingsState !== 'ready'"
          :aria-label="t('settings_ai_toggle')"
          @update:model-value="handleAiFeaturesToggle"
        />
      </div>

      <div class="settings-toggle settings-card-stack--spaced">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_link_sweep_toggle') }}</span>
        </div>
        <AppSwitch
          :model-value="linkStatusSweepEnabled"
          :disabled="savingLinkStatusSweep || settingsState !== 'ready'"
          :aria-label="t('settings_link_sweep_toggle')"
          @update:model-value="handleLinkStatusSweepToggle"
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

      <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
    </div>
  </template>

  <template v-else-if="activeSection === 'language'">
    <div class="settings-block" aria-labelledby="settings-language-heading">
      <div class="settings-section-head">
        <h2 id="settings-language-heading" class="settings-section-title">
          {{ t('settings_section_language') }}
        </h2>
      </div>

      <fieldset
        class="settings-language-fieldset"
        :disabled="savingUiLocale || settingsState !== 'ready'"
      >
        <legend class="settings-language-legend">{{ t('settings_language_legend') }}</legend>

        <label class="settings-language-option">
          <input
            type="radio"
            name="yiveno-ui-locale"
            value="system"
            :checked="uiLocalePreference === 'system'"
            @change="handleUiLocalePreferenceChange('system')"
          />
          <span class="settings-language-option__copy">
            <span class="settings-language-option__title">{{ t('settings_language_system') }}</span>
            <span class="settings-language-option__hint">{{
              t('settings_language_system_hint')
            }}</span>
          </span>
        </label>

        <label class="settings-language-option">
          <input
            type="radio"
            name="yiveno-ui-locale"
            value="en"
            :checked="uiLocalePreference === 'en'"
            @change="handleUiLocalePreferenceChange('en')"
          />
          <span class="settings-language-option__copy">
            <span class="settings-language-option__title">{{ t('settings_language_en') }}</span>
          </span>
        </label>

        <label class="settings-language-option">
          <input
            type="radio"
            name="yiveno-ui-locale"
            value="zh_CN"
            :checked="uiLocalePreference === 'zh_CN'"
            @change="handleUiLocalePreferenceChange('zh_CN')"
          />
          <span class="settings-language-option__copy">
            <span class="settings-language-option__title">{{ t('settings_language_zh_CN') }}</span>
          </span>
        </label>
      </fieldset>

      <p v-if="savingUiLocale" class="settings-status-strip__line" role="status">
        {{ t('settings_language_saving') }}
      </p>
      <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
    </div>
  </template>
</template>

<style scoped src="./settings-panel.css"></style>
