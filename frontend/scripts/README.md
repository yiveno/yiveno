# 🛠️ 脚手架脚本

> 快速创建符合规范的组件和页面

---

## 📋 可用脚本

### 1. 创建基础 UI 组件

```bash
./scripts/create-base-component.sh <ComponentName>
```

**用途**: 创建纯展示的基础 UI 组件（无业务逻辑）

**示例**:

```bash
./scripts/create-base-component.sh Badge
```

**生成的文件**:

```
components/base/Badge/
├── Badge.vue           # 组件实现
├── Badge.types.ts      # TypeScript 类型定义
└── README.md           # 组件文档
```

---

### 2. 创建复合组件

```bash
./scripts/create-composite-component.sh <ComponentName>
```

**用途**: 创建包含业务逻辑的复合组件

**示例**:

```bash
./scripts/create-composite-component.sh BookmarkTree
```

**生成的文件**:

```
components/composite/BookmarkTree/
├── BookmarkTree.vue        # 主组件
├── BookmarkTree.types.ts   # 类型定义
├── README.md               # 组件文档
└── components/             # 子组件目录
```

---

### 3. 创建页面

```bash
./scripts/create-page.sh <page-name>
```

**用途**: 创建新的页面

**示例**:

```bash
./scripts/create-page.sh my-feature
```

**生成的文件**:

```
pages/my-feature/
├── index.html              # HTML 模板
├── main.ts                 # 入口文件
├── MyFeature.vue           # 主组件
├── types.ts                # 类型定义
├── components/             # 页面专用组件
├── composables/            # 页面专用 Composables
└── README.md               # 页面文档
```

**注意**: 创建页面后需要更新 `vite.config.ts` 添加入口：

```typescript
export default defineConfig({
  build: {
    // Vite 8 使用 rolldownOptions（rollupOptions 已弃用）
    rolldownOptions: {
      input: {
        myFeature: resolve(__dirname, 'src/pages/my-feature/index.html')
      }
    }
  }
})
```

---

## 🎯 使用流程

### 创建基础组件流程

```bash
# 1. 创建组件骨架
./scripts/create-base-component.sh MyButton

# 2. 实现组件
cd frontend/src/components/base/MyButton
# 编辑 MyButton.vue
# 编辑 MyButton.types.ts
# 完善 README.md

# 3. 导出组件
# 在 components/index.ts 中添加：
# export { default as MyButton } from './base/MyButton/MyButton.vue'
# export type * from './base/MyButton/MyButton.types'

# 4. 使用组件
# import { MyButton } from '@/components'
```

---

### 创建复合组件流程

```bash
# 1. 创建组件骨架
./scripts/create-composite-component.sh SearchPanel

# 2. 创建子组件（如果需要）
cd frontend/src/components/composite/SearchPanel/components
mkdir SearchInput
# 创建子组件文件...

# 3. 实现组件
# 编辑 SearchPanel.vue
# 编辑 SearchPanel.types.ts
# 完善 README.md

# 4. 导出组件
# 在 components/index.ts 中添加导出

# 5. 使用组件
# import { SearchPanel } from '@/components'
```

---

### 创建页面流程

```bash
# 1. 创建页面骨架
./scripts/create-page.sh my-feature

# 2. 更新 Vite 配置
# 编辑 vite.config.ts 添加入口

# 3. 实现页面
cd frontend/src/pages/my-feature
# 编辑 MyFeature.vue
# 编辑 types.ts
# 完善 README.md

# 4. 创建页面专用组件（如果需要）
cd components
mkdir MyComponent
# 创建组件文件...

# 5. 创建页面专用 Composables（如果需要）
cd ../composables
touch useMyFeature.ts

# 6. 测试页面
npm run dev
# 访问对应的 HTML 页面
```

---

## 📚 规范说明

### 组件规范

1. **命名规范**
   - 基础组件：PascalCase（如 `Button`, `Input`）
   - 复合组件：PascalCase（如 `BookmarkTree`, `SearchPanel`）
   - 文件名与组件名一致

2. **目录结构**

   ```
   Component/
   ├── Component.vue       # 必须
   ├── Component.types.ts  # 必须
   ├── README.md           # 必须
   └── Component.test.ts   # 可选
   ```

3. **类型定义**
   - 每个组件必须定义 `ComponentProps` 接口
   - 每个组件必须定义 `ComponentEmits` 接口
   - 如果有暴露的方法，定义 `ComponentExpose` 接口

