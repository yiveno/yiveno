# Yiveno Current Focus

> **用途：** 每个新 Agent 会话的「开机页」——对齐**当下**事实，避免多会话决策漂移。  
> **维护：** 换波次、合入显著功能时**只改本文**，再运行 `bun run sync:ide-boot`（同步 `.cursor/rules/session-boot.mdc`；`doc:check` 校验）。  
> **Agent 自动注入：** `session-boot.mdc`（alwaysApply）的「当下」块由本文生成。  
> **权威链：** [`Yiveno-术语表.md`](./Yiveno-术语表.md) → 本文 → [`Yiveno-产品文档-v4.0.md`](./Yiveno-产品文档-v4.0.md) §0 → [`Yiveno-改版计划-v1.md`](./Yiveno-改版计划-v1.md) 对应波次。  
> **架构决策（不可重议）：** [`../architecture/decisions/`](../architecture/decisions/)

**最后更新：** 2026-11-24

---

## 当前波次

| 项         | 状态                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **主线**   | **行为主线第一片已落地**（偏好问题 → 行为排序 + Settings 可选浏览记录导入）— 前序收口：**账号体系 + 统一绑定 OTP（ADR-028/029）**、**Side Panel P1 + P2 polish**、**Recall 悬停预览 + 点击确认**、**too_big 否定反馈**、**hosted LLM 链路止血**、**embed 配额熔断** 亦已落地；排队下一项 = **设置页内容提炼开关批**；召回核心输出（Filter/Hybrid/must 扩面）仍**暂停**主动调优，与 §5.9 **分计** |
| **并行**   | **Dreaming 每日回顾狗粮**（楔子 #1 · 2026-11-20 起 · 只读验证界面）；**§5.9 种子验证**（质量闭环暂缓主动扩面）；**CWS + Edge 双店（ADR-020）**——Partner Center 已报名、**账号核验未完成**、双店均 **Not submitted**；**CN-NA i18n** 薄维护；GS / 可见进展 / 理解回声 / 分面原则 **薄维护**；Side Panel / Capture **其余仅 bug fix**                                                              |
| **长期**   | **双线程**（权威 `Yiveno-双线程发展原则.md` · §0.1.2 / ADR-016 / ADR-027）——五问门禁；本机学习 + 匿名汇总同意开关已接线；笔记 `dual-thread-notes/`；**不**抢 §5.9；无在线自进化；Dreaming 派生（ADR-022）本地-only，未过离线评估前不进 Recall 主路径                                                                                                                                             |
| **已结案** | extension Skills 复查；popup 主壳已退役；结果卡体验主路径（扫读·Top Pick·stagger·打开原文·先卡后 Framing·P6·邻域锚点）**已接线**；ADR-021 波次 1–4 **已验收**；Probe M1–M4 主路径**已收口**                                                                                                                                                                                                      |

## 本周做 / 不做

**做：**

- **设置页内容提炼开关批**（体验 / 产品主）— 行为第一片已合入；本项为排队下一项
- （回归）行为偏好路径 / 浏览记录导入 — bug fix only；**不**扩主题筛选 / 第三池 RRF
- **Dreaming 每日回顾狗粮**（楔子 #1 · `review.html` / `GET_DAILY_REVIEW`）— 两周自测继续；与 §5.9 **分计**
- （薄维护）Getting Started / 可见进展 / Composer URL 芯片 / 可见与契约分面 / 理解回声 / 冷启动轻条 / Side Panel P1+P2 回归
- （低优并行）CWS / Edge 产品 UI 截图 3–5；**Edge 双店（ADR-020）** 账号核验 → 通过后首次提交 + `EDGE_ADDONS_LISTING_URL`
- **CN-NA i18n 薄维护** — 权威 [`Yiveno-国际化-CN-NA.md`](./Yiveno-国际化-CN-NA.md)；**不**开中文 Recall 质量 / RTL / 第三语言

**不做：**

- **主动扩面召回质量调试**（Filter/Hybrid/佐证门/must 大扩 / TTE 调参）——本波暂停；回归 bug 仍可修
- 把 Skills 复查当主任务（已结案）
- 新连接器 / Agent / 开放式 history 监听抓取（可选一次性导入已上线，勿扩成持续监控）/ 知识图谱 UI
- 未达 §5.9 门槛前扩 MCP 对外宣传
- 内容别名灰名单冒充全库通解；为糊时间堆开放同义词表
- Side Panel 持久多会话 / 分支 / Canvas 等 Chat 产品化；**可见进展 ≠** Agent「思考 / 工具轨迹」秀
- 用 CWS 上架或功能堆砌替代命题验收（§0.1 命题先验）
- 用体验反馈（放弃率↓）冒充 §5.9 / 真实库 TTE 质量达标；工程探针与种子 TTE **分计**
- **用「先造摘录再召回」冒充 Getting Started 主证明**（与书签首召口径冲突）
- 卡上神谕文案 / Artifacts 式图表主路径 / 卡上工具条堆砌
- **为「完全离线找开放页」扩 sprint / 加深离线壳**（ADR-021：业务默认在线；离线仅薄适配）
- 把 Dreaming / 每日回顾写成已上线 Recall 主路径能力（仍为狗粮 / 默认关命题读）

