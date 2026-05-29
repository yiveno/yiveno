# 书签分享功能 - 落地页

## 功能概述

分享落地页（`/share`）用于展示通过分享链接传递的书签数据。用户可以：

1. 查看分享的书签列表
2. 如果已安装扩展，可以选择性导入书签
3. 如果未安装扩展，会显示安装引导

## 技术实现

### 数据流程

```
分享链接 (URL + data 参数)
  ↓
Base64 解码
  ↓
LZ-String 解压缩
  ↓
JSON 解析
  ↓
ShareData 对象
  ↓
渲染书签列表
```

### 文件结构

```
website/
├── pages/
│   └── share.vue              # 分享落地页
├── utils/
│   ├── share-service.ts       # 分享数据解码服务
│   └── test-share-link.ts     # 测试链接生成工具
└── SHARE-FEATURE.md           # 本文档
```

## 开发测试

### 1. 启动开发服务器

```bash
cd website
bun run dev
```

### 2. 生成测试链接

在浏览器控制台运行：

```javascript
// 导入测试工具
import { generateTestShareLink } from '@/utils/test-share-link'

// 生成测试链接
const testLink = generateTestShareLink()
console.log('测试链接:', testLink)

// 或者直接访问
window.location.href = testLink
```

### 3. 手动构造测试链接

访问以下 URL（已包含测试数据）：

```
http://localhost:3000/share?data=<encoded_data>
```

## 使用示例

### 从扩展生成分享链接

在 Chrome 扩展中：

1. 选择要分享的书签
2. 点击"分享"按钮
3. 选择"生成链接"
4. 链接会自动复制到剪贴板

### 打开分享链接

1. 将分享链接发送给朋友
2. 朋友在浏览器中打开链接
3. 如果已安装扩展：
   - 可以选择要导入的书签
   - 点击"导入选中"按钮
4. 如果未安装扩展：
   - 显示安装引导
   - 可以查看书签列表
   - 点击书签可以在新标签页打开

## 待实现功能

### 任务 8.2 - 扩展检测逻辑

- [ ] 检测是否安装 AcuityBookmarks 扩展
- [ ] 显示安装引导（未安装时）
- [ ] 显示导入界面（已安装时）

### 任务 8.3 - 书签选择功能

- [x] 实现复选框选择
- [x] 实现全选/取消全选
- [x] 实现选中计数显示
- [x] 实现导入按钮状态控制

### 任务 8.5 - 文件夹选择功能

- [ ] 调用 Chrome API 获取文件夹树
- [ ] 显示文件夹选择下拉框
- [ ] 实现默认文件夹逻辑（书签栏）

## 数据格式

### ShareData 接口

```typescript
interface ShareData {
  bookmarks: Array<{
    title: string
    url: string
    description?: string
  }>
  title: string
  timestamp: number
  version: string
}
```

### URL 参数格式

```
/share?data=<Base64(LZ-String(JSON(ShareData)))>
```

## 注意事项

1. **数据大小限制**：URL 长度限制约 2000 字符，建议分享的书签数量不超过 20 个
2. **浏览器兼容性**：需要支持 Base64 和 LZ-String 的浏览器
3. **安全性**：分享链接中的数据是公开的，不要包含敏感信息
4. **SEO**：分享页面设置了 `noindex, nofollow`，不会被搜索引擎索引

## 相关文档

- [分享功能设计文档](../../.kiro/specs/bookmark-sharing/design.md)
- [分享功能需求文档](../../.kiro/specs/bookmark-sharing/requirements.md)
- [任务列表](../../.kiro/specs/bookmark-sharing/tasks.md)
