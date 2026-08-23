# TTE 基准结论与 Yiveno 目标

## 结论先行

目前**不能诚实地给出“Raindrop 是 X 秒、Reader 是 Y 秒、Recall 是 Z 秒”的公开排行榜**。原因不是这些产品没有搜索能力，而是未发现它们披露在相同个人资料库、相同模糊任务、相同设备和相同“可验证证据”终点下的可复现实测数据。官方材料显示 Raindrop、Reader 和 Recall 都能把用户带到全文、保存内容或可验证引用，但“快”“fast”“blazingly fast”等表述不是可比性能数据。[1] [2] [3]

因此，正确的基准策略是：**将 TTE 作为 Yiveno 的原生质量指标，先用同语料盲测建立真实排名，再用公开能力描述解释结果差异。** 这避免了把营销词、网络条件或不同用户资料量错误地转换为秒数。

## 1. 统一定义

> **TTE-V（Verified Time-to-Evidence）** = 从用户提交模糊需求，到首次看见一个任务相关、ECS≥4 的来源级证据单元所经历的时间。

合格证据单元必须同时提供原始来源身份、可打开原文/保存副本、相关内容锚点、至少一个时间或来源语境，并解释命中原因。只有 AI 总结、不可点击标题、topic cluster 或“模型记得”都不算证据到达。

| 指标                                    | 应报告的统计量  | 价值                                       |
| --------------------------------------- | --------------- | ------------------------------------------ |
| TTE-F                                   | P50/P75/P90     | 首个可验证候选是否出现得足够快。           |
| **TTE-V**                               | **P50/P75/P90** | 用户是否足够快看见可自行核验的证据。       |
| TTE-C                                   | P50/P75/P90     | 用户打开原文并确认后，是否真正结束追查。   |
| Success@180                             | 比例与 95% CI   | 在 180 秒窗口内能否完成任务。              |
| ECS≥4 合格率                            | 比例            | 快速结果是否真的可验证。                   |
| Top-3 Evidence Precision                | 比例            | 系统是否用大量无关候选掩盖低 TTE。         |
| Interaction Burden / Wrong-path Penalty | 中位数 / 分布   | 用户为达到证据付出的改写、筛选和误点成本。 |

## 2. 各类产品的“可比较部分”

| 产品类别           | 可公开确认的证据路径                                                                             | 能否给出公开 TTE 秒数 | 应在实测中重点观察                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------- |
| 原生浏览器历史     | Chrome 的 AI History Search 可用自然语言从已启用后的本地浏览历史找网页。 [4]                     | 否                    | 单浏览器范围内的 query → best-match → open-source；观察跨来源任务的失败。 |
| folder/tag 书签    | 以 keyword、folder、tag 和链接打开为主。                                                         | 否                    | 精确词任务和用户能否回忆分类。                                            |
| archive/read-later | Raindrop 提供网页/PDF/YouTube 全文搜索和保存副本；Reader 提供离线全文搜索与完整文档库。 [1] [2]  | 否                    | 正文抓取完整度、关键词/语义任务、打开原文路径。                           |
| AI-native 知识库   | Recall 宣称基于保存内容的 chat 给出可回到原文段落验证的 citations。 [3]                          | 否                    | “答案出现”到“citation/原文段落可见”之间的差距。                           |
| PKM / graph        | 多靠对象、链接、笔记或全文搜索回到来源。                                                         | 否                    | 是否需要预先手动结构化；多跳导航成本。                                    |
| 平台 AI memory     | ChatGPT/Claude/Gemini 可跨聊天、文件或连接应用记忆/检索。 [5] [6] [7]                            | 否                    | 是否真的能打开与任务相关的原始证据，而不只显示生成回答。                  |
| 浏览器 AI / Agent  | Dia/Comet 利用标签页、历史或连接工具辅助问答/行动；Comet 说明当前标签和相关历史可参与请求。 [8]  | 否                    | action 和 evidence 是否混淆；用户是否能审计模型选材。                     |
| **Yiveno（目标）** | 模糊 query → hybrid candidates → evidence card（原文/锚点/理由）→ 一击确认或 MCP evidence pack。 | 尚无实测              | 把来源级解释、保存意图、时间/行为语境和跨来源完整度转化为 TTE 优势。      |

