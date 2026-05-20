# 复合组件（Composite Components）

## 📖 定义

复合组件是由多个基础组件组合而成的通用 UI 组件，不包含业务逻辑，完全可复用。

## ✨ 特征

- ✅ 由多个基础组件组合而成
- ✅ 纯 UI 展示
- ✅ 无业务逻辑
- ✅ 完全可复用
- ✅ 可独立成 package
- ⚠️ 可能有少量固定的 UI 提示文案

## 📦 组件列表

### 对话框类（3 个）

| 组件 | 说明 | 依赖组件 | 文档 |
|------|------|----------|------|
| **Dialog** | 对话框 | Button, Card, Icon | [查看文档](./Dialog/README.md) |
| **ConfirmableDialog** | 可确认对话框 | Dialog | [查看文档](./ConfirmableDialog/README.md) |
| **SyncProgressDialog** | 同步进度对话框 | Dialog, Icon, Button | [查看文档](./SyncProgressDialog/README.md) |

### 表单类（2 个）

| 组件 | 说明 | 依赖组件 | 文档 |
|------|------|----------|------|
| **Checkbox** | 复选框 | Icon | [查看文档](./Checkbox/README.md) |

### 展示类（6 个）

| 组件 | 说明 | 依赖组件 | 文档 |
|------|------|----------|------|
| **Alert** | 警告提示 | Icon | [查看文档](./Alert/README.md) |
| **Card** | 卡片容器 | Icon | [查看文档](./Card/README.md) |
| **EmptyState** | 空状态 | Icon | [查看文档](./EmptyState/README.md) |
| **Avatar** | 头像 | Icon | [查看文档](./Avatar/README.md) |
| **Chip** | 标签/徽章 | Material Web Components | [查看文档](./Chip/README.md) |
| **Notification** | 通知提示 | Icon | [查看文档](./Notification/README.md) |

### 导航类（2 个）

| 组件 | 说明 | 依赖组件 | 文档 |
|------|------|----------|------|
| **Tabs** | 标签页 | Icon | [查看文档](./Tabs/README.md) |
| **AppHeader** | 应用头部 | Icon, Button, ThemeToggle | [查看文档](./AppHeader/README.md) |

### 功能类（2 个）

| 组件 | 说明 | 依赖组件 | 文档 |
|------|------|----------|------|
| **ThemeToggle** | 主题切换 | Icon, Button | [查看文档](./ThemeToggle/README.md) |
| **PerformanceMonitor** | 性能监控 | Button, Icon | [查看文档](./PerformanceMonitor/README.md) |

**总计**: 13 个复合组件

## 🎯 使用示例

### 统一导入

```vue
<script setup lang="ts">
import { Alert, Card, Dialog, EmptyState, Checkbox } from '@/components'
</script>

<template>
  <Card>
    <Alert color="success">操作成功！</Alert>
    
    <EmptyState
      v-if="!items.length"
      icon="icon-folder"
      title="暂无数据"
    />
    
    <Checkbox v-model="agreed" label="同意条款" />
  </Card>
  
  <Dialog :show="showDialog" title="确认">
    确定要删除吗？
  </Dialog>
</template>
```

### 组合使用

```vue
<script setup lang="ts">
import { Card, Alert, Button, EmptyState } from '@/components'
</script>

<template>
  <Card title="用户列表">
    <Alert v-if="error" color="error">
      {{ error }}
    </Alert>
    
    <EmptyState
      v-else-if="!users.length"
      icon="icon-users"
      title="暂无用户"
      description="还没有添加任何用户"
    >
      <Button @click="addUser">添加用户</Button>
    </EmptyState>
    
    <div v-else>
      <!-- 用户列表 -->
    </div>
  </Card>
</template>
```

## 🔧 开发规范

### 1. 只依赖基础组件

复合组件应该只依赖基础组件，不要依赖其他复合组件（除非有明确的层级关系）。

```vue
<!-- ✅ 正确：只导入基础组件 -->
<script setup lang="ts">
import { Icon, Button } from '@/components'
</script>

<!-- ❌ 错误：不要导入其他复合组件 -->
<script setup lang="ts">
import { Alert } from '@/components'  // 复合组件
</script>

<!-- ✅ 例外：有明确层级关系的可以依赖 -->
<script setup lang="ts">
import Dialog from '../Dialog/Dialog.vue'  // ConfirmableDialog 可以依赖 Dialog
</script>
```

### 2. 不包含业务逻辑

复合组件应该保持通用性，不包含项目特定的业务逻辑。

```vue
<!-- ❌ 错误：包含业务逻辑 -->
<script setup lang="ts">
import { bookmarkService } from '@/application/bookmark/bookmark-service'

async function handleClick() {
  await bookmarkService.createBookmark(...)  // 业务逻辑
}
</script>

<!-- ✅ 正确：通过 emit 传递事件 -->
<script setup lang="ts">
const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  emit('click')  // 只负责 UI 交互
}
</script>
```

