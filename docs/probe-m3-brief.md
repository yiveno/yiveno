# 任务：测试工作台里程碑 3 —— 分布真实性（时近偏斜 / Zipf 主题 / 会话爆发 / 摘录组合）+ M2 审核 LOW 前置修复

## 背景与现状（已核查的事实，不要推翻重查）

- 里程碑 1、2 已落地并通过独立审核：分支 `feat/probe-workbench-runner`，提交链 `36b3eaaf`（main）→ `754400f9`（M1）→ `0ff792ac`（M2 第 0 节）→ `e568dd24`（M2）。批量 runner、类型化线索、混淆组、负例、报告三节（byClueType / clusters / negatives）均已就位。
- M2 独立审核结论为「代码通过、真机未验」，遗留 3 个 LOW 与若干观察项；本任务第 0 节先修其中可独立修复的部分（口径与生成质量），再做里程碑 3。
- 生成层现状（`packages/yiveno-probe/src/corpus/`）：diversity 的 daysAgo 为均匀抽样（书签 `1 + nextInt(400)`、摘录 `2 + nextInt(300)`）；subject 为 `rng.pick` 均匀抽取（每画像 12 个）；摘录正文 = 6 条 excerptSnippets 之一 + ` (div N)` 后缀；cluster 的 uniqueDaysAgo 为 1–400 均匀去重，成员附注带 ` · cluster N member M` 脚手架后缀、摘录正文带 `(cluster c mM)` 后缀；noise 不在本任务范围。
- 确定性机制现状：每条 filler 由 `rngForFillerItem(seed, kind, index, persona)` 独立流生成；case-plan 与 seed-service 都调用同一批 builder，因此两侧天然对齐。M2 曾要求「线索改造不改变内容生成」，**该约束到 M2 为止**：本里程碑是分布改造，内容输出必然与 M2 不同，不要求与旧版逐字一致；要求的是同 (persona, count, seed) 自洽可复现（现有 filler-procedural / clue-gen 复现测试的口径）。
- 本里程碑**不做**真机种库/跑分验证（需维护者本机库）；门禁通过 + 汇报即可，不要声称真机已验。

在同一分支 `feat/probe-workbench-runner` 上继续工作。提交纪律：第 0 节修复一个独立提交，里程碑 3 一个提交；不要 push，不要 merge，不要动 main。

## 第 0 节：M2 审核 LOW 前置修复（先做，独立提交 `fix(probe): M2 审核 LOW 修复（负例口径/消歧唯一/脚手架与 note 线索）`）

