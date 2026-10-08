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
   - **目标用户：** 已明确记得要找什么、能提供**关键字/片段/域名/标题词**等锚点；快捷键唤起地址栏快速命中即走。
   - **理解：** 仅规则 parser（`forceMode: lexical`）；**禁止**托管/直连 LLM 听懂（§0.1.0 NLU 不挡 Omnibox 快跳）。
   - **检索：** 本机字段 Filter（标题、摘录正文、附注、URL/域名等）+ 结构化约束（时间 high/low、类型、附注指向）+ 内容佐证门（仅本次必修）+ **Indexed Fuzzy 预计算字典**（闭合技术缩写 / 技术词形 / 少量技术拼写变体，如 js→javascript、recat→react）。
   - **禁止向量融合：** 不调 `requestWorkerEmbeddings`（clue / Topic embed 均跳过），不走 RRF，不做 cosine 扫描；miss 也不联网兜底；已知锚点场景下向量召回为延迟浪费。
   - **禁止 Outcome 软调：** 单次命中即走，无多轮会话上下文，跳过 `applyStoredOutcomePairsToMatches`。
   - **Topic lookup：** 仅词法（`withRecallTopic`），不注入 Topic embedding（`withRecallTopicAsync`）。
   - **Indexed Fuzzy（2026-10-07）：** Omnibox 下 `getFuzzyVariants` 查静态字典展开；与原始 clue 多路 Filter 取并集（按 id 保留最高分）。词表规模以 `fuzzy-lexicon.ts` 为准（约百级行业闭集，非内容别名）；T0 查表 O(1)，无运行时 Levenshtein。**质>量（2026-10-08）：** 变体路径分 × `FUZZY_VARIANT_SCORE_FACTOR`（0.82），禁止扩词满分冲掉原词精确 Top1；`omnibox_must` 含 `cf Workers` 等钉防退化。**短路径（2026-10-08）：** 主 clue 命中 ≥`OMNIBOX_FUZZY_SKIP_IF_PRIMARY_COUNT`（6）且头名 ≥ Top Pick 阈值时跳过变体扫；Chrome one-shot `suggest` 不可二次推送，故「增量」= 同次回调内字面优先、稀疏才扩 fuzzy。壳层：Tip 与 lookup 并行；`commands.getAll` 快捷键缓存 TTL。
   - **个人 soft rank（2026-10-08）：** 词面命中后叠加 `computeBehaviorBoost`；Omnibox 传 `behaviorProfile: 'omnibox'`——计入 `settledCount`（§7.2 履约正例；此前本函数未读），并略抬 `openCount` / 近因。仍受 `RECALL_BEHAVIOR_BOOST_CAP`，不得压过强词面差；**不等于** Outcome 软调（仍禁止读 Outcome 对）。
   - **短锚字段权重（2026-10-08）：** 同档 `behaviorProfile: 'omnibox'` 使用 `OMNIBOX_FIELD_WEIGHTS`——抬 title / note / domain / url，压 `textExcerpt` / `excerptContext` / summary，减轻短 token 正文噪声；Side Panel 仍用默认 `FIELD_WEIGHTS`。
   - **禁止：** 多轮 `context`、framing NLG、Narrow 举例、环境追问芯片、`relatedGuess` 空态编造。
   - **会话：** 单次无会话（延续 ADR-001）；回车打开 Top Pick 或选中建议。
   - **default 行 = 高价值友情提示（Normative · 2026-10-08）：** 平台强制 C 位、关不掉；定位为 **Tip**（非 CTA）：教「标题/站点/附注关键字最适合快跳；模糊口语去 Side Panel」。**禁止**把 click/接力动作做进 default。
   - **换赛道 CTA（Normative · 2026-10-08）：** SuggestResult 末行可点出口（`yiveno-omnibox-handoff:`）→ 写 `yiveno.recallPrefill` + `openRecallSidePanel`，Side Panel 自动完整 Recall。两种出现：**(a) 无快跳命中** → 仅 1 条无命中 CTA；**(b) 有 ≥1 条 Memory 建议** → Memory ≤`OMNIBOX_MEMORY_SUGGEST_LIMIT`（5），**末行**固定换赛道 CTA（「Not what you wanted? Open Side Panel」），总行数仍 ≤`OMNIBOX_SUGGEST_LIMIT`（6）。**仅选中 CTA 行**才接力；default Tip / Memory 行不接力。**`sidePanel.open` 须在确认手势栈内尽早调用，禁止先 await storage/bootstrap**。

3. **Side Panel：** 不变——完整 Hybrid、LLM 默认理解、§7.0 多轮、邻域 framing；须能在**已开**时经 `storage.session` 再消费 prefill（Omnibox 接力）。

4. **MCP 本机：** 仍走完整 Recall 轨（`entry` 默认），与 Omnibox 分轨。

