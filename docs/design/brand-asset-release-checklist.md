# 品牌资产发版 Checklist

> **用途：** 品牌视觉变更时，从**仓内母本**同步到扩展/官网运行时，再验证构建与对外触点。  
> **权威母本：** [`brand-assets/`](./brand-assets/README.md)（`docs/design/brand-assets/`）  
> **治理 Issue：** [yiveno/yiveno#30](https://github.com/yiveno/yiveno/issues/30)  
> **视觉规范：** [`Yiveno-设计标准-v1.md`](./Yiveno-设计标准-v1.md)

---

## 1. 权威链（谁说了算）

```
Yiveno-设计标准-v1.md + packages/design-tokens
  → docs/design/brand-assets/     ← 仓内母本（改这里）
  → extension/public/images/       ← 扩展运行时
  → website/public/               ← 官网运行时
  → Chrome Web Store 上传         ← chrome-web-store/ 母本
```

| 目录                                   | 角色                             | 发版时                                          |
| -------------------------------------- | -------------------------------- | ----------------------------------------------- |
| `docs/design/brand-assets/`            | **唯一手写母本**                 | ✅ 先改                                         |
| `extension/public/`、`website/public/` | 运行时                           | ⚙️ 脚本或按表复制，禁止只在运行时手改不同步母本 |
| `docs/archive/research/`               | 市场研究 Non-normative（已归档） | ❌ 与品牌发版无关                               |

---

## 2. 自动同步（推荐）

母本改完后：

```bash
bun run sync:brand-assets        # 母本 → extension/public + website/public
cd extension && bun run build     # 或 bun run build:extension
cd website && bun run build:dev  # 官网抽检
```

仅校验是否已同步（不改文件）：

```bash
bun run sync:brand-assets --check
```

---

## 3. 手动映射表（脚本未覆盖时）

| 母本 `brand-assets/`                   | 运行时目标                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `chrome-extension/icon-16.png`         | `extension/public/images/icon16.png`                                                           |
| `chrome-extension/icon-32.png`         | `extension/public/images/icon32.png`                                                           |
| `chrome-extension/icon-48.png`         | `extension/public/images/icon48.png`                                                           |
| `chrome-extension/icon-128.png`        | `extension/public/images/icon128.png`                                                          |
| `logo/yiveno-primary.svg`              | `extension/public/images/logo-mark.svg`、`website/public/images/logo-mark.svg`                 |
| `logo/logo-on-light.svg`               | `extension/public/images/logo-mark-mono-light.svg`                                             |
| `logo/logo-on-dark.svg`                | `extension/public/images/logo-mark-on-dark.svg`、`website/public/images/logo-mark-on-dark.svg` |
| `chrome-extension/favicon.ico`         | `website/public/favicon.ico`                                                                   |
| `applications/yiveno-product-hero.jpg` | `website/public/og-image.jpg`                                                                  |
| `chrome-web-store/*`                   | Chrome Web Store 开发者后台上传（不进扩展包）                                                  |

**扩展 manifest：** `extension/public/manifest.json` → `icons` 指向 `images/icon16.png` 等（无连字符命名）。

**官网 OG：** 确认 `website` 布局引用 `/og-image.jpg`；社交预览以 1200×630 为准（见 `Yiveno-logo-asset-generation-prompt.md`）。

---

## 4. 发版前验收

### 4.1 构建

- [ ] `cd extension && bun run build` 成功
- [ ] `dist/manifest.json` 中 `icons` 路径存在
- [ ] `cd website && bun run build:dev`（或 `build:prod`）成功

### 4.2 扩展（MCP / 真机）

- [ ] `chrome://extensions` 重新加载
- [ ] Side Panel 顶栏 logo 正常（浅/深主题若有 mono 变体一并看）
- [ ] 工具栏 icon 清晰（16/32）

### 4.3 官网

- [ ] 首页 / Login / Pricing logo 与 favicon
- [ ] `og-image.jpg` 可被分享调试器读取（比例、品牌色）

### 4.4 Chrome Web Store（发商店版本时）

- [ ] 对照 [Chrome Web Store 当前尺寸要求](https://developer.chrome.com/docs/webstore/images)（以平台上架页为准）
- [ ] 母本 `chrome-web-store/` 与实际上传文件一致
- [ ] 商店文案：**仅美式英语**；禁止 AI/神谕式卖点（产品文档 §0）

---

## 5. PR / 合入

- [ ] 母本与 `public/` **同 PR**（或先母本 + `sync:brand-assets` 再提交运行时产物）
- [ ] 产品面文案未引入中文或「Search」等禁用词

---

## 6. Git LFS（Issue #30 · 工程轨道 · ADR-006）

品牌母本 `docs/design/brand-assets/` 中的 **PNG/JPG/SVG/ICO/WebP** 走 **Git LFS**（见根目录 `.gitattributes`）。**本 Checklist 流程不变**；运行时 `extension/public/`、`website/public/` 仍为普通 Git。

**首次 clone / 换机：**

```bash
brew install git-lfs          # macOS；其它平台见 https://git-lfs.com
bun run setup:git-lfs         # 配置本仓 LFS filter + git lfs pull（勿 git lfs install --force，会盖 Husky）
```

**注意：** 勿对母本路径只提交 LFS 指针却未 `git push` 上传 LFS 对象；Husky `pre-push` 会调用 `git lfs pre-push`。

`docs/archive/research/` 保持归档；Normative 结论只进 `docs/product/`。
