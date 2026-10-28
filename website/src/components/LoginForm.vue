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
  EMAIL_OTP_LENGTH,
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
import { t, tFormat } from '../i18n/t'

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
const emailInputEl = ref<HTMLInputElement | null>(null)
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
/** 首屏入场就绪（阶梯 rise） */
const motionReady = ref(false)
/** 验码/已登录跳转前整卡淡出 */
const leaving = ref(false)

/** 与 CSS `.login-form--leaving` 时长对齐 */
const LOGIN_LEAVE_MS = 220

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms)
  })
}

/** 跳转前可选淡出整卡（reduced-motion 则瞬时） */
async function goAfterSignIn(href: string): Promise<void> {
  redirecting.value = true
  if (!prefersReducedMotion()) {
    leaving.value = true
    await sleep(LOGIN_LEAVE_MS)
  }
  window.location.replace(href)
}

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
    return emailBusy.value ? t('login.cta.verifying') : t('login.cta.verify')
  }
  return emailBusy.value ? t('login.cta.sending') : t('login.cta.send')
})

/** 改邮箱：仍在冷却的同址可恢复码区；换址则收起并清冷却键（防刷新又拉回旧址） */
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
  abandonOtpForEmailChange()
})

/**
 * 放弃当前发码态：清 sessionStorage 冷却 + 收起码区。
 * 「Use a different email」与手动改址共用。
 */
function abandonOtpForEmailChange(): void {
  clearOtpResendCooldown()
  clearResendTimer()
  resendSecondsLeft.value = 0
  emailStep.value = 'email'
  pendingEmail.value = ''
  otpInput.value = ''
}

/** 显式换邮箱：退出码区并聚焦邮箱框（全选便于改） */
function useDifferentEmail(): void {
  if (oauthOrConnectBusy.value) return
  abandonOtpForEmailChange()
  void nextTick(() => {
    emailInputEl.value?.focus()
    emailInputEl.value?.select()
  })
}

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
  toast.info(t('login.toast.connectingExtension'), 8000)
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
      toast.success(t('login.toast.extensionConnected'))
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
      await goAfterSignIn('/account?extension_connected=1')
      return
    }
    if (handoff === 'cancelled_displace') {
      await abortWebsiteLoginAfterDisplaceCancel()
      return
    }
    flashError(t('login.error.connectExtension'))
    return
  }
  const pending = peekAuthReturn()
  if (pending.next) {
    console.warn('[LoginForm] 已登录，回跳续意图（不 mint 扩展）', pending)
  }
  await goAfterSignIn(buildPostAuthHref('/account'))
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
    no_token: t('login.error.noToken'),
    session_error: t('login.error.sessionError'),
    auth_error: t('login.error.authError'),
    oauth_error: t('login.error.oauthError')
  }
  const label = labels[code] || t('login.error.generic')
  if (detail) {
    console.warn('[login]', code, detail)
  }
  flashError(label)
}

async function mountTurnstile(): Promise<void> {
  if (!turnstileEnabled) {
    flashError(t('login.error.turnstileNotConfigured'))
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
    const detail = e instanceof Error ? e.message : String(e || '')
    flashError(t('login.error.turnstileLoadFailed'))
    console.warn('[LoginForm] Turnstile', detail)
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
  // 下一帧再开入场，避免首帧闪「已到位」
  requestAnimationFrame(() => {
    motionReady.value = true
  })

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
      await goAfterSignIn(buildPostAuthHref('/account'))
      return
    }
    await goAfterSignIn(buildPostAuthHref('/account'))
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.warn('[LoginForm] check session', e.message)
    }
    flashError(t('login.error.checkSession'))
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
    flashError(t('login.error.invalidEmail'))
    return
  }
  const emailNorm = normalizeEmail(emailInput.value)
  const cooldownLeft = remainingOtpResendSecFor(emailNorm)
  if (cooldownLeft > 0) {
    pendingEmail.value = emailNorm
    emailInput.value = emailNorm
    emailStep.value = 'code'
    beginResendUiCountdown(cooldownLeft)
    toast.info(tFormat('login.toast.resendWait', { seconds: cooldownLeft }))
    focusOtpField()
    return
  }
  if (!captchaToken.value) {
    flashError(t('login.error.botCheckPending'))
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
    toast.success(tFormat('login.toast.codeSent', { email }))
    recordAndStartResendCooldown(email)
    focusOtpField()
  } catch (e: unknown) {
    flashError(mapAuthUserError(e, t('login.error.sendFailed')))
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
    toast.info(tFormat('login.toast.resendWait', { seconds: cooldownLeft }))
    return
  }
  if (!captchaToken.value) {
    flashError(t('login.error.botCheckPending'))
    return
  }
  emailBusy.value = true
  const tokenForRequest = captchaToken.value
  try {
    await signInWithEmailOtp(pendingEmail.value, tokenForRequest)
    toast.success(tFormat('login.toast.newCodeSent', { email: pendingEmail.value }))
    recordAndStartResendCooldown(pendingEmail.value)
    focusOtpField()
  } catch (e: unknown) {
    flashError(mapAuthUserError(e, t('login.error.resendFailed')))
  } finally {
    emailBusy.value = false
    resetTurnstile()
  }
}

