<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { LucideIcon, Tooltip, Card, Input, Dialog, Button } from '@/components'
import { MdSwitch } from '@/components/base/Switch'
import { MdTabs } from '@/components/base/Tabs'
import { aiAppService } from '@/application/ai/ai-app-service'
import type { UserLLMProvider, HostedQuotaInfo } from '@/application/ai/ai-app-service'
import { message } from '@/application/message/message-service'
import { useSubscription } from '@/composables/useSubscription'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { logger } from '@/infrastructure/logging/logger'
import {
  AI_AUTO_BOOKMARK_STORAGE_KEY,
  AI_ONE_CLICK_ORGANIZE_STORAGE_KEY,
  SEMANTIC_SEARCH_STORAGE_KEY,
  isAiAutoBookmarkEnabled,
  isAiOneClickOrganizeEnabled,
  isSemanticSearchEnabled
} from '@/core/ai/ai-feature-settings'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import { requestBookmarkEmbeddingSyncFromPage } from '@/application/embedding/request-embedding-sync'
import { isAiEngineUiReady } from '@/application/ai/ai-engine-availability'

defineOptions({ name: 'AISettings' })

const { isPro } = useSubscription()
const { isAuthenticated } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

// Tab 状态
const activeTab = ref<'apikey' | 'hosted'>('hosted')
const activeTabIndex = computed({
  get: () => (activeTab.value === 'hosted' ? 0 : 1),
  set: (val: number) => {
    activeTab.value = val === 0 ? 'hosted' : 'apikey'
  }
})

// Pro 托管 AI 配额
const hostedQuota = ref<HostedQuotaInfo | null>(null)
const loadingHostedQuota = ref(false)

const aiAutoEnabled = ref(true)
const aiOneClickOrganizeEnabled = ref(true)
const semanticSearchEnabled = ref(true)

// 各服务商的模型列表
const modelsByProvider: Record<UserLLMProvider, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (推荐) - 快速且经济' },
    { value: 'gpt-4o', label: 'GPT-4o - 最强性能' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo - 平衡性能' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo - 最经济' },
    { value: 'custom', label: '其他模型...' }
  ],
  claude: [
    {
      value: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet (推荐) - 最强性能'
    },
    {
      value: 'claude-3-5-haiku-20241022',
      label: 'Claude 3.5 Haiku - 快速响应'
    },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus - 复杂任务' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku - 最经济' },
    { value: 'custom', label: '其他模型...' }
  ],
  gemini: [
    {
      value: 'gemini-2.0-flash-exp',
      label: 'Gemini 2.0 Flash (推荐) - 最新实验版'
    },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro - 强大性能' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash - 快速响应' },
    { value: 'custom', label: '其他模型...' }
  ],
  deepseek: [
    {
      value: 'deepseek-chat',
      label: 'DeepSeek Chat（推荐）- 通用对话与日常任务'
    },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner - 更强推理能力' },
    { value: 'custom', label: '其他模型...' }
  ]
}

const selectedProvider = ref<UserLLMProvider>('openai')
const apiKey = ref('')
const selectedModel = ref(modelsByProvider.openai[0]?.value ?? '')
const showKey = ref(false)
const showAIEngineDialog = ref(false)
const saving = ref(false)
const isSaved = ref(false)

// 自定义模型名称
const customModelName = ref('')

// 当前服务商的可用模型
const availableModels = computed(() => modelsByProvider[selectedProvider.value])

// 是否显示自定义模型输入框
const showCustomModelInput = computed(() => selectedModel.value === 'custom')

/** 将智能模型重置为当前服务商的第一项（推荐） */
function applyDefaultModelForProvider(provider: UserLLMProvider): void {
  const firstModel = modelsByProvider[provider]?.[0]
  if (!firstModel) return
  selectedModel.value = firstModel.value
  customModelName.value = ''
}

/** 读取 Material Web Select 的选中值 */
function readSelectValue(event: Event): string {
  const target = event.target as HTMLElement & { value?: string }
  return target.value ?? ''
}

/** 切换 AI 服务商时，默认选中该服务商的第一项模型 */
function handleProviderChange(event: Event) {
  const provider = readSelectValue(event) as UserLLMProvider
  selectedProvider.value = provider
  applyDefaultModelForProvider(provider)
}

/** 更新智能模型选择 */
function handleModelChange(event: Event) {
  selectedModel.value = readSelectValue(event)
}

const providerNames: Record<UserLLMProvider, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic',
  gemini: 'Google',
  deepseek: 'DeepSeek'
}

const providerLinks: Record<UserLLMProvider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  claude: 'https://console.anthropic.com/settings/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
  deepseek: 'https://platform.deepseek.com/api_keys'
}
const keyPlaceholder = computed(() => {
  const map: Record<UserLLMProvider, string> = {
    openai: 'sk-...',
    claude: 'sk-ant-...',
    gemini: 'AIza...',
    deepseek: 'sk-...'
  }
  return map[selectedProvider.value]
})

