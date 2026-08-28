---
name: Yiveno
description: Quiet personal memory — find what you saved.
colors:
  ink: '#192420'
  ink-mid: '#1e2c26'
  paper: '#f0f3ee'
  paper-dim: '#e8ece5'
  charcoal: '#222c24'
  muted: '#586860'
  border: '#ced8cb'
  sage: '#4b6054'
  sage-dark: '#3a4e44'
  sage-muted: '#82998c'
  sage-faint: '#c6d6ca'
  sage-on: '#d8ede2'
  hero-fg: '#dce8de'
  hero-muted: 'color-mix(in srgb, sage-on 55%, transparent)'
  danger: '#a05a3c'
roles:
  surface: '{colors.paper}'
  surface-2: '{colors.paper-dim}'
  surface-ink: '{colors.ink}'
  surface-raised: 'color-mix(paper 72%, white)'
  surface-white: '#ffffff'
  surface-chrome: 'color-mix(paper, paper-dim)'
  surface-accent-soft: 'color-mix(sage 14%, paper)'
  on-surface: '{colors.charcoal}'
  on-surface-muted: '{colors.muted}'
  on-ink: '{colors.hero-fg}'
  on-ink-muted: '{colors.hero-muted}'
  accent: '{colors.sage}'
  accent-hover: '{colors.sage-dark}'
  on-accent: '{colors.sage-on}'
  border: '{colors.border}'
  border-strong: 'color-mix(border 62%, charcoal)'
  danger: '{colors.danger}'
  focus-ring: 'color-mix(accent 45%, transparent)'
  danger-ring: 'color-mix(danger 45%, transparent)'
  disabled-opacity: '0.55'
typography:
  display:
    fontFamily: 'Fraunces, Georgia, Times New Roman, serif'
    fontWeight: 400
    letterSpacing: '-0.03em'
    lineHeight: 1.1
  body:
    fontFamily: 'Work Sans, system-ui, sans-serif'
    fontWeight: 400
    lineHeight: 1.5
  body-light:
    fontFamily: 'Work Sans, system-ui, sans-serif'
    fontWeight: 300
    lineHeight: 1.7
spacing:
  2xs: '4px'
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  2xl: '48px'
  3xl: '64px'
  section-y: 'clamp(88px, 11vw, 128px)'
  page-x: 'clamp(28px, 6.5vw, 104px)'
rounded:
  xs: '4px'
  sm: '8px'
  md: '10px'
  lg: '12px'
  xl: '16px'
  full: '9999px'
components:
  button-primary:
    backgroundColor: '{roles.accent}'
    textColor: '{roles.on-accent}'
    rounded: '{rounded.md}'
    padding: '0 26px'
    height: '50px'
  button-primary-hover:
    backgroundColor: '{roles.accent-hover}'
    textColor: '{roles.on-accent}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{roles.accent}'
    rounded: '{rounded.sm}'
    height: '44px'
  surface-ink:
    backgroundColor: '{roles.surface-ink}'
    textColor: '{roles.on-ink}'
  surface-paper:
    backgroundColor: '{roles.surface}'
    textColor: '{roles.on-surface}'
---

# Yiveno Design System

> **Normative companion (中文完整标准):** [`docs/design/Yiveno-设计标准-v1.md`](docs/design/Yiveno-设计标准-v1.md) **v1.5**  
> **Product truth:** [`docs/product/Yiveno-产品文档-v4.0.md`](docs/product/Yiveno-产品文档-v4.0.md) §0  
> **Terminology (Glossary):** [`docs/product/Yiveno-术语表.md`](docs/product/Yiveno-术语表.md) — user Recall input = **clue**; `clues.note` = **note** (附注)
> **Brand assets:** [`docs/design/brand-assets/README.md`](docs/design/brand-assets/README.md)  
> **Authority:** [`packages/design-tokens/css/brand.css`](packages/design-tokens/css/brand.css) — colors, roles, `--space-*`, `--radius-*`. Extension UI: self-built `App*` components (`AppButton`, `AppModal`, …) + [`extension-ui.css`](frontend/src/styles/extension-ui.css).

## Overview

Yiveno feels like **quiet technology + editorial precision + personal memory**: calm, intelligent, trustworthy, human — never loud AI chrome.

Visual world locked from the marketing site:

- Deep **ink** green for brand moments
- Warm-cool **paper** for content
- Restrained **sage** for action
- **Fraunces** (display) × **Work Sans** (UI/body)

Positioning must never read as: AI tool, bookmark manager, knowledge base, Notion clone, ChatGPT shell, or purple SaaS.

## Colors (Brand Core)

| Token       | Hex / value | Role                                        |
| ----------- | ----------- | ------------------------------------------- |
| `ink`       | `#192420`   | Brand dark, hero, deep logo fields, OG dark |
| `paper`     | `#f0f3ee`   | Default light surface                       |
| `paper-dim` | `#e8ece5`   | Alternate light band, footer                |
| `sage`      | `#4b6054`   | Primary action / emphasis                   |
| `sage-dark` | `#3a4e44`   | Hover / pressed on sage                     |
| `sage-on`   | `#d8ede2`   | Text/icon on sage                           |
| `charcoal`  | `#222c24`   | Body text on paper                          |
| `muted`     | `#586860`   | Secondary text                              |
| `border`    | `#ced8cb`   | Hairlines                                   |
| `danger`    | `#a05a3c`   | Errors (quiet, not alarmist)                |

