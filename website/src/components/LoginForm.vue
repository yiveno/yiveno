<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getSession,
  mapAuthUserError,
  signInWithEmailOtp,
  signInWithOAuth,
  signOut,
  verifyEmailOtp
} from '../services/auth'
import {
  isCompleteOtpCode,
  isValidEmail,
  normalizeEmail,
  normalizeOtpCode
} from '../services/auth-email'
import {
  clearOtpResendCooldown,
  markOtpResendCooldown,
  OTP_RESEND_COOLDOWN_SEC,
  peekOtpResendCooldown,
  remainingOtpResendSecFor
} from '../services/otp-resend-cooldown'
import {
  buildPostAuthHref,
  captureAuthReturnFromUrl,
  peekAuthReturn
} from '../services/auth-return'
import {
  abortWebsiteLoginAfterDisplaceCancel,
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  getPendingExtensionId,
  mintAndHandoffSessionToExtension
} from '../services/extension-auth-handoff'
import {
  isTurnstileConfigured,
  renderTurnstile,
  type TurnstileRenderHandle
} from '../services/turnstile'
import SoftToastHost from './SoftToastHost.vue'
import { useSoftToast } from '../composables/use-soft-toast'

defineOptions({ name: 'LoginForm' })

const toast = useSoftToast()

type EmailStep = 'email' | 'code'

/** 正在发起 OAuth 的提供商；与邮箱流程互斥 */
const loadingProvider = ref<'google' | 'microsoft' | null>(null)
const emailBusy = ref(false)
const emailStep = ref<EmailStep>('email')
const emailInput = ref('')
/** 已成功发信的规范化邮箱 */
const pendingEmail = ref('')
const otpInput = ref('')
const otpInputEl = ref<HTMLInputElement | null>(null)
const resendSecondsLeft = ref(0)
let resendTimerId: ReturnType<typeof setInterval> | null = null

/** Turnstile：发 OTP 前必过；Secret 在 Supabase 校验 */
const turnstileEnabled = isTurnstileConfigured()
const turnstileHost = ref<HTMLElement | null>(null)
const captchaToken = ref<string | null>(null)
let turnstileHandle: TurnstileRenderHandle | null = null

const connectingExtension = ref(false)
const fromExtension = ref(false)
/** 来自定价页 Subscribe：登录后回跳续付 */
const fromSubscribe = ref(false)
/** 已登录且正在跳转账户页时，避免闪一下登录按钮 */
const redirecting = ref(false)

const oauthOrConnectBusy = computed(
  () => loadingProvider.value !== null || connectingExtension.value || emailBusy.value
)

const canSendEmail = computed(
  () =>
    isValidEmail(emailInput.value) &&
    !oauthOrConnectBusy.value &&
    turnstileEnabled &&
    Boolean(captchaToken.value)
)

/** 已发码且当前邮箱仍与发信地址一致时，在邮箱框下方展示验证码区 */
const showOtpField = computed(
  () =>
    emailStep.value === 'code' &&
    Boolean(pendingEmail.value) &&
    normalizeEmail(emailInput.value) === pendingEmail.value
)

const canVerifyOtp = computed(
  () => showOtpField.value && isCompleteOtpCode(otpInput.value) && !oauthOrConnectBusy.value
)

/** 主 CTA：未发码=发信；已发码=验码（同按钮，避免换树跳动） */
const primaryCtaDisabled = computed(() =>
  showOtpField.value ? !canVerifyOtp.value : !canSendEmail.value
)

const primaryCtaLabel = computed(() => {
  if (showOtpField.value) {
    return emailBusy.value ? 'Verifying…' : 'Verify and continue'
  }
  return emailBusy.value ? 'Sending…' : 'Email me a code'
})