// 是否已配置 API Key
const hasApiKeyConfigured = computed(() => !!apiKey.value.trim())

/** 当前生效的 AI 模型名称（展示用） */
const activeModelLabel = computed(() => {
  if (!hasApiKeyConfigured.value) return ''
  const model = selectedModel.value === 'custom' ? customModelName.value : selectedModel.value
  return model || ''
})

/** 云端 AI 来源详情 */
const cloudSourceDetail = computed(() => {
  if (!hasApiKeyConfigured.value) {
    return '未配置，点击添加访问密钥'
  }
  const provider = providerNames[selectedProvider.value]
  return activeModelLabel.value ? `${provider} · ${activeModelLabel.value}` : provider
})

/** Pro 托管 AI 来源详情 */
const hostedSourceDetail = computed(() => {
  if (!isLoggedIn.value) {
    return '请先登录'
  }
  if (!isPro.value) {
    return 'Pro 用户默认可用'
  }
  if (hostedQuota.value) {
    return `DeepSeek V4 Flash · 本月 ${hostedQuota.value.used}/${hostedQuota.value.limit} 次`
  }
  return 'Pro 已启用，正在加载配额…'
})

/** 当前实际生效的 AI 引擎说明 */
const activeEngineLabel = computed(() => {
  if (hasApiKeyConfigured.value) {
    const provider = providerNames[selectedProvider.value]
    return activeModelLabel.value
      ? `自定义 API Key · ${provider} · ${activeModelLabel.value}`
      : `自定义 API Key · ${provider}`
  }
  if (isPro.value && isLoggedIn.value) {
    const model = hostedQuota.value?.model ?? 'DeepSeek V4 Flash'
    return `Yiveno 托管 · ${model}`
  }
  return '本地基础能力'
})

/** 当前引擎状态类型（用于样式） */
const activeEngineStatus = computed<'cloud' | 'hosted' | 'basic'>(() => {
  if (hasApiKeyConfigured.value) return 'cloud'
  if (isPro.value && isLoggedIn.value) return 'hosted'
  return 'basic'
})

/** AI 引擎是否已配置（一键整理前置条件） */
const aiEngineReady = computed(() =>
  isAiEngineUiReady({
    hasApiKey: hasApiKeyConfigured.value,
    isPro: isPro.value,
    isLoggedIn: isLoggedIn.value
  })
)

/** 打开 AI 引擎配置弹窗 */
function openEngineDialog(tab: 'apikey' | 'hosted') {
  activeTab.value = tab
  showAIEngineDialog.value = true
}

function getSwitchSelected(event: Event): boolean {
  const target = event.target as HTMLElement & { selected?: boolean }
  return target.selected === true
}

/** 处理 AI 自动归纳开关切换 */
async function handleAIAutoToggle(event: Event) {
  aiAutoEnabled.value = getSwitchSelected(event)
  try {
    await chrome.storage.local.set({ [AI_AUTO_BOOKMARK_STORAGE_KEY]: aiAutoEnabled.value })
    logger.info('AISettings', 'AI 自动归纳设置已更新', {
      enabled: aiAutoEnabled.value
    })
  } catch (error) {
    logger.error('AISettings', '保存 AI 自动归纳设置失败', error)
  }
}

/** 处理语义检索开关切换 */
async function handleSemanticSearchToggle(event: Event) {
  semanticSearchEnabled.value = getSwitchSelected(event)
  try {
    await chrome.storage.local.set({
      [SEMANTIC_SEARCH_STORAGE_KEY]: semanticSearchEnabled.value
    })
    bookmarkSearchService.clearCache()
    if (semanticSearchEnabled.value && isPro.value && isLoggedIn.value) {
      requestBookmarkEmbeddingSyncFromPage()
    }
    logger.info('AISettings', '语义检索设置已更新', {
      enabled: semanticSearchEnabled.value
    })
  } catch (error) {
    logger.error('AISettings', '保存语义检索设置失败', error)
  }
}

/** 处理一键整理开关切换 */
async function handleOneClickOrganizeToggle(event: Event) {
  const selected = getSwitchSelected(event)
  if (selected && !aiEngineReady.value) {
    return
  }

  aiOneClickOrganizeEnabled.value = selected
  try {
    await chrome.storage.local.set({
      [AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]: aiOneClickOrganizeEnabled.value
    })
    logger.info('AISettings', '一键整理设置已更新', {
      enabled: aiOneClickOrganizeEnabled.value
    })
  } catch (error) {
    logger.error('AISettings', '保存一键整理设置失败', error)
  }
}

/** AI 引擎不可用时，自动关闭一键整理 */
async function disableOneClickOrganizeIfEngineUnavailable(): Promise<void> {
  if (aiEngineReady.value || !aiOneClickOrganizeEnabled.value) {
    return
  }

  aiOneClickOrganizeEnabled.value = false
  try {
    await chrome.storage.local.set({ [AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]: false })
    logger.info('AISettings', 'AI 引擎未配置，已自动关闭一键整理')
  } catch (error) {
    logger.error('AISettings', '自动关闭一键整理失败', error)
  }
}