## Product Roles (v1 frozen)

Canonical CSS names in `site-critical.css`. Prefer roles over raw Brand Core in product/marketing UI.

| Role                    | Maps to / derives from               |
| ----------------------- | ------------------------------------ |
| `--surface`             | paper                                |
| `--surface-2`           | paper-dim                            |
| `--surface-ink`         | ink                                  |
| `--surface-raised`      | color-mix(paper 72%, white)          |
| `--surface-white`       | `#ffffff`                            |
| `--surface-chrome`      | color-mix(paper, paper-dim)          |
| `--surface-accent-soft` | color-mix(sage 14%, paper)           |
| `--on-surface`          | charcoal                             |
| `--on-surface-muted`    | muted                                |
| `--on-ink` / muted      | hero-fg / hero-muted                 |
| `--accent` / hover / on | sage / sage-dark / sage-on           |
| `--border` / strong     | border / color-mix(border, charcoal) |
| `--danger` / rings      | danger + focus/danger rings          |
| `--shadow-ink-sm/md`    | ink-tinted elevation                 |

**Rules**

- Brand recognition = ink + paper + sage. Do not introduce a second primary hue.
- Forbidden as brand accents: bright purple, electric blue, neon, rainbow gradients, high-saturation coral/pink as “AI energy.”
- **Do not** regenerate third-party theme-builder palettes as the source of truth.
- Authority path: `packages/design-tokens/css/brand.css` (color + space + radius).
- Extension product CSS: Roles / `--space-*` / `--radius-*`. Self-built `App*` components (`AppButton`, `AppModal`, `AppSectionTabs`, …).
- **Modal Dialog:** Use `AppModal` for blocking confirms/forms; Esc + focus trap required; no `window.confirm`. Binary confirms use `AppConfirmModal`. See design standard §6.2.1.
- **Section Tabs:** In-page panel switching (Settings / Library) uses `AppSectionTabs` (ARIA tabs), not Nav. Cross-page nav stays in `AppPageHeader`. See §6.2.2.
- Old multi-presets: removed.

## Typography

| Role                     | Family    | Notes                                                                      |
| ------------------------ | --------- | -------------------------------------------------------------------------- |
| Display / brand wordmark | Fraunces  | Headlines, editorial emphasis; weight 300–500; italic for secondary clause |
| Body / UI                | Work Sans | Controls, nav, captions; weight 300–600                                    |

**Rules**

- Marketing: large confident display + light body; generous line-height.
- Extension / dense product UI: prefer Work Sans (or system) for density; do **not** force Fraunces into every chrome label.
- Avoid fashion-magazine ornament and default Inter/Roboto stacks as brand voice.
- Extension user copy still goes through `t()` / `_locales` (product rule); this file does not replace i18n.

## Layout

- Max content width ~1120px; horizontal pad `clamp(28px, 6.5vw, 104px)`.
- Marketing: generous whitespace, asymmetric editorial columns, strong vertical rhythm, thin hairlines.
- First viewport (persuade): brand + one headline + one support line + one CTA group + one dominant product proof — not a dashboard collage.
- Product (operate): denser, scannable; same color axis, less editorial theater.

## Elevation & Depth

- Prefer tonal surfaces and 1px borders over stacked shadows.
- Shadows, if any: soft, low opacity, ink-tinted (`--shadow-ink-*`) — never neon glow or glassmorphism stacks.
- Depth communicates hierarchy of **Closest vs nearby**, not “premium AI.”

## Shapes

- Default radius **10px** (controls); **8–12px** for cards/panels.
- No pill-everything; no oversized squircles as decoration.
- Interactive hover/focus/active: **no** translate/scale/rotate — use background, opacity, border, outline, state layer (product UI hard rule).

## Components

- **Primary button:** accent fill, on-accent text, ~50px tall on marketing CTAs.
- **Secondary:** outline accent / quiet fill — never compete with primary waitlist CTA.
- **Recall proof:** clue field + ranked list; Closest visually dominant; personal note/excerpt when showing product truth.
- **Forms:** visible invalid/error/success; calm copy; no spinner circus.
- Icons: prefer familiar Lucide icons in product (inline via `AppIcon`); marketing mockups must not use magnifying-glass as the main “search” metaphor.

## Do's and Don'ts

**Do**

- Lead with find / remember / closest matches / pick.
- Keep waitlist-phase honesty (no fake Sign in / live Pricing nav when coming soon).
- Derive product roles on the website; extension consumes Brand Roles directly.
- Keep motion sparse: reveal, result stagger, cursor blink; honor `prefers-reduced-motion`.

**Don't**

- Say or imply “Search” as the product noun in user-facing UI.
- Call user Recall input “query” or “prompt” — use **clue** (see `docs/product/Yiveno-术语表.md`).
- Use brain/robot/neural/glow-orb/magic-wand AI clichés.
- Ship empty Closest/results mocks.
- Treat old forest / blue–purple experiments as brand.
- Redesign palette casually during polish — palette changes are brand changes.
- Add multi-theme skin packs that dilute the single ink–paper–sage axis.