1. **负例污染 byClueType**：`run/aggregate.ts` 对 `source === 'negative'` 的 case 不计入 byClueType（byPersona / bySource 照常计）。case 上负例的 `clueType: 'associative'` 字段值保留（类型必填，仅作展示），在 case-plan 负例处加注释说明该口径。同时 `run/diff.ts` 中 clueType 行的 top1Rate 改用 **judged 分母**（top1 / (top1 + in_topk + miss)，分母为 0 时跳过该行），与主指标口径对齐；其余 diff 行不变。补/改 run.test.ts：断言负例不出现在 byClueType 中；构造含 unmapped 的类型组断言 diff 用 judged 分母。
2. **cluster 消歧线索不保证组内唯一**：`corpus/clusters.ts` 的 draftClusterMembers 改为组内**不放回抽样** host / titlePrefix / noteTemplate（用组级 rng 对池副本洗牌后按成员序分配；池容量 hosts 10 / prefixes 10 / noteTemplates 6 ≥ 成员上限 5，可行）。消歧线索的 host 型标签改用**完整 hostname**（仅去掉 `www.` 前缀，不再截第一段——现实现下 developer 画像的 developer.mozilla.org 与 developer.chrome.com 会撞出同一标签 `developer`）。另在 clusters.ts 新增导出 `getClusterMemberDisambiguationClue(member)`（返回成员 clues 的最后一条，注释绑定 builders 的 append 顺序契约），`run/case-plan.ts` 改为调用它，不再自行按下标取。补单测：5 画像 × 至少 2 个 seed，逐组断言消歧线索文本组内两两不同。
3. **cluster 脚手架后缀**：成员附注改为纯 noteBase（删 ` · cluster N member M`），摘录正文删 `(cluster c mM)` 后缀。`extension/src/dev/probe/recall-probe-purge-classify.ts` 中依赖该后缀的两处模式随之删除；cluster 成员的清理识别靠已有 URL 规则（`/cluster/`、`/cluster-excerpt/`）覆盖。扩展 recall-probe-purge-classify.test.ts：构造无后缀的 cluster 形态条目（附注为纯模板、正文无后缀、URL 带 /cluster/）断言仍被分类为 filler。既有测试若有样本靠后缀识别，改为 URL 形态。
4. **diversity note 型线索无内容锚**：现状 clue-gen 的 note 线索是 4 条通用模板 + 场景，不携带附注信息。改法：`DiversityHostPack` 新增 `noteHints: readonly string[]`，与 `noteTemplates` **下标一一对应**（每画像 6 条，手写短语，如 researcher 的 'cite in weekly research digest' → 'to cite in my weekly research digest'；风格与 sceneFragments 一致，由你按画像补齐）。diversity 两个 builder 选 noteTemplate 时改用下标抽取并把对应 hint 传给 clue-gen（`ClueGenItemMeta` 新增可选 `noteHint`）；clue-gen 的 note 线索 = 脚手架句式 + hint（如 `the page I noted ${hint}` 一类，句式可自选 ≥ 3 种轮换），**仍不得包含附注原文整串**。补单测：仅 note/hint 不同的两个 meta 生成的 note 线索文本不同；note 线索不含完整 note 字符串。cluster 成员的消歧 note 型线索维持引用 noteBase 的现状（其组内唯一性已由第 2 项保证），不强制用 hint。

## 里程碑 3 任务（独立提交 `feat(probe): 里程碑3 分布真实性（时近偏斜/Zipf/会话爆发/摘录组合）`）

### 1. 分布工具（新建纯模块 `corpus/distribution.ts`）

- `sampleSkewedDaysAgo(rng)`：时近偏斜混合分布——60% 取 1–30 天、25% 取 31–120 天、15% 取 121–400 天（各段内均匀）。
- `pickZipfWeighted(rng, list)`：按下标秩 Zipf 权重 `1 / (rank + 1)` 抽取（rank 从 0 起）。PACKS 的 subjects 数组序即热度序（数组越靠前越热门，不另加权字段）。
- `planDaysAgoSequence(seed, kindKey, persona, count): number[]`：序列级天数规划（会话爆发）。用 `rngForFillerItem(seed, kindKey, 0, persona)` 作一条**顺序消费**的流（kindKey 由调用方传 `'days-bm'` / `'days-ex'`，使书签与摘录序列独立）：逐下标推进——不在爆发中时以概率 **0.45** 开启一个爆发：中心日由 `sampleSkewedDaysAgo` 抽取、规模 `3 + nextInt(6)`（3–8 条）；爆发内条目 daysAgo = 中心 ± 3 天（`nextInt(7) - 3`，clamp 到 1–400）；不在爆发中的条目直接用 `sampleSkewedDaysAgo`。
- 三者均为纯函数、无副作用；模块头注释写清参数与设计意图（真实库的时近偏斜、主题集中、保存成簇）。

### 2. diversity 接线

- 两个 builder 在循环前先 `planDaysAgoSequence(seed, 'days-bm' | 'days-ex', persona, count)`，条目 daysAgo 取规划值；**删掉条目流里原有的 daysAgo 抽样**（条目流后续抽取顺位随之改变，属预期，不要为保旧输出做任何补偿）。摘录原 2–301 的范围随规划统一到 1–400。
- subject 抽取改用 `pickZipfWeighted`（弱标题/弱页名分支的抽取顺序与现状保持一致，仅把 subject 的那次抽取换成 Zipf；摘录弱页分支 subject 仍为空串）。
- 摘录正文三段组合：`DiversityHostPack` 新增 `excerptMiddles`、`excerptClosers`（每画像各 ≥ 8 条，与现有 excerptSnippets 风格一致的完整句子，由你按画像手写补齐）；selectedText = `excerptSnippets` 抽一条 + middles 抽一条 + closers 抽一条，空格拼接；**删除 ` (div N)` 后缀**（filler-procedural.test.ts 中对该后缀的断言同步删除/改写；清理识别靠 sourceUrl 的 yiveno-div 指纹，已有规则覆盖）。
- note 概率、弱标题概率、URL/pathSlug 等其余生成逻辑不动。