## 已冻结决策（勿重议）

见 [`docs/architecture/decisions/`](../architecture/decisions/)：Side Panel 主壳、clue 术语、邻域非神谕、LLM 数据平面边界、禁止灰名单通解、**ADR-010 理解流水线**、**ADR-011 时间置信度分层**、**ADR-012 find things 双关为后手（非固定路线；终局壁垒=私有增量+习惯；翻牌未启用）**、**ADR-016 双线程（明线找东西 · 暗线记忆探索 · 反馈非真理；目标层禁系统自改）**、**ADR-020 Chromium 双店同包（Chrome + Edge；大陆主路径 Edge）**、**ADR-021 在线默认 · 离线仅薄适配（非离线优先；Omnibox/规则≠离线产品）**、**ADR-022 Dreaming 派生表（独立 IDB store；L3；v1 本地-only；不改用户原文）**、**ADR-023 Chrome 书签删除 tombstone（删用墓碑标记而非直接删行；同步与清理据此判定）**、**ADR-024 书签一次性导入与持续同步拆分（Import ≠ Sync；两者默认关）**、**ADR-025 第三方数据独立分区（Settings `third_party`）**、**ADR-026 诚实归因（用户可见失败/空态/降级报真实具体原因）**、**ADR-027 双线程同意开关与匿名汇总接收端（本机学习 + 贡献匿名汇总；hosted 接收端）**、**ADR-028 匿名设备认证（方案 C 试用 + D device token；LLM 15 / embed 30 lifetime；90 天清理）**、**ADR-029 统一绑定 OTP（先 OTP 验归属再分叉：未注册 promote 同 userId/同 token；已注册 claim 新 device token + ADR-018 迁移门闸）**。

**定位速记（ADR-012 + §0.1 哲学）：** 对外始终「那个找东西的 / find things」；当前履约 _Find what you saved_；双关/翻牌是**后手，视发展再定**（可以≠必须）；终局壁垒=不愿迁走的私有增量与习惯，不是 Search→Memory 跳跃。**产品哲学（对内）：** 人机认知协同 · 机记人想（_Let humans think. Let computers remember._）——**不得**替代对外主 slogan，**不得**暗示「想起来就一定找得到」。愿景可大；**当前 Normative 履约面**仍是主动 Capture 痕迹 → 高置信邻域；**勿**用愿景/终局叙事放松 §5.9。

**冷启动演示（2026-09-14）：** GS **主证明 = 书签首召**；Capture 教学不进 GS 主路径；摘录仍是长期主角——**演示顺序 ≠ 资产重要性**。

## 能力真相（速查）

**已上线（§1）：** Side Panel Recall（含悬停预览/点击确认 · P1/P2 polish）、**偏好问题行为排序 + 可选浏览记录导入**、Hybrid、倒排 Phase 1、ECS 卡面、detail export、只读 MCP beta、Raindrop/Pocket 第三方分区导入、TTE 本机埋点、Dodo Pro 门禁、匿名 device 试用 + 统一绑定 OTP、书签 tombstone / 导入·同步拆分、诚实归因、暗线同意开关、Dreaming 每日回顾楔子（只读狗粮）等——**完整表见产品文档 §1**。

**工程卫生：** extension Skills 复查 backlog **已结案**；CWS / Edge 最低物料母本已落盘（`CHROMEWEBSTORE.md` · `EDGEADDONS.md`）；双店均 **Not submitted**（Edge 账号核验未完成）。

**未达对外门槛：** §5.9 **Beta**（种子用户真实库：TTE-V P50≤12s / Success@180≥75% / ECS≥92% 等）；**无种子 study 数据前不得对外宣称 Beta 达标**；MCP **不对用户主宣传**。

**进行中：** **设置页内容提炼开关**；**Dreaming 每日回顾狗粮**；Getting Started / 可见进展 / 理解回声 / 分面 / CN-NA i18n **薄维护**；§5.9 质量闭环**主动扩面暂停**（回归可修）；Edge 账号核验与首次提交。

## 新会话建议开场

1. **复制** [`AGENT-TASK-BRIEF.template.md`](./AGENT-TASK-BRIEF.template.md) 填空，作为首条消息（scope / 验收 / 禁止）
2. 开机层 `session-boot.mdc` 已自动注入，**通常不必** `@CURRENT`

