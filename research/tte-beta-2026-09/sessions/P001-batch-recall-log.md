# P001 批量 Recall 对拍（清库后 · 2026-09-01）

> MCP Side Panel UI 路径 · 扩展 v4.0.0 · **user_confirmed / ECS 未填**

## 汇总

| 指标          |           结果 |
| ------------- | -------------: |
| top-3 含 gold | **9/10** (90%) |
| Top1 = gold   | **7/10** (70%) |
| 完全未进邻域  |    **1** (T01) |

## 逐任务

| Task | Gold id (短) | 邻域 | UI rank | top-3 | Top1 | 备注                                  |
| ---- | ------------ | ---: | ------: | ----- | ---- | ------------------------------------- |
| T01  | `3bd21d4b`   |    6 |       — | ❌    | ❌   | related meaning 污染；gold 未出现     |
| T02  | `03367e5c`   |    9 |      #2 | ✅    | ❌   | 书签 `bd13e060`（cut CI minutes）排前 |
| T03  | `32e6acb3`   |   13 |      #1 | ✅    | ✅   | purge 后重选                          |
| T04  | `4ef8917b`   |    9 |      #2 | ✅    | ❌   | 同页书签排前                          |
| T05  | `16e2db0d`   |    5 |      #1 | ✅    | ✅   | 真实 example.com                      |
| T06  | `6745c90c`   |   17 |      #1 | ✅    | ✅   | 附注「hybrid teams slide」命中        |
| T07  | `1b6604a6`   |   21 |      #1 | ✅    | ✅   | 弱标题 + NSF 附注                     |
| T08  | `97cc7ad6`   | 49\* |      #1 | ✅    | ✅   | \*展示 1–5；同 URL 较新重复书签       |
| T09  | `82aabb64`   |    9 |      #1 | ✅    | ✅   | 簇内摘录优于书签                      |
| T10  | `78cc2ddd`   |   15 |      #1 | ✅    | ✅   | 技术句命中                            |

## failure taxonomy（本批）

1. **`rank_wrong`** — T02/T04：同 URL 书签 vs 摘录，书签带 note 抢 Top1
2. **`miss_neighborhood`** — T01：JSTOR + civic 附注 clue 未拉回 gold（semantic 误邻域）
3. **`ux_friction`** — T07/T08 邻域仍偏大（21 / 49），但 Top1 正确

## 建议

- **T01 换 gold**：候选 `92d2aed2`（New Yorker · method of loci · 120d）或 `3bd21d4b` 改 clue 弱化「JSTOR」字面、强化「library desk / civic」
- **T02/T04**：可接受 alternate = 同页书签；正式 TTE 计 primary excerpt 则记 `rank_wrong`
- 下一步：维护者手跑填 `user_confirmed` + ECS
