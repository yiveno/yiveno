<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { t } from '../i18n/t'
import {
  getWebsiteEffectiveUiLocale,
  readWebsiteUiLocalePreference,
  writeWebsiteUiLocalePreference,
  type WebsiteUiLocaleId,
  type WebsiteUiLocalePreference
} from '../i18n/locale'

defineOptions({ name: 'WebsiteLanguageSwitcher' })

withDefaults(
  defineProps<{
    /** 菜单展开方向：页脚用 above，避免贴视口底被裁切 */
    menuPlacement?: 'below' | 'above'
  }>(),
  { menuPlacement: 'below' }
)

/** 菜单选项：本语种自指标签（不随 UI 语言改写，便于认出） */
const LOCALE_OPTIONS: ReadonlyArray<{ id: WebsiteUiLocaleId; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'zh_CN', label: '中文' }
]

const preference = ref<WebsiteUiLocalePreference>('system')
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const effective = computed(() => getWebsiteEffectiveUiLocale(preference.value))
const triggerLabel = computed(
  () => LOCALE_OPTIONS.find(o => o.id === effective.value)?.label ?? 'English'
)

onMounted(() => {
  preference.value = readWebsiteUiLocalePreference()
  // 冒泡阶段：避免 capture + 同一次 pointer 与 trigger toggle 打架
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
})

function onDocumentPointerDown(event: PointerEvent): void {
  if (!open.value || !rootEl.value) return
  const target = event.target
  if (target instanceof Node && !rootEl.value.contains(target)) {
    open.value = false
  }
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    open.value = false
  }
}

function toggle(event: MouseEvent): void {
  event.stopPropagation()
  open.value = !open.value
}

/** 显式选 en / zh_CN；首访默认仍是 system */
function pick(locale: WebsiteUiLocaleId): void {
  open.value = false
  if (preference.value === locale) {
    return
  }
  writeWebsiteUiLocalePreference(locale)
  preference.value = locale
  window.location.reload()
}
</script>

<template>
  <div
    ref="rootEl"
    class="site-lang"
    :data-effective="effective"
    :data-open="open ? 'true' : 'false'"
    :data-placement="menuPlacement"
  >
    <button
      type="button"
      class="site-lang__trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="open ? 'yiveno-site-lang-menu' : undefined"
      :aria-label="`${t('nav.language')}: ${triggerLabel}`"
      @click="toggle"
    >
      <span class="site-lang__icon" aria-hidden="true">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
          <path
            d="M3.5 12h17M12 3.5c2.5 2.8 3.8 5.6 3.8 8.5S14.5 17.7 12 20.5C9.5 17.7 8.2 14.9 8.2 12S9.5 6.3 12 3.5Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="site-lang__current" aria-hidden="true">{{ triggerLabel }}</span>
      <span class="site-lang__chevron" aria-hidden="true">
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 4.25 6 8l3.5-3.75"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </span>
    </button>

    <div
      v-show="open"
      id="yiveno-site-lang-menu"
      class="site-lang__menu"
      role="listbox"
      :aria-label="t('nav.language')"
    >
      <p class="site-lang__menu-heading" aria-hidden="true">{{ t('nav.language') }}</p>
      <ul class="site-lang__list">
        <li v-for="opt in LOCALE_OPTIONS" :key="opt.id">
          <button
            type="button"
            class="site-lang__option"
            role="option"
            :aria-selected="effective === opt.id"
            :data-selected="effective === opt.id ? 'true' : 'false'"
            @click="pick(opt.id)"
          >
            {{ opt.label }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.site-lang {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.site-lang__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.2rem 0.15rem;
  border: 0;
  background: transparent;
  color: var(--nav-muted, var(--muted, #5c6b62));
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1.2;
  cursor: pointer;
}

.site-lang__trigger:hover,
.site-lang__trigger:focus-visible,
.site-lang[data-open='true'] .site-lang__trigger {
  color: var(--nav-fg, var(--on-surface, #222c24));
}

.site-lang__trigger:focus-visible {
  outline: 2px solid var(--accent, #2f6f5e);
  outline-offset: 3px;
  border-radius: 2px;
}

:global(body[data-chrome='home'][data-nav-over-hero='true']) .site-lang__trigger:focus-visible {
  outline-color: var(--on-accent, #dce8de);
}

.site-lang__icon {
  display: inline-flex;
  flex-shrink: 0;
  opacity: 0.9;
}

.site-lang__chevron {
  display: inline-flex;
  opacity: 0.7;
  transition: transform 0.18s ease;
}

.site-lang[data-open='true'] .site-lang__chevron {
  transform: rotate(180deg);
}

/* 浮层始终纸面底：深/浅顶栏背后都可读（对齐参考站 LANGUAGE 卡片） */
.site-lang__menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: calc(var(--z-nav, 40) + 5);
  min-width: 11.5rem;
  padding: 12px 10px 10px;
  border: 1px solid var(--border, #d5ddd7);
  border-radius: 10px;
  background: var(--surface-raised, #fff);
  box-shadow: var(--shadow-ink-md, 0 12px 32px color-mix(in srgb, #192420 14%, transparent));
  color: var(--on-surface, #222c24);
}

.site-lang[data-placement='above'] .site-lang__menu {
  top: auto;
  bottom: calc(100% + 10px);
}

.site-lang__menu-heading {
  margin: 0 6px 8px;
  font-family: var(--font-sans, inherit);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted, #5c6b62);
}

.site-lang__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.site-lang__option {
  display: block;
  width: 100%;
  margin: 0;
  padding: 9px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 450;
  text-align: left;
  cursor: pointer;
}

.site-lang__option:hover,
.site-lang__option:focus-visible {
  background: color-mix(in srgb, var(--sage, #9bb3a6) 14%, transparent);
}

.site-lang__option:focus-visible {
  outline: 2px solid var(--accent, #2f6f5e);
  outline-offset: 1px;
}

.site-lang__option[data-selected='true'] {
  background: color-mix(in srgb, var(--sage, #9bb3a6) 22%, transparent);
  font-weight: 600;
}
</style>
