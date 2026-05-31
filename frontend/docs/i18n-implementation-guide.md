# otterSage 国际化实施指南

## 📋 目录

1. [现状分析](#现状分析)
2. [实施方案](#实施方案)
3. [开发规范](#开发规范)
4. [工具使用](#工具使用)
5. [翻译流程](#翻译流程)
6. [质量保证](#质量保证)

---

## 🔍 现状分析

### 已有基础

✅ **基础设施**

- Chrome i18n API 封装 (`i18n-service.ts`)
- 7种语言目录结构 (zh_CN, zh_TW, en, ja, ko, de, es)
- Vue 指令支持
- 时间格式化已国际化

✅ **支持语言**

- 🇨🇳 简体中文 (zh_CN)
- 🇹🇼 繁体中文 (zh_TW)
- 🇺🇸 英文 (en)
- 🇯🇵 日文 (ja)
- 🇰🇷 韩文 (ko)
- 🇩🇪 德文 (de)
- 🇪🇸 西班牙文 (es)

### 存在问题

❌ **覆盖率低**

- 现有翻译键: ~30条
- 估计需要: ~500-800条
- 覆盖率: <5%

❌ **代码质量**

- 大量硬编码中文文案
- 缺少统一的文案管理
- 没有翻译验证机制

❌ **开发体验**

- 缺少自动化工具
- 没有翻译提取流程
- 缺少开发者文档

---

## 🎯 实施方案

### 阶段 1: 基础设施完善 (1-2天) ✅

**目标**: 建立完整的国际化工具链

- [x] 增强 i18n 辅助函数 (`i18n-helpers.ts`)
- [x] 创建文案提取工具 (`i18n-extract.ts`)
- [x] 创建翻译验证工具 (`i18n-validate.ts`)
- [ ] 添加 npm scripts
- [ ] 编写开发文档

### 阶段 2: 文案提取与整理 (2-3天)

**目标**: 提取所有硬编码文案，建立完整的翻译键体系

**步骤**:

1. **自动提取** (1天)

   ```bash
   cd frontend
   bun run i18n:extract
   ```

   - 扫描所有 `.vue` 和 `.ts` 文件
   - 提取硬编码中文文案
   - 生成翻译键建议
   - 输出待翻译列表

2. **人工整理** (1天)
   - 审查提取的文案
   - 合并重复文案
   - 优化翻译键命名
   - 分类组织（按模块/功能）

3. **代码重构** (1天)
   - 替换硬编码文案为翻译键
   - 使用 `t()` 函数
   - 测试功能完整性

### 阶段 3: 翻译补全 (3-5天)

**目标**: 完成所有语言的翻译

**优先级**:

1. **P0 - 核心功能** (必须)
   - 导航菜单
   - 按钮文案
   - 错误提示
   - 成功消息

2. **P1 - 重要功能** (应该)
   - 设置页面
   - 帮助文档
   - 表单标签
   - 占位符文本

3. **P2 - 辅助功能** (可以)
   - Tooltip 提示
   - 详细说明
   - 示例文本

**翻译方式**:

- **中文 → 英文**: 人工翻译（核心团队）
- **英文 → 其他语言**: AI 辅助 + 人工校对
  - 使用 ChatGPT/Claude 批量翻译
  - 母语者校对（如有条件）
  - 社区贡献（长期）

### 阶段 4: 质量保证 (1-2天)

**目标**: 确保翻译质量和完整性

**检查项**:

- [ ] 所有语言包键一致
- [ ] 无缺失翻译
- [ ] 无空翻译
- [ ] 占位符正确
- [ ] 上下文合适
- [ ] 术语统一

**工具**:

```bash
# 验证翻译完整性
bun run i18n:validate

# 检查未使用的键
bun run i18n:unused

# 生成翻译覆盖率报告
bun run i18n:coverage
```

### 阶段 5: 持续维护 (长期)

**目标**: 建立可持续的国际化流程

**流程**:

1. **新功能开发**
   - 使用翻译键，不硬编码
   - 同步更新所有语言包
   - PR 中包含翻译更新

2. **定期检查**
   - 每周运行 `i18n:validate`
   - 每月审查翻译质量
   - 收集用户反馈

3. **社区贡献**
   - 开放翻译贡献渠道
   - 建立翻译审核流程
   - 感谢贡献者

---

## 📝 开发规范

### 1. 翻译键命名规范

**格式**: `<模块>.<功能>.<类型>`

**示例**:

```typescript
// ✅ 好的命名
'sidebar.bookmarks.title' // 侧边栏 - 书签 - 标题
'settings.general.save_button' // 设置 - 通用 - 保存按钮
'error.network.timeout' // 错误 - 网络 - 超时

// ❌ 不好的命名
'text1' // 太模糊
'sidebar_bookmarks_title_text' // 太冗长
'保存' // 使用中文
```

**分类前缀**:

- `common.*` - 通用文案（按钮、标签等）
- `sidebar.*` - 侧边栏
- `settings.*` - 设置页面
- `popup.*` - 弹窗
- `error.*` - 错误消息
- `success.*` - 成功消息
- `tooltip.*` - 提示文本
- `placeholder.*` - 占位符

### 2. 代码使用规范

#### 在 Vue 组件中

```vue
<script setup lang="ts">
import { useI18n } from '@/utils/i18n-helpers'

const { t } = useI18n()
</script>

<template>
  <div>
    <!-- ✅ 推荐：使用 t() 函数 -->
    <h1>{{ t('sidebar.bookmarks.title') }}</h1>
    <button>{{ t('common.save') }}</button>

    <!-- ✅ 带占位符 -->
    <p>{{ t('bookmark.count', String(count)) }}</p>

    <!-- ❌ 禁止：硬编码 -->
    <h1>书签管理</h1>
  </div>
</template>
```

#### 在 TypeScript 中

```typescript
import { t } from '@/utils/i18n-helpers'

// ✅ 推荐
const message = t('success.bookmark_created')
console.log(message)

// ✅ 带占位符
const errorMsg = t('error.invalid_url', url)

// ❌ 禁止
const message = '书签创建成功'
```

#### 动态文本

```typescript
// ✅ 推荐：使用映射
const statusMap: Record<string, string> = {
  pending: t('status.pending'),
  success: t('status.success'),
  failed: t('status.failed')
}

const statusText = statusMap[status]

// ❌ 禁止：硬编码映射
const statusMap = {
  pending: '处理中',
  success: '成功',
  failed: '失败'
}
```

### 3. 翻译文件规范

#### messages.json 格式

```json
{
  "key_name": {
    "message": "翻译文本",
    "description": "上下文说明（可选）"
  },

  "bookmark_count": {
    "message": "$1 个书签",
    "description": "显示书签数量，$1 是数字占位符"
  },

  "welcome_user": {
    "message": "欢迎，$1！",
    "description": "欢迎消息，$1 是用户名"
  }
}
```

#### 占位符使用

```json
{
  "single_placeholder": {
    "message": "你有 $1 条消息"
  },

  "multiple_placeholders": {
    "message": "$1 在 $2 创建了 $3"
  }
}
```

```typescript
// 使用
t('single_placeholder', '5')
t('multiple_placeholders', ['张三', '2025-01-01', '新书签'])
```

### 4. 特殊场景处理

#### 复数形式

```json
{
  "bookmark_count_zero": { "message": "没有书签" },
  "bookmark_count_one": { "message": "1 个书签" },
  "bookmark_count_other": { "message": "$1 个书签" }
}
```

```typescript
function getBookmarkCountText(count: number): string {
  if (count === 0) return t('bookmark_count_zero')
  if (count === 1) return t('bookmark_count_one')
  return t('bookmark_count_other', String(count))
}
```

#### 性别/敬语

```json
{
  "greeting_formal": { "message": "您好" },
  "greeting_casual": { "message": "你好" }
}
```

#### RTL 语言支持

```vue
<script setup>
import { useI18n } from '@/utils/i18n-helpers'

const { isRTL } = useI18n()
</script>

<template>
  <div :dir="isRTL ? 'rtl' : 'ltr'">
    <!-- 内容会自动适配方向 -->
    <!-- 注意：当前版本不支持 RTL 语言 -->
  </div>
</template>
```

---

## 🛠️ 工具使用

### 1. 提取硬编码文案

```bash
cd frontend
bun run i18n:extract
```

**输出**: `i18n-report.json`

```json
{
  "summary": {
    "totalFiles": 250,
    "hardcodedTexts": 450,
    "uniqueTexts": 320
  },
  "hardcodedTexts": [
    {
      "text": "书签管理",
      "file": "/src/pages/sidebar.vue",
      "line": 42,
      "suggestedKey": "sidebar.title"
    }
  ]
}
```

### 2. 验证翻译完整性

```bash
bun run i18n:validate
```

**输出**:

```
✅ 所有翻译验证通过！

或

❌ 发现翻译问题:

❌ 缺失翻译 (15):
  - [ja] settings.tab.general
  - [ko] settings.tab.embeddings
  ...

⚠️ 空翻译 (3):
  - [ar] common.save
  ...

🔧 占位符不匹配 (2):
  - [zh_TW] bookmark.count
    占位符数量不匹配: 基准 1 vs 当前 0
```

### 3. 查找未使用的翻译键

```bash
bun run i18n:unused
```

### 4. 生成翻译覆盖率报告

```bash
bun run i18n:coverage
```

---

## 🌐 翻译流程

### 方案 A: AI 辅助翻译（推荐）

**步骤**:

1. **准备中文文案**

   ```json
   {
     "sidebar.bookmarks.title": { "message": "书签管理" },
     "common.save": { "message": "保存" },
     "common.cancel": { "message": "取消" }
   }
   ```

2. **使用 AI 批量翻译**

   **Prompt 模板**:

   ```
   请将以下 Chrome Extension 的中文翻译为 [目标语言]。
   保持 JSON 格式，只翻译 "message" 字段的值。
   注意：
   - 保持占位符 $1, $2 等不变
   - 使用自然、地道的表达
   - 保持专业术语一致性

   [粘贴 JSON 内容]
   ```

3. **人工校对**
   - 检查术语一致性
   - 验证上下文准确性
   - 测试实际显示效果

### 方案 B: 社区贡献

1. **创建翻译任务**
   - 在 GitHub Issues 创建翻译任务
   - 标注语言和优先级
   - 提供上下文说明

2. **审核流程**
   - 母语者审核
   - 测试实际效果
   - 合并 PR

---

## ✅ 质量保证

### 自动化检查

**Pre-commit Hook**:

```bash
# .husky/pre-commit
bun run i18n:validate
```

**CI/CD Pipeline**:

```yaml
# .github/workflows/i18n-check.yml
name: I18n Check

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: cd frontend && bun install
      - run: cd frontend && bun run i18n:validate
```

### 人工审核清单

- [ ] 翻译准确性
- [ ] 上下文适配
- [ ] 术语一致性
- [ ] 语法正确性
- [ ] 文化适应性
- [ ] UI 显示效果

### 测试方法

1. **切换语言测试**

   ```typescript
   // 在浏览器控制台
   chrome.i18n.getUILanguage() // 查看当前语言
   ```

2. **视觉测试**
   - 检查文本是否被截断
   - 检查布局是否错乱
   - 检查 RTL 语言方向

3. **功能测试**
   - 所有功能在各语言下正常工作
   - 错误消息正确显示
   - 表单验证消息正确

---

## 📚 参考资源

### 官方文档

- [Chrome Extension i18n](https://developer.chrome.com/docs/extensions/reference/i18n/)
- [Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)

### 最佳实践

- [Google I18n Style Guide](https://developers.google.com/style/translation)
- [Microsoft Localization Style Guides](https://www.microsoft.com/en-us/language)

### 工具推荐

- **翻译**: ChatGPT, Claude, DeepL
- **术语管理**: Notion, Airtable
- **协作**: GitHub, Crowdin

---

## 🎯 里程碑

### Sprint 1 (Week 1-2)

- [x] 完善基础设施
- [ ] 提取所有文案
- [ ] 完成中英文翻译

### Sprint 2 (Week 3-4)

- [ ] 完成其他语言翻译
- [ ] 质量保证
- [ ] 文档完善

### Sprint 3 (Week 5+)

- [ ] 用户测试
- [ ] 反馈收集
- [ ] 持续优化

---

**最后更新**: 2025-01-02
**维护者**: otterSage Team
