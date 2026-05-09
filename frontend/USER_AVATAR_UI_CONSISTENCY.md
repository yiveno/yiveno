# 用户头像 UI 一致性改进

## 目标

确保官网和插件的用户头像 UI 保持完全一致，提供统一的用户体验。

## 改进内容

### 1. 头像尺寸统一

**改进前**：
- 官网：32px
- 插件：36px ❌

**改进后**：
- 官网：32px ✅
- 插件：32px ✅

### 2. 边框颜色统一

**改进前**：
- 官网：免费用户使用 `ring-primary-400`（蓝绿色）
- 插件：免费用户使用 `--md-sys-color-secondary`（蓝色）❌

**改进后**：
- 官网：免费用户使用 `ring-primary-400`（蓝绿色）✅
- 插件：免费用户使用 `--md-sys-color-primary`（蓝绿色）✅

### 3. PRO 徽章统一

**改进前**：
- 官网：20px × 20px，位置 `-bottom-1 -right-1`
- 插件：18px × 18px，位置 `-bottom-2px -right-2px` ❌

**改进后**：
- 官网：20px × 20px，位置 `-bottom-1 -right-1` ✅
- 插件：20px × 20px，位置 `-bottom-4px -right-4px` ✅

## 统一后的视觉规范

### 头像容器

```css
/* 尺寸 */
width: 32px;
height: 32px;
border-radius: 50%;

/* 边框 */
border: 2px solid <color>;
padding: 2px;

/* 过渡动画 */
transition: all 0.2s ease;
```

### 边框颜色

| 用户类型 | 边框颜色 | 悬停效果 |
|---------|---------|---------|
| **未登录** | `--color-text-secondary`（灰色） | 透明度 0.7 → 1.0 + 阴影 |
| **免费用户** | `--md-sys-color-primary`（蓝绿色） | 光晕 + 缩放 1.05 |
| **PRO 用户** | `#fbbf24`（金色） | 金色光晕 + 缩放 1.05 |

### PRO 徽章

```css
/* 位置 */
position: absolute;
right: -4px;
bottom: -4px;

/* 尺寸 */
width: 20px;
height: 20px;
border-radius: 50%;

/* 样式 */
background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
color: #fff;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
```

### 悬停效果

**未登录**：
```css
opacity: 0.7 → 1.0;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
```

**免费用户**：
```css
box-shadow: 0 2px 8px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
transform: scale(1.05);
```

**PRO 用户**：
```css
box-shadow: 0 0 16px color-mix(in srgb, #fbbf24 60%, transparent);
transform: scale(1.05);
```

## 对比截图

### 官网

```
┌─────────────────────────────────────┐
│  [32px 头像]                         │
│  ├─ 边框：蓝绿色（免费）/ 金色（PRO） │
│  └─ 徽章：右下角 20px 皇冠（PRO）    │
└─────────────────────────────────────┘
```

### 插件（改进后）

```
┌─────────────────────────────────────┐
│  [32px 头像]                         │
│  ├─ 边框：蓝绿色（免费）/ 金色（PRO） │
│  └─ 徽章：右下角 20px 皇冠（PRO）    │
└─────────────────────────────────────┘
```

## 实现细节

### 官网实现（Tailwind CSS）

```vue
<button
  :class="[
    'flex items-center justify-center w-10 h-10 rounded-full transition-all',
    isPro 
      ? 'ring-2 ring-yellow-400 hover:ring-yellow-300 hover:shadow-[0_0_16px_rgba(251,191,36,0.6)]' 
      : 'ring-2 ring-primary-400 hover:ring-primary-300 hover:bg-white/5'
  ]"
>
  <div class="user-avatar-wrapper">
    <img v-if="userAvatar" :src="userAvatar" class="user-avatar-image" />
    <div v-else class="user-avatar">{{ userInitial }}</div>
  </div>
  
  <!-- PRO 徽章 -->
  <div v-if="isPro" class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
    <Icon name="lucide:crown" class="w-3 h-3 text-white" />
  </div>
</button>
```

