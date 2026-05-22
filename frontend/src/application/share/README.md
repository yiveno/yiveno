# 书签分享功能

## 目录结构

```
src/application/share/
├── README.md                 # 本文件
├── types.ts                  # 类型定义
├── share-service.ts          # 分享服务（编码/解码/剪贴板）
├── poster-service.ts         # 海报生成服务
└── import-service.ts         # 导入服务

src/components/business/ShareDialog/
├── ShareDialog.vue           # 分享弹窗组件
├── ShareDialog.d.ts          # 组件类型定义
└── README.md                 # 组件说明
```

## 功能模块

### 1. ShareService（分享服务）

- 编码书签数据为压缩字符串
- 解码分享链接数据
- 生成分享 URL
- 复制到剪贴板
- 下载图片

### 2. PosterService（海报生成服务）

- 使用 Canvas API 绘制海报
- 生成二维码
- 加载和缓存 favicon
- 导出为 PNG 图片

### 3. ImportService（导入服务）

- 调用 Chrome Bookmarks API
- 批量导入书签
- 进度回调
- 错误处理

### 4. ShareDialog（分享弹窗组件）

- 显示分享选项
- 海报预览
- 主题切换
- 书签选择
- 复制/下载/生成链接

## 依赖

- `qrcode` - 二维码生成
- `lz-string` - 数据压缩
- Canvas API - 海报绘制
- Clipboard API - 剪贴板操作
- Chrome Bookmarks API - 书签导入

## 使用示例

```typescript
import { shareService } from '@/application/share/share-service'
import { posterService } from '@/application/share/poster-service'

// 1. 编码书签数据
const bookmarks = [{ title: 'Example', url: 'https://example.com' }]
const encoded = shareService.encodeShareData(bookmarks)

// 2. 生成分享 URL
const shareUrl = shareService.generateShareUrl(encoded)

// 3. 生成海报
const posterDataUrl = await posterService.generatePoster({
  bookmarks,
  theme: 'dark',
  shareUrl
})

// 4. 复制图片
await shareService.copyImageToClipboard(posterDataUrl)
```