/** 改邮箱：仍在冷却的同址可恢复码区；换址则收起，须对新地址重新发码 */
watch(emailInput, raw => {
  const email = normalizeEmail(raw)
  const remaining = email ? remainingOtpResendSecFor(email) : 0
  if (remaining > 0) {
    pendingEmail.value = email
    emailStep.value = 'code'
    beginResendUiCountdown(remaining)
    return
  }
  if (emailStep.value !== 'code' || !pendingEmail.value) return
  if (email === pendingEmail.value) return
  emailStep.value = 'email'
  pendingEmail.value = ''
  otpInput.value = ''
  clearResendTimer()
  resendSecondsLeft.value = 0
})

function clearResendTimer(): void {
  if (resendTimerId != null) {
    clearInterval(resendTimerId)
    resendTimerId = null
  }
}

function focusOtpField(): void {
  void nextTick(() => {
    otpInputEl.value?.focus()
  })
}

/** 操作反馈一律走顶部 Toast，不写进表单文档流 */
function flashError(message: string): void {
  toast.error(message)
}

/** 仅驱动 UI 倒计时；不写 storage（恢复冷却时用） */
function beginResendUiCountdown(seconds: number): void {
  clearResendTimer()
  const safe = Math.max(0, Math.floor(seconds))
  resendSecondsLeft.value = safe
  if (safe <= 0) return
  resendTimerId = setInterval(() => {
    if (resendSecondsLeft.value <= 1) {
      resendSecondsLeft.value = 0
      clearResendTimer()
      return
    }
    resendSecondsLeft.value -= 1
  }, 1000)
}

/** 发码成功：写入 sessionStorage + UI 倒计时 */
function recordAndStartResendCooldown(email: string): void {
  markOtpResendCooldown(email, OTP_RESEND_COOLDOWN_SEC)
  beginResendUiCountdown(OTP_RESEND_COOLDOWN_SEC)
}

/**
 * 刷新后恢复：若冷却未尽，带回邮箱 + Code 区 + 剩余秒数。
 * 不自动再发信。
 */
function restoreOtpResendFromStorage(): void {
  const peek = peekOtpResendCooldown()
  if (!peek) return
  pendingEmail.value = peek.email
  emailInput.value = peek.email
  emailStep.value = 'code'
  otpInput.value = ''
  beginResendUiCountdown(peek.remainingSec)
  focusOtpField()
}

/**
 * OAuth 跳到 Google/Microsoft 后用户点后退：页面常从 bfcache 恢复，
 * loading 仍停在 Redirecting… 且按钮 disabled。pageshow 时清掉。
 */
function onPageShow(): void {
  if (loadingProvider.value != null) {
    loadingProvider.value = null
  }
}

async function tryHandoffCurrentSession(): Promise<'ok' | 'cancelled_displace' | 'failed'> {
  // 仅本次 connect_extension；禁止 last_extension_id 顺带 remint
  if (!getPendingExtensionId()) {
    return 'failed'
  }
  const session = await getSession()
  if (!session?.access_token || !session.user?.id) {
    return 'failed'
  }
  connectingExtension.value = true
  toast.info('Connecting to the extension…', 8000)
  try {
    const profile = extractProfileFromUserMetadata(
      session.user.user_metadata as Record<string, unknown> | undefined
    )
    const result = await mintAndHandoffSessionToExtension({
      websiteAccessToken: session.access_token,
      userId: session.user.id,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...profile
    })
    if (result.status === 'ok') {
      toast.success('Extension connected')
    }
    return result.status
  } finally {
    connectingExtension.value = false
  }
}

/** 官网 session 已就绪后的收尾（Email OTP 本页校验 / 已登录直连共用）。 */
async function finishSignedInOnLoginPage(): Promise<void> {
  if (getPendingExtensionId()) {
    const handoff = await tryHandoffCurrentSession()
    if (handoff === 'ok') {
      redirecting.value = true
      window.location.replace('/account?extension_connected=1')
      return
    }
    if (handoff === 'cancelled_displace') {
      await abortWebsiteLoginAfterDisplaceCancel()
      return
    }
    flashError('Could not connect the extension. Install Yiveno and try Connect again.')
    return
  }
  const pending = peekAuthReturn()
  if (pending.next) {
    console.warn('[LoginForm] 已登录，回跳续意图（不 mint 扩展）', pending)
  }
  redirecting.value = true
  window.location.replace(buildPostAuthHref('/account'))
}

