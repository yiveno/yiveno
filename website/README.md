# otterSage 官网

基于 Nuxt.js 构建的 otterSage 官方网站，支持 SEO 优化和服务器端交互。

> 📦 本项目是 otterSage Monorepo 的一部分，位于 `website/` 目录。

## 🚀 技术栈

- **框架**: Nuxt.js 4
- **语言**: TypeScript
- **SEO**: @nuxtjs/seo
- **包管理**: Bun

## 📦 功能特性

- ✅ SEO 优化（自动生成 sitemap、robots.txt）
- ✅ 服务器端渲染（SSR）
- ✅ Server Routes（API 路由）
- ✅ 响应式设计
- ✅ 联系表单
- ✅ 新功能预约
- ✅ **安全防护**：Rate Limiting + Honeypot

## 🔒 安全防护

### 当前实现（推荐）

1. **Rate Limiting（速率限制）**
   - 每个 IP 5 分钟内最多 3 次提交
   - 防止暴力提交和垃圾邮件
   - 不影响正常用户体验

2. **Honeypot（蜜罐）**
   - 隐藏字段检测机器人
   - 完全不影响用户体验
   - 静默拒绝机器人提交

### 可选增强（如遇大量攻击）

如果需要更强的防护，可以添加：

- **reCAPTCHA v3**：无感验证，用户体验好
- **邮箱验证**：提交后发送验证邮件

## 🛠️ 开发

```bash
# 在 monorepo 根目录
bun run dev:website

# 或直接在 website 目录
cd website
bun run dev
```

## 📁 项目结构

```
├── pages/              # 页面路由
│   ├── index.vue      # 首页
│   ├── features.vue   # 功能页面
│   ├── pricing.vue    # 定价页面
│   ├── about.vue      # 关于页面
│   ├── contact.vue    # 联系页面
│   ├── download.vue   # 下载页面
│   └── feature-request.vue  # 功能预约页面
├── layouts/           # 布局组件
│   └── default.vue   # 默认布局
├── components/        # 可复用组件
│   ├── FeatureCard.vue
│   └── ContactForm.vue
├── composables/       # 组合式函数
│   └── useFeatureRequest.ts
├── server/            # 服务器端代码
│   ├── api/          # API 路由
│   │   ├── contact.post.ts
│   │   └── feature-request.post.ts
│   └── utils/        # 工具函数
│       ├── rateLimiter.ts  # Rate Limiting
│       ├── honeypot.ts     # Honeypot 检测
│       └── recaptcha.ts    # reCAPTCHA（可选）
└── public/           # 静态资源
```

## 🌐 API 路由

### POST /api/contact

联系表单提交接口（已启用 Rate Limiting + Honeypot 防护）。

**请求体**:

```json
{
  "name": "用户名",
  "email": "user@example.com",
  "message": "消息内容"
}
```

**响应**:

```json
{
  "success": true,
  "message": "感谢您的联系，我们会尽快回复您！"
}
```

**错误响应**:

- `429`: 请求过于频繁
- `400`: 参数错误

### POST /api/feature-request

新功能预约接口（已启用 Rate Limiting + Honeypot 防护）。

**请求体**:

```json
{
  "email": "user@example.com",
  "feature": "功能名称",
  "description": "功能描述（可选）"
}
```

## 🚀 部署

### Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

### Netlify

```bash
# 安装 Netlify CLI
npm i -g netlify-cli

# 部署
netlify deploy --prod
```

### 静态部署

```bash
# 生成静态站点
bun run build:website:generate

# 部署 .output/public/ 目录到任何静态托管服务
```

## 📝 TODO

- [x] Rate Limiting 防护
- [x] Honeypot 防护
- [ ] 集成邮件服务（SendGrid/Brevo）
- [ ] 集成数据库（Supabase）存储表单数据
- [ ] 添加博客功能
- [ ] 添加多语言支持
- [ ] 添加 Google Analytics
- [ ] 优化 SEO（结构化数据）
- [ ] 可选：reCAPTCHA v3（如遇大量攻击）

## 📄 License

MIT
