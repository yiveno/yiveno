# Natural sample · P001-NS01（探索 · 未先验锁 gold）

| 字段            | 填写                                             |
| --------------- | ------------------------------------------------ |
| **Sample id**   | P001-NS01                                        |
| **Date**        | 2026-09-10                                       |
| **Participant** | P001                                             |
| **Gold**        | **库内无匹配**（LIST 扫描 AI/LLM/book 相关 = 0） |

## 1. 首句

```text
A few days ago, I bookmarked a book about AI. It talks about the principles of LLM models.
```

**维度：** T✅（a few days ago）· 行为/类型✅（bookmarked → bookmark）· C✅（AI / LLM principles）· 「book」作对象词（产品无 book 槽，易噪声）  
**主锚：** C（LLM / AI 大意）或 T+S 行为

## 2. clue₁ 真机（MCP UI）

| 项       | 结果                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| Framing  | Looking for **bookmark** · **Around recently**（ADR-011 low）· Based on "book, ai., it" |
| 邻域     | 34 matches；首屏 Atlantic / Substack note-taking / Typewolf / MDN — **无一 AI 书**      |
| no_match | 否（出了邻域，但是**错邻域 / 噪声**）                                                   |
| 库真相   | 68 条 Memory；标题/附注/摘录 **无** ai/llm/book 命中                                    |

## 3. 确认建议

- 若你确信库里曾有这本书 → `miss`（产品没找；且库扫描支持「确实没有」→ 更接近记错 / 未 Capture）
- 若只是随口猜可能存过 → 记 **`no` / 探索作废**：无 gold，不计正式采样频率分子（维度标注仍可保留作「人会这么说」）

## 4. taxonomy 旁注

- `no_signal` / 记错目标（库无条目）
- 解析噪声：`it` / `ai.` 进 contentTerms；「book」≠ 产品闭集类型
- 时间分层 OK：`Around recently` 未硬空

## 5. 下一句建议

正式 §2.3 采样：先在心里锁**你确定存过的一条**（仍可不翻 Library 标题，只靠记忆），再说「还记得什么都行」。  
或：先打开 Memory 随便扫一眼有什么类型，关掉后再凭记忆说——仍避免对着标题抄 clue。