/** 将回调失败映射为用户可读错误（细节仅打 console，避免暴露 OAuth 栈） */
function applyLoginErrorFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('error')
  if (!code) {
    return
  }
  const detail = params.get('detail')
  const labels: Record<string, string> = {
    no_token: "Sign-in didn't finish. Please try again.",
    session_error: 'Could not save your sign-in session',
    auth_error: 'Sign-in failed unexpectedly',
    oauth_error: "We couldn't finish sign-in with that provider. Try again or use email."
  }
  const label = labels[code] || 'Sign-in failed. Please try again.'
  if (detail) {
    console.warn('[login]', code, detail)
  }
  flashError(label)
}

async function mountTurnstile(): Promise<void> {
  if (!turnstileEnabled) {
    flashError(
      'Email sign-in bot check is not configured. Use Google / Microsoft, or ask the site owner to finish setup.'
    )
    return
  }
  await nextTick()
  const host = turnstileHost.value
  if (!host) return
  try {
    turnstileHandle?.remove()
    turnstileHandle = await renderTurnstile(host, token => {
      captchaToken.value = token
    })
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Bot check failed to load. Try Google / Microsoft.'
    flashError(message)
    console.warn('[LoginForm] Turnstile', message)
  }
}

function resetTurnstile(): void {
  captchaToken.value = null
  turnstileHandle?.reset()
}

/**
 * 已登录：扩展 handoff / 续付 next 优先；否则直接进账户页。
 */
