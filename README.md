# 📖 otterSage

> 🎯 智能书签管理 Chrome 扩展 - 高性能 Monorepo 项目

[![Bun](https://img.shields.io/badge/Bun-1.2.21-black?logo=bun)](https://bun.sh)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Worker-f38020?logo=cloudflare)](https://workers.cloudflare.com)

一款智能的Chrome书签管理扩展，基于Vue 3 + TypeScript + Cloudflare Worker构建，采用现代化Monorepo架构。

---

## ✨ 特性

- 🚀 **高性能搜索** - 基于Fuse.js的模糊搜索 + 混合搜索引擎
- 🎯 **智能推荐** - AI驱动的书签推荐系统
- 💾 **离线优先** - IndexedDB本地存储，支持离线访问
- 🎨 **现代化UI** - Vue 3 Composition API + 虚拟滚动优化
- 🔄 **实时同步** - Chrome书签API实时同步
- 🌐 **多语言支持** - 中文、英文、日文、韩文等
- ⚡ **极速构建** - Bun + Vite驱动的开发体验
- 🏗️ **分层架构** - DDD领域驱动设计 (Application/Core/Infrastructure)

---

## 🚀 快速开始

### 前置要求

- **Bun** >= 1.0.0 ([安装指南](https://bun.sh))
- **Chrome** / **Edge** 浏览器 (Manifest V3支持)

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/ChenQiWen/otterSage.git
cd otterSage

# 安装所有依赖 (使用Bun Workspaces)
bun install
```

### 开发模式

```bash
# 启动所有服务 (插件前端构建 + 后端 + 官网) - 推荐
bun run watch

# 或者单独启动
bun run dev:backend           # 后端 (Cloudflare Worker - 端口8787)
bun run dev:website           # 官网 (Nuxt - 端口3000)
```

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
# 生产构建 (优化模式)
bun run build:all

# 构建产物位置: ./dist/
```

### 加载扩展到Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目中的 `dist/` 目录

---

## 📂 项目结构

```
otterSage/                    # Monorepo根目录
├── frontend/                       # 🎨 Frontend Workspace (Vue 3 Chrome Extension)
│   ├── src/
│   │   ├── application/           # 应用层 (App Services)
│   │   ├── core/                  # 核心层 (Domain Logic)
│   │   ├── infrastructure/        # 基础设施层 (APIs, Storage)
│   │   ├── components/            # Vue 组件
│   │   ├── stores/                # Pinia 状态管理
│   │   ├── services/              # 业务服务
│   │   └── types/                 # TypeScript 类型定义
│   ├── public/                    # 静态资源 (icons, manifest.json)
│   ├── scripts/                   # 构建脚本
│   ├── package.json               # Frontend 依赖
│   ├── vite.config.ts             # Vite 配置
│   └── tsconfig*.json             # TypeScript 配置
│
├── backend/                        # ⚡ Backend Workspace (Cloudflare Worker)
│   ├── ai/                        # AI 功能模块
│   ├── utils/                     # 工具函数
│   ├── cloudflare-worker.js       # Worker 入口
│   ├── wrangler.toml              # Cloudflare 配置
│   └── package.json               # Backend 依赖
│
├── scripts/                        # 🛠️ 根目录脚本
│   ├── e2e-management.mjs         # E2E 测试脚本
│   ├── dev-setup.sh               # 开发环境设置
│   └── ...
│
├── docs/                           # 📚 项目文档
│   ├── product/                    # 产品文档（唯一正文见该目录下 v3.0）
│   └── AUTH_GUIDE.md               # OAuth 接入说明
│
├── .husky/                         # 🐕 Git Hooks
├── .vscode/                        # VS Code 配置
├── eslint.config.js                # 统一 ESLint 配置 (Flat Config)
├── tsconfig.json                   # 根 TypeScript 配置 (Project References)
├── package.json                    # 根依赖管理 + Workspaces定义
├── bun.lock                        # 依赖锁文件 (Bun)
└── README.md                       # 本文件
```

### 架构分层 (Frontend)

基于 **DDD (Domain-Driven Design)** 的分层架构：

```
┌─────────────────────────────────────────┐
│       Presentation Layer (UI)           │  ← Vue组件, Pinia Stores
├─────────────────────────────────────────┤
│       Application Layer                 │  ← App Services (业务编排)
├─────────────────────────────────────────┤
│       Core/Domain Layer                 │  ← 核心业务逻辑, 领域模型
├─────────────────────────────────────────┤
│       Infrastructure Layer              │  ← Chrome APIs, HTTP, IndexedDB
└─────────────────────────────────────────┘
```

详见: [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md)

---

## 🛠️ 技术栈

### Frontend (Chrome Extension)

| 类别           | 技术                  | 版本    | 说明                               |
| -------------- | --------------------- | ------- | ---------------------------------- |
| **框架**       | Vue 3                 | 3.5.18  | Composition API + `<script setup>` |
| **语言**       | TypeScript            | 5.8.3   | 严格模式 + Project References      |
| **状态管理**   | Pinia                 | 3.0.3   | Vue官方推荐                        |
| **构建工具**   | Vite                  | 8.0.0   | 极速HMR + Rolldown打包（Rust）     |
| **搜索引擎**   | Fuse.js               | 6.6.2   | 模糊搜索                           |
| **虚拟滚动**   | @tanstack/vue-virtual | 3.13.12 | 大数据列表优化                     |
| **Chrome API** | Manifest V3           | -       | 最新标准                           |

### Backend (API Server)

| 类别       | 技术              | 版本   | 说明               |
| ---------- | ----------------- | ------ | ------------------ |
| **运行时** | Cloudflare Worker | -      | 全球边缘计算       |
| **语言**   | JavaScript (ESM)  | ES2022 | Bun优化            |
| **验证**   | Zod               | 3.22.4 | 类型安全的数据验证 |
| **UUID**   | uuid              | 11.1.0 | 唯一标识符生成     |

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
bun run watch                 # 启动所有服务 (插件前端构建 + 后端 + 官网)
bun run dev:backend           # 仅启动后端 (Worker - https://localhost:8787)
bun run dev:website           # 仅启动官网 (Nuxt - http://localhost:3000)

# 🏗️ 构建
bun run build:frontend        # 构建前端 (类型检查 + 打包)
bun run build:all             # 构建所有 workspace

# 🧪 类型检查
bun run typecheck             # 所有项目的 TypeScript 类型检查

# 🔍 代码质量
bun run lint                  # 智能代码检查 (ESLint)
bun run format                # 格式化所有代码 (Prettier)
bun run stylelint             # 检查样式 (Stylelint)
bun run stylelint:fix         # 自动修复样式问题

# 🚀 部署
bun run deploy:backend        # 部署后端到 Cloudflare

# 📊 审计
bun run audit:frontend        # Lighthouse CI 性能审计 (插件)
bun run audit:website         # Lighthouse CI 性能审计 (官网)
bun run e2e                   # E2E 测试

# 🧹 清理
bun run clean                 # 清理构建缓存
bun run clean:deps            # 清理所有依赖 (重新安装)
```

### Frontend独立命令

```bash
cd frontend

bun run dev                   # 启动开发服务器
bun run build                 # 生产构建 (类型检查 + 打包 + 清理)
bun run build:hot             # 热重载构建 (自动重新打包)
bun run type-check            # TypeScript 类型检查
bun run lint                  # ESLint 检查
bun run lint:fix              # ESLint 自动修复
bun run stylelint             # Stylelint 检查
bun run stylelint:fix         # Stylelint 自动修复
```

### Backend独立命令

```bash
cd backend

bun run dev                   # 启动 Wrangler 开发服务器
bun run deploy                # 部署到 Cloudflare Worker
bun run lint                  # ESLint 检查
bun run lint:fix              # ESLint 自动修复
```

---

## 📚 文档导航

### 📦 产品文档（唯一正文）

- [otterSage 完整产品文档 v3.0](docs/product/otterSage-产品文档-v3.0.md)
- [`docs/` 目录说明](docs/README.md)
- [环境变量方案](docs/ENVIRONMENT.md)
- 架构与分层约定以 **产品文档** 为准；代码入口见 `frontend/src/` 各层目录。

### 🏗️ 架构与工程

- 以 [产品文档 v3.0 — 第二部分](docs/product/otterSage-产品文档-v3.0.md#第二部分技术架构) 为准；仓库内若仍有独立架构 `.md` 与正文冲突，以正文为准。

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

### E2E测试

```bash
# 管理页测试
bun run e2e:management --ext $EXT_ID

# 性能测试 (CPU节流 + 网络限速)
bun run e2e:management:perf --ext $EXT_ID

# 完整测试 (功能 + 性能)
bun run e2e:management:all --ext $EXT_ID
```

详见根目录 `package.json` 中的 `e2e` / `e2e:perf` 脚本及 `scripts/e2e-management.mjs`。

### Lighthouse CI

```bash
# 完整审计 (构建 + Lighthouse)
bun run audit:lhci

# 快速审计 (跳过类型检查)
bun run audit:lhci:fast

# 只收集数据
bun run audit:lhci:collect

# 只断言检查
bun run audit:lhci:assert
```

---

## 📊 性能优化

### Frontend优化

- ✅ **虚拟滚动** - `@tanstack/vue-virtual` 处理大量书签
- ✅ **IndexedDB缓存** - 本地持久化存储，减少API调用
- ✅ **智能字体加载** - 根据UI语言动态加载Google Fonts
- ✅ **Tree Shaking** - Vite自动移除未使用代码
- ✅ **代码分割** - 按页面异步加载 (popup, side-panel, management)
- ✅ **CSS优化** - Stylelint自动排序属性，减小体积

### Backend优化

- ✅ **边缘计算** - Cloudflare Worker全球部署，低延迟
- ✅ **无服务器** - 按需执行，零冷启动
- ✅ **Bun运行时** - 高性能JavaScript执行

---

## 🚀 部署

### Frontend (Chrome扩展)

```bash
# 1. 生产构建
bun run build:all

# 2. 打包扩展 (手动或使用脚本)
cd dist
zip -r ../ottersage-v1.0.0.zip .

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

1. ✅ 确保所有测试通过: `bun run test`
2. ✅ 确保代码检查通过: `bun run lint:check`
3. ✅ 确保类型检查通过: `bun run typecheck`
4. ✅ 确保构建成功: `bun run build:all`

### 提交消息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 添加书签导出功能
fix: 修复搜索结果排序问题
docs: 更新README文档
style: 优化管理页UI样式
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

[MIT License](LICENSE) © 2025 otterSage Team

---

## 🙏 致谢

- [Vue.js](https://vuejs.org) - 渐进式JavaScript框架
- [Vite](https://vitejs.dev) - 下一代前端构建工具
- [Bun](https://bun.sh) - 高性能JavaScript运行时
- [Cloudflare Workers](https://workers.cloudflare.com) - 边缘计算平台
- [Fuse.js](https://fusejs.io) - 轻量级模糊搜索库

---

## 📞 联系我们

- **Issues**: [GitHub Issues](https://github.com/ChenQiWen/otterSage/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ChenQiWen/otterSage/discussions)
- **Email**: support@ottersage.com

---

<p align="center">
  Made with ❤️ by otterSage Team
</p>
