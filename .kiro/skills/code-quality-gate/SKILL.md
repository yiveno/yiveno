---
name: code-quality-gate
description: Enforce code quality checks before commits. Use when modifying TypeScript, Vue, or CSS files to ensure type safety, linting, and style compliance.
---

# 代码质量门禁

> **目的**：确保所有代码提交前通过质量检查，减少 CI 失败和代码审查时间

## 🚦 提交前必检（强制执行）

**每次修改代码后，必须按顺序执行：**

```bash
cd frontend
bun run typecheck:force
bun run lint:check
bun run format
```

**检查清单：**

- [ ] TypeScript 类型检查通过？（无错误）
- [ ] ESLint 检查通过？（无错误）
- [ ] Stylelint 检查通过？（无错误）
- [ ] Prettier 格式化完成？（代码格式统一）

**如果有错误：**

- ✅ 必须立即修复
- ✅ 只有在所有检查通过后才能完成任务
- ❌ 不允许带着错误提交代码

---

## ❌ 永久禁止事项

### 1. TypeScript 禁止项

```typescript
// ❌ 永久禁止：any 类型
const data: any = await fetchData() // 禁止！

// ✅ 正确：使用具体类型或 unknown
const data: BookmarkRecord = await fetchData()
// 或
const data: unknown = await fetchData()
const validated = BookmarkRecordSchema.parse(data) // 使用 Zod 校验
```

**检查方法：**

```bash
# 搜索 any 类型
grep -r ": any" frontend/src/
grep -r "as any" frontend/src/
```

---

### 2. 硬编码禁止项

```css
/* ❌ 禁止：硬编码颜色 */
.button {
  background-color: #3b82f6; /* 禁止！ */
  color: #333; /* 禁止！ */
}

/* ✅ 正确：使用 CSS 变量 */
.button {
  background-color: var(--accent);
  color: var(--color-text-primary);
}
```

```css
/* ❌ 禁止：硬编码间距 */
.card {
  padding: 16px; /* 禁止！ */
  margin-bottom: 25px; /* 禁止！ */
}

/* ✅ 正确：使用间距 tokens */
.card {
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}
```

```css
/* ❌ 禁止：硬编码字号 */
.title {
  font-size: 18px; /* 禁止！ */
  font-weight: 600; /* 禁止！ */
}

/* ✅ 正确：使用字体 tokens */
.title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}
```

**检查方法：**

```bash
# Stylelint 会自动检查硬编码数值
bun run stylelint:check
```

---

### 3. 文件创建禁止项

**❌ 禁止自动创建测试文件：**

```
❌ 禁止：主动创建 .test.ts、.spec.ts、.test.vue 等测试文件
✅ 例外：用户明确说"创建测试文件"、"写测试"时
```

**❌ 禁止自动生成文档：**

```
❌ 禁止：主动生成 .md、.txt、.doc、.pdf 等文档
❌ 禁止：创建 migration-report.md、summary.md、changelog.md
✅ 例外：用户明确说"生成文档"、"创建文档"时
```

**原因：**

- 测试文件属于冗余垃圾，增加维护成本
- 文档应该由用户主动要求创建
- 避免项目中堆积无用文件

---

### 4. 注释禁止项

**❌ 禁止的注释类型：**

```typescript
// ❌ 禁止："已删除"、"已移除"、"已弃用"等状态标记
// 已删除：旧的实现方式

// ❌ 禁止："注意：XXX 已在 YYY 中配置"等提示性注释
// 注意：这个配置已在 settings.ts 中设置

// ❌ 禁止："使用 XXX 替代"等迁移提示
// 使用 newFunction 替代

// ❌ 禁止：重复代码逻辑的注释
// 设置 loading 为 true
loading.value = true // 代码已经很清楚了

// ❌ 禁止：过时的 TODO、FIXME 标记
// TODO: 以后优化这里
```

**✅ 允许的注释：**

```typescript
// ✅ 允许：解释为什么这样做（业务逻辑、性能优化原因）
// 使用 Immer 更新 Map，确保 Vue 可以检测到变化
updateMap(nodes, draft => {
  draft.set('123', newNode)
})

// ✅ 允许：解释复杂算法的思路
// 使用二分查找优化性能，时间复杂度 O(log n)
const index = binarySearch(array, target)

// ✅ 允许：标注外部依赖的限制或 bug workaround
// Workaround: Chrome Extension Manifest V3 不支持 eval()
const result = new Function('return ' + code)()

// ✅ 允许：API 文档（JSDoc）
/**
 * 更新书签访问记录
 * @param bookmarkId - 书签ID
 * @returns Promise<void>
 */
async function updateVisitRecord(bookmarkId: string): Promise<void> {
  // ...
}
```

**原则：代码应该自解释，注释应该解释意图而不是重复代码**

---

## 🔍 自动检查工具

### 1. TypeScript 类型检查

```bash
bun run typecheck:force
```

**检查内容：**

- ✅ 类型错误
- ✅ 类型推断
- ✅ 类型兼容性
- ✅ 泛型约束

---

### 2. ESLint 代码规范检查

```bash
bun run lint:check
```

**检查内容：**

- ✅ 代码风格
- ✅ 潜在错误
- ✅ 最佳实践
- ✅ Vue 3 规范

**自动修复：**

- ✅ 自动格式化
- ✅ 自动添加分号
- ✅ 自动排序 import

---

### 3. Stylelint 样式检查

```bash
bun run stylelint:check   # 只读检查
bun run stylelint         # 自动修复
```

**检查内容：**

- ✅ CSS 语法错误
- ✅ 硬编码数值（颜色、间距、字号）
- ✅ 样式规范
- ✅ 属性顺序

**自动修复：**

- ✅ 自动格式化 CSS
- ✅ 自动排序属性

---

### 4. Prettier 代码格式化

```bash
bun run format
```

**格式化内容：**

- ✅ JavaScript/TypeScript
- ✅ Vue 单文件组件
- ✅ CSS/SCSS
- ✅ JSON/YAML
- ✅ Markdown

---

## 📊 质量指标

### 目标指标

| 指标              | 目标值 | 当前值 |
| ----------------- | ------ | ------ |
| TypeScript 覆盖率 | 100%   | -      |
| ESLint 错误数     | 0      | -      |
| Stylelint 错误数  | 0      | -      |
| 硬编码数值        | 0      | -      |
| any 类型使用      | 0      | -      |

---

## 🚀 快速修复指南

### 问题 1：TypeScript 类型错误

**症状：** `bun run typecheck:force` 报错

**修复步骤：**

1. 查看错误信息，定位文件和行号
2. 添加正确的类型注解
3. 如果是外部数据，使用 Zod 校验
4. 重新运行 `bun run typecheck:force` 确认修复

---

### 问题 2：ESLint 错误

**症状：** `bun run lint:check` 报错

**修复步骤：**

1. 大部分错误会自动修复
2. 手动修复无法自动修复的错误
3. 重新运行 `bun run lint:check` 确认修复

---

### 问题 3：Stylelint 错误

**症状：** `bun run stylelint:check` 报错

**修复步骤：**

1. 查看错误信息，定位硬编码数值
2. 替换为 CSS 变量（参考 design-tokens）
3. 重新运行 `bun run stylelint:check` 确认修复

---

## 📚 相关文档

- [项目规范](../../.kiro/steering/project.md)
- [设计系统规范](../../.kiro/steering/design-system.md)
- [AGENTS.md](../../AGENTS.md)

---

**最后更新**: 2026-05-20  
**维护者**: Kiro AI
