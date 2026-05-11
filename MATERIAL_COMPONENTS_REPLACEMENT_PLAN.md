# Material Web Components 替换计划

## 📋 替换策略

### 阶段 1: Settings 页面（优先级最高）✅
**原因**: Settings 页面已经开始使用 Material Web Components，是最佳的试点页面。

### 阶段 2: 其他页面（逐步推进）
- Management 页面
- Popup 页面
- Side Panel 页面
- Onboarding 页面

---

## 🎯 组件替换映射表

### 1. Button 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<button>` 原生按钮 | `<md-filled-button>` | 主要操作按钮 |
| `<button>` 次要按钮 | `<md-outlined-button>` | 次要操作按钮 |
| `<button>` 文本按钮 | `<md-text-button>` | 低优先级操作 |
| `<button>` 图标按钮 | `<md-icon-button>` | 纯图标按钮 |
| `<button>` FAB | `<md-fab>` | 浮动操作按钮 |

**Material Web Components 按钮类型**:
```vue
<!-- Filled Button - 最高优先级 -->
<md-filled-button>保存</md-filled-button>

<!-- Outlined Button - 中等优先级 -->
<md-outlined-button>取消</md-outlined-button>

<!-- Text Button - 低优先级 -->
<md-text-button>了解更多</md-text-button>

<!-- Icon Button - 纯图标 -->
<md-icon-button>
  <md-icon>settings</md-icon>
</md-icon-button>

<!-- FAB - 浮动操作按钮 -->
<md-fab>
  <md-icon slot="icon">add</md-icon>
</md-fab>
```

### 2. Switch/Toggle 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `.toggle-switch` 自定义开关 | `<md-switch>` | 开关设置 |

**Material Web Components Switch**:
```vue
<!-- 基础用法 -->
<md-switch v-model="enabled"></md-switch>

<!-- 带标签 -->
<label>
  <md-switch v-model="enabled"></md-switch>
  启用功能
</label>

<!-- 禁用状态 -->
<md-switch v-model="enabled" :disabled="!isPro"></md-switch>
```

### 3. Input 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<Input>` 自定义输入框 | `<md-filled-text-field>` | 填充样式输入框 |
| `<Input>` 自定义输入框 | `<md-outlined-text-field>` | 轮廓样式输入框 |

**Material Web Components Text Field**:
```vue
<!-- Filled Text Field -->
<md-filled-text-field
  v-model="value"
  label="标签"
  placeholder="请输入..."
></md-filled-text-field>

<!-- Outlined Text Field -->
<md-outlined-text-field
  v-model="value"
  label="标签"
  placeholder="请输入..."
></md-outlined-text-field>

<!-- 带图标 -->
<md-filled-text-field label="搜索">
  <md-icon slot="leading-icon">search</md-icon>
</md-filled-text-field>

<!-- 错误状态 -->
<md-filled-text-field
  label="邮箱"
  :error="hasError"
  error-text="邮箱格式不正确"
></md-filled-text-field>
```

### 4. Select/Dropdown 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<select>` 原生下拉框 | `<md-filled-select>` | 填充样式下拉框 |
| `<select>` 原生下拉框 | `<md-outlined-select>` | 轮廓样式下拉框 |

**Material Web Components Select**:
```vue
<!-- Filled Select -->
<md-filled-select v-model="selected" label="选择语言">
  <md-select-option value="zh-CN">
    <div slot="headline">简体中文</div>
  </md-select-option>
  <md-select-option value="en">
    <div slot="headline">English</div>
  </md-select-option>
</md-filled-select>

<!-- Outlined Select -->
<md-outlined-select v-model="selected" label="选择主题">
  <md-select-option value="light">
    <div slot="headline">浅色</div>
  </md-select-option>
  <md-select-option value="dark">
    <div slot="headline">深色</div>
  </md-select-option>
</md-outlined-select>
```

### 5. Checkbox 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<input type="checkbox">` | `<md-checkbox>` | 复选框 |

**Material Web Components Checkbox**:
```vue
<!-- 基础用法 -->
<md-checkbox v-model="checked"></md-checkbox>

<!-- 带标签 -->
<label>
  <md-checkbox v-model="checked"></md-checkbox>
  同意条款
</label>

<!-- 不确定状态 -->
<md-checkbox :indeterminate="true"></md-checkbox>
```

### 6. Radio 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<input type="radio">` | `<md-radio>` | 单选按钮 |

**Material Web Components Radio**:
```vue
<!-- Radio Group -->
<div>
  <label>
    <md-radio name="theme" value="light" v-model="theme"></md-radio>
    浅色
  </label>
  <label>
    <md-radio name="theme" value="dark" v-model="theme"></md-radio>
    深色
  </label>
</div>
```

### 7. Dialog 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<Dialog>` 自定义对话框 | `<md-dialog>` | 对话框 |

**Material Web Components Dialog**:
```vue
<md-dialog :open="isOpen" @close="handleClose">
  <div slot="headline">标题</div>
  <div slot="content">
    对话框内容
  </div>
  <div slot="actions">
    <md-text-button @click="handleClose">取消</md-text-button>
    <md-filled-button @click="handleConfirm">确认</md-filled-button>
  </div>
</md-dialog>
```

### 8. Chip 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `.badge` 自定义标签 | `<md-filter-chip>` | 可选择的标签 |
| `.tag` 自定义标签 | `<md-assist-chip>` | 辅助标签 |