async function verifyEmailCode(): Promise<void> {
  if (!canVerifyOtp.value) {
    if (!isCompleteOtpCode(otpInput.value)) {
      flashError(tFormat('login.error.otpIncomplete', { digits: EMAIL_OTP_LENGTH }))
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
  <div
    class="login-form page page--center"
    :class="{ 'login-form--ready': motionReady, 'login-form--leaving': leaving }"
  >
    <SoftToastHost />
    <img
      class="login-form__logo login-form__rise login-form__rise--1"
      src="/images/logo-mark.svg"
      alt=""
      width="48"
      height="48"
      decoding="async"
    />
    <h1 class="page__title login-form__rise login-form__rise--2">{{ t('login.title') }}</h1>
    <p v-if="redirecting" class="hint login-form__rise login-form__rise--3">
      {{ t('login.hint.redirecting') }}
    </p>
    <template v-else>
      <!-- 入口取向说明（非操作反馈）仍可留在标题下；成功/失败一律 Toast -->
      <p v-if="fromSubscribe" class="hint login-form__rise login-form__rise--3">
        {{ t('login.hint.subscribe') }}
      </p>
      <p v-else-if="fromExtension" class="hint login-form__rise login-form__rise--3">
        {{ t('login.hint.extension') }}
      </p>
      <p v-else class="hint login-form__rise login-form__rise--3">
        {{ t('login.hint.default') }}
      </p>

      <form
        class="login-form__email login-form__rise login-form__rise--4"
        @submit.prevent="onEmailFormSubmit"
      >
        <label class="login-form__field-label" for="login-email">{{
          t('login.email.label')
        }}</label>
        <input
          id="login-email"
          ref="emailInputEl"
          v-model="emailInput"
          class="login-form__input"
          type="email"
          name="email"
          autocomplete="email"
          inputmode="email"
          :placeholder="t('login.email.placeholder')"
          :disabled="oauthOrConnectBusy"
          :readonly="showOtpField"
          required
        />

        <div
          ref="turnstileHost"
          class="login-form__turnstile"
          :aria-label="t('login.turnstile.aria')"
        />

        <!-- 发码后插在主按钮上方；位数 = EMAIL_OTP_LENGTH + 重发送尾拼接（勿拆成多格，伤 autofill） -->
        <Transition name="login-otp">
          <div v-if="showOtpField" class="login-form__otp-block">
            <label class="login-form__field-label" for="login-otp">{{
              t('login.otp.label')
            }}</label>
            <div class="login-form__otp-row">
              <input
                id="login-otp"
                ref="otpInputEl"
                class="login-form__input login-form__input--otp"
                type="text"
                name="otp"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]*"
                :maxlength="EMAIL_OTP_LENGTH"
                :placeholder="'•'.repeat(EMAIL_OTP_LENGTH)"
                :value="otpInput"
                :disabled="oauthOrConnectBusy"
                required
                @input="onOtpInput"
              />
              <button
                type="button"
                class="login-form__otp-resend"
                :aria-label="t('login.resend.aria')"
                :disabled="oauthOrConnectBusy || resendSecondsLeft > 0 || !captchaToken"
                @click="resendEmailCode"
              >
                <template v-if="resendSecondsLeft > 0">
                  {{ t('login.resend.beforeSeconds') }}
                  <span :key="resendSecondsLeft" class="login-form__resend-sec">{{
                    resendSecondsLeft
                  }}</span>
                  {{ t('login.resend.afterSeconds') }}
                </template>
                <template v-else-if="!captchaToken">{{ t('login.resend.preparing') }}</template>
                <template v-else>{{ t('login.resend.idle') }}</template>
              </button>
            </div>
            <button
              type="button"
              class="login-form__text-link"
              :disabled="oauthOrConnectBusy"
              @click="useDifferentEmail"
            >
              {{ t('login.useDifferentEmail') }}
            </button>
          </div>
        </Transition>

        <button
          type="submit"
          class="ui-btn ui-btn--primary login-form__email-submit"
          :disabled="primaryCtaDisabled"
        >
          {{ primaryCtaLabel }}
        </button>
      </form>

      <div class="login-form__divider login-form__rise login-form__rise--5" role="separator">
        <span class="login-form__divider-label">{{ t('login.divider.or') }}</span>
      </div>

      <div
        class="login-form__oauth-row login-form__rise login-form__rise--6"
        role="group"
        :aria-label="t('login.oauth.groupAria')"
      >
        <button
          type="button"
          :disabled="oauthOrConnectBusy"
          class="ui-btn login-form__oauth"
          :class="{ 'login-form__oauth--busy': loadingProvider === 'google' }"
          :title="t('login.oauth.google')"
          :aria-label="t('login.oauth.google')"
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
            {{ loadingProvider === 'google' ? t('login.oauth.redirecting') : '' }}
          </span>
        </button>
        <button
          type="button"
          :disabled="oauthOrConnectBusy"
          class="ui-btn login-form__oauth"
          :class="{ 'login-form__oauth--busy': loadingProvider === 'microsoft' }"
          :title="t('login.oauth.microsoft')"
          :aria-label="t('login.oauth.microsoft')"
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
            {{ loadingProvider === 'microsoft' ? t('login.oauth.redirecting') : '' }}
          </span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.login-form.page {
  /*
   * 内容列 ≈24rem；水平 padding 用紧凑值覆盖 .page 的 --pad-x，
   * 避免「24rem 含大侧垫」把标题挤成两行。
   */
  box-sizing: border-box;
  width: min(100%, 26.5rem);
  max-width: 26.5rem;
  margin-inline: auto;
  padding-top: clamp(28px, 6vh, 64px);
  padding-bottom: clamp(40px, 8vh, 88px);
  padding-left: 1.25rem;
  padding-right: 1.25rem;
  transition: opacity 220ms cubic-bezier(0.2, 0, 0, 1);
}

.login-form--leaving {
  opacity: 0;
  pointer-events: none;
}

/* ① 首屏阶梯入场（仅 --ready 后播；入场允许短位移） */
.login-form__rise {
  opacity: 0;
  transform: translateY(10px);
}

.login-form--ready .login-form__rise {
  animation: login-rise 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.login-form--ready .login-form__rise--1 {
  animation-delay: 0ms;
}
.login-form--ready .login-form__rise--2 {
  animation-delay: 50ms;
}
.login-form--ready .login-form__rise--3 {
  animation-delay: 100ms;
}
.login-form--ready .login-form__rise--4 {
  animation-delay: 150ms;
}
.login-form--ready .login-form__rise--5 {
  animation-delay: 200ms;
}
.login-form--ready .login-form__rise--6 {
  animation-delay: 250ms;
}

@keyframes login-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  /* 标题组内紧：标题下缘贴近说明 */
  margin: 0 0 0.5rem;
  max-width: 100%;
  /* 不用 balance：短标题会被刻意拆成两行；窄屏仍按词自然折 */
  text-wrap: wrap;
}

.login-form__logo {
  display: block;
  width: 48px;
  height: 48px;
  margin: 0 auto 0.75rem;
  object-fit: contain;
  opacity: 0.92;
}

.login-form__email {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  max-width: none;
  /* 标题组 ↔ 表单：分组间距 */
  margin: 1.5rem auto 0;
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
  border: 1px solid color-mix(in srgb, var(--border) 70%, var(--ink));
  border-radius: var(--radius-sm);
  background: var(--surface-raised, var(--surface));
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.45;
  /* ⑥ 焦点环 / 边框；③ 禁用 opacity — 禁止 hover 几何变换 */
  transition:
    border-color 150ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 150ms cubic-bezier(0.2, 0, 0, 1),
    background-color 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0, 0, 1);
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

.login-form__input:read-only {
  /* 码区态锁邮箱：可读、可选，勿做成禁用灰 */
  color: var(--ink);
  cursor: default;
  background: color-mix(in srgb, var(--surface) 88%, var(--border));
}

/* 盖掉 Chrome 自动填充浅蓝底（inset 阴影压过 UA 背景） */
.login-form__input:autofill,
.login-form__input:autofill:hover,
.login-form__input:autofill:focus,
.login-form__input:-webkit-autofill,
.login-form__input:-webkit-autofill:hover,
.login-form__input:-webkit-autofill:focus,
.login-form__input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--ink);
  caret-color: var(--ink);
  box-shadow: 0 0 0 1000px var(--surface-raised, var(--surface)) inset;
  transition: background-color 99999s ease-out 0s;
}

