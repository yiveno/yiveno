# Omnibox 离线快跳 · 手测步骤（ADR-007）

> **Normative 摘要：** [`Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) **§5.10.8**。  
> **架构：** [`ADR-007`](../architecture/decisions/ADR-007-omnibox-offline-lookup.md)。  
> **自动化 must：** `frontend/src/core/recall/eval/omnibox-eval.test.ts`（`omnibox_must`）。

---

## 1. 测什么 / 不测什么

| 测                                                               | 不测                                       |
| ---------------------------------------------------------------- | ------------------------------------------ |
| 地址栏 `yi` + **具体关键字** → 建议列表 → 回车打开               | Omnibox 口语模糊找回（归 Side Panel）      |
| 建议 description **ECS 五要素**（与 §5.10.1 一致）               | MCP 地址栏自动化（MCP 不可靠触发 omnibox） |
| **无 match** 时默认文案引导 Side Panel                           | Omnibox 多轮 / framing / need_a_clue 追问  |
| SW 日志：`entry: omnibox`、`understandSource: rules`、无 framing | 与 Side Panel 同 clue 结果必须一致         |

**预计耗时：** 10–15 分钟（含 1 条 Side Panel 对照）。

---

## 2. 前置

1. `cd frontend && bun run build` → `chrome://extensions` 重新加载 Yiveno。
2. 库内至少有可区分条目（开发可用探针库；日常可用下列锚点之一）：
   - 书签标题含 **Manifest V3** 或 **Cloudflare Workers**
   - 摘录正文含独特 token（如 `i18n:check`）
   - 附注含 **deploy checklist** 类短语
3. 可选：Side Panel 已打开（`Alt+Shift+Y`），便于对照。
4. 打开 SW 错误页备查：`chrome://extensions/?errors=<扩展id>`（日志级错误，非必红）。

---

## 3. 基本触发

1. 焦点在**地址栏**（`Cmd+L` / `Ctrl+L`）。
2. 输入关键字前缀 **`yi`**（manifest 中 `omnibox.keyword`）。
3. 空格后继续输入 clue，例如：`yi manifest v3`。
4. 观察下拉建议（Chrome Omnibox suggest）：
   - 有命中：条目 description 含类型、域名、保存时间、命中理由等。
   - 无命中：默认行应为 `omnibox_no_match` 文案（引导 Side Panel）。
5. **回车**或选中第一条：
   - 书签 → 经 `omnibox-open.html?id=` 打开真实 URL。
   - 摘录 → `detail.html?id=` 或直链（以实现为准）。

---

## 4. 必测用例（与 `omnibox_must` 对齐）

在**含 eval 同级锚点**的库上测；个人库可替换为等价关键字，通过标准不变。

| #   | 地址栏输入（`yi` 后）              | 通过标准                                                |
| --- | ---------------------------------- | ------------------------------------------------------- |
| 1   | `manifest v3`                      | Top 建议为目标书签/摘录；description ECS 齐全；回车可达 |
| 2   | `i18n:check`                       | 命中含该 token 的摘录（或你库中等价条目）               |
| 3   | `github.com/...` 或已知 host       | host 对齐的条目在建议首位或前 3                         |
| 4   | `play some songs I like`           | **无**有效条目建议；默认文案提示 Side Panel             |
| 5   | `summarize the latest news for me` | 同上，诚实无快跳                                        |

**ECS 五要素（建议行 / 卡面）：** 来源身份 · 保存时间 · 内容锚点 · 命中理由 · 可达原文（§5.10.1）。

---

## 5. Side Panel 对照（分轨验收）

同一库、同一 clue，对比 **Omnibox vs Side Panel**：

| clue                              | Omnibox 预期                            | Side Panel 预期                        |
| --------------------------------- | --------------------------------------- | -------------------------------------- |
| `Manifest V3`                     | `rules` 快跳，**无** framing 气泡       | 可有 framing + `understandSource: llm` |
| `play some songs I like`          | 无建议 / no_match 文案                  | 诚实空（可无 framing）                 |
| `articles about Yiveno`（半模糊） | 可能弱命中或空；**不**要求与 Panel 一致 | 可返回多卡邻域                         |

**通过：** Omnibox 不出现 Side Panel 式 framing 段落；模糊 clue 时 Omnibox 文案引导 `Alt+Shift+Y`。

### 5.1 SW 日志核对（开发者）

1. `chrome://extensions/?errors=<id>` → 重新加载后复现一次 `yi manifest v3`。
2. 在错误页或 DevTools（若已 attach SW）查找：
   - `[Yiveno:Recall]` 或 `Omnibox 离线查找：流水线结束`
   - `understandSource: rules`（非 `llm`）
   - `outcome: top_pick`（具体锚点）
   - **无** `RecallFraming` / framing NLG 相关成功路径日志

---

## 6. 回归检查表

- [ ] 默认占位文案为 `omnibox_default_suggestion`（含 Quick jump + Side Panel 引导）
- [ ] 无命中时为 `omnibox_no_match`
- [ ] 具体锚点 3/3 可打开目标
- [ ] R0 负例 2/2 无假装命中
- [ ] Side Panel 对照 1 条：Omnibox 无 framing
- [ ] `cd frontend && bun run test:run -- omnibox-eval` 绿

---

## 7. 实现锚点

| 模块                    | 路径                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| Omnibox 监听            | `frontend/src/background/listeners/omnibox.ts`                      |
| `entry: 'omnibox'` 分支 | `frontend/src/application/recall/backends/hybrid-recall-backend.ts` |
| suggest 文案 / ECS      | `frontend/src/core/recall/omnibox-suggest.ts`                       |
| i18n                    | `omnibox_default_suggestion` · `omnibox_no_match`                   |
| `omnibox_must`          | `omnibox-eval-cases.ts` · `run-omnibox-eval.ts`                     |
