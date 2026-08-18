# Yiveno Logo 物料生成 Prompt（喂给 AI / 设计工具）

> **色彩权威：** 服从 [`Yiveno-设计标准-v1.md`](./Yiveno-设计标准-v1.md) Brand Core（Ink `#192420` / Paper `#f0f3ee` / Sage `#4b6054`）。旧蓝紫实验色已废止。  
> **当前正式素材入口：** 优先看 [`brand-assets/README.md`](./brand-assets/README.md)；项目内常驻品牌母本位于 `docs/design/brand-assets/`。  
> **用法：** 将下方「--- PROMPT START ---」到「--- PROMPT END ---」整段复制给 AI（或 Figma/Export 自动化），并在同一条消息中 **附上你的 SVG 源文件**（`logo-mark.svg` 及可选的 `logo-full.svg`）。  
> **产物目标：** 可直接替换本仓库 `frontend/public/images/` 与 `website/public/` 中的对应文件。

---

## --- PROMPT START ---

你是一名品牌物料导出专家。请根据我附上的 **Yiveno 新 Logo SVG 源文件**，生成下列全部 raster / 矢量导出物。不要改 Logo 造型；只允许为适配尺寸做 **等比缩放、安全边距、小尺寸简化**（见下文规则）。

### 产品背景（仅供构图参考，勿写入小 icon）

- **Yiveno**：Chrome 扩展 + 官网。核心是 **Capture（划词存摘录）→ Recall（用模糊线索找回）**。
- **不是**：书签管理器、笔记 App、AI 聊天产品。
- **对外一句**：帮助用户 capture & recall 个人浏览痕迹（excerpts / notes）。
- **品牌色（Normative，见 `docs/design/Yiveno-设计标准-v1.md`）**：
  - Ink `#192420`（theme-color / OG / 商店深底）
  - Paper `#f0f3ee`（浅底）
  - Sage `#4b6054`（强调）
  - Sage On `#d8ede2`（深底/强调色上的浅前景）
- **禁止**再用实验色：navy `#1E2640`、蓝 `#3B82F6`、紫 `#C026D3` 及蓝紫渐变作为品牌默认。

---

### 输入（由我提供）

| 文件                       | 必须 | 说明                                                 |
| -------------------------- | ---- | ---------------------------------------------------- |
| `logo-mark.svg`            | ✅   | 仅图标 mark，无字标。所有 favicon / 扩展 icon 的主源 |
| `logo-full.svg`            | 可选 | mark +「Yiveno」字标。用于 OG、商店大图、官网 hero   |
| `logo-mark-mono-light.svg` | 可选 | 浅色背景用的单色 mark                                |
| `logo-mark-mono-dark.svg`  | 可选 | 深色背景用的单色 mark                                |

若只有 `logo-mark.svg`，则 **logo-full / mono 变体跳过**，但必须在交付清单中注明「未提供源，未生成」。

---

### 全局导出规则（必须遵守）

1. **画板比例**
   - Mark 类资产：**正方形 1:1**，内容居中。
   - OG / 商店 Marquee：**按各条目指定比例**，不可拉伸 mark。

2. **安全边距（padding）**
   - Mark 在画布内四周至少留 **10%** 空白（Chrome 16×16 会裁切边缘）。
   - Favicon / 扩展 icon：**建议 12–15%**，小尺寸可略增至 18% 以保证可辨认。

3. **小尺寸简化（16 / 32 px）**
   - 去掉细线（< 1.5px @1x）、去掉渐变内的微细节、去掉 mark 内任何文字。
   - 若 mark 过复杂，请额外导出 **简化版 mark** 专用于 16×16 / 32×32，并在文件名加 `-simplified` 说明。

4. **格式与色彩**
   - **PNG（扩展 icon、favicon、OG）**：sRGB，**透明背景**（除 OG / 商店宣传图可指定底色）。
   - **SVG**：保留矢量，无嵌入 raster；stroke 尽量转 outline；viewBox 干净。
   - **ICO**：含 16×16 与 32×32 两档。
   - 禁止使用 CMYK；禁止模糊 JPG 作为 icon。

5. **命名**
   - 严格使用下方「交付文件名」，不要自作主张改名。
   - 全部小写、连字符，扩展名正确。

