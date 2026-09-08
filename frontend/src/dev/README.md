/\*\*

- DEV-only 工作区（不进 CWS 产物）。
-
- ## 分层
-
- | 路径 | 职责 |
- | ---- | ---- |
- | `@yiveno/probe`（`packages/yiveno-probe`） | 语料 / presets / verify helpers / Probe Console（造数 UI；与产品 frontend 解耦） |
- | `frontend/src/dev/probe/` | 扩展侧 Chrome / IndexedDB 桥（seed / purge / snapshot / SW expose / DEV handler） |
- | `frontend/src/dev/probe-console/` | 仅 html + main 挂载壳 |
-
- ## 硬规则
-
- - 仅 `vite build --mode development` 打入 dist（如 `probe-console.html`）
- - **禁止**写入 `manifest.json` / 生产用户导航 / Settings 常驻区块
- - **允许**产品顶栏 `AppPageHeader` 在 `import.meta.env.DEV` 下展示「Test workbench」入口（动态 import 本目录；生产剔除）
- - **禁止**语料或 Console 再落回 `infrastructure/` / 产品主路径
- - 产品召回 / Capture / Side Panel **不得**依赖本目录或 `@yiveno/probe`（入口打开页除外）
-
- 权威文档：`docs/engineering/DEV-调试API.md` · ADR-009
  \*/

export {}