5. **下拉建议条数（Normative · 2026-10-08）：** Omnibox 使用独立常量 **`OMNIBOX_SUGGEST_LIMIT = 6`**（`omnibox-suggest.ts`），**禁止**复用 Side Panel 首屏 / Show more 步长 `RECALL_RESULT_PAGE_SIZE`（现为 5）。
   - **为何分开：** Panel 可续展；Omnibox **无分页**、one-shot `suggest`，唯一可见机会，页长契约不同。
   - **为何 6：** Chrome 官方 API **未**钉死「恰好 6」；MDN 常写前 6 条；Chromium 桌面整栏 autocomplete 默认约 8（另含 `setDefaultSuggestion` 行）。6 = 自限实务预算，多出的高分命中仍按排序截断，不指望浏览器再裁。
   - **不可分页：** 平台硬事实；算法须在 ≤`OMNIBOX_SUGGEST_LIMIT` 内排好可跳项。

6. **能力天花板（Normative · 2026-10-08 · 防漂移）：** Omnibox **允许且仅允许**下列能力叠层；更高智能只投 Side Panel。

   | 层                                 | 允许 | 说明                                                                |
   | ---------------------------------- | ---- | ------------------------------------------------------------------- |
   | ① 规则理解                         | ✓    | `forceMode: lexical` only                                           |
   | ② 本机字段 Filter                  | ✓    | title / note / domain / URL / 摘录等                                |
   | ③ 结构化约束 + 佐证门              | ✓    | 时间 high/low、类型、附注；内容佐证                                 |
   | ④ 闭集 Indexed Fuzzy               | ✓    | 行业缩写/词形；变体分折扣；稀疏才扩                                 |
   | ⑤ 个人 soft rank                   | ✓    | `settledCount` / open / 近因；非 Outcome                            |
   | ⑥ 短锚字段权重                     | ✓    | `behaviorProfile: omnibox`                                          |
   | ⑦ 壳层                             | ✓    | ≤6 SuggestResult、Tip、无命中/有命中末行换赛道 CTA、短路径/并行 Tip |
   | ❌ Semantic / Hybrid / embed / RRF | 禁止 | 含「轻量向量」变体                                                  |
   | ❌ LLM NLU / framing / 多轮        | 禁止 | miss → Side Panel 接力                                              |
   | ❌ Outcome 软调 / 内容别名灰名单   | 禁止 | ADR-005 / §7.2                                                      |

## 后果

**必须：**

- `omnibox.ts` 调用 `recallWithClue(clue, { entry: 'omnibox' })`。
- Omnibox 产品文案标明 Quick jump / 关键字；模糊口语引导 Side Panel；快捷键须读 `chrome.commands.getAll()` 的 `_execute_action` **当前绑定**（可短 TTL 缓存），未绑定则省略，**禁止**写死 manifest 建议键。
- §5.3 / §0.5 入口表与本文一致；Omnibox 手测以**具体锚点**为主（§5.10.8 · `omnibox_must` §5.11.5）。
- `recallResultToOmniboxSuggests` 仅输出 ≤`OMNIBOX_SUGGEST_LIMIT` 条；改条数只改该常量 + 本文 / 产品文档 Omnibox 条，**不得**顺手改 `RECALL_RESULT_PAGE_SIZE`。
- 换赛道：**仅 CTA SuggestResult**（`yiveno-omnibox-handoff:`）→ `writeRecallPrefill` + `openRecallSidePanel`；有命中时 Memory ≤5 + 末行 CTA；default Tip **不**接力。

**禁止：**

- Omnibox 冒充 Side Panel 全能力或暗示「口语找回主路径」。
- 无命中时静默吞掉回车（须接力或可观测失败日志）。
- 为 Omnibox 单独堆内容别名灰名单（ADR-005）。
- Omnibox 调用向量融合（clue embed / Topic embed / RRF / cosine）或 Outcome 软调；这些属于 Side Panel 主战场。
- 在异步 Recall 完成前对同一次 `onInputChanged` 抢先 `suggest([])`（Chromium 对 `suggest` 按 one-shot 消费时，真实 Memory 建议会被丢弃，地址栏只剩历史补位）。
- 用 `RECALL_RESULT_PAGE_SIZE` 兼作 Omnibox 下拉上限（场景不同，禁止绑死）。
- 突破上文 **§6 能力天花板**（再加一点 AI / Semantic 等）。

**允许：**

- 同 clue 在 Omnibox 与 Side Panel **结果不一致**（入口契约不同，须在文案中可解释）。
- Omnibox 走纯关键词 + 结构化约束路径；与 Side Panel Hybrid 召回的差异是入口定位的自然延伸，不视为回归。
- `OMNIBOX_SUGGEST_LIMIT` 与 Panel 首屏**数值碰巧相同**（仍须两常量分立）。

## 相关

- ADR-001（主壳）、ADR-003（邻域）、ADR-004（LLM 边界）、ADR-005（灰名单）
- 产品文档 §0.5、§5.3、§5.10.1（Omnibox ECS 仍须五要素 suggest）、§3.1 Omnibox 条数
- 代码：`recall-backend.ts`、`hybrid-recall-backend.ts`、`omnibox.ts`、`omnibox-suggest.ts`（`OMNIBOX_SUGGEST_LIMIT`）、`fuzzy-lexicon.ts`、`keyword-filter.ts`（`behaviorProfile`）
