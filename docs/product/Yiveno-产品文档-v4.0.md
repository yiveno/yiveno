# Yiveno 产品文档 v4.0

> **唯一**产品/架构规格正文。主要读者：AI 编程工具与维护者。  
> **Normative（必须遵守）**= §0–§7。**Non-normative（背景，勿当实现范围）**= 附录 A。  
> 工程细则可旁挂 `.cursor/rules/project.mdc` / `AGENTS.md`；与本文冲突时以**本文 Normative**为准，并回写 rules。

---

## 0. AI Quick Contract（先读完再改代码）

### 0.1 产品是什么（核心路线 · 勿偏）

> 任何人读完下面这段，就该明白 Yiveno 到底干啥、靠什么活、什么叫跑偏。

**Yiveno 是你的记忆硬盘。**  
看到好东西，不必担心自己以后记不记得住——划一下、存一下，**扔进 Yiveno，它替你记着**；过阵子只记得一点点，**找 Yiveno 要就行**。  
（工程口径仍称「个人信息寻回系统」；对外心智是「个人记忆的第二块硬盘」，不是书签管理器也不是笔记库。）

**存要轻松，找要准、要爽。** 就这两件事。

**立身之本（Normative）：** 用户浏览时**天然会按兴趣筛内容**——哪些有意思、哪些无聊，不需要产品培养。真正的鸿沟在 **「这次感兴趣」→「下次还想找回来」**：传统做法要求用户认真保存、放进指定目录，下次才「有可能」很快找到——这是严重的心智负担。用户心里真正想要的是：**随便存，随时找得到**。  
Yiveno 卖的就是这份 **超轻心智负担 + 永久踏实感**：扔进来不用想放哪；想不起来也找得着。**没这份爽，就没有立身之本。**

**不是**书签管理器，**不是**笔记整理工具，**不是**开放式聊天机器人，**不是**「AI 自动帮你归类一切」。  
业务其实简单；复杂的是体验。没有文件夹体系、没有功能清单可以当护城河——**若没实质性解决「找不到」的痛、没让人感到「对，就是这个」的爽，这个产品就没有立身之本。**

**发育路线（前期最难，后期才稳）：**

1. **开头**：库空、习惯未成、系统几乎不「懂」你。只能靠每一次 Capture / Recall 打磨到愿意再来一次——用体验换留存。
2. **中段**：语料变厚、打开与反馈开始进排序——越用越准，复利开始转。
3. **后期**：切换成本与成对习惯长成——「看到有意思就先扔 Yiveno」+「想不起来就先开 Yiveno」——流失下降。这是**前期发育、后期变强**的路线，不是上线一堆功能就赢。

**因此：前期用体验买数据与习惯；后期用数据与习惯锁体验。**  
做功能、接模型、上云同步，都只能服务这条线；反过来用功能堆砌、管理回潮、开放式闲聊、AI 主卖点来「显得完整」，就是偏航。

一句话（给实现与文案用）：Yiveno = **扔进就记着 + 想找就找得着**（工程分解：**Capture 低负担 + Recall 高置信**）。北极星：模糊线索 → 第一屏「对，就是这个。」  
**资产与隐患细则见 §0.1.1**（摘录/个人痕迹为主角；书签配角；勿与 Google/Notion 硬碰）。

### 0.1.1 定位精细化：核心资产、边界与隐患（Normative）

> 近期产品讨论的收束。决策冲突时：§0.1 定「是什么」；**本节定「靠什么资产活、什么坑必须躲」。** 改方向先改本节再改代码。

#### 用户心智（Normative）

对外承诺的一句话：**Yiveno 是你的记忆硬盘。**

| 阶段     | 用户感受                           | 产品职责                                   |
| -------- | ---------------------------------- | ------------------------------------------ |
| **看到** | 这东西不错，但我不一定能记住       | 接住瞬间，Capture 极低负担                 |
| **存入** | 不用想放哪、不用整理，扔进去就好   | 抓住感 + 出处锚 + 个人增量落库             |
| **遗忘** | 细节模糊了，但记得「有过这么回事」 | 替你记着；用户不必背标题/路径/精确词       |
| **找回** | 像跟熟人描述记忆一样开口要         | 口语线索 → 对话式 Recall →「对，就是这个」 |

**Normative：** 「替你记着」指 Yiveno 持久保存**用户主动 Capture 的个人痕迹**，并在 Recall 时尽量还原用户脑中的记忆对象；**不是**承诺记住用户看过的一切、也不是替代人脑记忆。  
文案可用「永远记着」作感性表达，但不得暗示无限制快照、全站自动存档或零失误回忆。

#### 兴趣鸿沟（Normative · 立身之本）

用户存东西，**Capture 侧几乎不需要额外心智**——浏览中哪些感兴趣、哪些无聊，用户自己就在做，**不需要产品培养「筛选能力」**。

真正的障碍在 **两次兴趣之间**：

```text
这次：「这个有意思，先留着」
         ↓  鸿沟（传统解法 = 严重负担）
下次：「我还想继续看 / 还想找回来」
```

传统解法是：**必须认真保存好、放进指定目录/分类**，下次才「有可能」很快找到。用户要同时承担：

- **存时负担**：想放哪、怎么命名、要不要整理
- **找时焦虑**：放对了没有、记不记得路径、库一乱就放弃

用户内心幻想（Normative · 真实需求）：**要是随便存，随时都能找得到就好了。**

Yiveno 要兑现的就是这份组合爽点：

| 组成             | 含义                         | 产品落点                                             |
| ---------------- | ---------------------------- | ---------------------------------------------------- |
| **超轻心智负担** | 存时不用想分类、不用维护结构 | Capture 极低摩擦；**禁止**把「整理文件夹」当存侧爽点 |
| **永久踏实感**   | 相信扔进去的东西以后找得着   | Recall 高置信 + 对话追问；越用越懂你的记忆线索       |

**Normative：** 兴趣筛选是用户自带能力；Yiveno **不教用户什么值得存**，只解决 **存了以后找得着**。若 Capture 仍逼用户「想好放哪」，或 Recall 仍像翻文件夹，就是在鸿沟上搭桥失败——**没有立身之本**。

#### 知识库习惯重置（Normative · 品类差异）

Yiveno 解决的**不是**「某一类内容找不到」的单点痛点，而是**用户对待私人知识库的整体习惯**——从「我是库的管理员」变为「我是库的主人，检索交给系统」。

**传统私人知识库的共同前提（Chrome 书签 / Notion / 飞书文档等）：**

```text
先设计结构（目录 / 空间 / 数据库）
  → 再往里新增内容（存进「正确」位置）
  → 使用时按结构 + 个人记忆逐级翻阅
```

这不是少数「整理狂」的怪癖，而是品类默认强加的**双重隐性成本**：

| 阶段     | 用户被迫承担     | 典型表现                                                 |
| -------- | ---------------- | -------------------------------------------------------- |
| **存**   | **结构决策成本** | 飞书先建【生活】【工作】再建子目录；书签要想放哪个文件夹 |
| **找**   | **结构记忆成本** | 除了记得「是什么」，还要记得「在哪个目录下」             |
| **维护** | **结构过时成本** | 目录与真实兴趣脱节；越积越乱，或整理到放弃               |

**两种常见结局，惩罚相同：**

1. **认真整理型**：存前建大纲、维护目录——启动与维护负担高，思维像在做行政。
2. **乱存型**：不整理或半途而废——库变垃圾堆，**找不到 = 消失**，再重要的资料也等于没存。

无论哪条路，**人都被迫同时扮演「创造者」和「知识库管理员」**——而繁重、重复、可规则化的索引工作，**不适合人脑的主模式**（联想、兴趣判断、创造）；适合交给机器在 Capture / Recall 时完成。

**Yiveno 的习惯重置（Normative）：**

| 维度       | 文件夹 / 大纲型知识库  | Yiveno                                            |
| ---------- | ---------------------- | ------------------------------------------------- |
| 存的前提   | 往往先想好「放哪一类」 | **interesting → 快捷键 → 完**                     |
| 结构的角色 | 找回的主路径           | **可选备注层**；找回主路径是 **「要」**（Recall） |
| 人脑记忆   | 内容 + 目录结构        | **内容线索 + 模糊口语**即可                       |
| 机器职责   | 多为被动容器           | **索引、加权、候选、必要时追问**                  |

一句话：**人负责「这值得记」与创造；机器负责「记在哪、怎么找回来」。**  
复杂整理类工作不应是用户进库的门票，也不应是找回时的导航税。

**与竞品叙事的边界（对外/demo 可用）：**

- Raindrop / 文件夹书签：**帮你把库整理得更好看**
- Notion / 飞书：**帮你建更好的知识空间**
- Yiveno：**让你可以不再靠整理来换取可找回性** — Save first. Recall later—even with a vague clue.

**Normative 铁律：**

- 不得把「先分类再存」「维护整齐目录」设计为 Capture 的默认路径或爽点。
- 不得把 Recall 做成「翻树 / 翻数据库」的变体；对话式找回是**替代**逐级翻阅，不是美化它。
- 书签树 / 标签 / `clues.note` 是**给未来自己的提示**，不是「进库资格证」。
- 若 Recall 撑不起「随便存」，用户会退回「克制存 + 认真整理」——**习惯重置失败，品类差异坍缩为又一个搜索框**。

#### 肆无忌惮存的习惯（Normative · 长期行为变化）

若 Yiveno 真正兑现「随便存，随时找得着」，用户会逐步养成一种**以前不可能存在**的浏览习惯：

```text
看到有意思 → 下意识按 Yiveno 快捷键 → 不担心放哪 → 不担心书签乱不乱 → 不用梳理
                                              ↓
                              用时：找 Yiveno 要，能拿到就行
```

**以前为什么做不到：** 在 Chrome 原生书签 / 文件夹体系下，「肆无忌惮地存」用不了多久就会把书签变成垃圾堆——存得越多，找得越痛苦，整理负担越大，所以用户只能**克制存**，或存前认真想分类。**这不是用户不想存，是旧解法惩罚乱存。**

**Yiveno 改变的是存的心理许可：**

| 维度               | 旧习惯（文件夹/bookmark 思维） | Yiveno 目标习惯                                                        |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------- |
| **存的目的**       | 放进正确目录，方便以后翻       | **只有一个目的：用时能拿到**                                           |
| **存时决策**       | 放哪、叫什么、要不要整理       | interesting → 按快捷键，完                                             |
| **对「乱」的焦虑** | 书签树乱 = 失败                | 库可以厚、结构可以平；**找得着 ≠ 目录整齐**                            |
| **整齐目录的意义** | 找回的主路径                   | **作为整理手段大幅贬值**；但作为**挂私人备注的载体**价值上升（见下节） |

