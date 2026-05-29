# ShareDialog 组件

## 概述

ShareDialog 是书签分享功能的主要 UI 组件，提供完整的分享流程界面。

## 功能

- ✅ 显示书签列表
- ✅ 书签选择（复选框）
- ✅ 主题切换（深色/浅色）
- ✅ 海报预览
- ✅ 复制图片到剪贴板
- ✅ 下载图片
- ✅ 生成分享链接

## Props

```typescript
interface ShareDialogProps {
  /** 是否显示弹窗 */
  show: boolean
  /** 书签列表 */
  bookmarks: BookmarkNode[]
  /** 分享类型 */
  shareType: 'favorites' | 'folder'
  /** 文件夹名称（分享文件夹时） */
  folderName?: string
}
```

## Emits

```typescript
interface ShareDialogEmits {
  /** 更新显示状态 */
  'update:show': [value: boolean]
  /** 分享完成 */
  'share-complete': []
}
```

## 使用示例

```vue
<template>
  <ShareDialog
    v-model:show="showShareDialog"
    :bookmarks="favoriteBookmarks"
    share-type="favorites"
    @share-complete="handleShareComplete"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ShareDialog from '@/components/business/ShareDialog/ShareDialog.vue'

const showShareDialog = ref(false)
const favoriteBookmarks = ref([...])

const handleShareComplete = () => {
  console.log('分享完成')
}
</script>
```

## 状态管理

组件内部维护以下状态：

- `selectedTheme` - 当前选择的主题
- `selectedBookmarks` - 选中的书签 ID 集合
- `posterPreview` - 海报预览 Data URL
- `isGenerating` - 是否正在生成海报
- `error` - 错误信息

## 依赖服务

- `ShareService` - 数据编码和剪贴板操作
- `PosterService` - 海报生成
