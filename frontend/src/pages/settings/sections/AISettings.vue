<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <LucideIcon name="sparkles" />
      <span>AI 服务配置</span>
    </h3>

    <!-- 当前状态 -->
    <div class="status-bar" :class="statusClass">
      <LucideIcon :name="statusIcon" :size="16" />
      <span>{{ statusText }}</span>
    </div>

    <!-- Provider 选择 -->
    <div class="grid">
      <div class="row">
        <div class="label">AI 服务商</div>
        <div class="field">
          <select
            v-model="selectedProvider"
            class="provider-select"
          >
            <option value="openai">OpenAI（推荐）</option>
            <option value="claude">Anthropic Claude</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>
      </div>

      <!-- API Key 输入 -->
      <div class="row">
        <div class="label">API Key</div>
        <div class="field field--grow">
          <div class="key-input-wrap">
            <Input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              density="compact"
              :placeholder="keyPlaceholder"
              class="key-input"
              @keydown.enter.prevent="saveConfig"
            />
            <button class="toggle-btn" type="button" @click="showKey = !showKey">
              <LucideIcon :name="showKey ? 'eye-off' : 'eye'" :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- 自定义模型（可选） -->
      <div class="row">
        <div class="label label--with-tooltip">
          自定义模型
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                留空使用默认模型：<br />
                OpenAI: gpt-4o-mini<br />
                Claude: claude-3-haiku-20240307<br />
                Gemini: gemini-2.0-flash
              </div>
            </template>
          </Tooltip>
        </div>
        <Input
          v-model="customModel"
          density="compact"
          placeholder="留空使用默认模型"
          style="width: 240px"
        />
      </div>

      <!-- 自定义端点（可选，用于代理） -->
      <div class="row">
        <div class="label label--with-tooltip">
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
        </div>
        <Input
          v-model="customBaseUrl"
          density="compact"
          placeholder="https://your-proxy.com/v1"
          style="width: 240px"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <Button
        variant="primary"
        size="sm"
        :loading="saving"
        :disabled="!apiKey.trim()"
        @click="saveConfig"
      >
        <LucideIcon name="save" :size="14" />
        保存配置
      </Button>
      <Button
        v-if="isSaved"
        variant="ghost"
        size="sm"
        :loading="testing"
        @click="testConnection"
      >
        <LucideIcon name="zap" :size="14" />
        测试连接
      </Button>
      <Button
        v-if="isSaved"
        variant="ghost"
        size="sm"
        class="btn--danger"
        @click="clearConfig"
      >
        <LucideIcon name="trash" :size="14" />
        清除
      </Button>
    </div>

    <!-- 隐私说明 -->
    <div class="privacy-note">
      <LucideIcon name="shield" :size="14" />
      <span>您的 API Key 和书签数据只在您的设备和您选择的 AI 服务商之间流动，不经过 AcuityBookmarks 服务器。</span>
    </div>

    <!-- 获取 Key 的链接 -->
    <div class="get-key-links">
      <span class="get-key-label">没有 API Key？</span>
      <a :href="providerLinks[selectedProvider]" target="_blank" rel="noopener" class="get-key-link">
        前往 {{ providerNames[selectedProvider] }} 获取
        <LucideIcon name="external-link" :size="12" />
      </a>
    </div>
    <!-- Gemini 特别提示 -->
    <div v-if="selectedProvider === 'gemini'" class="gemini-tip">
      <LucideIcon name="info" :size="13" />
      <span>请使用 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a> 申请的 Key（AIza 开头），不要使用 Google Cloud Console 的 Key</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button, Input, LucideIcon, Tooltip } from '@/components'
import { userLLMClient } from '@/infrastructure/llm/user-llm-client'
import type { UserLLMProvider } from '@/infrastructure/llm/user-llm-client'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { notifyError, notifySuccess, notifyWarning } from '@/application'

defineOptions({ name: 'AISettings' })

const selectedProvider = ref<UserLLMProvider>('openai')
const apiKey = ref('')
const customModel = ref('')
const customBaseUrl = ref('')
const showKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const isSaved = ref(false)

const providerNames: Record<UserLLMProvider, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic',
  gemini: 'Google'
}

const providerLinks: Record<UserLLMProvider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  claude: 'https://console.anthropic.com/settings/keys',
  gemini: 'https://aistudio.google.com/app/apikey'
}
const keyPlaceholder = computed(() => {
  const map: Record<UserLLMProvider, string> = {
    openai: 'sk-...',
    claude: 'sk-ant-...',
    gemini: 'AIza...'
  }
  return map[selectedProvider.value]
})

