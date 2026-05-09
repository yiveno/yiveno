# 图标显示问题修复

## 问题描述

项目中有很多图标显示为 `?`，这是因为：

1. 项目使用了 `icon-` 前缀的 Material Icons 命名
2. `LucideIcon` 组件没有自动映射这些旧的图标名称到新的 Lucide Icons
3. 一些图标使用了带连字符的名称（如 `trash-2`, `loader-2`）但映射中缺失

## 修复内容

### 1. 添加缺失的图标映射

在 `frontend/src/components/base/LucideIcon/icons.ts` 中添加了以下映射：

#### Material Icons 映射
```typescript
'icon-folder-edit': 'edit',        // 文件夹编辑
'icon-star': 'star',               // 星标
'icon-warning': 'alert-triangle',  // 警告
'icon-clock': 'clock',             // 时钟
'icon-sync-alert': 'alert-circle', // 同步警告
'icon-share': 'external-link',     // 分享
```

#### Lucide Icons 变体映射
```typescript
'trash-2': Trash2,    // trash-2 → Trash2 组件
'loader-2': Loader2,  // loader-2 → Loader2 组件
'heart': Star,        // heart → Star（收藏功能）
```

### 2. 实现自动映射逻辑

修改 `LucideIcon.vue` 组件，添加自动映射功能：

```typescript
const iconComponent = computed<Component | null>(() => {
  let iconName = props.name
  
  // 如果是 icon- 前缀的 Material Icons，尝试映射到 Lucide Icons
  if (iconName.startsWith('icon-')) {
    const mappedName = materialToLucideMap[iconName]
    if (mappedName) {
      iconName = mappedName
    } else if (import.meta.env.DEV) {
      console.warn(`[LucideIcon] Material Icon 映射未找到: ${iconName}`)
    }
  }
  
  const icon = lucideIcons[iconName]
  if (!icon && import.meta.env.DEV) {
    console.warn(`[LucideIcon] 图标未找到: ${iconName} (原始名称: ${props.name})`)
  }
  return icon || null
})
```

## 修复效果

### 修复前
- ❌ `icon-folder-edit` → 显示 `?`
- ❌ `icon-sync-alert` → 显示 `?`
- ❌ `icon-clock` → 显示 `?`
- ❌ `icon-star` → 显示 `?`
- ❌ `icon-warning` → 显示 `?`
- ❌ `icon-share` → 显示 `?`
- ❌ `trash-2` → 显示 `?`
- ❌ `loader-2` → 显示 `?`
- ❌ `heart` → 显示 `?`

### 修复后
- ✅ `icon-folder-edit` → 显示编辑图标
- ✅ `icon-sync-alert` → 显示警告图标
- ✅ `icon-clock` → 显示时钟图标
- ✅ `icon-star` → 显示星标图标
- ✅ `icon-warning` → 显示警告三角图标
- ✅ `icon-share` → 显示分享图标
- ✅ `trash-2` → 显示垃圾桶图标
- ✅ `loader-2` → 显示加载图标
- ✅ `heart` → 显示星标图标（收藏）

## 开发模式调试

在开发模式下，如果遇到未映射的图标，控制台会输出警告：

```
[LucideIcon] Material Icon 映射未找到: icon-xxx
[LucideIcon] 图标未找到: icon-xxx (原始名称: icon-xxx)
```

这有助于快速发现和修复缺失的图标映射。

## 如何添加新的图标映射

如果发现新的图标显示为 `?`：

### 1. 添加 Material Icons 映射

在 `frontend/src/components/base/LucideIcon/icons.ts` 中找到 `materialToLucideMap`：

```typescript
export const materialToLucideMap: Record<string, string> = {
  // ... 现有映射
  'icon-your-icon': 'lucide-icon-name',  // 添加你的映射
}
```

### 2. 添加 Lucide Icons 变体映射

在 `lucideIcons` 对象中添加：

```typescript
export const lucideIcons: Record<string, Component> = {
  // ... 现有映射
  'your-icon-name': YourIconComponent,  // 添加变体名称
}
```

### 3. 确保图标已导入

确保对应的 Lucide 图标已经在文件顶部导入：

```typescript
import {
  // ... 现有导入
  YourIconComponent
} from 'lucide-vue-next'
```

## 常见图标映射参考

| 原始名称 | 映射到 | 说明 |
|---------|--------|------|
| `trash` / `trash-2` / `delete` | `Trash2` | 删除图标 |
| `loader` / `loader-2` / `loading` | `Loader2` | 加载图标 |
| `heart` / `favorite` / `star` | `Star` | 收藏图标 |
| `icon-edit-bookmark` / `icon-folder-edit` | `Edit` | 编辑图标 |
| `icon-warning` | `AlertTriangle` | 警告图标 |
| `icon-sync-alert` / `icon-alert` | `AlertCircle` | 警告圆圈图标 |

## 相关文件

- `frontend/src/components/base/LucideIcon/icons.ts` - 图标映射配置
- `frontend/src/components/base/LucideIcon/LucideIcon.vue` - 图标组件实现
- `frontend/src/components/base/LucideIcon/LucideIcon.d.ts` - 类型定义

## 参考资料

- [Lucide Icons 官方文档](https://lucide.dev/)
- [Lucide Icons 图标列表](https://lucide.dev/icons/)
- [项目图标使用指南](../src/components/base/LucideIcon/README.md)

---

**修复日期**: 2026-05-07  
**修复人**: Kiro AI  
**更新日期**: 2026-05-07 (添加 trash-2, loader-2, heart 映射)
