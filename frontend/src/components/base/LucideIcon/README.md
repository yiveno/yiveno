# LucideIcon 组件

基于 [Lucide Icons](https://lucide.dev/) 的现代图标组件。

## 特性

- 🎨 现代、一致的图标风格
- 📦 按需导入,减少打包体积
- 🎯 完整的 TypeScript 支持
- 🔄 支持动画和变换
- 🎨 灵活的颜色和尺寸配置
- ♿ 良好的可访问性

## 基础用法

```vue
<script setup lang="ts">
import { LucideIcon } from '@/components/base/LucideIcon'
</script>

<template>
  <!-- 基础图标 -->
  <LucideIcon name="bookmark" />

  <!-- 指定尺寸 -->
  <LucideIcon name="star" size="lg" />

  <!-- 指定颜色 -->
  <LucideIcon name="heart" color="error" />

  <!-- 自定义尺寸和颜色 -->
  <LucideIcon name="settings" :size="32" color="#3b82f6" />
</template>
```

## Props

### name

- 类型: `string`
- 必填: 是
- 说明: 图标名称,使用 kebab-case 格式

```vue
<LucideIcon name="bookmark" />
<LucideIcon name="folder-plus" />
<LucideIcon name="check-circle" />
```

### size

- 类型: `number | 'xs' | 'sm' | 'md' | 'lg' | 'xl'`
- 默认值: `'md'`
- 说明: 图标尺寸

尺寸映射:

- `xs`: 12px
- `sm`: 16px
- `md`: 20px (默认)
- `lg`: 24px
- `xl`: 32px

```vue
<LucideIcon name="star" size="xs" />
<LucideIcon name="star" size="sm" />
<LucideIcon name="star" size="md" />
<LucideIcon name="star" size="lg" />
<LucideIcon name="star" size="xl" />
<LucideIcon name="star" :size="48" />
```

### color

- 类型: `string`
- 默认值: `'currentColor'`
- 说明: 图标颜色

支持的颜色类型:

1. 语义化颜色: `primary`, `secondary`, `error`, `warning`, `success`, `info`, `muted`
2. CSS 变量: `--md-sys-color-primary`
3. 直接颜色值: `#3b82f6`, `rgb(59, 130, 246)`

```vue
<!-- 语义化颜色 -->
<LucideIcon name="check" color="success" />
<LucideIcon name="alert" color="warning" />
<LucideIcon name="error" color="error" />

<!-- CSS 变量 -->
<LucideIcon name="star" color="--md-sys-color-primary" />

<!-- 直接颜色值 -->
<LucideIcon name="heart" color="#ef4444" />
```

### strokeWidth

- 类型: `number`
- 默认值: `2`
- 说明: 线条宽度

```vue
<LucideIcon name="star" :stroke-width="1" />
<LucideIcon name="star" :stroke-width="2" />
<LucideIcon name="star" :stroke-width="3" />
```

### spin

- 类型: `boolean`
- 默认值: `false`
- 说明: 是否旋转动画

```vue
<LucideIcon name="loader" spin />
<LucideIcon name="refresh" spin />
```

### flipH

- 类型: `boolean`
- 默认值: `false`
- 说明: 水平翻转

```vue
<LucideIcon name="arrow-right" flip-h />
```

### flipV

- 类型: `boolean`
- 默认值: `false`
- 说明: 垂直翻转

```vue
<LucideIcon name="arrow-down" flip-v />
```

### rotate

- 类型: `number`
- 说明: 旋转角度(度)

```vue
<LucideIcon name="arrow-right" :rotate="45" />
<LucideIcon name="arrow-right" :rotate="90" />
<LucideIcon name="arrow-right" :rotate="180" />
```

## 可用图标

### 基础操作

- `plus`, `minus`, `x`, `close`, `check`
- `chevron-down`, `chevron-right`, `chevron-left`, `chevron-up`
- `chevrons-right`, `chevrons-left`
- `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`

### 编辑操作

- `edit`, `delete`, `trash`, `copy`, `clipboard`
- `save`, `download`, `upload`

### 文件和文件夹

- `file`, `folder`, `folder-open`
- `folder-plus`, `folder-add`, `folder-minus`, `folder-delete`

### 书签相关

- `bookmark`, `bookmark-plus`, `bookmark-add`
- `bookmark-minus`, `bookmark-delete`, `bookmark-check`
- `star`, `favorite`, `star-off`, `favorite-outline`

### 搜索和筛选

- `search`, `filter`, `sliders`

### 设置和配置

- `settings`, `more-vertical`, `more-horizontal`, `menu`

### 状态指示

- `alert`, `alert-circle`, `alert-triangle`, `warning`
- `info`, `success`, `check-circle`
- `error`, `x-circle`, `help`, `help-circle`

### 用户和账户

- `user`, `account`, `users`, `user-plus`

### 时间和日期

- `clock`, `calendar`

### 网络和同步

- `cloud`, `cloud-off`, `cloud-sync`
- `refresh`, `sync`, `loader`, `loading`

### 视图和布局

- `eye`, `eye-off`, `layout`, `grid`, `list`

### 导航

- `home`, `external-link`, `link`, `unlink`

### 主题

- `sun`, `light`, `moon`, `dark`

### 其他

- `tag`, `tags`, `hash`
- `flash`, `zap`, `crown`, `brain`
- `sparkles`, `ai`, `auto`
- `lock`, `unlock`, `shield`, `ban`, `block`

完整图标列表请访问: https://lucide.dev/icons/

## 从 Material Icons 迁移

如果你之前使用 Material Icons,可以使用映射表快速迁移:

```typescript
import { materialToLucideMap } from '@/components/base/LucideIcon'

// 旧的 Material Icon 名称
const oldName = 'icon-bookmark-Add'
// 新的 Lucide Icon 名称
const newName = materialToLucideMap[oldName] // 'bookmark-plus'
```

常见映射:

- `icon-add` → `plus`
- `icon-delete` → `trash`
- `icon-bookmark` → `bookmark`
- `icon-favorite` → `star`
- `icon-alert` → `alert-circle`
- `icon-success` → `check-circle`
- `icon-error` → `x-circle`

## 添加新图标

如果需要使用的图标不在列表中,可以在 `icons.ts` 中添加:

```typescript
// 1. 从 lucide-vue-next 导入图标
import { NewIcon } from 'lucide-vue-next'

// 2. 添加到 lucideIcons 映射
export const lucideIcons: Record<string, Component> = {
  // ...
  'new-icon': NewIcon
}
```

## 性能优化

- ✅ 按需导入图标,只打包使用的图标
- ✅ 使用 GPU 加速渲染
- ✅ 优化动画性能
- ✅ 支持 Tree Shaking

## 可访问性

- 图标默认设置 `aria-hidden="true"`
- 如果图标传达重要信息,请添加文字说明或 `aria-label`

```vue
<!-- ❌ 不推荐:仅图标按钮 -->
<button>
  <LucideIcon name="trash" />
</button>

<!-- ✅ 推荐:添加文字说明 -->
<button>
  <LucideIcon name="trash" />
  <span>删除</span>
</button>

<!-- ✅ 推荐:使用 aria-label -->
<button aria-label="删除">
  <LucideIcon name="trash" />
</button>
```

## 示例

### 按钮中的图标

```vue
<template>
  <button class="btn">
    <LucideIcon name="plus" size="sm" />
    <span>添加书签</span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
```

### 加载状态

```vue
<template>
  <button :disabled="loading">
    <LucideIcon v-if="loading" name="loader" spin />
    <LucideIcon v-else name="save" />
    <span>{{ loading ? '保存中...' : '保存' }}</span>
  </button>
</template>
```

### 状态指示

```vue
<template>
  <div class="status">
    <LucideIcon name="check-circle" color="success" />
    <span>同步成功</span>
  </div>

  <div class="status">
    <LucideIcon name="alert-triangle" color="warning" />
    <span>需要注意</span>
  </div>

  <div class="status">
    <LucideIcon name="x-circle" color="error" />
    <span>同步失败</span>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
```

## 相关资源

- [Lucide Icons 官网](https://lucide.dev/)
- [lucide-vue-next 文档](https://github.com/lucide-icons/lucide/tree/main/packages/lucide-vue-next)
- [设计系统规范](../../../../.kiro/steering/design-system.md)
