# @yiveno/types

共享 TypeScript 类型定义包，用于 Yiveno 项目的类型共享。

## 包含的类型

### Subscription (订阅)

- `Subscription` - 订阅记录接口
- `SubscriptionStatus` - 订阅状态类型
- `SubscriptionTier` - 订阅层级类型

### Payment (支付)

- `PaymentRecord` - 支付记录接口
- `PaymentStatus` - 支付状态类型

## 使用方式

```typescript
import type { Subscription, PaymentRecord } from '@yiveno/types'

// 或者按需导入
import type { Subscription } from '@yiveno/types/subscription'
import type { PaymentRecord } from '@yiveno/types/payment'
```

## 维护指南

- 所有类型定义必须添加 JSDoc 注释（中文）
- 使用 `export type` 而非 `export interface`（除非需要扩展）
- 保持类型定义的简洁性，避免业务逻辑
