<script setup lang="ts">
import { chromeStoreUrls } from '~/config/external-links'

interface Props {
  /** 标题 */
  title?: string
  /** 描述文字 */
  description?: string
  /** 按钮文字 */
  buttonText?: string
  /** 图标 emoji */
  icon?: string
  /** 是否显示安装步骤 */
  showSteps?: boolean
  /** 安装后的提示文字 */
  afterInstallText?: string
  /** 样式变体 */
  variant?: 'default' | 'compact'
}

withDefaults(defineProps<Props>(), {
  title: '安装 AcuityBookmarks 扩展',
  description: '安装扩展后，您可以一键导入书签到您的 Chrome 浏览器',
  buttonText: '前往 Chrome 商店安装',
  icon: '🚀',
  showSteps: true,
  afterInstallText: '刷新本页面即可使用',
  variant: 'default'
})

const extensionLink = chromeStoreUrls.extension

const buttonAriaLabel = `在新标签页中打开 Chrome 网上应用店安装 AcuityBookmarks 扩展`
</script>

<template>
  <div class="extension-install-prompt" :class="variant">
    <div class="prompt-content">
      <div class="prompt-icon" aria-hidden="true">
        {{ icon }}
      </div>
      <div class="prompt-text">
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <a
        :href="extensionLink"
        target="_blank"
        rel="noopener noreferrer"
        class="install-button"
        :aria-label="buttonAriaLabel"
      >
        {{ buttonText }}
      </a>
    </div>

    <div v-if="showSteps" class="install-steps">
      <div class="step">
        <span class="step-number">1</span>
        <span class="step-text">点击上方按钮前往 Chrome 网上应用店</span>
      </div>
      <div class="step">
        <span class="step-number">2</span>
        <span class="step-text">点击"添加至 Chrome"按钮安装扩展</span>
      </div>
      <div class="step">
        <span class="step-number">3</span>
        <span class="step-text">安装完成后{{ afterInstallText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.extension-install-prompt {
  padding: 2rem 0;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent),
    color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent)
  );
  border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.extension-install-prompt.compact {
  padding: 1.5rem 0;
}

.prompt-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, white 5%, transparent);
}

.prompt-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.prompt-text {
  flex: 1;
}

.prompt-text h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.prompt-text p {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.install-button {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.install-button:hover {
  opacity: 0.9;
}

.install-steps {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, white 3%, transparent);
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
}

.step-text {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface);
  line-height: 1.5;
}

@media (width <= 768px) {
  .prompt-content {
    flex-direction: column;
    text-align: center;
  }

  .install-steps {
    text-align: left;
  }
}
</style>