.login-form__input:read-only:autofill,
.login-form__input:read-only:-webkit-autofill,
.login-form__input:read-only:-webkit-autofill:hover,
.login-form__input:read-only:-webkit-autofill:focus {
  box-shadow: 0 0 0 1000px color-mix(in srgb, var(--surface) 88%, var(--border)) inset;
}

.login-form__turnstile {
  /* interaction-only：静默过关时高度≈0；需交互时由部件自行撑开 */
  min-height: 0;
  margin-top: 0.15rem;
}

.login-form__otp-block {
  display: flex;
  flex-direction: column;
  /* label→输入 8px；输入→换邮箱 / 块内节奏对齐表单 gap */
  gap: 0.5rem;
  margin-top: 0.15rem;
}

/* 单框 OTP + 重发尾段拼接；焦点环落在整行 */
.login-form__otp-row {
  display: flex;
  align-items: stretch;
  min-height: 44px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, var(--ink));
  border-radius: var(--radius-sm);
  background: var(--surface-raised, var(--surface));
  overflow: hidden;
  transition:
    border-color 150ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 150ms cubic-bezier(0.2, 0, 0, 1);
}

.login-form__otp-row:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

/* ② 码区进出 */
.login-otp-enter-active,
.login-otp-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.2, 0, 0, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.login-otp-enter-from,
.login-otp-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.login-otp-enter-to,
.login-otp-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.login-form__input--otp {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  border-radius: 0;
  /* ≥16px：避免 iOS 聚焦自动缩放 */
  font-size: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.28em;
}

