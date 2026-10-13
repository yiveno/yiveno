# Chrome Web Store Listing — Yiveno

> Last Updated: 2026-09-01

<!-- 开发者向：上架草稿本，与 frontend/public/manifest.json 同步维护。商店用户向文案仅美式英语。 -->

## Store Listing

**Extension Name** [REQUIRED]

Yiveno

<!-- Matches manifest `name` → `__MSG_app_name__` → _locales/en `app_name`. Max 75 characters. -->

**Short Description** [REQUIRED]

Save what matters. Recall it later.

<!-- 43 characters. Matches _locales/en `app_description`. Max 132. -->

**Detailed Description** [REQUIRED]

Yiveno helps you find what you already saved on the web — highlights, snippets, and bookmarks you captured with a light touch.

Capture while you browse: select text and save it in one step, or pull in bookmarks when you want them in your library. Add a short note if it helps future-you remember why it mattered.

When you only remember a fragment — a phrase, a site name, a rough topic — open Recall in the side panel and describe what you're looking for in your own words. Yiveno surfaces a short neighborhood of closest matches from your library. You pick the right one; nothing claims to be the only answer.

You can also type `yi` in the address bar for a quick jump when you remember a keyword, open your full Library to browse what you saved, and adjust settings when you want cloud sync or account features.

Your saves stay on your device by default. Cloud sync and sign-in are optional and off until you turn them on. Yiveno does not read your full browsing history or upload pages you never chose to save.

Questions or feedback: support@yiveno.com · Privacy: https://yiveno.com/privacy

**Category** [REQUIRED]

Productivity

**Single Purpose** [REQUIRED]

Help users capture web excerpts and bookmarks, then recall them later with natural-language clues from their own library.

**Primary Language** [REQUIRED]

English

## Graphics & Assets

| Asset                          | Dimensions          | Status                | Filename                                                                                     |
| ------------------------------ | ------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| Store Icon [REQUIRED]          | 128×128 PNG         | ✅ Verified           | `frontend/public/images/icon128.png` (128×128 PNG, manifest `icons` + `action.default_icon`) |
| Screenshot 1 [REQUIRED]        | 1280×800 or 640×400 | ✅ Ready (interim)    | `docs/design/brand-assets/chrome-web-store/screenshot-01-brand-focus-1280x800.png`           |
| Screenshot 2 [RECOMMENDED]     | 1280×800 or 640×400 | ✅ Ready (interim)    | `docs/design/brand-assets/chrome-web-store/screenshot-02-brand-connect-1280x800.png`         |
| Screenshot 3 [RECOMMENDED]     | 1280×800 or 640×400 | ⬜ Product UI pending | Recall Side Panel — see Screenshot Notes #1                                                  |
| Screenshot 4                   | 1280×800 or 640×400 | ⬜ Product UI pending | Capture — see Screenshot Notes #2                                                            |
| Screenshot 5                   | 1280×800 or 640×400 | ⬜ Product UI pending | Library — see Screenshot Notes #3                                                            |
| Small Promo Tile [RECOMMENDED] | 440×280             | ✅ Verified           | `docs/design/brand-assets/chrome-web-store/chrome-web-store-small-promo-440x280.png`         |
| Marquee Promo Tile             | 1400×560            | ✅ Verified           | `docs/design/brand-assets/chrome-web-store/chrome-web-store-marquee-1400x560.png`            |

**母本目录：** `docs/design/brand-assets/chrome-web-store/`（不进扩展包；契约见 `extension-cws-graphics-contract.ts`）。  
**Interim：** Screenshot 1–2 当前为品牌 hero（自 `docs/design/brand-assets` 整理）；公开发布前建议替换为真实产品 UI（见该目录 `README.md`）。

### Screenshot Notes

1. **Recall (Side Panel)** — User enters a vague clue; neighborhood of saved items with titles, snippets, and open actions. Show Alt+Shift+Y entry if helpful.
2. **Capture** — Selection on a page with “Save to Yiveno” (toolbar or context menu); optional note field.
3. **Library** — Browsable list/tree of saved items with favicons and saved dates.
4. **Omnibox quick jump** — Address bar `yi` keyword with a matching suggestion (optional).
5. **Settings** — Privacy/sync toggles; emphasize local-first and opt-in cloud (optional).

## Permissions Justification

<!-- 审核会逐项核对。改 manifest 须同批更新本表。 -->

| Permission                 | Type             | Justification                                                                                                                                                                                                   |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                  | permissions      | Saves extension settings, onboarding state, optional auth session handles, sync preferences, and local recall telemetry on the user’s profile. Required for the extension to remember choices between sessions. |
| `alarms`                   | permissions      | Schedules optional background cloud memory sync when the user enables sync. No alarm runs when sync is off.                                                                                                     |
| `activeTab`                | permissions      | When the user saves from the current page (keyboard shortcut or toolbar), reads the active tab’s URL and title only for that user-initiated Capture. No background tab scanning.                                |
| `bookmarks`                | permissions      | Optional import and sync of the user’s Chrome bookmarks into the Yiveno library when they explicitly start import from Settings or onboarding. Not used to browse bookmarks silently.                           |
| `contextMenus`             | permissions      | Adds “Save to Yiveno” on selected text so users can Capture a highlight without opening the side panel first.                                                                                                   |
| `scripting`                | permissions      | Injects a small, user-triggered script on the active tab to read the current text selection and show the in-page save toolbar. Runs only on user action, not on every page load in the background.              |
| `tabs`                     | permissions      | Opens Library and Settings pages, focuses existing Yiveno tabs, and navigates to a saved item’s source URL when the user chooses Open from a recall result.                                                     |
| `sidePanel`                | permissions      | Hosts the main Recall experience where users submit clues and review matched items from their library.                                                                                                          |
| `favicon`                  | permissions      | Shows recognizable site icons next to saved items in the Library using Chrome’s built-in favicon service (`/_favicon/`), so users can scan results faster.                                                      |
| `https://*.supabase.co/*`  | host_permissions | Connects to Supabase only when the user signs in or enables optional cloud memory sync (auth tokens and encrypted sync payloads). Not contacted for anonymous/local-only use.                                   |
| `https://api.yiveno.com/*` | host_permissions | Calls Yiveno’s backend for optional features the user invokes: clue understanding, embeddings, sync API, quota checks, and MCP beta endpoints. No full-library upload by default.                               |
| `http://localhost:8787/*`  | host_permissions | **Development only:** local Cloudflare Worker API during unpacked/dev builds. Remove or exclude from the store submission package if reviewers require production-only host permissions.                        |