watch(aiEngineReady, () => {
  void disableOneClickOrganizeIfEngineUnavailable()
})

/** 各服务商控制台链接 */
const consoleLinks: Record<UserLLMProvider, { url: string; text: string }> = {
  openai: {
    url: 'https://platform.openai.com/account/billing',
    text: '前往 OpenAI 控制台充值'
  },
  claude: {
    url: 'https://console.anthropic.com/settings/billing',
    text: '前往 Anthropic 控制台充值'
  },
  gemini: {
    url: 'https://aistudio.google.com/app/apikey',
    text: '前往 Google AI Studio 查看额度'
  },
  deepseek: {
    url: 'https://platform.deepseek.com/usage',
    text: '前往 DeepSeek 平台查看额度与充值'
  }
}

/** 保存后测试云端 AI 连通性并提示结果 */
async function verifySavedCloudConnection(): Promise<boolean> {
  const provider = providerNames[selectedProvider.value]
  try {
    await aiAppService.testUserLlmConnection()
    message.success(`配置已保存，${provider} 连接正常`)
    return true
  } catch (e) {
    const msg = String(e).replace(/^Error:\s*/, '')
    const isQuotaError = msg.includes('额度') || msg.includes('充值') || msg.includes('频率')
    const isKeyError = msg.includes('无效') || msg.includes('过期') || msg.includes('权限')
    const link = consoleLinks[selectedProvider.value]
    const failurePrefix = `配置已保存，但连接测试失败：${msg}`

    if ((isQuotaError || isKeyError) && link.url) {
      message.warning(`${failurePrefix}（${link.text}：${link.url}）`)
    } else {
      message.error(failurePrefix)
    }
    return false
  }
}

