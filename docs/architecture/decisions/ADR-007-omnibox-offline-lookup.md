# ADR-007: Omnibox = 离线字段快跳；Side Panel = 完整 Recall

- **状态：** 已接受
- **日期：** 2026-08-29
- **决策者：** 产品 + 维护者

## 背景

Omnibox（`yi`）与 Side Panel 共用 `recallService` 且走完整 Hybrid + LLM 理解时：

1. **壳装不下**多轮追问、`need_a_clue` 邻域、framing 等 Side Panel 能力，却消耗同等理解成本。
2. 地址栏心智更接近 **「已知关键字 → 快跳转」**，而非口语找回主战场。
3. 每键 `inputChanged` 触发全量流水线，延迟与成本偏高。

Side Panel 仍是自然语言找回、邻域与非神谕承诺的 Normative 主壳（ADR-001、ADR-003）。

## 决定

1. **入口分轨（仍经 `recallService`，非第二套 UI 消息）：**
   - **`entry: 'omnibox'`** → **离线查找轨**（Omnibox offline lookup）
   - **默认 / Side Panel** → **完整 Recall 轨**（现有 Hybrid + 理解 + framing 等）

2. **Omnibox 离线查找轨（Normative）：**
   - **目标用户：** 已明确记得要找什么、能提供**关键字/片段/域名/标题词**等锚点。
   - **理解：** 仅规则 parser（`forceMode: lexical`）；**禁止**托管/直连 LLM 听懂（§0.1.0 NLU 不挡 Omnibox 快跳）。
   - **检索：** 本机 Filter（标题、摘录正文、附注、URL/域名等字段）+ 既有模糊/贴合度机制；条目若已有 **embedding**（enrichment 产出）则允许 **关键词池 + 向量 RRF 融合**（clue embed 仍可走 Worker API，非 LLM NLU）。
   - **禁止：** 多轮 `context`、framing NLG、Narrow 举例、环境追问芯片、`relatedGuess` 空态编造。
   - **会话：** 单次无会话（延续 ADR-001）；回车打开 Top Pick 或选中建议。

3. **Side Panel：** 不变——完整 Hybrid、LLM 默认理解、§7.0 多轮、邻域 framing。

4. **MCP 本机：** 仍走完整 Recall 轨（`entry` 默认），与 Omnibox 分轨。

## 后果

**必须：**

- `omnibox.ts` 调用 `recallWithClue(clue, { entry: 'omnibox' })`。
- Omnibox 产品文案标明 Quick jump / 关键字；模糊口语引导 Side Panel（`Alt+Shift+Y`）。
- §5.3 / §0.5 入口表与本文一致；Omnibox 手测以**具体锚点**为主（§5.10.8 · `omnibox_must` §5.11.5）。

**禁止：**

- Omnibox 冒充 Side Panel 全能力或暗示「口语找回主路径」。
- 为 Omnibox 单独堆内容别名灰名单（ADR-005）。

**允许：**

- 同 clue 在 Omnibox 与 Side Panel **结果不一致**（入口契约不同，须在文案中可解释）。

## 相关

- ADR-001（主壳）、ADR-003（邻域）、ADR-004（LLM 边界）、ADR-005（灰名单）
- 产品文档 §0.5、§5.3、§5.10.1（Omnibox ECS 仍须五要素 suggest）
- 代码：`recall-backend.ts`、`hybrid-recall-backend.ts`、`omnibox.ts`
