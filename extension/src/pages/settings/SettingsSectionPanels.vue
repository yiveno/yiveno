<script setup lang="ts">
import { inject, type ComponentPublicInstance } from 'vue'
import {
  SETTINGS_HASH_BEHAVIOR_IMPORT,
  SETTINGS_HASH_CHROME_BOOKMARK_SYNC
} from '@/core/settings/settings-sections'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import AppSwitch from '@/infrastructure/ui/AppSwitch.vue'
import SettingsActionRow from '@/pages/settings/SettingsActionRow.vue'
import SettingsThirdPartySourceGroup from '@/pages/settings/SettingsThirdPartySourceGroup.vue'
import {
  formatDualThreadLearningTimingMs,
  resolveDualThreadLearningLabel
} from '@/pages/settings/dual-thread-learning-label'
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
  websiteAccountMismatch,
  activeSection,
  aiFeaturesEnabled,
  linkStatusSweepEnabled,
  chromeBookmarkIngestEnabled,
  chromeBookmarkImportStatusCopy,
  chromeBookmarkImportStatusKind,
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
  handleImportBehaviorHistory,
  handleClearBehaviorHistory,
  handleSignIn,
  openBindOtpModal,
  handleRetryAnonymousCaptcha,
  isAnonymous,
  trialEmbedLimit,
  trialEmbedRemaining,
  trialLlmLimit,
  trialLlmRemaining,
  handleClearLocalMemory,
  handleClearLocalRecallAdaptation,
  handleClearOrphans,
  handleRecallOutcomePairSoftAdjustToggle,
  handleDeleteCloudMemory,
  handleExportLocalMemory,
  handleExportOrphans,
  handleMcpReadOnlyToggle,
  handleDualThreadLocalLearningToggle,
  handleDualThreadContributeToggle,
  handleDeleteDualThreadContributedSketches,
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
  dualThreadLocalLearningEnabled,
  dualThreadContributeAggregatesEnabled,
  dualThreadLearningSketch,
  dualThreadLearningLoading,
  dualThreadLearningError,
  dualThreadDeleteWorking,
  dualThreadDeleteError,
  dualThreadContributeDisabled,
  dualThreadContributeGateText,
  dualThreadLastContributionText,
  dualThreadLearningHasAttributions,
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
  loadCommands,
  loadThirdPartyCorpusSummary,
  loadUserSettings,
  reimportChromeBookmarksBusy,
  reimportChromeBookmarksDone,
  reimportChromeBookmarksDoneText,
  behaviorImportBusy,
  behaviorClearBusy,
  behaviorClearDone,
  behaviorImportStatusCopy,
  savingMcpReadOnly,
  savingRecallOutcomeSoftAdjust,
  savingDualThreadLocalLearning,
  savingSelectionToolbar,
  savingSync,
  savingUiLocale,
  selectionToolbarEnabled,
  uiLocalePreference,
  settingsError,
  settingsState,
  showAnonymousCaptchaRetry,
  retryingAnonymousCaptcha,
  signedIn,
  signingIn,
  signingOut,
  subscriptionIsPro,
  syncEnabled,
  syncLastPulledAt,
  syncLocalCount,
  syncRemoteCount,
  t,
  termsOfServiceUrl,
  thirdPartyCorpusSummary,
  thirdPartyImportWorking,
  thirdPartySummaryLoading
} = page
</script>