onMounted(async () => {
  window.addEventListener('pageshow', onPageShow)

  captureExtensionConnectParamsFromUrl()
  captureAuthReturnFromUrl()
  fromExtension.value = Boolean(getPendingExtensionId())
  fromSubscribe.value = peekAuthReturn().intent === 'subscribe'
  applyLoginErrorFromUrl()
  void mountTurnstile()
  try {
    const session = await getSession()
    if (!session) {
      restoreOtpResendFromStorage()
      return
    }
    // 仅 sessionStorage 的 connect_extension，不用 lastConnected（否则会抢走续付回跳）
    if (getPendingExtensionId()) {
      await finishSignedInOnLoginPage()
      return
    }
    const pending = peekAuthReturn()
    if (pending.next) {
      console.warn('[LoginForm] 已登录，回跳续意图（不 mint 扩展）', pending)
      redirecting.value = true
      window.location.replace(buildPostAuthHref('/account'))
      return
    }
    redirecting.value = true
    window.location.replace(buildPostAuthHref('/account'))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not check sign-in status'
    flashError(message)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', onPageShow)
  clearResendTimer()
  turnstileHandle?.remove()
  turnstileHandle = null
})

function captureIntentFlags(): void {
  captureExtensionConnectParamsFromUrl()
  captureAuthReturnFromUrl()
  fromExtension.value = Boolean(getPendingExtensionId())
  fromSubscribe.value = peekAuthReturn().intent === 'subscribe'
}

/**
 * 扩展 connect 且已有官网会话 → 直接 mint；否则清会话准备换号（非 connect）。
 * @returns true = 已完成收尾，调用方勿再发 OTP/OAuth
 */
async function tryConnectExistingOrPrepareFreshSignIn(): Promise<boolean> {
  if (getPendingExtensionId()) {
    const session = await getSession()
    if (session?.access_token && session.user?.id) {
      await finishSignedInOnLoginPage()
      return true
    }
    return false
  }
  if (await getSession()) {
    await signOut()
  }
  return false
}

async function login(provider: 'google' | 'microsoft') {
  if (oauthOrConnectBusy.value) {
    return
  }
  loadingProvider.value = provider
  try {
    captureIntentFlags()
    if (await tryConnectExistingOrPrepareFreshSignIn()) {
      loadingProvider.value = null
      return
    }
    await signInWithOAuth(provider)
    // 正常会离开本页；未跳走或用户立刻后退时由 pageshow 复位，这里再兜底
    scheduleClearLoadingIfStillHere()
  } catch (e: unknown) {
    flashError(mapAuthUserError(e))
    loadingProvider.value = null
  }
}

async function sendEmailCode(): Promise<void> {
  if (oauthOrConnectBusy.value) return
  if (!isValidEmail(emailInput.value)) {
    flashError('Enter a valid email address.')
    return
  }
  const emailNorm = normalizeEmail(emailInput.value)
  const cooldownLeft = remainingOtpResendSecFor(emailNorm)
  if (cooldownLeft > 0) {
    pendingEmail.value = emailNorm
    emailInput.value = emailNorm
    emailStep.value = 'code'
    beginResendUiCountdown(cooldownLeft)
    toast.info(`Please wait ${cooldownLeft}s before requesting another code.`)
    focusOtpField()
    return
  }
  if (!captchaToken.value) {
    flashError('Bot check is still running. Wait a moment and try again.')
    return
  }

  emailBusy.value = true
  const tokenForRequest = captchaToken.value
  try {
    captureIntentFlags()
    if (await tryConnectExistingOrPrepareFreshSignIn()) {
      return
    }
    const { email } = await signInWithEmailOtp(emailInput.value, tokenForRequest)
    pendingEmail.value = email
    emailInput.value = email
    emailStep.value = 'code'
    otpInput.value = ''
    toast.success(`Code sent to ${email}`)
    recordAndStartResendCooldown(email)
    focusOtpField()
  } catch (e: unknown) {
    flashError(mapAuthUserError(e, "We couldn't send a code. Check the address and try again."))
  } finally {
    emailBusy.value = false
    // token 已消耗；静默 reset 供重发
    resetTurnstile()
  }
}

async function resendEmailCode(): Promise<void> {
  if (resendSecondsLeft.value > 0 || oauthOrConnectBusy.value) {
    return
  }
  // 重发前对齐当前邮箱框（与发信地址一致时才允许）
  if (!showOtpField.value) {
    await sendEmailCode()
    return
  }
  const cooldownLeft = remainingOtpResendSecFor(pendingEmail.value)
  if (cooldownLeft > 0) {
    beginResendUiCountdown(cooldownLeft)
    toast.info(`Please wait ${cooldownLeft}s before requesting another code.`)
    return
  }
  if (!captchaToken.value) {
    flashError('Bot check is still running. Wait a moment and try again.')
    return
  }
  emailBusy.value = true
  const tokenForRequest = captchaToken.value
  try {
    await signInWithEmailOtp(pendingEmail.value, tokenForRequest)
    toast.success(`New code sent to ${pendingEmail.value}`)
    recordAndStartResendCooldown(pendingEmail.value)
    focusOtpField()
  } catch (e: unknown) {
    flashError(mapAuthUserError(e, "We couldn't resend the code. Try again in a minute."))
  } finally {
    emailBusy.value = false
    resetTurnstile()
  }
}

async function verifyEmailCode(): Promise<void> {
  if (!canVerifyOtp.value) {
    if (!isCompleteOtpCode(otpInput.value)) {
      flashError('Enter the 6-digit code from your email.')
    }
    return
  }
  emailBusy.value = true
  try {
    captureIntentFlags()
    await verifyEmailOtp(pendingEmail.value, otpInput.value)
    clearOtpResendCooldown()
    clearResendTimer()
    resendSecondsLeft.value = 0
    await finishSignedInOnLoginPage()
  } catch (e: unknown) {
    flashError(mapAuthUserError(e))
  } finally {
    emailBusy.value = false
  }
}

/** 单表单：未出码区则发信；已出码区则校验 */
function onEmailFormSubmit(): void {
  if (showOtpField.value) {
    void verifyEmailCode()
    return
  }
  void sendEmailCode()
}

function onOtpInput(event: Event): void {
  const target = event.target as HTMLInputElement
  otpInput.value = normalizeOtpCode(target.value)
}

/** OAuth 已发起但仍停在登录页时，避免 Redirecting… 永久卡住 */
function scheduleClearLoadingIfStillHere(): void {
  window.setTimeout(() => {
    if (loadingProvider.value == null) {
      return
    }
    if (document.visibilityState === 'visible') {
      loadingProvider.value = null
    }
  }, 2500)
}
</script>

<template>
  <div class="login-form page page--center">
    <SoftToastHost />
    <img
      class="login-form__logo"
      src="/images/logo-mark.svg"
      alt=""
      width="56"
      height="56"
      decoding="async"
    />
    <h1 class="page__title">Sign in to Yiveno</h1>
    <p v-if="redirecting" class="hint">Taking you to your account…</p>
    <template v-else>
      <!-- 入口取向说明（非操作反馈）仍可留在标题下；成功/失败一律 Toast -->
      <p v-if="fromSubscribe" class="hint">
        Sign in to continue checkout. We'll bring you back to pricing to finish.
      </p>
      <p v-else-if="fromExtension" class="hint">
        Connect the extension to your account. Your library stays on this device by default.
      </p>
      <p v-else class="hint">For Pro and billing — your library stays on this device by default.</p>

      <form class="login-form__email" @submit.prevent="onEmailFormSubmit">
        <label class="login-form__field-label" for="login-email">Email</label>
        <input
          id="login-email"
          v-model="emailInput"
          class="login-form__input"
          type="email"
          name="email"
          autocomplete="email"
          inputmode="email"
          placeholder="you@example.com"
          :disabled="oauthOrConnectBusy"
          required
        />

        <div ref="turnstileHost" class="login-form__turnstile" aria-label="Bot check" />

        <!-- 发码后插在主按钮上方；不预留整块空白（空白比一次下移更糟） -->
        <div v-if="showOtpField" class="login-form__otp-block">
          <label class="login-form__field-label" for="login-otp">Code</label>
          <input
            id="login-otp"
            ref="otpInputEl"
            class="login-form__input login-form__input--otp"
            type="text"
            name="otp"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]*"
            maxlength="8"
            placeholder="6-digit code"
            :value="otpInput"
            :disabled="oauthOrConnectBusy"
            required
            @input="onOtpInput"
          />
        </div>

        <button
          type="submit"
          class="ui-btn ui-btn--primary login-form__email-submit"
          :disabled="primaryCtaDisabled"
        >
          {{ primaryCtaLabel }}
        </button>

        <div v-if="showOtpField" class="login-form__email-actions">
          <button
            type="button"
            class="login-form__text-btn"
            :disabled="oauthOrConnectBusy || resendSecondsLeft > 0 || !captchaToken"
            @click="resendEmailCode"
          >
            <template v-if="resendSecondsLeft > 0">Resend in {{ resendSecondsLeft }}s</template>
            <template v-else-if="!captchaToken">Preparing…</template>
            <template v-else>Resend code</template>
          </button>
        </div>
      </form>

      <div class="login-form__divider" role="separator">
        <span class="login-form__divider-label">or</span>
      </div>

      <div class="login-form__oauth-row" role="group" aria-label="Sign in with a provider">
        <button
          type="button"
          :disabled="oauthOrConnectBusy"
          class="ui-btn login-form__oauth"
          :class="{ 'login-form__oauth--busy': loadingProvider === 'google' }"
          title="Sign in with Google"
          aria-label="Sign in with Google"
          :aria-busy="loadingProvider === 'google'"
          @click="login('google')"
        >
          <svg
            class="login-form__icon"
            width="20"
            height="20"
            viewBox="0 0 18 18"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
            />
          </svg>
          <span class="visually-hidden" aria-live="polite">
            {{ loadingProvider === 'google' ? 'Redirecting…' : '' }}
          </span>
        </button>
        <button
          type="button"
          :disabled="oauthOrConnectBusy"
          class="ui-btn login-form__oauth"
          :class="{ 'login-form__oauth--busy': loadingProvider === 'microsoft' }"
          title="Sign in with Microsoft"
          aria-label="Sign in with Microsoft"
          :aria-busy="loadingProvider === 'microsoft'"
          @click="login('microsoft')"
        >
          <svg
            class="login-form__icon"
            width="20"
            height="20"
            viewBox="0 0 18 18"
            aria-hidden="true"
          >
            <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
            <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
            <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
            <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
          </svg>
          <span class="visually-hidden" aria-live="polite">
            {{ loadingProvider === 'microsoft' ? 'Redirecting…' : '' }}
          </span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.login-form {
  /* 容纳「Sign in to Yiveno」单行；表单控件仍自限宽度 */
  max-width: min(36rem, 100%);
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

.login-form .page__title {
  font-size: clamp(28px, 4vw, 36px);
  margin-bottom: 12px;
  max-width: 100%;
  /* 不用 balance：短标题会被刻意拆成两行；窄屏仍按词自然折 */
  text-wrap: wrap;
}

.login-form__logo {
  display: block;
  width: 56px;
  height: 56px;
  margin: 0 auto 1rem;
  object-fit: contain;
  opacity: 0.9;
}

.login-form__email {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  max-width: 24rem;
  margin: 2rem auto 0;
  gap: 0.5rem;
  text-align: left;
}

.login-form__field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--on-surface);
}

