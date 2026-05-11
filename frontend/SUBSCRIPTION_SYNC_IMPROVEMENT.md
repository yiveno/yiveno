# 订阅信息同步改进

## 问题背景

### 原有问题

- **官网**：直接查询 Supabase `subscriptions` 表 ✅
- **插件**：通过后端 API 中转查询 ❌
- **结果**：插件和官网获取会员信息的方式不一致，可能导致数据不同步

### 用户疑问

> "既然用户的登录状态两边可以同步，那这个会员信息为什么不能一起同步？"

## 解决方案

### 方案选择：插件直接查询 Supabase（推荐 ⭐⭐⭐）

**理由**：

1. **与官网保持一致**：同样的数据源，同样的查询逻辑
2. **插件独立性**：不依赖官网，可以独立运行
3. **减少网络请求**：不再通过后端 API 中转
4. **数据实时性**：每次都查询最新数据
5. **代码复用**：与官网逻辑一致，易于维护

## 实现细节

### 1. 新增 Supabase 订阅仓库

**文件**：`frontend/src/infrastructure/supabase/subscription-repository.ts`

```typescript
/**
 * 从 Supabase 查询用户的有效订阅信息
 * 查询逻辑与官网完全一致
 */
export async function getSubscriptionFromSupabase(
  userId: string
): Promise<Subscription | null>

/**
 * 检查用户是否为 Pro 用户
 */
export async function isProUser(userId: string): Promise<boolean>
```

**查询逻辑**（与官网一致）：

- 只查询 `status = 'active'` 的订阅
- 只查询未过期的订阅（`current_period_end > now`）
- 按到期时间倒序排序，取最新的一条

### 2. 修改订阅应用服务

**文件**：`frontend/src/application/subscription/subscription-app-service.ts`

**改动**：

- ❌ 移除：通过后端 API 查询（`getSubscriptionStatus`）
- ✅ 新增：直接查询 Supabase（`getSubscriptionFromSupabase`）

**对比**：

```typescript
// ❌ 旧代码：通过后端 API
const subscription = await getSubscriptionStatus(userId)

// ✅ 新代码：直接查询 Supabase
const subscription = await getSubscriptionFromSupabase(userId)
```

### 3. 添加缓存支持

**文件**：`frontend/src/composables/useSubscription.ts`

**缓存策略**（与官网一致）：

- **缓存时长**：15 分钟
- **缓存位置**：Chrome Storage Local
- **缓存键**：`acuity_subscription_cache`
- **首次加载**：立即从缓存读取（避免闪烁），然后后台刷新
- **后续加载**：先显示缓存，后台刷新

**新增方法**：

- `loadFromCache(userId)` - 从缓存读取
- `saveToCache(userId, data)` - 保存到缓存
- `clearCache()` - 清除缓存（强制刷新）

## 数据流对比

### 改进前

```
插件查询会员信息：
  插件 → 后端 API → Supabase → 后端 API → 插件
  (多一层网络请求，可能有缓存或逻辑差异)

官网查询会员信息：
  官网 → Supabase → 官网
  (直接查询，数据实时)
```

### 改进后

```
插件查询会员信息：
  插件 → Supabase → 插件
  (直接查询，与官网一致)

官网查询会员信息：
  官网 → Supabase → 官网
  (直接查询，与官网一致)
```

## 登录状态 vs 会员信息

### 登录状态同步（已实现）

```
官网登录
  ↓
localStorage 存储 session
  ↓
Content Script 监听变化
  ↓
同步到 Chrome Storage
  ↓
插件读取 Chrome Storage
  ↓
✅ 登录状态同步成功
```

**为什么需要同步**：

- 用户在官网登录，插件应该自动登录
- Session 是认证凭证，必须共享

### 会员信息查询（改进后）

```
插件：直接查 Supabase → 获取会员信息 ✅
官网：直接查 Supabase → 获取会员信息 ✅
```

**为什么不需要同步**：

- 会员信息存储在 Supabase 数据库
- 插件和官网都有 Supabase 客户端
- 直接查询即可，无需通过 Chrome Storage 中转
- 插件应该独立运行，不依赖官网

## 优势总结

### 1. 数据一致性 ✅

- 插件和官网使用相同的查询逻辑
- 数据源唯一（Supabase subscriptions 表）
- 不会出现数据不一致的问题

### 2. 性能优化 ✅

- 减少一层网络请求（不再通过后端 API）
- Supabase 查询速度快（< 100ms）
- 添加 15 分钟缓存，减少重复查询

### 3. 独立性 ✅

- 插件不依赖后端 API
- 插件不依赖官网
- 可以独立运行

### 4. 可维护性 ✅

- 代码逻辑与官网一致
- 易于理解和维护
- 减少故障点

## 测试建议

### 1. 功能测试

- [ ] 登录后，插件能正确显示会员等级（FREE/PRO）
- [ ] 会员信息与官网一致
- [ ] 缓存生效（15 分钟内不重复查询）
- [ ] 强制刷新能清除缓存

### 2. 边界测试

- [ ] 未登录时，显示 FREE
- [ ] 订阅过期后，显示 FREE
- [ ] 网络错误时，降级为 FREE
- [ ] Supabase 未配置时，不报错

### 3. 性能测试

- [ ] 首次加载速度（应该 < 200ms，有缓存）
- [ ] 后台刷新不阻塞 UI
- [ ] 多个组件同时调用不重复查询

## 后续优化建议

### 1. 实时同步（可选）

如果需要更实时的会员信息同步，可以考虑：

- 使用 Supabase Realtime 订阅 `subscriptions` 表变化
- 当订阅状态变化时，自动更新插件和官网

### 2. 错误处理增强

- 添加重试机制（网络错误时自动重试）
- 添加降级策略（Supabase 不可用时的备用方案）

### 3. 监控和日志

- 记录查询耗时
- 记录缓存命中率
- 记录错误率

## 相关文件

### 新增文件

- `frontend/src/infrastructure/supabase/subscription-repository.ts`

### 修改文件

- `frontend/src/application/subscription/subscription-app-service.ts`
- `frontend/src/composables/useSubscription.ts`

### 不再使用的代码

- `frontend/src/infrastructure/gumroad/client.ts` 中的 `getSubscriptionStatus()` 函数
  - 注意：该函数仍然存在，但插件不再使用
  - 后端 API 仍然可用，但插件绕过它直接查询 Supabase

---

**更新时间**：2026-05-09  
**作者**：Kiro AI