**Normative：**

- 书签、摘录及将来其它 Capture 形态，**存进去的目的只有一个**：我用的时候能拿到；**不是**为了维护一个好看的目录树。
- 产品应推动「看到感兴趣就按快捷键」的下意识动作，而不是推动「存完去整理」。
- 若 Recall 撑不起「肆无忌惮存」的承诺，用户会退回克制存——**习惯飞轮不会启动**。

**与发育路线的关系：** §0.1 后期不只「想不起来就先开 Yiveno」，还应包括「看到有意思就先扔 Yiveno」——Capture 习惯与 Recall 习惯成对，才锁死切换成本。

#### 记忆库书签树的价值（Normative）

记忆库中的书签树，**不是**「整齐目录找回」的回潮，也**不应**被贬低为可有可无的浏览壳。它的更大价值是：**承接 Chrome 原生书签树无法个性化的东西**。

Chrome 书签只有标题、URL、文件夹位置——用户存一个网页时，常想给**以后的自己**留一句提示：

- 这是干啥的？
- 为啥要保存？
- 有什么用 / 什么时候会用到？

这类需求像**给好友加备注**：对象（网页/书签）还在 Chrome 那套结构里，但**私人语义**只能挂在 Yiveno 侧。工程落点即 **`clues.note` 附注**（仅存 Yiveno，不同步 Chrome）。

| 层           | 谁提供                              | 职责                                                                |
| ------------ | ----------------------------------- | ------------------------------------------------------------------- |
| **结构层**   | Chrome 原生书签树（sync 进 Yiveno） | 用户熟悉的目录、放哪都行；**不再承担「找得着」的主责任**            |
| **个性化层** | Yiveno 记忆库书签树                 | 在同一结构上展示/编辑 `clues.note`；给未来的自己留上下文            |
| **找回层**   | Recall（Popup / Omnibox）           | 消费标题、URL、**备注**、行为与时间线索；主路径仍是「要」，不是翻树 |

**Normative：**

- 书签树的主价值 = **私人备注载体 + 轻浏览**，不是文件夹整理器。
- 鼓励用户在存书签后（或事后）补一句「给以后自己的提示」；备注同时是 Recall **强线索**（见 §2.3）。
- 不得把书签树做成第二套「必须维护整齐才能用」的管理中心；**乱存 + 有备注 + 找得着** 优于 **整齐无备注**。
- Capture 侧可逐步降低「写备注」的摩擦（如存书签后轻量补注入口），但**不得**退回「存前必选文件夹/分类」的旧负担。

#### 核心资产（谁是主角）

Yiveno 的不可替代资产 **不是** Chrome 书签 URL，**也不是**用户从零写的长文笔记。

**核心资产 = 用户在消费互联网信息时，附着在原文上的个人痕迹**（摘录、短备注/`clues.note`、以及将来极瘦的标记类能力）：

- 有**出处锚**（页面 / URL / 域 / 上下文）；
- 有**个人增量**（划下的句子、自己的话）——Google 索引里没有「你的那条」；
- 在库内有稳定 **MemoryItem id**（工程身份；勿对外当卖点话术）。

一句话：**引用公共信息 + 创造私有增量。** 护城河长在私有增量与找回习惯上，不长在文件夹整齐或模型品牌上。

| 知识形态                | 角色                  | 说明                                                                                                    |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| **摘录 `text_excerpt`** | **主角**              | 主动 Capture；对 Google 有非对称优势；存/找叙事与 demo 优先用它                                         |
| **`clues.note` 附注**   | **强线索 / 私有增量** | 可挂在摘录或书签上；是「自己的话」，不是独立笔记库；**书签侧经记忆库树编辑，像给好友加备注**            |
| **书签 `bookmark`**     | **配角**              | 导入 + 原生 sync 灌库；价值在 URL + **私人备注层**；冷门/私有 URL 偶发有用；**不得**当知识主力与主 demo |
| **独立 `note` 类型**    | **禁区（当前）**      | 空白创作 → Notion 赛道；见 §0.4；未验证前不得暗示已有                                                   |

#### 价值边界（两个替代品）

**对 Google（公开查阅类 URL）：**

- 普通公开文档/官网（如 React 文档）：用户模糊记得「存过书签」时，**重搜 Google 往往更短**。用「找回查阅类书签」证明产品价值 = **结构性劣势**。
- Google **搜不到**的是：用户划过的原文、个人备注、登录墙/内网、已改版或长尾页、以及「我当时选中的那一版」。
- 对外/对内证明价值时：**必须能说清「为何不用 Google」**——答案里要出现摘录或自己的话，不能只出现书签。

**对 Notion / 笔记：**

- 鼓励「打开空白页独立创作」= 换赛道。
- Yiveno 只做**浏览中的附着标记**，创作负担必须极低（划一下、注一句）。
- 不做文件夹体系、长文、双向链、复习系统（见 A.5）。

#### 需求频率（避免押错「想不起来」）

「想不起来」要拆开，不能混谈：

| 代号  | 含义                                    | 频率判断                   | 产品态度                           |
| ----- | --------------------------------------- | -------------------------- | ---------------------------------- |
| **A** | 完全忘了自己存过                        | 相对少；常被重搜无感替代   | **不得**当唯一价值主张（独木桥）   |
| **B** | 记得接触过/存过，但标题/路径/精确词模糊 | 目标人群中常见（往往周级） | **主战场**：「只记得一点点」指这个 |
| **C** | 记得较清但在库里翻不到                  | 中高                       | 可服务，但勿做成管理器主路径       |

可走宽度 ≈ **会持续 Capture 的人 × 发生 B 的次数**，不是全体网民平均数。早期用户必须是「本来就会存/划」的人。

#### 真实口语需求（Normative）

Yiveno 的高频真实请求，**不是**标题 / URL / 精确词查询，而是**生活口语中的记忆线索**。

典型形态（**记忆模式**跨语言相通；**P0 parser 以英语口语为一级语料**，见下节「市场语言策略」）：

- `the song I played on repeat yesterday` / `前天有一首听起来很嗨，我循环了好几遍的歌`
- `the article I didn't finish reading a while ago` / `前段时间看了一半的那篇文章`
- `the poem by Li Bai I saved yesterday` / `我昨天保存的一首李白的诗`
- `the page where I left a note about deployment` / `那个我自己写过一句很绝备注的页面`

这些请求调动的不是纯内容词，而是用户脑中的混合记忆点：

- **时间感**：前天 / 前段时间 / 昨天 / 最近
- **行为感**：循环了好几遍 / 看了一半 / 打开过很多次
- **主观感受**：很嗨 / 很震撼 / 很实用 / 很绝
- **对象类型**：歌 / 文章 / 诗 / 页面 / 代码 / 命令
- **对象归属**：李白 / 杜甫 / 某产品 / 某网站 / 我写过的话

**产品判断：** 用户发起 Recall 时，更多是在复述**记忆对象**，而不是复述**原始文本**。  
因此 Yiveno 的目标不是做“更好的内容搜索”，而是做“更懂人脑记忆点的找回系统”。

**有记忆锚点 vs 助手发令（Normative）：**

| 类型                 | 例子                                                                           | 态度                             |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| **有锚点的记忆口述** | `昨天保存的李白的诗`；`前段时间看了一半的那篇文章`；`我备注过很实用的那个页面` | **主目标**                       |
| **零锚点的助手发令** | `放几首我喜欢的歌吧`；`好无聊看个电影吧`                                       | **非目标 / 禁主 demo**（见下节） |

前者在复述「库里某条东西」；后者在要求系统「替我决定现在干嘛」。技术上可能碰巧命中某条书签，但产品不得按助手叙事扩张。

#### 记忆硬盘 ≠ 生活小助手（Normative · 范围刹车）

理解能力、enrichment、行为排序做厚之后，容易滑成「小助手」：  
`放首我喜欢的歌` → 打开次数最多的歌书签；`好无聊看个电影` → 上次没看完的电影页。

**技术可以相似，产品目标完全不同：**

|          | **记忆硬盘（Yiveno）**                       | **生活小助手（禁区）**           |
| -------- | -------------------------------------------- | -------------------------------- |
| 用户心态 | 「我存过，帮我要回来」                       | 「你替我决定下一步」             |
| 成功标准 | 找回**自己的那条痕迹**（真实 MemoryItem id） | 推荐「现在该干嘛」               |
| 对话     | 澄清记忆线索                                 | 陪伴、建议、编排生活             |
| 边界     | 只在用户主动 Capture 的库里                  | 易扩到全网推荐、播放、待办、闲聊 |

**Normative 铁律：**

1. **只找回用户主动存过的东西**——没存过则诚实 no_match / 追问；不得编造推荐。
2. **对话只为 Recall 服务**——补线索、给候选；不做情绪陪伴与生活决策。
3. **行为字段是寻回信号，不是助手人格**——`openCount` 高 =「你更可能找的是它」，不是「我懂你喜欢所以推歌」。
4. **能力上限可以厚，产品承诺必须瘦**——enrichment / LLM / embedding 只服务「记忆可问」；立身之本仍是填「这次感兴趣 → 下次找回来」的鸿沟，不是替用户过日子。

**文案对照（对外/demo 必须用右列）：**

| 助手说法（危险） | 记忆硬盘说法（守住）                  |
| ---------------- | ------------------------------------- |
| 放首我喜欢的歌   | 我存过 / 循环过的那首歌（书签）       |
| 好无聊看个电影   | 上次打开过、还没看完的那部 / 那个页面 |
| 你帮我挑一个     | 你还记得哪部 / 哪个站吗？我们一起缩小 |

若用户**真存过**且有打开记录，「上次没看完的电影页」可以是合法 Recall（行为 + 类型）；回复应是「你上次打开过的这部」，不是「无聊就看这个吧」。

#### 前期爽点（存侧）与明确不做

找依赖积累（厚积薄发）；前期仍要有**当下可感知**的正向反馈，否则飞轮点不燃。

**该做的方向：**

- 存完的「抓住感」（尤其摘录：亮出你存下的那句）；
- 把找回承诺预支到当下（人话回显，而非让用户管理线索字段）；
- 尽早制造一次成功找回（缩短闭环，不等库很厚）；
- 线索增强可无形服务找回，但**不能替代**存完体感。

**明确不做（隐患 · 已否决）：**

- **自动把书签归入「最合适文件夹」/ 无则新建目录**（含快捷键保存后静默整理 Chrome 树）。  
  短期像爽点，实为整理器开胃菜：错分伤信任、逼出规则/纠错 UI、与 §0.1 / 品牌禁令冲突，且**几乎不提升模糊找回能力**。
- 恢复「保存当前页」快捷键与书签管理主 UI（规范已禁）。

