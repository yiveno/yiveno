<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { t, type WebsiteMessageKey } from '../i18n/t'
import { getSession } from '../services/auth'
import { extractProfileFromUserMetadata } from '../services/extension-auth-handoff'

defineOptions({ name: 'ExtensionUninstalledPage' })

/**
 * 卸载落地页定位：与扩展卸载强绑定（Chrome setUninstallURL 必开本页）。
 * - 反馈：始终可选；不强制登录；水合后立刻出表单（不挡在 revoke 上）
 * - 远程清理：有 token 时后台 POST revoke；失败只轻提示；无 token 跳过
 * - 官网 session 经 getSession 仅作反馈 context
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

/** 预设闭集（不含 other）；other 单独一行带自定义输入 */
const PRESET_REASON_IDS = [
  'didnt_find',
  'too_hard',
  'missing_feature',
  'privacy',
  'bugs_or_slow',
  'just_trying'
] as const

type PresetReasonId = (typeof PRESET_REASON_IDS)[number]
type ReasonId = PresetReasonId | 'other'
type Phase = 'feedback' | 'done'

function reasonLabelKey(id: ReasonId): WebsiteMessageKey {
  return `uninstall.feedback.reason.${id}` as WebsiteMessageKey
}

const presetOptions = computed(() =>
  PRESET_REASON_IDS.map(id => ({
    id,
    label: t(reasonLabelKey(id))
  }))
)

/** 仅失败时轻提示；成功/幂等不占主文案（页面主题是反馈） */
const revokeHint = ref('')
/** 多选闭集原因（含 other） */
const selectedReasons = ref<ReasonId[]>([])
/** other 勾选后的自填原因 */
const customReason = ref('')
const note = ref('')
const honeypot = ref('')
const submitting = ref(false)
const submitError = ref('')
const doneTitle = ref(t('uninstall.done.title'))
const doneLede = ref(t('uninstall.done.lede'))

const otherSelected = computed(() => selectedReasons.value.includes('other'))

/** 预设已勾 / other+自填 / 底部留言 — 任一即可；仅勾 other 未填不算 */
const canSubmit = computed(() => {
  const hasPreset = selectedReasons.value.some(id => id !== 'other')
  const hasCustom = otherSelected.value && customReason.value.trim().length > 0
  const hasNote = note.value.trim().length > 0
  return hasPreset || hasCustom || hasNote
})

function buildNotePayload(): string | undefined {
  const parts: string[] = []
  const custom = customReason.value.trim()
  if (otherSelected.value && custom) {
    parts.push(`Other: ${custom}`)
  }
  const extra = note.value.trim()
  if (extra) parts.push(extra)
  return parts.length > 0 ? parts.join('\n\n') : undefined
}

/** 运营统计 / 复现用；ip 与 UA 由 Worker 从请求头取，不信任客户端伪造 */
async function collectClientContext(): Promise<Record<string, string>> {
  const ctx: Record<string, string> = {}
  try {
    const session = await getSession()
    if (session?.user) {
      const profile = extractProfileFromUserMetadata(
        session.user.user_metadata as Record<string, unknown> | undefined
      )
      const displayName = profile.displayName?.trim()
      if (displayName) ctx.displayName = displayName.slice(0, 120)
      const email = session.user.email?.trim()
      if (email) ctx.email = email.slice(0, 254)
    }
  } catch {
    /* 未登录 / Supabase 不可用：跳过账号字段 */
  }
  try {
    const language = navigator.language?.trim()
    if (language) ctx.language = language.slice(0, 32)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim()
    if (timezone) ctx.timezone = timezone.slice(0, 64)
    if (typeof screen !== 'undefined' && screen.width > 0 && screen.height > 0) {
      ctx.screen = `${screen.width}x${screen.height}`.slice(0, 32)
    }
  } catch {
    /* 隐私模式等 */
  }
  return ctx
}

/** 防止 Vue remount / 连点导致重复 POST；同 tab 记住已成功以免刷新重复打 */
let revokeInflight: Promise<void> | null = null

function revokeDoneStorageKey(token: string): string {
  return `yiveno:uninstall_revoke_done:${token}`
}

/** Thanks 态单向：同 tab 刷新仍停在感谢页，不回表单（减重复提交） */
function feedbackDoneStorageKey(): string {
  const token = new URLSearchParams(window.location.search).get('token')?.trim() || 'none'
  return `yiveno:uninstall_feedback_done:${token}`
}

function markFeedbackDone(): void {
  try {
    sessionStorage.setItem(feedbackDoneStorageKey(), '1')
  } catch {
    /* 隐私模式等写失败：仅本会话内存态仍为 done */
  }
}

function isFeedbackDoneRemembered(): boolean {
  try {
    return sessionStorage.getItem(feedbackDoneStorageKey()) === '1'
  } catch {
    return false
  }
}