```text
（粘贴填好的 Task Brief）
```

## 报完成前必过

1. 相关单测；Recall/Capture 用户可感 → `recall-eval` **must** 或 §5 手动步骤
2. 文档↔代码已同批对齐（含本文若换焦点）
3. 扩展用户可感 → MCP 真机 UI 路径抽测 ≥1 条

---

## Changelog

| 日期       | 变更                                                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-24 | **行为第一片落地：** 偏好算子（most_frequent/favorite/recent_frequent）→ `behavior_stats` 排序；Settings 可选 history 导入（本地-only）；独立路径不进 RRF；CURRENT 主线切到设置页内容提炼开关批                                                                                            |
| 2026-11-24 | **开机页刷新：** 波次/本周做不做/能力真相对齐 11-07→11-24 现状；补 ADR-023–029；主线切到行为第一片（设计已定·待执行）；Dreaming 每日回顾狗粮并行；双店仍 Not submitted / Edge 核验未完成                                                                                                   |
| 2026-11-07 | **未收口收口：** ADR-021 波次 1–4 验收完成；Probe 精选真机抽测 + M4 冻结夹具/`probe-generated-eval` 接线；Brief 仍留原路径（禁误归档）                                                                                                                                                     |
| 2026-11-07 | **未收口清单回写：** ADR-021 波次 1–4 Brief 改「代码已落盘·待验」（勿归档）；Probe M1–M3 真机未验 + M4 未做（Brief 留 `docs/` 根，禁 audits/archive）                                                                                                                                      |
| 2026-11-03 | **CN-NA i18n 对照落档：** `Yiveno-国际化-CN-NA.md`；并行薄项补官网 Pricing/Account/Support/法律页双 locale；冻结中文 Recall / RTL / 第三语言；与 §5.9 分计                                                                                                                                 |
| 2026-11-02 | **Composer contenteditable + URL 芯片（体验例外）：** Side Panel clue 输入改 contenteditable；URL→可视链接原子芯片；§7.0 / §5.2.1 / 设计标准同步；与 §5.9 分计                                                                                                                             |
| 2026-11-01 | **定位哲学落档：** §0.1「产品哲学与愿景边界」+ 术语表 §1（人机认知协同 / 愿景 vs 履约 / 先锋入口）；定位速记同步；主线仍 §5.9                                                                                                                                                              |
| 2026-10-29 | **砍掉 Idle 口语范式样句芯片**：空线程引导仅 placeholder + 空态文案；§7.0 / §5.2.1 / 产品文档同步                                                                                                                                                                                          |
| 2026-10-10 | **暗线基建脚手架：** 失败归因枚举 · 适应旋钮登记 · 匿名草图 DEV 导出 · PR/doc:check 门禁；工程文档 `暗线基建-失败归因与受控适应.md`；主线仍 §5.9                                                                                                                                           |
| 2026-10-09 | **双线程权威落档：** `Yiveno-双线程发展原则.md`；五问（方案必过/回归 N/A）；`dual-thread-notes`；环境反馈文档降子集；§0.1.2 短锚；主线仍 §5.9                                                                                                                                              |
| 2026-10-09 | **懂人类暗线升格：** 人脑记忆机制地平线 + 设计滤镜 + 双向奔赴；§0.1.2 / ADR-016 / 原则文档 / Task Brief；主线仍 §5.9                                                                                                                                                                       |
| 2026-10-09 | **长期原则落档：** §0.1.2 + ADR-016 + `Yiveno-环境反馈驱动进化-原则.md` + 改版 R5；主线仍 §5.9；不把自适应写成已上线                                                                                                                                                                       |
| 2026-10-06 | **ADR-014 落档（Recall Request · Topic 两种来源 · D1-B 退化弱 Topic）**；草案 §0 显化"主语=问题边界"防滑成"Topic 是产品功能"；§7.05 摘要措辞同步；extension `orchestrate-keyword-recall.ts` D1-A 注释纠正 + D1-B 命名落地；`docs/architecture/decisions/README.md` + `docs/README.md` 同步 |
| 2026-09-17 | docs/ 重构：`research/` → `docs/archive/research/`；引用链接统一指向归档路径                                                                                                                                                                                                               |
| 2026-09-14 | **GS 去掉 Start using / Skip：** 进产品靠 Try it；§5.8                                                                                                                                                                                                                                     |
| 2026-09-14 | **GS LLM 示意 clue：** 一次 4 条 + 随机切换 + Try it 开壳；§5.8                                                                                                                                                                                                                            |
| 2026-09-14 | **书签 bulk 主进度仅 GS：** 去掉 Side Panel 导入条；冷启动 Import 降级；§5.8                                                                                                                                                                                                               |
| 2026-09-14 | **GS 书签授权 CTA：** 按钮授权 + 导入进度 + 已授权态；§5.8                                                                                                                                                                                                                                 |
| 2026-10-30 | **Edge 程序已报名：** MSA `admin@yiveno.com` · Publisher=`Yiveno` · Individual · China；账号核验未完成；见 `EDGEADDONS.md`                                                                                                                                                                 |
| 2026-10-28 | **ADR-020 Chromium 双店：** 同包 CWS+Edge；大陆主路径 Edge；`EDGEADDONS.md`；官网 Install CTA；`yiveno.cn` externally_connectable                                                                                                                                                          |
| 2026-09-14 | **GS 双源 tab：** Bookmarks / Excerpts；同意只锁书签；CTA 不绑开关；§5.8                                                                                                                                                                                                                   |
| 2026-09-14 | **GS = 启动设置页：** 授权决定 + 首召履约，非演示导览；§5.8                                                                                                                                                                                                                                |
| 2026-09-14 | **书签灌库默认关 + GS 同意开关：** 开后才解锁 Recall/Capture 示意；Settings 同键                                                                                                                                                                                                           |
| 2026-09-14 | **Getting Started 页内真 Recall：** composer + 建议句 + 页内结果；Capture CSS 示意；§5.8 / i18n                                                                                                                                                                                            |
| 2026-09-14 | **Getting Started 书签首召已接线：** GS 三态 + 真实书签样句；Capture 不进主路径；Capture-first 仅无可召库存；§5.8 / CURRENT / i18n                                                                                                                                                         |
| 2026-09-14 | **Getting Started 口径：** 书签首召为主证明；Capture 不进 GS 主路径；UI 待改；§0.1.1 / §5.8 / 术语表同步                                                                                                                                                                                   |
| 2026-09-11 | **ADR-012 斧正：** 双关/翻牌=后手非固定路线；终局壁垒=私有增量+习惯；翻牌非存活条件                                                                                                                                                                                                        |
| 2026-09-11 | **Idle 口语范式**（§7.0）已接线：库 ready 空态可点样句（填入不自动发）；chat 心智、不强制；与 §5.9 分计                                                                                                                                                                                    |
| 2026-09-11 | **内容佐证门**：`contentTerms` 须词面佐证；high 空窗一次 soft 回退；Outcome 正例须佐证 / None 撤脏 pair；两条 must                                                                                                                                                                         |
| 2026-09-11 | **冷启动放行后轻条**（§5.8.1）已接线：顶栏非阻挡 + Dismiss + 5min TTL；与 §5.9 分计                                                                                                                                                                                                        |
| 2026-09-11 | **理解回声**（§7.0）已接线：结果态 `Heard as` 槽位芯片；与可见进展同属体验面、与 §5.9 分计                                                                                                                                                                                                 |
| 2026-09-11 | Recall **可见进展**列为体验高优（§7.0 Normative）；与 §5.9 质量验收分计；禁止 Agent CoT 式轨迹                                                                                                                                                                                             |
| 2026-09-10 | ADR-011 时间置信度分层；主线并列自然 clue 采样；见 [`time-confidence-plan.md`](../archive/research/tte-beta-2026-09/time-confidence-plan.md)（已归档）                                                                                                                                     |
| 2026-09-08 | 接受 ADR-010；相对时间闭集增 `last_month` / `few_months_ago`（P0 · 对齐 NA 口语 / T13）                                                                                                                                                                                                    |
| 2026-09-01 | 换焦点：Skills 复查结案 → §5.9 种子验证 + recall-eval / Outcome Labeling 主线；CWS 并行降优                                                                                                                                                                                                |
| 2026-08-28 | Task Brief 模板；hooks 移除 sessionStart（避免与 session-boot 重复）                                                                                                                                                                                                                       |
| 2026-08-28 | `sync:ide-boot`：CURRENT → session-boot「当下」块；`doc:check` 校验同步；根 `CLAUDE.md` 薄指针                                                                                                                                                                                             |
| 2026-08-28 | 新增 `.cursor/rules/session-boot.mdc`（alwaysApply 开机层）                                                                                                                                                                                                                                |
| 2026-08-28 | Phase 2：`doc:check`（message registry + CURRENT）· §5.8 冷启动壳 must 单测                                                                                                                                                                                                                |
| 2026-08-28 | Phase 1：PR 模板、pre-push extension test:run、Cursor hooks（sessionStart + 拦截破坏性 git）                                                                                                                                                                                               |
| 2026-08-28 | 初版：CURRENT + ADR 索引；对齐改版计划 R4 已落地表述                                                                                                                                                                                                                                       |