/** 保存配置 */
async function saveConfig() {
  if (!apiKey.value.trim()) {
    await clearConfig(true)
    message.success('未配置访问密钥，将使用 Yiveno 托管 AI')
    return
  }

  // 如果选择了"其他模型",但没有输入自定义模型名称
  if (selectedModel.value === 'custom' && !customModelName.value.trim()) {
    message.error('请输入自定义模型名称')
    return
  }

  saving.value = true
  try {
    // 确定最终使用的模型名称
    const finalModel =
      selectedModel.value === 'custom' ? customModelName.value.trim() : selectedModel.value

    // 确保 model 不为空字符串
    const modelValue = finalModel || undefined

    await aiAppService.saveUserLlmConfig({
      provider: selectedProvider.value,
      apiKey: apiKey.value.trim(),
      ...(modelValue && { model: modelValue })
    })
    isSaved.value = true
    await verifySavedCloudConnection()
  } catch (_e) {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/** 清除配置 */
async function clearConfig(silent = false) {
  await aiAppService.clearUserLlmConfig()
  apiKey.value = ''
  applyDefaultModelForProvider(selectedProvider.value)
  isSaved.value = false
  if (!silent) {
    message.success('云端 AI 配置已清除')
  }
}

/** 加载 Pro 托管 AI 配额 */
async function loadHostedQuota(forceRefresh = false) {
  if (!isLoggedIn.value || !isPro.value) {
    hostedQuota.value = null
    return
  }

  loadingHostedQuota.value = true
  try {
    hostedQuota.value = await aiAppService.fetchHostedQuota(forceRefresh)
  } catch (error) {
    logger.error('AISettings', '加载托管 AI 配额失败', error)
    hostedQuota.value = null
  } finally {
    loadingHostedQuota.value = false
  }
}

/** 加载 AI 配置 */
async function loadAIConfig() {
  const config = await aiAppService.getUserLlmConfig()
  if (config) {
    selectedProvider.value = config.provider
    apiKey.value = config.apiKey
    isSaved.value = true

    if (config.model) {
      const models = modelsByProvider[config.provider]
      const presetModel = models?.find(m => m.value === config.model)

      if (presetModel) {
        selectedModel.value = config.model
      } else {
        selectedModel.value = 'custom'
        customModelName.value = config.model
      }
    } else {
      applyDefaultModelForProvider(config.provider)
    }
  } else {
    applyDefaultModelForProvider(selectedProvider.value)
  }
}

/** 加载 AI 功能开关状态 */
async function loadAIFeatureState() {
  try {
    const result = await chrome.storage.local.get([
      AI_AUTO_BOOKMARK_STORAGE_KEY,
      AI_ONE_CLICK_ORGANIZE_STORAGE_KEY,
      SEMANTIC_SEARCH_STORAGE_KEY
    ])
    aiAutoEnabled.value = isAiAutoBookmarkEnabled(result[AI_AUTO_BOOKMARK_STORAGE_KEY])
    aiOneClickOrganizeEnabled.value = isAiOneClickOrganizeEnabled(
      result[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]
    )
    semanticSearchEnabled.value = isSemanticSearchEnabled(result[SEMANTIC_SEARCH_STORAGE_KEY])

    logger.info('AISettings', '设置已加载', {
      aiAuto: aiAutoEnabled.value,
      aiOneClickOrganize: aiOneClickOrganizeEnabled.value,
      semanticSearch: semanticSearchEnabled.value
    })
  } catch (error) {
    logger.error('AISettings', '加载设置失败', error)
  }
}

watch([isLoggedIn, isPro], () => {
  void loadHostedQuota(true)
})

onMounted(async () => {
  await loadAIConfig()
  await loadHostedQuota()
  await loadAIFeatureState()
  await disableOneClickOrganizeIfEngineUnavailable()
})
</script>

<template>
  <div class="settings-section">
    <!-- AI 功能开关（Pro 用户可独立配置） -->
    <div class="ai-features-section">
      <div class="ai-features-section__header">
        <div class="ai-features-section__title-row">
          <span class="ai-features-section__title">功能开关</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                选择要在哪些场景启用 AI。Pro 用户默认使用 Yiveno 托管 AI，也可配置自己的 API Key。
              </div>
            </template>
          </Tooltip>
        </div>
      </div>

      <!-- AI 自动归纳书签 -->
      <div class="feature-row">
        <label class="feature-label">
          <span>自动添加书签</span>
          <span v-if="isPro" class="pro-badge">PRO</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                开启后，添加书签时不会弹出对话框，系统会自动判断并保存到合适目录。<br />
                关闭后，每次添加书签都会弹出对话框让你手动选择文件夹。
              </div>
            </template>
          </Tooltip>
        </label>
        <Tooltip v-if="!isPro" offset="md">
          <MdSwitch v-model="aiAutoEnabled" disabled></MdSwitch>
          <template #content>
            <div class="tooltip-content">
              AI 功能仅限 Pro 用户使用。<br />
              <a href="#" class="tooltip-link">升级到 Pro</a>
            </div>
          </template>
        </Tooltip>
        <MdSwitch v-else v-model="aiAutoEnabled" @change="handleAIAutoToggle"></MdSwitch>
      </div>

      <!-- 语义检索 -->
      <div class="feature-row">
        <label class="feature-label">
          <span>语义检索</span>
          <span v-if="isPro" class="pro-badge">PRO</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                开启后，Popup / Omnibox / 管理页可使用模糊语义筛选（如「听歌」→ 音乐平台书签）。<br />
                关闭后仅使用标题 / URL / 域名关键词匹配。
              </div>
            </template>
          </Tooltip>
        </label>
        <Tooltip v-if="!isPro" offset="md">
          <MdSwitch v-model="semanticSearchEnabled" disabled></MdSwitch>
          <template #content>
            <div class="tooltip-content">
              语义检索仅限 Pro 用户使用。<br />
              <a href="#" class="tooltip-link">升级到 Pro</a>
            </div>
          </template>
        </Tooltip>
        <Tooltip v-else-if="!isLoggedIn" offset="md">
          <MdSwitch :model-value="false" disabled></MdSwitch>
          <template #content>
            <div class="tooltip-content">需先登录 Pro 账户后使用语义检索。</div>
          </template>
        </Tooltip>
        <MdSwitch
          v-else
          v-model="semanticSearchEnabled"
          @change="handleSemanticSearchToggle"
        ></MdSwitch>
      </div>

      <!-- 一键整理 -->
      <div class="feature-row">
        <label class="feature-label">
          <span>一键整理</span>
          <span v-if="isPro" class="pro-badge">PRO</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                Pro 用户默认可用托管 AI。开启后，管理页将显示「一键整理」按钮。<br />
                关闭后，管理页不显示该入口。
              </div>
            </template>
          </Tooltip>
        </label>
        <Tooltip v-if="!isPro" offset="md">
          <MdSwitch v-model="aiOneClickOrganizeEnabled" disabled></MdSwitch>
          <template #content>
            <div class="tooltip-content">
              AI 功能仅限 Pro 用户使用。<br />
              <a href="#" class="tooltip-link">升级到 Pro</a>
            </div>
          </template>
        </Tooltip>
        <Tooltip v-else-if="!aiEngineReady" offset="md">
          <MdSwitch :model-value="false" disabled></MdSwitch>
          <template #content>
            <div class="tooltip-content">
              <template v-if="!isLoggedIn">需先登录后使用 Pro 托管 AI。</template>
              <template v-else-if="!isPro">
                一键整理仅限 Pro 用户使用。<br />
                <a href="#" class="tooltip-link">升级到 Pro</a>
              </template>
              <template v-else>
                需先登录 Pro 账户，或配置自定义 API Key。<br />
                <a href="#" class="tooltip-link" @click.prevent="openEngineDialog('hosted')"
                  >查看 AI 引擎</a
                >
              </template>
            </div>
          </template>
        </Tooltip>
        <MdSwitch
          v-else
          v-model="aiOneClickOrganizeEnabled"
          @change="handleOneClickOrganizeToggle"
        ></MdSwitch>
      </div>
    </div>

    <div v-if="isLoggedIn" class="ai-engine-section">
      <div class="ai-engine-section__intro">
        <div class="ai-engine-section__title-row">
          <LucideIcon name="cpu" :size="18" class="ai-engine-section__title-icon" />
          <span class="ai-engine-section__title">AI 引擎</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                自动整理、智能归类等功能需要 AI 提供算力。<br />
                Pro 用户默认使用 Yiveno 托管 AI，也可配置自己的 API Key 替换默认服务。
              </div>
            </template>
          </Tooltip>
        </div>
        <p class="ai-engine-section__desc">
          Pro 用户默认启用托管 AI。配置 API Key 后将优先使用你的自有服务。
        </p>
      </div>

      <div class="ai-engine-active" :class="`ai-engine-active--${activeEngineStatus}`">
        <LucideIcon
          :name="
            activeEngineStatus === 'cloud'
              ? 'cloud'
              : activeEngineStatus === 'hosted'
                ? 'sparkles'
                : 'layers'
          "
          :size="18"
        />
        <div class="ai-engine-active__text">
          <span class="ai-engine-active__label">当前生效</span>
          <span class="ai-engine-active__value">{{ activeEngineLabel }}</span>
        </div>
      </div>

      <div class="ai-engine-sources">
        <button
          type="button"
          class="source-card"
          :class="{ 'source-card--ready': isPro && isLoggedIn }"
          @click="openEngineDialog('hosted')"
        >
          <div class="source-card__header">
            <div class="source-card__icon source-card__icon--hosted">
              <LucideIcon name="sparkles" :size="20" />
            </div>
            <div class="source-card__meta">
              <div class="source-card__title-row">
                <span class="source-card__title">Yiveno 托管 AI</span>
                <span class="source-card__badge">Pro 默认</span>
              </div>
              <p class="source-card__desc">DeepSeek V4 Flash，开箱即用</p>
            </div>
          </div>
          <div class="source-card__footer">
            <span
              class="source-card__status"
              :class="{ 'source-card__status--ready': isPro && isLoggedIn }"
            >
              <LucideIcon :name="isPro && isLoggedIn ? 'check-circle' : 'circle'" :size="14" />
              {{ hostedSourceDetail }}
            </span>
            <span class="source-card__action">
              查看
              <LucideIcon name="chevron-right" :size="14" />
            </span>
          </div>
        </button>

        <button
          type="button"
          class="source-card"
          :class="{ 'source-card--ready': hasApiKeyConfigured }"
          @click="openEngineDialog('apikey')"
        >
          <div class="source-card__header">
            <div class="source-card__icon source-card__icon--cloud">
              <LucideIcon name="cloud" :size="20" />
            </div>
            <div class="source-card__meta">
              <div class="source-card__title-row">
                <span class="source-card__title">自定义 API Key</span>
                <span class="source-card__badge">可选</span>
              </div>
              <p class="source-card__desc">使用自己的 OpenAI、Claude 等服务</p>
            </div>
          </div>
          <div class="source-card__footer">
            <span
              class="source-card__status"
              :class="{ 'source-card__status--ready': hasApiKeyConfigured }"
            >
              <LucideIcon :name="hasApiKeyConfigured ? 'check-circle' : 'circle'" :size="14" />
              {{ cloudSourceDetail }}
            </span>
            <span class="source-card__action">
              {{ hasApiKeyConfigured ? '管理' : '配置' }}
              <LucideIcon name="chevron-right" :size="14" />
            </span>
          </div>
        </button>
      </div>

      <div class="ai-engine-priority">
        <LucideIcon name="info" :size="14" />
        <span>使用优先级：自定义 API Key → Yiveno 托管 AI → 本地基础能力</span>
      </div>
    </div>

    <Dialog
      v-if="isLoggedIn"
      :show="showAIEngineDialog"
      title="配置 AI 引擎"
      width="960px"
      body-min-height="520px"
      @update:show="showAIEngineDialog = $event"
    >
      <p class="dialog-intro">
        Pro 用户默认使用 Yiveno 托管 AI。配置 API Key 后，系统将优先使用你的自有服务。
      </p>

      <div class="provider-tabs">
        <MdTabs v-model="activeTabIndex">
          <md-primary-tab>
            托管 AI
            <LucideIcon
              v-if="isPro && isLoggedIn"
              name="check-circle"
              :size="16"
              class="tab-status-icon tab-status-icon--success"
            />
          </md-primary-tab>
          <md-primary-tab>
            自定义 API Key
            <LucideIcon
              v-if="hasApiKeyConfigured"
              name="check-circle"
              :size="16"
              class="tab-status-icon tab-status-icon--success"
            />
          </md-primary-tab>
        </MdTabs>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'hosted'" class="tab-panel">
          <Card variant="default" :padding="false" class="status-card">
            <div class="status-card-content">
              <LucideIcon name="sparkles" :size="20" />
              <div class="status-content">
                <h4>Yiveno 托管 AI</h4>
                <p>Pro 用户默认使用 DeepSeek V4 Flash，无需配置 API Key。</p>
              </div>
              <Button variant="text" :disabled="loadingHostedQuota" @click="loadHostedQuota(true)">
                <LucideIcon name="refresh-cw" :size="16" />
                刷新配额
              </Button>
            </div>
          </Card>

          <div v-if="isPro && isLoggedIn && hostedQuota" class="hosted-quota-panel">
            <div class="hosted-quota-row">
              <span>当前模型</span>
              <strong>{{ hostedQuota.model }}</strong>
            </div>
            <div class="hosted-quota-row">
              <span>本月用量</span>
              <strong>{{ hostedQuota.used }} / {{ hostedQuota.limit }} 次</strong>
            </div>
            <div class="hosted-quota-row">
              <span>剩余次数</span>
              <strong>{{ hostedQuota.remaining }} 次</strong>
            </div>
          </div>

          <div v-else-if="!isPro" class="alternative-tip">
            <LucideIcon name="info" :size="16" />
            <span>托管 AI 仅限 Pro 用户使用，升级后即可开箱即用。</span>
          </div>

          <div class="privacy-note">
            <LucideIcon name="shield" :size="14" />
            <span>一键整理等增强功能会发送书签标题与 URL 到服务器，由 DeepSeek 处理。</span>
          </div>
        </div>

        <div v-else-if="activeTab === 'apikey'" class="tab-panel">
          <!-- Provider 选择 -->
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">AI 服务商</label>
              <div class="form-field">
                <md-outlined-select
                  :value="selectedProvider"
                  class="select-field"
                  @input="handleProviderChange"
                >
                  <md-select-option value="openai">
                    <div slot="headline">OpenAI（推荐）</div>
                  </md-select-option>
                  <md-select-option value="claude">
                    <div slot="headline">Anthropic Claude</div>
                  </md-select-option>
                  <md-select-option value="gemini">
                    <div slot="headline">Google Gemini</div>
                  </md-select-option>
                  <md-select-option value="deepseek">
                    <div slot="headline">DeepSeek</div>
                  </md-select-option>
                </md-outlined-select>
              </div>
            </div>

            <!-- 智能模型选择 -->
            <div class="form-row">
              <label class="form-label">智能模型</label>
              <div class="form-field">
                <md-outlined-select
                  :key="selectedProvider"
                  :value="selectedModel"
                  class="select-field"
                  @input="handleModelChange"
                >
                  <md-select-option
                    v-for="model in availableModels"
                    :key="model.value"
                    :value="model.value"
                  >
                    <div slot="headline">{{ model.label }}</div>
                  </md-select-option>
                </md-outlined-select>
              </div>
            </div>

            <!-- 访问密钥输入 -->
            <div class="form-row">
              <label class="form-label form-label--with-tooltip">
                访问密钥
                <Tooltip offset="md">
                  <LucideIcon name="info" class="label-info-icon" />
                  <template #content>
                    <div class="tooltip-content">
                      即服务商提供的 API Key。<br />
                      仅保存在本设备，直连服务商，不经过 Yiveno 服务器。
                    </div>
                  </template>
                </Tooltip>
              </label>
              <div class="form-field">
                <Input
                  v-model="apiKey"
                  :type="showKey ? 'text' : 'password'"
                  :placeholder="keyPlaceholder"
                  :trailing-icon="showKey ? 'eye-off' : 'eye'"
                  :trailing-icon-size="18"
                  class="text-field"
                  variant="outlined"
                  @keydown.enter.prevent="saveConfig"
                  @trailing-icon-click="showKey = !showKey"
                />
              </div>
            </div>

            <!-- 自定义模型名称(仅在选择"其他模型"时显示) -->
            <div v-if="showCustomModelInput" class="form-row">
              <label class="form-label form-label--with-tooltip">
                模型名称
                <Tooltip offset="md">
                  <LucideIcon name="info" class="label-info-icon" />
                  <template #content>
                    <div class="tooltip-content">
                      输入完整的模型 ID,例如:<br />
                      OpenAI: gpt-4o-2024-05-13<br />
                      Claude: claude-3-5-sonnet-20241022<br />
                      Gemini: gemini-1.5-pro-002<br />
                      DeepSeek: deepseek-chat
                    </div>
                  </template>
                </Tooltip>
              </label>
              <div class="form-field">
                <Input
                  v-model="customModelName"
                  placeholder="输入完整的模型 ID"
                  class="text-field"
                  variant="outlined"
                />
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="actions">
            <Button variant="filled" :loading="saving" :disabled="saving" @click="saveConfig">
              保存
            </Button>
            <Button v-if="isSaved" variant="text" class="btn--danger" @click="() => clearConfig()">
              清除
            </Button>
          </div>

          <!-- 隐私说明 -->
          <div class="privacy-note">
            <LucideIcon name="shield" :size="14" />
            <span
              >访问密钥与书签数据仅在您的设备和所选 AI 服务商之间传输，不经过 Yiveno 服务器。</span
            >
          </div>

          <!-- 获取 Key 的链接 -->
          <div class="get-key-links">
            <span class="get-key-label">还没有访问密钥？</span>
            <a
              :href="providerLinks[selectedProvider]"
              target="_blank"
              rel="noopener"
              class="get-key-link"
            >
              前往 {{ providerNames[selectedProvider] }} 获取
              <LucideIcon name="external-link" :size="12" />
            </a>
          </div>

          <!-- Gemini 特别提示 -->
          <div v-if="selectedProvider === 'gemini'" class="gemini-tip">
            <LucideIcon name="info" :size="13" />
            <span
              >请使用
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
                >Google AI Studio</a
              >
              申请的 Key（AIza 开头），不要使用 Google Cloud Console 的 Key</span
            >
          </div>

          <div v-if="selectedProvider === 'deepseek'" class="gemini-tip">
            <LucideIcon name="info" :size="13" />
            <span
              >推荐直接使用
              <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener"
                >DeepSeek 官方 API Key</a
              >。DeepSeek 当前适合文本生成与推理测试，不支持语义搜索所需的 embedding。</span
            >
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
@media (width <= 560px) {
  .ai-engine-sources {
    grid-template-columns: 1fr;
  }
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  user-select: text;
}

/* AI 引擎区域 */
.ai-engine-section {
  margin-top: 0;
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.ai-engine-section__intro {
  margin-bottom: var(--spacing-4);
}

.ai-engine-section__title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-2);
}

.ai-engine-section__title-icon {
  color: var(--md-sys-color-primary);
}

.ai-engine-section__title {
  margin: 0;
  font-size: var(--md-sys-typescale-title-large-size);
  font-weight: var(--md-sys-typescale-title-large-weight);
  line-height: var(--md-sys-typescale-title-large-line-height);
  letter-spacing: var(--md-sys-typescale-title-large-tracking);
  color: var(--md-sys-color-on-surface);
}

.ai-engine-section__desc {
  margin: 0;
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.ai-engine-active {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}

.ai-engine-active--cloud {
  border-color: color-mix(in srgb, var(--color-semantic-success) 24%, transparent);
  color: var(--color-semantic-success);
  background: color-mix(in srgb, var(--color-semantic-success) 8%, transparent);
}

.ai-engine-active--hosted {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent);
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.ai-engine-active--basic {
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent);
}

.ai-engine-active__text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
  min-width: 0;
}