#### 技术主线（服务定位，勿颠倒）

「越来越懂用户」≠ 先接 LLM 投喂习惯；**更 ≠ 把全库喂给 LLM 当搜索引擎。**

```text
匹配 → 排序 → 打开/反馈写回 → 再排序
  →（后）索引 / embedding / Hybrid
  →（更后）可关闭的 LLM 增强（可服务找回对话；非开放式闲聊）
```

行为字段（如 `openCount` / `lastOpenedAt`）与反馈闭环是懂用户的地基；模型是语义补洞插件。

**LLM / embedding 的正确分工（Normative · 背景共识，非当前默认实现）：**

```text
用户口语
  → 理解层（规则优先；后期可 LLM）：拆成结构化检索约束
  → 检索层（关键词 Filter / 过滤 / 排序；后期 + embedding）
  → 真实 MemoryItem 候选（必须带 id）
  →（可选）LLM：解释 / 追问 / 在候选中重排——不得无 id 编造答案
```

- **LLM**：把随意口语变成**可执行约束**（时间窗、对象类型、用途意图、内容词、偏好信号等）；不是「全量数据当 prompt」。
- **Embedding**：语义近邻召回（说法不同但意思近）；补关键词缝，不单独承担对象理解。
- **Enrichment（规则 / 备注 / 后期 LLM）**：在 Capture 后把「标题+链接」补成可问对象（类型、意图别名、实体）；检索层消费这些字段。LLM 若参与 enrichment，只产出**待校验的结构化字段提议**；写回仍走下方数据平面。
- **「喜欢」类词**：理解层只识别「用户在要偏好内容」；「哪几条算喜欢」靠 `openCount` / 近因 / 备注等信号，不能只靠拆词。
- **禁止捷径**：不得默认「全库喂 LLM」当终极方案——窗口、成本、幻觉、隐私、确定性都会炸；业界可行形态是 **先捞候选再（可选）喂模型**。

**LLM 与数据平面边界（Normative · 架构铁律）：**

> LLM 本质是下一 token 概率模型：返回「最像上下文」的文本，**不保证真实性 / 正确性**。因此它是**强理解器与表述器**，不是可扩展的记忆硬盘，也**不得充当数据平面的事务权威**。

| 平面                              | 谁做                                                                   | 允许                                                | 禁止                                                |
| --------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| **理解 / 意图（NLU）**            | 规则优先；后期可 LLM                                                   | 口语 → 经 Zod（或等价）校验的结构化约束 / tool 提议 | 把未校验自由文本当查询或写库参数                    |
| **表述（NLG）**                   | 后期可 LLM                                                             | 解释、追问、候选人话摘要——**必须引用已有真实 id**   | 无 id 编造「找到了某条」；开放闲聊                  |
| **数据平面（查 / 插 / 改 / 删）** | 确定性 application / repository / `indexedDBManager`（及未来云端仓储） | Filter、embedding 近邻、排序、事务写回              | LLM **直接**调仓储、拼 SQL/IDB 请求、或绕过校验写库 |

允许的唯一接线形态：

```text
LLM（或规则）→ 结构化提议（Zod 校验 + 业务门禁）
  → 确定性代码执行读/写
  → 真实 MemoryItem（带 id）回到 UI /（可选）再交给 LLM 做表述
```

- **读路径**：检索与命中集合由算法/索引决定；LLM 至多在**已捞出的候选**上重排或解释。
- **写路径**（含 enrichment）：模型输出 = 提议；落库 = 代码。禁止「模型说写就写」。
- **事实源**：本地 IndexedDB MemoryItem（经 `indexedDBManager`）；模型权重与生成文本都不是事实源。

#### 对象理解与记忆索引（Normative）

Yiveno 要跨越“内容搜索”的分水岭，必须具备**对象理解（object understanding）**与**记忆索引（memory indexing）**能力：

- 不只知道用户保存了什么**字符串**
- 还要尽量知道那**是什么东西**
- 以及用户和它之间**发生了什么**

最小目标不是“理解一切”，而是让系统能把口语化记忆线索翻译为可检索约束。

优先理解的线索类别：

1. **内容线索**：诗 / 歌 / 文章 / 代码 / 命令 / 引用 / 密码等对象类型；作者 / 主题 / 实体
2. **行为线索**：保存过 / 打开过几次 / 反复打开 / 看了一半 / 快速关闭
3. **时间线索**：前天 / 上周 / 前段时间 / 最近 / 很久以前
4. **主观感受**：很嗨 / 很实用 / 很震撼 / 很长 / 看不太懂
5. **任务语境**：写方案时看的 / 学某技术时存的 / 做某产品分析时记的

**Normative 路线：**

- 优先把用户的口语回忆拆成这几类线索，再做召回与排序
- 先服务高频真实口语请求，不追求一次覆盖所有对象类型
- 能力落点应是“记忆可问”，而不是“文本可搜”
- 结构化理解优先在 **Capture-time enrichment** 或后续异步 enrichment 生成；Recall 时消费这些结构化线索
- 若能力不足，必须诚实降级为候选/追问；不得假装“懂了”
- enrichment 再厚，也只服务「库内找回」；**不得**据此把产品做成生活推荐助手

#### 市场语言与 Recall Language Strategy（Normative）

**实战前提：** 词典、canonical、parser、enrichment、追问芯片、单测语料的设计，必须先回答「用户来自哪里、主用什么语言发起 Recall」——**不得**按开发团队当前母语或仓库里已有的 `_locales` 倒推内部建模。

**目标市场判断（Normative · 按投入产出比）：**

| Tier   | 市场/语言                                              | 典型特征                                                                     | 产品投入           | Parser                              | UI i18n              |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------ | ----------------------------------- | -------------------- |
| **T1** | **英语（en）**                                         | 浏览器扩展、知识工作流、bookmark/read-later/AI tool 的主生态、传播与付费意愿 | **完整投入**       | **一级：完整口语解析**              | 完整                 |
| **T2** | 高互联网渗透、英文兼容较强（欧陆多国、印度、东南亚等） | 本地语言多样，但软件使用场景中英混用常见                                     | 次要投入           | 英文 parser 通常可覆盖多数 Recall   | 按需扩展             |
| **T3** | 强本地语言市场（ja / ko 等）                           | 用户更倾向原生口语输入，不能只靠英文兜底                                     | 视增长验证再投     | P1+ 才做深度 alias / 本地化 parser  | 可先行 i18n          |
| **T4** | 低优先级语言（含 zh_CN 等）                            | 分发/触达/生态与 T1 差距大，或当前非增长主路径                               | **不反向主导设计** | 仅 UI；**不承诺**高质量自然口语解析 | 可保留（如开发便利） |

**Normative 结论：** Yiveno 是全球化产品，但 **P0 的 Recall 理解能力以英语用户实战场景为第一公民**；其它语言先保证 UI 可读，再按 Tier 与真实增长逐步加深 parser。

**三层语言分离（必须遵守）：**

| 层                 | 职责                                                                          | 语言策略                                                         |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **UI 展示**        | Popup / Settings / 空状态 / 追问文案 / 芯片标签                               | 经 `chrome.i18n` + `_locales`；随用户 locale 本地化              |
| **用户输入**       | Recall composer 中的口语线索                                                  | 接受用户自然语言；**P0 优先理解英语表达**                        |
| **内部 canonical** | `tags` / `keywords` / `entities`、parser 槽位、编排加权、芯片填入值、分析口径 | **统一 English canonical**；禁止把某种 locale 的 UI 文案当事实源 |

**Canonical 规则（Normative · 实现约束）：**

1. **对象类型**：内部 slug 与主检索词面用英文（`poem` / `article` / `song` / `code` …），不用「诗 / 文章 / 歌」等本地化词当 canonical。
2. **时间 / 行为 / 备注指向**：parser 词典以英文 surface 为主（`yesterday` / `last week` / `half read` / `my note` …）；其它语言至多作 **alias**，且不得决定 schema 字段名。
3. **实体 enrichment**：命中任何别名（如正文中的 `李白`）后，**写入库的 canonical 统一为英文**（如 `Li Bai`）；alias 只用于识别，不用于持久化分裂。
4. **追问芯片**：`label` 本地化展示；**点击填入 composer 的 `value` 用稳定英文**（或稳定 canonical token），保证跨 locale 下 parser 行为一致。
5. **单测与验收语料**：以**英语真实口语**为主；其它语言用例仅用于 alias → canonical 回归，不得用中文用例主导 parser 设计。

**P0 语言范围（与下节「P0 理解能力」对齐）：**

- **做：** 英语 recall clue 的规则解析 + enrichment + 模板追问打穿；UI 多 locale 展示。
- **不做：** 「全球所有语言都能自然口语 recall」；用中文（或其它 T4 语言）反向定义内部 tags/keywords/entities 主语料。
- **仓库现状说明：** `_locales/zh_CN` 可保留作开发与潜在市场选项，**不得**因此把中文词面写进 core lexicon 当默认 canonical。

**典型英语 P0 语料（验收参考，非穷举；与 `parse-recall-clue-lexicon` 对齐）：**

| 场景                      | 示例线索                                          | 期望解析信号                            |
| ------------------------- | ------------------------------------------------- | --------------------------------------- |
| 时间 + 类型 + 实体        | `yesterday saved a poem about Li Bai`             | yesterday · poem · Li Bai               |
| 时间 + 类型 + 内容        | `last week the code snippet about auth`           | last_week · code · auth                 |
| 行为 + 类型 + 时间        | `the song I played on repeat yesterday`           | often_opened · song · yesterday         |
| 行为 + 类型               | `the article I didn't finish reading`             | half_read · article                     |
| 备注 + 类型 + 内容        | `yesterday left a note about the deployment page` | note · page · deployment                |
| 仅类型 + 时间（无内容词） | `the article I read last week`                    | last_week · article（`read` 为 filler） |
| 零锚点（禁主 demo）       | `i feel bored` / `put a few songs i like`         | 无可靠记忆锚点；不得当助手推荐          |

**Capture enrichment 应能承接的 recall 关键词（English canonical 示例）：**

- song 站 / 音乐内容 → `music` `listen` `song` `playlist` `track`
- 文章 / 教程 / 文档 → `article` `reading` `tutorial` `guide` `docs` `story`
- 代码 / 仓库 → `code` `repo` `snippet` `development` `programming`
- 正文含 `tutorial` / `readme` / `auth` / `deploy` 等 → 写入对应 recall 别名关键词

**改词典/ enrichment / 追问前的自检三问：**

1. 这条规则首先服务 **T1 英语用户**，还是服务开发者的母语习惯？
2. 写入 IndexedDB 的是 **English canonical**，还是某种 UI 文案的副本？
3. 若去掉中文 alias，**英语主路径是否仍然成立**？若不成立，应先补英语而非加更多本地化 surface。

