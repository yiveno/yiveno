# R4 · Phase E 验收与 recall-eval（工程旁挂）

> **Normative 摘要：** [`Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) **§5.10**（手工）、**§5.11**（eval must）、**§7.2**（Outcome Labeling）。  
> **术语：** [`Yiveno-术语表.md`](../product/Yiveno-术语表.md)（clue · 遥测事件 §10.1）。  
> **改版计划：** [`Yiveno-改版计划-v1.md`](../product/Yiveno-改版计划-v1.md) **R4**。  
> 冲突时先改产品文档再改本文。

---

## 1. 实现锚点

| R4 交付           | 预期路径                                                                                                                                                                     | 验收                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Explain ECS UI    | `pages/sidepanel/SidePanel.vue` · `RecallResultCard.vue` · `explain-recall-match.ts`                                                                                         | §5.10.1                                                  |
| Omnibox ECS       | `background/listeners/omnibox.ts` + 建议 UI                                                                                                                                  | §5.10.1 · §5.10.8                                        |
| Omnibox must eval | `omnibox-eval-cases.ts` · `run-omnibox-eval.ts` · `omnibox-eval.test.ts`                                                                                                     | §5.11.5 · [`Omnibox-手测步骤.md`](./Omnibox-手测步骤.md) |
| TTE 埋点          | 新模块建议 `infrastructure/analytics/` 或 `application/recall/recall-telemetry.ts`                                                                                           | §5.10.3 · §5.9 七事件                                    |
| Outcome Labeling  | `recall-outcome*` + pairs；C2 默认不进 settled；关 Panel 静默结算（无 exit park）                                                                                            | §7.2 P0–P3；开 C2 见 `R4-Outcome-Labeling-P2-校准.md`    |
| detail export     | `core/recall/detail-export.ts` · `EXPORT_DETAIL_EXPORT` · Library + Side Panel 多选 UI                                                                                       | §5.10.4 · ADR-008                                        |
| Recall Framing    | `build-recall-framing-facts.ts` · `render-recall-framing.ts` · `complete-recall-framing-nlg.ts` · `hybrid-recall-backend` attachRecallFraming + attachRecallFramingLlmPolish | §7.0 · `recall-framing-eval` must                        |
| 只读 MCP          | Settings `mcpReadOnlyEnabled` · `MCP_RECALL_EVIDENCE` · Worker `PUT /api/account/mcp` + `/api/mcp/tools*` · `@yiveno/mcp`                                                    | §5.10.5（已上线 beta）                                   |
| Raindrop/Pocket   | `parse-*-export` · `import-third-party-corpus-service` · Settings 数据区 · `IMPORT_THIRD_PARTY_CORPUS`                                                                       | §5.10.6（已上线 · R2 准入）                              |

**消息 type：** 禁止发明字符串；evidence export / MCP 须先改 `core/messaging/*`。

---

## 2. recall-eval · R4 must case 实现清单

Normative case id 见产品文档 §5.11.2。实现时：

1. 在 `recall-eval-ids.ts` 增加 corpus id（若缺）。
2. 在 `recall-eval-corpus.ts` 增加 `MemoryItem`（含 note / openCount / 日期跨度）。
3. 在 `recall-eval-cases.ts` 增加 case；`gate: 'must'`。
4. 跑 `cd frontend && bun run test:run -- recall-eval`。

### 2.1 建议 corpus 增补（实现参考）

| eval id                  | 类型         | 要点                                                       |
| ------------------------ | ------------ | ---------------------------------------------------------- |
| `halfReadArticleExcerpt` | text_excerpt | `updatedAt` 8–14 天前；正文含「didn't finish」类语义可检索 |
| `deployNoteExcerpt`      | text_excerpt | `clues.note` = `deploy checklist reminder`                 |
| `recentI18nExcerpt`      | text_excerpt | `createdAt` = 近 24h；正文含 `i18n:check`                  |
| `secondYivenoBookmark`   | bookmark     | 与现有 Yiveno 书签并存，供 cluster case                    |

### 2.2 `r4-cluster-yiveno-docs` 断言说明

一条 clue 期望**两个** id 均在 top-6（或 top-3 若仅两条 Yiveno 书签）。实现选项：

- **A（推荐）：** 拆成两个 case，同一 clue、不同 `expectedId`，均 `in_topk` k=6。
- **B：** 扩展 eval runner 支持 `expectation: { kind: 'all_in_topk', expectedIds: [...], k }` — **须先改产品文档与 schema**。

当前 Normative 允许 A；B 未批准前不得擅自加 expectation kind。

### 2.3 `r4-constrained-time-empty` 说明

若 eval runner 不暴露 `emptyKind`，则断言 `no_match` + `topPick === null` + `alsoPossible` 为空或不含 poem 类条目即可；`emptyKind=constrained_none` 为 stretch 单测可选。

---

## 3. Explain 单测（已有 + R4 须保持）

```text
frontend/src/core/recall/explain-recall-match.test.ts
frontend/src/core/recall/recall-result.test.ts  # formatMatchedFields
```

R4 UI 合入后**不强制** snapshot 测 Vue；§5.10.1 手工 + `RecallResultCard` / Omnibox suggest 五要素为门禁。

**ECS 卡面（2026-08-27）：** `RecallResultCard` 展示 `reasonLine` + `Saved $time$`；`format-recall-saved-time.ts`；Omnibox description 含保存时间与 Explain 理由。

---

## 4. TTE 事件 schema（实现）

与 §5.9 / `yiveno_research/TTE_指标框架与测试协议.md` 对齐。权威实现：

| 模块                                           | 路径                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Zod 七事件 + `RecallPipelineTiming` + ECS 打分 | `frontend/src/core/recall/recall-telemetry.ts`                                                      |
| 本机环形缓冲                                   | `frontend/src/infrastructure/analytics/recall-telemetry-store.ts`                                   |
| Side Panel 录制器                              | `frontend/src/infrastructure/analytics/recall-telemetry-recorder.ts`                                |
| 流水线分段计时                                 | `frontend/src/application/recall/backends/hybrid-recall-backend.ts` → `RecallResult.pipelineTiming` |

```typescript
// 示意；合入时放在 core/recall/ 或 infrastructure/analytics/
RecallTelemetryEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('clue_submitted'),
    taskId: z.string().uuid(),
    cluePreview: z.string(),
    at: z.string().datetime()
  }),
  z.object({
    type: z.literal('evidence_visible'),
    memoryItemId: z.string().uuid(),
    rank: z.number().int(),
    ecs: z.number().int().min(0).max(5),
    at: z.string().datetime()
  })
  // … source_opened, user_confirmed, clue_refined, task_timeout, result_rendered
])
```

> **术语：** 事件 `type` 为 `clue_submitted` / `clue_refined`；旧版 `query_*` 在 `recall-telemetry-store` 读取时迁移。见术语表 §10.1。

**存储：** P0 `chrome.storage.local` 键 `yiveno.recallTelemetry`（最多 500 条）；dev 可读 `yiveno.listRecallTelemetryEvents()`（见 [`DEV-调试API.md`](./DEV-调试API.md) §4.3）；不上云除非隐私文档更新。

**单测：** `frontend/src/core/recall/recall-telemetry.test.ts`（七事件 parse + ECS 0–5）。

---

## 5. Detail export JSON 形状（Normative · ADR-008）

```json
{
  "version": 1,
  "exportedAt": "2026-08-24T00:00:00.000Z",
  "items": [
    {
      "id": "uuid",
      "type": "text_excerpt",
      "createdAt": "…",
      "sourceUrl": "https://…",
      "selectedText": "…",
      "note": "optional",
      "pageTitle": "…",
      "domain": "…"
    }
  ]
}
```

合入时须 Zod 校验；Markdown 为人类可读视图，与 JSON **同源**生成。

**实现：** `frontend/src/core/recall/detail-export.ts` · `export-detail-export-service.ts` · `EXPORT_DETAIL_EXPORT` · `AppMenuButton` · Library / Side Panel 底栏（Copy / Download 菜单 → Markdown / JSON）。

### 5.1 多选手测（条目即选择器）

**前置：** `cd frontend && bun run build` → `chrome://extensions` 重新加载 Yiveno。

| 步骤 | Library 摘录                                       | Library 书签树       | Side Panel Recall                            |
| ---- | -------------------------------------------------- | -------------------- | -------------------------------------------- |
| 1    | 打开 `library.html` → 摘录 Tab                     | 书签 Tab             | 提交 clue 出结果                             |
| 2    | 点头像区 **Detail export** 图标进入多选            | 同左                 | 点结果区 **Detail export** 图标              |
| 3    | **点条目卡片**切换选中（无左侧勾选列、列表不横跳） | **点书签行**切换选中 | **点结果卡**切换选中；展开集合后可点 sibling |
| 4    | 选中态 = 描边 + 角标勾；再点取消                   | 同左                 | 同左                                         |
| 5    | 底栏 Copy Markdown → toast「Copied…」              | 同左                 | 同左                                         |
| 6    | Cancel 退出 → 点条目恢复打开链接                   | 同左                 | 同左                                         |

**通过：** 无 checkbox 列；摘录三行布局（标题+操作 / 附注 / 来源+时间右对齐）；摘录与书签时间均为**保存/创建时刻**（非 `updatedAt`）；常态下行内附注/删除**悬停才显**（多选模式隐藏）；导出 JSON 仅含已选 id。

---

## 6. 合入顺序建议

```text
1. Explain ECS UI（§5.10.1）+ explain 接线          ✅
2. §5.11.2 must case 补齐 + CI 绿                   ✅（含 r4-*；cluster 拆 case）
3. TTE 埋点（本地聚合即可）→ 再跑种子 study 第 1–2 周  ✅ P0 埋点；种子 study 未跑、不宣称 Beta
4. detail export                                    ✅
5. Raindrop/Pocket adapter（单点，过 R2）           ✅
6. 只读 MCP（最后；未达 §5.9 Beta 不对外宣传）      ✅ beta 已接线、不营销
```

---

## 修订记录

| 日期       | 变更                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-08-27 | **撤 exit park：** 关 Panel 不再停放/下次打开补问出口条；仅同场 New find 出示通道 D；删 `yiveno.recallOutcomeExitPark` |
| 2026-08-27 | **Raindrop/Pocket 文件导入已上线：** Settings 数据区；§5.10.6；解析 HTML/CSV/JSON                                      |
| 2026-08-27 | **Detail export 已上线：** Library + Side Panel 多选导出；`EXPORT_DETAIL_EXPORT`；§5                                   |
| 2026-08-27 | **TTE 埋点 P0：** 七事件 + `pipelineTiming` + ECS 打分 + 本机缓冲；见 §4 模块表                                        |
| 2026-08-24 | **TTE 种子 study：** 工程 checklist `TTE-种子用户研究-checklist.md`                                                    |
