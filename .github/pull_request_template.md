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

## 禁止项自检

- [ ] 无硬编码内容别名灰名单冒充全库通解
- [ ] 无未上线能力在文案/UI 中暗示可用
- [ ] 产品面文案仅 en + `t()`；无 `Search` 作用户可见主文案

## Test plan

<!-- Reviewer / 未来的你可复现的步骤 -->

1.
2.
