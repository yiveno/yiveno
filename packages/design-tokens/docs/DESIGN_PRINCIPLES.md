# otterSage 设计原则

本文档定义了 otterSage 设计系统的核心设计原则，指导所有平台的 UI 设计和实现。

---

## 🎯 核心设计理念

### 1. 一致性优先（Consistency First）

**原则：所有平台的核心 UI 元素必须保持视觉一致性**

- ✅ 相同的颜色系统（Material Design 3 主题）
- ✅ 相同的间距规则（8px 网格系统）
- ✅ 相同的字体层级
- ✅ 相同的圆角、阴影、动画时长

**为什么？**

- 用户在不同平台间切换时，能立即识别出这是同一个产品
- 降低学习成本，提升用户体验
- 建立强大的品牌认知

**如何实现？**

- 使用统一的 design tokens 包
- 核心 UI 元素（按钮、输入框、卡片等）必须 1:1 还原
- 平台特定的 UI（如 iOS 导航栏）可以适配平台规范

**示例：**

```
✅ 正确：所有平台的主按钮都使用 #3B82F6 蓝色
❌ 错误：Web 用蓝色，移动端用绿色
```

---

### 2. Material Design 3 规范（MD3 Compliance）

**原则：完全遵循 Material Design 3 设计系统**

- ✅ 使用 MD3 颜色系统（基于种子色自动生成）
- ✅ 使用 MD3 组件规范（按钮、卡片、输入框等）
- ✅ 使用 MD3 动画曲线和时长
- ✅ 使用 MD3 阴影和层级系统

**为什么？**

- MD3 是经过大量用户测试的成熟设计系统
- 提供完整的可访问性支持
- 自动适配亮色/暗色主题
- 减少设计决策成本

**如何实现？**

- 使用 [Material Theme Builder](https://m3.material.io/theme-builder) 生成主题
- 不手动覆盖 MD3 自动生成的颜色
- 参考 [MD3 组件库](https://m3.material.io/components) 实现 UI

**示例：**

```css
/* ✅ 正确：使用 MD3 颜色变量 */
.button {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

/* ❌ 错误：自定义颜色 */
.button {
  background-color: #3b82f6; /* 应该用 MD3 变量 */
}
```

---

### 3. 深色主题优先（Dark Mode First）

**原则：为专业用户设计的深色界面**

- ✅ 默认使用深色主题
- ✅ 确保深色主题下的对比度符合 WCAG 标准
- ✅ 支持亮色主题（但深色优先）

**为什么？**

- otterSage 的目标用户是专业人士，长时间使用电脑
- 深色主题减少眼睛疲劳
- 更符合现代审美

**如何实现？**

- 使用 MD3 的深色主题色板
- 测试所有 UI 元素在深色背景下的可读性
- 提供亮色主题作为可选项

---

### 4. 可访问性（Accessibility）

**原则：符合 WCAG 2.1 AA 级标准**

- ✅ 文字与背景对比度 ≥ 4.5:1（正文）
- ✅ 文字与背景对比度 ≥ 3:1（大号文字）
- ✅ 交互元素有明显的焦点状态
- ✅ 支持键盘导航
- ✅ 提供语义化的 HTML 标签

**为什么？**

- 让所有用户都能使用产品（包括视障用户）
- 提升整体用户体验
- 符合法律法规要求

**如何实现？**

- 使用 MD3 的颜色系统（自动符合对比度要求）
- 为所有交互元素添加 `:focus` 样式
- 使用语义化 HTML（`<button>` 而非 `<div onclick>`）
- 定期使用 Lighthouse 进行可访问性审计

---

### 5. 简单实用（Simplicity & Practicality）

**原则：只提供真正需要的设计令牌**

- ✅ 避免过度设计
- ✅ 每个 token 都有明确的使用场景
- ✅ 优先使用标准值（8px 网格系统）
- ❌ 不提供"可能用到"的 token

**为什么？**

- 减少选择困难
- 降低维护成本
- 提升开发效率

**如何实现？**

- 定期审查 token 使用情况
- 删除未使用的 token
- 新增 token 前先评估必要性

**示例：**

```typescript
// ✅ 正确：提供常用间距
spacing.xs // 4px
spacing.sm // 8px
spacing.base // 16px
spacing.lg // 24px

// ❌ 错误：提供过多选项
spacing.xs // 4px
spacing.sm // 8px
spacing.md // 12px
spacing.base // 16px
spacing.lg // 20px  // ← 不必要
spacing.xl // 24px
```

---

## 🎨 设计决策流程

### 1. 颜色选择

```
需要什么颜色？
├─ 品牌相关 → 使用 colors.brand.primary / secondary
├─ 状态反馈 → 使用 colors.semantic.success / error / warning
├─ AI 功能 → 使用 colors.semantic.ai
├─ 文本 → 使用 colors.text.primary / secondary
├─ 边框 → 使用 colors.border.default
└─ 背景 → 使用 colors.background.primary / secondary
```

### 2. 间距选择

```
需要什么间距？
├─ 图标与文字 → spacing.xs (4px)
├─ 列表项内部 → spacing.sm (8px)
├─ 卡片内部 → spacing.md (12px)
├─ 标准间距 → spacing.base (16px)
├─ 区块间距 → spacing.lg (24px)
└─ 页面级间距 → spacing.xl (32px) 或更大
```

### 3. 字体选择

```
需要什么字体？
├─ 页面主标题 → text-2xl + font-bold
├─ 区块标题 → text-xl + font-semibold
├─ 小标题 → text-lg + font-semibold
├─ 正文 → text-base + font-normal
├─ 次要文字 → text-sm + font-normal
├─ 按钮 → text-sm + font-medium
└─ 标签 → text-xs + font-medium + uppercase
```

---

## 📐 设计审查清单

在实现新的 UI 元素前，请确认：

- [ ] 是否使用了 design tokens（而非硬编码值）？
- [ ] 颜色对比度是否符合 WCAG 标准？
- [ ] 间距是否符合 8px 网格系统？
- [ ] 是否与现有 UI 元素保持一致？
- [ ] 是否在所有平台上测试过？
- [ ] 是否支持深色主题？
- [ ] 是否支持键盘导航？
- [ ] 是否有明显的焦点状态？

---

## 🚫 常见错误

### ❌ 错误 1：硬编码颜色值

```css
/* 错误 */
.button {
  background-color: #3b82f6;
}

/* 正确 */
.button {
  background-color: var(--md-sys-color-primary);
}
```

### ❌ 错误 2：使用非标准间距

```css
/* 错误 */
.card {
  padding: 15px; /* 不在 8px 网格上 */
}

/* 正确 */
.card {
  padding: var(--spacing-base); /* 16px */
}
```

### ❌ 错误 3：对比度不足

```css
/* 错误 */
.text {
  color: #999; /* 对比度可能不足 */
  background-color: #fff;
}

/* 正确 */
.text {
  color: var(--color-text-secondary); /* 已确保对比度 */
  background-color: var(--color-background-primary);
}
```

---

## 📚 相关资源

- [Material Design 3 指南](https://m3.material.io/)
- [WCAG 2.1 标准](https://www.w3.org/WAI/WCAG21/quickref/)
- [8px 网格系统](https://spec.fm/specifics/8-pt-grid)
- [颜色使用指南](./COLOR_USAGE.md)
- [间距使用指南](./SPACING_GUIDE.md)
- [字体使用指南](./TYPOGRAPHY_GUIDE.md)
