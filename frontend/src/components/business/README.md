# 业务组件（Business Components）

## 定义

业务组件是包含业务逻辑、数据处理、算法的项目专属组件，不可独立成 package。

## 特征

- ❌ 包含业务逻辑
- ❌ 数据处理和算法
- ❌ 项目专属
- ❌ 不可独立成 package
- ✅ 直接使用项目 i18n

## 组件列表

### BookmarkTree

书签树组件，包含书签展示、拖拽、编辑等业务逻辑。

**路径**：`business/BookmarkTree/`

**使用**：

```vue
<script setup>
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
</script>

<template>
  <BookmarkTree :nodes="bookmarkNodes" :config="treeConfig" />
</template>
```

---

### BookmarkSearchInput

书签搜索输入框，包含搜索算法和筛选逻辑。

**路径**：`business/BookmarkSearchInput/`

---

### BookmarkRecommendations

书签推荐组件，包含推荐算法。

**路径**：`business/BookmarkRecommendations/`

---

### QuickAddBookmarkDialog

快速添加书签对话框，包含书签创建逻辑。

**路径**：`business/QuickAddBookmarkDialog/`

---

### GlobalQuickAddBookmark

全局快速添加书签组件。

**路径**：`business/GlobalQuickAddBookmark/`

**使用**：

```vue
<script setup>
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
</script>

<template>
  <GlobalQuickAddBookmark />
</template>
```

---

### GlobalSyncProgress

全局同步进度组件。

**路径**：`business/GlobalSyncProgress/`

**使用**：

```vue
<script setup>
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
</script>

<template>
  <GlobalSyncProgress />
</template>
```

---

## i18n 策略

所有业务组件**直接使用项目的 i18n 系统**：

```vue
<script setup lang="ts">
import { useI18n } from '@/utils/i18n-helpers'

const { t } = useI18n()

const tooltips = computed(() => ({
  edit: t('bookmark_edit'),
  delete: t('bookmark_delete')
}))
</script>
```

**翻译键位置**：`frontend/public/_locales/*/messages.json`

---

## 开发规范

### ✅ 推荐

1. **直接使用项目 i18n**

   ```typescript
   import { useI18n } from '@/utils/i18n-helpers'
   const { t } = useI18n()
   ```

2. **使用项目的服务层**

   ```typescript
   import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
   ```

3. **使用项目的 Store**
   ```typescript
   import { useBookmarkStore } from '@/stores/bookmarkStore'
   ```

### ❌ 禁止

1. **创建独立的 i18n 系统**

   ```typescript
   // ❌ 错误
   import { useTreeNodeI18n } from './useTreeNodeI18n'
   ```

2. **硬编码文案**

   ```vue
   <!-- ❌ 错误 -->
   <Button>删除</Button>

   <!-- ✅ 正确 -->
   <Button>{{ t('delete') }}</Button>
   ```

3. **尝试独立成 package**
   - 业务组件依赖项目特定功能，无法独立

---

## 相关文档

- [组件分类规范](../README.md)
- [项目 i18n 系统](../../utils/i18n-helpers.ts)
- [Chrome Extension i18n](https://developer.chrome.com/docs/extensions/reference/i18n/)

---

**最后更新**: 2025-01-04
