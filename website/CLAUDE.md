---
description: Yiveno 官网（Astro + Vue islands）开发约定
globs: 'website/**/*.{astro,vue,ts,mjs,json}'
alwaysApply: false
---

# website/

- **框架**：Astro 5 + `@astrojs/vue`；构建产物在 `website/dist/`
- **包管理 / 脚本**：Bun；根目录 `bun run dev:web` / `bun run build:web:prod`
- **环境变量**：只改根目录 `.env.*.local`，通过 `scripts/dev-env.mjs` 同步到 `website/.env`
- **设计令牌**：`@yiveno/design-tokens` — 权威 `css/brand.css`；扩展另加 `md-sys-brand-alias` / `variables` / `semantic-colors`
- **规格**：`docs/product/Yiveno-产品文档-v4.0.md`