.login-form__input--otp:focus-visible {
  outline: none;
}

.login-form__otp-resend {
  flex: 0 0 auto;
  max-width: 46%;
  padding: 0 12px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition:
    color 180ms cubic-bezier(0.2, 0, 0, 1),
    background-color 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0, 0, 1);
}

/* ⑤ 倒计时秒数轻闪 */
.login-form__resend-sec {
  display: inline-block;
  min-width: 1.35em;
  font-variant-numeric: tabular-nums;
  text-align: center;
  animation: login-tick 120ms cubic-bezier(0.2, 0, 0, 1) both;
}

@keyframes login-tick {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

.login-form__otp-resend:hover,
.login-form__otp-resend:focus-visible {
  color: var(--accent-hover, var(--accent));
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.login-form__otp-resend:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.login-form__otp-resend:disabled {
  opacity: var(--disabled-opacity);
  cursor: default;
  background: transparent;
}

.login-form__text-link {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
  cursor: pointer;
  text-decoration: none;
  transition:
    color 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0, 0, 1);
}

.login-form__text-link:hover,
.login-form__text-link:focus-visible {
  color: var(--accent-hover, var(--accent));
}

.login-form__text-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.login-form__text-link:disabled {
  opacity: var(--disabled-opacity);
  cursor: default;
}

.login-form__email-submit {
  width: 100%;
  /* 表单 gap 0.5rem + 本边距 ≈ 16–20px，字段组与主 CTA 标准呼吸距 */
  margin-top: 0.75rem;
  /* 与 OAuth 按钮同策略：文案切换不改宽高 */
  min-height: 44px;
  letter-spacing: 0.01em;
  /* ③ 与 pages.css ui-btn 对齐；禁用态 opacity 跟手 */
  transition:
    background 180ms cubic-bezier(0.2, 0, 0, 1),
    border-color 180ms cubic-bezier(0.2, 0, 0, 1),
    color 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0, 0, 1);
}

.login-form__divider {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 1.25rem auto;
  gap: 0.75rem;
  color: var(--on-surface-muted, var(--muted));
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
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  /* 原 5rem 过散；两枚图标钮用 lg 间距即可 */
  gap: 1.5rem;
  width: 100%;
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
  background: var(--surface-raised, var(--surface));
  border-color: color-mix(in srgb, var(--border) 70%, var(--ink));
  transition:
    background 180ms cubic-bezier(0.2, 0, 0, 1),
    border-color 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0, 0, 1);
}

.login-form__oauth:hover,
.login-form__oauth:focus-visible {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-raised, var(--surface)));
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
  max-width: 22rem;
  margin: 0 auto;
  color: var(--on-surface-muted, var(--muted));
  font-size: 0.9375rem;
  font-weight: 300;
  line-height: 1.55;
}

@media (max-width: 480px) {
  .login-form.page {
    padding-top: clamp(20px, 4vh, 40px);
    padding-bottom: clamp(32px, 6vh, 64px);
  }

  .login-form__oauth-row {
    gap: 1.25rem;
  }
}

/* ④ reduced-motion：入场/码区/倒计时/离场瞬时或仅 opacity */
@media (prefers-reduced-motion: reduce) {
  .login-form.page {
    transition: none;
  }

  .login-form--leaving {
    opacity: 1;
  }

  .login-form__rise {
    opacity: 1;
    transform: none;
  }

  .login-form--ready .login-form__rise {
    animation: none;
  }

  .login-otp-enter-active,
  .login-otp-leave-active {
    transition: none;
  }

  .login-otp-enter-from,
  .login-otp-leave-to {
    opacity: 1;
    transform: none;
  }

  .login-form__resend-sec {
    animation: none;
  }

  .login-form__input,
  .login-form__otp-row,
  .login-form__otp-resend,
  .login-form__email-submit,
  .login-form__oauth,
  .login-form__text-link {
    transition: none;
  }
}
</style>