const statusClass = computed(() => ({
  'status-bar--ok': isSaved.value,
  'status-bar--empty': !isSaved.value
}))

const statusIcon = computed(() => (isSaved.value ? 'check-circle' : 'alert-circle'))

const statusText = computed(() =>
  isSaved.value
    ? `已配置 ${providerNames[selectedProvider.value]} API Key`
    : '未配置 AI 服务，AI 功能不可用'
)

/** 保存配置 */
async function saveConfig() {
  if (!apiKey.value.trim()) return
  saving.value = true
  try {
    await userLLMClient.saveConfig({
      provider: selectedProvider.value,
      apiKey: apiKey.value.trim(),
      model: customModel.value.trim() || undefined,
      baseUrl: customBaseUrl.value.trim() || undefined
    })
    llmAdapter.clearCapabilitiesCache()
    isSaved.value = true
    notifySuccess('AI 配置已保存', 'AI 设置')
  } catch (_e) {
    notifyError('保存失败，请重试', 'AI 设置')
  } finally {
    saving.value = false
  }
}

/** 各服务商控制台链接 */
const consoleLinks: Record<UserLLMProvider, { url: string; text: string }> = {
  openai: { url: 'https://platform.openai.com/account/billing', text: '前往 OpenAI 控制台充值' },
  claude: { url: 'https://console.anthropic.com/settings/billing', text: '前往 Anthropic 控制台充值' },
  gemini: { url: 'https://aistudio.google.com/app/apikey', text: '前往 Google AI Studio 查看额度' }
}

/** 测试连接 */
async function testConnection() {
  testing.value = true
  try {
    await userLLMClient.complete('请回复"ok"', { maxTokens: 5 })
    notifySuccess(`连接成功，${providerNames[selectedProvider.value]} 可正常使用`, 'AI 设置')
  } catch (e) {
    const msg = String(e).replace(/^Error:\s*/, '')
    const isQuotaError = msg.includes('额度') || msg.includes('充值') || msg.includes('频率')
    const isKeyError = msg.includes('无效') || msg.includes('过期') || msg.includes('权限')
    const link = consoleLinks[selectedProvider.value]

    if ((isQuotaError || isKeyError) && link.url) {
      notifyWarning(`${msg}（${link.text}：${link.url}）`, 'AI 设置')
    } else {
      notifyError(link.url ? msg : link.text, 'AI 设置')
    }
  } finally {
    testing.value = false
  }
}

/** 清除配置 */
async function clearConfig() {
  await userLLMClient.clearConfig()
  llmAdapter.clearCapabilitiesCache()
  apiKey.value = ''
  customModel.value = ''
  customBaseUrl.value = ''
  isSaved.value = false
  notifySuccess('AI 配置已清除', 'AI 设置')
}

onMounted(async () => {
  const config = await userLLMClient.getConfig()
  if (config) {
    selectedProvider.value = config.provider
    apiKey.value = config.apiKey
    customModel.value = config.model || ''
    customBaseUrl.value = config.baseUrl || ''
    isSaved.value = true
  }
})
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.status-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.status-bar--ok {
  color: var(--color-semantic-success);
  background: color-mix(in srgb, var(--color-semantic-success) 12%, transparent);
}

.status-bar--empty {
  color: var(--color-semantic-warning);
  background: color-mix(in srgb, var(--color-semantic-warning) 12%, transparent);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.label {
  flex-shrink: 0;
  width: 120px;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.label--with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  cursor: default;
}

.label-info-icon {
  color: var(--color-text-secondary);
}

.field {
  display: flex;
  align-items: center;
}

.field--grow {
  flex: 1;
}

.provider-select {
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: var(--color-surface);
  cursor: pointer;
}

.provider-select:focus {
  border-color: var(--md-sys-color-primary);
}

.key-input-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 360px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.key-input-wrap :deep(.acuity-input) {
  flex: 1;
  border: none;
  border-radius: 0;
}

.toggle-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 var(--spacing-2);
  border: none;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.toggle-btn:hover {
  color: var(--color-text-primary);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
}

.btn--danger {
  color: var(--color-semantic-error);
}

.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.get-key-links {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-xs);
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
  font-size: var(--text-xs);
  line-height: var(--line-height-relaxed);
}

.gemini-tip {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
  font-size: var(--text-xs);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-secondary);
}

.gemini-tip a {
  text-decoration: none;
  color: var(--md-sys-color-primary);
}

.gemini-tip a:hover {
  text-decoration: underline;
}
</style>
