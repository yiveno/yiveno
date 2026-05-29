# Notification 组件

完全按照 [Ant Design Notification](https://ant.design/components/notification-cn) 标准实现的通知提醒组件。

## ✨ 核心特性

- ✅ **通过 key 控制更新 vs 新建** - 相同 key 会更新现有通知，完美解决闪烁问题
- ✅ **多通知堆叠显示** - 支持同时显示多个通知
- ✅ **四个方向位置** - topLeft, topRight, bottomLeft, bottomRight
- ✅ **自动关闭 + 手动关闭** - 支持自定义停留时长
- ✅ **悬停暂停** - 鼠标悬停时暂停倒计时
- ✅ **类型化 API** - 完整的 TypeScript 支持

## 📦 基础用法

### 1. 导入

```typescript
import { useNotification } from '@/composables/useNotification'

const notification = useNotification()
```

### 2. 显示通知

```typescript
// 成功通知
notification.success({
  message: '操作成功',
  description: '您的操作已成功完成',
  duration: 3 // 秒
})

// 错误通知
notification.error({
  message: '操作失败',
  description: '请检查后重试'
})

// 信息通知
notification.info({
  message: '温馨提示',
  description: '这是一条提示信息'
})

// 警告通知
notification.warning({
  message: '警告',
  description: '请注意相关风险'
})
```

## 🎯 解决闪烁问题的关键

使用 **key** 参数！相同 key 的通知会**更新**而不是创建新的：

```typescript
// ❌ 错误：会创建多个通知，导致闪烁
notification.success({ message: '书签已移动' })
notification.success({ message: '书签已移动' }) // 创建第二个

// ✅ 正确：更新现有通知，不会闪烁
notification.success({
  message: '书签已移动',
  key: 'bookmark-moved' // 关键！
})

notification.success({
  message: '书签已移动',
  key: 'bookmark-moved' // 相同 key，会更新上面的通知
})
```

## 📖 完整 API

### NotificationConfig

```typescript
interface NotificationConfig {
  // 唯一标识，相同 key 会更新而不是新建
  key?: string

  // 标题
  message?: string

  // 描述内容
  description?: string

  // 停留时长（秒），0 表示不自动关闭
  duration?: number

  // 是否显示关闭按钮
  closable?: boolean

  // 是否显示图标
  icon?: boolean

  // 弹出位置
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
}
```

### 方法

```typescript
// 成功通知
notification.success(config: NotificationConfig): void

// 错误通知
notification.error(config: NotificationConfig): void

// 信息通知
notification.info(config: NotificationConfig): void

// 警告通知
notification.warning(config: NotificationConfig): void

// 通用方法
notification.open(config: NotificationConfig & { type }): void

// 关闭通知
notification.destroy(key?: string): void

// 全局配置
notification.config({
  placement: 'topRight', // 默认位置
  duration: 4.5 // 默认停留时长（秒）
}): void
```

## 💡 实际案例

### 案例 1：书签拖拽移动

```typescript
const handleBookmarkMove = async data => {
  try {
    await moveBookmark(data)

    // ✅ 使用 key 确保快速连续拖拽时不会闪烁
    notification.success({
      message: '书签已移动',
      key: 'bookmark-moved',
      duration: 2
    })
  } catch (error) {
    notification.error({
      message: '移动失败',
      description: '请重试'
    })
  }
}
```

### 案例 2：进度通知

```typescript
// 开始
notification.info({
  message: '正在处理',
  description: '请稍候...',
  key: 'process',
  duration: 0 // 不自动关闭
})

// 更新进度（相同 key）
notification.info({
  message: '处理中',
  description: '已完成 50%',
  key: 'process'
})

// 完成
notification.success({
  message: '处理完成',
  description: '所有任务已完成',
  key: 'process',
  duration: 3
})
```

### 案例 3：多个通知堆叠

```typescript
// 不同 key 会堆叠显示
notification.success({
  message: '保存成功',
  key: 'save'
})

notification.info({
  message: '同步中',
  key: 'sync'
})

notification.warning({
  message: '注意',
  key: 'warning'
})
// → 三个通知会同时显示
```

## 🎨 对比 Ant Design

| 特性          | Ant Design | 本实现 | 说明         |
| ------------- | ---------- | ------ | ------------ |
| 通过 key 更新 | ✅         | ✅     | **核心特性** |
| 多通知堆叠    | ✅         | ✅     |              |
| 四个方向位置  | ✅         | ✅     |              |
| 自动关闭      | ✅         | ✅     |              |
| 手动关闭      | ✅         | ✅     |              |
| 悬停暂停      | ✅         | ✅     |              |
| 自定义图标    | ✅         | ⚠️     | 待实现       |
| 操作按钮      | ✅         | ⚠️     | 待实现       |
| RTL 支持      | ✅         | ❌     |              |

## 🔧 全局配置

```typescript
// 在应用初始化时配置
notification.config({
  placement: 'bottomRight', // 默认位置
  duration: 3 // 默认停留时长（秒）
})
```

## 🐛 故障排除

### Q: 通知还是会闪烁？

A: 检查是否使用了 **key** 参数，相同 key 才会更新而不是新建。

### Q: 通知位置不对？

A: 使用 `placement` 参数或全局配置。

### Q: 如何永久显示通知？

A: 设置 `duration: 0`。

### Q: 如何手动关闭通知？

A: 使用 `notification.destroy(key)` 或点击关闭按钮。
