# 任务：测试工作台里程碑 2 —— 生成即标注（线索类型 / 零重叠线索 / 混淆组 / 负例）+ 两处前置修复

> **状态：** 进行中（2026-11-07）— M2 **代码已合 main**；精选路径真机已抽（见 `probe-workbench-brief`：byType/neg 已出数）；**禁止**移入 `docs/archive/` / `docs/audits/`

## 背景与现状（已核查的事实，不要推翻重查）

- 里程碑 1 已落地：分支 `feat/probe-workbench-runner`，提交 `754400f9`。批量 runner 在 `extension/src/dev/probe/probe-batch-runner.ts`；纯逻辑在 `packages/yiveno-probe/src/run/`（types / case-plan / aggregate / diff，均有单测）；运行记录存 chrome.storage.local（`extension/src/dev/probe/probe-run-history-storage.ts`，键 `yiveno.dev.probeRunHistory.v1`，其中的 Zod schema 手工复制了一份 `@yiveno/probe` 的报告类型）；key→id 映射在 `probe-key-id-map-storage.ts`（含 seedContext）；Console 在 `packages/yiveno-probe/src/console/`。
- 语料现状：`packages/yiveno-probe/src/corpus/types.ts` 中书签/摘录 seed 的线索字段是 `suggestedClues: string[]`。精选语料是 5 个 persona 文件（researcher.ts 等）手写字面量。diversity 在 `corpus/diversity.ts`：PACKS 每画像含 hosts / titlePrefixes / subjects / noteTemplates / excerptSnippets；线索只在条目带 note 时（约 16–22%）由模板拼出，且直接复制 note / subject / snippet 的表面词（`the page where I noted ${note}`、`piece about ${snippet.slice(0,32)}…`）。noise 在 `corpus/noise.ts`，`suggestedClues` 恒为 []。
- 判定：`packages/yiveno-probe/src/verify/neighborhood.ts` 的 `judgeProbeNeighborhood(rankedIds, expectedId, k=3)` 与 `rankedIdsFromRecallResult`（RecallResult 形如 `{ topPick: { item } | null, alsoPossible: [...] }`，**topPick 可以为 null**）。
- M1 审核（独立复核，非自述）发现两处低优先问题，本任务先修，见第 0 节。
- 本里程碑**不做**真机种库/跑分验证（需维护者本机库）；门禁通过 + 汇报即可，不要声称真机已验。

在同一分支 `feat/probe-workbench-runner` 上继续工作。提交纪律：第 0 节修复一个独立提交，里程碑 2 一个提交；不要 push，不要 merge，不要动 main。

## 第 0 节：前置修复（先做，独立提交 `fix(probe): runner 延迟计时与均分函数单一事实源`）

1. **runner 延迟计时污染**：`probe-batch-runner.ts` 中每条 case 的计时起点在进度写入（`writeProbeBatchProgress`）之前，p50/p95 含一笔 chrome.storage 写开销。改为：计时起点紧贴 `recallService.recallWithClue` 调用之前；进度写入节流——第 1 条、每满 10 条、最后一条才写（`lastClue` 随节流写带上），结束/出错的进度写保持不变。
2. **均分函数两份实现**：`splitCountAcrossPersonas` 在 `@yiveno/probe` 的 `run/case-plan.ts` 与 `extension/src/dev/probe/recall-probe-seed-service.ts` 各有一份。seed-service 改为从 `@yiveno/probe` 导入，删本地副本。行为必须逐字不变（现有测试全绿为据）。

## 里程碑 2 任务

### 1. 线索类型化（全量迁移，无兼容残留）

- 在 `corpus/types.ts` 新增：
  - `ProbeClueType = 'verbatim' | 'paraphrase' | 'associative' | 'temporal' | 'note' | 'ambiguous'`
  - `ProbeTypedClue = { text: string; type: ProbeClueType }`
- 书签/摘录 seed 的线索字段由 `suggestedClues: string[]` **整体迁移**为 `clues: ProbeTypedClue[]`，删除旧字段，让类型系统强制所有生产者/消费者迁移完毕（不要留 string→type 的静默兜底映射）。
- 精选语料（5 个 persona 文件）逐条人工标注类型，标注口径（保守、可复核）：直接引用标题/主题词 → `verbatim`；指向条目附注内容 → `note`；含时间表达且以时间为主要区分 → `temporal`；只给保存场景/用途、不含内容词 → `associative`；其余改述型 → `paraphrase`。精选里出现成对的"模糊指代"线索可标 `ambiguous`，但精选的 expected 仍是单条，不要把精选改成集合判定。
- 全仓以 `suggestedClues` 为迁移清单：catalog（`catalog/fixture-catalog.ts` 的 rows）、`extension/src/dev/probe/probe-fixture-catalog.ts`、`core/messaging/debug-messages` 中的夹具行类型、Console 中消费夹具目录的代码、M1 的 `run/case-plan.ts`，逐个迁移并在汇报中逐项列出。迁移后全仓不得再有 `suggestedClues` 标识符（noise 的空数组改为 `clues: []`）。
- seed 类型另加可选字段 `role?: 'target' | 'distractor'`；`corpus/noise.ts` 的两个 builder 输出一律带 `role: 'distractor'`，其余 builder 不带（缺省即 target）。不要改 MemoryItem 结构，role 只活在 seed 层。

