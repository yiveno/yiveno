<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { MdInput } from '@/components/base/Input'
import { LucideIcon } from '@/components'

defineOptions({ name: 'AsyncSearchSelect' })

const props = withDefaults(defineProps<AsyncSearchSelectProps>(), {
  label: '搜索',
  placeholder: '输入关键词搜索...',
  multiple: false,
  emptyText: '未找到匹配结果',
  debounce: 300
})

const emit = defineEmits<AsyncSearchSelectEmits>()

// 将 debounce 转换为 ref 以保持响应式
const debounceDelay = toRef(props, 'debounce')

/**
 * 选项接口
 */
export interface SelectOption {
  /** 选项值（唯一标识） */
  value: string
  /** 选项标签（显示文本） */
  label: string
  /** 选项描述（可选） */
  description?: string
  /** 原始数据（可选） */
  raw?: unknown
}

/**
 * 组件 Props
 */
interface AsyncSearchSelectProps {
  /** 标签 */
  label?: string
  /** 占位符 */
  placeholder?: string
  /** 是否多选 */
  multiple?: boolean
  /** 空结果提示文本 */
  emptyText?: string
  /** 防抖延迟（毫秒） */
  debounce?: number
}

/**
 * 组件 Emits
 */
interface AsyncSearchSelectEmits {
  /** 搜索事件（返回搜索关键词） */
  (e: 'search', query: string): void
  /** 选择变化事件（返回选中的值数组） */
  (e: 'change', values: string[]): void
  /** 选择变化事件（返回选中的选项对象数组） */
  (e: 'update:selected', options: SelectOption[]): void
}

// 状态
const searchQuery = ref('')
const showDropdown = ref(false)
const loading = ref(false)
const options = ref<SelectOption[]>([])
const selectedValues = ref<Set<string>>(new Set())

// 已选择的选项
const selectedOptions = computed(() => {
  return Array.from(selectedValues.value)
    .map(value => options.value.find(opt => opt.value === value))
    .filter(Boolean) as SelectOption[]
})

/**
 * 判断选项是否已选中
 */
const isSelected = (value: string): boolean => {
  return selectedValues.value.has(value)
}

/**
 * 切换选项选中状态
 */
const toggleOption = (option: SelectOption) => {
  if (props.multiple) {
    // 多选模式
    if (selectedValues.value.has(option.value)) {
      selectedValues.value.delete(option.value)
    } else {
      selectedValues.value.add(option.value)
    }
  } else {
    // 单选模式
    selectedValues.value.clear()
    selectedValues.value.add(option.value)
    searchQuery.value = option.label
    closeDropdown()
  }

  // 触发变化事件
  emit('change', Array.from(selectedValues.value))
  emit('update:selected', selectedOptions.value)
}

/**
 * 移除选项
 */
const removeOption = (value: string) => {
  selectedValues.value.delete(value)
  emit('change', Array.from(selectedValues.value))
  emit('update:selected', selectedOptions.value)
}

/**
 * 处理输入框获取焦点
 */
const handleFocus = () => {
  // 有输入值时显示下拉框
  if (searchQuery.value.length > 0) {
    showDropdown.value = true
  }
}

/**
 * 处理输入变化（防抖）
 */
const handleInput = useDebounceFn(() => {
  const query = searchQuery.value.trim()
  
  if (query.length > 0) {
    // 有输入值：显示下拉框并触发搜索
    showDropdown.value = true
    loading.value = true
    emit('search', query)
  } else {
    // 无输入值：隐藏下拉框并清空选项
    showDropdown.value = false
    options.value = []
    loading.value = false
  }
}, debounceDelay)

/**
 * 关闭下拉框
 */
const closeDropdown = () => {
  showDropdown.value = false
}

/**
 * 设置搜索结果（供父组件调用）
 */
const setOptions = (newOptions: SelectOption[]) => {
  options.value = newOptions
  loading.value = false
}

/**
 * 设置 loading 状态（供父组件调用）
 */
