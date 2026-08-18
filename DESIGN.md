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
  hero-muted: 'rgba(176, 202, 184, 0.6)'
  danger: '#a05a3c'
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
rounded:
  sm: '8px'
  md: '10px'
  lg: '12px'
spacing:
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
  xl: '48px'
  section-y: 'clamp(88px, 11vw, 128px)'
  page-x: 'clamp(28px, 6.5vw, 104px)'
components:
  button-primary:
    backgroundColor: '{colors.sage}'
    textColor: '{colors.sage-on}'
    rounded: '{rounded.md}'
    padding: '0 26px'
    height: '50px'
  button-primary-hover:
    backgroundColor: '{colors.sage-dark}'
    textColor: '{colors.sage-on}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.sage}'
    rounded: '{rounded.sm}'
    height: '44px'
  surface-ink:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.hero-fg}'
  surface-paper:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.charcoal}'
---

# Yiveno Design System

> **Normative companion (中文完整标准):** [`docs/design/Yiveno-设计标准-v1.md`](docs/design/Yiveno-设计标准-v1.md)  
> **Product truth:** [`docs/product/Yiveno-产品文档-v4.0.md`](docs/product/Yiveno-产品文档-v4.0.md) §0  
> **Brand assets:** [`docs/design/brand-assets/README.md`](docs/design/brand-assets/README.md)  
> **Authority:** Website is the **brand core + color lab**. Complete product-role tokens on the site first, then migrate outward. Material Theme color pipelines are **deprecated** (Material Symbols icons may remain). Legacy `forest` / blue–purple experiments are not brand standard.

## Overview

Yiveno feels like **quiet technology + editorial precision + personal memory**: calm, intelligent, trustworthy, human — never loud AI chrome.

Visual world locked from the marketing site:

- Deep **ink** green for brand moments
- Warm-cool **paper** for content
- Restrained **sage** for action
- **Fraunces** (display) × **Work Sans** (UI/body)

Positioning must never read as: AI tool, bookmark manager, knowledge base, Notion clone, ChatGPT shell, or purple SaaS.

## Colors

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

**Rules**

- Brand recognition = ink + paper + sage. Do not introduce a second primary hue.
- Forbidden as brand accents: bright purple, electric blue, neon, rainbow gradients, high-saturation coral/pink as “AI energy.”
- **Do not** regenerate Material Theme palettes as the source of truth. Grow semantic roles (`surface`, `accent`, `on-*`, …) on the **website** first, then port to the extension.
- Marketing and the living lab use brand + role tokens in `website/src/styles/site.css`.

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
- Shadows, if any: soft, low opacity, ink-tinted — never neon glow or glassmorphism stacks.
- Depth communicates hierarchy of **Closest vs nearby**, not “premium AI.”

## Shapes

- Default radius **10px** (controls); **8–12px** for cards/panels.
- No pill-everything; no oversized squircles as decoration.
- Interactive hover/focus/active: **no** translate/scale/rotate — use background, opacity, border, outline, state layer (product UI hard rule).

## Components

- **Primary button:** sage fill, sage-on text, ~50px tall on marketing CTAs.
- **Secondary:** outline sage / quiet fill — never compete with primary waitlist CTA.
- **Recall proof:** clue field + ranked list; Closest visually dominant; personal note/excerpt when showing product truth.
- **Forms:** visible invalid/error/success; calm copy; no spinner circus.
- Icons: prefer familiar Material Symbols in product; marketing mockups must not use magnifying-glass as the main “search” metaphor.

## Do's and Don'ts

**Do**

- Lead with find / remember / closest matches / pick.
- Keep waitlist-phase honesty (no fake Sign in / live Pricing nav when coming soon).
- Derive product roles on the website lab; migrate extension off `--md-sys-color-*` only after roles stabilize.
- Keep motion sparse: reveal, result stagger, cursor blink; honor `prefers-reduced-motion`.

**Don't**

- Say or imply “Search” as the product noun in user-facing UI.
- Use brain/robot/neural/glow-orb/magic-wand AI clichés.
- Ship empty Closest/results mocks.
- Treat Material Theme / old forest / blue–purple experiments as brand.
- Redesign palette casually during polish — palette changes are brand changes.
- Add multi-theme skin packs that dilute the single ink–paper–sage axis.
