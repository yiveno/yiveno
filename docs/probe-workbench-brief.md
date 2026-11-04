# 任务：把 Yiveno 测试工作台从“种库器”升级为“可记录的召回评测闭环”

## 背景与现状（已核查的事实，不要推翻重查）

- 工作台 UI 在 `packages/yiveno-probe/src/console/ProbeConsole.vue`，文件头自述只有“写入测试数据 + 清理”两件事；种库后没有批量跑线索、没有打分、没有运行历史。
- 语料在 `packages/yiveno-probe/src/corpus/`：精选（5 个 persona 手写，带 suggestedClues）、diversity（模板填空 + 种子 PRNG，素材池每画像仅 10 host × 10 前缀 × 12 主题、摘录正文仅 6 句）、noise（异主题生活标题，suggestedClues 恒为 []）。
- diversity 的 suggestedClues 仅约 1/4 条目有，且模板直接复制条目自身 note/subject 的表面词（如 “the page where I noted X”），对关键词路径是送分题；零词重叠的联想线索在生成部分系统性缺席。
- 判定零件已存在但未装配：`packages/yiveno-probe/src/verify/neighborhood.ts` 的 `judgeProbeNeighborhood`（top1/in_topk/miss）、`packages/yiveno-probe/src/catalog/fixture-catalog.ts` 能展开全部精选线索。
- 唯一的自动检查是 `extension/src/dev/probe/recall-probe-omnibox-smoke.ts` 里写死的 11 条关键词式用例（按标题子串判定），与手测文档对齐用，不是数据驱动的评测。
- 种库服务在 `extension/src/dev/probe/recall-probe-seed-service.ts`：精选走 capture 路径（可 enrich），diversity/noise 直写、不生成 embedding；返回的 probeKeys 仅含精选。
- 召回入口：`extension/src/application/recall/recall-service.ts` 的 `recallWithClue`。真正的评测体系在 `extension/src/core/recall/eval/`，与工作台互不连通。

## 总目标

工作台形成闭环：生成（带标注）→ 种库 → 一键批量运行全部带标注线索 → 判定与聚合 → 运行记录持久化并可与上次 diff → 冻结夹具导出到 eval 体系。按里程碑顺序实施，每个里程碑结束必须跑门禁并在对话里汇报，不要把四个里程碑揉成一个大提交。

## 里程碑 1：批量探针 Runner + 运行记录（核心，先做）

1. 种库时建立并持久化 probe key → MemoryItem id 映射（DEV-only 本地记录；精选、diversity、noise 都要覆盖），清理探针数据时同步清掉失效映射。映射缺失的 key 在报告中单列为 unmapped，不得静默跳过。
2. 新增 DEV-only runner：数据源 = 精选目录全部 suggestedClues + 已种库 diversity 中带线索条目；逐条调用 `recallService.recallWithClue`（entry 与 smoke 一致，用 'omnibox'），用 `judgeProbeNeighborhood`（k=3）判定，expected id 来自第 1 条的映射。
3. 产出运行报告：逐条结果（clue、expected key、verdict、实际 top1 标题、耗时）+ 聚合指标（top1 率、in-top3 率、miss 率、按 persona 与按条目来源分组、延迟 p50/p95）。失败条目排在前面。
4. 运行记录按（配方 id + fillerSeed + 时间戳）持久化到本机（DEV-only 存储），控制台可列出历史运行、可选中两次运行做指标 diff。
5. ProbeConsole 增加“运行探针”区：运行按钮、进度、结果表、历史与 diff。原有 11 条 smoke 保留（手测对齐用途），但 runner 必须数据驱动，禁止再写死用例。

## 里程碑 2：生成即标注（线索类型、零重叠线索、负例、混淆组）

1. 扩展语料类型：线索从 `string[]` 升级为带类型条目 `{ text, type }`，type ∈ `verbatim | paraphrase | associative | temporal | note | ambiguous`；保持对现有精选语料的兼容（迁移或派生，不要丢数据）。
2. diversity 生成改造：每条必须至少 1 条线索；paraphrase/associative 类型的线索禁止复制条目 note/subject 的表面词（用画像包内的“保存理由片段 / 场景片段”词池组合生成，如“for the intro of my talk”这类与正文零重叠的表述）；线索生成逻辑与内容生成逻辑分离，不许再从 note 文本字符串截取拼装。
3. 同主题混淆组：新增带标签的 cluster 生成——同 subject 生成 3–5 条（不同来源/时间/附注），消歧线索（靠附注、时间、来源区分）的 expected 是单条，模糊线索的 expected 是集合；runner 对集合型 expected 按“命中集合任一即 in_topk、命中首选记 top1”的口径判定，并在报告中单列 cluster 结果。
4. 负例：新增“无线索目标”探针集（线索描述的条目不在库中），expected 为“不得给出自信 top pick”；runner 单列负例误报率。noise 保持无线索，但在类型上标明 role: 'distractor'。

## 里程碑 3：分布真实化（只改下列四项，不要扩散）

1. daysAgo 改为近因偏斜的混合分布（约 60% 落在 30 天内、25% 在 31–120 天、15% 在 121–400 天），diversity 与 noise 一致。
2. subject 抽样改 Zipf 加权（包内靠前主题权重更高），不再均匀。
3. 会话爆发：diversity 以 cluster 为单位生成一部分条目——同主题、daysAgo 落在同一窄窗口（±3 天）、批量 3–8 条。
4. 摘录正文改为片段组合生成（引导句 + 论据句 + 限定句三个片段池组合），150 条量级下不同正文数 ≥ 40/画像；禁止再用 6 句固定池加序号后缀充数。

## 里程碑 4：打通 eval（冻结夹具导出）

1. 提供导出动作/脚本：以固定种子生成一版冻结数据集（条目 + 带类型标注线索 + expected 映射），导出为 JSON 夹具放入 `extension/src/core/recall/eval/fixtures/`（probe-generated 命名）。
2. 仿照现有 hybrid-eval 的写法，加一个确定性 vitest：离线（假向量、无网络、无真实 LLM）对该夹具跑关键词/混合路径评测，断言核心指标不低于夹具内记录的基线（基线值写进夹具元数据，注释说明其来源与刷新方式）。

## 硬约束

- 分层不许破坏：`@yiveno/probe` 保持纯数据/纯函数，禁止引入 Chrome API 或 IndexedDB；运行时接线留在 `extension/src/dev/probe/` 与 application 层；任何探针代码不得进入生产召回 runtime；DEV 门禁与 prod-stub 的现有模式必须保留。
- 本任务只“测量”召回，不改召回核心行为（core/recall 的算法与排序逻辑不动）；如发现召回 bug，记录到汇报里，不要顺手改。
- 遵循仓库 `.cursor/rules/project.mdc` 与相邻文件的代码风格、注释密度与中文注释习惯；类型严格，禁止 any 逃逸。
- 在新分支 `feat/probe-workbench-runner` 上工作，按里程碑分提交（commit message 注明里程碑编号）；不要 push，不要 merge，不要动 main。
- 每个里程碑结束时运行并报告：typecheck、@yiveno/probe 的 vitest、extension 中 dev/probe 与 core/recall/eval 相关 vitest。门禁失败先修，修不了就停下来汇报，不要绕过或注释掉测试。

## 每个里程碑的汇报格式

改动文件清单（按包分组）→ 关键设计决策（尤其是映射持久化方案、线索类型迁移方式）→ 门禁实际输出摘要 → 已知风险与未做项。全程用中文汇报。