4. **文档要求**
   - README 必须包含：概述、API、使用示例、样式定制
   - API 表格必须完整：Props、Emits、Slots、Expose

### 页面规范

1. **命名规范**
   - 页面目录：kebab-case（如 `my-feature`）
   - 主组件：PascalCase（如 `MyFeature.vue`）

2. **目录结构**

   ```
   page-name/
   ├── index.html          # 必须（如果是独立页面）
   ├── main.ts             # 必须（如果是独立页面）
   ├── PageName.vue        # 必须
   ├── types.ts            # 必须
   ├── README.md           # 必须
   ├── components/         # 可选
   └── composables/        # 可选
   ```

3. **数据流规范**
   - ✅ 从 IndexedDB 读取数据
   - ✅ 通过 Application 层服务处理业务
   - ✅ 监听 `AB_EVENTS.BOOKMARKS_DB_SYNCED` 事件
   - ❌ 不直接调用 Chrome API 读取数据
   - ❌ 不直接访问 IndexedDB 写入数据

---

## 🔍 示例

### 创建一个新的 Badge 组件

```bash
# 1. 运行脚本
./scripts/create-base-component.sh Badge

# 2. 编辑 Badge.vue
cat > frontend/src/components/base/Badge/Badge.vue << 'EOF'
<script setup lang="ts">
import type { BadgeProps } from './Badge.types'

const props = withDefaults(defineProps<BadgeProps>(), {
  variant: 'default',
  size: 'md'
})
</script>

<template>
  <span class="badge" :class="[`badge--${variant}`, `badge--${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.badge--default {
  background: var(--color-surface);
  color: var(--color-on-surface);
}

.badge--primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
</style>
EOF

# 3. 完善类型定义
cat > frontend/src/components/base/Badge/Badge.types.ts << 'EOF'
export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
}

export interface BadgeEmits {
  // 无事件
}
EOF

# 4. 在 components/index.ts 中导出
echo "export { default as Badge } from './base/Badge/Badge.vue'" >> frontend/src/components/index.ts
echo "export type * from './base/Badge/Badge.types'" >> frontend/src/components/index.ts

# 5. 使用
# <Badge variant="primary">New</Badge>
```

---

## 📖 参考文档

- [组件与页面规范化方案.md](../../文档/项目管理/组件与页面规范化方案.md) - 完整的重构方案
- [src目录架构说明.md](../../文档/项目管理/src目录架构说明.md) - 架构总览

---

## 🎯 最佳实践

### 基础组件开发

```vue
<!-- ✅ 好的做法 -->
<script setup lang="ts">
import type { ButtonProps, ButtonEmits } from './Button.types'

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})

const emit = defineEmits<ButtonEmits>()

const handleClick = (e: MouseEvent) => {
  if (props.disabled) return
  emit('click', e)
}
</script>

<template>
  <button
    class="button"
    :class="[`button--${variant}`, `button--${size}`]"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot />
  </button>
</template>
```

```vue
<!-- ❌ 不好的做法 -->
<script setup lang="ts">
// 没有类型定义
const props = defineProps({
  variant: String,
  size: String
})

// 直接访问业务数据
const bookmarks = await chrome.bookmarks.getTree() // ❌
</script>
```

### 复合组件开发

```vue
<!-- ✅ 好的做法 -->
<script setup lang="ts">
import { inject } from 'vue'
import type { BookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import type { SearchPanelProps } from './SearchPanel.types'

const props = defineProps<SearchPanelProps>()

// 通过 inject 获取服务
const bookmarkApp = inject<BookmarkAppService>('bookmarkApp')

const handleSearch = async (query: string) => {
  // 通过服务处理业务逻辑
  const result = await bookmarkApp?.search(query)
  // ...
}
</script>
```

```vue
<!-- ❌ 不好的做法 -->
<script setup lang="ts">
import { indexedDBManager } from '@/utils-legacy/indexeddb-manager'

// 直接访问 IndexedDB
const data = await indexedDBManager.getData() // ❌

// 直接调用 Chrome API
const bookmarks = await chrome.bookmarks.getTree() // ❌
</script>
```

---

## 🔄 更新日志

### v1.0.0 (2025-10-14)

- 初始版本
- 创建基础组件脚本
- 创建复合组件脚本
- 创建页面脚本
