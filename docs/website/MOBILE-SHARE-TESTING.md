# 手机扫码测试分享功能指南

## 问题说明

手机扫码后显示"网页无法打开"错误（`net::ERR_HTTP_RESPONSE_CODE_FAILURE`），原因是：

1. 二维码中的链接是 `https://acuitybookmarks.com/share?data=...`
2. 该域名还未部署到生产环境
3. 手机访问时服务器无响应

## 解决方案

### 方案 1：使用本地 IP 测试（推荐用于开发）

#### 步骤 1：获取本地 IP 地址

**macOS/Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# 或者
ipconfig getifaddr en0
```

**Windows:**

```bash
ipconfig | findstr IPv4
```

示例输出：`192.168.1.100`

#### 步骤 2：配置扩展环境变量

1. 在 `frontend/` 目录下创建 `.env.development.local` 文件：

```bash
cd frontend
cp .env.development.local.example .env.development.local
```

2. 编辑 `.env.development.local`，填入你的本地 IP：

```env
VITE_SHARE_BASE_URL=http://192.168.1.100:3001/share
```

**注意：** 将 `192.168.1.100` 替换为你实际的本地 IP 地址

#### 步骤 3：启动官网开发服务器

```bash
cd website
bun run dev
```

确认服务器运行在 `http://localhost:3001`

#### 步骤 4：重新构建扩展

```bash
cd frontend
bun run build
```

或者使用热构建：

```bash
bun run build:watch
```

#### 步骤 5：测试分享功能

1. 打开扩展管理页面（Alt+B）
2. 选择几个书签
3. 点击"分享"按钮
4. 点击"下载图片"，保存海报
5. 用手机扫描海报上的二维码

**预期结果：**

- 手机浏览器打开 `http://192.168.1.100:3001/share?data=...`
- 显示书签列表
- 可以点击书签访问链接

### 方案 2：部署官网到生产环境（用于正式发布）

#### 步骤 1：部署官网

将官网部署到 `https://acuitybookmarks.com`，可以使用：

- **Vercel**（推荐）
- **Netlify**
- **Cloudflare Pages**
- 自己的服务器

#### 步骤 2：配置域名和 HTTPS

1. 购买域名 `acuitybookmarks.com`
2. 配置 DNS 解析到部署平台
3. 启用 HTTPS（部署平台通常自动配置）

#### 步骤 3：更新扩展配置

确保 `frontend/src/application/share/share-service.ts` 中的生产环境 URL 正确：

```typescript
if (import.meta.env.PROD) {
  return 'https://acuitybookmarks.com/share'
}
```

#### 步骤 4：发布扩展

```bash
cd frontend
bun run build
```

将 `dist/` 目录打包上传到 Chrome Web Store

## 常见问题

### Q1: 手机和电脑不在同一局域网怎么办？

**A:** 使用方案 2，部署官网到生产环境。或者使用内网穿透工具（如 ngrok）：

```bash
# 安装 ngrok
brew install ngrok  # macOS
# 或从 https://ngrok.com 下载

# 启动内网穿透
ngrok http 3001

# 将生成的 https://xxx.ngrok.io 地址配置到 VITE_SHARE_BASE_URL
```

### Q2: 为什么不能直接用 localhost？

**A:** 手机无法访问电脑的 `localhost`，必须使用局域网 IP 地址或公网域名。

### Q3: 二维码生成后，修改配置需要重新生成吗？

**A:** 是的。修改 `VITE_SHARE_BASE_URL` 后需要：

1. 重新构建扩展（`bun run build`）
2. 重新生成分享海报
3. 用新的二维码测试

### Q4: 生产环境部署后，开发环境还能用吗？

**A:** 可以。开发环境使用 `.env.development.local` 配置，生产环境使用硬编码的域名，互不影响。

## 验证清单

- [ ] 获取本地 IP 地址
- [ ] 创建 `.env.development.local` 文件
- [ ] 配置 `VITE_SHARE_BASE_URL`
- [ ] 启动官网开发服务器（`bun run dev`）
- [ ] 重新构建扩展（`bun run build`）
- [ ] 生成分享海报
- [ ] 手机扫码测试
- [ ] 确认手机能打开分享页面
- [ ] 确认书签列表正确显示

## 技术细节

### 环境变量优先级

```typescript
// 生产环境
if (import.meta.env.PROD) {
  return 'https://acuitybookmarks.com/share' // 硬编码
}

// 开发环境
return (
  import.meta.env.VITE_SHARE_BASE_URL || // 环境变量
  'http://localhost:3001/share'
) // 默认值
```

### 二维码生成流程

```
1. 用户点击"分享"
2. ShareService.encodeShareData() 编码书签数据
3. ShareService.generateShareUrl() 生成完整 URL
4. PosterService.generateQRCode() 生成二维码
5. 二维码包含完整的分享链接
```

### 数据流

```
扩展端:
书签数据 → JSON → LZ-String 压缩 → Base64 编码 → URL 参数

官网端:
URL 参数 → Base64 解码 → LZ-String 解压 → JSON 解析 → 书签数据
```

---

**最后更新**: 2025-01-13  
**相关文档**:

- [分享功能测试指南](./TESTING-SHARE-FEATURE.md)
- [移动端测试指南](./MOBILE-TESTING.md)