### 插件实现（CSS Variables）

```vue
<div :class="avatarWrapperClasses">
  <Avatar
    :src="avatarUrl"
    :text="avatarInitial"
    :size="32"
    variant="circle"
  />
  
  <!-- PRO 徽章 -->
  <div v-if="isPro" class="user-menu__badge">
    <LucideIcon name="crown" :size="12" />
  </div>
</div>
```

```css
.user-menu__avatar-wrapper {
  position: relative;
  display: inline-flex;
  padding: 2px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

/* 免费用户 */
.user-menu__avatar-wrapper--free {
  border: 2px solid var(--md-sys-color-primary);
}

/* PRO 用户 */
.user-menu__avatar-wrapper--pro {
  border: 2px solid #fbbf24;
  box-shadow: 0 0 12px color-mix(in srgb, #fbbf24 40%, transparent);
}

/* PRO 徽章 */
.user-menu__badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
```

## 颜色变量映射

| 官网（Tailwind） | 插件（CSS Variables） | 颜色值 |
|-----------------|---------------------|--------|
| `ring-primary-400` | `--md-sys-color-primary` | `#83d5c5`（蓝绿色） |
| `ring-yellow-400` | `#fbbf24` | `#fbbf24`（金色） |
| `from-yellow-400 to-yellow-600` | `linear-gradient(135deg, #fbbf24, #f59e0b)` | 金色渐变 |

## 测试清单

### 视觉一致性测试

- [ ] 头像尺寸：官网和插件都是 32px
- [ ] 边框颜色：免费用户都是蓝绿色
- [ ] 边框颜色：PRO 用户都是金色
- [ ] PRO 徽章：位置、尺寸、颜色一致
- [ ] 悬停效果：光晕和缩放效果一致

### 功能测试

- [ ] 未登录：显示灰色图标
- [ ] 免费用户：显示蓝绿色边框
- [ ] PRO 用户：显示金色边框 + 皇冠徽章
- [ ] 悬停：显示下拉菜单（插件）或提示（官网）
- [ ] 点击：跳转登录页（未登录）或显示菜单（已登录）

### 响应式测试

- [ ] 不同屏幕尺寸下头像显示正常
- [ ] 下拉菜单不超出屏幕边界
- [ ] 移动端触摸交互正常

## 相关文件

### 官网
- `website/layouts/default.vue` - 导航栏用户头像
- `website/pages/account.vue` - 账户页面大头像

### 插件
- `frontend/src/components/composite/UserMenu/UserMenu.vue` - 用户菜单组件
- `frontend/src/components/base/Avatar/Avatar.vue` - 头像基础组件

## 后续优化建议

### 1. 提取共享组件

考虑将用户头像逻辑提取为共享组件，减少重复代码：

```typescript
// packages/shared-components/UserAvatar.vue
<template>
  <div :class="avatarClasses">
    <img v-if="src" :src="src" />
    <div v-else>{{ initial }}</div>
    <div v-if="isPro" class="badge">👑</div>
  </div>
</template>
```

### 2. 统一设计 Token

将头像相关的设计 token 添加到 `packages/design-tokens`：

```typescript
export const avatar = {
  size: {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 96
  },
  border: {
    width: 2,
    color: {
      free: '#83d5c5',
      pro: '#fbbf24',
      guest: '#9ca3af'
    }
  },
  badge: {
    size: 20,
    offset: -4
  }
}
```

### 3. 添加动画变体

考虑添加更多动画效果：
- 登录成功：头像从灰色渐变到彩色
- 升级到 PRO：边框从蓝绿色渐变到金色 + 皇冠飞入动画
- 悬停：更流畅的光晕扩散效果

---

**更新时间**：2026-05-09  
**作者**：Kiro AI
