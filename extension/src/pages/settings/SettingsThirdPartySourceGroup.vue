<script setup lang="ts">
import { computed, inject, type ComponentPublicInstance } from 'vue'
import type { ThirdPartyCorpusSource } from '@/core/memory/third-party-corpus-source'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import SettingsActionRow from '@/pages/settings/SettingsActionRow.vue'
import type { SettingsPageController } from '@/pages/settings/use-settings-page'

defineOptions({ name: 'SettingsThirdPartySourceGroup' })

const props = defineProps<{
  source: ThirdPartyCorpusSource
  titleKey: string
  guideKey: string
  accept: string
  bindFileInput: (el: Element | ComponentPublicInstance | null) => void
  onPickFile: () => void
  onFileSelected: (event: Event) => void
}>()

const {
  dataWorking,
  exportWorking,
  handleDeleteThirdPartyCorpus,
  restoreWorking,
  signingOut,
  t,
  thirdPartyDeleteMode,
  thirdPartyDeleteWorking,
  thirdPartyImportWorking,
  thirdPartySourceStatusCopy
} = inject<SettingsPageController>('settingsPage')!

/** 当前来源删除模式（items / record / none）。 */
const deleteMode = computed(() => thirdPartyDeleteMode(props.source))
/** 删除/清除按钮与行标题文案。 */
const deleteActionLabel = computed(() =>
  deleteMode.value === 'record'
    ? t('settings_third_party_clear_record')
    : t('settings_third_party_delete_all')
)
</script>

<template>
  <section class="settings-group" :aria-label="t(titleKey)">
    <div class="settings-group__card">
      <SettingsActionRow surface="embedded" :title="t(titleKey)" :subtitle="t(guideKey)">
        <input
          :ref="bindFileInput"
          type="file"
          class="settings-file-input"
          :accept="accept"
          :aria-label="t(titleKey)"
          @change="onFileSelected"
        />
        <AppButton
          type="button"
          :disabled="
            thirdPartyImportWorking || restoreWorking || dataWorking || exportWorking || signingOut
          "
          :title="t(titleKey)"
          variant="outlined"
          @click="onPickFile"
        >
          {{
            thirdPartyImportWorking
              ? t('settings_privacy_working')
              : t('settings_data_import_action')
          }}
        </AppButton>
      </SettingsActionRow>
      <p
        v-if="thirdPartyImportWorking"
        class="settings-section-copy settings-third-party-status"
        role="status"
      >
        {{ t('settings_third_party_importing') }}
      </p>
      <p class="settings-section-copy settings-third-party-status" role="status">
        {{ thirdPartySourceStatusCopy(source) }}
      </p>
      <SettingsActionRow surface="embedded" :title="deleteActionLabel">
        <AppButton
          type="button"
          variant="outlined"
          :disabled="
            deleteMode === 'none' ||
            thirdPartyDeleteWorking ||
            thirdPartyImportWorking ||
            dataWorking ||
            signingOut
          "
          :title="deleteActionLabel"
          @click="handleDeleteThirdPartyCorpus(source)"
        >
          {{ thirdPartyDeleteWorking ? t('settings_privacy_working') : deleteActionLabel }}
        </AppButton>
      </SettingsActionRow>
    </div>
  </section>
</template>
