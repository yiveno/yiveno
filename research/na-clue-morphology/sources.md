# Sources & bias · v0

## 已采公开源

| 源                           | URL / 路径                                                 | 用途                      | 偏差                        |
| ---------------------------- | ---------------------------------------------------------- | ------------------------- | --------------------------- |
| Marqly blog/FAQ/home         | marqly.com                                                 | 理想口语例句              | 营销润色                    |
| Fabric bookmarks page        | fabric.so/for-your/bookmarks-and-links                     | 例句                      | 营销                        |
| ReCollect AI search          | recollectnow.com/ai-search.html                            | Popular searches          | 「people use」未证          |
| Findmark README              | github.com/daveshenal/findmark                             | Try searching like this   | 作者自拟                    |
| SaveSync blog                | savesync.org/blog/find-anything                            | 「real query patterns」   | 声称用户；仍可能筛选        |
| Bookmarkjar / MarkIt / Solem | 各产品页                                                   | 零星例句                  | 营销                        |
| ContextBolt blog             | contextbolt.com/blog/semantic-search-bookmarks             | 概念查询例                | 偏 Twitter 书签             |
| HCI / PIM                    | Dumais SIS；Elsweiler diary；Arguello TOT arXiv:2101.07124 | 情节记忆、hedge、对人口语 | 电影 TOT ≠ 书签，机制可迁移 |
| 本仓 TTE                     | `research/tte-beta-2026-09/`                               | v2 口语 clue              | 维护者自拟；非 NA 外人      |

## 已知偏差

1. **营销偏完整从句** — 真人更短、更碎、更多 `stuff`/`thing`/`i think`。
2. **无人口统计** — 未验证说话人是否北美母语。
3. **发现 vs 再找混杂** — `ideas for a trip` / `birthday gift ideas` 可能是逛一簇，不是钉死一条。
4. **命令腔** — `Find my saved…` 像对助手发令，Yiveno 主路径应弱化。
5. **本仓 ESL 风险** — 术语表 D05 类语序会污染「北美口语」想象。

## 下一步采法（建议顺序）

| #   | 动作                                                                         | 产出                                                 | 成本     |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| 1   | 再采 30–50 条：Reddit tipofmytongue /「lost bookmark」吐槽（只取英文再找句） | `corpus-draft` 扩 `R*`                               | 0.5–1d   |
| 2   | 本机 `yiveno.recallTelemetry` clue 本地形态标注（n=1 也可）                  | `corpus-local.md`（gitignore）                       | 1h       |
| 3   | 5–8 名 NA 微访谈：先口述「跟朋友怎么说」→ 再打进 Side Panel                  | `interviews/`                                        | 高；真金 |
| 4   | 样本 ≥80 且人工审后                                                          | 回写产品文档示例 + 术语表废 ESL 句；TTE SOP 模板微调 | 文档变更 |

## 不做

- 不把本包写进 `must` eval
- 不建内容别名灰名单「通解」口语变体
- 不在未访谈前对外宣称「我们已掌握北美口语分布」
