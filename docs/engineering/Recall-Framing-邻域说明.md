# Recall Framing（邻域说明）· 工程计划

> **Normative：** [`Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) **§7.0 · Recall Framing**。  
> **术语：** [`Yiveno-术语表.md`](../product/Yiveno-术语表.md)（clue · 邻域 · Recall Framing · outcome 等）。  
> **分层：** 列表级 Framing（本文）≠ 卡片级 Explain（`explain-recall-match.ts` · §5.10.1）。

---

## 1. 目标

凡 Recall 产出**可点选候选列表**，助手气泡须说明「为什么是这个邻域、库里大致几类、把握度如何、还困惑什么」——**按 P1→P6 优先级**，高优先级块先完整呈现。

**不是：** ChatGPT 式 think、生活助理、神谕分数、逐卡复述 Explain。

---

## 2. 架构

```text
RecallResult（outcome + pool + parsed）
  → buildRecallFramingFacts()     # core：确定性事实 + 分桶
  → renderRecallFramingStatic(t)    # 无 LLM：i18n 模板拼接 P1–P6
  → completeRecallFramingNlg()    # 可选：LLM 仅润色 facts（同 clue 配额桶）
  → RecallResult.recallFraming
  → SidePanel assistant turn.text（+ 现有 chips / placeholder 不变）
```

### 2.1 新增类型（草案）

```typescript
// frontend/src/core/recall/recall-framing-facts.ts
type RecallFramingFacts = {
  understood: {
    /* parsed 摘要：objectTypes, timeLabel, contentTerms, behaviorHints */
  }
  retrievalPath: 'literal' | 'constraint_neighborhood' | 'hybrid' | 'mixed'
  buckets: Array<{ id: string; labelKey: string; count: number }> // 最多 3 簇
  stance: 'confident_neighborhood' | 'weak_candidates'
  ambiguity?: { kind: 'site' | 'note' | 'token' | 'type_mix'; promptKey: string }
  counts: { total: number; shown: number }
}
```

### 2.1 分桶规则（P3 · 闭集 · 全用户同一规则）

对当前排序池（`topPick` + `alsoPossible`，上限采样 20）统计：

| bucket id                 | 条件                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `excerpt`                 | `type === text_excerpt`                                    |
| `bookmark`                | `type === bookmark`                                        |
| `domain:*`                | 按 registrable domain 聚合；仅当单域 ≥2 或占池 ≥25% 时上报 |
| `with_note`               | `clues.note` 非空                                          |
| `constraint_neighborhood` | 代表项主因含 `constraint_neighborhood` 且占比 ≥40%         |

取 count 降序 **最多 3 桶**；不足 2 桶则 P3 省略（窄邻域）。

### 2.2 检索路径（P2）

| 条件                                            | `retrievalPath`           |
| ----------------------------------------------- | ------------------------- |
| 池内 ≥50% 主因为 `constraint_neighborhood`      | `constraint_neighborhood` |
| 池内 ≥1 条 `embedding` / `hybridRrf` 且非全邻域 | `hybrid` 或 `mixed`       |
| 否则                                            | `literal`                 |

---

## 3. 实现分期

### Phase A — 规则 Framing（必选 · 无 LLM 也能全绿）

| 项         | 路径                                        | 说明                                                                              |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Facts 构建 | `core/recall/build-recall-framing-facts.ts` | 纯函数 + Zod                                                                      |
| 静态渲染   | `core/recall/render-recall-framing.ts`      | 注入 `t()`；P1–P6 模板 key                                                        |
| 接线       | `hybrid-recall-backend.ts`                  | post-process 挂 `recallFraming`                                                   |
| 类型       | `recall-result.ts`                          | `recallFraming?: { source: 'rules' \| 'llm'; text: string; facts: ... }`          |
| UI         | `SidePanel.vue`                             | `top_pick` / `need_a_clue` 用 `recallFraming.text` 替代纯 `formatRankedReplyText` |
| i18n       | `_locales/en` + `message-keys`              | `framing_*` 块模板（禁止写死 UI 句）                                              |
| 单测       | `build-recall-framing-facts.test.ts`        | 分桶 / 路径 / 优先级裁剪                                                          |
| 降级       | 无 LLM 时 **仍输出完整 P1–P4**              | 满足「凡有列表必说明原因」                                                        |

**退出标准：** `video` 宽邻域手测可见 P1+P2+P3+P6；`need_a_clue` 可见 P4+P5 静态句。

### Phase B — LLM 润色（已接线 · 合并原追问 NLG）

| 项       | 路径                                                   | 说明                                                                                   |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| LLM 实现 | `understand/build-llm-framing-prompt.ts`               | 输入 `RecallFramingFacts` JSON + 规则 P1–P5 基线（**LLM prompt 字符串**，非用户 clue） |
| NLG      | `understand/complete-recall-framing-nlg.ts`            | `{ reply, chips }`；门禁复用 `map-llm-follow-up-proposal`                              |
| 拼接     | `render-recall-framing.ts`                             | `renderRecallFramingRulesBody` + `renderRecallFramingCounts`（P6 deterministic）       |
| 接线     | `hybrid-recall-backend.ts`                             | `attachRecallFramingLlmPolish` 替代 `attachLlmFollowUpIfNeeded`                        |
| 触发     | 宽 `top_pick`（N≥6）或 `need_a_clue`；窄 top_pick 跳过 | 与 composer placeholder 宽门槛同常量                                                   |

### Phase C — 验收与 eval（已接线）

| 项            | 说明                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| §5.2.1        | 步 8–10（宽 top_pick / need_a_clue / guess）                                              |
| `recall-eval` | `recall-framing-eval.ts`：`framing-constraint-neighborhood` · `framing-weak-literal` must |
| MCP           | 气泡与首卡 `reasonLine` 不矛盾                                                            |

---

## 4. 与现有模块关系

| 模块                           | 关系                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `explain-recall-match`         | **保留**；Framing 不逐条复述 reasonLine                  |
| `assistantFollowUp`            | Phase B 并入 `recallFraming`；`suggestions` 仍走芯片通道 |
| `formatRankedReplyText`        | 降为 P6 子模板，由 `renderRecallFraming` 调用            |
| `compute-composer-placeholder` | **不变**；Placeholder 仍负责 composer 软引导             |
| TTE                            | 可选 `framing_rendered` 事件（非 P0）                    |

---

## 5. 风险与守门

| 风险         | 守门                                          |
| ------------ | --------------------------------------------- |
| 气泡过长     | P3 最多 3 桶；P5 一句；LLM `reply` ≤2 句      |
| 聊天机器人化 | 禁令 + 无事实不输出                           |
| 延迟         | Phase A 零额外 RTT；LLM 与现追问同异步路径    |
| 灰名单分桶   | 只用闭集 bucket id + 域名统计，禁止内容别名表 |

---

## 6. 建议落地顺序（本周可执行）

1. **Phase A 事实层 + 静态模板**（`top_pick` + `need_a_clue`）
2. **Side Panel 气泡接线** + MCP 3 场景
3. **Phase B** 合并 LLM（替换当前零散 `need_a_clue` reply）
4. **`framing-*` must** + §5.2.1 勾选