#### P0 理解能力范围（Normative · 防 scope 膨胀）

当前已实现：多字段关键词 + 模糊匹配 + 行为/否定加权 + Top Pick / Need A Clue。  
主要缺口是**理解层**（用户说法与库内字符常无关），但实现必须收窄。  
**语言策略见上节「市场语言与 Recall Language Strategy」：P0 parser / enrichment / 芯片 canonical 以英语为第一公民。**

**P0 做（有记忆锚点）：**

- 数据：规则 enrichment（高频站/标题类型）+ 用户备注 + **recall 导向英文 keywords**；写回 `tags` / `keywords` / `entities` — **新建已接入**；**存量经 `ensureMemoryEnrichmentBackfilled` 启动回填（版本幂等，当前 v2）**
- 编排：约束软加权 + 现有 keyword-filter + 置信度决策 — **`recallByKeywordWithParsedClue` 已接入 KeywordRecallBackend**；**模板化追问已接入 Popup**（`buildRecallFollowUpPlan`，按缺槽位）
- Query：时间词、对象类型词、备注指向、弱行为词 → 结构化约束；内容实体先当关键词 — **`parseRecallClue` 已落地**（词典以真实英语口语为主，见「市场语言策略」典型语料）
- Enrichment：域名 / 类型 / 实体 + **recall 导向英文 keywords**（如 `listen` `tutorial` `repo`）；写回 `tags` / `keywords` / `entities`

**P0 明确不做：**

- `好无聊想看点东西` / `放几首我喜欢的歌` 等零锚点助手句（禁主 demo）
- 全库喂 LLM、开放式闲聊、生活推荐叙事
- embedding / 向量库（P1）；**自然追问生成仍属后续**（M1 只做 NL→精确约束，不做 LLM 追问文案）
- 「看了一半」的精确阅读进度（无追踪数据时只作弱提示或追问）

**渐进顺序：** 规则理解打穿有锚点场景 → **M1：门禁 + LLM 将口语变为精确检索约束（Filter 仍关键词）** → embedding 补语义缝 → LLM 追问增强；模型始终是插件，事实源始终是 IndexedDB MemoryItem。

#### 里程碑 M1 · NL → 精确检索约束（Normative · 进行中）

**目标：** Popup 无论输入什么，交给筛选算法的始终是**精确关键字 / 结构化约束**（`ParsedRecallClue`），而不是整句口语。

```text
线索
  → 门禁（确定性）：lexical 短词面/URL vs semantic 口语长句
  → lexical：规则 parseRecallClue
  → semantic：LLM → Zod 提议 → 锚定映射 → ParsedRecallClue（失败降级规则）
  → buildSearchClueFromParsed → 现有 keyword Filter + 软加权
```

- **不做本里程碑内：** embedding、全库喂模型、模型写库、开放闲聊。
- **开发启用 LLM：** 默认经 Cloudflare `POST /api/ai/clue/complete`（Worker Secret `DEEPSEEK_API_KEY`）；本地需 `bun run env:sync:dev` + `wrangler dev`。可选 `chrome.storage.local` `yiveno.dev.clueLlm` 直连调试。正式 Pro 托管另接 `/api/ai/hosted/*`。
- **验收：** 理解金标 `parse-gold`；人话 → 精确 `contentTerms` 单测；Recall 用户可感变更补 `recall-eval` must 或 §5 手动步骤。

#### 隐患清单与规避（决策自检）

| 隐患                           | 若放任的后果               | 规避                                         |
| ------------------------------ | -------------------------- | -------------------------------------------- |
| 用查阅类书签当主 demo / 主叙事 | 被 Google 压死，价值证伪   | demo 与文案主角 = 摘录或「自己的话」         |
| 叙事滑成「完全失忆」(A)        | 需求显得极窄               | 对外坚持 B：残缺线索找回个人痕迹             |
| 早期做书签自动整理             | 滑入管理器，稀释寻回       | 已否决；爽点做在抓住感与找回承诺             |
| 推独立笔记创作                 | 进 Notion 红海             | 只做附着标记；独立 `note` 维持 §0.4          |
| 无线索体感、只堆无形 clues     | 用户当下无正向反馈         | 存侧可感知反馈与尽早一次找回成功             |
| 过早 LLM / AI 主卖点           | 战场错位、伤信任           | 先反馈排序；LLM 可关且非主体                 |
| 把对话做成开放式闲聊           | 主任务失焦、成本失控       | 只允许围绕 Recall 线索澄清与结果推进         |
| 滑成「生活小助手」             | 范围无限、偏离记忆硬盘     | 只找回库内痕迹；禁零锚点助手 demo            |
| 全库喂 LLM 当检索              | 成本/幻觉/隐私/不可测      | 先检索候选再（可选）喂模型；答案必须有 id    |
| LLM 直接执行查插改删           | 幻觉当事务、不可测、难回滚 | 只允提议→Zod/门禁→确定性代码；见数据平面边界 |
| 服务「几乎不 Capture」的大众   | 库空，找回无燃料           | 先打会存的人；验证存意愿先于功能堆砌         |
| 第一次模糊找回失败             | 信任杀死飞轮               | 空状态、线索解释、缩短再试；命中体验优先     |

**立项/加功能前三问：**

1. 这更服务 **摘录/个人痕迹的找回**，还是在给书签树/笔记库镀金？
2. 用户凭什么不用 **Google** / 不改用 **Notion**？
3. 是否在用功能完整感，替代「存得爽、找得准」的单次体验？
4. 这是在帮用户 **要回存过的东西**，还是在替用户 **决定现在干嘛**（助手）？

任问答不清 → 不做或先改本节。

### 0.2 MUST

1. UI → 只经 `background-client` / `chrome.runtime.sendMessage`；shape：`{ scope: 'background', type, payload? }`。
2. Chrome API（bookmarks/tabs/contextMenus/…）只在 `frontend/src/background/**`（及 SW 调用的 infrastructure browser 封装）。
3. IndexedDB 只经 `indexedDBManager`（`frontend/src/infrastructure/indexeddb/manager.ts`）。
4. 领域类型以 Zod 为准：`frontend/src/core/memory/*`；消息类型以 `frontend/src/core/messaging/*` 为准。**禁止发明新 message `type` 字符串**，先改 schema 再接线。
5. 对外文案：**筛选 / 找回**；禁止 **搜索 / Search**（各 locale 译文均遵守）。
6. 扩展用户可见文案：仅经 **`chrome.i18n` + `_locales/{en,zh_CN}/messages.json`** 与 `t()`（`frontend/src/infrastructure/i18n/`）。**禁止**在代码中写死 UI 自然语言，也禁止 `getMessage(...) || '兜底文案'`。`core` 不直接调 `chrome.i18n`（注入 `t` 或返回 message key）。官网 `website/` 不走本方案。
7. `:hover|:focus|:active` 禁止 `translate` / `scale` / `rotate`；只用背景 / opacity / shadow / outline / state layer（浮层入场与 pop/shake 例外见 §3）。
8. 实现范围以 **§1 状态表**为准；未标「已上线」= 不得当成已有行为，也不得在 UI 暗示已可用。
9. Free/当前检索：仅 **关键词 Filter**（Hybrid / embedding 仍非默认，见 §5）。**理解层里程碑 M1**：允许「任意线索 → 精确检索约束」；门禁后口语可走 LLM（可关；失败降级规则）。不得全库喂模型，不得模型返回无真实 MemoryItem id 的答案。
10. UI 图标：**Material Symbols Outlined**；按需内联于 `frontend/src/infrastructure/ui/icons/`，经 `MaterialSymbolIcon` / `md-icon-button` 使用。禁止另引 Lucide/Font Awesome 等第二套图标体系；禁止依赖 Google Fonts CDN（扩展离线）。
11. **图标优先于文案**：工具操作、导航、重复出现的动作尽量用通识图标代替可见文字；hover（及键盘聚焦）用 `title`（及 `aria-label`）展示完整文案，文案仍经 `t()`。不适用于主按钮 CTA、说明性正文、空状态、表单标签等必须读字的场景。
12. **验收先于合入**：Recall / Capture 用户可感变更须先有 `recall-eval` **`must` case** 或 §5 可复现手动步骤（详见 §1.1）；禁止无归属合入。

### 0.3 MUST NOT

- 偏离 §0.1 / §0.1.1：用功能堆砌、管理回潮、开放式闲聊、AI 主卖点、**生活小助手叙事**替代「存找爽感 + 长期发育」。
- 以查阅类书签找回、书签自动归文件夹/智能整理 Chrome 树为主卖点或主 demo（被 Google / 整理器逻辑压死；见 §0.1.1）。
- 把独立空白笔记创作做成可用主路径或 UI 暗示已有笔记库（Notion 赛道；见 §0.4）。
- 恢复旧双面板书签树、侧边栏管理页、AI 智能重构/聚类主卖点、以「管理书签」为中心的 UI。
- 以「放首歌 / 好无聊看点东西」等**零锚点助手句**做主 demo 或暗示 Yiveno 会替用户编排生活。
- 默认「全库喂 LLM」当 Recall 主路径，或允许模型返回无真实 MemoryItem id 的答案。
- 让 LLM **直接执行**数据平面操作（查/插/改/删 IndexedDB 或未来关系库/云端仓储），或把未校验的模型输出当作写库权威；唯一允许形态是「结构化提议 → Zod/业务门禁 → 确定性代码执行」（见 §0.1.1「LLM 与数据平面边界」）。
- UI 直连 `indexedDB.open` / `chrome.bookmarks.*` / `chrome.tabs.*`。
- 在 Service Worker 使用 `window` / `document` / `localStorage`。
- 把附录 A（愿景/商业化/品牌）当成要立刻实现的功能列表。
- 默认上传用户内容到云端或第三方 AI。

### 0.4 当前优先实现项（Phase A）

**记忆库轻浏览已上线**（`library.html`；左侧类型 Tab，**默认摘录**）。摘录可软删；摘录详情、线索解释 / 空状态、Omnibox、快捷键、Settings、划词浮层已上线。

**说明：** 页内左侧类型切换 ≠ 旧「侧边栏管理页」/书签树；禁止整理中心化回潮。

**下一项：里程碑 M1**——理解层把门禁 +（可选）LLM 接到 KeywordRecallBackend，保证交给 Filter 的是精确约束；Hybrid / embedding / 倒排索引仍未开。

