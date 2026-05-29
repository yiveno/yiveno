# 基础组件（Base Components）

## 📖 定义

基础组件是原子级 UI 组件，单一功能的最小 UI 单元，不依赖其他组件。

## ✨ 特征

- ✅ 单一功能
- ✅ 不依赖其他组件
- ✅ 纯 UI 展示
- ✅ 无业务逻辑
- ✅ 完全可复用
- ✅ 可独立成 package

## 📦 组件列表

### 表单类（7 个）

| 组件          | 说明           | 文档                              |
| ------------- | -------------- | --------------------------------- |
| **Button**    | 按钮组件       | [查看文档](./Button/README.md)    |
| **Input**     | 输入框组件     | [查看文档](./Input/README.md)     |
| **Switch**    | 开关组件       | [查看文档](./Switch/README.md)    |
| **Dropdown**  | 下拉菜单       | [查看文档](./Dropdown/README.md)  |
| **Accordion** | 手风琴折叠面板 | [查看文档](./Accordion/README.md) |
| **List**      | 列表容器       | [查看文档](./List/README.md)      |
| **ListItem**  | 列表项         | [查看文档](./ListItem/README.md)  |

### 展示类（6 个）

| 组件               | 说明       | 文档                                   |
| ------------------ | ---------- | -------------------------------------- |
| **Badge**          | 徽章组件   | [查看文档](./Badge/README.md)          |
| **Icon**           | 图标组件   | [查看文档](./Icon/README.md)           |
| **SvgIcon**        | SVG 图标   | [查看文档](./SvgIcon/README.md)        |
| **EmojiIcon**      | Emoji 图标 | [查看文档](./EmojiIcon/README.md)      |
| **AnimatedNumber** | 数字动画   | [查看文档](./AnimatedNumber/README.md) |

### 反馈类（3 个）

| 组件            | 说明     | 文档                                |
| --------------- | -------- | ----------------------------------- |
| **Spinner**     | 加载动画 | [查看文档](./Spinner/README.md)     |
| **ProgressBar** | 进度条   | [查看文档](./ProgressBar/README.md) |
| **Tooltip**     | 提示框   | [查看文档](./Tooltip/README.md)     |

### 布局类（5 个）

| 组件        | 说明     | 文档                            |
| ----------- | -------- | ------------------------------- |
| **App**     | 应用容器 | [查看文档](./App/README.md)     |
| **Main**    | 主内容区 | [查看文档](./Main/README.md)    |
| **Grid**    | 网格布局 | [查看文档](./Grid/README.md)    |
| **Divider** | 分割线   | [查看文档](./Divider/README.md) |
| **Spacer**  | 间距组件 | [查看文档](./Spacer/README.md)  |

### 其他（2 个）

| 组件                      | 说明       | 文档                                          |
| ------------------------- | ---------- | --------------------------------------------- |
| **Overlay**               | 遮罩层     | [查看文档](./Overlay/README.md)               |
| **KeyboardShortcutsHelp** | 快捷键帮助 | [查看文档](./KeyboardShortcutsHelp/README.md) |

**总计**: 23 个基础组件

## 🎯 使用示例

### 统一导入

```vue
<script setup lang="ts">
import { Button, Input, Badge, Icon, Spinner } from '@/components'
</script>

<template>
  <div>
    <Button variant="primary">
      <Icon name="icon-check" />
      确认
    </Button>

    <Input v-model="value" placeholder="请输入" />

    <Badge color="success">5</Badge>

    <Spinner v-if="loading" />
  </div>
</template>
```

### 组合使用

```vue
<script setup lang="ts">
import { Button, Icon, Badge } from '@/components'
</script>

<template>
  <Button variant="primary">
    <Icon name="icon-bell" />
    通知
    <Badge color="error" size="sm">99+</Badge>
  </Button>
</template>
```

## 🔧 开发规范

### 1. 单一职责

每个基础组件只负责一个功能，不包含复杂的业务逻辑。

```vue
<!-- ✅ 正确：Button 只负责按钮的 UI 和交互 -->
<Button @click="handleClick">点击</Button>

<!-- ❌ 错误：不要在基础组件内部处理业务逻辑 -->
<Button @click="createBookmark">创建书签</Button>
```

### 2. 不依赖其他组件

基础组件不应该导入其他基础组件（Icon 除外，因为它是最基础的）。

```vue
<!-- ❌ 错误：基础组件不应该依赖其他基础组件 -->
<script setup lang="ts">
import { Badge } from '@/components'
</script>

<!-- ✅ 正确：如果需要组合，应该创建复合组件 -->
```

### 3. Props 设计

Props 应该简单、清晰，使用语义化的命名。

```typescript
// ✅ 正确
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

// ❌ 错误：避免过于复杂的 Props
interface ButtonProps {
  config?: {
    style?: {
      variant?: string
      // ...
    }
  }
}
```

### 4. 事件命名

使用标准的 DOM 事件名称，或使用动词形式。

```typescript
// ✅ 正确
emit('click', event)
emit('change', value)
emit('update:modelValue', value)

// ❌ 错误
emit('buttonClicked', event)
emit('valueChanged', value)
```

### 5. 样式隔离

使用 scoped CSS 确保样式不会泄漏。

```vue
<style scoped>
.btn {
  /* 组件样式 */
}
</style>
```

### 6. 无障碍支持

确保组件符合 WCAG 标准。

```vue
<template>
  <button :aria-label="ariaLabel" :aria-disabled="disabled" role="button">
    <slot />
  </button>
</template>
```

## 🚫 禁止事项

1. ❌ **不要包含业务逻辑**
   - 不要调用业务服务
   - 不要处理业务数据
   - 不要包含业务算法

2. ❌ **不要依赖其他基础组件**
   - 保持独立性
   - 如果需要组合，创建复合组件

3. ❌ **不要写死项目特定文案**
   - 文案应该由外部传入
   - 使用 props 或 slots

4. ❌ **不要使用全局状态**
   - 不要依赖 Pinia store
   - 不要使用全局事件总线

## 📚 相关文档

- [组件分类规范](../README.md)
- [复合组件文档](../composite/README.md)
- [业务组件文档](../business/README.md)
- [设计系统规范](../../../.kiro/steering/design-system.md)

## 🔄 贡献指南

### 添加新组件

1. 在 `base/` 目录下创建组件文件夹
2. 创建组件文件：`ComponentName.vue`
3. 创建类型文件：`ComponentName.d.ts`
4. 创建文档文件：`README.md`
5. 在 `components/index.ts` 中导出

### 文档规范

每个组件的 README 应包含：

- 组件描述
- 特性列表
- 安装方式
- 基础用法
- API 文档（Props、Emits、Slots）
- 样式变量
- 使用场景
- 注意事项
- 相关组件
- 更新日志

## 📊 组件质量标准

### 必须满足

- ✅ 完整的 TypeScript 类型定义
- ✅ 完善的文档
- ✅ 无障碍支持
- ✅ 响应式设计
- ✅ 性能优化

### 推荐实现

- ✅ 单元测试
- ✅ 视觉回归测试
- ✅ 性能基准测试
- ✅ Storybook 示例

---

**最后更新**: 2025-01-05  
**维护者**: Kiro AI
