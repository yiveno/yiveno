#!/usr/bin/env python3
import re

file_path = "src/components/business/BookmarkTree/BookmarkTree.vue"

# 读取文件
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 定义替换映射
replacements = {
    "emit('node-click'": "emit('nodeClick'",
    "emit('folder-toggle'": "emit('folderToggle'",
    "emit('node-select'": "emit('nodeSelect'",
    "emit('selection-change'": "emit('selectionChange'",
    "emit('node-edit'": "emit('nodeEdit'",
    "emit('node-delete'": "emit('nodeDelete'",
    "emit('folder-add'": "emit('folderAdd'",
    "emit('bookmark-open-new-tab'": "emit('bookmarkOpenNewTab'",
    "emit('bookmark-copy-url'": "emit('bookmarkCopyUrl'",
    "emit('bookmark-toggle-favorite'": "emit('bookmarkToggleFavorite'",
    "emit('folder-share'": "emit('folderShare'",
    "emit('bookmark-move'": "emit('bookmarkMove'",
    "emit('desc-counts-updated'": "emit('descCountsUpdated'",
    "emit('expand-state-change'": "emit('expandStateChange'",
}

# 执行替换
for old, new in replacements.items():
    content = content.replace(old, new)

# 写回文件
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ BookmarkTree.vue emit 调用已更新")