**类型优先级（与 §0.1.1 一致）：** 主动 Capture 与体验打磨优先 **摘录 + `clues.note`**；书签继续导入/sync 但为配角；记忆库默认 Tab = 摘录。  
**独立 `note` 类型（预留）：** 有边界需求（无出处闪念），但属辅助，**当前不接入**。未验证「无处可挂」的规模流失前，不得做成可用入口，也不得在 UI 暗示已有独立笔记库。若将来做，须极瘦（纯文本、无文件夹/富文本/双向链）。

**入口能力差异（Normative）：** 共用同一 `recallService` / Filter；壳不同——Omnibox 为单次命中、无会话；快捷键找回打开 Popup（对话式找回主壳）；Popup 的默认交互是围绕 Recall 的多轮澄清与结果推进：高置信时直接给单一主答案，低置信时给排序候选并允许继续补线索；**允许对话式找回，不允许开放式闲聊。** 书签 Capture：**仅** Chrome 原生加书签 + 导入/增量 sync，不提供「保存当前页」快捷键或 Popup 按钮。快捷键改绑：Settings → Chrome 原生 `chrome://extensions/shortcuts`（扩展无法自行改键）。

### 0.5 权威路径速查

| 主题                         | 路径                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| MemoryItem / clues / payload | `frontend/src/core/memory/`                                  |
| Background 消息联合类型      | `frontend/src/core/messaging/background-messages.ts`         |
| UI 发消息                    | `frontend/src/infrastructure/messaging/background-client.ts` |
| SW 分发                      | `frontend/src/background/handlers/message-handler.ts`        |
| Recall                       | `frontend/src/application/recall/recall-service.ts`          |
| Omnibox                      | `frontend/src/background/listeners/omnibox.ts`               |
| Commands（快捷键）           | `frontend/src/background/listeners/commands.ts`              |
| Command ID 契约              | `frontend/src/core/commands/command-ids.ts`                  |
| Settings                     | `frontend/src/pages/settings/Settings.vue`                   |
| Popup                        | `frontend/src/pages/popup/Popup.vue`                         |
| 通用键盘意图（↑↓←→/Enter）   | `frontend/src/core/ui/keyboard-command.ts`                   |
| 线性列表选中下标             | `frontend/src/core/ui/list-selection.ts`                     |
| 摘录详情                     | `frontend/src/pages/detail/Detail.vue`                       |
| 记忆库                       | `frontend/src/pages/library/Library.vue`                     |
| UI 图标（Material Symbols）  | `frontend/src/infrastructure/ui/icons/`                      |
| 扩展 i18n（`t` / locales）   | `frontend/src/infrastructure/i18n/` + `public/_locales/`     |

---

## 1. 现状 vs 目标（Normative）

| 能力                             | 状态                 | 说明                                                                                   |
| -------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| Popup 对话式找回                 | 目标 · 当前主方向    | 统一为对话式 Recall：高置信给单一主答案，低置信给排序候选，并自然承接多轮补充线索      |
| 右键保存选区                     | 已上线               | Text Excerpt；非书签的主动 Capture                                                     |
| 划词保存浮层                     | 已上线               | Content Script；可直存或「添加备注」后写入 `clues.note`；Settings 可关；默认开         |
| 书签/摘录事后备注                | 已上线               | `UPDATE_MEMORY_NOTE`；书签树编辑；仅本地 `clues.note`，不同步 Chrome                   |
| Chrome 书签导入 + 增量 sync      | 已上线               | 书签唯一写入主路径；原生加书签 → onCreated 同步；upsert 保留 note                      |
| LocalProfile / ownerId           | 已上线               | 未登录可用                                                                             |
| Settings                         | 已上线（最小）       | `options_ui`；快捷键查看+跳转原生改键页；隐私/同步/AI/账户仅标注未上线                 |
| Offscreen                        | 占位                 | 预留 embedding                                                                         |
| Omnibox 找回                     | 已上线               | 关键词 `yi`；共用 `recallService`；单次无会话                                          |
| 快捷键找回                       | 已上线               | `_execute_action`（默认 `Alt+Shift+Y`）开 Popup                                        |
| 快捷键打开记忆库                 | 已上线               | `open_library`（默认 `Alt+Shift+L`）                                                   |
| 快捷键打开设置                   | 已上线               | `open_settings`（无默认建议键；Chrome 最多 4 个 suggested_key，可自绑）                |
| 快捷键保存选中文字               | 已上线               | `save_selection`（默认 `Alt+Shift+E`）→ 划词脚本直存；`captureEntry=shortcut`          |
| 快捷键选中文字并备注             | 已上线               | `save_selection_with_note`（默认 `Alt+Shift+N`）→ 打开划词备注面板                     |
| 手动「保存当前页」               | 不做                 | 与 Chrome 原生书签重复；已移除 UI/快捷键/消息                                          |
| 结果线索解释强化                 | 已上线               | 主因「因字段含「token」」+ 次要字段；Top Pick 线索回显                                 |
| Popup 空状态分层                 | 已上线               | 空库 / 有库 idle 与 no_match 分文案；有库可「缩短后再试」                              |
| 摘录详情落地页                   | 已上线               | `detail.html?id=`；摘录打开详情；书签仍直开 URL；`GET_MEMORY_ITEM`                     |
| 记忆库轻浏览                     | 已上线               | `library.html`；**默认摘录**；书签=Chrome 目录只读树；摘录=时间列表；`?type=` 刷新保留 |
| 摘录删除                         | 已上线               | 软删 `deletedAt`；记忆库列表 / 详情页；`DELETE_MEMORY_ITEM`；书签不经此删              |
| Need A Clue / 否定反馈           | 已上线（过渡）       | 现为最小切片；后续并入对话式 Recall 主流程，不再以“一次追问”心智对外表达               |
| 多源线索与权重（§7.1）           | 目标 · 按模块渐进    | 收集要宽、采信要窄；环境为弱上下文；产品内→选区→芯片→重排；未上线不得暗示可用          |
| Hybrid Filter                    | 目标 · Phase B / Pro | 非 Free；倒排/embedding 仍未开                                                         |
| 云同步 / 账号 UI                 | 目标 · Phase C       | AccountBinding 已预留                                                                  |
| 分享                             | 目标 · Phase C       |                                                                                        |
| 轻管理余项（标签/失效链接/统计） | 目标 · Phase D       | 摘录删除已提前上线；书签仍只经 Chrome 同步软删                                         |

### 1.1 「已上线」验证归属（Normative）

口径：**单测** = Vitest（含 handler/application/core）；**eval** = `frontend/src/core/recall/eval` 的 `must`/`stretch`；**E2E** = `scripts/e2e-management.mjs` 薄冒烟；**手动** = 真机/扩展清单（发版或改到才验）。一项可多列并存。`缺口` = 尚无自动归属、仅靠偶然手测。

| 能力                                      | 单测 | eval | E2E | 手动 | 备注                                          |
| ----------------------------------------- | ---- | ---- | --- | ---- | --------------------------------------------- |
| 右键保存选区                              | ✓    | —    | —   | ✓    | `context-menu` / capture 服务；真机右键需手动 |
| 划词保存浮层                              | ✓    | —    | —   | ✓    | `selection-toolbar-*`；页面浮层需手动         |
| 书签/摘录事后备注                         | ✓    | ✓    | —   | ✓    | eval：`semi-fuzzy-type-b-note`；树编辑手测    |
| Chrome 书签导入 + 增量 sync               | ✓    | —    | —   | ✓    | import/sync 服务单测；真机 sync 手测          |
| LocalProfile / ownerId                    | ✓    | —    | —   | —    | `local-profile*`                              |
| Settings（最小）                          | ✓    | —    | ✓   | ✓    | E2E：打开 `settings.html`                     |
| Omnibox 找回                              | ✓    | —    | —   | ✓    | 共用 `recallService`；壳与建议列表手测        |
| 快捷键找回（开 Popup）                    | ✓    | —    | —   | ✓    | commands registry；真机按键手测               |
| 快捷键打开记忆库                          | ✓    | —    | —   | ✓    | 同上                                          |
| 快捷键打开设置                            | ✓    | —    | —   | ✓    | 同上                                          |
| 快捷键保存选中文字                        | ✓    | —    | —   | ✓    | selection 命令封装单测；真机手测              |
| 快捷键选中文字并备注                      | ✓    | —    | —   | ✓    | 同上                                          |
| 结果线索解释强化                          | ✓    | —    | —   | ✓    | `explain-recall-match*`；卡面手测             |
| Popup 空状态分层                          | ✓    | —    | —   | ✓    | `popup-empty-copy*`                           |
| 摘录详情落地页                            | ✓    | —    | —   | ✓    | `GET_MEMORY_ITEM` / open-href；页手测         |
| 记忆库轻浏览                              | ✓    | —    | —   | ✓    | library tree/tabs；页手测                     |
| 摘录删除                                  | ✓    | —    | —   | ✓    | delete handler；库/详情手测                   |
| Need A Clue / 否定反馈                    | ✓    | ✓    | —   | ✓    | eval：`need-a-clue-*`；dismiss 单测；对话手测 |
| 关键词 Recall 主路径（Filter + 口语解析） | ✓    | ✓    | ✓   | ✓    | eval=`must` 门禁；E2E=Popup 固定线索→结果卡   |
| Popup 对话式壳（多轮 UI）                 | —    | —    | 薄  | ✓    | E2E 只断言有结果卡；多轮/芯片靠手测           |

**合入门禁（Normative）：**

1. 新增或显著改变 **Recall / Capture 用户可感行为** 时，合入前须至少满足其一：
   - 在 `recall-eval` 增加或更新 **`must` case**，且相关单测/CI 绿；或
   - 在 §5 验收清单写明 **可复现的手动步骤**（含期望结果）。
2. 禁止「只改代码、无验收归属」。合并后应能在本表或 §5 找到覆盖方式。
3. **E2E 边界：** 仅薄冒烟——装载扩展 → Popup 发固定线索 → 断言出现结果卡；可保留打开 settings。**不上**全量可视化回归、大型 Playwright 套件、逐 UI 状态 E2E。
4. 未标「已上线」的能力不得用 E2E/文案暗示可用。

---

## 2. 领域契约（Normative）

权威实现：`frontend/src/core/memory/*`。文档与 Zod 冲突 → **先改一方并立刻对齐另一方**。

### 2.1 可写入类型（MVP）

`bookmark` | `text_excerpt`  
预留不可写：`image` | `video` | `note` | `file`  
（`note`：有边界需求但不做当前范围；见 §0.4。勿与 `clues.note` 附注混淆。）

### 2.2 公共字段

`id`, `ownerId`, `sourceLocalProfileId`, `clues`, `createdAt`, `updatedAt`, `deletedAt?`

- `ownerId` = `accountId ?? localProfileId`
- `CaptureEntry` = `popup` | `context_menu` | `selection_toolbar` | `omnibox` | `shortcut` | `sync` | `import`

