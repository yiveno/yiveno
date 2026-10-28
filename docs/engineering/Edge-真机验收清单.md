---
created: 2026-10-28T10:24:00+08:00
updated: 2026-10-28T19:20:00+08:00
author: agent:cursor
scope: Microsoft Edge 稳定版加载仓库根 dist/（后换商店包）
status: active
upstream: ADR-020 · EDGEADDONS.md
downstream: Partner Center 首次提交前必过
---

# Edge 真机验收清单

## 前置

1. `cd extension && bun run build` → 产物在**仓库根** `dist/`（不是 `extension/dist`）
2. Edge → `edge://extensions` → 开发人员模式 → 加载已解压的扩展 → 选仓库根 `dist/`
3. 本清单**禁止**只用 Chrome MCP 冒充通过

## 清单

| #   | 路径              | 通过标准                                                                            | 结果（2026-10-28）                                                                                                                  |
| --- | ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 安装 / Side Panel | 工具栏图标与 `Alt+Shift+Y` 打开 Recall 壳                                           | **CDP 冒烟通过**：`--load-extension=<repo>/dist` 后 SW + `sidepanel.html` 可开（Edg/156）；快捷键手势仍待人工                       |
| 2   | Capture           | 划存 + 附注；右键 Save                                                              | **部分**：runtime manifest 含 `content-selection-toolbar.js`（`http(s)://*/*`）；合成划选未稳定拉出浮层 → **真机划存/右键仍待人工** |
| 3   | 书签              | Import 本机 Edge 收藏夹；增量可见                                                   | 待人工勾选                                                                                                                          |
| 4   | Recall            | 英文 clue → 邻域卡；favicon 或回退                                                  | **部分**：Side Panel composer（textarea「线索」）已起；提交 clue / 邻域卡待人工                                                     |
| 4a  | Composer 壳稳     | 聚焦/首字输入：`scrollY===0`；底栏不贴边裁切；空态输入框高度不因长 placeholder 跳变 | **待 Edge 人工**（设计标准 §6.2.4；Chrome MCP 仅回归不冒充）                                                                        |
| 5   | Omnibox           | `yi` + 关键词有建议                                                                 | **部分**：SW 可见 `omnibox.keyword=yi`；地址栏建议待人工                                                                            |
| 6   | 官网桥            | `.com` / `.cn` Sign in · Connect · handoff                                          | **部分**：`externally_connectable` 含 `yiveno.com` / `yiveno.cn` / localhost；handoff 真机待人工                                    |
| 7   | 快捷键页          | Settings → 落在 `edge://extensions/shortcuts`                                       | 单测覆盖 UA 分支；CDP 可打开 `edge://extensions/shortcuts`                                                                          |
| 8   | 卸载              | 卸载反馈页                                                                          | 待人工勾选                                                                                                                          |

## 工程侧已验证（本机）

| 项                                                      | 结果                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `/Applications/Microsoft Edge.app` 存在                 | OK（Edg/156.0.4314.50）                                          |
| 仓库根 `dist/` 生产构建                                 | OK（`cd extension && bun run build`；**不是** `extension/dist`） |
| 隔离 Profile `--load-extension=<repo>/dist` + CDP       | OK · Getting Started / SW / Side Panel / Settings / example.com  |
| `getExtensionShortcutsSettingsUrl` Edge UA → `edge://…` | 单测通过                                                         |
| `externally_connectable` 含 `yiveno.cn`                 | 契约单测 + Edge runtime manifest 可见                            |
| `pack:store` 路径                                       | 已改为 `cd ../dist` → `extension/yiveno-extension-store.zip`     |
| Chrome DevTools MCP 冒充 Edge                           | **不做**（规范禁止）                                             |

隔离 Profile 冒烟启动：

```bash
cd extension && bun run build
# 产物 = 仓库根 dist/
REPO="$(cd .. && pwd)"
"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  --user-data-dir=/tmp/yiveno-edge-qa \
  --remote-debugging-port=9223 \
  --remote-allow-origins='*' \
  --disable-extensions-except="$REPO/dist" \
  --load-extension="$REPO/dist" \
  --no-first-run
```

> **注意：** 路径写错成 `extension/dist` 时 Edge 会起不来（无 Preferences / 无 CDP）。日常已开的 Edge 单例也会吞掉带 `--user-data-dir` 的二次启动——QA 前先退出 Edge。