.login-form__input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.45;
}

.login-form__input::placeholder {
  color: var(--sage-muted);
}

.login-form__input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.login-form__input:disabled {
  opacity: var(--disabled-opacity);
}

.login-form__input--otp {
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
}

.login-form__turnstile {
  /* interaction-only：静默过关时高度≈0；需交互时由部件自行撑开 */
  min-height: 0;
  margin-top: 0.15rem;
}

.login-form__otp-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.login-form__email-submit {
  width: 100%;
  margin-top: 0.15rem;
  /* 与 OAuth 按钮同策略：文案切换不改宽高 */
  min-height: 44px;
}

.login-form__email-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0.5rem 1rem;
  margin-top: 0.15rem;
  min-height: 1.35em;
}

.login-form__text-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 400;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.login-form__text-btn:hover,
.login-form__text-btn:focus-visible {
  color: var(--accent-hover, var(--accent));
}

.login-form__text-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.login-form__text-btn:disabled {
  opacity: var(--disabled-opacity);
  cursor: default;
  text-decoration: none;
}

.login-form__divider {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 24rem;
  margin: 1.1rem auto 0.85rem;
  gap: 0.75rem;
  color: var(--muted);
}

.login-form__divider::before,
.login-form__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.login-form__divider-label {
  font-size: 0.75rem;
  font-weight: 400;
  text-transform: lowercase;
}

.login-form__oauth-row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 5rem;
  width: 100%;
  max-width: 24rem;
  margin: 0 auto;
}

.login-form__oauth {
  position: relative;
  justify-content: center;
  box-sizing: border-box;
  width: 3rem;
  height: 3rem;
  min-width: 3rem;
  padding: 0;
  gap: 0;
}

.login-form__oauth--busy {
  opacity: 0.72;
}

.login-form__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.hint {
  color: var(--muted);
  font-size: 0.875rem;
  font-weight: 300;
  line-height: 1.5;
  margin: 0 0 0.75rem;
}
</style>
