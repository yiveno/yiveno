# ADR-011: Recall 相对时间置信度分层（硬筛 vs 软排）

- **状态：** 已接受
- **日期：** 2026-09-10
- **决策者：** 维护者（2026-09-10 明示：时间 P0 工程刀；与自然 clue 采样分工）
- **前置：** ADR-003（邻域非神谕）· ADR-005（禁止灰名单）· ADR-010（理解流水线）· 产品文档相对时间闭集

## 背景

人脑对「过了多久」常不精确（`some time ago` / `a long time ago` / `a while ago`）。  
若一律把 `timeLabel` 落成固定滚动窗并**硬过滤**，易在仍有字面/类型/语义信号时打出空邻域或 `no_match`（TTE：T28、糊时间 + 约束邻域空窗）。  
日历级口语（`yesterday` / `last week`）则应继续硬约束，否则时间槽失去意义。

## 决定

1. 每个 `RecallRelativeTimeLabel` 确定性映射 `timeConfidence: high | low`（写入 `ParsedRecallClue`；**禁止** LLM 自报 confidence）。
2. **high** → 现有 `timeRange` **硬排除**窗外命中（含约束邻域与 Hybrid）。
3. **low** → **不**因时间硬排除；对落在中心窗内的命中**软加分**；窗外可保留在邻域。禁止「仅低置信时间」单独造成诚实终局空结果（仍允许无任何匹配信号时的 `no_match`）。
4. Framing：high 用 Within；low 用 Around（日常英语，禁止 slug）。
5. 可为既有 label 增加闭集口语 surface（如 `a long time ago` → `long_ago`）；**不**借机扩内容别名表。

## 后果

- 改 label↔confidence 表或硬/软行为 → 同批改产品文档相对时间表 + 本 ADR + 单测/must。
- 自然 clue 采样仍决定 must 扩面与后续槽位优先级；本 ADR 不宣称「时间已是采样证实的第一自发维度」，只修已知产品坑。

### 空/弱窗 × contentTerms（Normative 例外 · 2026-09-11）

**优先级：** 禁止甩无关 **>** 日历硬筛 **>** 弱语义填屏。

当 `ParsedRecallClue` 经剥弱偏好残留后的**有效** `contentTerms` 非空时：

1. **内容佐证门：** 邻域候选须对至少一个有效 contentTerm 在条目索引字段（title / 摘录 / 附注 / keywords 等，见产品文档）上有**词面佐证**；禁止仅靠弱 embedding / RRF / outcome 对交卷；弱残留（`like`/`good` 等）不得单独撑门。
2. **high 仍先硬筛**（本 ADR 决定 2 不变；含 `recently_saved` 合成 `recent`，关键词/Hybrid 内容路径同样适用）。
3. **内容优先回退一次：** 硬筛 + 佐证门后池空 → **同一 clue** 再检索一轮，时间按 **soft**（不硬切窗外）；Framing 用 Around + 诚实提示时间可能不准；仍只接受有佐证的命中。Hybrid 池内仍空 → 降级全库关键词；仍空 → 诚实 `no_match`。
4. **禁止：** 无限扩窗；内容别名灰名单；用窗内无佐证弱条填 `top_pick`。

改本例外 → 同批改产品文档相对时间段 / §7.2 Outcome 护栏 / must。

## 参考

- [`docs/archive/research/tte-beta-2026-09/time-confidence-plan.md`](../archive/research/tte-beta-2026-09/time-confidence-plan.md)（Non-normative；归档）
