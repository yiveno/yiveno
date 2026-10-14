<script setup lang="ts">
/**
 * 确认类 Modal：薄封装 AppModal，固定 Cancel + Confirm 操作区。
 */
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'

defineOptions({ name: 'AppConfirmModal' })

withDefaults(
  defineProps<{
    /** 受控显隐 */
    open: boolean
    /** 标题 */
    title: string
    /** 标题下副文案（aria-describedby） */
    description?: string | undefined
    /** 正文（与 default slot 二选一） */
    body?: string | undefined
    /** 确认按钮文案 */
    confirmLabel: string
    /** 取消按钮文案 */
    cancelLabel: string
    /** loading 时确认按钮文案；缺省同 confirmLabel */
    confirmLoadingLabel?: string | undefined
    /** 确认按钮着色 */
    confirmTone?: 'default' | 'danger'
    /** 确认按钮 variant */
    confirmVariant?: 'filled' | 'outlined'
    /** 取消按钮 variant */
    cancelVariant?: 'outlined' | 'text'
    /** 进行中：禁止关闭 */
    loading?: boolean
    /** 错误文案（显示在 actions 上方） */
    error?: string | undefined
    /** Esc 关闭 */
    closeOnEscape?: boolean
  }>(),
  {
    confirmTone: 'default',
    confirmVariant: 'outlined',
    cancelVariant: 'outlined',
    loading: false,
    closeOnEscape: true
  }
)

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <AppModal
    :open="open"
    :title="title"
    :description="description"
    :loading="loading"
    :close-on-escape="closeOnEscape"
    @close="emit('close')"
  >
    <p v-if="body" class="app-confirm-modal__body">{{ body }}</p>
    <slot v-else />

    <template v-if="error" #error>{{ error }}</template>

    <template #actions>
      <AppButton
        type="button"
        :disabled="loading"
        :title="cancelLabel"
        :variant="cancelVariant"
        @click="emit('close')"
      >
        {{ cancelLabel }}
      </AppButton>
      <AppButton
        type="button"
        :tone="confirmTone"
        :disabled="loading"
        :title="confirmLabel"
        :variant="confirmVariant"
        @click="emit('confirm')"
      >
        {{ loading && confirmLoadingLabel ? confirmLoadingLabel : confirmLabel }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.app-confirm-modal__body {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}
</style>
