# Natural sample · P001-NS06（Kyodo 英文金标 · 同 clue）

| 字段            | 填写                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Sample id**   | P001-NS06                                                                                          |
| **Date**        | 2026-09-10                                                                                         |
| **Participant** | P001                                                                                               |
| **Gold**        | [Taiwan Mandopop star Jay Chou…](https://english.kyodonews.net/articles/-/72897)（英文书签，刚存） |
| **确认**        | **`miss`**（邻域无）— 对照 clue「A news story about a Chinese-language singer」                    |

## 1. 首句

```text
A news story about a Chinese-language singer
```

**维度：** TYPE=article · **C**=Chinese-language singer  
**主锚：** C  
**与 NS05 关系：** 同 clue；NS05=中文 tgbus；本条=英文 Kyodo（英语路径内应可找）

## 2. 真机证据（2026-09-10）

| 项             | 结果                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| 库内           | ✅ Memory 有；标题英；`hasEmbedding: **false**`（全库仅此条缺 embed）          |
| contentTerms   | `chinese, language, singer`                                                    |
| 与标题字面交集 | **∅**（title=`…Mandopop star Jay Chou…`；singer≠star；chinese≠Mandopop）       |
| 邻域           | 17 · 几乎全是 `embedding`+`hybridRrf`；金标 **不在榜**                         |
| tgbus（NS05）  | 有 embed → 可进邻域约 #10（仍非 Top）；证明 Hybrid 只吃有向量的条              |
| 对照 clue      | `Mandopop Jay Chou album news` → Top1 **即金标**（`title` 字面）→ 索引/同步 OK |

## 3. 根因（双因子，非「非英语边界」）

1. **`gist_mismatch` / 释义鸿沟**：口语 gist 词面与标题锚点不对齐，关键词 Filter 抬不起金标。
2. **`weak_index`（缺 embedding）+ `hybrid_drift`**：金标无向量 → 无法进语义通道；邻域被已有 embed 的探针条占满。
   - **工程修复（2026-09-10）：** 增量书签 created/changed 单条入队 embedding；无感维护扫缺向量书签时按 `createdAt` 新→旧优先。不消除释义鸿沟。

## 4. 确认

- [x] `miss`
- [ ] 非语言产品边界（英文对英文）
- [ ] 同步/倒排未坏（字面 clue 可 Top1）
