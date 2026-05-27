<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { LucideIcon, Tooltip, Card, Input, Dialog } from '@/components'
import { userLLMClient } from '@/infrastructure/llm/user-llm-client'
import type { UserLLMProvider } from '@/infrastructure/llm/user-llm-client'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { builtInLLMClient } from '@/infrastructure/llm/builtin-llm-client'
import { message } from '@/application/message/message-service'
import { useSubscription } from '@/composables/useSubscription'
import { logger } from '@/infrastructure/logging/logger'

// 导入 Material Web Components
import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'
import '@material/web/button/filled-button.js'
import '@material/web/tabs/tabs.js'
import '@material/web/tabs/primary-tab.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/switch/switch.js'

defineOptions({ name: 'AISettings' })

const { isPro } = useSubscription()

// Tab 状态
const activeTab = ref<'apikey' | 'chrome'>('apikey')

// Chrome AI 可用性
const chromeAIAvailable = ref(false)
const recheckingChromeAI = ref(false)

const aiEnabled = ref(false)
const aiAutoEnabled = ref(false)
const semanticSearchEnabled = ref(false)

const selectedProvider = ref<UserLLMProvider>('openai')
const apiKey = ref('')
const selectedModel = ref('')
const customBaseUrl = ref('')
const showKey = ref(false)
const showLLMConfigDialog = ref(false)
const saving = ref(false)
const testing = ref(false)
const isSaved = ref(false)

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
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (推荐) - 最强性能' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku - 快速响应' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus - 复杂任务' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku - 最经济' },
    { value: 'custom', label: '其他模型...' }
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (推荐) - 最新实验版' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro - 强大性能' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash - 快速响应' },
    { value: 'custom', label: '其他模型...' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat（推荐）- 通用对话与日常任务' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner - 更强推理能力' },
    { value: 'custom', label: '其他模型...' }
  ]
}

// 自定义模型名称
const customModelName = ref('')

// 当前服务商的可用模型
const availableModels = computed(() => modelsByProvider[selectedProvider.value])

// 是否显示自定义模型输入框
const showCustomModelInput = computed(() => selectedModel.value === 'custom')

// 监听服务商切换,自动选择推荐模型
watch(selectedProvider, newProvider => {
  const models = modelsByProvider[newProvider]
  const firstModel = models?.[0]
  if (firstModel) {
    selectedModel.value = firstModel.value // 默认选择第一个(推荐)
    customModelName.value = '' // 清空自定义模型名称
  }
})

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

const llmConfigSummary = computed(() => {
  if (hasApiKeyConfigured.value) {
    const provider = providerNames[selectedProvider.value]
    const model = selectedModel.value === 'custom' ? customModelName.value : selectedModel.value
    return model ? `已配置 ${provider} · ${model}` : `已配置 ${provider}`
  }

  if (chromeAIAvailable.value) {
    return '未配置 API Key，当前可使用 Chrome AI'
  }

  return '未配置第三方 LLM，当前以本地 AI 能力为主'
})

// 是否已配置 API Key
const hasApiKeyConfigured = computed(() => !!apiKey.value.trim())

// 是否可以启用 AI（与 LLM 配置解耦，仅保留 Pro 门禁）
const canEnableAI = computed(() => isPro.value)

// AI Toggle 的禁用状态
const aiToggleDisabled = computed(() => !canEnableAI.value)

// AI Toggle 的 Tooltip 提示
const aiToggleTooltip = computed(() => {
  if (!isPro.value) {
    return 'AI 功能仅限 Pro 用户使用。升级到 Pro'
  }
  return 'AI 功能已就绪，API Key 与 Chrome AI 均为可选'
})

/** 处理 Tab 切换 */
function handleTabChange() {
  // Tab 切换逻辑
}

function getSwitchSelected(event: Event): boolean {
  const target = event.target as HTMLElement & { selected?: boolean }
  return target.selected === true
}

/** 处理 AI 开关切换 */
async function handleAIToggle(event: Event) {
  aiEnabled.value = getSwitchSelected(event)

  try {
    await chrome.storage.local.set({ aiEnabled: aiEnabled.value })
    logger.info('AISettings', 'AI 总开关已更新', { enabled: aiEnabled.value })
  } catch (error) {
    logger.error('AISettings', '保存 AI 总开关失败', error)
  }
}

