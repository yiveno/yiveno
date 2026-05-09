# 搜索功能优化说明

## 问题描述

用户搜索"代码"这样的关键词时，无法找到 GitHub、博客园等相关书签。

### 问题原因

1. **语义搜索需要 PRO 会员**
   - 项目的语义搜索（Semantic Search）功能需要 PRO 会员才能使用
   - 语义搜索能理解"代码" → "GitHub"、"博客园"这样的语义关联

2. **Fuse 搜索只能精确匹配**
   - 免费版使用的 FlexSearch 只能匹配书签标题、URL、域名中直接包含的文字
   - 如果书签标题是"GitHub - xxx项目"，搜索"代码"无法匹配

3. **意图检测门槛过高**
   - 原来的配置要求至少 3 个字符才触发语义搜索
   - "代码"只有 2 个汉字，被判定为 Fuse 搜索

## 已实施的优化

### 1. 降低语义搜索门槛

```typescript
// 修改前
const MIN_SEMANTIC_LENGTH = 3  // 至少 3 个字符

// 修改后
const MIN_SEMANTIC_LENGTH = 2  // 降低到 2，支持"代码"这样的短词
```

### 2. 添加语义关键词识别

新增语义关键词集合，当搜索这些词时自动使用 Hybrid 策略（Fuse + Semantic）：

```typescript
const SEMANTIC_KEYWORDS = new Set([
  // 中文
  '代码', '编程', '开发', '技术', '教程', '文档', '博客', '学习',
  // 英文
  'code', 'programming', 'development', 'tutorial', 'documentation', 'blog', 'learning'
])
```

### 3. 优化搜索策略

- **"代码"** → 使用 `hybrid` 策略
  - 先用 FlexSearch 快速返回精确匹配结果
  - 再用语义搜索补充相关结果（如果是 PRO 用户）

## 搜索策略说明

### Fuse 搜索（免费）
- **适用场景**：精确关键词搜索
- **匹配方式**：标题、URL、域名、关键词中包含搜索词
- **示例**：
  - ✅ 搜索"GitHub" → 匹配标题包含"GitHub"的书签
  - ✅ 搜索"vue" → 匹配 URL 包含"vue"的书签
  - ❌ 搜索"代码" → 无法匹配标题为"GitHub"的书签

### Semantic 搜索（PRO）
- **适用场景**：语义理解、概念搜索
- **匹配方式**：使用 AI 模型理解语义相似度
- **示例**：
  - ✅ 搜索"代码" → 匹配 GitHub、GitLab、博客园等编程相关书签
  - ✅ 搜索"设计" → 匹配 Figma、Dribbble、Behance 等设计相关书签
  - ✅ 搜索"学习" → 匹配教程、文档、课程等学习资源

### Hybrid 搜索（PRO）
- **适用场景**：兼顾速度和准确性
- **匹配方式**：先返回 Fuse 结果，再异步补充 Semantic 结果
- **优势**：
  - 快速响应（Fuse 结果立即返回）
  - 全面覆盖（Semantic 结果异步补充）

## 改进建议

### 对于免费用户

1. **使用更精确的关键词**
   - ❌ 搜索"代码" → 可能找不到结果
   - ✅ 搜索"GitHub" → 能找到 GitHub 相关书签
   - ✅ 搜索"博客园" → 能找到博客园相关书签

2. **使用书签标签功能**
   - 为 GitHub 书签添加"代码"、"编程"等标签
   - 搜索时会匹配标签内容

3. **优化书签标题**
   - 将书签标题改为包含关键词的描述
   - 例如："GitHub - 代码托管平台"

### 对于 PRO 用户

1. **启用语义搜索**
   - 进入设置 → Embeddings
   - 开启"自动生成嵌入"
   - 等待向量索引构建完成

2. **使用自然语言搜索**
   - ✅ "找一些编程相关的网站"
   - ✅ "设计灵感"
   - ✅ "学习资料"

3. **定期同步向量索引**
   - 新增书签后，系统会自动生成向量
   - 也可以手动触发全量同步

## 技术实现细节

### 搜索流程

