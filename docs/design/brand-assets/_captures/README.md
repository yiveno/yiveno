# `_captures/` · 派生截图脚本

> **本目录只放脚本 + 本 README。** 不放 Chromium profile、不长期留 PNG。

| 脚本                       | 用途                                 | 产出位置                                                          |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `shot-extension-store.mjs` | 加载仓库根 `dist/` → 1280×800 产品壳 | `/tmp/yiveno-cws-shots-*`（Profile 同批写 `/tmp` 并在退出时删除） |
| `shot-sections.mjs`        | 官网分节参考                         | 历史写法会写本目录；跑完后**删掉 PNG**，勿入库                    |

定稿商店图：从 `/tmp` 拷入 [`../chrome-web-store/`](../chrome-web-store/)，再更新契约与 `CHROMEWEBSTORE.md`。