### 2.3 Payload（必填摘要）

- **Bookmark**：`title`, `url`, `domain`；可选 favicon / chromeBookmarkId / parentFolderId / chromeCreatedAt
  - **备注（Normative）**：可事后写入 `clues.note`（仅存 Yiveno，不同步 Chrome）；记忆库书签树可展示/编辑——**给以后的自己留「这是干啥的 / 为啥存」**；Chrome sync upsert **必须保留**已有 note。
  - **召回**：与摘录共用 `clues.note` 强线索权重。
- **TextExcerpt**：`selectedText`, `sourceUrl`, `pageTitle`, `domain`；可选 contextBefore/After；捕获可选 `note` → `clues.note`（附注，≠ 独立 `note` 类型）；亦可事后 `UPDATE_MEMORY_NOTE`
  - **展示（Normative）**：无强制标题；`selectedText` 为主内容；有备注时列表/详情在正文与出处之间展示 `clues.note`；`pageTitle` / `domain` 仅作出处。用户自拟备注标题属后续能力，未上线前不得用页名冒充标题。
  - **召回（Normative）**：`clues.note` 为强线索字段（权重大于标题，计入主文命中加成）。

### 2.4 Clues

写入尽量填 `title` / `textExcerpt` / `sourceUrl` / `domain` / `captureEntry`。  
`embedding` 当前不生成。行为字段 `openCount` / `lastOpenedAt` 默认 0/null。

### 2.5 身份

`LocalProfile` + 可选 `AccountBinding`（`frontend/src/core/identity/`）。未登录不阻塞 Capture/Recall。

---

## 3. UI 与术语（Normative）

- 文案：筛选 / 找回；禁止 Search / 搜索。
- **图标优先：** 工具栏/导航/行内动作等可通识表达的控件优先图标；须具备通识性（删除、设置、打开库等用常见 Material Symbol）。可见标签可省略时，**hover / focus 用 `title` 显示完整文案**，并同步 `aria-label`（同源 `t()`）。禁止晦涩自定义隐喻图标。
- 交互态禁止几何变换（§0.2）；例外：浮层入场短动画；`pop`/`shake` 不可用于行 hover。
- 空状态：无记忆时引导保存或等待导入，不空白报错。
- 受限页（`chrome://` 等）保存失败 → 明确文案。
- 无选区 → 不提供「保存选区」。
- 重复数据：**库内** MVP 允许并存（含重复 URL / 相同摘录正文）。**Recall 结果层**须折叠展示（见下）。

### 3.1 Recall 重复折叠（Normative）

- **范围：** 仅 Popup / Omnibox 共用的 Recall 结果；不写入去重、不改记忆库树/列表。
- **书签键：** 规范化完整 URL（host 小写并去 `www.`；去默认端口；非根 path 去尾 `/`；保留 protocol / query / hash）。**不同 path 仍为不同键。** 禁止复用会去掉 hash 的 sync 归一化。
- **摘录键：** `payload.selectedText.trim()` 全等；**不**拼 `sourceUrl`（跨页同句会折——已接受）。
- **跨类型：** 书签 ↔ 摘录永不互折。
- **代表项：** 组内 score 高 → 有 `clues.note` → `lastOpenedAt`/`openCount` → **`createdAt` 最晚** → `id`（完全相同时以最晚创建为唯一决胜）。
- **stacks N：** 等于该折叠键（同规范化 URL）在本次关键词命中集中的组员数；**不是**同域名全部书签，也不是「全部含线索的命中总数」。
- **Top / Also 互斥：** Also 不得出现与 Top 同一折叠键，或（双方均为书签时）同一规范化域名。同站其它 path 不进 Also，也**不**并入 Top 的 stacks N。过滤后回填名额。
- **UI（Popup）：**
  - N≥2 时结果卡**右上角**展示 Material Symbol `stacks` + 数量 N（图标优先；`title`/`aria-label` 经 `t()`）。
  - **主卡点击 / Enter：** 打开代表（URL 或详情），与无折叠时相同。
  - **点 `stacks` 控件：** 展开/收起同组其余条目（纵向列表）；无扑克叠/扇开动效。
  - 键盘 MVP：↑↓ 只在代表行间移动；展开不改变键盘行模型。
- **Also 名额：** 折叠后按互斥规则回填，目标仍约 Top1 + Also≤5 **互异组**。
- **Omnibox：** 静默折叠；description 可带「共 N 条」；无展开 UI。

---

## 4. 消息协议（Normative）

- `scope` 必须为 `'background'`（`BACKGROUND_MESSAGE_SCOPE`）。
- **已登记 type（禁止擅自增删拼写）：**

| type                                | 用途                                   |
| ----------------------------------- | -------------------------------------- |
| `PING`                              | 探活                                   |
| `GET_LOCAL_IDENTITY`                | 本地身份 + ownerId                     |
| `CAPTURE_BOOKMARK`                  | 写入书签记忆（sync/内部）              |
| `CAPTURE_TEXT_EXCERPT`              | 写入摘录                               |
| `LIST_MEMORY_ITEMS`                 | 列表                                   |
| `GET_MEMORY_ITEM`                   | 按 id 读取单条 MemoryItem              |
| `DELETE_MEMORY_ITEM`                | 软删 MemoryItem（当前仅摘录）          |
| `UPDATE_MEMORY_NOTE`                | 更新 `clues.note`（书签/摘录事后补注） |
| `RECALL_WITH_CLUE`                  | 线索找回                               |
| `GET_CHROME_BOOKMARK_IMPORT_STATUS` | 导入进度                               |
| `GET_BOOKMARK_LIBRARY_TREE`         | 记忆库书签目录树（只读）               |
| `GET_EXTENSION_COMMANDS`            | 读取命令与快捷键绑定                   |
| `OPEN_CHROME_SHORTCUTS_PAGE`        | 打开 Chrome 快捷键设置页               |
| `GET_USER_SETTINGS`                 | 读取用户设置                           |
| `UPDATE_USER_SETTINGS`              | 更新用户设置                           |

新增能力：先改 `frontend/src/core/messaging/*` + handler，再改 UI。

**失败响应（演进契约）：** 面向用户的失败须带稳定 **`errorCode`**（英文枚举常量）；UI 经 `t()` 按 code 渲染文案。**禁止**用本地化 `error` 字符串做控制流分支（例如 `error.includes('未找到')`）。可选字段 `error` 仅供调试，不得作为 UI 主文案或分支依据。

**消息域 `errorCode`（已落地）：**

| 域       | code                                                     | 含义                        |
| -------- | -------------------------------------------------------- | --------------------------- |
| Memory   | `MEMORY_NOT_FOUND`                                       | 记忆不存在或已删            |
| Memory   | `MEMORY_DELETE_BOOKMARK_FORBIDDEN`                       | 书签不可经扩展软删          |
| Memory   | `MEMORY_OPERATION_FAILED`                                | 其它 Memory 操作失败        |
| Memory   | `CAPTURE_UNSAVABLE_PAGE`                                 | 不可保存选区的页面          |
| Memory   | `CAPTURE_EMPTY_SELECTION`                                | 选区为空                    |
| Recall   | `RECALL_FAILED`                                          | 线索找回失败                |
| Settings | `SETTINGS_READ_FAILED` / `SETTINGS_UPDATE_FAILED`        | 读写用户设置失败            |
| Import   | `IMPORT_STATUS_READ_FAILED` / `LIBRARY_TREE_READ_FAILED` | 导入状态 / 书签树读取失败   |
| Commands | `COMMANDS_READ_FAILED` / `SHORTCUTS_PAGE_OPEN_FAILED`    | 快捷键列表 / 打开设置页失败 |
| Identity | `IDENTITY_READ_FAILED`                                   | 本地身份读取失败            |
| Dispatch | `UNKNOWN_MESSAGE_TYPE` / `MESSAGE_DISPATCH_FAILED`       | 未知消息或分发未捕获异常    |

书签 bulk 导入持久状态失败时写 `errorCode: BOOKMARK_IMPORT_FAILED`（`ChromeBookmarkImportState`）。

schema：`frontend/src/core/messaging/*`、`chrome-bookmark-import-state.ts`。

---

## 5. 功能优先级与验收（Normative）

### 5.1 能力分层

| 层          | 召回                         | 阶段                                 |
| ----------- | ---------------------------- | ------------------------------------ |
| Free / 当前 | 关键词 Filter                | 已上线                               |
| Pro         | Hybrid（关键词 + embedding） | Phase B                              |
| LLM 增强    | 摘要/解释/追问等             | Phase B+；可关闭；仅服务 Recall 对话 |

冲突时以本表为准：**Hybrid ≠ 当前 P0 默认工作**。

### 5.2 已交付基线验收

1. Popup 可开；空线索无误命中。
2. Chrome 加书签或导入完成后，标题/域名片段可 Top Pick 找回。
3. 右键摘录后可用摘录词找回。
4. 书签导入有真实进度或明确失败；导入项可找回。
5. Chrome 侧书签变更后，再次 Recall 可见一致结果。
6. 无 Search 文案；无行级位移/缩放 hover。
7. 无「保存当前页」用户入口（Popup / 快捷键 / 消息）。

### 5.3 Phase A（Omnibox / 快捷键）验收

1. Omnibox 触发后策略与 Popup 一致（同一 `recallService`）。
2. 不引入第二套搜索/筛选实现。
3. Omnibox / 快捷键 §1 状态已更新为已上线。
4. Omnibox 入口为单次命中：建议列表 → 打开 URL；无追问/会话。
5. 快捷键找回：`_execute_action` 打开 Popup；不经 `onCommand` 自建第二套找回。
6. 快捷键 `open_library` / `open_settings` 分别打开记忆库与设置页（可改键）；`save_selection` / `save_selection_with_note` 对当前页选区直存或打开备注面板。
7. 不提供「保存当前页」快捷键/消息；书签靠 Chrome 原生 + 导入/增量 sync。
8. 新自定义命令须先改 `core/commands/command-ids.ts` + manifest，再注册 handler。
9. Chrome 最多 4 个带 `suggested_key` 的命令（含 `_execute_action`）；超出仅注册不设默认。

### 5.4 后续优先级（摘要）

- **P0 / Phase A**：线索解释/空状态、摘录详情、记忆库轻浏览 **已完成**；下一项用户指定
- **P1 / Phase B**：索引、embedding、Hybrid、反馈、Need A Clue
- **P2 / Phase C**：分享、云同步、账户 UI；Settings 隐私/同步/AI/账户分区落地
- **P3 / Phase D**：标签/失效链接/统计等轻管理余项（摘录删除已提前上线）

**禁止重做**：双面板重组、复杂拖拽整理、AI 聚类主卖点、大规模书签树编辑。