.ai-engine-active__label {
  font-size: var(--md-sys-typescale-label-small-size);
  font-weight: var(--font-medium);
  opacity: 0.85;
}

.ai-engine-active__value {
  font-size: var(--md-sys-typescale-body-medium-size);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.ai-engine-sources {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: var(--spacing-3);
}

.source-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  text-align: left;
  color: inherit;
  background: var(--color-surface);
  cursor: pointer;
  transition:
    background var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    border-color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.source-card:hover {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  background: var(--color-surface-hover);
}

.source-card:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

.source-card--ready {
  border-color: color-mix(in srgb, var(--color-semantic-success) 35%, transparent);
}

.source-card__header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
}

.source-card__icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
}

.source-card__icon--cloud {
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}

.source-card__icon--hosted {
  color: var(--md-sys-color-tertiary);
  background: color-mix(in srgb, var(--md-sys-color-tertiary) 12%, transparent);
}

.hosted-quota-panel {
  display: grid;
  gap: var(--spacing-2);
  margin-top: var(--spacing-4);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.hosted-quota-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-3);
  font-size: var(--md-sys-typescale-body-medium-size);
  color: var(--color-text-secondary);
}

.source-card__meta {
  min-width: 0;
}

.source-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-1);
}

.source-card__title {
  font-size: var(--md-sys-typescale-body-large-size);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.source-card__badge {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--md-sys-typescale-label-small-size);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-primary);
  background: var(--md-sys-color-primary);
}