```
用户输入查询
    ↓
意图检测（detectIntent）
    ↓
┌─────────────┬─────────────┬─────────────┐
│   Fuse      │   Hybrid    │  Semantic   │
│  (精确匹配)  │ (混合策略)   │  (语义理解)  │
└─────────────┴─────────────┴─────────────┘
    ↓              ↓              ↓
FlexSearch    Fuse + Semantic   ONNX Embedding
    ↓              ↓              ↓
返回结果      渐进式返回      返回结果
```

### 意图检测规则

| 查询特征 | 策略 | 示例 |
|---------|------|------|
| 单个技术词 | Fuse | `css`, `vue`, `api` |
| 语义关键词 | Hybrid | `代码`, `编程`, `学习` |
| 自然语言 | Semantic | `怎么学习前端`, `设计灵感网站` |
| 特殊符号 | Fuse | `github.com`, `@vue` |
| 长句（>15字符） | Semantic | `前端开发学习资源推荐` |

### 性能优化

1. **查询缓存**
   - 缓存最近 1000 次查询结果
   - TTL: 5 分钟
   - Hybrid 策略不缓存（避免过期）

2. **索引优化**
   - FlexSearch: 前向分词，适合中文
   - 字段权重：标题 60%、URL 30%、域名 20%、关键词 20%

3. **异步加载**
   - Hybrid 策略：Fuse 结果立即返回
   - Semantic 结果异步补充（600ms 超时）

## 相关文件

- `frontend/src/core/query-engine/intent-detector.ts` - 意图检测器
- `frontend/src/core/query-engine/query-service.ts` - 查询服务
- `frontend/src/core/query-engine/strategies/flexsearch-strategy.ts` - FlexSearch 策略
- `frontend/src/core/query-engine/strategies/semantic-strategy.ts` - 语义搜索策略
- `frontend/src/application/query/bookmark-search-service.ts` - 应用层搜索服务

## 参考资料

- [FlexSearch 文档](https://github.com/nextapps-de/flexsearch)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [向量搜索原理](https://www.pinecone.io/learn/vector-search/)

---

## 优化记录

### 优化 2: 添加语义搜索开关（2026-05-07）

#### 需求背景
- PRO 用户需要能够控制是否启用语义搜索
- 免费用户应该看到禁用状态，提示升级到 PRO
- 设置需要持久化保存

#### 实现方案

**1. 设置页面添加开关**

文件：`frontend/src/pages/settings/sections/GeneralSettings.vue`

- 添加"语义搜索"开关
- PRO 用户：可以开启/关闭
- 免费用户：显示禁用状态（灰色）+ 提示"此功能仅限 PRO 会员使用"
- 设置保存到 `chrome.storage.local.semanticSearchEnabled`

**2. 搜索服务集成**

文件：`frontend/src/core/query-engine/query-service.ts`

- 在执行搜索前检查 `semanticSearchEnabled` 设置
- 如果策略为 `semantic` 或 `hybrid` 但设置为关闭，降级到 `fuse`
- 添加日志记录："语义搜索已禁用，降级到 fuse"

**3. i18n 翻译**

添加翻译键：
- `settings_general_semantic_search` - "语义搜索"
- `settings_general_semantic_search_description` - 功能描述
- `settings_general_semantic_search_hint` - 使用提示
- `settings_general_semantic_search_pro_only` - PRO 限制提示

#### 行为说明

**PRO 用户**：
- ✅ 可以在设置中开启/关闭语义搜索
- ✅ 开启后，搜索"代码"等语义关键词会使用 hybrid 策略
- ✅ 关闭后，所有搜索降级到 fuse（纯关键词匹配）

**免费用户**：
- ❌ 开关显示为禁用状态（灰色）
- ❌ 无法开启语义搜索
- ⚠️ 显示提示："此功能仅限 PRO 会员使用"
- ✅ 所有搜索使用 fuse 策略

**默认值**：
- 新用户：`semanticSearchEnabled = false`（默认关闭）
- PRO 用户需要手动在设置中开启

#### 相关文件
- `frontend/src/pages/settings/sections/GeneralSettings.vue` - 设置页面
- `frontend/src/core/query-engine/query-service.ts` - 查询服务
- `frontend/src/composables/useSubscription.ts` - 订阅状态管理
- `frontend/public/_locales/zh_CN/messages.json` - 中文翻译
- `frontend/public/_locales/en/messages.json` - 英文翻译

---

**优化日期**: 2026-05-07  
**优化人**: Kiro AI