## 3. Yiveno 应采用的目标阈值

下表是**产品目标**，不代表竞品已测性能。数字的意图是让团队在速度、正确性和可验证性间做可执行取舍。

| 版本阶段 | TTE-F P50 | TTE-V P50 | TTE-V P90 | TTE-C P75 | Success@180 | ECS≥4 | 适用条件                         |
| -------- | --------: | --------: | --------: | --------: | ----------: | ----: | -------------------------------- |
| Alpha    |     ≤3 秒 |    ≤15 秒 |    ≤60 秒 |    ≤35 秒 |        ≥70% |  ≥90% | 内部资料库、已成功解析的资料。   |
| Beta     |     ≤3 秒 |    ≤12 秒 |    ≤45 秒 |    ≤30 秒 |        ≥75% |  ≥92% | 真实种子用户的跨来源保存。       |
| PMF 探索 |     ≤2 秒 |     ≤8 秒 |    ≤30 秒 |    ≤20 秒 |        ≥80% |  ≥95% | 30/90/180 天资料、真实模糊任务。 |

为了避免“更快但更差”，所有版本必须同时满足以下护栏：`Top-3 Evidence Precision ≥ 0.70`、`Median Interaction Burden ≤ 2`、`Wrong-path Penalty P50 ≤ 1`。若系统只是在 2 秒内抛出一个无来源的语言模型回答，则 TTE-V 仍未开始停止计时。

## 4. 最小实验：怎样在 4 周得到可信答案

| 周期      | 样本与任务                                                                           | 产出                                     | 成功门槛                                                       |
| --------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| 第 1 周   | 6–10 位内部/友好用户；每人 10 个、至少 14 天前保存的真实资料任务                     | gold cards、ECS 标注、屏幕录制与事件日志 | 每个任务都有明确目标来源/允许替代来源、关键段落与难度。        |
| 第 2 周   | 同一批任务在当前工具（浏览器历史或现有 bookmark/read-later）与 Yiveno 中随机交叉测试 | 产品级 P50/P90、Success@180、IB/WPP      | 不以平均值代替长尾与失败数据。                                 |
| 第 3–4 周 | 20–30 名种子用户两周 diary study；按来源/资料年龄/任务类型分层                       | 分群 TTE scorecard 与失败 taxonomy       | 只有 `Success@180 ≥70%` 且 `ECS≥4 ≥90%`，才进入定价/分发实验。 |

## 5. 需要新增到产品的数据事件

`query_submitted`、`result_rendered`、`evidence_visible`、`source_opened`、`user_confirmed`、`query_refined` 和 `task_timeout` 是最小集合。每个证据结果都应保存 `source_id`、原文 anchor、ECS、reason codes、rank 和 trace ID。没有这些数据，团队只能测模型耗时，而无法测用户的 Time-to-Evidence。

## 一句话决策

**把 TTE-V 和 TTE-C 作为 Yiveno 的核心体验指标：不是“模型多久回答”，而是“用户多久拿到并验证自己真正需要的原始资料”。**

## References

[1]: https://raindrop.io/ 'Raindrop.io 官方主页'
[2]: https://readwise.io/read 'Readwise Reader 官方产品页'
[3]: https://www.recall.it/compare 'Recall：grounded chat and verifiable citations'
[4]: https://support.google.com/chrome/answer/15305774?hl=en 'Google Chrome Help：Search your browsing history in Chrome with AI'
[5]: https://help.openai.com/articles/8590148-memory-faq 'OpenAI Help：Memory FAQ'
[6]: https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context 'Claude Help：Use Claude’s chat search and memory'
[7]: https://gemini.google/overview/personal-intelligence/ 'Gemini：Personal Intelligence'
[8]: https://www.perplexity.ai/hub/blog/introducing-privacy-snapshot 'Perplexity：Introducing Privacy Snapshot'