/** 手测口子：`?feedback=fresh` 清掉 Thanks 记忆，重新出表单（勿写进产品 UI） */
function clearFeedbackDoneForTest(): void {
  try {
    sessionStorage.removeItem(feedbackDoneStorageKey())
  } catch {
    /* ignore */
  }
}

function wantsFreshFeedbackForm(): boolean {
  return new URLSearchParams(window.location.search).get('feedback') === 'fresh'
}

/** Thanks 记忆同步解析，避免先闪表单再切 done */
function resolveInitialPhase(): Phase {
  if (typeof window === 'undefined') return 'feedback'
  if (wantsFreshFeedbackForm()) {
    clearFeedbackDoneForTest()
    return 'feedback'
  }
  return isFeedbackDoneRemembered() ? 'done' : 'feedback'
}

const phase = ref<Phase>(resolveInitialPhase())

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
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const reasons = selectedReasons.value.filter(id => {
      if (id !== 'other') return true
      return customReason.value.trim().length > 0
    })
    const context = await collectClientContext()
    const res = await fetch(`${API_BASE}/api/website/uninstall-feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(reasons.length > 0 ? { reasons } : {}),
        note: buildNotePayload(),
        ...(Object.keys(context).length > 0 ? { context } : {}),
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
    markFeedbackDone()
    phase.value = 'done'
  } catch (error) {
    console.warn('[ExtensionUninstalled] feedback failed', error)
    submitError.value = t('uninstall.feedback.error.sendFailed')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  // 表单先出；revoke 后台尽力，失败只写 revokeHint
  if (phase.value === 'done') {
    doneTitle.value = t('uninstall.done.title')
    doneLede.value = t('uninstall.done.lede')
  } else if (wantsFreshFeedbackForm()) {
    clearFeedbackDoneForTest()
  }
  void runRevoke()
})
</script>

<template>
  <div class="page uninstall">
    <header v-if="phase !== 'done'" class="uninstall__header">
      <h1 class="page__title uninstall__title">{{ t('uninstall.feedback.title') }}</h1>
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
      <h1 class="page__title uninstall__title">{{ doneTitle }}</h1>
      <p class="page__lede uninstall__lede">{{ doneLede }}</p>
      <p class="uninstall__soft-hint">{{ t('uninstall.done.closeHint') }}</p>
    </header>

    <form v-if="phase === 'feedback'" class="uninstall__form" @submit.prevent="submitFeedback">
      <fieldset class="uninstall__fieldset">
        <legend class="visually-hidden">{{ t('uninstall.feedback.reasonsLegend') }}</legend>
        <div
          class="uninstall__reasons"
          role="group"
          :aria-label="t('uninstall.feedback.reasonsAria')"
        >
          <label
            v-for="opt in presetOptions"
            :key="opt.id"
            class="uninstall__reason"
            :class="{ 'uninstall__reason--on': selectedReasons.includes(opt.id) }"
          >
            <input
              v-model="selectedReasons"
              class="uninstall__check"
              type="checkbox"
              name="uninstall-reason"
              :value="opt.id"
            />
            <span>{{ opt.label }}</span>
          </label>

          <div
            class="uninstall__reason uninstall__reason--custom"
            :class="{ 'uninstall__reason--on': otherSelected }"
          >
            <label class="uninstall__reason-main">
              <input
                v-model="selectedReasons"
                class="uninstall__check"
                type="checkbox"
                name="uninstall-reason"
                value="other"
              />
              <span>{{ t('uninstall.feedback.reason.other') }}</span>
            </label>
            <div v-if="otherSelected" class="uninstall__custom">
              <label class="visually-hidden" for="uninstall-custom">{{
                t('uninstall.feedback.customLabel')
              }}</label>
              <input
                id="uninstall-custom"
                v-model="customReason"
                class="uninstall__custom-input"
                type="text"
                maxlength="200"
                :placeholder="t('uninstall.feedback.customPlaceholder')"
                autocomplete="off"
              />
            </div>
          </div>
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
        <button class="ui-btn ui-btn--primary" type="submit" :disabled="!canSubmit || submitting">
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

/** 标题单行：略收字号 + nowrap，避免 Fraunces 大号折到「Yiveno?」 */
.uninstall__title {
  white-space: nowrap;
  font-size: clamp(28px, 4.2vw, 40px);
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
  clip-path: inset(50%);
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

.uninstall__reason--custom {
  flex-direction: column;
  gap: 10px;
  cursor: default;
}

.uninstall__reason-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  cursor: pointer;
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

.uninstall__check {
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: var(--accent);
}

.uninstall__custom {
  width: 100%;
  padding-left: 26px;
  box-sizing: border-box;
}

.uninstall__custom-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.45;
}

.uninstall__custom-input::placeholder {
  color: var(--sage-muted);
}

.uninstall__custom-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