### 2. diversity 线索生成改造（每条至少 1 条线索；线索生成与内容生成分离）

- 新建纯模块 `corpus/clue-gen.ts`，负责由条目元信息生成类型化线索；`diversity.ts` 的两个 builder 只负责内容（标题/正文/附注），生成后调用 clue-gen 填充 `clues`，**不许再从 note / snippet 字符串截取拼装线索**。
- PACKS 每画像新增 `sceneFragments`（保存理由/场景片段，如 researcher 的 'for the intro of my talk'、creator 的 'for the client deck critique'；每画像 ≥ 8 条，与 subjects/noteTemplates 风格一致、由你按画像补齐）。
- 每条 diversity 条目至少 1 条线索，组合规则（由 rng 决定、确定性）：
  - 条目带 note 时，必有 1 条 `note` 型（可用场景化改写，但须指向 note 语义，不得整段复制 note 原文）；
  - 另必有 1 条场景型线索，从 {`paraphrase`, `associative`, `temporal`} 中按 rng 选一型生成；
  - 可选再加 1 条 `verbatim`（概率约 1/3）。
- **重叠红线（可测定义）**：内容词 = 小写 alphabetic token、长度 ≥ 4、去掉英文停用词（在 clue-gen 内置一份小停用词表）。`associative` 线索与条目（title/pageTitle + subject + note）的**内容词交集必须为空**；`temporal` 同样必须为空（时间表达 + 场景片段组合）；`paraphrase` 不得包含条目完整 subject 字符串、不得包含 note 原文子串（部分词重合允许）。为这三条各写单测，遍历 5 画像各生成 ≥ 50 条逐条断言；`associative`/`temporal` 交集非空即测试失败。
- **确定性红线**：线索生成使用**独立 rng 流**（键含 'clue'，如 `rngForFillerItem(seed, 'clue', index, persona)` 一类键；以 prng.ts 现有签名为准），不得消耗内容生成的 rng 流——同一 (persona, count, seed) 下 diversity 的标题/URL/daysAgo/note/正文必须与改造前逐字一致（用现有 filler-procedural 测试 + 你新增的对照断言证明）。case-plan 重建 diversity 时以相同方式调用 builder 即可得到相同 clues（M1 的重建机制不变）。

### 3. 同主题混淆组（集合判定）

- 新建 `corpus/clusters.ts`，签名与 diversity 对齐：`buildClusterBookmarkSeeds(persona, clusterCount, { seed })`、`buildClusterExcerptSeeds(persona, clusterCount, { seed })`，外加一个供 case-plan 用的元信息 builder `listProbeClusters(personas, { seed, bookmarkClusterCount, excerptClusterCount })` 返回每组 `{ clusterId, persona, kind, memberKeys, preferredKey, ambiguousClue }`。三者内部共享同一生成逻辑，保证成员 seed 与元信息严格对齐（同 seed 同计数 → 同 keys）。
- 每组 3–5 名成员：同 subject（取自该画像 PACKS subjects 或组内专用主题池），不同 host / titlePrefix / daysAgo（组内 daysAgo 互不相同）/ note。成员 key 带组前缀（如 `clu-bm-<persona>-<组序>-<成员序>`）。`preferredKey` = 生成序首位成员。
- 每名成员照常带线索，其中至少 1 条**消歧线索**：指向其独有 note → `note` 型；或指向其独有 daysAgo 的时间表达 → `temporal` 型；或指向其来源 host 的描述 → `paraphrase` 型。每组另有 1 条 `ambiguous` 型线索（只提 subject/场景、组内人人适用），其文本放在元信息的 `ambiguousClue`，不挂到单个成员。
- 判定扩展：`verify/neighborhood.ts` 新增纯函数 `judgeProbeNeighborhoodForSet(rankedIds, expectedIds, preferredId, k=3)`：ranked[0] === preferredId → `top1`；否则任一 expectedIds 落在 top-k → `in_topk`；否则 `miss`。原 `judgeProbeNeighborhood` 不动。
- 接线：cluster 成员按 diversity 相同的路径种库——seed payload 沿 `diversityBookmarkCount` 的既有链路（presets 的 ProbeSeedPayload → `core/messaging/debug-messages` 的解析 → seed-service → seedContext）新增 `clusterBookmarkCount` / `clusterExcerptCount`（**每画像组数**，可选、缺省 0；Console 表单缺省 2）；seed-service 把 cluster 成员并入 filler 写入并登记映射，seedContext 同步记两计数，cleanup 的分类/剪枝对 cluster 成员与 diversity 一视同仁（检查 `recall-probe-purge-classify` 的归类是否覆盖 cluster key 前缀，不覆盖则补）。case-plan 增加 cluster 部分：成员消歧线索 = 单条 expected 普通 case；每组 ambiguous 线索 = 集合 case。

