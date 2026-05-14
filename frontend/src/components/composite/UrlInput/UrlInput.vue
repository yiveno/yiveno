<template>
  <div
    class="url-input"
    :class="{ 'url-input--error': !!error || !!errorMessage }"
  >
    <label v-if="label" class="url-input__label">{{ label }}</label>
    <div class="url-input__controls" :class="[`density-${density}`]">
      <div class="url-input__protocol">
        <md-outlined-select
          v-model="protocol"
          class="protocol-select"
          aria-label="链接协议"
          :disabled="disabled"
          menu-positioning="fixed"
        >
          <md-select-option
            v-for="p in protocols"
            :key="p"
            :value="p"
            :headline="p"
          ></md-select-option>
        </md-outlined-select>
        <div class="protocol-divider" />
      </div>
      <div class="url-input__rest">
        <Input
          v-model="rest"
          variant="outlined"
          :density="density"
          type="text"
          class="url-rest-input"
          :disabled="disabled"
          @paste="handlePaste"
        />
      </div>
    </div>
    <!-- ✅ 始终渲染提示区域，预留空间避免布局跳动 -->
    <div
      class="url-input__hint"
      :class="{
        error: !!errorMessage,
        'has-content': !!(errorMessage || hint)
      }"
    >
      {{ errorMessage || hint || '\u00A0' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Input } from '@/components'
import type { UrlInputProps } from './UrlInput.d'

defineOptions({
  name: 'UrlInput'
})

const props = withDefaults(defineProps<UrlInputProps>(), {
  modelValue: '',
  label: '书签链接',
  variant: 'outlined',
  density: 'compact',
  error: false,
  errorMessage: '',
  hint: '',
  disabled: false,
  protocols: () => ['https', 'http'],
  inputClass: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// 解析初始URL，提取协议与剩余部分
const initialProtocol = computed(() => {
  const val = (props.modelValue || '').trim()
  const m = val.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//)
  if (m) return m[1]
  return 'https'
})

const protocol = ref(initialProtocol.value)
const initialRest = computed(() => {
  const val = (props.modelValue || '').trim()
  const m = val.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
  return m ? m[2] : val
})
const rest = ref(initialRest.value)

// 当任一部分变化时，组合为完整URL并抛出更新
const composeAndEmit = () => {
  const restTrimmed = (rest.value || '').trim()
  const url = restTrimmed ? `${protocol.value}://${restTrimmed}` : ''
  emit('update:modelValue', url)
}

watch(
  () => props.modelValue,
  val => {
    const str = (val || '').trim()
    const m = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
    if (m) {
      protocol.value = m[1]
      rest.value = m[2]
    } else {
      rest.value = str
    }
  }
)

watch(protocol, composeAndEmit)
watch(
  () => rest.value,
  val => {
    // 自动移除用户输入中的协议前缀，保持与下拉选择一致
    const str = (val || '').trim()
    const m = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
    if (m) {
      // 只移除协议，保持下拉选择不变
      rest.value = m[2]
    }
    composeAndEmit()
  }
)

const handlePaste = (e: ClipboardEvent) => {
  const txt = e.clipboardData?.getData('text') || ''
  const m = txt.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
  if (m) {
    // 阻止默认粘贴，改为粘贴去掉协议的部分
    e.preventDefault()
    rest.value = m[2]
  }
}
</script>

<style scoped>
.url-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.url-input__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.url-input__controls {
  display: grid;
  align-items: stretch;
  grid-template-columns: auto 1fr;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full); /* pill 风格，类似“清理”按钮 */
  background: var(--color-surface);
  transition: all var(--transition-base);
  overflow: hidden;
}

.url-input__controls:hover {
  border-color: var(--color-border-hover);
}

.url-input__controls:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-alpha-10);
}

.url-input--error .url-input__controls {
  border-color: var(--color-error);
}

/* 密度控制，使高度与 Input 一致 */
.url-input__controls.density-default {
  min-height: 40px;
}

.url-input__controls.density-comfortable {
  min-height: 40px;
}

.url-input__controls.density-compact {
  min-height: 36px;
}

.url-input__protocol {
  display: flex;
  align-items: center;
  background: var(--color-surface-variant);
}

.protocol-select {
  /* 嵌入药丸控件：去掉描边，由外层 .url-input__controls 提供轮廓 */
  --md-outlined-select-text-field-outline-color: transparent;
  --md-outlined-select-text-field-focus-outline-color: transparent;
  --md-outlined-select-text-field-hover-outline-color: transparent;
  --md-outlined-select-text-field-container-shape: 0;

  width: 100%;
  min-width: 5rem;
}

.protocol-divider {
  width: 1px;
  height: 70%;
  background: var(--color-divider);
}

.url-input__rest {
  display: flex;
  align-items: stretch;
}

.url-rest-input {
  width: 100%;
}

/*
 * 合并内部Input的外观为统一控件（移除自身边框与圆角）
 * 使用父选择器提高特异性，避免 !important
 */
:deep(.acuity-input-wrapper) {
  width: 100%;
}

:deep(.acuity-input-label) {
  display: none;
}

.url-rest-input :deep(.acuity-input-container),
.url-rest-input :deep(.acuity-input-container.acuity-input-container--outlined),
.url-rest-input :deep(.acuity-input-container.acuity-input-container--filled) {
  padding: 0 var(--spacing-md);
  border: none;
  border-radius: 0;
  background: transparent;
}

.url-rest-input :deep(.acuity-input-container--focused),
.url-rest-input :deep(.acuity-input-container.acuity-input-container--focused) {
  box-shadow: none;
}

:deep(.acuity-input-hint) {
  display: none;
}

/* ✅ 始终预留提示区域空间，避免布局跳动 */
.url-input__hint {
  min-height: 1.5em; /* 预留一行文本的高度 */
  font-size: var(--text-xs);
  line-height: 1.5;
  color: transparent; /* 默认透明，无内容时不可见 */
  transition: color 0.2s ease; /* 平滑过渡 */
}

/* 有内容时显示颜色 */
.url-input__hint.has-content {
  color: var(--color-text-secondary);
}

/* 错误状态 - 特异性高于 .has-content */
.url-input__hint.error,
.url-input__hint.error.has-content {
  color: var(--color-error);
}
</style>