.source-card__desc {
  margin: 0;
  font-size: var(--md-sys-typescale-body-small-size);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.source-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--color-border-subtle);
}

.source-card__status {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  min-width: 0;
  font-size: var(--md-sys-typescale-body-small-size);
  color: var(--color-text-secondary);
}

.source-card__status--ready {
  color: var(--color-semantic-success);
}

.source-card__action {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-0-5);
  font-size: var(--md-sys-typescale-body-small-size);
  font-weight: var(--font-medium);
  color: var(--md-sys-color-primary);
}

.ai-engine-priority {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  font-size: var(--md-sys-typescale-body-small-size);
  line-height: 1.6;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent);
}

.dialog-intro {
  margin: 0 0 var(--spacing-4);
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.pro-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--md-sys-typescale-label-small-size);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-primary);
  background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary));
}

.tooltip-link {
  font-weight: var(--font-medium);
  text-decoration: none;
  color: var(--md-sys-color-primary);
}

.tooltip-link:hover {
  text-decoration: underline;
}

/* 表单布局 */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-3);
}

.form-row {
  display: grid;
  align-items: start;
  gap: var(--spacing-3);
  grid-template-columns: 120px 1fr;
}

.form-label {
  padding-top: var(--spacing-3); /* 与输入框内文字对齐 */
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.form-label--with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
}