### 3. 文案处理

复合组件的文案应该由外部传入，或提供通用的默认文案。

```vue
<!-- ✅ 方案 1：完全由外部传入 -->
<template>
  <Alert>
    <slot />  <!-- 文案由父组件传入 -->
  </Alert>
</template>

<!-- ✅ 方案 2：内置默认文案 + 支持覆盖 -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  message?: string
}>(), {
  message: '默认提示文案'  // 通用的默认文案
})
</script>

<template>
  <Alert>{{ message }}</Alert>
</template>

<!-- ❌ 错误：写死项目特定文案 -->
<template>
  <Alert>书签创建成功</Alert>  <!-- 项目特定文案 -->
</template>
```

### 4. 命名规范

- **组件名**：PascalCase（如 `EmptyState.vue`）
- **CSS 类名**：kebab-case（如 `.empty-state`）
- **Props**：camelCase（如 `iconSize`）
- **Events**：kebab-case（如 `@update:model-value`）

### 5. 类型定义

每个复合组件都应该有完整的类型定义。

```typescript
// ComponentName.d.ts
export interface ComponentNameProps {
  /** 属性说明 */
  propName?: string
}

export interface ComponentNameEmits {
  /** 事件说明 */
  (event: 'eventName', payload: any): void
}
```

## 🚫 禁止事项

1. ❌ **不要包含业务逻辑**
   - 不要调用业务服务（如 bookmarkService）
   - 不要处理业务数据（如书签、标签）
   - 不要包含业务算法（如搜索、推荐）

2. ❌ **不要依赖其他复合组件**（除非有明确层级）
   - 只能依赖基础组件
   - 保持低耦合
   - 例外：ConfirmableDialog 可以依赖 Dialog

3. ❌ **不要写死项目特定文案**
   - 文案应该由外部传入
   - 或提供通用的默认文案

4. ❌ **不要使用全局状态**
   - 不要依赖 Pinia store
   - 不要使用全局事件总线
   - 通过 props 和 emits 通信

## 📊 组件依赖关系

### 依赖图

```
基础组件层
├── Icon (最基础)
├── Button
├── Input
└── ...

复合组件层
├── Alert (依赖: Icon)
├── Card (依赖: Icon)
├── Checkbox (依赖: Icon)
├── Chip (依赖: Button, Icon)
├── Dialog (依赖: Button, Card, Icon)
├── ConfirmableDialog (依赖: Dialog)
└── ...
```

### 依赖规则

1. **基础组件** → 不依赖任何组件
2. **复合组件** → 只依赖基础组件
3. **特殊情况** → 复合组件可以依赖其他复合组件（如 ConfirmableDialog 依赖 Dialog）

## 📚 相关文档

- [组件分类规范](../README.md)
- [基础组件文档](../base/README.md)
- [业务组件文档](../business/README.md)
- [设计系统规范](../../../.kiro/steering/design-system.md)

## 🔄 贡献指南

### 添加新复合组件

1. 在 `composite/` 目录下创建组件文件夹
2. 创建组件文件：`ComponentName.vue`
3. 创建类型文件：`ComponentName.d.ts`
4. 创建文档文件：`README.md`
5. 在 `components/index.ts` 中导出
6. 确保只依赖基础组件

### 文档规范

每个复合组件的 README 应包含：

- 组件描述
- 特性列表
- 依赖组件列表
- 安装方式
- 基础用法
- 使用场景
- API 文档（Props、Emits、Slots）
- 样式变量
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
- ✅ 只依赖基础组件
- ✅ 无业务逻辑

### 推荐实现

- ✅ 单元测试
- ✅ 视觉回归测试
- ✅ Storybook 示例
- ✅ 使用示例代码

---

## 🔄 更新日志

### 2025-05-20：组件清理

**删除的组件**：
- ❌ `UrlInput` - 已被 `Input` 组件的 `type="url"` 替代
- ❌ `CountIndicator` - 已被 `Chip` 组件完全替代

**Chip 组件增强**：
- ✅ 现在用于显示数量徽章（替代 CountIndicator）
- ✅ 支持多种样式变体：`filled`、`outlined`、`soft`
- ✅ 支持多种颜色：`primary`、`secondary`、`success`、`warning`、`error`、`info`
- ✅ 支持多种尺寸：`sm`、`md`、`lg`

**使用示例**：
```vue
<!-- 显示数量（替代 CountIndicator） -->
<Chip size="sm" variant="filled" color="primary">{{ count }}</Chip>

<!-- 显示标签 -->
<Chip size="md" variant="soft" color="success">新功能</Chip>
```

---

**最后更新**: 2025-05-20  
**维护者**: Kiro AI
