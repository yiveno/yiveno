# 📖 Yiveno

> 🎯 那个找东西的 · Chrome 扩展 Monorepo（Capture + Recall 邻域）

[![Bun](https://img.shields.io/badge/Bun-1.2.21-black?logo=bun)](https://bun.sh)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Worker-f38020?logo=cloudflare)](https://workers.cloudflare.com)

Yiveno：**那个找东西的**（Capture 低负担 + Recall 高置信邻域；Top1=建议）。基于 Vue 3 + TypeScript + Cloudflare Worker 的 Monorepo。产品规格以 [`docs/product/Yiveno-产品文档-v4.0.md`](docs/product/Yiveno-产品文档-v4.0.md) 为准。

---

## ✨ 特性

- 🧠 **模糊寻回（Recall）** - 凭一点印象找回曾经保存的内容
- 🔍 **本地筛选（Filter）** - 从 IndexedDB 已有集合中快速过滤
- 💾 **离线优先** - IndexedDB 本地存储，支持离线访问
- 🎨 **现代化 UI** - Vue 3 Composition API
- 🔄 **书签同步** - Chrome 书签 API 实时同步（内容来源之一）
- ⚡ **极速构建** - Bun + Vite 驱动的开发体验
- 🏗️ **分层架构** - DDD 领域驱动设计（v4 重建中）

---

## 🚀 快速开始

### 前置要求

- **Bun** >= 1.0.0 ([安装指南](https://bun.sh))
- **Chrome** / **Edge** 浏览器 (Manifest V3支持)

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/yiveno/yiveno.git
cd Yiveno

# 安装所有依赖 (使用Bun Workspaces)
bun install
```

### 开发模式

```bash
# 启动所有服务 (插件前端构建 + 后端 + 官网)
bun run watch                 # mprocs TUI：上下键切换 fe/be/web（需本机安装 mprocs）
bun run dev                   # 同 watch
bun run watch:stream          # concurrently 混流日志（无 TUI 时用）

# 或者单独启动
bun run dev:be              # 后端 (Cloudflare Worker - 端口 8787)
bun run dev:web             # 官网 (Astro - 端口 3001)
bun run watch:fe            # 扩展 vite build --watch（改完后 chrome://extensions 刷新）
bun run dev:fe              # 扩展 Vite 开发服务器（页面级调试；MV3 仍以 dist watch 为准）
```

本机安装 mprocs（任选其一）：

```bash
brew install mprocs
# 或：https://github.com/pvolok/mprocs/releases （darwin-aarch64 等）
```

> **扩展热更新**：`watch:fe` / `watch` 的 fe 进程是 `vite build --watch`，不是浏览器 HMR。每次日志出现「dist 已更新」后，到 `chrome://extensions` 点本扩展的刷新按钮再验。

### 环境变量

只维护 3 个源文件：

- `.env.shared.local`
- `.env.development.local`
- `.env.production.local`

生成产物不手改：

- `.env.runtime/.env.development`
- `.env.runtime/.env.production`
- `backend/.dev.vars`
- `website/.env`

常用命令：

```bash
bun run env:sync:dev
bun run env:check:dev
bun run env:sync:prod
bun run env:check:prod
```

规则：

- 第三方共享值放 `.env.shared.local`
- `localhost` 只允许出现在 development
- 正式域名只允许出现在 production

详见：`docs/ENVIRONMENT.md`

### 构建扩展

```bash
# 生产构建 (全 workspace)
bun run build:prod

# 仅构建扩展
bun run build:fe:prod

# 构建产物位置: ./dist/（扩展）
# 官网产物: ./website/dist/
```

### 加载扩展到Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目中的 `dist/` 目录

---

## 📂 项目结构

```
Yiveno/                             # Monorepo 根目录
├── frontend/                       # Chrome 扩展 (Vue 3 + Vite)
│   ├── src/
│   │   ├── background/            # Service Worker 入口
│   │   ├── core/                  # 领域模型
│   │   ├── infrastructure/        # IndexedDB、事件总线、日志等
│   │   ├── offscreen/             # Offscreen Document
│   │   ├── pages/                 # popup / settings 页面
│   │   └── styles/
│   ├── public/                    # manifest、静态资源
│   ├── vite/                      # 构建配置
│   ├── scripts/                   # workspace 级脚本
│   └── package.json
│
├── backend/                        # Cloudflare Worker API
│   ├── src/
│   │   ├── handlers/              # 请求处理器
│   │   ├── routes/                # HTTP 路由
│   │   ├── services/              # 业务服务
│   │   ├── middleware/          # 中间件
│   │   └── data-access/           # Supabase 数据访问
│   ├── wrangler.toml
│   └── package.json
│
├── website/                        # Astro 营销站
│   ├── src/
│   └── package.json
│
├── packages/                       # 共享包
│   ├── auth-core/                 # 认证核心逻辑
│   ├── design-tokens/             # 设计令牌
│   └── types/                     # 跨 workspace 类型 (@yiveno/types)
│
├── scripts/                        # 跨 workspace 脚本
│   ├── dev-env.mjs                # 环境变量同步/校验
│   ├── e2e-management.mjs         # E2E 测试
│   └── knip-runner.mjs            # Dead code 检测
│
├── docs/                           # 项目文档
│   └── product/                   # 产品文档（v4.0 为唯一正文）
│
├── supabase/                       # 数据库迁移 (Supabase CLI)
├── dist/                           # 扩展构建产物 (gitignore)
├── eslint.config.js                # 统一 ESLint 配置
├── tsconfig.base.json              # 共享 TypeScript 配置
├── knip.json                       # Dead code 检测配置
├── package.json                    # Workspaces 根配置
└── bun.lock                        # 依赖锁文件
```

### 架构分层 (Frontend)

目标架构基于 **DDD**，v4 baseline 正在重建各层，完整约定见 [产品文档 v4.0](docs/product/Yiveno-产品文档-v4.0.md)：

```
┌─────────────────────────────────────────┐
│       Presentation Layer (UI)           │  ← Vue 组件, Pinia Stores（重建中）
├─────────────────────────────────────────┤
│       Application Layer                 │  ← App Services（重建中）
├─────────────────────────────────────────┤
│       Core/Domain Layer                 │  ← 核心业务逻辑, 领域模型
├─────────────────────────────────────────┤
│       Infrastructure Layer              │  ← Chrome APIs, IndexedDB
└─────────────────────────────────────────┘
```

当前 baseline 已有 `core/`、`infrastructure/`、`pages/`；`presentation/` / `application/` 将随 v4 功能恢复逐步补齐。

---

## 🛠️ 技术栈

### Frontend (Chrome Extension)

| 类别           | 技术        | 版本   | 说明             |
| -------------- | ----------- | ------ | ---------------- |
| **框架**       | Vue 3       | 3.5.18 | Composition API  |
| **语言**       | TypeScript  | 5.8.3  | 严格模式         |
| **构建工具**   | Vite        | 8.0.x  | 扩展打包         |
| **校验**       | Zod         | 3.25.x | 领域/消息 schema |
| **Chrome API** | Manifest V3 | -      | 最新标准         |

### Backend (Cloudflare Worker)

| 类别       | 技术              | 版本   | 说明               |
| ---------- | ----------------- | ------ | ------------------ |
| **运行时** | Cloudflare Worker | -      | 全球边缘计算       |
| **语言**   | TypeScript (ESM)  | 5.8.x  | Bun + Wrangler     |
| **数据库** | Supabase          | 2.79.x | PostgreSQL + Auth  |
| **验证**   | Zod               | 3.25.x | 类型安全的数据验证 |

### Website (营销站)

| 类别     | 技术  | 版本   | 说明         |
| -------- | ----- | ------ | ------------ |
| **框架** | Astro | 5.18.x | 静态站点生成 |
| **UI**   | Vue 3 | 3.5.x  | 交互组件     |

### Monorepo工具链

| 类别          | 技术           | 版本   | 说明                     |
| ------------- | -------------- | ------ | ------------------------ |
| **包管理器**  | Bun Workspaces | 1.2.21 | 高性能依赖管理           |
| **代码检查**  | ESLint         | 9.35.0 | Flat Config + TypeScript |
| **样式检查**  | Stylelint      | 16.9.0 | CSS/SCSS/Vue             |
| **代码格式**  | Prettier       | -      | 统一格式化               |
| **Git Hooks** | Husky          | 9.0.11 | Pre-commit自动修复       |
| **提交规范**  | lint-staged    | 15.2.7 | 暂存文件检查             |

---

## 📜 可用脚本

### 根目录命令 (Monorepo)

```bash
# 🚀 开发
bun run watch                 # 扩展 watch + 后端 + 官网（mprocs 分栏）
bun run dev                   # 同 watch
bun run watch:stream          # 同上，concurrently 混流
bun run watch:fe              # 仅扩展 build --watch（重建后 chrome://extensions 刷新）
bun run dev:fe                # 仅扩展 Vite 开发服务器
bun run dev:be                # 仅后端 (Worker - 端口 8787)
bun run dev:web               # 仅官网 (Astro - 端口 3001)
# 🏗️ 构建
bun run build                 # 开发 profile 全量构建
bun run build:prod            # 生产 profile 全量构建
bun run build:fe              # 仅构建扩展 (development)
bun run build:fe:prod         # 仅构建扩展 (production)
bun run build:web:prod        # 仅构建官网 (production)

# 🧪 类型检查
bun run typecheck             # 全 workspace 类型检查
bun run typecheck:force       # 强制重建 TS 缓存后检查

# 🔍 代码质量
bun run lint:check            # ESLint + Stylelint 只读检查
bun run lint                  # 格式化 + ESLint + Stylelint 修复
bun run knip                  # Dead code 检测

# 🚀 部署
bun run deploy:be             # 部署后端到 Cloudflare
bun run deploy:web            # 构建官网

# 🧪 E2E 冒烟（popup + settings，需 Chrome 远程调试 + 已加载 dist/）
bun run e2e                   # CDP 薄冒烟：popup/settings + 固定线索→结果卡
# 🗄️ 数据库
bun run db:start              # 启动本地 Supabase
bun run db:reset              # 重置本地数据库

# 🧹 清理
bun run clean                 # 清理各 workspace 缓存
bun run clean:deps            # 清理所有依赖后重装
```

### Frontend独立命令

```bash
cd frontend

bun run dev                   # Vite 开发服务器
bun run build                 # 开发 profile 构建
bun run build:prod            # 生产 profile 构建
bun run build:watch           # Watch 模式构建
bun run typecheck             # TypeScript 类型检查
bun run lint:check            # ESLint + Stylelint 只读检查
bun run test                  # Vitest 单元测试
bun run clean                 # 清理 dist/
```

### Backend独立命令

```bash
cd backend

bun run dev                   # Wrangler 本地开发
bun run deploy                # 部署到 Cloudflare Worker
bun run test                  # Bun 单元测试
bun run db:start              # 启动本地 Supabase
bun run db:reset              # 重置本地数据库
```

---

## 📚 文档导航

### 📦 产品文档（唯一正文）

- [Yiveno 产品文档 v4.0](docs/product/Yiveno-产品文档-v4.0.md)
- [`docs/` 目录说明](docs/README.md)
- [环境变量方案](docs/ENVIRONMENT.md)

架构与分层约定以 **产品文档 v4.0** 为准；代码入口见各 workspace 的 `src/` 目录。

### 🏗️ 架构与工程

- 以 [产品文档 v4.0](docs/product/Yiveno-产品文档-v4.0.md) 为准；仓库内若仍有独立架构 `.md` 与正文冲突，以正文为准。
- Cursor 规则：`.cursor/rules/project.mdc`
- AI 协作：`AGENTS.md`

---

## 🔧 开发环境配置

### VS Code推荐插件

```json
{
  "recommendations": [
    "vue.volar", // Vue 3 语言支持
    "dbaeumer.vscode-eslint", // ESLint
    "stylelint.vscode-stylelint", // Stylelint
    "esbenp.prettier-vscode", // Prettier
    "oven.bun-vscode" // Bun支持
  ]
}
```

### 保存时自动修复

项目已配置 `.vscode/settings.json`，保存时自动运行：

- ✅ ESLint 自动修复
- ✅ Stylelint 自动修复
- ✅ Prettier 格式化

### Git Hooks (Husky)

提交前自动运行 (`.husky/pre-commit`):

1. ✅ Prettier 格式化
2. ✅ Stylelint 增强修复
3. ✅ ESLint 增强修复
4. ✅ TypeScript 类型检查 (仅暂存的TS/Vue文件)
5. ✅ 自动重新暂存修复后的文件

**注意**: 只有无法自动修复的问题才会阻止提交。

---

## 🧪 测试

### E2E 冒烟（v4）

```bash
# 前置：Chrome 开启远程调试，加载 dist/ 后执行
bun run e2e
```

打开 `popup.html` / `settings.html`，再 seed 一条摘录、发固定线索并断言出现结果卡；截图到 `artifacts/`。详见 `scripts/e2e-management.mjs` 与产品文档 §1.1（不上大 Playwright）。

环境变量快照（v3 `management.html` 桥接）已下线；请用 `.env.*.local` + `bun run env:sync:dev`。

### Lighthouse CI

v4 baseline 暂缺 `lighthouserc.json`；Lighthouse workflow 与相关汇总脚本已移除。恢复审计前需补配置再接线。

---

## 📊 性能优化

### Frontend 优化

- ✅ **IndexedDB 缓存** - 本地持久化存储
- ✅ **Tree Shaking** - Vite 自动移除未使用代码
- ✅ **代码分割** - 按入口异步加载 (popup, settings, background)
- ✅ **CSS 优化** - Stylelint 自动排序属性

### Backend 优化

- ✅ **边缘计算** - Cloudflare Worker全球部署，低延迟
- ✅ **无服务器** - 按需执行，零冷启动
- ✅ **Bun运行时** - 高性能JavaScript执行

---

## 🚀 部署

### Frontend (Chrome扩展)

```bash
# 1. 生产构建
bun run build:fe:prod

# 2. 打包扩展 (手动)
cd dist
zip -r ../yiveno-v1.0.0.zip .

# 3. 上传到 Chrome Web Store
# https://chrome.google.com/webstore/devconsole
```

### Backend (Cloudflare Worker)

```bash
# 1. 配置 Wrangler (首次)
cd backend
bunx wrangler login

# 2. 部署到生产环境
bun run deploy

# 3. 查看部署状态
bunx wrangler deployments list
```

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 提交PR前

1. ✅ 确保测试通过: `bun run test:fe && bun run test:be`
2. ✅ 确保代码检查通过: `bun run lint:check`
3. ✅ 确保类型检查通过: `bun run typecheck:force`
4. ✅ 确保构建成功: `bun run build:prod`

### 提交消息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式；**说明正文必须中文**（类型前缀可用英文）：

```
feat: 添加书签导出功能
fix: 修复筛选结果排序问题
docs: 更新 README 文档
style: 优化管理页 UI 样式
refactor: 重构书签服务层
perf: 优化虚拟滚动性能
test: 添加书签树单元测试
chore: 升级依赖版本
```

### 代码规范

- ✅ 使用 **TypeScript** (不要使用 `any`)
- ✅ 遵循 **ESLint** 和 **Stylelint** 规则
- ✅ 使用 **Prettier** 格式化代码
- ✅ 编写清晰的注释 (复杂逻辑必须注释)
- ✅ 遵循 **DDD分层架构** (Frontend)

---

## 📄 许可证

[MIT License](LICENSE) © 2025 Yiveno Team

---

## 🙏 致谢

- [Vue.js](https://vuejs.org) - 渐进式JavaScript框架
- [Vite](https://vitejs.dev) - 下一代前端构建工具
- [Bun](https://bun.sh) - 高性能JavaScript运行时
- [Cloudflare Workers](https://workers.cloudflare.com) - 边缘计算平台

---

## 📞 联系我们

- **Issues**: [GitHub Issues](https://github.com/yiveno/yiveno/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yiveno/yiveno/discussions)
- **Email**: support@yiveno.com

---

<p align="center">
  Made with ❤️ by Yiveno Team
</p>
