<script setup lang="ts">
import { nextTick, ref } from 'vue'

import AppButton from '@/infrastructure/ui/AppButton.vue'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({ name: 'GettingStartedPassage' })

const passageRef = ref<HTMLElement | null>(null)

/** 选中文学段全文，供划词浮层 Save（不代存）。 */
async function selectPassage(): Promise<void> {
  const root = passageRef.value
  if (!root) {
    return
  }
  await nextTick()
  const selection = window.getSelection()
  if (!selection) {
    logger.warn('Onboarding', '无法取得 Selection API')
    return
  }
  const range = document.createRange()
  range.selectNodeContents(root)
  selection.removeAllRanges()
  selection.addRange(range)
  logger.info('Onboarding', '已选中 Getting Started 文学段')
  // 划词浮层靠 mouseup 弹出；程序选区需补一次同世界事件
  root.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, view: window })
  )
}
</script>

<template>
  <section class="gs-passage" :aria-label="t('getting_started_passage_aria')">
    <p class="gs-passage__lead">{{ t('getting_started_passage_lead') }}</p>
    <article ref="passageRef" class="gs-passage__body" tabindex="0">
      <p class="gs-passage__line">{{ t('getting_started_passage_line_1') }}</p>
      <p class="gs-passage__line gs-passage__line--break">
        {{ t('getting_started_passage_line_2') }}
      </p>
      <p class="gs-passage__line">{{ t('getting_started_passage_line_3') }}</p>
      <p class="gs-passage__line">{{ t('getting_started_passage_line_4') }}</p>
      <p class="gs-passage__line gs-passage__line--break">
        {{ t('getting_started_passage_line_5') }}
      </p>
      <p class="gs-passage__line gs-passage__line--break">
        {{ t('getting_started_passage_line_6') }}
      </p>
      <p class="gs-passage__line gs-passage__line--break">
        {{ t('getting_started_passage_line_7') }}
      </p>
    </article>
    <div class="gs-passage__actions">
      <AppButton type="button" variant="tonal" @click="selectPassage">
        {{ t('getting_started_passage_select') }}
      </AppButton>
      <p class="gs-passage__hint">{{ t('getting_started_passage_hint') }}</p>
    </div>
  </section>
</template>

<style scoped>
.gs-passage {
  display: grid;
  gap: var(--space-sm);
}

.gs-passage__lead {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
  max-width: 42ch;
}

.gs-passage__body {
  margin: 0;
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  font-size: 16px;
  line-height: 1.6;
  text-wrap: pretty;
}

.gs-passage__line {
  margin: 0;
}

.gs-passage__line + .gs-passage__line {
  margin-top: 0.35em;
}

.gs-passage__line--break {
  margin-top: 1em;
}

.gs-passage__line--break + .gs-passage__line--break {
  margin-top: 1em;
}

.gs-passage__actions {
  display: grid;
  gap: var(--space-2xs);
  justify-items: start;
}

.gs-passage__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface-muted);
  max-width: 40ch;
}
</style>