### 5.5 Settings IA（最小已上线）

| 分区   | 状态   | 说明                                               |
| ------ | ------ | -------------------------------------------------- |
| 保存   | 已上线 | 划词浮层开关（默认开）                             |
| 快捷键 | 已上线 | 展示绑定；改键跳转 `chrome://extensions/shortcuts` |
| 隐私   | 未上线 | 仅占位文案，不暗示可用                             |
| 同步   | 未上线 | 同上                                               |
| AI     | 未上线 | 同上                                               |
| 账户   | 未上线 | 同上                                               |

### 5.6 扩展入口

| 入口            | 现状                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `popup.html`    | 活跃；可打开 Settings                                                                                                        |
| `background.js` | 活跃                                                                                                                         |
| `settings.html` | 已进 `options_ui`（`open_in_tab: true`）                                                                                     |
| content script  | 已注册；`content-selection-toolbar.js`（http/https）                                                                         |
| offscreen 源码  | 占位；未注册 permission；embedding 接入前不启用                                                                              |
| Omnibox         | 已注册；keyword `yi`                                                                                                         |
| `commands`      | 已注册；找回 `Alt+Shift+Y`；记忆库 `Alt+Shift+L`；划词保存 `Alt+Shift+E`；划词备注 `Alt+Shift+N`；设置无默认建议键（均可改） |

---

## 6. 架构（Normative）

```text
Chrome API / 选区
  → Background（唯一监听者）
  → IndexedDB（indexedDBManager）
  →（可选 Pinia；Popup 可用组件状态）
  → Vue（pages/；可收敛 presentation/）
  → sendMessage → Background
```

- 依赖：`pages|presentation → application → core`；`application` → `infrastructure`。
- UI 访问 Background：**仅** messaging client。
- 导入 = 核心业务（真实进度）。embedding = 辅助（Offscreen/队列，不阻塞关键词 Recall）。
- 目标规模指导：2 万 MemoryItem；当前全量扫描上限约 10000；倒排/向量索引仍属 Phase B 余项。
- 长期：Cloud Memory DB 为云端事实源；本地 IndexedDB 变缓存——**不提前重写本地链路**。
- **禁止回潮**：旧管理页/侧边栏/书签树编辑/AI 自动整理进 build 或 manifest。

新功能顺序：契约 → repository → Background 消息 → Recall/Filter → UI。

---

## 7. 找回体验（Normative 要点）

```text
用户给出残缺线索
  →（MVP 规范化）→ 关键词 Filter → 排序
  → 高置信：直接给单一主答案 → 打开
  → 低置信：给排序候选 → 用户补充一句 → 再找回
  → 反馈写回（打开 / 否定）→ 再排序
```

| 形态           | Normative                                                            |
| -------------- | -------------------------------------------------------------------- |
| 高置信主答案   | 必须由 Yiveno 直接给出最自信结果，替用户完成筛选                     |
| 低置信排序候选 | 可返回候选列表，但需明确表达“不够确定”，并承接继续补线索             |
| 多轮补充线索   | Popup 主路径允许连续多轮；用户补充信息应被理解为对上一轮结果的澄清   |
| No Match       | 允许明确承认没对上；空库引导 Capture；有库时优先提示补哪类线索更有效 |

原则：

- **统一为对话式找回主路径**，不再并存第二套“搜索框心智”主交互。
- **高置信时替用户做决定**：先给一个主答案，而不是默认抛列表让用户筛。
- **低置信时再退回候选**：列表是对话中的中间产物，不是默认终点。
- **补充线索应像回消息**：用户的下一句默认承接上一轮上下文，而不是一次全新孤立查询。
- **允许多轮澄清**，但范围只围绕 Recall 推进；不得滑向开放式闲聊。
- 卡片要有线索，不只标题/URL；系统回复需帮助用户理解“为什么是它”或“下一句补什么最有效”。
- 用户输入首先被视为**记忆线索表达**，而不只是关键词；Recall 应尽量消费时间、行为、主观感受、对象类型等线索。
- **回答的是「库里最可能是哪一条」**，不是「你现在该听什么 / 看什么」；行为加权服务寻回置信度，不服务助手推荐人格。

### 7.1 多源线索与权重（Normative · 按模块渐进）

**方向保留：** Recall 可从多个通道收集辅助证据（用户口语、产品内行为、可选 Chrome 环境），以提高命中置信度。**准确率不随线索数量自动上升**——取决于是否能估权、提纯有价值信息、过滤噪声。目标是「多通道收集 → 显式估权 → 只让高置信进入决策」，不是「环境信息越多越好」。

**原则：**

1. **收集要宽，采信要窄**：每个信号先判断「多像用户此刻的寻回意图」，再决定：进入主线索 / 仅重排软分 / 变成可选追问芯片 / 直接丢弃。
2. **用户开口优先于环境**：用户刚输入的字、主动点的芯片、页内选区 = 强线索；Chrome 停留页、开着的标签 = 弱上下文。**不得**默认假设「当前浏览页 = 要找的东西相关」（例如正在看 YouTube 不等于要找回 YouTube 相关痕迹）。
3. **环境信号默认不自动注入线索框**：适合低置信时的可选芯片（如「跟当前站有关」「刚才看过的」）或候选重排；自动写入主 query 易放大噪声、伤害第一次模糊找回信任。
4. **不得滑成环境搜索 / History 搜索**：长尾 History、剪贴板默认读取、常驻高频站环境等属噪声或高隐私成本，默认忽略。

**信号分级（实现与产品共用口径）：**

| 层级   | 例子                                                             | 默认态度                               |
| ------ | ---------------------------------------------------------------- | -------------------------------------- |
| **强** | 用户刚输入的线索、主动点的追问芯片、页内选区预填                 | 当主线索                               |
| **中** | 刚关闭/刚访问的标签、刚存的摘录、上次未完成线索、产品内近期打开  | 追问芯片或轻加权；不默认静默改写主线索 |
| **弱** | 当前 Tab 域名/标题、同会话其它开着的标签、粗时间窗               | 仅重排软分或可选芯片                   |
| **噪** | YouTube 等常驻站环境、长尾 History、默认读剪贴板、正在播放的媒体 | 默认忽略                               |

**按模块渐进顺序（未标「已上线」不得暗示可用）：**

1. 产品内信号（最近存 / 开 / 上次线索）
2. 选区预填
3. 追问芯片（刚看过的 / 跟当前站有关等——用户点了才进线索）
4. 重排软分（只动排序，不改主 query）

---

## 8. 路线图（剩余工作 · Normative 排序）

| Phase | 内容                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------- |
| **A** | 线索解释/空状态、摘录详情、记忆库轻浏览 **已完成**；其余按用户指定                                    |
| B     | Hybrid/embedding/倒排索引；Need A Clue + 否定反馈 **最小切片已上线**；**§7.1 多源线索加权按模块渐进** |
| C     | Sync、账户 UI、隐私控制落地、分享                                                                     |
| D     | 轻管理余项（标签/失效链接/统计；摘录删除已提前）                                                      |

---

## 附录 A · Non-normative（背景；勿当 sprint 范围）

### A.1 定位与信念（详述 · 与 §0.1 / §0.1.1 同向）

**权威表述以 §0.1 + §0.1.1 为准**；此处补读者与验证口径，勿另起一套故事。

- **承诺：** 你的记忆硬盘——**随便存，随时找得着**；不用记、不用整理，Yiveno 替你记着；只记得一点点也能找它要回**自己的痕迹**。
- **信念：** 用户浏览时会自己筛兴趣，产品不培养这个；**Yiveno 只填「这次感兴趣 → 下次找回来」的鸿沟**；长期应养成「interesting → 按快捷键、不担心乱存」——这在旧书签体系下不可能，因 Yiveno 才成立；要的是未来能用，不是整理；**对话式找回是主路径，但开放式闲聊与生活小助手不是目标**；AI 是寻回引擎的插件，不是产品主体；**LLM 是强理解器，不是可扩展的记忆硬盘**。
- **资产：** 附着在互联网原文上的个人增量（摘录/附注）为主；书签配角；空白创作非目标。
- **立身：** 业务简单（存 + 找）；体验必须精打细磨。无爽点 = 无护城河。
- **发育：** 靠用户长期使用慢慢长厚；开头最难，越往后越稳。前期体验买习惯与语料，后期习惯与语料锁体验。
- **目标用户：** 会主动划存/标注的知识工作者、开发者/设计师、学生等（不是「几乎不 Capture」的大众平均）。
- **MVP 验证：** 是否更愿划存摘录、是否优先打开 Yiveno 找回个人痕迹、是否稳定 Recall、是否愿为语义/同步付费；并能回答「为何不用 Google」。

### A.1.1 当前 AI 能力判断（背景共识）

以下是当前阶段的产品/技术共识，用于校准预期，**不是对用户的能力承诺**：

- 当代 AI **足以做出明显优于纯关键词搜索的版本**，尤其在口语线索拆解、对象识别、候选重排、对话追问上。
- 当代 AI **不足以稳定达到“人脑级理解所有生活口语记忆”的程度**；不能把它包装成几乎不会错的记忆助理。
- **概率生成 ≠ 事实源**：模型返回最接近上下文的续写，不保证库内为真；故 Normative 将 LLM 限制在 NLU/NLG（及候选重排），**数据平面只认确定性代码**（见 §0.1.1「LLM 与数据平面边界」）。
- **全库喂 LLM ≠ 终极方案**：能力上限可更高，但窗口/成本/幻觉/隐私/不可测会把复杂度从 Filter 挪到隐式 pipeline；可行形态是先检索候选再（可选）喂模型，答案必须绑定真实 id。
- 真正瓶颈首先不是模型会不会说话，而是系统是否掌握了足够 rich 的线索：内容属性、行为信号、时间轴、对象类型、用户自己的话。
- 若只有原始选区字符串，很多“前天那首很嗨的歌 / 看了一半的文章”式请求会天然缺线索；必须靠 enrichment + 行为积累补足。
- enrichment / 理解做厚时，**警惕滑成生活小助手**；产品承诺始终是库内找回，不是替用户编排「现在听什么 / 看什么」。
- 可行的阶段性目标是：先把**最常见的有锚点口语请求**做得显著好于内容搜索，而不是追求全场景完美或助手化。
- 粗略判断：若只做“文本 + 基础行为 + AI 理解”，可达到理想体验的大约 **40%–60%**；若叠加更完整的结构化理解、行为记录、语义召回、对话追问，可望走向 **60%–75%**。**85%+ 的稳定类人体验不应作为短期承诺。**
- 因此路线应是：**先做高频高价值、有记忆锚点场景的明显优势，再逐步扩大理解面与置信度。**

