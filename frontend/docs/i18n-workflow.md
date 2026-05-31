# 国际化工作流程

## 🎯 快速开始

### 工具链概览

```bash
# 1. 提取硬编码文案（分析）
bun run i18n:extract
# 输出: i18n-report.json

# 2. 自动替换文案（修改代码）
bun run i18n:replace
# 交互式选择要替换的文案

# 3. 验证翻译完整性（质量检查）
bun run i18n:validate
# 检查所有语言包
```

---

## 📊 当前状态

根据最新扫描结果：

- **总文件数**: 301
- **硬编码中文**: 6,906 处
- **独特文案**: 4,579 条
- **现有翻译键**: 28 个
- **覆盖率**: < 1%

**结论**: 需要大量工作，建议分批处理！

---

## 🔄 推荐工作流程

### 阶段 1: 试点（第 1 周）

**目标**: 熟悉工具，完成核心模块

#### Step 1: 提取文案

```bash
cd frontend
bun run i18n:extract
```

查看生成的 `i18n-report.json`，了解文案分布。

#### Step 2: 选择优先模块

根据报告，优先处理：

1. **用户可见的 UI 文案** (高优先级)
   - 按钮文本
   - 错误提示
   - 成功消息
   - 表单标签

2. **日志和调试信息** (低优先级)
   - console.log
   - logger.debug
   - 注释中的中文

**建议**: 先处理 UI 文案，日志可以保持中文。

#### Step 3: 手动替换（小范围试点）

选择 1-2 个小文件手动替换，熟悉流程：

```vue
<!-- 之前 -->
<template>
  <button>保存</button>
  <p>{{ errorMessage }}</p>
</template>

<script setup>
const errorMessage = ref('保存失败')
</script>

<!-- 之后 -->
<template>
  <button>{{ t('common.save') }}</button>
  <p>{{ t(errorKey) }}</p>
</template>

<script setup>
import { useI18n } from '@/utils/i18n-helpers'

const { t } = useI18n()
const errorKey = ref('error.save_failed')
</script>
```

同时更新 `_locales/zh_CN/messages.json`:

```json
{
  "common.save": {
    "message": "保存",
    "description": "通用保存按钮"
  },
  "error.save_failed": {
    "message": "保存失败",
    "description": "保存操作失败的错误提示"
  }
}
```

#### Step 4: 测试验证

```bash
# 类型检查
bun run typecheck

# 代码规范
bun run lint

# 翻译验证
bun run i18n:validate

# 手动测试
bun run dev
```

#### Step 5: 提交代码

```bash
git add .
git commit -m "feat(i18n): 完成 XX 模块的国际化"
```

---

### 阶段 2: 批量处理（第 2-3 周）

**目标**: 使用自动化工具批量处理

#### Step 1: 运行自动替换工具

```bash
bun run i18n:replace
```

**交互式选择**:

```
📝 发现 4579 条硬编码文案

选择处理方式:
  1. 处理前 50 条（推荐）
  2. 处理前 100 条
  3. 处理全部（谨慎！）
  4. 手动选择范围
  0. 退出

请选择 (0-4): 1
```

**建议**:

- 第一次选择 "1" (50条)
- 测试通过后，逐步增加到 100、200 条
- **不要一次性处理全部！**

#### Step 2: 审查自动生成的代码

工具会：

1. ✅ 在 `_locales/*/messages.json` 中添加翻译键
2. ✅ 在代码中添加 `import { t } from '@/utils/i18n-helpers'`
3. ✅ 替换硬编码文案为 `t('key')`

**你需要检查**:

- [ ] 翻译键命名是否合理
- [ ] 替换是否正确（没有误伤）
- [ ] import 语句是否正确
- [ ] 代码格式是否正常

#### Step 3: 优化翻译键

自动生成的键可能不够好，手动优化：

```json
// ❌ 自动生成（不够语义化）
{
  "messaging.消息类型": { "message": "消息类型" },
  "messaging.可选的消息数据": { "message": "可选的消息数据" }
}

// ✅ 手动优化（更清晰）
{
  "messaging.message_type": { "message": "消息类型" },
  "messaging.optional_data": { "message": "可选的消息数据" }
}
```

#### Step 4: 补全其他语言翻译

使用 AI 辅助翻译：

**Prompt 模板**:

```
请将以下 Chrome Extension 的中文翻译为英文。
保持 JSON 格式，只翻译 "message" 字段的值。

{
  "common.save": { "message": "保存" },
  "common.cancel": { "message": "取消" },
  "error.save_failed": { "message": "保存失败" }
}
```

**AI 输出**:

```json
{
  "common.save": { "message": "Save" },
  "common.cancel": { "message": "Cancel" },
  "error.save_failed": { "message": "Save failed" }
}
```

复制到 `_locales/en/messages.json`。

#### Step 5: 验证和测试

```bash
# 验证翻译完整性
bun run i18n:validate

# 类型检查
bun run typecheck

# 代码规范
bun run lint

# 手动测试（切换语言）
# 在浏览器中测试不同语言
```

