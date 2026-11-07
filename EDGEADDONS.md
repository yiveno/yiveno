# Microsoft Edge Add-ons Listing — Yiveno

> Last Updated: 2026-10-30

<!-- 开发者向：Edge 上架草稿本，与 extension/public/manifest.json + CHROMEWEBSTORE.md 同步维护。商店用户向文案仅美式英语。双店同包见 ADR-020。 -->

## Store Listing

**Extension Name** [REQUIRED]

Yiveno

**Short Description** [REQUIRED]

Save what matters. Recall it later.

**Detailed Description** [REQUIRED]

Yiveno helps you find what you already saved on the web — highlights, snippets, and bookmarks you captured with a light touch.

Capture while you browse: select text and save it in one step, or pull in bookmarks when you want them in your library. Add a short note if it helps future-you remember why it mattered.

When you only remember a fragment — a phrase, a site name, a rough topic — open Recall in the side panel and describe what you're looking for in your own words. Yiveno surfaces a short neighborhood of closest matches from your library. You pick the right one; nothing claims to be the only answer.

You can also type `yi` in the address bar for a quick jump when you remember a keyword, open your full Library to browse what you saved, and adjust settings when you want cloud sync or account features.

Your saves stay on this device by default. Cloud sync and sign-in are optional and off until you turn them on. Yiveno does not read your full browsing history or upload pages you never chose to save.

Works in Microsoft Edge (Chromium). The same product is also prepared for the Chrome Web Store where available.

Questions or feedback: support@yiveno.com · Privacy: https://yiveno.com/privacy

**Category** [REQUIRED]

Productivity / Tools

**Primary Language** [REQUIRED]

English

**Additional locales (extension package):** `_locales/en` + `_locales/zh_CN`.

## Graphics & Assets

Edge Add-ons requires at least a **logo** and **small promotional tile**. Reuse CWS-ready assets unless Edge-specific crop is needed.

| Asset                  | Dimensions          | Status          | Source                                                                               |
| ---------------------- | ------------------- | --------------- | ------------------------------------------------------------------------------------ |
| Store Icon / Logo      | 128×128 PNG         | Ready           | `extension/public/images/icon128.png`                                                |
| Small Promo Tile       | 440×280             | Ready (interim) | `docs/design/brand-assets/chrome-web-store/chrome-web-store-small-promo-440x280.png` |
| Screenshot 1           | 1280×800 or 640×400 | Ready (interim) | `docs/design/brand-assets/chrome-web-store/screenshot-01-brand-focus-1280x800.png`   |
| Screenshot 2           | 1280×800 or 640×400 | Ready (interim) | `docs/design/brand-assets/chrome-web-store/screenshot-02-brand-connect-1280x800.png` |
| Product UI screenshots | same                | Pending         | Recall Side Panel / Capture / Library — see `CHROMEWEBSTORE.md` Screenshot Notes     |

**双店共用：** 母本目录 `docs/design/brand-assets/chrome-web-store/`（不进扩展包）；Edge 提交可直接上传同批图，无需第二套品牌方向。

## Permissions Justification

与 [`CHROMEWEBSTORE.md`](./CHROMEWEBSTORE.md) **同一表**（同包）。书签权限文案对审核说明：optional import of the user’s **browser bookmarks** when they explicitly start import — not silent scanning.

`externally_connectable` 生产域：`yiveno.com`、`www.yiveno.com`、`yiveno.cn`、`www.yiveno.cn`（大陆官网登录 handoff）。

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

https://yiveno.com/privacy

（`.cn` 同站内容亦可：https://yiveno.cn/privacy）

## Distribution

**Visibility**: **Not submitted** (as of 2026-10-30). No public Edge Add-ons listing yet.

**Partner Center 账号（运维 · 非商店表单字段）：**

| 项                       | 值                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSA 登录邮箱**         | `admin@yiveno.com`                                                                                                                                                                                                                                   |
| **账号状态**             | **Microsoft Edge 程序已报名**（2026-10-30）：Publisher=`Yiveno` · Individual · China · MSA=`admin@yiveno.com`；仪表盘已可见 `Create new extension`；**账号核验未完成**（需按邮件/Account Settings 完成 verification 后方可上架）；尚未首次提交扩展包 |
| **Primary Owner 硬约束** | 必须是 **个人 MSA**。自定义域邮箱可以，但须按个人账号注册（account.microsoft.com）。**仅** Azure AD / 工作或学校账号 **不能** 作 Primary Owner——若登录后提示无法作为个人开发者，需改用/关联合格 MSA。                                                |

**Partner Center（首次提交步骤）：**

