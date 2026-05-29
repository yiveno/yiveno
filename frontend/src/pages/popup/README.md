# Popup 弹出窗口页面

## 📋 功能描述

浏览器扩展的弹出窗口页面，点击工具栏图标时显示。提供快捷操作、搜索入口，以及引导用户进入侧边栏/管理页。

## 🎯 使用场景

- 快速搜索书签
- 查看最近访问的书签
- 快捷打开管理页面
- 快捷打开侧边栏

## 🔌 路由

- **路径**: Chrome 扩展弹出窗口
- **入口文件**: `index.html`
- **触发方式**: 点击扩展图标

## 📦 依赖组件

### 基础组件

- `components/base/Button` - 按钮操作
- `components/base/Input` - 搜索输入
- `components/base/Icon` - 图标显示

### 复合组件

- 待添加（如果有页面专用组件）

## 🏗️ 文件结构

```
pages/popup/
├── index.html          # HTML 模板
├── main.ts             # 入口文件
├── Popup.vue           # 主组件
├── styles.css          # 页面专属样式
├── components/         # 页面专用组件（待添加）
├── composables/        # 页面专用 Composables（待添加）
└── README.md           # 本文档
```

## 🔄 数据流

1. 页面初始化 → `onMounted`
2. 从 IndexedDB 读取最近书签 → `indexedDBManager.getAllBookmarks()`
3. 用户搜索 → 调用搜索服务
4. 显示结果 → 更新 UI

## 🎨 状态管理

### 本地状态

- `recentBookmarks` - 最近访问的书签

## 🔧 配置项

无

## 📝 注意事项

- ⚠️ 遵循单向数据流：Chrome API → IndexedDB → UI
- ⚠️ 弹出窗口会在失去焦点时关闭
- ⚠️ 保持轻量，避免加载大量数据
- ⚠️ 优先使用侧边栏处理复杂交互

## 🔄 更新日志

### v1.0.0 (2025-10-14)

- 迁移到 `pages/popup/` 目录
- 创建规范化文档
