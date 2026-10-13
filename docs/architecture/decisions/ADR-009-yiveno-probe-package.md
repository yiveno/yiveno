# ADR-009: 召回探针 / 测试数据工作台独立为 `@yiveno/probe` 包

- **状态：** 已接受
- **日期：** 2026-09-06
- **决策者：** 维护者（工程隔离）

## 背景

召回探针（Probe Console）与 persona 语料曾落在 `extension/src/dev/` 与 `extension/src/infrastructure/debug/`。它们与产品扩展同仓同构建时会出现：

- **污染产品构建**：开发期页面/模块进入扩展产物链路（如 Service Worker preload），增加体积与意外依赖。
- **CWS 风险**：探针种库、夹具 UI、调试入口若误入生产包，可能被商店审核视为未披露调试能力或误导用户。
- **边界模糊**：维护者需要清晰隔离「开发者探针工作台」与「产品 Recall / §5.9 真实库 TTE」。

目标是把探针/测试数据工作台从产品 extension 主路径中拆出，同时保留扩展侧最小 Chrome / IndexedDB 桥接。

## 决定

1. **Monorepo 包 `@yiveno/probe`** 拥有并维护：
   - 纯语料（persona corpora）与种子预设（seed presets）
   - 校验 / verify helpers
   - Probe Console UI 源码
2. **`extension/src/dev/probe/` 仅保留 Chrome / IndexedDB 桥**（seed / purge / snapshot / SW expose / DEV handler）；**禁止**落在 `infrastructure/` 或产品 `pages/` / `application/` 主路径。`probe-console/` 仅为挂载壳。
3. **构建与分发：**
   - 开发期产出 `probe-console.html`（或等价开发入口）
   - **禁止**进入 production / CWS 扩展包
4. **定位边界（Normative）：**
   - `@yiveno/probe` **不是** §5.9 种子验证 / 真实库 TTE 的替代品；真实库结论仍以个人 Chrome 库 + 真人确认为准
   - `recall-eval`（must / 夹具）继续留在 `extension` / `core`，不迁入本包

## 后果

**必须：**

- 语料、Probe Console、verify helpers 的 import 路径改为 `@yiveno/probe`（或包内公开导出）。
- 工程文档 `docs/engineering/DEV-调试API.md` 指向本包与桥接边界。
- 扩展 production / CWS 构建排除 Probe Console 与探针语料入口。

**禁止：**

- 将探针种库数字或 eval 语料冒充 §5.9 真实库达标。
- 在生产扩展包中捆绑 Probe Console 或开发者种库 UI。
- 把 `recall-eval` 主路径迁入 `@yiveno/probe`。

## 参考

- [`docs/engineering/DEV-调试API.md`](../../engineering/DEV-调试API.md)
- 包路径：`packages/yiveno-probe`（npm name `@yiveno/probe`）
- 产品文档 §5.9（种子验证 / 真实库 TTE）
- ADR-005（禁止灰名单冒充通解；探针语料仅夹具，非生产通解）

## 实现备注（2026-09-06）

- Console UI / 语料 / verify / presets 已落在 `@yiveno/probe`
- 扩展侧 Chrome / IDB 桥与 `DEV_*` handler 落在 `extension/src/dev/probe/`（**不在** `infrastructure/`）
- `extension/src/dev/probe-console/` 仅保留 html + `main.ts` 挂载壳
- `build:prod` / CWS 不产出 `probe-console.html`
- 产品路径（`pages/` / `application/` / `infrastructure/` 业务面）不得再承载探针语料或 Console
- **Console 当前范围（2026-09-06）：** UI **写入测试数据 + 清理**；盘点 / 对拍撤出页面（消息与 `verify/` 仍可脚本用）
- **Console 文案（2026-09-07）：** 界面用「手写精选 / 半仿真 / 无关干扰 / 随机种子」；API 字段仍可 `diversity*` / `noise*` / `fillerSeed`