.label-info-icon {
  color: var(--color-text-secondary);
}

.form-field {
  display: flex;
  align-items: center;
  width: 400px;
}

/* Material Web Components 样式优化 */
md-outlined-select.select-field,
md-outlined-text-field.text-field {
  /* 减小输入框高度 */
  --md-outlined-field-container-shape: var(--radius-md);
  --md-outlined-field-top-space: var(--spacing-3);
  --md-outlined-field-bottom-space: var(--spacing-3);

  width: 100%;
}

/* 输入框内的图标按钮 */
.icon-toggle-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-2);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.icon-toggle-btn:hover {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}

.icon-toggle-btn:active {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
}

/* Material Web Components Button 样式 */
button.btn--danger {
  --md-filled-button-label-text-color: var(--color-semantic-error);
  --Button-hover-label-text-color: var(--color-semantic-error);
  --Button-pressed-label-text-color: var(--color-semantic-error);
}

.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  font-size: var(--md-sys-typescale-body-small-size); /* 12px */
  line-height: 1.75;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.get-key-links {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--md-sys-typescale-body-small-size); /* 12px */
  color: var(--color-text-secondary);
}

.get-key-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  text-decoration: none;
  color: var(--md-sys-color-primary);
}

.get-key-link:hover {
  text-decoration: underline;
}

