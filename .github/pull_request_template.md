## Summary

<!-- 1–3 句：为什么改、用户/契约影响 -->

## Scope

<!-- 本 PR 动到的目录/能力；明确「未动」的边界 -->

- **In scope:**
- **Out of scope:**

## 文档与决策

- [ ] 行为/契约有变 → 已同步 [`Yiveno-产品文档-v4.0.md`](docs/product/Yiveno-产品文档-v4.0.md) 或工程文档
- [ ] 换波次/焦点有变 → 已更新 [`CURRENT.md`](docs/product/CURRENT.md) 并运行 `bun run sync:ide-boot`
- [ ] 不可逆分叉 → 已写/更新 [`docs/architecture/decisions/`](docs/architecture/decisions/) ADR
- [ ] 术语/禁用词有变 → 已更新 [`Yiveno-术语表.md`](docs/product/Yiveno-术语表.md)
- [ ] 品牌视觉有变 → 已改 [`docs/design/brand-assets/`](docs/design/brand-assets/) 并运行 `bun run sync:brand-assets`（见 [Checklist](docs/design/brand-asset-release-checklist.md)）

## 验收归属（§1.1 · 至少勾一项）

- [ ] **无** Recall / Capture 用户可感行为变更
- [ ] 已增/改 `recall-eval` **must** case，且 `cd frontend && bun run test:run` 绿
- [ ] 已在产品文档 **§5** 写明可复现手动步骤（含期望结果）
- [ ] 纯重构 / bugfix，行为与 Normative 文档一致（无需新 case）

## 质量门禁

- [ ] `bun run typecheck`（或 CI 等价项）通过
- [ ] 相关 `cd frontend && bun run test:run` / `cd backend && bun test` 通过
- [ ] 触达扩展 UI / i18n → `bun run i18n:check` 通过
- [ ] 新增/变更 Background `message type` → `docs/engineering/background-message-types.registry` 已同步
- [ ] `bun run doc:check` 通过
- [ ] 扩展用户可感路径 → **MCP 真机** UI 抽测（简述测了什么、通过/失败）

## 双线程（§0.1.2 / ADR-016 · 方案/新能力必填；纯修回归可勾 N/A）

权威：[`Yiveno-双线程发展原则.md`](docs/product/Yiveno-双线程发展原则.md)

- [ ] **N/A（纯修回归）** — 无新方案/新能力
- [ ] 已填五问（用户问题 / 可观测 / 可证伪假设 / 如何改善产品 / 如何可靠）或在 PR 正文贴 Brief 节选
- [ ] 出口：双赢 / 仅明线 / 仅暗线（离线+`dual-thread-notes`）
- [ ] 若动受控适应旋钮 → 已对照 [`暗线基建-失败归因与受控适应.md`](docs/engineering/暗线基建-失败归因与受控适应.md) 登记表与 eval 门；Omnibox 禁区未突破 ADR-007
- [ ] 未把行为数据写成「人脑定律」；未为暗线损害体验或默认上传私人全文

## 禁止项自检

- [ ] 无硬编码内容别名灰名单冒充全库通解
- [ ] 无未上线能力在文案/UI 中暗示可用
- [ ] 产品面文案仅 en + `t()`；无 `Search` 作用户可见主文案

## Test plan

<!-- Reviewer / 未来的你可复现的步骤 -->

1.
2.
