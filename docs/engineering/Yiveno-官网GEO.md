---
created: 2026-10-31T21:17:19+0800
updated: 2026-11-02T11:05:53+0800
author: agent:cursor
scope: 官网 Generative Engine Optimization（生成式引擎可引用信号）— 非地区域名 soft-redirect
status: active
upstream:
  - docs/product/Yiveno-产品文档-v4.0.md（§0.1 对外心智）
  - docs/product/Yiveno-可见与契约分面-体验原则.md（§4.2 官网 W1–W6）
  - docs/pricing.md
  - docs/architecture/decisions/ADR-020-chromium-dual-store-edge.md
downstream:
  - website/src/seo/json-ld.ts
  - website/src/layouts/MainLayout.astro
  - website/public/robots.txt
  - website/public/sitemap.xml
  - website/public/llms.txt
  - website/src/pages/faq.astro
---

# Yiveno 官网 GEO（生成式引擎优化）

> **GEO 这里 = Generative Engine Optimization**（提高 ChatGPT / Perplexity / Google AI 等准确引用 Yiveno 的概率）。  
> **不是** `website/src/geo/` 地区域名跳转；也**不是**首页 Boundary 区块的 CSS class `.geo`。

## 1. 目标

| 做                                                                   | 不做                               |
| -------------------------------------------------------------------- | ---------------------------------- |
| 事实与可见文案一致（平台、币种、上架、定价锚点）                     | 关键词堆砌 / 「AI-powered」主卖点  |
| 实体可解析（Organization / WebSite / SoftwareApplication / FAQPage） | 宣称 CWS / Edge 已可公开安装       |
| 公开页可爬（`/`, `/faq`, `/pricing`, support/privacy/terms）         | 宣称 §5.9 Beta 达标                |
| 答案优先短文（FAQ + `llms.txt`）                                     | 神谕式「永远押中那一条」           |
| JSON-LD 与页面正文同源                                               | 伪造 `sameAs`（无 Wikipedia 不编） |

Google 对 `llms.txt` **明确忽略**；仍保留供部分其它 agent。主收益在**诚实可爬正文 + 一致 schema**。

## 2. 已落地信号

| 信号                                                                | 位置                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| 首页 `@graph`：Organization + WebSite + SoftwareApplication         | `website/src/seo/json-ld.ts` → `MainLayout` `jsonLd`  |
| FAQ 可见 Q&A + `FAQPage` JSON-LD                                    | `website/src/pages/faq.astro`（条目 = `FAQ_ENTRIES`） |
| `robots.txt` 允许 `/pricing` `/faq`；Disallow auth/account/checkout | `website/public/robots.txt`                           |
| `sitemap.xml` 含 faq / pricing                                      | `website/public/sitemap.xml`                          |
| `llms.txt` 英文事实短表                                             | `website/public/llms.txt`                             |
| canonical 钉 `https://yiveno.com`（`.cn` 同内容单实体）             | `MainLayout`                                          |
| 页脚链 `/pricing` + `/faq`（顶栏 Pricing 仍藏）                     | `MainLayout` footer                                   |
| OG 图真 JPEG 1200×630（约数十 KB；禁止伪 `.jpg` 的巨型 PNG）        | `website/public/og-image.jpg` · `_headers`            |

**Offer 约定：** Free / Pro 均为 `PreOrder` + `USD`；描述写明商店未上架。**禁止** `InStock` 冒充可装。

## 3. 禁止夸大清单（改文案前自检）

- 商店 URL 仍空时，不得写「Install now」可点深链当主 CTA
- 不得写 EUR 价或「at launch 才有 Free/Pro」而官网已有 `/pricing`
- 不得把 Hybrid / embedding / 模型名当官网主卖点
- 不得暗示未登录 Free 无本机召回；Pro 差异主轴 = 摘录同步等（见定价文档）

## 4. 验收提示

```bash
cd website && bun test src/seo/json-ld.test.ts
# build 后检查 dist 含 robots / sitemap / llms.txt / faq
curl -sS https://yiveno.com/robots.txt   # 部署后：无 Disallow /pricing
curl -sS https://yiveno.com/llms.txt
# 首页 JSON-LD：应含 @graph、USD、Edge；无 EUR
```

**引用率：** 真实 ChatGPT / Perplexity 是否点名引用需上线后人工抽样；本工程交付不保证引用率数字。

## 5. 可见面 vs 契约面（官网）

与扩展同一原则（权威 [`Yiveno-可见与契约分面-体验原则.md`](../product/Yiveno-可见与契约分面-体验原则.md) §4.2）：

| 面       | 官网落点                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------ |
| **可见** | CTA 人读店名；mock 人读标题；FAQ/营销正文不堆长绝对 URL                                                |
| **契约** | `href` / canonical / JSON-LD `url` / sitemap / `llms.txt` **完整**绝对 URL；FAQ 正文与 schema **同源** |

禁止为「好看」把 `llms.txt` 或 schema 里的 canonical 改成缩短串；也禁止 CTA 主文案贴商店深链原文。

## 6. 与地区 geo 的边界

| 主题                   | 路径                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| 生成式引擎 GEO（本文） | `seo/` · `llms.txt` · FAQ                                               |
| 大陆/海外域名 soft 跳  | `website/src/geo/` · `functions/_middleware.ts` · `docs/ENVIRONMENT.md` |