### A.2 隐私原则（产品方向）

默认：只处理主动保存 + 授权同步的书签；不默认浏览历史/全文快照/上传第三方。  
逐步提供：本地/云端开关、删云端、导出、关 AI、模型说明。云端/语义上线前补隐私政策与同意流。

### A.3 商业化方向（配额另定）

- Free：本地、关键词 Filter、基础捕获、书签导入。
- Pro：语义 Hybrid、同步、更高配额、反馈排序、分享。
- 更高级：云端深寻回、多模态、快照额度、团队。

### A.4 品牌

禁：AI Bookmark Manager、管理你的书签、自动整理一切、永久保存看过的所有内容、更好的书签搜索（易被理解成打 Google）、你的 AI 生活助手、帮你决定听什么/看什么、零锚点「放首歌/好无聊看点东西」主 demo。  
荐：你的记忆硬盘；看到好东西扔进来；不用记，Yiveno 替你记着；想找的时候找它要；找回你划过/注过的那句；Google 找不到的是你的痕迹；Save what matters. Recall it later.

### A.5 Text Excerpt 明确不做

富文本高亮、完整网页快照、自动保存全部阅读、类 Readwise 复习系统。

### A.6 市场调研（背景 · 方向决策输入）

**权威调研文档：** [`Yiveno-市场调研-v1.md`](./Yiveno-市场调研-v1.md)（Non-normative）。

- v1 为二手资料综合 + **待验证假设**；一手访谈 / CWS 漏斗数据尚未纳入。
- **语言与区域 Tier、竞品楔子、继续开发前门槛** 以调研文档 §4、§6、§11 为准；与 §0.1.1「市场语言策略」冲突时，**先更新调研与产品文档再改代码**。
- 在 §11 门槛（访谈、Recall benchmark、分发漏斗等）未过前，**暂缓**扩大多语言 parser、LLM 主路径与新品类功能；可继续 bugfix 与 benchmark 所需小改。

---

## 修订记录

| 日期       | 变更                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 2026-07-29 | §1.1 已上线验证归属 + 合入门禁（must/验收先于合入）；E2E 薄冒烟边界（禁大 Playwright）                     |
| 2026-07-29 | §7.1 多源线索与权重：收集要宽、采信要窄；Chrome 环境为弱上下文；按模块渐进（产品内→选区→芯片→重排）        |
| 2026-07-29 | §0.1.1 知识库习惯重置：文件夹型 KB 双重隐性成本；人创造/机器索引分工                                       |
| 2026-07-31 | M1：线索 LLM 改经 Cloudflare `POST /api/ai/clue/complete`（Worker 持 DEEPSEEK Secret；扩展不持 key）       |
| 2026-07-31 | 里程碑 M1：NL→精确检索约束；门禁+LLM 理解接入 KeywordRecallBackend（dev key；失败降级规则）                |
| 2026-07-31 | §0.1.1 / §0.3：钉死 LLM 与数据平面边界（NLU·NLG 可；禁止直接写库；提议→Zod→确定性执行）                    |
| 2026-07-29 | 新增 [`Yiveno-市场调研-v1.md`](./Yiveno-市场调研-v1.md)；附录 A.6；暂停扩大功能直至 §11 验证门槛           |
| 2026-07-29 | P0：enrichment recall keywords（类型补充词 + 正文词面规则）；回填版本 v2                                   |
| 2026-07-29 | §0.1.1 典型英语 P0 语料表 + enrichment recall keywords 验收口径；口语词典对齐真实表达                      |
| 2026-07-29 | §0.1.1 市场语言与 Recall Language Strategy：T1 英语优先、canonical/UI/parser 三层分离、芯片 value 稳定英文 |
| 2026-07-29 | P0：存量 enrichment 回填（bootstrap 延迟执行，storage 版本幂等）                                           |
| 2026-07-29 | P0：模板化追问（缺槽位 reply + 芯片）；建议追加到上一轮线索                                                |
| 2026-07-29 | P0：Capture enrichment（域名/类型词/实体 → tags·keywords·entities）；upsert 合并扩展位                     |
| 2026-07-28 | P0：`parseRecallClue` + `recallByKeywordWithParsedClue` 接入主链路（规则解析/软加权，无 LLM）              |
| 2026-07-28 | §0.1.1 记忆硬盘≠小助手；LLM/embedding 分工；P0 有锚点场景收窄；禁全库喂 LLM / 零锚点助手 demo              |
| 2026-07-28 | §0.1.1 记忆库书签树：Chrome 结构 + Yiveno 私人备注层；非整理器、非纯浏览壳                                 |
| 2026-07-28 | §0.1.1 肆无忌惮存：旧书签惩罚乱存；整齐目录贬值；Capture+Recall 成对习惯                                   |
| 2026-07-28 | §0.1.1 兴趣鸿沟：用户自带兴趣筛选；随便存/随时找得着 = 超轻负担 + 踏实感 = 立身之本                        |
| 2026-07-28 | 定位升级：「记忆硬盘」心智（扔进就记着 / 想找就找它要）；§0.1.1 补用户心智表                               |
| 2026-07-28 | 写入口语记忆需求 / 对象理解与记忆索引 / 当前 AI 能力边界；明确“记忆可问”路线                               |
| 2026-07-28 | 记忆库默认 Tab=摘录；空状态文案对齐摘录主角（§0.1.1）                                                      |
| 2026-07-28 | P0：Omnibox/库打开写回；摘录存成抓住感+预填线索；首次找回引导                                              |
| 2026-07-28 | §0.1.1 定位精细化：核心资产/Google·Notion 边界/需求 A·B·C/隐患清单；MUST NOT 对齐                          |
| 2026-07-28 | §0.1 写入核心路线（寻回、体验立身、前期发育后期变强）；A.1 对齐勿另起故事                                  |
| 2026-07-26 | Recall 折叠：书签按规范化 URL 计 N；Also 同域名互斥；勿按域名吞并 stacks                                   |
| 2026-07-26 | Recall 折叠：书签按规范化域名；stacks N=同站命中数；Also 与 Top 同键互斥                                   |
| 2026-07-26 | 重复组代表：完全相同时以 `createdAt` 最晚为唯一时间决胜                                                    |
| 2026-07-26 | Recall 集合：放弃扑克叠；改用 `stacks` 图标 + N 展开同组                                                   |
| 2026-07-26 | Recall 集合卡：右侧扑克叠；主卡打开代表；「更多」hover 扇开 / 点击展开                                     |
| 2026-07-26 | Recall 重复折叠：书签域名 / 摘录正文；结果层集合卡；库内仍允许并存（键规则已修订）                         |
| 2026-07-26 | 独立 `note` 类型：有边界需求、当前不接入；优先书签/摘录/`clues.note` 核心闭环                              |
| 2026-07-25 | Popup：打开聚焦线索框；移除提交按钮；停输防抖自动找回；↑↓/Enter 键盘打开结果                               |
| 2026-07-25 | 快捷键：划词保存 `Alt+Shift+E`、备注 `Alt+Shift+N`；设置让出 suggested_key 槽位                            |
| 2026-07-25 | 快捷键：记忆库 `Alt+Shift+L`、设置 `Alt+Shift+S`（`open_library` / `open_settings`）                       |
| 2026-07-25 | 书签事后备注：`UPDATE_MEMORY_NOTE`；树展示/编辑；sync upsert 保留 note                                     |
| 2026-07-25 | 备注：列表/Popup 展示于正文与出处之间；Filter 权重 26 + 主文加成（强线索）                                 |
| 2026-07-25 | 划词浮层增加「添加备注」；`CAPTURE_TEXT_EXCERPT.note` → `clues.note`；详情可展示                           |
| 2026-07-25 | 保存成功工具栏角标 +1；Chrome 原生新书签同步成功亦闪角标                                                   |
| 2026-07-25 | UI：图标优先于文案；通识 Material Symbol + hover `title`/`aria-label`（经 `t()`）                          |
| 2026-07-25 | i18n Phase 5：清残留 UI 硬编码；CI `i18n:check`；catch 不再展示 `error.message`                            |
| 2026-07-25 | i18n Phase 4：Settings/Recall/Import/Commands/Identity 失败响应落地 `errorCode`                            |
| 2026-07-24 | i18n Phase 2：Library/Detail 文案；Memory 失败响应落地 `errorCode`                                         |
| 2026-07-24 | 扩展 i18n 契约：`chrome.i18n` + `en`/`zh_CN`；`t()`；失败响应演进为 `errorCode`                            |
| 2026-07-24 | 摘录展示：无强制标题；正文为主、页名/域名仅出处（记忆库/Popup/Omnibox/详情）                               |
| 2026-07-24 | UI 图标选型：Material Symbols Outlined 按需内联；记忆库删除改为 hover 显图标按钮                           |
| 2026-07-24 | 摘录软删上线：`DELETE_MEMORY_ITEM`；记忆库列表 / 详情；书签不经此路径删除                                  |
| 2026-07-24 | 记忆库书签 Tab：完整映射 Chrome 目录只读树；`GET_BOOKMARK_LIBRARY_TREE`                                    |
| 2026-07-24 | 记忆库轻浏览上线：`library.html` 左侧类型 Tab（默认书签）；Popup/Settings 入口                             |
| 2026-07-24 | 摘录详情落地页上线：`detail.html?id=` + `GET_MEMORY_ITEM`；Popup/Omnibox 分流                              |
| 2026-07-24 | Phase A：线索解释强化 + Popup 空状态分层（空库/有库 + 缩短再试）                                           |
| 2026-07-24 | 摘录保存成功/失败：工具栏临时 badge（+1 / !）；划词与右键共用                                              |
| 2026-07-24 | 划词保存浮层上线；Settings 开关默认开启；`captureEntry=selection_toolbar`                                  |
| 2026-07-24 | Settings 最小可用进 manifest：快捷键查看+跳转原生改键；Popup 入口                                          |
| 2026-07-24 | 移除「保存当前页」；书签仅 Chrome 原生+sync；快捷键只保留找回开 Popup                                      |
| 2026-07-24 | 快捷键已上线：命令契约+registry；找回 Alt+Shift+Y 开 Popup                                                 |
| 2026-07-24 | Popup 移除「保存当前页」UI；保存改快捷键入口；Omnibox keyword `yi`                                         |
| 2026-07-24 | Omnibox 已上线（keyword `yi`）；§0.4 入口能力差异；Phase A 下一项改为快捷键                                |
| 2026-07-23 | 确立唯一正文；现状矩阵、契约、验收、UI 约束、Hybrid 边界                                                   |
| 2026-07-23 | AI 优先重排：Quick Contract、Normative/附录分离、消息 type 表、Phase A 单一优先项                          |
