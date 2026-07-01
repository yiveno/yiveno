# 跨平台映射表

本文档说明如何将 Yiveno 设计 tokens 映射到不同平台的实现。

---

## 🌐 支持的平台

- ✅ **Web** (HTML/CSS)
- ✅ **Chrome Extension** (HTML/CSS)
- ✅ **React Native** (iOS/Android)
- ✅ **Flutter** (iOS/Android/Web)
- ✅ **Nuxt/Vue** (SSR/SSG)

---

## 📦 安装方式

### Web / Chrome Extension / Nuxt

```bash
# 内部项目（Monorepo）
# 已自动配置 workspace:*

# 外部项目
npm install @yiveno/design-tokens
# 或
bun add @yiveno/design-tokens
```

### React Native

```bash
npm install @yiveno/design-tokens
```

### Flutter

```yaml
# pubspec.yaml
dependencies:
  yiveno_bookmarks_design_tokens:
    path: ../packages/design-tokens
```

---

## 🎨 颜色映射

### Web / Chrome Extension

```typescript
// 方式 1: CSS 变量（推荐）
import '@yiveno/design-tokens/css/material-theme.css'
import '@yiveno/design-tokens/css/variables.css'

// 在 CSS 中使用
.button {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}
```

```typescript
// 方式 2: TypeScript tokens
import { colors } from '@yiveno/design-tokens'

const buttonStyle = {
  backgroundColor: colors.brand.primary, // #3B82F6
  color: colors.neutral.white // #ffffff
}
```

### React Native

```typescript
import { colors } from '@yiveno/design-tokens'

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand.primary, // #3B82F6
    color: colors.neutral.white // #ffffff
  }
})
```

### Flutter

```dart
import 'package:yiveno_bookmarks_design_tokens/colors.dart';

Container(
  color: YivenoColors.brandPrimary,  // Color(0xFF3B82F6)
  child: Text(
    'Button',
    style: TextStyle(color: YivenoColors.neutralWhite),  // Color(0xFFFFFFFF)
  ),
)
```

---

## 📏 间距映射

### Web / Chrome Extension

```css
/* CSS 变量 */
.card {
  padding: var(--spacing-base); /* 16px */
  margin-bottom: var(--spacing-lg); /* 24px */
}
```

```typescript
// TypeScript
import { spacing } from '@yiveno/design-tokens'

const cardStyle = {
  padding: spacing.base, // '1rem' (16px)
  marginBottom: spacing.lg // '1.5rem' (24px)
}
```

### React Native

```typescript
import { spacing } from '@yiveno/design-tokens'

const styles = StyleSheet.create({
  card: {
    padding: parseInt(spacing.base), // 16
    marginBottom: parseInt(spacing.lg) // 24
  }
})
```

### Flutter

```dart
import 'package:yiveno_bookmarks_design_tokens/spacing.dart';

Container(
  padding: EdgeInsets.all(YivenoSpacing.base),  // 16.0
  margin: EdgeInsets.only(bottom: YivenoSpacing.lg),  // 24.0
)
```

---

## 📝 字体映射

### Web / Chrome Extension

```css
/* CSS 变量 */
.title {
  font-size: var(--text-xl); /* 20px */
  font-weight: var(--font-semibold); /* 600 */
  line-height: var(--line-height-tight); /* 1.25 */
}
```

```typescript
// TypeScript
import { fontSize, fontWeight, lineHeight } from '@yiveno/design-tokens'

const titleStyle = {
  fontSize: fontSize.xl, // '1.25rem' (20px)
  fontWeight: fontWeight.semibold, // '600'
  lineHeight: lineHeight.tight // '1.25'
}
```

### React Native

```typescript
import { fontSize, fontWeight, lineHeight } from '@yiveno/design-tokens'

const styles = StyleSheet.create({
  title: {
    fontSize: parseInt(fontSize.xl), // 20
    fontWeight: fontWeight.semibold, // '600'
    lineHeight: parseFloat(lineHeight.tight) * parseInt(fontSize.xl) // 25
  }
})
```

### Flutter

```dart
import 'package:yiveno_bookmarks_design_tokens/typography.dart';

Text(
  'Title',
  style: TextStyle(
    fontSize: YivenoFontSize.xl,              // 20.0
    fontWeight: YivenoFontWeight.semibold,    // FontWeight.w600
    height: YivenoLineHeight.tight,           // 1.25
  ),
)
```