<template>
  <template v-if="activeSection === 'capture'">
    <div class="settings-block" aria-labelledby="settings-capture-heading">
      <div class="settings-section-head">
        <h2 id="settings-capture-heading" class="settings-section-title">
          {{ t('settings_tab_capture') }}
        </h2>
      </div>

      <p v-if="settingsState === 'loading'" class="settings-status" role="status">
        {{ t('settings_loading') }}
      </p>
      <template v-else-if="settingsState === 'error'">
        <div class="settings-card-stack">
          <p class="settings-error" role="alert">
            {{ settingsError }}
          </p>
          <AppButton type="button" variant="outlined" @click="loadUserSettings">
            {{ t('action_retry') }}
          </AppButton>
        </div>
      </template>

      <template v-else>
        <div class="settings-card-stack">
          <section class="settings-group" :aria-label="t('settings_tab_capture')">
            <div class="settings-group__card">
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
              <div :id="SETTINGS_HASH_CHROME_BOOKMARK_SYNC" class="settings-toggle">
                <div class="settings-toggle-copy">
                  <span class="settings-toggle-title">{{
                    t('settings_toggle_chrome_bookmark_sync')
                  }}</span>
                  <span class="settings-toggle-hint">{{
                    t('settings_chrome_bookmark_sync_intro')
                  }}</span>
                  <span v-if="chromeBookmarkSyncEnabled" class="settings-toggle-hint">{{
                    t('settings_chrome_bookmark_sync_off_note')
                  }}</span>
                </div>
                <AppSwitch
                  :aria-label="t('settings_toggle_chrome_bookmark_sync')"
                  :model-value="chromeBookmarkSyncEnabled"
                  :disabled="savingChromeBookmarkSync"
                  @update:model-value="handleChromeBookmarkSyncToggle"
                />
              </div>
              <p
                v-if="chromeBookmarkImportStatusKind !== 'none'"
                :class="[
                  chromeBookmarkImportStatusKind === 'query_failed' ||
                  chromeBookmarkImportStatusKind === 'failed'
                    ? 'settings-error'
                    : 'settings-section-copy',
                  'settings-group__status'
                ]"
                :role="
                  chromeBookmarkImportStatusKind === 'query_failed' ||
                  chromeBookmarkImportStatusKind === 'failed'
                    ? 'alert'
                    : 'status'
                "
              >
                {{ chromeBookmarkImportStatusCopy }}
              </p>
              <div v-if="chromeBookmarkIngestEnabled" class="settings-toggle">
                <div class="settings-toggle-copy">
                  <span class="settings-toggle-title">{{
                    t('settings_chrome_bookmark_reimport_title')
                  }}</span>
                  <span
                    v-if="reimportChromeBookmarksDone"
                    class="settings-toggle-hint"
                    role="status"
                  >
                    {{ reimportChromeBookmarksDoneText }}
                  </span>
                </div>
                <AppButton
                  type="button"
                  variant="tonal"
                  :disabled="reimportChromeBookmarksBusy"
                  @click="handleReimportChromeBookmarks"
                >
                  {{ t('settings_action_reimport_chrome_bookmarks') }}
                </AppButton>
              </div>
            </div>

            <div class="settings-card-stack">
              <section class="settings-group" :aria-label="t('settings_behavior_group_label')">
                <h3 class="settings-group__label">{{ t('settings_behavior_group_label') }}</h3>
                <div :id="SETTINGS_HASH_BEHAVIOR_IMPORT" class="settings-toggle">
                  <div class="settings-toggle-copy">
                    <span class="settings-toggle-title">{{
                      t('settings_behavior_import_title')
                    }}</span>
                    <span class="settings-toggle-hint">{{
                      t('settings_behavior_import_hint')
                    }}</span>
                    <span
                      v-if="behaviorImportStatusCopy"
                      class="settings-toggle-hint"
                      role="status"
                    >
                      {{ behaviorImportStatusCopy }}
                    </span>
                  </div>
                  <AppButton
                    type="button"
                    variant="tonal"
                    :disabled="behaviorImportBusy"
                    @click="handleImportBehaviorHistory"
                  >
                    {{ t('settings_behavior_import_action') }}
                  </AppButton>
                </div>
                <div class="settings-toggle">
                  <div class="settings-toggle-copy">
                    <span class="settings-toggle-title">{{
                      t('settings_behavior_clear_title')
                    }}</span>
                    <span class="settings-toggle-hint">{{
                      t('settings_behavior_clear_hint')
                    }}</span>
                    <span v-if="behaviorClearDone" class="settings-toggle-hint" role="status">
                      {{ t('settings_behavior_clear_done') }}
                    </span>
                  </div>
                  <AppButton
                    type="button"
                    variant="tonal"
                    :disabled="behaviorClearBusy"
                    @click="handleClearBehaviorHistory"
                  >
                    {{ t('settings_behavior_clear_action') }}
                  </AppButton>
                </div>
              </section>
            </div>
          </section>
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

      <div class="settings-card-stack">
        <SettingsThirdPartySourceGroup
          source="raindrop"
          title-key="settings_data_import_raindrop"
          guide-key="settings_third_party_import_raindrop_guide"
          accept=".html,.htm,.csv,.json,text/html,text/csv,application/json"
          :bind-file-input="bindRaindropFileInput"
          :on-pick-file="handlePickRaindropImportFile"
          :on-file-selected="handleRaindropFileSelected"
        />

        <SettingsThirdPartySourceGroup
          source="pocket"
          title-key="settings_data_import_pocket"
          guide-key="settings_third_party_import_pocket_guide"
          accept=".html,.htm,text/html"
          :bind-file-input="bindPocketFileInput"
          :on-pick-file="handlePickPocketImportFile"
          :on-file-selected="handlePocketFileSelected"
        />

        <AppButton
          v-if="thirdPartyCorpusSummary === null && !thirdPartySummaryLoading"
          type="button"
          variant="outlined"
          @click="loadThirdPartyCorpusSummary"
        >
          {{ t('action_retry') }}
        </AppButton>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'shortcuts'">
    <div class="settings-block" aria-labelledby="settings-shortcuts-heading">
      <div class="settings-section-head">
        <h2 id="settings-shortcuts-heading" class="settings-section-title">
          {{ t('settings_tab_shortcuts') }}
        </h2>
      </div>

      <p v-if="commandsState === 'loading'" class="settings-status" role="status">
        {{ t('settings_commands_loading') }}
      </p>
      <template v-else-if="commandsState === 'error'">
        <div class="settings-card-stack">
          <p class="settings-error" role="alert">
            {{ commandsError }}
          </p>
          <AppButton type="button" variant="outlined" @click="loadCommands">
            {{ t('action_retry') }}
          </AppButton>
        </div>
      </template>

      <template v-else>
        <div class="settings-card-stack">
          <section class="settings-group" :aria-label="t('settings_tab_shortcuts')">
            <div class="settings-group__card">
              <ul class="settings-command-list">
                <li v-for="row in commandRows" :key="row.name" class="settings-command-row">
                  <div class="settings-command-meta">
                    <p class="settings-command-title">{{ row.title }}</p>
                    <p v-if="row.unbound" class="settings-command-hint">
                      {{ t('settings_command_unbound_hint') }}
                    </p>
                    <p
                      v-if="
                        row.name === 'save_selection' || row.name === 'save_selection_with_note'
                      "
                      class="settings-command-hint"
                    >
                      {{ t('settings_command_selection_hint') }}
                    </p>
                  </div>
                  <p
                    class="settings-command-shortcut"
                    :class="{ 'settings-command-shortcut--unbound': row.unbound }"
                  >
                    {{ row.shortcutLabel }}
                  </p>
                </li>
              </ul>

              <SettingsActionRow surface="embedded" :title="t('settings_open_shortcuts')">
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
            </div>
          </section>
        </div>
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
          {{ t('settings_tab_account_sync') }}
        </h2>
      </div>

      <div class="settings-card-stack">
        <div v-if="!signedIn" class="settings-sign-in-row">
          <p class="settings-section-copy">{{ t('settings_account_sign_in_hint') }}</p>
          <AppButton type="button" variant="tonal" :disabled="signingIn" @click="handleSignIn">
            {{ t('nav_sign_in') }}
          </AppButton>
        </div>

        <div
          v-if="signedIn && isAnonymous"
          class="settings-card-stack"
          aria-labelledby="settings-trial-account-heading"
        >
          <div class="settings-toggle-copy">
            <span id="settings-trial-account-heading" class="settings-toggle-title">{{
              t('settings_trial_account_title')
            }}</span>
            <span class="settings-toggle-hint">{{ t('settings_trial_account_hint') }}</span>
          </div>
          <p
            v-if="trialLlmRemaining !== null && trialLlmLimit !== null"
            class="settings-section-copy"
            role="status"
          >
            {{ t('settings_trial_quota_llm', [String(trialLlmRemaining), String(trialLlmLimit)]) }}
          </p>
          <p
            v-if="trialEmbedRemaining !== null && trialEmbedLimit !== null"
            class="settings-section-copy"
            role="status"
          >
            {{
              t('settings_trial_quota_embed', [
                String(trialEmbedRemaining),
                String(trialEmbedLimit)
              ])
            }}
          </p>
          <div class="settings-actions">
            <AppButton
              type="button"
              variant="filled"
              :title="t('bind_otp_modal_trigger')"
              @click="openBindOtpModal"
            >
              {{ t('bind_otp_modal_trigger') }}
            </AppButton>
          </div>
        </div>

        <div
          v-if="showAnonymousCaptchaRetry"
          class="settings-card-stack"
          aria-labelledby="settings-anonymous-captcha-heading"
        >
          <div class="settings-toggle-copy">
            <span id="settings-anonymous-captcha-heading" class="settings-toggle-title">{{
              t('settings_anonymous_captcha_retry_title')
            }}</span>
            <span class="settings-toggle-hint">{{
              t('settings_anonymous_captcha_retry_hint')
            }}</span>
          </div>
          <AppButton
            type="button"
            variant="outlined"
            :disabled="retryingAnonymousCaptcha || signingIn"
            :title="t('settings_anonymous_captcha_retry_action')"
            @click="handleRetryAnonymousCaptcha"
          >
            {{
              retryingAnonymousCaptcha
                ? t('settings_anonymous_captcha_retry_working')
                : t('settings_anonymous_captcha_retry_action')
            }}
          </AppButton>
        </div>

        <section class="settings-group" :aria-label="t('settings_tab_account_sync')">
          <div class="settings-group__card">
            <div class="settings-toggle">
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
            <p
              v-if="signedIn && !subscriptionIsPro"
              class="settings-status settings-group__status"
              role="status"
            >
              {{ t('settings_sync_pro_required_hint') }}
              <a
                class="settings-privacy-banner__link"
                :href="pricingUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('settings_legal_link_pricing') }}
              </a>
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
                <template v-if="accountDisplayName && accountEmail">
                  · {{ accountEmail }}
                </template>
              </p>
              <p
                v-if="websiteAccountMismatch"
                class="settings-status-strip__line settings-status-strip__line--mismatch"
                role="status"
              >
                {{ t('settings_account_website_mismatch') }}
              </p>
            </div>
          </div>
        </section>

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

        <div
          v-if="signedIn"
          class="settings-subsection"
          aria-labelledby="settings-advanced-heading"
        >
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
          </div>
        </div>

        <div v-if="hasOrphanOwners" class="settings-orphan">
          <p class="settings-orphan-title">{{ t('settings_orphan_title') }}</p>
          <p class="settings-section-copy settings-orphan-copy">
            {{ t('settings_orphan_copy', [String(orphanBucketCount), String(orphanActiveCount)]) }}
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

        <div v-if="signedIn && !isAnonymous" class="settings-actions">
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
    </div>
  </template>

  <template v-else-if="activeSection === 'ai'">
    <div class="settings-block" aria-labelledby="settings-ai-heading">
      <div class="settings-section-head">
        <h2 id="settings-ai-heading" class="settings-section-title">
          {{ t('settings_tab_ai') }}
        </h2>
      </div>

      <div class="settings-card-stack">
        <section class="settings-group" :aria-label="t('settings_tab_ai')">
          <div class="settings-group__card">
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

            <div class="settings-toggle">
              <div class="settings-toggle-copy">
                <span class="settings-toggle-title">{{ t('settings_link_sweep_toggle') }}</span>
                <span class="settings-toggle-hint">{{ t('settings_link_sweep_toggle_hint') }}</span>
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
          </div>
        </section>

        <div
          v-if="hostedQuotaLoading || hostedQuotaText || hostedQuotaError"
          class="settings-status-strip"
        >
          <p v-if="hostedQuotaLoading" class="settings-status-strip__line" role="status">
            {{ t('settings_ai_quota_loading') }}
          </p>
          <p v-else-if="hostedQuotaText" class="settings-status-strip__line" role="status">
            {{ hostedQuotaText }}
          </p>
          <p
            v-if="hostedQuotaError"
            class="settings-status-strip__line settings-error"
            role="alert"
          >
            {{ hostedQuotaError }}
          </p>
        </div>

        <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
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

      <div class="settings-card-stack">
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

        <div class="settings-toggle">
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

        <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>

        <div class="settings-card-stack">
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
                  <span class="settings-toggle-hint">{{
                    t('settings_data_outcome_soft_adjust_hint')
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

              <!-- 暗线·本地学习（ADR-027） -->
              <div class="settings-dual-thread-block">
                <div class="settings-toggle">
                  <div class="settings-toggle-copy">
                    <span class="settings-toggle-title">{{
                      t('settings_dual_thread_local_learning_toggle')
                    }}</span>
                  </div>
                  <AppSwitch
                    :model-value="dualThreadLocalLearningEnabled"
                    :disabled="
                      savingDualThreadLocalLearning || dataWorking || settingsState !== 'ready'
                    "
                    :aria-label="t('settings_dual_thread_local_learning_toggle')"
                    @update:model-value="handleDualThreadLocalLearningToggle"
                  />
                </div>
                <ul
                  class="settings-dual-thread-intro"
                  :aria-label="t('settings_dual_thread_local_learning_toggle')"
                >
                  <li>{{ t('settings_dual_thread_local_learning_intro_1') }}</li>
                  <li>{{ t('settings_dual_thread_local_learning_intro_2') }}</li>
                  <li>{{ t('settings_dual_thread_local_learning_intro_3') }}</li>
                  <li>{{ t('settings_dual_thread_local_learning_intro_4') }}</li>
                </ul>
                <details v-if="dualThreadLocalLearningEnabled" class="settings-details">
                  <summary class="settings-details__summary">
                    <span class="settings-details__summary-label">
                      {{ t('settings_dual_thread_learning_heading') }}
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
                  <div class="settings-dual-thread-learning" aria-live="polite">
                    <p v-if="dualThreadLearningLoading" class="settings-toggle-hint">
                      {{ t('settings_privacy_working') }}
                    </p>
                    <p v-else-if="dualThreadLearningError" class="settings-error" role="alert">
                      {{ dualThreadLearningError }}
                    </p>
                    <template v-else-if="dualThreadLearningSketch">
                      <p class="settings-toggle-hint">
                        {{
                          t('settings_dual_thread_learning_event_count', [
                            String(dualThreadLearningSketch.telemetryEventCount)
                          ])
                        }}
                      </p>
                      <p class="settings-dual-thread-learning__label">
                        {{ t('settings_dual_thread_learning_outcomes') }}
                      </p>
                      <ul class="settings-dual-thread-counts">
                        <li
                          v-for="(count, key) in dualThreadLearningSketch.resultOutcomeCounts"
                          :key="`outcome-${key}`"
                        >
                          {{ resolveDualThreadLearningLabel('outcome', String(key), t) }}:
                          {{ count }}
                        </li>
                      </ul>
                      <p class="settings-dual-thread-learning__label">
                        {{ t('settings_dual_thread_learning_confirms') }}
                      </p>
                      <ul class="settings-dual-thread-counts">
                        <li
                          v-for="(count, key) in dualThreadLearningSketch.confirmLabelCounts"
                          :key="`confirm-${key}`"
                        >
                          {{ resolveDualThreadLearningLabel('confirm', String(key), t) }}:
                          {{ count }}
                        </li>
                      </ul>
                      <p class="settings-dual-thread-learning__label">
                        {{ t('settings_dual_thread_learning_timing') }}
                      </p>
                      <p class="settings-toggle-hint">
                        n={{ dualThreadLearningSketch.timingTotalMs?.n ?? 0 }} · p50={{
                          formatDualThreadLearningTimingMs(
                            dualThreadLearningSketch.timingTotalMs?.p50
                          )
                        }}
                        · p90={{
                          formatDualThreadLearningTimingMs(
                            dualThreadLearningSketch.timingTotalMs?.p90
                          )
                        }}
                      </p>
                      <p class="settings-dual-thread-learning__label">
                        {{ t('settings_dual_thread_learning_failures') }}
                      </p>
                      <p v-if="!dualThreadLearningHasAttributions" class="settings-toggle-hint">
                        {{ t('settings_dual_thread_learning_no_attributions') }}
                      </p>
                      <ul v-else class="settings-dual-thread-counts">
                        <li
                          v-for="(count, key) in dualThreadLearningSketch.failureStageCounts"
                          :key="`fail-${key}`"
                        >
                          {{ resolveDualThreadLearningLabel('stage', String(key), t) }}:
                          {{ count }}
                        </li>
                      </ul>
                    </template>
                  </div>
                </details>
              </div>

              <!-- 暗线·贡献匿名汇总（ADR-027） -->
              <div class="settings-dual-thread-block">
                <div class="settings-toggle">
                  <div class="settings-toggle-copy">
                    <span class="settings-toggle-title">{{
                      t('settings_dual_thread_contribute_toggle')
                    }}</span>
                  </div>
                  <AppSwitch
                    :model-value="dualThreadContributeAggregatesEnabled"
                    :disabled="dualThreadContributeDisabled"
                    :aria-label="t('settings_dual_thread_contribute_toggle')"
                    @update:model-value="handleDualThreadContributeToggle"
                  />
                </div>
                <ul
                  class="settings-dual-thread-intro"
                  :aria-label="t('settings_dual_thread_contribute_toggle')"
                >
                  <li>{{ t('settings_dual_thread_contribute_intro_1') }}</li>
                  <li>{{ t('settings_dual_thread_contribute_intro_2') }}</li>
                  <li>{{ t('settings_dual_thread_contribute_intro_3') }}</li>
                  <li>{{ t('settings_dual_thread_contribute_intro_4') }}</li>
                </ul>
                <p v-if="dualThreadContributeGateText" class="settings-toggle-hint" role="status">
                  {{ dualThreadContributeGateText }}
                </p>
                <p v-else class="settings-toggle-hint" role="status">
                  {{ dualThreadLastContributionText }}
                </p>
                <SettingsActionRow
                  surface="embedded"
                  :title="t('settings_dual_thread_delete_contributed')"
                >
                  <AppButton
                    type="button"
                    :disabled="
                      !signedIn ||
                      dualThreadDeleteWorking ||
                      dataWorking ||
                      signingOut ||
                      settingsState !== 'ready'
                    "
                    :title="t('settings_dual_thread_delete_contributed')"
                    variant="outlined"
                    @click="handleDeleteDualThreadContributedSketches"
                  >
                    {{
                      dualThreadDeleteWorking
                        ? t('settings_privacy_working')
                        : t('settings_dual_thread_delete_contributed_action')
                    }}
                  </AppButton>
                </SettingsActionRow>
                <p v-if="dualThreadDeleteError" class="settings-error" role="alert">
                  {{ dualThreadDeleteError }}
                </p>
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
    </div>
  </template>

  <template v-else-if="activeSection === 'help_legal'">
    <div class="settings-block" aria-labelledby="settings-help-legal-heading">
      <div class="settings-section-head">
        <h2 id="settings-help-legal-heading" class="settings-section-title">
          {{ t('settings_tab_help_legal') }}
        </h2>
      </div>

      <div class="settings-card-stack">
        <section class="settings-group" :aria-label="t('settings_tab_help')">
          <h3 class="settings-group__label">{{ t('settings_tab_help') }}</h3>
          <div class="settings-group__card">
            <a
              class="settings-link-row"
              :href="faqUrl"
              :title="t('settings_help_link_faq')"
              :aria-label="t('settings_help_link_faq')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings-link-row__title">{{ t('settings_help_link_faq') }}</span>
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
            <a
              class="settings-link-row"
              :href="supportUrl"
              :title="t('settings_help_link_support')"
              :aria-label="t('settings_help_link_support')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings-link-row__title">{{ t('settings_help_link_support') }}</span>
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </div>
        </section>

        <section class="settings-group" :aria-label="t('settings_tab_legal')">
          <h3 class="settings-group__label">{{ t('settings_tab_legal') }}</h3>
          <div class="settings-group__card">
            <a
              class="settings-link-row"
              :href="pricingUrl"
              :title="t('settings_legal_link_pricing')"
              :aria-label="t('settings_legal_link_pricing')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings-link-row__title">{{ t('settings_legal_link_pricing') }}</span>
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
            <a
              class="settings-link-row"
              :href="privacyPolicyUrl"
              :title="t('settings_legal_link_privacy')"
              :aria-label="t('settings_legal_link_privacy')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings-link-row__title">{{ t('settings_legal_link_privacy') }}</span>
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
            <a
              class="settings-link-row"
              :href="termsOfServiceUrl"
              :title="t('settings_legal_link_terms')"
              :aria-label="t('settings_legal_link_terms')"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="settings-link-row__title">{{ t('settings_legal_link_terms') }}</span>
              <AppIcon name="arrow_up_right" size="18px" />
            </a>
          </div>
        </section>
      </div>
    </div>
  </template>

  <template v-else-if="activeSection === 'language'">
    <div class="settings-block" aria-labelledby="settings-language-heading">
      <div class="settings-section-head">
        <h2 id="settings-language-heading" class="settings-section-title">
          {{ t('settings_tab_language') }}
        </h2>
      </div>

      <div class="settings-card-stack">
        <fieldset
          class="settings-language-fieldset"
          :disabled="savingUiLocale || settingsState !== 'ready'"
        >
          <legend class="settings-language-legend">{{ t('settings_language_legend') }}</legend>

          <div class="settings-group__card">
            <label class="settings-language-option">
              <input
                type="radio"
                name="yiveno-ui-locale"
                value="system"
                :checked="uiLocalePreference === 'system'"
                @change="handleUiLocalePreferenceChange('system')"
              />
              <span class="settings-language-option__copy">
                <span class="settings-language-option__title">{{
                  t('settings_language_system')
                }}</span>
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
                <span class="settings-language-option__title">{{
                  t('settings_language_zh_CN')
                }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <p v-if="savingUiLocale" class="settings-status-strip__line" role="status">
          {{ t('settings_language_saving') }}
        </p>
        <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
      </div>
    </div>
  </template>
</template>
