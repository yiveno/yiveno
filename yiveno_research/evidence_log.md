# Evidence Log — Yiveno Market & Competition Research

**研究参考日：2026-08-23（GMT+8）**。本文件保存一手网页与后续检索的可追溯事实。除非另有标注，产品能力均以公开页面显示为准，而非功能已实际开放的保证。

## E-001 — Trove（usetrove.app）

| 字段            | 已核验信息                                                                                                                                               | 证据与判定                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 实体区分        | `usetrove.app` 的 **Trove Beta**，与 2019 年 Blockstack 去中心化书签 DApp 以及其他同名代码库分开记录                                                     | 官网首页 [S1]。                                                                           |
| 公开定位        | “个人知识仓库”；将跨平台保存的书签、帖子和 URL 连接至 AI 对话，主张使已保存内容可被再次使用                                                              | 官网称“Connect All Your Saves Seamlessly To AI”及“personal knowledge repository” [S1]。   |
| 已声明输入      | LinkedIn 和 X 的保存内容会自动加入；页面同时呈现书签、GitHub 仓库、Substack 等用例或示例                                                                 | 官网 [S1]。仅 LinkedIn/X 被明确说为“today”；其余不应作为已上线连接器。                    |
| AI / 检索工作流 | AI 自动生成标题、相关标签与摘要；用户可以在 AI 对话中 `@Trove` 保存 URL 或查询自己的保存内容；连接方式声明为 MCP，支持 ChatGPT Apps 和 Claude Connectors | 官网 [S1]。这属于“个人内容→MCP→聊天模型”的直接竞品路径。                                  |
| 协作与分发      | 收藏集可设为私有、非公开、公开，或与朋友/同事分享；还声称提供 curated collections                                                                        | 官网 [S1]。                                                                               |
| 数据架构与隐私  | 官网称使用 Supabase（运行在 AWS 之上）；仅维护 URL 及 URL 内容摘要                                                                                       | 官网 FAQ [S1]。未见 E2E 加密、留存期、删除策略、模型提供方条款的实证说明，均为待验证。    |
| 商业化          | 目前为 Early Access / Beta，官网写明“无需信用卡”；未发现公开月费、年费、用量或用户数                                                                     | 官网 [S1]。不可据此推断免费或正式上市。                                                   |
| 待核验          | 创始人、法律主体、上线日期、团队规模、融资、活跃用户、Chrome Web Store 用户数、真实 API key 机制、用户评价                                               | 需要在 LinkedIn、公司登记、Product Hunt、Chrome 商店、Reddit、GitHub 和隐私条款分别取证。 |

## Sources

