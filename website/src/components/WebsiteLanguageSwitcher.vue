<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { t } from '../i18n/t'
import {
  getWebsiteEffectiveUiLocale,
  readWebsiteUiLocalePreference,
  writeWebsiteUiLocalePreference,
  type WebsiteUiLocalePreference
} from '../i18n/locale'

defineOptions({ name: 'WebsiteLanguageSwitcher' })

const preference = ref<WebsiteUiLocalePreference>('system')
const effective = computed(() => getWebsiteEffectiveUiLocale(preference.value))

onMounted(() => {
  preference.value = readWebsiteUiLocalePreference()
})

function select(next: WebsiteUiLocalePreference) {
  if (next === preference.value) {
    return
  }
  writeWebsiteUiLocalePreference(next)
  preference.value = next
  window.location.reload()
}
</script>

<template>
  <div class="site-lang" :data-effective="effective">
    <label class="site-lang__label" for="yiveno-website-lang">{{ t('nav.language') }}</label>
    <select
      id="yiveno-website-lang"
      class="site-lang__select"
      :value="preference"
      :aria-label="t('nav.language')"
      @change="select(($event.target as HTMLSelectElement).value as WebsiteUiLocalePreference)"
    >
      <option value="system">{{ t('nav.language_system') }}</option>
      <option value="en">{{ t('nav.language_en') }}</option>
      <option value="zh_CN">{{ t('nav.language_zh_CN') }}</option>
    </select>
  </div>
</template>

<style scoped>
.site-lang {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.site-lang__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.site-lang__select {
  appearance: none;
  margin: 0;
  padding: 0.25rem 1.5rem 0.25rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--on-surface, #192420) 18%, transparent);
  border-radius: 6px;
  background: transparent
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23192420' d='M3 4.5 6 8l3-3.5'/%3E%3C/svg%3E")
    no-repeat right 0.4rem center / 12px;
  color: inherit;
  font: inherit;
  font-size: 0.85rem;
  line-height: 1.3;
  cursor: pointer;
}

.site-lang__select:focus-visible {
  outline: 2px solid var(--brand-accent, #2f6f5e);
  outline-offset: 2px;
}
</style>