/** 处理 AI 自动归纳开关切换 */
async function handleAIAutoToggle(event: Event) {
  aiAutoEnabled.value = getSwitchSelected(event)
  try {
    await chrome.storage.local.set({ aiAutoBookmark: aiAutoEnabled.value })
    logger.info('AISettings', 'AI 自动归纳设置已更新', { enabled: aiAutoEnabled.value })
  } catch (error) {
    logger.error('AISettings', '保存 AI 自动归纳设置失败', error)
  }
}

/** 处理语义搜索开关切换 */
async function handleSemanticSearchToggle(event: Event) {
  semanticSearchEnabled.value = getSwitchSelected(event)
  try {
    await chrome.storage.local.set({ semanticSearchEnabled: semanticSearchEnabled.value })
    logger.info('AISettings', '语义搜索设置已更新', { enabled: semanticSearchEnabled.value })
  } catch (error) {
    logger.error('AISettings', '保存语义搜索设置失败', error)
  }
}

/** 保存配置 */
async function saveConfig() {
  if (!apiKey.value.trim()) {
    await clearConfig(true)
    message.success('未配置 API Key，已使用本地 AI 方案')
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

    await userLLMClient.saveConfig({
      provider: selectedProvider.value,
      apiKey: apiKey.value.trim(),
      ...(modelValue && { model: modelValue }),
      ...(customBaseUrl.value.trim() && { baseUrl: customBaseUrl.value.trim() })
    })
    llmAdapter.clearCapabilitiesCache()
    isSaved.value = true
    message.success('AI 配置已保存')
  } catch (_e) {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/** 各服务商控制台链接 */
const consoleLinks: Record<UserLLMProvider, { url: string; text: string }> = {
  openai: { url: 'https://platform.openai.com/account/billing', text: '前往 OpenAI 控制台充值' },
  claude: {
    url: 'https://console.anthropic.com/settings/billing',
    text: '前往 Anthropic 控制台充值'
  },
  gemini: { url: 'https://aistudio.google.com/app/apikey', text: '前往 Google AI Studio 查看额度' },
  deepseek: { url: 'https://platform.deepseek.com/usage', text: '前往 DeepSeek 平台查看额度与充值' }
}

/** 测试连接 */
async function testConnection() {
  testing.value = true
  try {
    await userLLMClient.complete('请回复"ok"', { maxTokens: 5 })
    message.success(`连接成功，${providerNames[selectedProvider.value]} 可正常使用`)
  } catch (e) {
    const msg = String(e).replace(/^Error:\s*/, '')
    const isQuotaError = msg.includes('额度') || msg.includes('充值') || msg.includes('频率')
    const isKeyError = msg.includes('无效') || msg.includes('过期') || msg.includes('权限')
    const link = consoleLinks[selectedProvider.value]

    // ⚠️ 错误信息较复杂，使用 Notification（保留标题）
    if ((isQuotaError || isKeyError) && link.url) {
      message.warning(`${msg}（${link.text}：${link.url}）`)
    } else {
      message.error(link.url ? msg : link.text)
    }
  } finally {
    testing.value = false
  }
}

/** 清除配置 */
async function clearConfig(silent = false) {
  await userLLMClient.clearConfig()
  llmAdapter.clearCapabilitiesCache()
  apiKey.value = ''
  const defaultModels = modelsByProvider[selectedProvider.value]
  const firstDefaultModel = defaultModels?.[0]
  if (firstDefaultModel) {
    selectedModel.value = firstDefaultModel.value
  }
  customModelName.value = ''
  customBaseUrl.value = ''
  isSaved.value = false
  if (!silent) {
    message.success('AI 配置已清除')
  }
}

/** 重新检测 Chrome AI 可用性 */
async function recheckChromeAI() {
  recheckingChromeAI.value = true
  try {
    const previousStatus = chromeAIAvailable.value
    chromeAIAvailable.value = await builtInLLMClient.isAvailable() // eslint-disable-line require-atomic-updates

    logger.info('AISettings', 'Chrome AI 重新检测完成', {
      available: chromeAIAvailable.value,
      changed: previousStatus !== chromeAIAvailable.value
    })

    // 状态变化时给用户反馈
    if (previousStatus !== chromeAIAvailable.value) {
      if (chromeAIAvailable.value) {
        message.success('Chrome AI 已成功启用！')
      } else {
        message.warning('Chrome AI 仍未启用，请检查配置步骤')
      }
    } else {
      if (chromeAIAvailable.value) {
        message.success('Chrome AI 状态正常')
      } else {
        message.warning('Chrome AI 仍未启用')
      }
    }
  } catch (error) {
    logger.error('AISettings', 'Chrome AI 重新检测失败', error)
    message.error('检测失败，请重试')
  } finally {
    recheckingChromeAI.value = false
  }
}

onMounted(async () => {
  // 加载 AI 配置
  const config = await userLLMClient.getConfig()
  if (config) {
    selectedProvider.value = config.provider
    apiKey.value = config.apiKey
    customBaseUrl.value = config.baseUrl || ''
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
      const defaultModels = modelsByProvider[config.provider]
      selectedModel.value = defaultModels?.[0]?.value ?? 'custom'
    }
  } else {
    const defaultModels = modelsByProvider[selectedProvider.value]
    selectedModel.value = defaultModels?.[0]?.value || 'custom'
  }

  // 加载 AI 总开关状态（与 LLM 配置解耦）
  try {
    const result = await chrome.storage.local.get('aiEnabled')
    aiEnabled.value = result.aiEnabled === true
    logger.info('AISettings', 'AI 总开关已加载', {
      enabled: aiEnabled.value
    })
  } catch (error) {
    logger.error('AISettings', '加载 AI 总开关失败', error)
  }

  // 加载 AI 功能开关状态
  try {
    const result = await chrome.storage.local.get(['aiAutoBookmark', 'semanticSearchEnabled'])
    aiAutoEnabled.value = result.aiAutoBookmark === true
    semanticSearchEnabled.value = result.semanticSearchEnabled === true

    // 迁移逻辑：如果 AI 自动添加开关为 true 但 AI 功能未启用，自动关闭自动添加
    if (result.aiAutoBookmark === true && aiEnabled.value === false) {
      aiAutoEnabled.value = false
      await chrome.storage.local.set({ aiAutoBookmark: false })
      logger.info('AISettings', '检测到 AI 自动添加开启但 AI 功能未启用，已自动关闭')
    }

    logger.info('AISettings', '设置已加载', {
      aiAuto: aiAutoEnabled.value,
      semanticSearch: semanticSearchEnabled.value
    })
  } catch (error) {
    logger.error('AISettings', '加载设置失败', error)
  }

  // 检测 Chrome AI 是否可用
  try {
    chromeAIAvailable.value = await builtInLLMClient.isAvailable()
    logger.info('AISettings', 'Chrome AI 可用性检测', { available: chromeAIAvailable.value })
  } catch (error) {
    logger.error('AISettings', 'Chrome AI 检测失败', error)
    chromeAIAvailable.value = false
  }
})
</script>

<template>
  <div class="settings-section">
    <!-- 启用 AI 开关 -->
    <div class="ai-toggle-section">
      <div class="toggle-row">
        <div class="toggle-label-group">
          <label class="toggle-label">启用 AI 功能</label>
          <span class="pro-badge">PRO</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                AI 功能仅限 Pro 用户使用。<br />
                <a href="#" class="tooltip-link">升级到 Pro</a>
              </div>
            </template>
          </Tooltip>
        </div>
        <Tooltip v-if="aiToggleDisabled" offset="md">
          <md-switch
            :selected="aiEnabled"
            :disabled="aiToggleDisabled"
            @change="handleAIToggle"
          ></md-switch>
          <template #content>
            <div class="tooltip-content">
              {{ aiToggleTooltip }}
            </div>
          </template>
        </Tooltip>
        <md-switch v-else :selected="aiEnabled" @change="handleAIToggle"></md-switch>
      </div>
    </div>

    <div class="llm-config-card">
      <div class="llm-config-card__header">
        <div>
          <div class="llm-config-card__title">LLM 配置</div>
          <div class="llm-config-card__summary">{{ llmConfigSummary }}</div>
        </div>
        <md-text-button @click="showLLMConfigDialog = true">
          {{ hasApiKeyConfigured ? '管理配置' : '配置 LLM' }}
        </md-text-button>
      </div>
    </div>

    <Dialog
      :show="showLLMConfigDialog"
      title="LLM 配置"
      width="960px"
      body-min-height="520px"
      @update:show="showLLMConfigDialog = $event"
    >
      <!-- Tab 切换: API Key vs Chrome AI -->
      <div class="provider-tabs">
        <md-tabs @change="handleTabChange">
          <md-primary-tab :active="activeTab === 'apikey'" @click="activeTab = 'apikey'">
            API Key
            <LucideIcon
              v-if="hasApiKeyConfigured"
              name="check-circle"
              :size="16"
              class="tab-status-icon tab-status-icon--success"
            />
          </md-primary-tab>
          <md-primary-tab :active="activeTab === 'chrome'" @click="activeTab = 'chrome'">
            Chrome AI
            <LucideIcon
              v-if="chromeAIAvailable"
              name="check-circle"
              :size="16"
              class="tab-status-icon tab-status-icon--success"
            />
            <LucideIcon
              v-else
              name="alert-circle"
              :size="16"
              class="tab-status-icon tab-status-icon--warning"
            />
          </md-primary-tab>
        </md-tabs>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'apikey'" class="tab-panel">
          <!-- Provider 选择 -->
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">AI 服务商</label>
              <div class="form-field">
                <md-outlined-select v-model="selectedProvider" class="select-field">
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

            <!-- API Key 输入 -->
            <div class="form-row">
              <label class="form-label">API Key</label>
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

            <!-- 模型选择 -->
            <div class="form-row">
              <label class="form-label">模型选择</label>
              <div class="form-field">
                <md-outlined-select
                  :value="selectedModel"
                  class="select-field"
                  @change="selectedModel = ($event.target as HTMLSelectElement).value"
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

            <!-- 自定义端点（可选，用于代理） -->
            <div class="form-row">
              <label class="form-label form-label--with-tooltip">
                自定义端点
                <Tooltip offset="md">
                  <LucideIcon name="info" class="label-info-icon" />
                  <template #content>
                    <div class="tooltip-content">
                      可选。用于 API 代理或私有部署。<br />
                      留空使用官方端点。
                    </div>
                  </template>
                </Tooltip>
              </label>
              <div class="form-field">
                <Input
                  v-model="customBaseUrl"
                  placeholder="https://your-proxy.com/v1"
                  class="text-field"
                  variant="outlined"
                />
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="actions">
            <md-filled-button :disabled="saving" @click="saveConfig"> 保存配置 </md-filled-button>
            <md-text-button v-if="isSaved" :disabled="testing" @click="testConnection">
              测试连接
            </md-text-button>
            <md-text-button v-if="isSaved" class="btn--danger" @click="clearConfig">
              清除
            </md-text-button>
          </div>

          <!-- 隐私说明 -->
          <div class="privacy-note">
            <LucideIcon name="shield" :size="14" />
            <span
              >您的 API Key 和书签数据只在您的设备和您选择的 AI 服务商之间流动，不经过
              AcuityBookmarks 服务器。</span
            >
          </div>

          <!-- 获取 Key 的链接 -->
          <div class="get-key-links">
            <span class="get-key-label">没有 API Key？</span>
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

        <!-- Chrome AI Tab -->
        <div v-else-if="activeTab === 'chrome'" class="tab-panel">
          <div v-if="chromeAIAvailable" class="chrome-ai-available">
            <Card variant="success" :padding="false" class="status-card">
              <div class="status-card-content">
                <LucideIcon name="check-circle" :size="20" />
                <div class="status-content">
                  <h4>Chrome AI 已启用</h4>
                  <p>您的浏览器已启用 Gemini Nano 模型，可以免费使用本地 AI 功能。</p>
                </div>
                <md-text-button :disabled="recheckingChromeAI" @click="recheckChromeAI">
                  <LucideIcon name="refresh-cw" :size="16" />
                  重新检测
                </md-text-button>
              </div>
            </Card>

            <div class="chrome-ai-features">
              <h4>特性</h4>
              <ul>
                <li><LucideIcon name="check" :size="16" /> 完全免费，无需 API Key</li>
                <li><LucideIcon name="check" :size="16" /> 本地处理，隐私最优</li>
                <li><LucideIcon name="check" :size="16" /> 无网络延迟，离线可用</li>
              </ul>
            </div>

            <div class="chrome-ai-limitations">
              <h4>限制</h4>
              <ul>
                <li><LucideIcon name="alert-circle" :size="16" /> Token 限制较低 (2048)</li>
                <li><LucideIcon name="alert-circle" :size="16" /> 准确率略低于第三方 API</li>
                <li><LucideIcon name="alert-circle" :size="16" /> 功能相对基础</li>
              </ul>
            </div>
          </div>

          <div v-else class="chrome-ai-unavailable">
            <Card variant="warning" :padding="false" class="status-card">
              <div class="status-card-content">
                <LucideIcon name="alert-circle" :size="20" />
                <div class="status-content">
                  <h4>Chrome AI 未启用</h4>
                  <p>您的浏览器尚未启用 Gemini Nano 模型。</p>
                </div>
                <md-text-button :disabled="recheckingChromeAI" @click="recheckChromeAI">
                  <LucideIcon name="refresh-cw" :size="16" />
                  重新检测
                </md-text-button>
              </div>
            </Card>

            <div class="enable-guide">
              <h4>启用步骤</h4>
              <ol>
                <li>确保 Chrome 版本 >= 127</li>
                <li>
                  访问
                  <a href="chrome://flags" target="_blank" class="chrome-link">chrome://flags</a>
                </li>
                <li>
                  搜索并启用以下功能:
                  <ul>
                    <li><code>Prompt API for Gemini Nano</code></li>
                    <li><code>Enables optimization guide on device</code></li>
                  </ul>
                </li>
                <li>重启浏览器</li>
                <li>等待模型下载 (约 22GB)</li>
              </ol>
            </div>

            <div class="alternative-tip">
              <LucideIcon name="info" :size="16" />
              <span>推荐使用 <strong>API Key</strong> 方式，更简单且功能更强大。</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- AI 功能开关（始终显示，但需要 AI 启用后才能操作） -->
    <div class="ai-features-section">
      <!-- AI 自动归纳书签 -->
      <div class="feature-row">
        <label class="feature-label">
          <span>自动添加书签</span>
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
        <md-switch
          icons
          :selected="aiAutoEnabled"
          :disabled="!aiEnabled"
          @change="handleAIAutoToggle"
        ></md-switch>
      </div>

      <!-- 语义搜索 -->
      <div class="feature-row">
        <label class="feature-label">
          <span>语义搜索</span>
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                使用 AI 理解搜索意图，提供更智能的搜索结果。<br />
                后台自动生成语义向量，完全本地化，无需联网。
              </div>
            </template>
          </Tooltip>
        </label>
        <md-switch
          icons
          :selected="semanticSearchEnabled"
          :disabled="!aiEnabled"
          @change="handleSemanticSearchToggle"
        ></md-switch>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  user-select: text;
}