### Content scripts (manifest, not a permission row)

| Declaration                                                   | Justification                                                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-selection-toolbar.js` on `http://*/*`, `https://*/*` | Renders the on-page save toolbar after the user selects text or uses a save shortcut. Does not run continuous page monitoring; only activates for Capture UX the user requested. |

### Other manifest capabilities

| Capability                                                   | Justification                                                                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `omnibox` keyword `yi`                                       | Lets users type a remembered keyword in the address bar for quick jump suggestions from their saved library, without opening the side panel.                                                                 |
| `externally_connectable` (yiveno.com, localhost website dev) | Allows the Yiveno website sign-in flow to hand auth back to the extension after the user completes OAuth in a browser tab. Dev builds also allow `localhost:3001` / `localhost:3002` for the marketing site. |
| `options_ui` → Settings                                      | Full-page settings for privacy, sync, imports, and account data controls.                                                                                                                                    |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type                    | Collected?           | Transmitted Off-Device?                 | Purpose                                                                                                                                                                                                                                                                     | Shared with Third Parties?                                  |
| ---------------------------- | -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Personally identifiable info | Yes (if sign-in)     | Yes, when signed in                     | Account id, email, display name/avatar from OAuth provider                                                                                                                                                                                                                  | No (processed via auth provider + our backend)              |
| Health info                  | No                   | No                                      | —                                                                                                                                                                                                                                                                           | No                                                          |
| Financial info               | No                   | No                                      | —                                                                                                                                                                                                                                                                           | No                                                          |
| Authentication info          | Yes (if sign-in)     | Yes, when signed in                     | Session tokens for account and optional cloud sync; `setUninstallURL` always opens the uninstall feedback page; when signed in, a one-time revoke token is attached so removing the extension can clear the remote extension session (website login and memories unchanged) | No                                                          |
| Personal communications      | No                   | No                                      | —                                                                                                                                                                                                                                                                           | No                                                          |
| Location                     | No                   | No                                      | —                                                                                                                                                                                                                                                                           | No                                                          |
| Web history                  | No (full history)    | No                                      | Yiveno does not collect or upload full browsing history                                                                                                                                                                                                                     | No                                                          |
| User activity                | Yes                  | Local by default; cloud only if sync on | Recall interactions (e.g. opens, dismissals) to improve ordering on the user’s library                                                                                                                                                                                      | No                                                          |
| Website content              | Yes (user-initiated) | Local by default; cloud only if sync on | Text excerpts, page title/URL, and notes the user explicitly Captures                                                                                                                                                                                                       | No (stored in user’s library; cloud bucket if sync enabled) |

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

### AI / clue understanding (disclosure note)

When the user submits a Recall clue, limited text may be sent to Yiveno’s API (`api.yiveno.com`) for natural-language understanding. The model is not the system of record for library CRUD; memories remain in IndexedDB (and optional cloud sync). See privacy policy §2.4.

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

https://yiveno.com/privacy

## Distribution

**Visibility**: Unlisted (initial beta) / Public (when ready)

**Regions**: All regions (unless product/legal restricts later)

## Developer Info

**Publisher Name** [REQUIRED]

Yiveno

**Contact Email** [REQUIRED]

privacy@yiveno.com

**Support URL / Email** [RECOMMENDED]

mailto:support@yiveno.com · https://yiveno.com/support

**Homepage URL** [RECOMMENDED]

https://yiveno.com

## Version History

| Version | Date       | Changes                                                                            | Status |
| ------- | ---------- | ---------------------------------------------------------------------------------- | ------ |
| 4.0.0   | 2026-08-30 | Side Panel Recall shell, Library, Capture, optional cloud sync, omnibox quick jump | Draft  |

## Review Notes

### Known Issues / Limitations

- **Local-first:** Memories stay in IndexedDB until the user enables cloud sync.
- **Not a bookmark manager primary pitch:** Bookmark import is optional; core value is Capture + Recall from personal traces.
- **Recall delivers a neighborhood, not a single oracle answer:** Store copy must not promise “always picks the right one.”
- **`localhost:8787` host permission:** Present in dev `public/manifest.json` only. **`bun run build:fe:prod`** (`NODE_ENV=production`) strips it from `dist/manifest.json` via `clean-dist` before store upload.
- **Store screenshots / promo tiles:** Not yet produced (see Graphics table).
- **MCP beta:** Read-only MCP exists; not marketed as a primary user feature in the listing.

### Rejection History

| Date | Reason | Fix Applied | Resubmitted |
| ---- | ------ | ----------- | ----------- |
| —    | —      | —           | —           |