const setLoading = (isLoading: boolean) => {
  loading.value = isLoading
}

/**
 * 清空选择
 */
const clearSelection = () => {
  selectedValues.value.clear()
  emit('change', [])
  emit('update:selected', [])
}

/**
 * 获取选中的值
 */
const getSelectedValues = (): string[] => {
  return Array.from(selectedValues.value)
}

/**
 * 获取选中的选项
 */
const getSelectedOptions = (): SelectOption[] => {
  return selectedOptions.value
}

// 点击外部关闭下拉框的指令
const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    const clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value()
      }
    }
    ;(el as HTMLElement & { clickOutsideEvent?: (event: Event) => void }).clickOutsideEvent = clickOutsideEvent
    document.addEventListener('click', clickOutsideEvent)
  },
  unmounted(el: HTMLElement & { clickOutsideEvent?: (event: Event) => void }) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('click', el.clickOutsideEvent)
    }
  }
}

// 暴露方法给父组件
defineExpose({
  setOptions,
  setLoading,
  clearSelection,
  getSelectedValues,
  getSelectedOptions
})
</script>

<template>
  <div v-click-outside="closeDropdown" class="async-search-select">
    <!-- 输入框 -->
    <MdInput
      v-model="searchQuery"
      :label="label"
      :placeholder="placeholder"
      :disabled="loading"
      :loading="loading"
      variant="outlined"
      size="md"
      @focus="handleFocus"
      @input="handleInput"
    >
      <LucideIcon slot="leading-icon" name="search" :size="18" />
    </MdInput>

    <!-- 下拉菜单 -->
    <div
      v-if="showDropdown"
      class="dropdown-menu"
      role="listbox"
      :aria-label="label"
    >
      <!-- 搜索结果 -->
      <div
        v-if="options.length > 0"
        class="dropdown-options"
      >
        <div
          v-for="option in options"
          :key="option.value"
          class="dropdown-option"
          :class="{ 'dropdown-option--selected': isSelected(option.value) }"
          role="option"
          :aria-selected="isSelected(option.value)"
          @click="toggleOption(option)"
        >
          <md-checkbox
            v-if="multiple"
            :checked="isSelected(option.value)"
            @change="toggleOption(option)"
          />
          <div class="option-content">
            <span class="option-label">{{ option.label }}</span>
            <span v-if="option.description" class="option-description">
              {{ option.description }}
            </span>
          </div>
        </div>
      </div>

      <!-- 无结果 -->
      <div v-else class="dropdown-empty">
        <LucideIcon name="x-circle" :size="24" />
        <span>{{ emptyText }}</span>
      </div>
    </div>

    <!-- 已选择的项（多选模式） -->
    <div v-if="multiple && selectedOptions.length > 0" class="selected-chips">
      <md-assist-chip
        v-for="option in selectedOptions"
        :key="option.value"
        :label="option.label"
        @click="removeOption(option.value)"
      >
        <LucideIcon slot="icon" name="x" :size="14" />
      </md-assist-chip>
    </div>
  </div>
</template>

<style scoped>


@keyframes dropdown-fade-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.async-search-select {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + var(--spacing-1));
  right: 0;
  left: 0;
  z-index: 1000;
  max-height: 320px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-container);
  animation: dropdown-fade-in 0.15s ease-out;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

/* 下拉选项 */
.dropdown-options {
  display: flex;
  flex-direction: column;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background-color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.dropdown-option:last-child {
  border-bottom: none;
}

.dropdown-option:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.dropdown-option--selected {
  background-color: var(--md-sys-color-primary-container);
}

.dropdown-option--selected:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary-container), var(--md-sys-color-primary) 10%);
}

/* 选项内容 */
.option-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-1);
  min-width: 0;
}

.option-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-description {
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 无结果 */
.dropdown-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-6);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.dropdown-empty svg {
  color: var(--color-text-tertiary);
}

/* 已选择的 Chips */
.selected-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-container-low);
}

.selected-chips md-assist-chip {
  cursor: pointer;
}
</style>
