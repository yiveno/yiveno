# Omnibox 离线快跳 · 手测步骤（ADR-007）

> **Normative 摘要：** [`Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) **§5.10.8**。  
> **架构：** [`ADR-007`](../architecture/decisions/ADR-007-omnibox-offline-lookup.md)。  
> **自动化 must：** `extension/src/core/recall/eval/omnibox-eval.test.ts`（`omnibox_must`）。  
> **DEV API 总索引：** [`DEV-调试API.md`](./DEV-调试API.md)（`yiveno.seedRecallProbe` · `yiveno.runProbeOmniboxSmoke` 等）。

---

## 1. 测什么 / 不测什么

| 测                                                                            | 不测                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------ |
| 地址栏 `yi` + **具体关键字** → 建议列表 → 回车打开                            | Omnibox 口语模糊找东西（归 Side Panel）    |
| 建议 description **ECS 五要素**（紧凑布局：标题 — host · 类型 · 时间 · 字段） | MCP 地址栏自动化（MCP 不可靠触发 omnibox） |
| **无 match** 时默认文案引导 Side Panel                                        | Omnibox 多轮 / framing / need_a_clue 追问  |
| SW 日志：`entry: omnibox`、`understandSource: rules`、无 framing              | 与 Side Panel 同 clue 结果必须一致         |

**预计耗时：** 10–15 分钟（含 1 条 Side Panel 对照）。

---

## 2. 前置

1. `cd extension && bun run build` → `chrome://extensions` 重新加载 Yiveno。
2. **库来源（你本地多为探针种库）：** 若曾跑过 `yiveno.seedRecallProbe({ replace: true })` 或默认三主题包种库，**手写精选**条目来自 `@yiveno/probe` 的 researcher / creator / developer 语料（Manifest V3、Stripe 幂等、远程办公、字体配对等）。**压力 ~20k 库**时部分线索可能被**无关干扰**顶掉——下文「压力库备注」有说明。  
   （「种库」= 写入测试数据，≠ §5.9 种子验证；见术语表 §8.1。）
3. 可选：Side Panel 已打开（`Alt+Shift+Y`），便于对照。
4. SW 日志备查：`chrome://extensions/?errors=<扩展id>`。

### 2.1 种库后全无命中？（常见误用）

| 现象                                                                       | 原因                                                                           | 处理                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 输入 `yi i18n:check` / `yi Cloudflare Workers` 无结果                      | **旧版手测**对齐的是 `recall-eval` 内存夹具，**不是**探针种库                  | 改用下文 §4.1 复制块；勿混用 eval 专用 token                                               |
| 库里有 **Migrate to Manifest V3**，但 clue 是 `chrome extension migration` | 正常：靠 **URL / 标题碎片 / 附注** 匹配，不是标题逐字相同                      | 仍应 Top1；在 SW 跑 `await yiveno.runProbeOmniboxSmoke()` 验 11 条                         |
| `seedRecallProbe` 后立刻测，全空                                           | 种库未 `await` 完或 `indexRebuilt: false`                                      | `await yiveno.seedRecallProbe({ replace: true })` 看返回；`chrome://extensions` 重载后再测 |
| 压力 ~20k 库部分线索被顶掉                                                 | 无关干扰条目挤排序                                                             | 用默认质量种库（约千条完整测试库）即可；或改测 §4.1 的 1–4                                 |
| 只见浏览器历史（如 ChatGPT 链接）、从不见 Bookmark/Excerpt 前缀建议        | 曾对同一次 `onInputChanged` 先 `suggest([])` 再异步回写；Chrome 丢弃第二次建议 | 已修（2026-10）：只在结果就绪后 `suggest` 一次；重载扩展后再测 `yi github`                 |
| `yi chat` 只有历史、Side Panel 也空                                        | **库内没有**含 chat 的 Memory；历史 ≠ IndexedDB                                | 用 Side Panel 先确认库内有的锚点（如 `github`），再回 Omnibox 测同 clue                    |

**SW 一键验库（种库后）：**

```js
await yiveno.runProbeOmniboxSmoke()
// passed === total → 与 §4.1–4.2 对齐；失败项见 console.warn
```

**说明：** `cd extension && bun run test:run -- omnibox-eval` 测的是 **eval 内存语料**（`Manifest V3` / `i18n:check` 等），与探针种库手测 **相互独立**；两者都应绿，但线索表不同。

---

## 3. 基本触发

1. `Cmd+L` / `Ctrl+L` 聚焦地址栏。
2. **整行粘贴**下方「复制即用」块（已含 `yi ` 前缀），或先打 `yi` 再粘贴后半段。
3. 看下拉建议 → 回车或点第一条。
4. 书签 → 真实 URL；摘录 → `detail.html` 或源站。

---

## 4. 复制即用 · 建议测试输入

> **用法：** 每行 = 地址栏**整行**输入（`yi` + 空格 + 你记得的碎片）。  
> **语气：** 模拟普通人记得一半标题/站点/当时备注时的敲法，**不是** eval 专用 token。  
> **期望：** 「大概会打开」= 探针**手写精选**条目；压力库见备注。

### 4.1 具体锚点（应能快跳 · 建议 6 条里抽 3 条测）

| #   | 地址栏整行（复制）              | 你大概会打开（手写精选）                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------ |
| 1   | `yi chrome extension migration` | 书签 **Migrate to Manifest V3**（developer.chrome.com）                        |
| 2   | `yi stripe idempotent`          | 书签 **Idempotent requests**（Stripe 文档；附注 payments incident）            |
| 3   | `yi postgres explain`           | 书签 **Using EXPLAIN - PostgreSQL**                                            |
| 4   | `yi github actions cache`       | 书签 **Caching dependencies to speed up workflows**                            |
| 5   | `yi remote work science`        | 书签 **The surprising science of remote work**（FT）                           |
| 6   | `yi font pairing editorial`     | 书签 **Font pairing ideas for editorial sites**（Typewolf）                    |
| 7   | `yi note taking apps`           | 书签 **Why note-taking apps fail researchers**（附注 disagree with section 3） |
| 8   | `yi reading list useful`        | 书签 **Ask HN: How do you keep a reading list useful?**                        |

**一次性复制（逐行测，不要合并成一行）：**

```text
yi chrome extension migration
yi stripe idempotent
yi postgres explain
yi github actions cache
yi remote work science
yi font pairing editorial
yi note taking apps
yi reading list useful
```

**通过：** 每条 Top 建议与上表「大概会打开」一致或极接近；description **ECS 五要素**齐全；回车可达。

**压力库备注：** `yi chrome extension migration` 仍应稳；`yi deploy checklist` / `yi release checklist` 类输入在 ~20k（半仿真+无关干扰）库上**可能**被顶掉——压力验收请改测上表 1–4，或先用默认质量种库（约千条完整测试库）。

### 4.2 摘录 / 附注碎片（可选加测 2 条）

| #   | 地址栏整行（复制）       | 你大概会打开                                                          |
| --- | ------------------------ | --------------------------------------------------------------------- |
| 9   | `yi promise all settled` | 摘录：MDN promises 里 **Promise.allSettled** 那段                     |
| 10  | `yi payments incident`   | 摘录或书签：Stripe **idempotency key** 相关（附注 payments incident） |
| 11  | `yi hug contents`        | 摘录：Figma auto layout **Hug contents first** 那段                   |

```text
yi promise all settled
yi payments incident
yi hug contents
```

### 4.3 R0 负例（应无快跳 · 必测 2 条）

普通人会把地址栏当「问一句」——Omnibox 须诚实空，并引导 Side Panel。

| #   | 地址栏整行（复制）                    | 通过标准                                                                                                |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| N1  | `yi play some songs I like`           | 第1行 Tip（关键字 vs 模糊；点/回车**不**接力）；第2行 CTA；**仅点第2行** → Side Panel 预填并自动 Recall |
| N2  | `yi summarize the latest news for me` | 同上                                                                                                    |
| N3  | `yi recommend a movie tonight`        | 同上（推荐≠找东西）                                                                                     |

```text
yi play some songs I like
yi summarize the latest news for me
yi recommend a movie tonight
```

### 4.4 Side Panel 对照（同库 · 各复制一行）

**Omnibox** 用短碎片；**Side Panel** 用稍长的口语（仍像真人，不是工程师 token）。

| 场景                    | Omnibox（地址栏整行）           | Side Panel（Clue 框整行粘贴）                             |
| ----------------------- | ------------------------------- | --------------------------------------------------------- |
| 分轨 · 具体             | `yi chrome extension migration` | `that chrome extension migration guide I bookmarked`      |
| 分轨 · 负例             | `yi play some songs I like`     | `play some songs I like`                                  |
| 半模糊（仅 Panel 必中） | `yi remote work`（可弱）        | `that article on remote work science I saved with a note` |

```text
yi chrome extension migration
```

Side Panel：

```text
that chrome extension migration guide I bookmarked
```

**通过：** Omnibox **无** framing 长段；Side Panel 可有 framing / LLM；负例两侧均诚实空。

---

## 5. SW 日志核对（开发者 · 可选）

复现 `yi chrome extension migration` 后，在 `chrome://extensions/?errors=<id>` 或 SW 控制台查找：

- `Omnibox 离线查找：流水线结束`
- `understandSource: rules`（非 `llm`）
- `outcome: top_pick`（具体锚点）
- **无** framing NLG 成功路径

---

## 6. 回归检查表

- [ ] 默认行 = Tip（`Title, site, or note keyword. Fuzzy → Side Panel`）；快捷键与 shortcuts 一致（未绑定则无括号）；非 CTA
- [ ] 无命中 = CTA 行 `No quick match — open Side Panel to recall this`（点该行接力；非 Tip）；自动提交完整 Recall
- [ ] **有命中** = Memory 行 ≤5，**末行** `Not what you wanted? Open Side Panel`（点末行接力同 clue；点 Memory 仍打开条目）
- [ ] 常开 / 高 settled 条目在同词面下更靠前（个人 soft rank）
- [ ] `cf Workers` 等缩写锚：**不**依赖静态字典命中；无字面/形态命中时诚实 miss 或换 Side Panel（ADR-005）
- [ ] §4.1 具体锚点 **3/3**（从上表 8 条里任选 3 条）
- [ ] §4.3 负例 **2/2**（N1 + N2 最少）
- [ ] §4.4 Side Panel 对照 **1 组**（具体锚点）
- [ ] `cd extension && bun run test:run -- omnibox-eval` 绿

---

## 7. 实现锚点

| 模块                     | 路径                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **DEV API 总索引**       | [`DEV-调试API.md`](./DEV-调试API.md)                                                                              |
| 探针语料（手写精选条目） | `@yiveno/probe`（`packages/yiveno-probe/src/corpus/`）                                                            |
| Omnibox 监听             | `extension/src/background/listeners/omnibox.ts`                                                                   |
| `entry: 'omnibox'` 分支  | `extension/src/application/recall/backends/hybrid-recall-backend.ts`                                              |
| suggest 文案 / ECS       | `extension/src/core/recall/omnibox-suggest.ts`（`OMNIBOX_SUGGEST_LIMIT=6`，与 Panel 首屏解耦）                    |
| i18n                     | `omnibox_default_suggestion[_with_shortcut]` · `omnibox_no_match[_with_shortcut]`（快捷键来自 `commands.getAll`） |
| `omnibox_must`           | `omnibox-eval-cases.ts` · `run-omnibox-eval.ts`                                                                   |