/* AI 开关区域 */
.ai-toggle-section {
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.llm-config-card {
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.llm-config-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-3);
}

.llm-config-card__title {
  margin-bottom: var(--spacing-1);
  font-size: var(--md-sys-typescale-body-large-size);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.llm-config-card__summary {
  font-size: var(--md-sys-typescale-body-medium-size);
  color: var(--color-text-secondary);
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-label-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.toggle-label {
  font-size: var(--md-sys-typescale-body-large-size);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
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

/* Material Web Switch 样式 */
md-switch {
  --md-switch-selected-track-color: var(--md-sys-color-primary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-primary);
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
md-text-button.btn--danger {
  --md-text-button-label-text-color: var(--color-semantic-error);
  --md-text-button-hover-label-text-color: var(--color-semantic-error);
  --md-text-button-pressed-label-text-color: var(--color-semantic-error);
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
  font-size: var(--md-sys-typescale-body-large-size);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

/* Tab 切换区域 */
.provider-tabs {
  margin-bottom: var(--spacing-4);
}

md-tabs {
  --md-primary-tab-container-color: transparent;
  --md-primary-tab-label-text-color: var(--color-text-secondary);
  --md-primary-tab-active-label-text-color: var(--md-sys-color-primary);
  --md-primary-tab-active-indicator-color: var(--md-sys-color-primary);
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
  animation: fade-in var(--md-sys-motion-duration-medium1) var(--md-sys-motion-easing-standard);
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

.status-card-content md-text-button {
  flex-shrink: 0;
  margin-left: auto;
}

.status-card-content md-text-button lucide-icon {
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

.chrome-ai-features,
.chrome-ai-limitations {
  margin-bottom: var(--spacing-4);
}

.chrome-ai-features h4,
.chrome-ai-limitations h4,
.enable-guide h4 {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--md-sys-typescale-title-small-size);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.chrome-ai-features ul,
.chrome-ai-limitations ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.chrome-ai-features li,
.chrome-ai-limitations li {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) 0;
  font-size: var(--md-sys-typescale-body-medium-size);
  color: var(--color-text-secondary);
}

.chrome-ai-features li {
  color: var(--color-semantic-success);
}

.chrome-ai-limitations li {
  color: var(--color-semantic-warning);
}

.enable-guide {
  margin-bottom: var(--spacing-4);
}

.enable-guide ol {
  margin: 0;
  padding-left: var(--spacing-5);
}

.enable-guide li {
  padding: var(--spacing-1) 0;
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.enable-guide ul {
  margin-top: var(--spacing-1);
  padding-left: var(--spacing-4);
}

.enable-guide code {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
  cursor: text;

  /* ✅ 确保 code 标签内的文本可以被复制 */
  user-select: text;
}

.enable-guide .chrome-link {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 0.9em;
  text-decoration: none;
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  user-select: text;
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.enable-guide .chrome-link:hover {
  text-decoration: underline;
  background: color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
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