### 4. 负例探针（误报率）

- 新建 `corpus/negatives.ts`：手写负例线索集 `PROBE_NEGATIVE_CLUES: Array<{ key, persona, clue }>`，每画像 ≥ 4 条。主题必须与**全部 5 画像的 subjects 以及 noise 的标题主题**不相交（选库内根本不存在的领域，如兽医牙科、业余无线电年鉴之类），措辞保持真实记忆线索口吻。负例不种库、无 expected id。
- runner 对负例照常调 `recallWithClue`（entry 'omnibox'）：**topPick 为 null → `rejected`（正确拒绝）；topPick 非 null → `false_positive`**，并记录其 top1 标题供人工检视。负例不查映射、不产生 unmapped。

### 5. 报告 / 记录 / Console 同步扩展

- `run/types.ts`：`ProbeBatchCaseResult` 增 `clueType: ProbeClueType`；增可选 `clusterId?: string`、`expectedIds?: string[]`、`preferredId?: string`（集合 case 用，单条 case 不带）。`ProbeBatchVerdict` 增 `'false_positive' | 'rejected'`。`ProbeBatchCaseSource` 增 `'cluster' | 'negative'`。`ProbeBatchAggregates` 增：`byClueType`（同 byPersona 的 group 形状）、`clusters: { total, anyHitCount, preferredTop1Count, anyHitRate, preferredTop1Rate }`、`negatives: { total, falsePositiveCount, rejectedCount, falsePositiveRate }`。
- `run/aggregate.ts`：`judged` 口径不变（仅 top1/in_topk/miss）；false_positive / rejected / unmapped / error 都不进分母。失败优先排序档位：error < unmapped < false_positive < miss < in_topk < top1 < rejected。byClueType 对全部带 clueType 的 case 统计（含 cluster/negative 各自的 verdict）。clusters 节只统计集合 case；negatives 节只统计负例 case。
- `run/diff.ts`：在原有行之后追加 byClueType 各类型的 top1Rate 行（metric 名如 `clueType.associative.top1Rate`）、`clusters.anyHitRate`、`clusters.preferredTop1Rate`、`negatives.falsePositiveRate`；任一侧缺该节/该类型时跳过该行（兼容 M1 记录）。
- **存储 schema 同步（易漏，重点）**：`extension/src/dev/probe/probe-run-history-storage.ts` 的 Zod schema 与上述类型逐字段同步——case 的 source 枚举、verdict 枚举、新可选字段、aggregates 三个新节。**新字段在 schema 中一律 optional，历史键不升版**（不改 `yiveno.dev.probeRunHistory.v1`），保证 M1 已存记录仍可解析；新增一个 round-trip 单测：构造含全部新字段的 report → append → get 读回 → 断言新字段不丢失（防 Zod 静默 strip）。`probe-key-id-map-storage.ts` 的 seedContext schema 同步加两 cluster 计数（optional）。
- Console 侧类型（`console/probe-console-client.ts` 的 View 类型）与消息契约（`core/messaging/debug-messages` 的响应类型/解析器）同步上述变化；ProbeConsole 的聚合行与结果区增加：按线索类型的 top1 率速览、cluster 节与 negative 节各一行摘要。结果表逐条仍用现有列（clue / verdict / top1 标题 / 耗时），集合 case 的 clue 后标注所属 clusterId。

## 硬约束（沿袭里程碑 1）

- 分层：`@yiveno/probe` 保持纯数据/纯函数（禁止 Chrome API / IndexedDB）；接线只在 `extension/src/dev/probe/` 与既有消息契约层；探针代码不进生产召回 runtime；DEV 门禁模式保留。
- 只测量、不改召回核心行为（core/recall 算法与排序不动）；发现召回 bug 只记录汇报。
- 类型严格，禁止 any 逃逸；遵循 `.cursor/rules/project.mdc` 与相邻文件风格、中文注释习惯。
- 里程碑 3 的内容（daysAgo 分布、Zipf、会话爆发、正文片段组合）**本任务不做**，diversity/cluster 的 daysAgo 沿用现有分布。

## 门禁与汇报

每个提交前运行并在汇报中给出实际输出摘要：typecheck、@yiveno/probe 的 vitest、extension 中 dev/probe 与 core/recall/eval 相关 vitest（命令沿用里程碑 1 的口径）。门禁失败先修，修不了停下来汇报，不绕过、不注释测试。

汇报格式（中文）：改动文件清单（按包分组）→ 关键设计决策（线索标注口径的执行情况、clue-gen 的 rng 流键设计、cluster 元信息与成员对齐方式、schema 兼容处理）→ `suggestedClues` 迁移清单逐项 → 门禁实际输出摘要 → 已知风险与未做项（明确写：真机未验）。
