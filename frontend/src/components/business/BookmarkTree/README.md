# BookmarkTree 组件

## 组件分类

BookmarkTree 是**业务组件**（Business Component），包含：

- 书签相关的业务逻辑
- 数据处理算法
- 项目专属功能

## i18n 策略

作为业务组件，BookmarkTree **直接使用项目的 i18n 系统**：

```vue
<script setup lang="ts">
import { useI18n } from '@/utils/i18n-helpers'

const { t } = useI18n()

const tooltips = computed(() => ({
  addToFolder: t('tree_node_add_to_folder', node.title),
  editFolder: t('tree_node_edit_folder')
  // ...
}))
</script>
```

## 翻译键

所有翻译键位于项目的 `frontend/public/_locales/*/messages.json` 文件中：

- `tree_node_add_to_folder` - 添加到文件夹（带占位符 $1）
- `tree_node_edit_folder` - 编辑文件夹
- `tree_node_delete_folder` - 删除文件夹
- `tree_node_share_folder` - 分享文件夹
- `tree_node_favorite` - 添加到收藏
- `tree_node_unfavorite` - 取消收藏
- `tree_node_open_new_tab` - 在新标签页打开
- `tree_node_copy_url` - 复制链接
- `tree_node_edit_bookmark` - 编辑书签
- `tree_node_delete_bookmark` - 删除书签

## 组件结构

```
BookmarkTree/
├── TreeNode.vue          # 树节点组件
├── BookmarkTree.vue      # 树容器组件
└── README.md            # 本文档
```

## 使用示例

```vue
<script setup lang="ts">
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'

const bookmarkNodes = ref([...])
const treeConfig = {
  editable: true,
  showFavoriteButton: true
}
</script>

<template>
  <BookmarkTree :nodes="bookmarkNodes" :config="treeConfig" />
</template>
```

## 注意事项

1. **不要独立 i18n**：作为业务组件，不需要独立的翻译文件
2. **使用项目 i18n**：直接使用 `useI18n()` from `@/utils/i18n-helpers`
3. **翻译键统一**：所有翻译键使用 `tree_node_*` 前缀

## 相关文档

- [项目 i18n 系统](../../../utils/i18n-helpers.ts)
- [Chrome Extension i18n](https://developer.chrome.com/docs/extensions/reference/i18n/)