---

## 🎭 圆角映射

### Web / Chrome Extension

```css
.card {
  border-radius: var(--radius-md); /* 8px */
}
```

### React Native

```typescript
import { borderRadius } from '@yiveno/design-tokens'

const styles = StyleSheet.create({
  card: {
    borderRadius: parseInt(borderRadius.md) // 8
  }
})
```

### Flutter

```dart
Container(
  decoration: BoxDecoration(
    borderRadius: BorderRadius.circular(YivenoBorderRadius.md),  // 8.0
  ),
)
```

---

## 🌑 阴影映射

### Web / Chrome Extension

```css
.card {
  box-shadow: var(--shadow-md);
}
```

### React Native

```typescript
import { shadows } from '@yiveno/design-tokens'

// React Native 需要手动解析阴影
const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4 // Android
  }
})
```

### Flutter

```dart
Container(
  decoration: BoxDecoration(
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.1),
        offset: Offset(0, 4),
        blurRadius: 8,
      ),
    ],
  ),
)
```

---

## 🔄 完整示例对比

### 按钮组件

#### Web / Chrome Extension

```vue
<template>
  <button class="yiveno-button">
    <slot />
  </button>
</template>

<style scoped>
.yiveno-button {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--spacing-md) var(--spacing-base);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
</style>
```

#### React Native

```typescript
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@yiveno/design-tokens'

const Button = ({ children }) => (
  <TouchableOpacity style={styles.button}>
    <Text style={styles.text}>{children}</Text>
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand.primary,
    paddingVertical: parseInt(spacing.md),
    paddingHorizontal: parseInt(spacing.base),
    borderRadius: parseInt(borderRadius.md),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2
  },
  text: {
    color: colors.neutral.white,
    fontSize: parseInt(fontSize.sm),
    fontWeight: fontWeight.medium
  }
})
```

#### Flutter

```dart
import 'package:yiveno_bookmarks_design_tokens/tokens.dart';

ElevatedButton(
  onPressed: () {},
  style: ElevatedButton.styleFrom(
    backgroundColor: YivenoColors.brandPrimary,
    foregroundColor: YivenoColors.neutralWhite,
    padding: EdgeInsets.symmetric(
      vertical: YivenoSpacing.md,
      horizontal: YivenoSpacing.base,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(YivenoBorderRadius.md),
    ),
    elevation: 2,
  ),
  child: Text(
    'Button',
    style: TextStyle(
      fontSize: YivenoFontSize.sm,
      fontWeight: YivenoFontWeight.medium,
    ),
  ),
)
```

---

## 📊 Token 映射对照表

| Design Token           | Web/CSS                       | React Native                | Flutter                     |
| ---------------------- | ----------------------------- | --------------------------- | --------------------------- |
| `colors.brand.primary` | `var(--md-sys-color-primary)` | `colors.brand.primary`      | `YivenoColors.brandPrimary` |
| `spacing.base`         | `var(--spacing-base)`         | `parseInt(spacing.base)`    | `YivenoSpacing.base`        |
| `fontSize.base`        | `var(--text-base)`            | `parseInt(fontSize.base)`   | `YivenoFontSize.base`       |
| `fontWeight.medium`    | `var(--font-medium)`          | `fontWeight.medium`         | `YivenoFontWeight.medium`   |
| `borderRadius.md`      | `var(--radius-md)`            | `parseInt(borderRadius.md)` | `YivenoBorderRadius.md`     |

---

## 🛠️ 开发工具

### TypeScript 类型支持

```typescript
import type { Colors, Spacing, FontSize } from '@yiveno/design-tokens'

// 自动补全和类型检查
const myColor: Colors['brand']['primary'] = colors.brand.primary
```

### VS Code 智能提示

安装 CSS Variables 扩展后，可以在 CSS 中获得智能提示：

```css
.button {
  background-color: var(--md-sys-color-primary); /* 自动提示 */
}
```

---

## 📚 相关资源

- [Web 平台文档](./COLOR_USAGE.md)
- [React Native 样式指南](https://reactnative.dev/docs/style)
- [Flutter 主题系统](https://docs.flutter.dev/cookbook/design/themes)
