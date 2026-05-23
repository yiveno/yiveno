<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { LucideIcon } from '@/components'
import EmptyState from '@/components/composite/EmptyState/EmptyState.vue'

defineOptions({ name: 'AsyncSearchSelect' })

const props = withDefaults(defineProps<AsyncSearchSelectProps>(), {
  label: '搜索',
  placeholder: '输入关键词搜索...',
  multiple: false,
  emptyText: '未找到匹配结果',
  debounce: 300
})

const emit = defineEmits<AsyncSearchSelectEmits>()

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
  /** 头像 URL（可选） */
  avatar?: string
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
const isFocused = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// 已选择的选项（保留完整信息）
const selectedOptionsMap = ref<Map<string, SelectOption>>(new Map())

// 已选择的选项数组
const selectedOptions = computed(() => {
  return Array.from(selectedOptionsMap.value.values())
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
      selectedOptionsMap.value.delete(option.value)
    } else {
      selectedValues.value.add(option.value)
      selectedOptionsMap.value.set(option.value, option)
    }

    // 多选模式：选中后清空搜索输入，关闭下拉框
    searchQuery.value = ''
    showDropdown.value = false
    options.value = []
    loading.value = false
  } else {
    // 单选模式
    selectedValues.value.clear()
    selectedOptionsMap.value.clear()
    selectedValues.value.add(option.value)
    selectedOptionsMap.value.set(option.value, option)

    // 单选模式：选中后清空搜索输入，关闭下拉框
    searchQuery.value = ''
    closeDropdown()
  }

  // 触发变化事件
  emit('change', Array.from(selectedValues.value))
  emit('update:selected', selectedOptions.value)
}

/**
 * 移除选项（从标签中删除）
 */
const removeOption = (value: string, event?: Event) => {
  event?.stopPropagation()
  selectedValues.value.delete(value)
  selectedOptionsMap.value.delete(value)
  emit('change', Array.from(selectedValues.value))
  emit('update:selected', selectedOptions.value)
}

/**
 * 处理输入框容器点击（聚焦输入框）
 */
const handleWrapperClick = () => {
  inputRef.value?.focus()
}

/**
 * 处理输入框获取焦点
 */
const handleFocus = () => {
  isFocused.value = true
  // 多选模式：总是显示下拉框（如果有输入值）
  if (props.multiple && searchQuery.value.length > 0) {
    showDropdown.value = true
  }
}

/**
 * 处理输入框失去焦点
 */
const handleBlur = () => {
  isFocused.value = false
}

/**
 * 处理输入变化（防抖）
 */
const handleInput = useDebounceFn(
  () => {
    const query = searchQuery.value.trim()

    if (query.length === 0) {
      // 输入为空：隐藏下拉框，清空选项，不调用接口
      showDropdown.value = false
      options.value = []
      loading.value = false
      return
    }

    // 有输入值：设置 loading 状态，隐藏下拉框（等待接口响应），触发搜索
    loading.value = true
    showDropdown.value = false // 隐藏下拉框，等待接口响应
    // 清空之前的选项，避免显示旧数据
    options.value = []
    emit('search', query)
  },
  () => props.debounce
)

/**
 * 处理清除按钮点击
 */
const handleClear = () => {
  if (searchQuery.value) {
    // 如果有搜索输入，清空搜索
    searchQuery.value = ''
    showDropdown.value = false
    options.value = []
    loading.value = false
  } else if (selectedOptions.value.length > 0) {
    // 如果没有搜索输入但有选中项，清空所有选中
    clearSelection()
  }
}

/**
 * 关闭下拉框
 */
const closeDropdown = () => {
  showDropdown.value = false
  // 多选模式：清空搜索输入
  if (props.multiple) {
    searchQuery.value = ''
    options.value = []
  }
}

/**
 * 设置搜索结果（供父组件调用）
 */
const setOptions = (newOptions: SelectOption[]) => {
  options.value = newOptions
  loading.value = false
  // 接口响应后，显示下拉框（无论结果是否为空）
  showDropdown.value = true
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
  selectedOptionsMap.value.clear()
  emit('change', [])
  emit('update:selected', [])
}

/**
 * 清空搜索输入
 */
const clearSearch = () => {
  searchQuery.value = ''
  showDropdown.value = false
  options.value = []
  loading.value = false
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

/**
 * 获取头像 URL（支持 Gravatar）
 */
const getAvatarUrl = (option: SelectOption): string => {
  if (option.avatar) {
    return option.avatar
  }
  // 如果没有头像，返回默认头像（使用首字母）
  return ''
}

/**
 * 获取用户名首字母（用于默认头像）
 */
const getInitials = (label: string): string => {
  return label.charAt(0).toUpperCase()
}

// 点击外部关闭下拉框的指令
const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    const clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value()
      }
    }
    ;(el as HTMLElement & { clickOutsideEvent?: (event: Event) => void }).clickOutsideEvent =
      clickOutsideEvent
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
  clearSearch,
  getSelectedValues,
  getSelectedOptions
})
</script>