6. **不要生成**
   - 产品 UI 截图、演示视频本身、Material Symbol 图标。
   - 带「Install Chrome」文案的图（那是运营合成，不是 logo 导出）。

---

### 交付清单 A — Chrome 扩展（必做）

> 目标目录：`frontend/public/images/`  
> 用途：`manifest.json` 的 `icons` / `action.default_icon`；Popup / Settings 顶栏。

| #   | 文件名                     | 尺寸 (px)                    | 格式 | 背景 | 源           | 备注                                          |
| --- | -------------------------- | ---------------------------- | ---- | ---- | ------------ | --------------------------------------------- |
| A1  | `icon16.png`               | **16×16**                    | PNG  | 透明 | logo-mark    | 工具栏等极小场景；可 simplified               |
| A2  | `icon32.png`               | **32×32**                    | PNG  | 透明 | logo-mark    | 扩展页 `<link rel="icon">`                    |
| A3  | `icon48.png`               | **48×48**                    | PNG  | 透明 | logo-mark    | `chrome://extensions` 列表                    |
| A4  | `icon128.png`              | **128×128**                  | PNG  | 透明 | logo-mark    | **Chrome Web Store 主图标**；须清晰           |
| A5  | `logo-mark.svg`            | 矢量                         | SVG  | 透明 | 源文件优化版 | Popup 顶栏 24px 高显示；优化路径，≤ 20KB 为宜 |
| A6  | `logo-mark.png`            | **48×48** 与 **96×96** (@2x) | PNG  | 透明 | logo-mark    | 可选备用；若只做一张则 96×96                  |
| A7  | `logo-mark-mono-light.svg` | 矢量                         | SVG  | 透明 | mono 源      | 有 mono 源才做                                |
| A8  | `logo-mark-mono-dark.svg`  | 矢量                         | SVG  | 透明 | mono 源      | 有 mono 源才做                                |

**Manifest 约束：** Chrome MV3 仅使用 PNG path `images/icon{16,32,48,128}.png`，不可用 SVG 替代 A1–A4。

---

### 交付清单 B — 官网（必做）

> 目标目录：`website/public/` 及 `website/public/images/`

| #   | 文件名                 | 尺寸 (px)        | 格式 | 背景                    | 源                   | 备注                                              |
| --- | ---------------------- | ---------------- | ---- | ----------------------- | -------------------- | ------------------------------------------------- |
| B1  | `images/logo-mark.svg` | 矢量             | SVG  | 透明                    | logo-mark            | Nav / Login / Hero；与 A5 同源即可                |
| B2  | `favicon.svg`          | 矢量             | SVG  | 透明                    | logo-mark            | 现代浏览器 tab；可比 A5 更简                      |
| B3  | `favicon.png`          | **32×32**        | PNG  | 透明                    | logo-mark            |                                                   |
| B4  | `favicon.ico`          | **16+32** 多尺寸 | ICO  | 透明                    | logo-mark            | 单文件 multi-size                                 |
| B5  | `apple-touch-icon.png` | **180×180**      | PNG  | 不透明或 `#1E2640` 底   | logo-mark            | iOS 加主屏；圆角由系统处理，交付方形              |
| B6  | `og-image.png`         | **1200×630**     | PNG  | 品牌底 `#1E2640` 或渐变 | logo-full 或 mark+字 | Open Graph / Twitter Card；**不要**只放 tiny icon |

**OG 构图建议（B6）：**

- 左或中：mark（高度约 120–160px）+ 字标「Yiveno」
- 副标题可选（美式英语，一行）：`Capture traces. Recall in your own words.`
- 安全区：四周留 48px，避免社交平台裁切
- 无需 CTA 按钮图形

---

### 交付清单 C — Chrome Web Store 上架（必做，可不进 git）

> 由运营上传 Google Developer Dashboard；与 A4 视觉一致。

| #   | 文件名                    | 尺寸 (px)    | 格式 | 背景   | 备注                                                  |
| --- | ------------------------- | ------------ | ---- | ------ | ----------------------------------------------------- |
| C1  | `store-icon-128.png`      | **128×128**  | PNG  | 透明   | 应与 `icon128.png` **像素级一致**（或说明即为同文件） |
| C2  | `store-promo-small.png`   | **440×280**  | PNG  | 品牌底 | Small promo tile；mark + 一句价值，非纯 icon          |
| C3  | `store-promo-marquee.png` | **1400×560** | PNG  | 品牌底 | Marquee；可选，有则交付                               |

