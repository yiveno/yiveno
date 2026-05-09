# Embedding 设置移除 - 智能默认值实施

## 背景

之前的 embedding 设置页面包含了过于技术化的配置项，对普通用户来说难以理解：

- 自动生成开关
- 每日配额
- 单次最大处理数
- 仅夜间/空闲时间生成

这些配置项应该由系统智能管理，而不是让用户手动调整。

## 实施内容

### 1. 删除 UI 组件

**删除的文件：**
- `frontend/src/pages/settings/sections/EmbeddingSettings.vue`

**修改的文件：**
- `frontend/src/pages/settings/Settings.vue` - 删除 embeddings 标签页
- `frontend/src/pages/settings/sections/ProGate.vue` - 删除 embeddings 功能描述

### 2. 增强语义搜索说明

**修改文件：** `frontend/src/pages/settings/sections/GeneralSettings.vue`

**新增内容：**
- 在"语义搜索"开关下方添加详细说明
- 强调"后台自动生成语义向量，完全本地化，无需联网"
- 说明这是 PRO 功能

### 3. 清理翻译文件

**清理脚本：** `frontend/scripts/clean-embedding-translations.py`

**清理结果：**
- 处理了 6 种语言（zh_CN, zh_TW, en, ja, ko, es）
- 删除了 138 个翻译键（每种语言 23 个键）
- 删除的键前缀：`settings_embedding_*`

**删除的翻译键：**
```
settings_embedding_title
settings_embedding_auto_generate
settings_embedding_auto_generate_tooltip_title
settings_embedding_auto_generate_tooltip_1
settings_embedding_auto_generate_tooltip_2
settings_embedding_auto_generate_tooltip_3
settings_embedding_daily_quota
settings_embedding_daily_quota_tooltip_title
settings_embedding_daily_quota_tooltip_1
settings_embedding_daily_quota_tooltip_2
settings_embedding_daily_quota_tooltip_3
settings_embedding_daily_quota_placeholder
settings_embedding_per_run_max
settings_embedding_per_run_max_tooltip_title
settings_embedding_per_run_max_tooltip_1
settings_embedding_per_run_max_tooltip_2
settings_embedding_per_run_max_tooltip_3
settings_embedding_per_run_max_placeholder
settings_embedding_night_idle_only
settings_embedding_night_idle_only_tooltip_title
settings_embedding_night_idle_only_tooltip_1
settings_embedding_night_idle_only_tooltip_2
settings_embedding_night_idle_only_tooltip_3
```

### 4. 代码验证

**验证结果：**
- ✅ 无 `EmbeddingSettings` 组件引用
- ✅ 无 `getSetting('embedding')` 调用
- ✅ 无 `settings_embedding_*` 翻译键
- ✅ 无 embedding 设置相关的代码残留

## 智能默认值

### 当前实现

**文件：** `frontend/src/infrastructure/embedding/embedding-service.ts`

**硬编码的智能默认值：**
```typescript
const BATCH_SIZE = 32           // 每批处理 32 个书签
const MAX_TEXT_LENGTH = 512     // 文本最大长度 512 字符
```

### 自动化行为

1. **增量同步**
   - 只处理新增或变更的书签
   - 自动清理已删除书签的向量

2. **批量处理**
   - 分批处理避免阻塞主线程
   - 每批处理后 `setTimeout(0)` 让出主线程

3. **智能选择 Provider**
   - 优先使用 ONNX 本地模型
   - 备用 Chrome Built-in AI（未来）

4. **完全本地化**
   - 无需网络请求
   - 数据不上传
   - 完全隐私保护

## 用户体验改进

### 之前（过于技术化）

```
设置 → 嵌入
  ├─ 自动生成 [开关]
  ├─ 每日配额 [输入框: 300]
  ├─ 单次最大 [输入框: 150]
  └─ 仅夜间/空闲 [开关]
```

用户困惑：
- "嵌入是什么？"
- "配额设置多少合适？"
- "为什么要限制单次最大？"

### 之后（简洁明了）

```
设置 → 通用
  └─ 语义搜索 [开关] (PRO)
     说明：使用 AI 理解搜索意图，提供更智能的搜索结果
     提示：后台自动生成语义向量，完全本地化，无需联网
```

用户体验：
- ✅ 一个开关，简单明了
- ✅ 说明清晰，知道功能作用
- ✅ 强调本地化和隐私保护
- ✅ 无需关心技术细节

## 文档更新

**更新文件：** `.claude/CLAUDE.md`

**新增章节：** "Embedding Service (Automatic Behavior)"

**说明内容：**
- 强调无需用户配置
- 说明智能默认值
- 列出相关文件路径
- 展示硬编码的常量

## 验证清单

- [x] 删除 `EmbeddingSettings.vue` 组件
- [x] 从 `Settings.vue` 删除 embeddings 标签页
- [x] 从 `ProGate.vue` 删除 embeddings 描述
- [x] 增强 `GeneralSettings.vue` 中的语义搜索说明
- [x] 清理所有语言的翻译文件（138 个键）
- [x] 验证无代码残留
- [x] 更新 `.claude/CLAUDE.md` 文档
- [x] 创建清理脚本 `clean-embedding-translations.py`
- [x] 创建本文档记录清理过程

## 后续工作

### 可选优化（未来）

1. **动态配额计算**
   - 根据书签数量自动调整每日配额
   - 例如：书签数 < 1000 → 配额 500/天
   - 例如：书签数 > 10000 → 配额 2000/天

2. **智能调度**
   - 检测系统空闲时间
   - 优先在夜间或空闲时处理
   - 避免影响用户正常使用

3. **进度反馈**
   - 在设置页面显示向量生成进度
   - 例如："已生成 1500/2000 个书签的语义向量"

### 注意事项

- ❌ 不要重新引入用户可配置的 embedding 设置
- ✅ 保持智能默认值的简洁性
- ✅ 如需调整参数，直接修改代码中的常量
- ✅ 优先考虑自动化而非暴露配置项

## 总结

这次清理彻底移除了过于技术化的 embedding 设置页面，采用智能默认值自动管理。用户只需要知道"语义搜索"功能，无需关心底层的向量生成细节。这大大简化了用户体验，同时保持了功能的完整性。

**核心理念：** 让技术为用户服务，而不是让用户理解技术。
