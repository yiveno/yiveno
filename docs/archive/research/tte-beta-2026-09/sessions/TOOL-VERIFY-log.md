# 工具验证记录（P001 · 3 任务试跑）

> Agent MCP 跑通 · 2026-09-01 · 扩展 v4.0.0 · **user_confirmed / ECS 待维护者填写**

## 探针清库（2026-09-01 · A + B1）

`DEV_PURGE_PROBE_NOISE` / `yiveno.purgeProbeNoise()` 结果：

| 指标                                    |     值 |
| --------------------------------------- | -----: |
| 扫描（活跃）                            |   1755 |
| 清除摘录                                |    300 |
| 清除书签 Memory                         |   1381 |
| 断开精选书签 Chrome 链接（保留 Memory） |     54 |
| 移除 Chrome「Yiveno Probe」文件夹节点   |    781 |
| **保留**                                | **74** |

**Gold 存活：** T02 `03367e5c` ✅ · T05 `16e2db0d` ✅ · T03 重选 `32e6acb3` ✅（清库后 Top1）

---

## 埋点自检

- [x] Side Panel 提交 clue → `clue_submitted` + `result_rendered`
- [x] 结果卡 → `evidence_visible`（ECS 5 可见）
- [ ] `source_opened`（本次未点卡打开原文）
- [x] 遥测导出：`sessions/P001-telemetry-export.json`（须从 Side Panel 页导出；library 页可能为空）

## 10 任务批量对拍（2026-09-01 清库后）

详见 [`P001-batch-recall-log.md`](./P001-batch-recall-log.md)。

| 汇总          |       值 |
| ------------- | -------: |
| top-3 含 gold | **9/10** |
| Top1 = gold   | **7/10** |
| 未进邻域      |      T01 |

## 试跑任务（邻域 gold id 对拍 · 早期 3 条）

| #   | Task ID  | Fuzzy clue（摘要）                     | pipeline (s) | gold 在 top-3          | Top1=gold | 备注               |
| --- | -------- | -------------------------------------- | -----------: | ---------------------- | --------- | ------------------ |
| 1   | P001-T02 | GitHub docs caching workflows          |          3.4 | ✅ `03367e5c` rank #2  | ❌        | 清库前             |
| 2   | P001-T03 | Notion interview cross-source friction |            — | ✅ `32e6acb3` **Top1** | ✅        | 清库后；13 related |
| 3   | P001-T05 | example domain last day or two         |          7.4 | ✅ `16e2db0d` rank #1  | ✅        | 清库前             |

## 库况说明（诚实）

- ~~当前库 **~320 摘录 + 大量探针/噪声**~~ **已清库（2026-09-01）**：~20 摘录 + ~54 书签 Memory（精选探针 + 真实 Capture）。
- **无 ≥14 天冷却**真实条目仍占多数 → 尚不满足 checklist 正式 TTE 入组；需 2 周真实 Capture 后再跑正式批。
- 2 条真实 `example.com` 摘录（8/30）保留。

## 结论

- [x] 10/10 MCP UI 路径可复现 Recall（见 batch log）
- [x] 9/10 top-3 含 gold · 7/10 Top1=gold
- [ ] T01 换 gold 或改 clue（当前 miss）
- [ ] 维护者填 `user_confirmed` + ECS 后 → 正式手跑批

## 失败 taxonomy（初稿）

1. `rank_wrong` — T02/T04：同 URL 书签抢 Top1
2. `miss_neighborhood` — T01：JSTOR civic 未进邻域
3. `ux_friction` — T07/T08 邻域 21–49 条（Top1 仍对）