- **[S1]** [Trove 官方网站（主页与 FAQ）](https://www.usetrove.app/)，访问于 2026-08-23。

## E-002 — Trove（Lowside-Labs/Trove，开源）

| 字段           | 已核验信息                                                                                                                                     | 证据与判定                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 实体区分       | GitHub 上公开的 `Lowside-Labs/Trove`，非 `usetrove.app` 所示的云端 Early Access 产品                                                           | 仓库 README、组织名与 MIT 许可证 [S2]。                                                             |
| 定位           | 将分散在 X、Instagram、Substack、GitHub、Claude 与 ChatGPT 的个人保存内容，变为可由 Claude Code、Codex 或其他 Agent 查询的本地工作区           | README [S2]。这是“Agent 可读个人存档”路径的直接替代方案。                                           |
| 架构           | 本地工作区包含 SQLite 数据库（FTS5 搜索）、原始源载荷、可水合的 Markdown 内容，以及提供给 Agent 的 `CLAUDE.md` / `AGENTS.md` / `INDEX.md` 文件 | README [S2]。未声明向量嵌入、语义检索或远端 LLM 服务。                                              |
| 支持输入       | X（书签、likes）、Instagram saved posts、Substack、GitHub stars、Hacker News 收藏、Claude / ChatGPT 聊天导出                                   | README [S2]。网页明确列明授权方式；部分为浏览器 cookie 或当前 Chrome 标签页。                       |
| 隐私主张       | “无云端、无账户、无 API key、数据不离开本机”                                                                                                   | README [S2]。这属于项目声明；cookie 读取和浏览器自动化会带来权衡，需在报告中单列安全/平台政策风险。 |
| 工作流         | `init` 创建本地工作区；`sync` 导入来源；`hydrate` 取回外链正文；`search` 在存档检索；再把工作区交给 Agent 或 Obsidian                          | README [S2]。核心循环：同步→水合→本地索引→Agent 查询。                                              |
| 公开活跃度快照 | 页面显示 15 Stars、0 Forks、114 commits、4 releases，最新版 v0.1.3、3 contributors；页面相对时间显示最近提交约 4 个月前                        | GitHub 页面，访问于 2026-08-23 [S2]。此为可变的页面快照，不代表用户量或商业牵引。                   |
| 限制           | cookie 同步在 macOS 限制更强；Chrome / Dia 已验证，Brave / Arc 标为实验；无法保证真实收藏时间；不水合全部原生页面类型                          | README [S2]。                                                                                       |

## Sources（续）

- **[S2]** [Lowside-Labs/Trove GitHub 仓库与 README](https://github.com/Lowside-Labs/Trove)，访问于 2026-08-23。

## E-003 — Trove - Your personal bookmark organizer（Chrome 扩展）

| 字段           | 已核验信息                                                                                                                       | 证据与判定                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 实体区分       | Chrome Web Store 扩展 ID `hlghcdcicedajjdhidojdilmdeifhfnk`，由 Studio Starum 提供；与 `usetrove.app`、Lowside-Labs 开源项目不同 | Chrome Web Store [S3]。                                                                                              |
| 定位 / JTBD    | 将混乱的 Chrome 书签通过 AI 归入层级文件夹，配合模糊搜索、去重、备份和恢复，使用户更快找回内容                                   | 商店描述 [S3]。产品核心仍是 Bookmark Manager / organization，而非跨平台个人上下文层。                                |
| AI 功能        | AI 根据内容、域名和上下文分组；自然语言指令调整分类；将分组写入真正的 Chrome 书签文件夹；自动抓取页面描述以改善分组              | 商店描述 [S3]。AI 价值主要是分类与交互式组织，未声明向量检索或跨内容问答。                                           |
| 架构与隐私     | 声称书签数据保留在设备本地；AI 调用使用用户自带或 OpenRouter 的免费模型 API key；提供由用户控制的本地备份                        | 商店描述与商店隐私披露 [S3]。开发者声明不收集或使用用户数据；仍应区分“扩展自身不收集”与外部模型提供商处理 API 请求。 |
| 平台           | Chrome、Edge、Brave、Opera、Vivaldi 等 Chromium 浏览器                                                                           | 商店描述 [S3]。                                                                                                      |
| 版本与牵引快照 | v1.5.2，2026-05-18 更新；15 users；5.0 分但仅 1 条评分；开发者标为 Non-trader                                                    | Chrome Web Store，访问于 2026-08-23 [S3]。这表明公开分发已发生，但尚无可信的产品牵引证据。                           |
| 商业化         | 商店页面未显示公开订阅价格；所述免费模型 / BYO Key 机制降低开发者推理成本但将摩擦转移给用户                                      | 商店描述 [S3]；后半句是推断。                                                                                        |

## Sources（续）

- **[S3]** [Chrome Web Store：Trove - Your personal bookmark organizer](https://chromewebstore.google.com/detail/trove-your-personal-bookm/hlghcdcicedajjdhidojdilmdeifhfnk)，访问于 2026-08-23。

## E-004 — Raindrop.io

| 字段            | 已核验信息                                                                                                                                                                               | 证据与判定                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 定位 / JTBD     | 官方自称全能书签管理器：当用户在浏览时不断遇到有价值的文章、书籍、音乐或其他内容，想保留、分类、再次找到并分享时，Raindrop 提供跨端的书签库                                              | 官网 [S4]。该表述的中心仍是成熟的 Bookmark Management，而非通用个人记忆。                                                              |
| 捕获与存储      | 支持书签、文件上传（含 PDF、图片、视频）；有浏览器扩展和原生多端；可导入导出；支持 2,600+ integrations                                                                                   | 官网与定价页 [S4] [S5]。                                                                                                               |
| 组织和再发现    | Collections、tag、过滤器、手动排序、重复/失效链接检查、预览与 highlights；Pro 可全文检索网页、PDF、EPUB 与 YouTube 转录                                                                  | 官网与订阅文档 [S4] [S6]。检索能力非常强，且超出 title/URL。                                                                           |
| AI 价值         | Pro 提供 AI Assistant 与 AI Suggestions，可就已保存内容提问、协助组织及免手操作                                                                                                          | 官方订阅文档 [S6]。公开资料不足以判定其索引、模型、RAG 或记忆架构。                                                                    |
| 协作和分发      | 支持角色权限的协作和公开 collection 页面                                                                                                                                                 | 官网 [S4]。                                                                                                                            |
| 定价 / 付费理由 | 免费层不限书签、收藏集和设备；Pro 年付 $29（含 VAT 标识），购买全文检索、网页归档、AI、提醒、注释、清理工具、自动备份与每月 10GB 上传                                                    | 官方价格页 [S5] [S6]。年度 ARPU 的直接锚点为 $29（适用于网页年付展示的区域/税费口径），价值锚点是“可检索的内容+保存副本”而非仅文件夹。 |
| 数据与隐私      | 100% 云端；官方称数据存放在 AWS 法兰克福，三份副本；HTTPS 传输、私有默认、2FA、无广告/跟踪/售卖；其客户端称开源                                                                          | 安全文档 [S7]。未声明端到端加密，故不可归类为 E2E。                                                                                    |
| 公司 / 成熟度   | 官网页脚列 Rustem Mussabekov、2013–2026；安全文档称独立、自举、运营超过 13 年、无投资者/母公司                                                                                           | 官网与安全文档 [S4] [S7]。此为公司自述。                                                                                               |
| 关键竞争启示    | Raindrop 已覆盖“可扩展的捕获—归档—全文检索—多端同步”底座；Yiveno 若只新增 folder/tag/全文检索或浅层 AI 提问，差异极弱。真正的空档必须在情境化召回、跨来源身份语义和 Agent 可调用性上验证 | 基于 [S4]–[S7] 的推断。                                                                                                                |

## Sources（续）

- **[S4]** [Raindrop.io 官方主页](https://raindrop.io/)，访问于 2026-08-23。
- **[S5]** [Raindrop.io 官方定价页](https://raindrop.io/pro/buy)，访问于 2026-08-23。
- **[S6]** [Raindrop.io 帮助中心：Subscription / Pro 功能](https://help.raindrop.io/premium-features)，访问于 2026-08-23。
- **[S7]** [Raindrop.io 帮助中心：Security & privacy](https://help.raindrop.io/security)，访问于 2026-08-23。

## E-005 — Readwise Reader

| 字段            | 已核验信息                                                                                                                                                               | 证据与判定                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 核心 JTBD       | 当重度阅读者在网页、RSS、PDF、YouTube、X 帖子、EPUB、newsletter 等来源中不断消费内容，想集中阅读、标注、记住并写作复用时，Reader 将内容与 Readwise 复习、同步体系整合    | 官方产品页 [S8]。它的壁垒不只是“保存”，而是处理/复习循环。                         |
| 捕获与处理      | 浏览器扩展保存浏览器渲染后的可读内容；支持开放网页标注、移动 Share Sheet、RSS、PDF、YouTube 转录、X threads、EPUB、newsletter                                            | 官网与文档 [S8] [S10]。浏览器扩展获取正文而不仅是 URL，故内容层比纯书签更厚。      |
| 核心 UX Loop    | Capture → distraction-free read → highlight/note/tag → sync to Readwise → Daily Review / export to Notion、Obsidian 等 → 写作或学习复用                                  | [S8] [S10] [S11]。这是“记住阅读内容”的明确循环。                                   |
| 检索、AI与Agent | 官方主张全文离线搜索；Ghostreader 可提问、定义术语、简化文本；FAQ 显示 Readwise MCP Server 可把完整文档库连接到 Claude、ChatGPT、Cursor 等 MCP 客户端并可协助组织文件    | 官网 [S8]。这已进入个人阅读资料→MCP→Agent 的竞争象限。                             |
| 数据可携带性    | 官方承诺完整导出文档 CSV、订阅 OPML、上传文件 ZIP、highlight/annotation Markdown；有 public API                                                                          | 官网 [S8]。这降低供应商锁定，亦为 Agent API 使用保留路径。                         |
| 跨平台          | Web、Mac/Windows、iOS、Android、Chrome/Firefox/Safari、离线与部分 e-ink 支持                                                                                             | 官网 [S8]。                                                                        |
| 定价 / 商业模式 | 30 天免费试用；之后 Readwise（含 Reader）年付 $9.99/月或月付 $12.99/月，年付总价 $119.88；面向学生/教育者等有 50% 折扣                                                   | 官方产品与价格页 [S8] [S9]。愿付费价值锚点是学习投入的再利用与降低多工具拼装成本。 |
| 用户价值与边界  | 其公开叙事聚焦“阅读与高质量标注后的重温”，并非全量浏览历史或任意保存内容的情境化检索；因此与 Yiveno 重叠在“已保存 web content 的再检索”，但不完全替代跨社交/工具个人记忆 | 基于官网范围的分析 [S8]–[S11]。                                                    |

## Sources（续）

- **[S8]** [Readwise Reader 官方产品页](https://readwise.io/read)，访问于 2026-08-23。
- **[S9]** [Readwise 官方定价页](https://readwise.io/pricing/reader)，访问于 2026-08-23。
- **[S10]** [Readwise 文档：Saving Content to Reader](https://docs.readwise.io/reader/docs/saving-content)，访问于 2026-08-23。
- **[S11]** [Readwise 文档：Highlights, Tags, and Notes](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes)，访问于 2026-08-23。

## E-006 — mymind

| 字段            | 已核验信息                                                                                                                                                                              | 证据与判定                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 定位 / JTBD     | 当用户不想维护文件夹、标签和显性组织体系，只想捕获笔记、书签、灵感、文章与图片，并根据自己记得的线索重新找到它时，mymind 主张“Remember everything. Organize nothing.”                   | 官方主页 [S12]。这与 Yiveno 的“Recall over Organize”假设高度重叠。                                   |
| 捕获与数据类型  | 浏览器扩展一键保存 video、image、note、quote、product、article 和 web page；还支持文字片段、图片 OCR、PDF 分析、视频上传与跨设备同步                                                    | 官方首页、帮助和定价页 [S12] [S13] [S14]。                                                           |
| 组织与检索      | 自动识别内容类型、生成视觉化保存；可按颜色、关键词、品牌、日期、图像对象/风格/文字检索；Smart Spaces 自动聚合；Same Vibe 寻找视觉相似内容                                               | [S12] [S13]。这说明用户“视觉线索”是成熟竞品已明示的召回入口。                                        |
| AI 的实质位置   | AI 自动分类、图片标注、OCR、全文/视觉检索、摘要、PDF 分析与相似图像聚类；有双向链接和 Serendipity 再发现                                                                                | [S12] [S13]。AI 直接改造捕获—无需组织—检索体验，较单纯 LLM wrapper 更接近 AI-native。                |
| 工作流          | Save → 自动提取/标记/呈现 → 以联想线索搜索或 Smart Space/Serendipity 重现 → 通过笔记、双向链接继续研究                                                                                  | 基于官方功能的归纳 [S12]–[S14]。                                                                     |
| 定价 / 付费理由 | Bookmarker $4.99/月；Student of Life $7.99/月或 $79/年；Mastermind $12.99/月或 $129/年；高级 AI、阅读模式、网页备份、视频、摘要与 PDF 分析位于更高层                                    | 官方定价 [S13]。其价格证明高频视觉/多模态保存用户的 $7–13/月区间并非不可接受，但不代表普遍付费意愿。 |
| 隐私 / 团队     | 官方表示内容私人、无跟踪/不售卖；定价页称为小型独立、零外部融资团队。未找到 E2E 加密或完整数据架构的一手技术细节                                                                        | [S12] [S13]。应避免把“100% private”外推为 local-first 或 E2E。                                       |
| 战略启示        | “无感自动组织 + 视觉线索召回”已被强势占位，Yiveno 不宜将“AI 自动分类”或“忘掉文件夹”单独作为差异化。其可争夺点在于来源连接器、时间/行为上下文、可解释的混合检索与可授权给 Agent 的数据层 | 基于 [S12]–[S14] 的推断。                                                                            |

## Sources（续）

- **[S12]** [mymind 官方主页](https://mymind.com/)，访问于 2026-08-23。
- **[S13]** [mymind 官方定价页](https://mymind.com/pricing)，访问于 2026-08-23。
- **[S14]** [mymind 帮助文档：How Smart Bookmarking Works](https://mymind.helpscoutdocs.com/article/47-smart-bookmarking)，访问于 2026-08-23。

## E-007 — Pocket（已停止服务）

| 字段             | 已核验信息                                                                                                                               | 证据与判定                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 状态             | Mozilla 宣布 Pocket 于 **2025-07-08** 结束服务；用户原可导出保存内容至 **2025-10-08**，之后数据永久删除；Pocket API 也在该日期后停止读写 | Mozilla 官方公告 [S15]。作为 2026-08-23 的研究对象，Pocket 是“遗留用户迁移来源/失败案例”，不是可新增用户的活跃直接竞品。 |
| 官方背景         | Mozilla 在公告中称将资源聚焦于更符合用户日常线上需求与 Firefox 的体验/技术项目                                                           | Mozilla 公告 [S15]。公告未量化 Pocket 的留存、营收或关闭的单一经济原因，因此不能将“缺少 PMF”写成事实。                   |
| 对 Yiveno 的启示 | 个人保存服务的关闭让“可导出、可迁移、离线/本地副本、透明数据生命周期”从边缘功能转为信任与转化因素；尤其面向从 Pocket 迁移的重度保存用户  | 前半为事实 [S15]，后半为产品推断。                                                                                       |

## Sources（续）

- **[S15]** [Mozilla：Investing in what moves the internet forward（含 Pocket 时间表）](https://blog.mozilla.org/en/mozilla/building-whats-next/)，2025-05-22 发布，访问于 2026-08-23。

## E-008 — Anybox

| 字段           | 已核验信息                                                                                                                                                                                                                                         | 证据与判定                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 定位 / JTBD    | 当 Apple 用户希望在 iPhone、iPad、Mac 上迅速保存、离线搜索、整理和再次打开链接，并希望利用 iCloud 而非第三方账户同步时，Anybox 是一个 native bookmark/read-later 工具                                                                              | 官网与 FAQ [S16] [S17]。                                                                          |
| 核心能力       | Quick Save、离线 Quick Find、Spotlight、nested tags/folders、Smart Lists、系统 Share Extension、图片/文件/笔记、网页/PDF/截图归档、Siri Shortcuts 与 AppleScript                                                                                   | 官网 [S16]。组织模式明显是手动结构+属性规则。                                                     |
| 架构与平台限制 | Swift 原生 app，iCloud 同步、官方称不收集个人数据；iOS/iPadOS/macOS；FAQ 明说暂无 Windows 和 Web 的计划                                                                                                                                            | 官网 / FAQ [S16] [S17]。它是 user-owned/cloud-account 依赖的 Apple 垂直方案，不是全球跨平台方案。 |
| 定价           | Free 仅 50 链接；Pro $1.99/月、$14.99/年、$39.99 lifetime（官网显示的促销价，常规 $59.99）                                                                                                                                                         | 官网与 App Store [S16] [S18]。低价 lifetime 是云端订阅型 Yiveno 需要回避的直接价格比较。          |
| 用户实证       | 美国 App Store 页面显示 4.7/5、513 ratings。正向评价强调 iCloud 同步、速度、可定制和持续开发；负向评价认为多种附加能力让只需保存 URL 的用户感到“功能过多”，且认为 $40 超出纯链接保存愿付区间；另有评论认为 nested “tags”概念混乱且多标签操作不顺畅 | App Store 公开评价 [S18]。这是第一方应用商店用户文本，强于厂商营销。                              |
| 竞争启示       | 该案例说明“本地/iCloud、快、低摩擦”有真实偏好，但传统 tag/folder 模型本身仍造成概念和操作负担；Yiveno 若能保留极快捕获与可导出，同时把组织退居后台，才有机会吸引此群体                                                                             | 前半为事实 [S16]–[S18]，后半为推断。                                                              |

## Sources（续）

- **[S16]** [Anybox 官方主页](https://anybox.app/)，访问于 2026-08-23。
- **[S17]** [Anybox 官方 FAQ](https://anybox.app/faq)，访问于 2026-08-23。
- **[S18]** [Apple App Store：Anybox - Bookmark & Read Later](https://apps.apple.com/us/app/anybox-bookmark-read-later/id1593408455)，访问于 2026-08-23。

## E-009 — Notion

| 字段             | 已核验信息                                                                                                                                                                                          | 证据与判定                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 定位 / JTBD      | Notion 的基底是用户/团队主动创建的页面和数据库；Web Clipper 把网页放入指定 page/database，供后续阅读、编辑、加标签和建立参考库                                                                      | 官方 Web Clipper 文档 [S19]。其核心不是被动汇聚个人浏览保存，而是 workspace-first 的生产和协作。 |
| 捕获摩擦         | desktop clipper 支持 Chrome/Safari，移动端经系统 Share Sheet；用户必须选择 workspace/page/database，网页入库时 URL 属性自动添加，标签等属性要在保存后编辑                                           | [S19]。该工作流更有意图/结构，但捕获摩擦高于一键“收进个人记忆”。                                 |
| AI / 搜索        | Notion AI Enterprise Search 搜索工作区、Slack、Google Drive、Jira 等已连接应用与 web，并给连接内容的答案提供来源引用；可限制搜索范围；文档显示其使用 GPT-5、Claude 等 LLM，且可选 GPT/Claude/Gemini | [S20] [S21]。这是强大的 B2B/工作区检索竞争者，而非默认个人互联网 archive。                       |
| Agent / MCP 信号 | 官方 AI 文档描述 Agent 可使用工作区与连接应用上下文创建/编辑页面与数据库，且 Enterprise Search 页面提示 Notion MCP 可连接 Claude、ChatGPT、Cursor 等                                                | [S20] [S21]。其在“用户已放入工作区的数据→Agent”层面对 Yiveno 构成上游/替代威胁。                 |
| 商业化           | Free 对个人可用；Plus $10/成员/月；Business $20/成员/月，Enterprise Search、Agent、AI Meeting Notes 位于 Business/Enterprise 或限量试用/credits 体系                                                | 官方定价与 AI FAQ [S21] [S22]。Yiveno 不应在早期与其通用知识工作区或企业连接器全面正面竞争。     |
| 数据与 AI 边界   | 官方称 Notion AI 默认不以用户数据训练模型（除非 opt-in），但为提供功能，信息会共享给 AI subprocessors；Enterprise 另有零 LLM 数据留存选项                                                           | 官方定价 / AI 文档 [S21] [S22]。不等同于 local-first 或端到端加密。                              |
| 竞争启示         | 对个人用户，Notion 的空档在“自动从浏览过程捕获、低摩擦识别关系和记忆式召回”；但对已高度投入 Notion 的用户，Yiveno 应优先成为捕获与检索前端，并提供无损写入/引用/导出，而非再建一套文档系统          | 基于 [S19]–[S22] 的推断。                                                                        |

## Sources（续）

- **[S19]** [Notion Help：Web Clipper](https://www.notion.com/help/web-clipper)，访问于 2026-08-23。
- **[S20]** [Notion Help：Enterprise Search](https://www.notion.com/help/enterprise-search)，访问于 2026-08-23。
- **[S21]** [Notion Help：What is Notion AI?](https://www.notion.com/help/notion-ai-faqs)，访问于 2026-08-23。
- **[S22]** [Notion 官方定价](https://www.notion.com/pricing)，访问于 2026-08-23。

## E-010 — Obsidian

| 字段        | 已核验信息                                                                                                                                                                                | 证据与判定                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 定位 / JTBD | 当用户希望自己的思考和知识长期以本地、开放文件保存，并主动建立链接、知识图谱和定制工作流时，Obsidian 提供私有的 Markdown vault                                                            | 官网 [S23]。它是 personal knowledge base，不是开箱即用的互联网保存汇聚器。           |
| 数据与隐私  | 笔记本地存储为普通 Markdown；无账户可用、无 telemetry、公司称不出售数据；如选用 Obsidian Sync，服务使用 AES-256 E2E 加密                                                                  | 官网 / Sync 页面 [S23] [S24] [S25]。这是 Yiveno 在“用户拥有数据”维度最强的替代标杆。 |
| 组织和检索  | 手动/半手动链接、tag、graph、Canvas；开放 API 和数千插件，适合把个人知识系统高度定制化                                                                                                    | [S23]。其强项是深度知识结构，不是低认知负荷自动召回。                                |
| Web capture | 官方 Web Clipper 可在 Chrome/Chromium、Firefox、Safari、Edge 上突出并捕获网页，保存为可离线使用、长期保存的 Markdown；GitHub 页面展示 5,065 Stars、693 Forks、1,033 commits（访问时快照） | 官方 GitHub 仓库 [S26]。捕获后仍需要用户定义 vault / template / 管理逻辑。           |
| Agent / MCP | Obsidian 官方有开放 API 与社区丰富的 REST/MCP 插件生态，但未在上述官方核心资料中确认“官方托管 MCP 服务”                                                                                   | 官网 [S23]；因此报告只将“社区可接入 Agent”视为事实，不把它写成官方产品承诺。         |
| 商业化      | core app 免费无功能限制；Sync 年付 $4/月（Standard）或 $8/月（Plus）；Publish $8/月；可选 Catalyst/商业支持                                                                               | 官网定价 / Sync [S24] [S25]。其独立、可选订阅模式塑造了低价格与数据主权预期。        |
| 竞争启示    | Yiveno 不应试图成为“又一个可定制 Markdown 笔记工具”。更可行的是：以自动捕获、混合召回和低门槛 Agent context 为前端，同时用透明导出/本地缓存或 Obsidian 写入路线化解锁定担忧               | 基于 [S23]–[S26] 的推断。                                                            |

## Sources（续）

- **[S23]** [Obsidian 官方主页](https://obsidian.md/)，访问于 2026-08-23。
- **[S24]** [Obsidian Sync 官方页面](https://obsidian.md/sync)，访问于 2026-08-23。
- **[S25]** [Obsidian 官方定价](https://obsidian.md/pricing)，访问于 2026-08-23。
- **[S26]** [obsidianmd/obsidian-clipper GitHub 仓库](https://github.com/obsidianmd/obsidian-clipper)，访问于 2026-08-23。

## E-011 — Mem

| 字段             | 已核验信息                                                                                                                                                                                                 | 证据与判定                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 定位演化         | 当前官网定位为 AI chief of staff：Workspace 保存持久可见记忆，Agent 在后台持续理解任务、项目与目标并在适当时机介入                                                                                         | 官网 [S27]。其竞争重心已从“AI note-taking”扩展到个人上下文+主动 Agent。                                      |
| 捕获与检索       | 允许录入笔记、会议、想法、研究、语音与网页剪藏；Mem Agent 使用每次捕获和 connected apps 更新图景；可以按“你记得的细节/意义”检索 notes、meetings、connected sources                                         | 官网 [S27]。这是与 Yiveno 假设最相近的“context-aware recall”叙事。                                           |
| AI 的实质位置    | Agent 持续审阅新上下文、维护人/项目/决策/优先级关系，可据此回答、起草、总结、规划和主动提醒                                                                                                                | 官方主页/价格页 [S27] [S28]。产品价值来自记忆的持续维护和行动建议，而非仅生成总结。具体模型/索引架构未公开。 |
| Agent / 外部集成 | Pro 包含 connected email 和 API；Proactive 提供 Slack、iMessage、WhatsApp 中的 Agent；首页宣传 Claude Connector 与外部 LLM 使用 second brain context                                                       | 官方页/价格页 [S27] [S28]。此处需后续在单独官方连接文档中验证具体连接器范围与权限。                          |
| 定价             | Free：每月 25 notes、25 Agent messages、25 PDF pages；Pro $12/月；Proactive 7 天试用后 $99/月，含主动提醒、无限消息/notes 等                                                                               | 官方价格页 [S28]。$99 不是信息存储价格，而是极强“主动个人助手”价值主张的验证性高价测试。                     |
| 数据与可携带性   | AES-256 静态加密、TLS 传输；官方明确 **非 E2E**，因需在 Mem 上提供 intelligence；称不售卖/广告挖掘数据；一键将 notes/collections 导出为 Markdown                                                           | [S28]。                                                                                                      |
| 战略启示         | Mem 证明“无需组织+语义找回+上下文驱动行动”可以形成独立品类，但也说明从保存层直接跳到主动 Agent 会显著拉高成本、信任与 UX 风险。Yiveno 应先把召回正确性、来源可追溯和授权边界做成可信基础设施，再验证主动性 | 前半事实 [S27] [S28]，后半为推断。                                                                           |

## Sources（续）

- **[S27]** [Mem 官方主页](https://get.mem.ai/)，访问于 2026-08-23。
- **[S28]** [Mem 官方定价与 FAQ](https://get.mem.ai/pricing)，访问于 2026-08-23。

## E-012 — 平台型 AI Memory 与连接器（ChatGPT、Claude、Gemini）

| 平台    | 已核验能力                                                                                                                                                                                                                                                                                                        | 对 Yiveno 的竞争含义                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatGPT | 启用 Memory 后，ChatGPT 可从 chats、files 和 connected apps 自动记住有用上下文；Memory Summary 自动更新、可编辑，回答下显示来源；彻底删除需要处理 chat、files、memory summary 与已连接 apps 等所有来源；可关闭或用 Temporary Chat。Apps/Plugins 能检索、引用、同步外部数据，有的可写入；支持基于 MCP 的自定义 app | 它正在成为用户交互入口和通用上下文层。但其记忆由平台控制，完整清除复杂，连接数据的可见性/训练处理取决于设置与 app 政策。Yiveno 的机会是成为模型无关、可导出且面向“已保存互联网资料”的高质量 retrieval source，而不是复刻聊天记忆。 |
| Claude  | Paid plans 可通过 RAG 搜索历史聊天；新 Memory 使用分组条目并实时读写更新，项目有独立 memory；可关闭 search、暂停或重置 memory，支持查看/编辑和回链引用；支持 memory import/export（实验性）                                                                                                                       | Claude 的用户级记忆会替代部分“我之前说过什么”需求，却不等同于保存的网页、社交收藏和跨平台互联网 archive。项目边界也说明用户需要域/任务分隔与可控上下文。                                                                           |
| Gemini  | Personal Intelligence（beta/地域限制）可连接 Gmail、Photos、Search、YouTube 与聊天历史/偏好，跨 Web/Android/iOS 给出个性化建议；用户可选择应用并管理设置，官方称会尽量解释所用来源                                                                                                                                | Google 具有最强的自有个人数据分发与浏览/搜索入口。Yiveno 无法在 Google-owned data 上正面取胜，应提供非 Google 来源的统一索引，以及跨模型、跨浏览器的用户授权数据层。                                                               |

**证据与边界。** ChatGPT 与 Claude 是平台一手文档；Gemini 为官方产品页。上述“竞争含义”均为分析推断。ChatGPT 的 Apps 文档还说明，个人账户若开启“Improve the model for everyone”，从 apps 访问的数据可能用于训练；Business/Enterprise/Edu 默认不用于训练。具体可用性受订阅、地区、工作区政策及连接器支持影响。

## Sources（续）

- **[S29]** [OpenAI Help：Memory FAQ](https://help.openai.com/articles/8590148-memory-faq)，访问于 2026-08-23。
- **[S30]** [OpenAI Help：Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt)，访问于 2026-08-23。
- **[S31]** [Claude Help：Use Claude’s chat search and memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context)，访问于 2026-08-23。
- **[S32]** [Gemini 官方：Personal Intelligence](https://gemini.google/overview/personal-intelligence/)，访问于 2026-08-23。

## E-013 — 浏览器正在把 History、Search 与 Memory 融合

| 产品   | 已核验能力                                                                                                                                                                                                                                  | 对 Yiveno 的影响                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chrome | AI History Search 允许用日常语言在浏览历史中找网页，即使不记得关键词/域名。启用后，Chrome 在本地保存启用后访问页面的 title、URL 与正文，并加密至设备；仅限美国/英文、可关闭，结果最多显示 3 个最佳匹配                                      | 这是对“我看过但不记得名字”的直接原生替代，且 local-first。但它仅覆盖启用后、单浏览器历史，地理/语言受限，也未覆盖用户主动保存、跨平台社交收藏、关系建模和跨 Agent 授权。 |
| Dia    | 官方称可基于 GSuite、Slack、tabs 等完整上下文回答问题，生成 Morning Brief/报告，管理 profiles、organised tabs 和会记住的布局；用户可控制 memory、连接的工具、是否个性化；Sync 称 E2E 加密；当前 macOS 14+ M1+，并显示 waitlist/14-day trial | Dia 是“浏览器即工作上下文层”的信号。Yiveno 的威胁在于其数据入口与任务场景强耦合；机会在于作为可跨浏览器、可导出、可迁移的个人 archive/retrieval layer。                  |

**分析结论。** 浏览器不会让 Yiveno 自动失去价值，但会吞噬“单浏览器、单设备、仅浏览历史语义搜索”这一层。Yiveno 的战略边界应上移至：**保存意图 + 跨来源连接器 + 内容/时间/行为上下文 + 可信来源回链 + 模型中立的 MCP/API**。这是基于一手功能范围的推断，而不是对各浏览器产品路线的事实预测。

## Sources（续）

- **[S33]** [Google Chrome Help：Search your browsing history in Chrome with AI](https://support.google.com/chrome/answer/15305774?hl=en)，访问于 2026-08-23。
- **[S34]** [Dia Browser 官方主页](https://www.diabrowser.com/)，访问于 2026-08-23。

## E-014 — Perplexity Comet

| 字段                   | 已核验信息                                                                                                                                                                                                                   | 证据与判定                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 定位 / 平台            | Perplexity 将 Comet 定位为个人 AI assistant/browser，可在 Mac、Windows、iOS、Android 使用，官方示例包括理解网页、建站、写邮件、创建学习计划、购物与把 inbox/行程等任务交给 Assistant                                         | 官方 Comet 页面 [S35]。                                                               |
| 浏览器中的上下文与行动 | 官方隐私文章称 Comet Assistant 可就当前 tab 提问、搜索 web、与网站智能交互；为代办操作会使用 browsing history 上下文；用户可按网站阻止其执行任务、关闭 Assistant/历史访问                                                    | 官方隐私文章 [S36]。这对“浏览器中的个人信息 retrieval + Agent”构成直接平台级威胁。    |
| 隐私架构               | 官方称设备与 Perplexity 服务器之间是 hybrid compute；尽量保留数据在本地，凭据/密码/信用卡信息在设备本地；但用户提问时当前 tab 与相关历史可能被传至 Perplexity；标记为 personal 的 queries 自动在 30 天删除，且用户可删除数据 | [S36]。这不是端到端本地知识库；浏览数据外发和权限控制的感知负担是可利用的差异化窗口。 |
| 战略启示               | Comet 会把“研究/浏览→提问→行动”闭合在浏览器内。Yiveno 不能只承诺“网页 AI 搜索”，需要强调跨浏览器、跨社交/内容服务、长期可携带 archive，以及以最小化数据外发为核心的按用途/按 Agent 授权                                      | 基于 [S35] [S36] 的推断。                                                             |

## Sources（续）

- **[S35]** [Perplexity Comet 官方产品页](https://www.perplexity.ai/comet)，访问于 2026-08-23。
- **[S36]** [Perplexity：Introducing Privacy Snapshot](https://www.perplexity.ai/hub/blog/introducing-privacy-snapshot)，2025-10-31 发布，访问于 2026-08-23。

## E-015 — Raindrop.io 原始用户反馈（App Store）

| 信号                 | 具体证据                                                                                                                                                    | 解读                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 评分和规模           | 美国 App Store 页面显示 4.5/5、412 ratings（访问日快照）                                                                                                    | 属于公开移动端评价样本，不代表全部活跃用户。                                                                                                          |
| 用户愿付费的理由     | 一名长期用户称 folder+tag、搜索优于 Pocket，并愿为质量付费；另一名用户强调跨设备同步、从 app 内浏览器直接保存、频繁更新，考虑升级以支持开发者和解锁高级功能 | 付费并非只为收藏，而为“跨端无摩擦捕获 + 快速再找到 + 可靠维护”。                                                                                      |
| 用户喜爱的新 AI 价值 | 近期用户称 AI assistant 可在自己问到某个数据来源时“needle in a haystack”式找回对应收藏文章；同时肯定 highlights/notes 跨端同步和自动备份                    | 这验证了**可引用来源的细粒度 recall**比普通 AI 摘要更接近高价值。                                                                                     |
| 未满足与流失风险     | 用户抱怨缺少 offline support、highlight 上限和偶发丢失、阅读位置无法恢复、文内加载失败；另有 Pro 用户因 collections 分组 bug/支持响应而给出强烈负评         | 即便是成熟产品，可靠性、离线性、保存件的持久可读性与客服会直接影响续费。Yiveno 在早期应优先把完整性、可恢复性与故障可见性做对，而非扩张低频 AI 功能。 |

## Sources（续）

- **[S37]** [Apple App Store：Raindrop.io](https://apps.apple.com/us/app/raindrop-io/id1021913807)，访问于 2026-08-23。

## E-016 — mymind 与 Readwise Reader 原始用户信号（App Store）

| 产品            |       公开评分快照 | 用户认可的真实价值                                                                                                                                                                         | 已观察到的限制 / 解释边界                                                                                                                                                                                  |
| --------------- | -----------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mymind          | 4.0/5，407 ratings | 用户称自动 tagging 在有足够内容后善于识别搜索中的模式/关联；另有用户将价值描述为把混乱的思绪转为可用的 spaces，降低“同时打开所有心理标签页”的负担                                          | App Store 页面当前抽取的可见文字主要为正面评价与更新说明，不能据此推断无重大缺陷或普遍满意。4.0 分相对头部竞品也提示价值与价格/可靠性并非毫无争议。                                                        |
| Readwise Reader | 4.6/5，572 ratings | 官方应用页转述的用户迁移/认可集中在：从 Pocket/Instapaper 升级至 serious-reader workflow；把多来源阅读集中；highlight→笔记系统→Daily Review 的再利用。可观察的评分表明移动端有一定用户验证 | 当前 App Store 抽取以产品描述及精选引语为主，属于公司选择展示的文本，不能当作独立用户调研。此前的价格页和 Reddit 检索结果已显示其 $119.88/年价格是常见付费门槛讨论点，仍需以产品机制而非营销文本解释留存。 |

## Sources（续）

- **[S38]** [Apple App Store：mymind – Extend your mind](https://apps.apple.com/us/app/mymind-extend-your-mind/id1520332347)，访问于 2026-08-23。
- **[S39]** [Apple App Store：Readwise Reader](https://apps.apple.com/us/app/readwise-reader/id1567599761)，访问于 2026-08-23。

## E-017 — Recall、Fabric、Capacities：AI 知识与个人上下文扩展竞品

| 产品       | 已核验定位与能力                                                                                                                                                                                                                                                                                               | 与 Yiveno 的关系                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recall     | 个人 AI knowledge base，官方称 700,000+ professionals；可一键保存视频、podcast、PDF、文章、TikTok、notes 等，自动 summary、smart tags、知识图谱关系、跨模型（ChatGPT/Claude/Gemini）聊天、间隔重复 quiz；支持 browser extensions 和移动端，Markdown 全量导出；“augmented browsing local first”，知识库云端保存 | **直接竞争者**。它已经把“保存→自动处理→关系→提问→记住”的闭环产品化。Yiveno 不应仅竞逐内容 summarization、auto tags 或 knowledge graph 可视化，而要聚焦其不能天然提供的跨平台社交收藏、行为/时间上下文、检索可信度与 Agent 数据服务。           |
| Fabric     | AI workspace，官方称 4.7、3K+ app ratings；主张 50+ integrations，跨文件/笔记/会议和 Google Drive、Figma、Notion、Dropbox 等进行语义、文档内、颜色/视觉、视频/音频搜索；提出 Memory Engine、个人云、可创建带 schedule 的 Agents、AI inbox/网页笔记与 MCP 线索；传输 SSL、静态 AES-256                          | **最强的“all personal information + agent”理想形态竞争者之一**，但产品范围极宽（工作区、写作、协作、项目管理、Agent），对个人开发者而言是避免复制的范围陷阱。Yiveno 可做更窄的 web-originated retrieval layer，并向 Fabric/AI 平台输出上下文。 |
| Capacities | 面向个人思考者的 connected-object PKM，官网称 50,000+ knowledge workers；以对象、属性、主动/自动发现 related content、daily notes 取代深层目录；支持网页链接保存为对象，强调欧洲托管、加密、全量导出                                                                                                           | **间接竞争者**。它在人工/半人工的结构化知识网络上强，在网页内容完整抓取、跨社交保存、浏览历史和 Agent 接口上不是其页面的主要承诺。它验证了“files/folders 不合人脑”但不验证全自动 personal information graph 的需求。                           |

**证据级别说明。** 用户数、评分、连接器数量为公司页面陈述或页面快照，未获独立审计，不作为市场规模计算的硬输入；能力范围采用公开产品页面。表中的竞争结论是推断。

## Sources（续）

- **[S40]** [Recall 官方主页](https://www.getrecall.ai/)，访问于 2026-08-23。
- **[S41]** [Fabric 官方主页](https://fabric.so/)，访问于 2026-08-23。
- **[S42]** [Capacities 官方主页](https://capacities.io/)，访问于 2026-08-23。

## E-018 — 市场规模：只作为相邻市场上限与趋势代理

| 口径                               |                                                                                               数值与时间 | 适用性与限制                                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全球 Knowledge Management Software | Grand View Research 页面称：2024 年 $20.1B，2026 年估计 $25.0B，2033 年预测 $62.2B，2025–2033 CAGR 13.6% | 报告范围明确涵盖 software + services、部署、功能、组织规模、终端行业和区域，主要讨论企业的 discovery/collaboration/decision-making。**不能**当作 Yiveno 的 TAM；仅说明相邻信息发现/语义检索/AI assistant 支出池体量大且增长。 |
| 个人信息检索 / AI memory           |                                                                     无可审计且定义一致的公开独立市场口径 | 不使用“AI memory market”营销数字，因为经常与半导体 memory 或泛 AI 市场混淆。Yiveno 需采用用户数×价格的自下而上定价敏感度场景，而非从企业 KM 报告剪切比例。                                                                    |

## Sources（续）

- **[S43]** [Grand View Research：Knowledge Management Software Market Report, 2025–2033](https://www.grandviewresearch.com/industry-analysis/knowledge-management-software-market-report)，页面标示 2025-08 发布，访问于 2026-08-23。

## E-019 — Trove Now / 旧版 Blockstack 去中心化书签 DApp（与其他 Trove 分离）

| 字段            | 已核验信息                                                                                                                                                    | 状态判断                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 产品与发布时间  | Medium 文章宣布 `Trove` 上线；搜索索引日期为 2019-06-27，文章正文称刚推出第一个版本                                                                           | 历史产品，不与 `usetrove.app` 或 Studio Starum Chrome 扩展混同。 |
| 核心定位        | 隐私优先的安全书签应用，基于 Blockstack 和 Gaia storage；默认加密，用户持有密钥，产品声称无法读取用户存储                                                     | 原文产品公告 [S44]。                                             |
| 初始能力        | Web app / browser extensions 保存内容，以 collections 和 tags 组织；当时计划增加图片、视频、code snippets、text、智能分类、read mode、移动端与导入            | [S44]。已实现与“计划”明确分开。                                  |
| 融资 / 增长线索 | 公告称参与 Blockstack App Mining program，期望通过支持获得项目资金；未发现可核验的 VC 融资、用户量、持续活跃的产品站点或当前商店分发                          | [S44] 与后续检索。不能把 App Mining 等同于传统股权融资。         |
| 当前状态        | 本研究未检索到更新的官方发布、有效产品页面、活跃应用商店页面或近期用户证据，因此标为 **“当前状态无法验证，可能已失活”**，而非断言已关闭                       | 谨慎推断；Medium 验证受验证码限制，但已抽取正文。                |
| 失败/启示       | DApp + 加密 + folder/tag 的隐私路线并不等同于持久产品牵引；对 Yiveno 的启示是 privacy/export 可以是信任底座，却不能替代快速捕获、召回质量和日常复用的核心循环 | 前半为公开历史事实 [S44]，后半是分析推断。                       |

## Sources（续）

- **[S44]** [Trove Now Medium 公告：Trove: A decentralized app to organize your bookmarks](https://medium.com/@trovenow/trove-a-decentralized-app-to-organize-your-bookmarks-460e57572f69)，2019 年发布（搜索索引），访问于 2026-08-23；页面对浏览器访问触发验证码，正文由页面抽取获得。