---

### 阶段 3: 完善和维护（第 4 周+）

#### 日常开发规范

**新功能开发时**:

```vue
<!-- ❌ 禁止硬编码 -->
<template>
  <button>保存</button>
</template>

<!-- ✅ 使用翻译键 -->
<template>
  <button>{{ t('common.save') }}</button>
</template>

<script setup>
import { useI18n } from '@/utils/i18n-helpers'
const { t } = useI18n()
</script>
```

**添加新文案时**:

1. 在 `_locales/zh_CN/messages.json` 添加中文
2. 在 `_locales/en/messages.json` 添加英文
3. 其他语言可以先用 `[TODO]` 占位
4. 定期批量翻译

#### 定期检查

```bash
# 每周运行一次
bun run i18n:extract   # 检查新增的硬编码
bun run i18n:validate  # 检查翻译完整性
```

#### CI/CD 集成

在 `.github/workflows/i18n-check.yml`:

```yaml
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

---

## 🎯 优先级建议

### P0 - 必须翻译（用户可见）

- [ ] 导航菜单
- [ ] 按钮文本
- [ ] 错误提示
- [ ] 成功消息
- [ ] 表单标签
- [ ] 占位符文本
- [ ] Toast 通知

### P1 - 应该翻译（重要但不紧急）

- [ ] 设置页面
- [ ] 帮助文档
- [ ] Tooltip 提示
- [ ] 确认对话框
- [ ] 空状态提示

### P2 - 可以翻译（锦上添花）

- [ ] 详细说明文本
- [ ] 示例文本
- [ ] 开发者工具提示

### P3 - 不需要翻译（保持中文）

- [ ] 代码注释
- [ ] console.log 调试信息
- [ ] logger.debug 日志
- [ ] 开发文档

---

## 📝 翻译键命名规范

### 格式

```
<模块>.<功能>.<类型>
```

### 示例

```json
{
  // 通用
  "common.save": { "message": "保存" },
  "common.cancel": { "message": "取消" },
  "common.confirm": { "message": "确认" },

  // 侧边栏
  "sidebar.bookmarks.title": { "message": "书签管理" },
  "sidebar.recent.title": { "message": "最近访问" },

  // 错误消息
  "error.network.timeout": { "message": "网络超时" },
  "error.save.failed": { "message": "保存失败" },

  // 成功消息
  "success.bookmark.created": { "message": "书签创建成功" },
  "success.bookmark.deleted": { "message": "书签删除成功" }
}
```

---

## ⚠️ 注意事项

### 1. 不要一次性处理全部

```bash
# ❌ 危险
bun run i18n:replace
# 选择 "3. 处理全部"

# ✅ 安全
bun run i18n:replace
# 选择 "1. 处理前 50 条"
# 测试通过后再继续
```

### 2. 仔细审查自动生成的代码

自动替换可能会：

- ❌ 误伤注释中的中文
- ❌ 误伤字符串拼接
- ❌ 误伤正则表达式
- ❌ 生成不合理的键名

**务必人工审查！**

### 3. 提交前检查

```bash
# 必须全部通过
bun run typecheck  # ✅
bun run lint       # ✅
bun run i18n:validate  # ✅

# 手动测试
# ✅ 切换语言测试
# ✅ 功能正常
# ✅ UI 显示正常
```

### 4. 分批提交

```bash
# ✅ 好的提交
git commit -m "feat(i18n): 完成侧边栏模块国际化 (50条)"

# ❌ 不好的提交
git commit -m "feat(i18n): 完成全部国际化 (4579条)"
# 太大了，难以 review
```

---

## 🆘 常见问题

### Q1: 自动替换后代码报错？

**A**: 检查以下几点：

1. import 语句是否正确
2. 翻译键是否存在于语言包中
3. 是否误伤了非文案的字符串

### Q2: 翻译键太长？

**A**: 手动优化：

```json
// ❌ 太长
"messaging.无法创建书签为空或未定义": { "message": "..." }

// ✅ 简洁
"error.bookmark.empty": { "message": "无法创建书签：为空或未定义" }
```

### Q3: 如何处理动态文本？

**A**: 使用占位符：

```typescript
// 翻译键
{
  "bookmark.count": {
    "message": "共 $1 个书签",
    "description": "$1 是书签数量"
  }
}

// 使用
t('bookmark.count', String(count))
```

### Q4: 如何处理复数形式？

**A**: 手动判断：

```typescript
function getBookmarkCountText(count: number): string {
  if (count === 0) return t('bookmark.count.zero')
  if (count === 1) return t('bookmark.count.one')
  return t('bookmark.count.other', String(count))
}
```

---

## 📚 相关文档

- [国际化实施指南](./i18n-implementation-guide.md)
- [Chrome i18n API](https://developer.chrome.com/docs/extensions/reference/i18n/)
- [项目规范](../../.kiro/steering/project.md)

---

**最后更新**: 2025-01-02
**维护者**: otterSage Team