**Material Web Components Chip**:
```vue
<!-- Filter Chip - 可选择 -->
<md-filter-chip label="标签" :selected="isSelected"></md-filter-chip>

<!-- Assist Chip - 辅助 -->
<md-assist-chip label="帮助">
  <md-icon slot="icon">help</md-icon>
</md-assist-chip>

<!-- Input Chip - 可删除 -->
<md-input-chip label="标签" removable @remove="handleRemove"></md-input-chip>
```

### 9. Progress 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `.progress-bar` 自定义进度条 | `<md-linear-progress>` | 线性进度条 |
| `.spinner` 自定义加载器 | `<md-circular-progress>` | 圆形进度条 |

**Material Web Components Progress**:
```vue
<!-- Linear Progress -->
<md-linear-progress :value="0.5"></md-linear-progress>

<!-- Indeterminate -->
<md-linear-progress indeterminate></md-linear-progress>

<!-- Circular Progress -->
<md-circular-progress :value="0.75"></md-circular-progress>

<!-- Indeterminate -->
<md-circular-progress indeterminate></md-circular-progress>
```

### 10. Slider 组件

| 自定义组件 | Material Web Component | 使用场景 |
|-----------|----------------------|---------|
| `<input type="range">` | `<md-slider>` | 滑块 |

**Material Web Components Slider**:
```vue
<!-- 基础滑块 -->
<md-slider v-model="value" :min="0" :max="100"></md-slider>

<!-- 带标签 -->
<md-slider
  v-model="value"
  :min="0"
  :max="100"
  labeled
></md-slider>

<!-- 范围滑块 -->
<md-slider
  v-model:value-start="start"
  v-model:value-end="end"
  :min="0"
  :max="100"
  range
></md-slider>
```

---

## 📝 替换步骤（Settings 页面）

### Step 1: 替换 GeneralSettings.vue 中的 Toggle Switch

**当前代码**:
```vue
<label class="toggle-switch">
  <input
    v-model="aiAutoEnabled"
    type="checkbox"
    class="toggle-input"
    @change="handleAIAutoToggle"
  />
  <span class="toggle-slider"></span>
</label>
```

**替换为**:
```vue
<md-switch
  :selected="aiAutoEnabled"
  @change="handleAIAutoToggle"
></md-switch>
```

### Step 2: 替换 AISettings.vue 中的组件

- Toggle Switch → `<md-switch>`
- Select → `<md-filled-select>` 或 `<md-outlined-select>`
- Input → `<md-filled-text-field>` 或 `<md-outlined-text-field>`

### Step 3: 替换 NotificationSettings.vue 中的组件

- Toggle Switch → `<md-switch>`
- Checkbox → `<md-checkbox>`

### Step 4: 替换 ShortcutSettings.vue 中的组件

- Input → `<md-filled-text-field>`
- Button → `<md-filled-button>` / `<md-outlined-button>`

---

## ⚠️ 注意事项

### 1. 事件处理差异

**自定义组件**:
```vue
<input v-model="value" @change="handleChange" />
```

**Material Web Components**:
```vue
<!-- Switch -->
<md-switch :selected="value" @change="handleChange"></md-switch>

<!-- Text Field -->
<md-filled-text-field
  :value="value"
  @input="handleInput"
  @change="handleChange"
></md-filled-text-field>
```

### 2. 样式覆盖

Material Web Components 使用 Shadow DOM，样式隔离。如需自定义样式：

```css
/* ❌ 错误：无法穿透 Shadow DOM */
md-filled-button {
  background-color: red;
}

/* ✅ 正确：使用 CSS 变量 */
md-filled-button {
  --md-filled-button-container-color: var(--color-primary);
  --md-filled-button-label-text-color: var(--color-on-primary);
}
```

### 3. 字体继承

Material Web Components 默认使用 Roboto 字体。需要覆盖：

```css
/* 全局覆盖 Material Web Components 字体 */
md-filled-button,
md-outlined-button,
md-text-button,
md-switch,
md-filled-text-field,
md-outlined-text-field {
  --md-sys-typescale-label-large-font: var(--font-family-base);
  --md-sys-typescale-body-large-font: var(--font-family-base);
}
```

### 4. 图标系统

Material Web Components 使用 Material Icons。需要确保图标字体已加载：

```html
<!-- 在 index.html 中添加 -->
<link
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
  rel="stylesheet"
/>
```

或使用 LucideIcon 替代：

```vue
<md-filled-button>
  <!-- ❌ Material Icon -->
  <md-icon>settings</md-icon>
  
  <!-- ✅ Lucide Icon -->
  <LucideIcon name="settings" :size="20" />
</md-filled-button>
```

---

## 🎯 优先级

### 高优先级（立即替换）
1. ✅ Settings 页面的 Button（已完成部分）
2. ⏳ Settings 页面的 Switch
3. ⏳ Settings 页面的 Text Field

### 中优先级（逐步替换）
4. Settings 页面的 Select
5. Settings 页面的 Checkbox
6. Settings 页面的 Dialog

### 低优先级（后续优化）
7. 其他页面的组件替换
8. 自定义组件的完全移除

---

## 📚 参考资源

- [Material Web Components 官方文档](https://material-web.dev/)
- [Material Design 3 设计规范](https://m3.material.io/)
- [Material Web Components GitHub](https://github.com/material-components/material-web)

---

**准备开始替换！** 🚀