<template>
  <div v-click-outside="closeDropdown" class="async-search-select">
    <!-- 自定义输入框容器（包含标签和输入） -->
    <div class="input-container" :class="{ 'input-container--focused': isFocused }">
      <!-- Label -->
      <label v-if="label" class="input-label">{{ label }}</label>

      <!-- 输入区域 -->
      <div class="input-wrapper" @click="handleWrapperClick">
        <!-- 已选择的标签（显示在输入框内部） -->
        <div v-if="multiple && selectedOptions.length > 0" class="selected-tags-inline">
          <div
            v-for="option in selectedOptions"
            :key="option.value"
            class="selected-tag-inline"
            @click.stop="removeOption(option.value, $event)"
          >
            <!-- 头像 -->
            <div class="tag-avatar-inline">
              <img v-if="option.avatar" :src="getAvatarUrl(option)" :alt="option.label" />
              <span v-else class="tag-avatar-initials-inline">{{ getInitials(option.label) }}</span>
            </div>
            <!-- 标签文本 -->
            <span class="tag-label-inline">{{ option.label }}</span>
            <!-- 删除按钮 -->
            <LucideIcon name="x" :size="12" class="tag-remove-icon-inline" />
          </div>
        </div>

        <!-- 实际的输入框 -->
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          class="input-field"
          :placeholder="selectedOptions.length > 0 ? '' : placeholder"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="handleInput"
        />

        <!-- 右侧图标区域 -->
        <div class="input-actions">
          <!-- Loading 图标 -->
          <div v-if="loading" class="input-loading">
            <svg class="loading-spinner" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-dasharray="60"
                stroke-dashoffset="15"
                stroke-linecap="round"
              />
            </svg>
          </div>

          <!-- 清除按钮 -->
          <button
            v-else-if="searchQuery || selectedOptions.length > 0"
            type="button"
            class="input-clear-btn"
            @click.stop="handleClear"
          >
            <LucideIcon name="x" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- 下拉菜单 -->
    <div v-if="showDropdown" class="dropdown-menu" role="listbox" :aria-label="label">
      <!-- 搜索结果 -->
      <div v-if="options.length > 0" class="dropdown-options">
        <div
          v-for="option in options"
          :key="option.value"
          class="dropdown-option"
          :class="{ 'dropdown-option--selected': isSelected(option.value) }"
          role="option"
          :aria-selected="isSelected(option.value)"
          @click="toggleOption(option)"
        >
          <!-- 头像 -->
          <div class="option-avatar">
            <img v-if="option.avatar" :src="getAvatarUrl(option)" :alt="option.label" />
            <span v-else class="option-avatar-initials">{{ getInitials(option.label) }}</span>
          </div>

          <!-- 选项内容 -->
          <div class="option-content">
            <span class="option-label">{{ option.label }}</span>
            <span v-if="option.description" class="option-description">
              {{ option.description }}
            </span>
          </div>

          <!-- 选中标记（打勾） -->
          <LucideIcon
            v-if="isSelected(option.value)"
            name="check"
            :size="18"
            class="option-check-icon"
          />
        </div>
      </div>

      <!-- 无结果（只在非 loading 状态显示） -->
      <div v-else-if="!loading" class="dropdown-empty">
        <EmptyState
          icon="circle-slash"
          title="未找到匹配的用户"
          description="请尝试其他关键词"
          :icon-size="48"
        />
      </div>
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.async-search-select {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* 输入框容器 */
.input-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

/* Label */
.input-label {
  padding-left: var(--spacing-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

/* 输入框包装器（包含标签和输入） */
.input-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
  min-height: 48px;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-container-low);
  cursor: text;
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.input-wrapper:hover {
  border-color: var(--md-sys-color-primary);
}

.input-container--focused .input-wrapper {
  padding: calc(var(--spacing-2) - 1px) calc(var(--spacing-3) - 1px);
  border-width: 2px;
  border-color: var(--md-sys-color-primary);
  box-shadow: 0 0 0 1px var(--md-sys-color-primary);
}

/* 内嵌标签容器 */
.selected-tags-inline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

/* 内嵌标签 */
.selected-tag-inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--md-sys-color-on-primary-container);
  background: var(--md-sys-color-primary-container);
  cursor: pointer;
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.selected-tag-inline:hover {
  background: color-mix(
    in srgb,
    var(--md-sys-color-primary-container),
    var(--md-sys-color-primary) 15%
  );
}

/* 内嵌标签头像 */
.tag-avatar-inline {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--md-sys-color-primary);
  overflow: hidden;
}

.tag-avatar-inline img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tag-avatar-initials-inline {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-primary);
}

/* 内嵌标签文本 */
.tag-label-inline {
  max-width: 120px;
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 内嵌标签删除图标 */
.tag-remove-icon-inline {
  flex-shrink: 0;
  color: var(--md-sys-color-on-primary-container);
  opacity: 0.7;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.selected-tag-inline:hover .tag-remove-icon-inline {
  opacity: 1;
}

/* 实际输入框 */
.input-field {
  flex: 1;
  min-width: 120px;
  padding: var(--spacing-1) 0;
  border: none;
  outline: none;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: transparent;
}

.input-field::placeholder {
  color: var(--color-text-tertiary);
}

/* 输入框右侧操作区域 */
.input-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
}

/* Loading 图标 */
.input-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  color: var(--md-sys-color-primary);
  animation: spin 1s linear infinite;
}

/* 清除按钮 */
.input-clear-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  color: var(--color-text-tertiary);
  background: transparent;
  cursor: pointer;
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.input-clear-btn:hover {
  color: var(--color-text-primary);
  background: var(--md-sys-color-surface-container-high);
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
  transition: background-color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
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
  background-color: color-mix(
    in srgb,
    var(--md-sys-color-primary-container),
    var(--md-sys-color-primary) 10%
  );
}

/* 选项头像 */
.option-avatar {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--md-sys-color-primary);
  overflow: hidden;
}

.option-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.option-avatar-initials {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-primary);
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

/* 选中标记（打勾图标） */
.option-check-icon {
  flex-shrink: 0;
  color: var(--md-sys-color-primary);
}
</style>
