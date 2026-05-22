# Tooltip 提示框组件

符合 Material Design 3 规范的 Tooltip 组件，用于在 hover 或 focus 时显示额外的信息。

## ✨ 特性

- 📐 **符合 MD3 规范** - 遵循 Material Design 3 设计指南
- 📍 **多方向定位** - 支持上下左右四个方向
- 🎨 **MD3 颜色系统** - 使用 Inverse Surface 颜色
- ⏱️ **延迟显示** - 500ms 延迟显示，150ms 快速隐藏
- 🎭 **平滑动画** - 使用 MD3 Emphasized Easing 曲线
- 📦 **两种类型** - 支持 Plain Tooltip 和 Rich Tooltip
- ♿ **无障碍支持** - 包含 ARIA 属性

## 📦 安装

```typescript
import { Tooltip } from '@/components'
```

## 🎯 基础用法

### Plain Tooltip（简单文本）

```vue
<script setup lang="ts">
import { Tooltip, LucideIcon } from '@/components'
</script>

<template>
  <Tooltip text="这是一个简单的提示">
    <LucideIcon name="info" />
  </Tooltip>
</template>
```

### Rich Tooltip（富文本）

```vue
<script setup lang="ts">
import { Tooltip, LucideIcon } from '@/components'
</script>

<template>
  <Tooltip offset="md">
    <LucideIcon name="info" />
    <template #content>
      <div>
        <strong>标题</strong>
        <p>这是详细的说明文本。</p>
        <ul>
          <li>支持列表</li>
          <li>支持多行</li>
        </ul>
      </div>
    </template>
  </Tooltip>
</template>
```

### 不同位置

```vue
<template>
  <!-- 顶部（默认） -->
  <Tooltip text="顶部提示" placement="top">
    <button>Top</button>
  </Tooltip>

  <!-- 底部 -->
  <Tooltip text="底部提示" placement="bottom">
    <button>Bottom</button>
  </Tooltip>

  <!-- 左侧 -->
  <Tooltip text="左侧提示" placement="left">
    <button>Left</button>
  </Tooltip>

  <!-- 右侧 -->
  <Tooltip text="右侧提示" placement="right">
    <button>Right</button>
  </Tooltip>
</template>
```

### 自定义偏移量

```vue
<template>
  <!-- 小偏移（默认推荐） -->
  <Tooltip text="小偏移" offset="sm">
    <button>Small Offset</button>
  </Tooltip>

  <!-- 中等偏移 -->
  <Tooltip text="中等偏移" offset="md">
    <button>Medium Offset</button>
  </Tooltip>

  <!-- 大偏移 -->
  <Tooltip text="大偏移" offset="lg">
    <button>Large Offset</button>
  </Tooltip>
</template>
```

## 📋 API

### Props

| 属性        | 类型                                     | 默认值  | 说明                             |
| ----------- | ---------------------------------------- | ------- | -------------------------------- |
| `text`      | `string`                                 | -       | 简单文本内容（Plain Tooltip）    |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Tooltip 位置                     |
| `delay`     | `number`                                 | `500`   | 显示延迟（毫秒），MD3 推荐 500ms |
| `disabled`  | `boolean`                                | `false` | 是否禁用                         |
| `offset`    | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'`   | `'sm'`  | 与触发元素的偏移量               |

### Slots

| 插槽名    | 说明                              |
| --------- | --------------------------------- |
| `default` | 触发 Tooltip 的元素（必需）       |
| `content` | Tooltip 内容（Rich Tooltip 使用） |

### Emits

无

## 🎨 Material Design 3 规范

### 颜色

- **背景色**: `--md-sys-color-inverse-surface`
- **文字色**: `--md-sys-color-inverse-on-surface`

### 字体

- **Plain Tooltip**: Body Small (12sp)
- **Rich Tooltip**: Body Small (12sp) + Body Medium (14sp) 标题

### 形状

- **圆角**: Small (4dp) = `--radius-sm`

### 阴影

- **Elevation**: Level 2 = `--md-sys-elevation-2`

### 尺寸

- **最大宽度**: 320dp（Rich Tooltip）
- **最小宽度**: 40dp
- **内边距**:
  - Plain: 4dp × 8dp
  - Rich: 8dp × 12dp

### 动画

- **显示**: 100ms (Short2) + Emphasized Easing
- **隐藏**: 50ms (Short1) + Emphasized Easing
- **延迟**: 500ms 显示，150ms 隐藏

## 💡 使用场景

### Plain Tooltip

- 图标按钮的说明
- 简短的功能提示
- 单行文本说明

### Rich Tooltip

- 需要标题的说明
- 多行文本说明
- 包含列表的说明
- 需要格式化的内容

## ⚠️ 注意事项

1. **无箭头设计** - 符合 MD3 规范，不使用箭头指示器
2. **延迟显示** - 默认 500ms 延迟，避免误触发
3. **最大宽度** - Rich Tooltip 最大 320dp，超出会自动换行
4. **触发方式** - 支持 hover 和 focus，不支持 click
5. **无障碍** - 自动添加 `role="tooltip"` 和 `aria-hidden` 属性

## 🔗 相关组件

- **LucideIcon** - 常与 Tooltip 配合使用
- **md-icon-button** - Material Web 图标按钮

## 📚 参考资料

- [Material Design 3 - Tooltips](https://m3.material.io/components/tooltips)
- [Material Design 3 - Motion](https://m3.material.io/styles/motion)
- [Material Design 3 - Elevation](https://m3.material.io/styles/elevation)

## 📝 更新日志

- **v2.0.0** (2025-01-XX) - 重构为符合 Material Design 3 规范
  - 移除箭头设计
  - 使用 MD3 颜色系统（Inverse Surface）
  - 使用 MD3 Elevation Level 2
  - 优化动画曲线（Emphasized Easing）
  - 添加延迟显示/隐藏
  - 添加无障碍属性
  - 优化 Rich Tooltip 样式
- **v1.0.0** (2025-01-05) - 初始版本

---

**组件类型**: 基础组件（原子级）  
**设计规范**: Material Design 3  
**最后更新**: 2025-01-XX