.tooltip-content {
  font-size: var(--md-sys-typescale-body-small-size); /* 12px */
  line-height: 1.75;

  /* ✅ 允许复制 Tooltip 中的示例文本 */
  user-select: text;
}

.gemini-tip {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
  font-size: var(--md-sys-typescale-body-small-size); /* 12px */
  line-height: 1.75;
  color: var(--color-text-secondary);
}

.gemini-tip a {
  text-decoration: none;
  color: var(--md-sys-color-primary);
}

.gemini-tip a:hover {
  text-decoration: underline;
}

/* AI 功能开关区域 */
.ai-features-section {
  margin-top: 0;
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.ai-features-section__header {
  margin-bottom: var(--spacing-1);
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--color-border-subtle);
}

.ai-features-section__title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.ai-features-section__title {
  margin: 0;
  font-size: var(--md-sys-typescale-title-large-size);
  font-weight: var(--md-sys-typescale-title-large-weight);
  line-height: var(--md-sys-typescale-title-large-line-height);
  letter-spacing: var(--md-sys-typescale-title-large-tracking);
  color: var(--md-sys-color-on-surface);
}

.feature-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) 0;
}

.feature-row:not(:last-child) {
  border-bottom: 1px solid var(--color-border-subtle);
}

.feature-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--md-sys-typescale-body-medium-size);
  font-weight: var(--md-sys-typescale-body-medium-weight);
  line-height: var(--md-sys-typescale-body-medium-line-height);
  letter-spacing: var(--md-sys-typescale-body-medium-tracking);
  color: var(--md-sys-color-on-surface-variant);
}

/* Tab 切换区域 */
.provider-tabs {
  margin-bottom: var(--spacing-4);
}

.tab-status-icon {
  margin-left: var(--spacing-1);
  vertical-align: middle;
}

.tab-status-icon--success {
  color: var(--color-semantic-success);
}

.tab-status-icon--warning {
  color: var(--color-semantic-warning);
}

/* Tab 内容区域 */
.tab-content {
  margin-bottom: var(--spacing-2);
}

.tab-panel {
  /* 切换动效由 Tabs 组件 state layer 承担，tab 内容静态呈现 */
}

/* Chrome AI Tab 样式 */
.status-card {
  margin-bottom: var(--spacing-4);
}

.status-card-content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.status-card-content button {
  flex-shrink: 0;
  margin-left: auto;
}

.status-card-content button lucide-icon {
  margin-right: var(--spacing-1);
}

.status-content h4 {
  margin: 0 0 var(--spacing-1) 0;
  font-size: var(--md-sys-typescale-title-medium-size);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.status-content p {
  margin: 0;
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.alternative-tip {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  font-size: var(--md-sys-typescale-body-small-size);
  line-height: 1.75;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.alternative-tip strong {
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-primary);
}

/* ✅ 允许用户复制文本（覆盖全局 user-select: none） */
</style>