**C2/C3 文案（英文，可排进图）：**

- 主：`Find what you saved—in your own words.`
- 副：`Highlight to capture. Open Yiveno to recall.`

---

### 交付清单 D — 演示视频配套（建议，官网拉新）

> 视频本体由另制；此处仅要 **静态封面** 与 **短循环占位**。

| #   | 文件名             | 尺寸                 | 格式             | 备注                                             |
| --- | ------------------ | -------------------- | ---------------- | ------------------------------------------------ |
| D1  | `video-poster.jpg` | **1920×1080** (16:9) | JPG 高质量       | 官网 hero 视频 poster；可复用 OG 风格            |
| D2  | `demo-loop.webp`   | **800×450** 左右     | WebP 或 MP4 ≤3MB | 5–8s 无声循环：划词→Save→Recall→命中；**非必须** |

Getting Started（扩展内）若嵌入，优先 **D2 短循环**，不要用 60s 品牌片。

---

### 输出结构（请按此文件夹打包 zip）

```
yiveno-brand-assets/
├── README.txt                 # 列出全部文件、是否 simplified、色值
├── extension/                 → 对应 frontend/public/images/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── logo-mark.svg
│   ├── logo-mark.png          # 可选
│   ├── logo-mark-mono-light.svg
│   └── logo-mark-mono-dark.svg
├── website/                   → 对应 website/public/
│   ├── favicon.svg
│   ├── favicon.png
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   ├── og-image.png
│   └── images/
│       └── logo-mark.svg
└── store/                     → 运营上传，可不 commit
    ├── store-icon-128.png
    ├── store-promo-small.png
    └── store-promo-marquee.png
```

---

### 质量自检（交付前逐项打勾）

- [ ] 16×16 在白色 / `#1E2640` / `#F0FBFD` 三种背景下均可辨认
- [ ] 128×128 与 16×16 视觉同一品牌，非两套设计
- [ ] 全部 PNG icon **alpha 透明**（除 B5、B6、C2、C3 允许底色）
- [ ] SVG 在 24px 高（Popup 顶栏）渲染清晰，无 hairline 消失
- [ ] `favicon.ico` 在浏览器 tab 测试通过
- [ ] `og-image.png` 1200×630，Facebook Sharing Debugger / Twitter Card 比例正确
- [ ] 未引入 SVG 外嵌字体；路径数量合理
- [ ] 文件名与上表 **完全一致**

---

### 若你无法直接导出 ICO / 多尺寸 PNG

请至少交付：

1. 无损 PNG 各尺寸（A1–A4, B3, B5, B6）
2. 优化后的 SVG（A5, B1, B2）
3. 一份 **ImageMagick / Inkscape / sharp 脚本** 或逐步命令，说明如何从 `logo-mark.svg` 批量生成 16/32/48/128 与 favicon.ico。

示例 ImageMagick（仅供你生成脚本时参考）：

```bash
# 从 logo-mark.svg 导出扩展 icon（示例，需按实际 viewBox 调整）
for size in 16 32 48 128; do
  magick -background none -density 384 logo-mark.svg -resize ${size}x${size} icon${size}.png
done
```

---

### 完成后请回复

1. zip 下载链接或附件列表
2. 是否对 16/32 使用了 simplified 版
3. B6 / C2 使用的背景色 hex
4. 任何与源 SVG 不一致的取舍及原因

## --- PROMPT END ---

---

## 仓库替换指引（给人看，不必喂给 AI）

替换完成后：

```bash
# 扩展
cp yiveno-brand-assets/extension/* frontend/public/images/

# 官网
cp yiveno-brand-assets/website/favicon.* website/public/
cp yiveno-brand-assets/website/apple-touch-icon.png website/public/
cp yiveno-brand-assets/website/og-image.png website/public/
cp yiveno-brand-assets/website/images/logo-mark.svg website/public/images/

# 验证
cd frontend && bun run build
cd website && bun run build
# chrome://extensions 刷新扩展
```

**注意：** 扩展 `clean-dist` 不会把官网营销大图打进 `dist/`；扩展与官网资产 **分目录维护**。

---

## 修订记录

| 日期       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| 2026-08-13 | 初版：对齐 manifest、MainLayout、Getting Started 实际引用 |