### 3. clusters 接线

- `uniqueDaysAgo` 改为用 `sampleSkewedDaysAgo` 抽样去重（保留现有 guard 兜底逻辑）；组内天数仍两两不同。cluster 不做爆发（组本身即簇），不做 Zipf（subject 本就是组内同一主题）。

### 4. 分布与结构测试（新建 `corpus/distribution.test.ts`，全部固定种子）

- 偏斜分布：对 `sampleSkewedDaysAgo` 以固定流抽 4000 次，三段占比与 60/25/15 的偏差各 ≤ 4 个百分点；值域恒在 1–400。
- Zipf 集中度：对 12 元列表以固定流抽 1200 次，top-3 占比落在 [0.50, 0.68]，且每个元素至少出现 1 次。
- 爆发结构：`planDaysAgoSequence` 固定 seed、count = 150——「成簇条目占比」（存在另一条目与其 daysAgo 相差 ≤ 3 的条目比例）≥ 0.5；按 daysAgo 排序后以相邻间隔 ≤ 3 分组，规模 ≥ 3 的组数 ≥ 4；同时 ≤ 30 天条目占比 ≥ 0.45（爆发的边缘涂抹后仍保持时近偏斜的大致形状）。
- 摘录多样性：5 画像各以固定 seed 生成 150 条摘录，互异 selectedText ≥ 40 条，且无一条以 `(div N)` 结尾。
- 既有复现测试（filler-procedural、clue-gen、extended-personas、run.test）保持全绿：同 seed 两次生成的全部字段（含新 daysAgo 与新正文）逐字相等。
- 在汇报中给出上述统计的**实测数值**（各段占比、top-3 占比、成簇占比、互异正文数），供审核方对照。

## 硬约束（沿袭里程碑 1、2）

- 分层：`@yiveno/probe` 保持纯数据/纯函数（禁止 Chrome API / IndexedDB）；探针代码不进生产召回 runtime；`core/recall` 算法与排序不动；精选语料（5 个 persona 文件）与 noise 生成本任务不改（第 0 节第 4 项只动 diversity 的 PACKS 与 clue-gen，不动精选条目本身）。
- 确定性契约：生成必须是 (persona, count, seed) 的纯函数；case-plan 与 seed-service 继续共用同一批 builder，不新增任何需要两侧同步的旁路参数（seedContext 结构不变，Console 与消息契约不改）。
- 统计测试只用固定种子与容差带，禁止依赖真实随机或当前时间的断言；测试在 CI 环境须确定性通过。
- 类型严格，禁止 any 逃逸；遵循 `.cursor/rules/project.mdc` 与相邻文件风格、中文注释习惯。
- 里程碑 4 的内容（冻结夹具导出到 core/recall/eval + 离线基线断言）**本任务不做**。

## 门禁与汇报

每个提交前运行并在汇报中给出实际输出摘要：typecheck、@yiveno/probe 的 vitest、extension 中 dev/probe 与 core/recall/eval 相关 vitest（命令沿用里程碑 1、2 的口径）。门禁失败先修，修不了停下来汇报，不绕过、不注释测试。

汇报格式（中文）：改动文件清单（按包分组）→ 第 0 节四项的逐项落实说明 → 分布实测数值（第 4 节所列）→ 关键设计决策（不放回抽样的实现方式、noteHints 的对应关系维护方式、正文组合的池规模）→ 门禁实际输出摘要 → 已知风险与未做项（明确写：真机未验；内容输出与 M2 不再逐字一致属预期）。