> **说明：** 官网/Partner Center **没有**单独叫「Microsoft Edge 开发者计划」的产品页可搜。正确叫法是在 Partner Center 里 **enroll into the Microsoft Edge program**（卡片上常写 **Microsoft Edge** / **Get started**）。权威步骤：[Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)。

1. **报名（二选一）**
   - **直达（优先）：** 用 MSA 打开  
     [partner.microsoft.com/.../enrollnow/msedgeaddons](https://partner.microsoft.com/en-us/dashboard/account/exp/enrollnow/msedgeaddons)  
     （Edge 扩展团队在官方 issue 里给出的报名链；登录后应出现 **Microsoft Edge Developer Account Registration** 表单）
   - **菜单路径：** [Partner Center](https://partner.microsoft.com/) → 右上角 **齿轮 Settings** → **Account settings** → **Programs** → 找到 **Microsoft Edge** 卡片 → **Get started**
2. 表单里选 **Account country/region**（选完不可改）→ **Individual**（Yiveno 尚未注册公司；Company 要法人核验、更慢）→ Publisher display name 填 `Yiveno` → 勾协议 → **Finish**。无扩展上架费。
3. `cd extension && bun run pack:store` → 从**仓库根** `dist/` 打 ZIP，产出 `extension/yiveno-extension-store.zip`（勿指向不存在的 `extension/dist`）。
4. 填本文件 Store Listing 字段 + 隐私 URL + logo / small promo tile（见 Graphics）。
5. 审核通过后，把商店公开 URL 写入 [`website/src/install/store-links.ts`](website/src/install/store-links.ts) 的 `EDGE_ADDONS_LISTING_URL`（官网 Install CTA 自动从 Coming soon 变为可点深链）。

**若看不到 Microsoft Edge / Get started：**

| 现象                                              | 常见原因                                              | 处理                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 只有 Windows / Office / Azure 等程序卡，没有 Edge | 当前登录是 **工作/学校账号**，或尚未进 Edge 报名流    | 先试上面 **直达链接**；仍无 → 换个人 MSA（Outlook/Live/Hotmail，或 GitHub 登录由系统创建 MSA）再试  |
| 登录后进了 CSP / 企业 Partner 工作区              | 账号绑了企业 Partner 身份，Edge 扩展报名入口被盖住    | 无痕窗口 + 仅 MSA 登录；或直达 `enrollnow/msedgeaddons`                                             |
| `admin@yiveno.com` 被当成 Entra 工作账号          | 自定义域常落成工作账号，**不能**作 Edge Primary Owner | 新建个人 MSA（如 `…@outlook.com`）作 Primary Owner；`admin@yiveno.com` 可作联系邮箱，不必当登录主号 |

**Partner Center:** Enroll in the **Microsoft Edge** program with a **Microsoft account (MSA)** as Primary Owner (work/school account alone is not supported). No registration fee for Edge extensions.

**Commercial status:** Same as CWS — not charging the public until explicitly launched.

**Install CTA (product):** After listing, mainland / `.cn` primary CTA → this store deep link. CWS-reachable users may still use Chrome (ADR-020).

## Developer Info

**Publisher Name:** Yiveno

**Partner Center MSA (ops):** admin@yiveno.com — Primary Owner 登录；商店对外联系仍用下方 Contact / Support。

**Contact Email:** privacy@yiveno.com

**Support:** mailto:support@yiveno.com · https://yiveno.com/support

**Homepage:** https://yiveno.com

## Version History

| Version | Date       | Changes                         | Status |
| ------- | ---------- | ------------------------------- | ------ |
| 4.0.0   | 2026-10-28 | Same package as CWS draft 4.0.0 | Draft  |

## Review Notes

- Same MV3 ZIP as Chrome Web Store submission (`bun run --cwd extension build:prod` strips localhost Worker host).
- Do not claim “Chrome-only” in Edge listing copy.
- Local-first library; neighborhood Recall, not oracle single answer.
- Manual ZIP sideload is **not** the mainland primary path (ADR-020).

### Rejection History

| Date | Reason | Fix Applied | Resubmitted |
| ---- | ------ | ----------- | ----------- |
| —    | —      | —           | —           |

## Edge 真机验收（提交前）

清单权威：[`docs/engineering/Edge-真机验收清单.md`](docs/engineering/Edge-真机验收清单.md)。加载路径 = 仓库根 `dist/`（`cd extension && bun run build`）。覆盖：Side Panel、Capture、书签灌库、Recall、Omnibox `yi`、官网桥（含 yiveno.cn）、`edge://extensions/shortcuts`、卸载页。
