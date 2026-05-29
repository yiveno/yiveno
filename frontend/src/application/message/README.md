# Message 服务使用指南

轻量级提示消息，用于简单的操作反馈。

## 特点

- ⚡ 轻量级：顶部居中显示，不打断用户操作
- ⏱️ 短暂：默认 2 秒后自动消失
- 🎨 Material Design 3 风格
- 📱 响应式：自动适配不同屏幕尺寸
- ♿ 可访问性：支持 ARIA 属性

## 使用场景

✅ **适合使用 Message 的场景**：

- 简单操作反馈（删除成功、保存成功）
- 表单验证提示（邮箱格式错误）
- 加载状态提示（正在加载...）
- 快速信息提示（复制成功）

❌ **不适合使用 Message 的场景**：

- 需要用户确认的操作 → 使用 Dialog
- 需要详细描述的通知 → 使用 Notification
- 持久化的用户消息 → 使用 InboxNotification

## 基本用法

```typescript
import { message } from '@/application/message/message-service'

// 成功消息
message.success('删除成功')

// 错误消息
message.error('保存失败')

// 警告消息
message.warning('存储空间不足')

// 信息消息
message.info('正在同步数据...')

// 加载消息（需要手动关闭）
const hide = message.loading('处理中...')
// 处理完成后
hide()
```

## 高级用法

### 自定义显示时长

```typescript
// 显示 5 秒
message.success('操作成功', 5000)

// 显示 1 秒
message.info('已复制', 1000)
```

### 使用 key 更新消息

```typescript
// 显示加载消息
message.loading('正在上传...', { key: 'upload' })

// 上传完成后，更新为成功消息
message.success('上传成功', { key: 'upload' })
```

### 关闭回调

```typescript
message.success('操作成功', {
  duration: 2000,
  onClose: () => {
    console.log('消息已关闭')
  }
})
```

### 手动关闭

```typescript
// 获取消息 ID
const id = message.info('这是一条消息')

// 手动关闭
message.close(id)

// 关闭所有消息
message.closeAll()
```

## 配置

### 全局配置

```typescript
import { message } from '@/application/message/message-service'

// 更新配置
message.setConfig({
  defaultDuration: 3000, // 默认显示 3 秒
  maxCount: 5, // 最多同时显示 5 条
  showIcon: true, // 显示图标
  top: 24 // 距离顶部 24px
})

// 获取当前配置
const config = message.getConfig()
```

## 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { message } from '@/application/message/message-service'

async function deleteBookmark(id: string) {
  try {
    await api.delete(`/bookmarks/${id}`)
    message.success('删除成功')
  } catch (error) {
    message.error('删除失败')
  }
}

async function saveBookmark(data: BookmarkData) {
  const hide = message.loading('保存中...')
  try {
    await api.save(data)
    hide()
    message.success('保存成功')
  } catch (error) {
    hide()
    message.error('保存失败')
  }
}
</script>
```

## 与 Notification 的区别

| 特性         | Message  | Notification   |
| ------------ | -------- | -------------- |
| **位置**     | 顶部居中 | 右上角         |
| **内容**     | 单行文本 | 标题 + 描述    |
| **时长**     | 1-3 秒   | 3-5 秒         |
| **交互**     | 不可交互 | 可点击、可关闭 |
| **使用场景** | 简单反馈 | 详细通知       |

## 示例

### 删除操作

```typescript
async function handleDelete(id: string) {
  try {
    await deleteBookmark(id)
    message.success('删除成功')
  } catch (error) {
    message.error('删除失败，请重试')
  }
}
```

### 表单验证

```typescript
function validateForm(data: FormData) {
  if (!data.email) {
    message.warning('请输入邮箱')
    return false
  }

  if (!isValidEmail(data.email)) {
    message.error('邮箱格式不正确')
    return false
  }

  return true
}
```

### 复制到剪贴板

```typescript
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch (error) {
    message.error('复制失败')
  }
}
```

### 批量操作

```typescript
async function batchDelete(ids: string[]) {
  const hide = message.loading(`正在删除 ${ids.length} 个书签...`)

  try {
    await Promise.all(ids.map(id => deleteBookmark(id)))
    hide()
    message.success(`成功删除 ${ids.length} 个书签`)
  } catch (error) {
    hide()
    message.error('部分书签删除失败')
  }
}
```

## 注意事项

1. **不要滥用**：Message 用于简单反馈，不要用于复杂信息
2. **时长适中**：默认 2 秒即可，不要设置过长
3. **避免重复**：相同内容的消息会自动去重
4. **及时关闭**：loading 消息记得手动关闭
5. **语义清晰**：消息内容要简洁明了

## API 参考

### message.success(content, duration?)

显示成功消息

- `content`: 消息内容
- `duration`: 显示时长（毫秒），默认 2000

### message.error(content, duration?)

显示错误消息

- `content`: 消息内容
- `duration`: 显示时长（毫秒），默认 3000

### message.warning(content, duration?)

显示警告消息

- `content`: 消息内容
- `duration`: 显示时长（毫秒），默认 2500

### message.info(content, duration?)

显示信息消息

- `content`: 消息内容
- `duration`: 显示时长（毫秒），默认 2000

### message.loading(content?)

显示加载消息

- `content`: 消息内容，默认 "加载中..."
- 返回：关闭函数

### message.close(id)

关闭指定消息

- `id`: 消息 ID

### message.closeAll()

关闭所有消息

### message.setConfig(config)

更新配置

- `config`: 配置对象

### message.getConfig()

获取当前配置

- 返回：配置对象
