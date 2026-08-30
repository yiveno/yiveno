<script setup lang="ts">
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import '@/infrastructure/ui/library-item-card-content.css'

defineOptions({ name: 'AppLibraryItemCard' })

const props = withDefaults(
  defineProps<{
    /** 非多选模式下的跳转链接（由 @activate 侧处理打开） */
    href?: string | undefined
    /** 原生 title（书签悬停等） */
    linkTitle?: string | undefined
    /** detail export 多选模式 */
    detailExportActive?: boolean
    detailExportSelected?: boolean
    /** 虚拟列表行内填满高度（书签树） */
    fillHeight?: boolean
  }>(),
  {
    fillHeight: false
  }
)

const emit = defineEmits<{
  activate: [event: MouseEvent | KeyboardEvent]
}>()

function handleSurfaceActivate(event: MouseEvent): void {
  emit('activate', event)
}

function handleSurfaceKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') {
    return
  }
  event.preventDefault()
  emit('activate', event)
}
</script>

<template>
  <div
    class="app-library-item-card"
    :class="{
      'app-library-item-card--fill': props.fillHeight,
      'app-library-item-card--detail-export': props.detailExportActive === true,
      'app-library-item-card--selected':
        props.detailExportActive === true && props.detailExportSelected === true
    }"
    :title="props.linkTitle"
    :aria-selected="props.detailExportActive ? props.detailExportSelected === true : undefined"
    role="group"
  >
    <div
      class="app-library-item-card__body"
      :class="{
        'app-library-item-card__body--interactive':
          props.detailExportActive === true || Boolean(props.href)
      }"
      :tabindex="props.detailExportActive || props.href ? 0 : undefined"
      @click="handleSurfaceActivate"
      @keydown="handleSurfaceKeydown"
    >
      <span
        v-if="props.detailExportActive && props.detailExportSelected"
        class="app-library-item-card__selected-mark"
        aria-hidden="true"
      >
        <AppIcon name="check_circle" size="16px" />
      </span>

      <!-- 第一行：标题区 + 操作（space-between） -->
      <div class="lib-item-row lib-item-row--split">
        <div class="lib-item-row__start">
          <span v-if="$slots.leading" class="app-library-item-card__leading">
            <slot name="leading" />
          </span>
          <div class="app-library-item-card__title">
            <slot name="title" />
          </div>
        </div>
        <div
          v-if="$slots.actions && props.detailExportActive !== true"
          class="lib-item-row__end lib-item-actions"
          @click.stop
        >
          <slot name="actions" />
        </div>
      </div>

      <!-- 第二行：附注 -->
      <div v-if="$slots.note" class="lib-item-row lib-item-row--note">
        <slot name="note" />
      </div>

      <!-- 第三行：来源等信息 + 时间（space-between） -->
      <div v-if="$slots.footer || $slots.time" class="lib-item-row lib-item-row--split">
        <div class="lib-item-row__start">
          <slot name="footer" />
        </div>
        <div v-if="$slots.time" class="lib-item-row__end">
          <slot name="time" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-library-item-card {
  position: relative;
  min-width: 0;
}

.app-library-item-card--fill,
.app-library-item-card--fill .app-library-item-card__body {
  height: 100%;
}

.app-library-item-card__body {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  transition:
    background var(--motion-duration-short) var(--motion-easing-standard),
    border-color var(--motion-duration-short) var(--motion-easing-standard);
}

.app-library-item-card__body--interactive {
  cursor: pointer;
}

.app-library-item-card:hover .app-library-item-card__body {
  background: var(--surface-chrome);
}

.app-library-item-card--detail-export.app-library-item-card--selected .app-library-item-card__body {
  border-color: var(--accent);
  background: var(--surface-accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.app-library-item-card--detail-export.app-library-item-card--selected:hover
  .app-library-item-card__body {
  background: var(--surface-accent-soft);
}

.app-library-item-card__body:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.app-library-item-card__selected-mark {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  z-index: 1;
  display: inline-flex;
  color: var(--yiveno-semantic-success);
  pointer-events: none;
}

.app-library-item-card__leading {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  color: var(--accent);
}

.app-library-item-card__title {
  flex: 1;
  min-width: 0;
}

.lib-item-actions {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: var(--space-2xs);
  margin-top: -2px;
  margin-right: -2px;
}

/* 指针设备：操作钮默认隐藏，悬停或键盘聚焦条目时显示 */
@media (hover: hover) {
  .app-library-item-card__body > .lib-item-row--split:first-of-type {
    position: relative;
  }

  .lib-item-actions {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    margin: 0;
    padding-left: var(--space-sm);
    opacity: 0;
    pointer-events: none;
    background: linear-gradient(
      270deg,
      var(--surface) 55%,
      color-mix(in srgb, var(--surface) 88%, transparent) 100%
    );
    transition: opacity var(--motion-duration-short) var(--motion-easing-standard);
  }

  .app-library-item-card:hover .lib-item-actions,
  .app-library-item-card:focus-within .lib-item-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .app-library-item-card:hover .lib-item-actions {
    background: linear-gradient(
      270deg,
      var(--surface-chrome) 55%,
      color-mix(in srgb, var(--surface-chrome) 88%, transparent) 100%
    );
  }

  .app-library-item-card--detail-export.app-library-item-card--selected .lib-item-actions {
    background: linear-gradient(
      270deg,
      var(--surface-accent-soft) 55%,
      color-mix(in srgb, var(--surface-accent-soft) 88%, transparent) 100%
    );
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-library-item-card__body {
    transition: none;
  }

  .lib-item-actions {
    transition: none;
  }
}
</style>
