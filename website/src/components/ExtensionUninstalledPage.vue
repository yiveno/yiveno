<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { t, type WebsiteMessageKey } from '../i18n/t'

defineOptions({ name: 'ExtensionUninstalledPage' })

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

/** 与 Worker `UNINSTALL_FEEDBACK_REASONS` 对齐；文案经 i18n */
const REASON_IDS = [
  'didnt_find',
  'too_hard',
  'missing_feature',
  'privacy',
  'bugs_or_slow',
  'just_trying',
  'other'
] as const

type ReasonId = (typeof REASON_IDS)[number]
type Phase = 'revoking' | 'feedback' | 'done'

function reasonLabelKey(id: ReasonId): WebsiteMessageKey {
  return `uninstall.feedback.reason.${id}` as WebsiteMessageKey
}

const reasonOptions = computed(() =>
  REASON_IDS.map(id => ({
    id,
    label: t(reasonLabelKey(id))
  }))
)

const phase = ref<Phase>('revoking')
/** 仅失败时轻提示；成功/幂等不占主文案（页面主题是反馈） */
const revokeHint = ref('')
const selectedReason = ref<ReasonId | ''>('')
const note = ref('')
const honeypot = ref('')
const submitting = ref(false)
const submitError = ref('')
const doneTitle = ref(t('uninstall.done.title'))
const doneLede = ref(t('uninstall.done.lede'))

/** 防止 Vue remount / 连点导致重复 POST；同 tab 记住已成功以免刷新重复打 */
let revokeInflight: Promise<void> | null = null

function revokeDoneStorageKey(token: string): string {
  return `yiveno:uninstall_revoke_done:${token}`
}

async function runRevoke(): Promise<void> {
  if (revokeInflight) {
    return revokeInflight
  }
  revokeInflight = (async () => {
    const token = new URLSearchParams(window.location.search).get('token')?.trim() ?? ''
    if (!token) {
      revokeHint.value = ''
      return
    }

    const remembered = sessionStorage.getItem(revokeDoneStorageKey(token))
    if (remembered === 'ok' || remembered === 'gone') {
      revokeHint.value = ''
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/extension-uninstall-revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      })
      if (res.ok) {
        sessionStorage.setItem(revokeDoneStorageKey(token), 'ok')
        revokeHint.value = ''
        return
      }
      // 已消费或无效：幂等收尾（刷新页常见）；不惊吓、不抢反馈主题
      if (res.status === 404) {
        sessionStorage.setItem(revokeDoneStorageKey(token), 'gone')
        revokeHint.value = ''
        return
      }
      console.warn('[ExtensionUninstalled] revoke HTTP', res.status)
      revokeHint.value = t('uninstall.feedback.revokeFailed')
    } catch (error) {
      console.warn('[ExtensionUninstalled] revoke failed', error)
      revokeHint.value = t('uninstall.feedback.revokeFailed')
    }
  })()
  try {
    await revokeInflight
  } finally {
    revokeInflight = null
  }
}

async function submitFeedback(): Promise<void> {
  submitError.value = ''
  if (!selectedReason.value) {
    submitError.value = t('uninstall.feedback.error.pickReason')
    return
  }
  submitting.value = true
  try {
    const res = await fetch(`${API_BASE}/api/website/uninstall-feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason: selectedReason.value,
        note: note.value.trim() || undefined,
        website: honeypot.value
      })
    })
    if (!res.ok) {
      if (res.status === 429) {
        submitError.value = t('uninstall.feedback.error.rateLimited')
        return
      }
      submitError.value = t('uninstall.feedback.error.sendFailed')
      return
    }
    doneTitle.value = t('uninstall.done.title')
    doneLede.value = t('uninstall.done.lede')
    phase.value = 'done'
  } catch (error) {
    console.warn('[ExtensionUninstalled] feedback failed', error)
    submitError.value = t('uninstall.feedback.error.sendFailed')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await runRevoke()
  phase.value = 'feedback'
})
</script>

<template>
  <div class="page uninstall">
    <header v-if="phase !== 'done'" class="uninstall__header">
      <h1 class="page__title">{{ t('uninstall.feedback.title') }}</h1>
      <p class="page__lede uninstall__lede">
        {{ t('uninstall.feedback.lede') }}
      </p>
      <p class="uninstall__support-hint">
        {{ t('uninstall.feedback.supportHintBefore') }}
        <a
          class="uninstall__support-link"
          href="mailto:support@yiveno.com?subject=Yiveno%20support"
          >{{ t('uninstall.feedback.supportHintLink') }}</a
        >
        {{ t('uninstall.feedback.supportHintAfter') }}
      </p>
      <p v-if="revokeHint" class="uninstall__hint uninstall__hint--warn" role="status">
        {{ revokeHint }}
      </p>
    </header>

    <header v-else class="uninstall__header" role="status">
      <h1 class="page__title">{{ doneTitle }}</h1>
      <p class="page__lede uninstall__lede">{{ doneLede }}</p>
      <p class="uninstall__soft-hint">{{ t('uninstall.done.closeHint') }}</p>
    </header>

    <form v-if="phase === 'feedback'" class="uninstall__form" @submit.prevent="submitFeedback">
      <fieldset class="uninstall__fieldset">
        <legend class="visually-hidden">{{ t('uninstall.feedback.reasonsLegend') }}</legend>
        <div
          class="uninstall__reasons"
          role="radiogroup"
          :aria-label="t('uninstall.feedback.reasonsAria')"
        >
          <label
            v-for="opt in reasonOptions"
            :key="opt.id"
            class="uninstall__reason"
            :class="{ 'uninstall__reason--on': selectedReason === opt.id }"
          >
            <input
              v-model="selectedReason"
              class="uninstall__radio"
              type="radio"
              name="uninstall-reason"
              :value="opt.id"
            />
            <span>{{ opt.label }}</span>
          </label>
        </div>
      </fieldset>

      <label class="uninstall__note-label" for="uninstall-note">
        {{ t('uninstall.feedback.noteLabel') }}
        <span class="uninstall__optional">{{ t('uninstall.feedback.optional') }}</span>
      </label>
      <textarea
        id="uninstall-note"
        v-model="note"
        class="uninstall__textarea"
        rows="3"
        maxlength="500"
        :placeholder="t('uninstall.feedback.notePlaceholder')"
        autocomplete="off"
      />

      <div class="uninstall__hp" aria-hidden="true">
        <label for="uninstall-website">{{ t('uninstall.feedback.honeypotLabel') }}</label>
        <input
          id="uninstall-website"
          v-model="honeypot"
          type="text"
          tabindex="-1"
          autocomplete="off"
        />
      </div>

      <p v-if="submitError" class="uninstall__err" role="alert">{{ submitError }}</p>

      <div class="page__actions uninstall__actions">
        <button class="ui-btn ui-btn--primary" type="submit" :disabled="submitting">
          {{ submitting ? t('uninstall.feedback.submitting') : t('uninstall.feedback.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.uninstall {
  padding-top: clamp(40px, 7vw, 72px);
}

.uninstall__header {
  margin-bottom: clamp(20px, 3vw, 28px);
}

.uninstall__lede {
  margin-bottom: 0;
}

.uninstall__support-hint {
  margin: 12px 0 0;
  font-size: 13.5px;
  font-weight: 300;
  line-height: 1.55;
  color: var(--sage-muted);
}

.uninstall__support-link {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 35%, transparent);
  text-underline-offset: 2px;
}

.uninstall__support-link:hover,
.uninstall__support-link:focus-visible {
  color: var(--accent-hover);
}

/** 感谢态最轻提示：低于 lede，不抢「Thanks」 */
.uninstall__soft-hint {
  margin: 14px 0 0;
  font-size: 13px;
  font-weight: 300;
  line-height: 1.5;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--sage-muted) 72%, var(--paper));
}

.uninstall__fieldset {
  margin: 0;
  padding: 0;
  border: none;
}

.visually-hidden {
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

.uninstall__hint {
  margin: 12px 0 0;
  font-size: 13.5px;
  font-weight: 300;
  line-height: 1.55;
  color: var(--sage-muted);
}

.uninstall__hint--warn {
  color: var(--danger);
}

.uninstall__reasons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.uninstall__reason {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: 14.5px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--on-surface);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.uninstall__reason:hover,
.uninstall__reason:focus-within {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

.uninstall__reason--on {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.uninstall__radio {
  margin-top: 3px;
  accent-color: var(--accent);
}

.uninstall__note-label {
  display: block;
  margin: 20px 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--on-surface);
}

.uninstall__optional {
  font-weight: 300;
  color: var(--sage-muted);
}

.uninstall__textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14.5px;
  font-weight: 300;
  line-height: 1.5;
  resize: vertical;
  min-height: 84px;
}

.uninstall__textarea::placeholder {
  color: var(--sage-muted);
}

.uninstall__textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.uninstall__hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.uninstall__err {
  margin: 14px 0 0;
  font-size: 13.5px;
  font-weight: 300;
  color: var(--danger);
}

.uninstall__actions {
  margin-top: 22px;
}
</style>
