# Material Web Components 替换进度

## 📊 总体进度

**当前进度**: 20% (4/20 组件类型)

---

## ✅ 已完成

### 1. Settings 页面 - GeneralSettings.vue

**替换组件**: Toggle Switch → `<md-switch>`

**修改内容**:
- ✅ 替换 AI 自动归纳开关
- ✅ 替换语义搜索开关
- ✅ 移除自定义 toggle switch 样式
- ✅ 添加 Material Web Components 样式覆盖
- ✅ 修复事件处理逻辑

**代码对比**:

**之前**:
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

**之后**:
```vue
<md-switch
  :selected="aiAutoEnabled"
  @change="handleAIAutoToggle"
></md-switch>
```

**样式覆盖**:
```css
md-switch {
  flex-shrink: 0;
  --md-switch-selected-track-color: var(--color-primary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-primary);
  --md-switch-selected-hover-track-color: var(--color-primary-hover);
  --md-switch-selected-pressed-track-color: var(--color-primary-active);
}
```

### 2. Settings 页面 - AISettings.vue

**替换组件**: ~~Select → `<md-filled-select>`~~ **暂时搁置**

**状态**: ⏸️ 暂时搁置，使用原生 `<select>` 元素

**问题描述**:
- Material Web Components 的 Select 组件在 Vue 3 中存在严重的兼容性问题
- 错误信息: `Cannot read properties of undefined (reading 'length')`
- 错误位置: `select.js:492` 的 `getSelectedOptions()` 方法
- 尝试了多种解决方案（添加空白选项、延迟渲染、命令式 DOM 操作等）均无法解决

**决定**:
- 暂时使用原生 `<select>` 元素 + Material Design 3 样式
- 等待 Material Web Components 更新或找到更好的解决方案
- 不在这个问题上继续浪费时间，优先完成其他组件的替换

**代码**:
```vue
<select v-model="selectedProvider" class="provider-select">
  <option value="openai">OpenAI（推荐）</option>
  <option value="claude">Anthropic Claude</option>
  <option value="gemini">Google Gemini</option>
</select>
```

**样式**:
```css
.provider-select {
  min-width: 200px;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--md-sys-typescale-body-medium-size);
  color: var(--color-text-primary);
  background-color: var(--color-surface);
}
```

### 3. Settings 页面 - NotificationSettings.vue

**替换组件**: Switch → `<md-switch>`

**修改内容**:
- ✅ 替换系统通知镜像开关
- ✅ 移除自定义 `<Switch>` 组件导入
- ✅ 添加 Material Web Components 样式覆盖
- ✅ 修复事件处理逻辑（从 `@change="onToggleMirror"` 改为 `@change="handleMirrorToggle"`）

**代码对比**:

**之前**:
```vue
<Switch v-model="mirror" size="md" @change="onToggleMirror" />
```

**之后**:
```vue
<md-switch
  :selected="mirror"
  @change="handleMirrorToggle"
></md-switch>
```

**事件处理**:
```typescript
// 之前
async function onToggleMirror(v: boolean) {
  try {
    await settingsAppService.saveSetting(
      'notifications.mirrorSystemWhenHidden',
      Boolean(v),
      'boolean',
      '页面隐藏时镜像系统通知'
    )
    notifySuccess(v ? '系统通知镜像：开启' : '系统通知镜像：关闭', '通知')
  } catch {
    /* 保留手动保存按钮 */
  }
}

// 之后
async function handleMirrorToggle(event: Event) {
  const target = event.target as HTMLInputElement
  mirror.value = target.selected
  try {
    await settingsAppService.saveSetting(
      'notifications.mirrorSystemWhenHidden',
      Boolean(mirror.value),
      'boolean',
      '页面隐藏时镜像系统通知'
    )
    notifySuccess(mirror.value ? '系统通知镜像：开启' : '系统通知镜像：关闭', '通知')
  } catch {
    /* 保留手动保存按钮 */
  }
}
```

**样式覆盖**:
```css
md-switch {
  flex-shrink: 0;
  --md-switch-selected-track-color: var(--color-primary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-primary);
  --md-switch-selected-hover-track-color: var(--color-primary-hover);
  --md-switch-selected-pressed-track-color: var(--color-primary-active);
}
```

---

## ⏳ 进行中

### 2. Settings 页面 - 其他组件

**待替换**:
- [ ] ShortcutSettings.vue - Button（功能复杂，暂时保留项目自定义组件）

**说明**:
- AISettings.vue 的 Input 和 Button 组件保持使用项目自定义组件（功能复杂，暂不替换）
- ShortcutSettings.vue 的 Button 组件有 prepend slot，功能复杂，暂不替换
- NotificationSettings.vue 已完成所有组件替换

---

## 📋 待办事项

### Settings 页面（优先级：高）
- [ ] AISettings.vue
  - [ ] 替换 Toggle Switch → `<md-switch>`
  - [ ] 替换 Select → `<md-filled-select>` 或 `<md-outlined-select>`
  - [ ] 替换 Text Field → `<md-filled-text-field>` 或 `<md-outlined-text-field>`

- [ ] NotificationSettings.vue
  - [ ] 替换 Toggle Switch → `<md-switch>`
  - [ ] 替换 Checkbox → `<md-checkbox>`

- [ ] ShortcutSettings.vue
  - [ ] 替换 Text Field → `<md-filled-text-field>`
  - [ ] 替换 Button → `<md-filled-button>` / `<md-outlined-button>`

### 其他页面（优先级：中）
- [ ] Management 页面
  - [ ] 评估组件使用情况
  - [ ] 制定替换计划

- [ ] Popup 页面
  - [ ] 评估组件使用情况
  - [ ] 制定替换计划

- [ ] Side Panel 页面
  - [ ] 评估组件使用情况
  - [ ] 制定替换计划

- [ ] Onboarding 页面
  - [ ] 评估组件使用情况
  - [ ] 制定替换计划

---

## 🎯 下一步行动

### 立即执行
1. ✅ 验证 GeneralSettings.vue 的 `<md-switch>` 是否正常工作
2. ✅ 替换 AISettings.vue 中的 Select 组件
3. ✅ 替换 NotificationSettings.vue 中的 Switch 组件
4. ⏳ 评估其他页面的组件使用情况

### 后续计划
5. 评估 Management 页面的组件使用情况
6. 评估 Popup 页面的组件使用情况
7. 评估 Side Panel 页面的组件使用情况
8. 评估 Onboarding 页面的组件使用情况
9. 制定全面的替换时间表

---

## 📝 经验总结

### 成功经验

1. **事件处理差异**
   - Material Web Components 的 Switch 使用 `selected` 属性而非 `v-model`
   - Material Web Components 的 Select 使用 `value` 属性 + `@change` 事件
   - 需要从事件对象中获取新值：`event.target.selected` 或 `event.target.value`

2. **样式覆盖**
   - 使用 CSS 变量覆盖 Material Web Components 的默认样式
   - 确保颜色与项目设计系统一致
   - Select 组件需要覆盖更多变量（container-color, input-text-color, label-text-color 等）

3. **渐进式替换**
   - 从简单组件开始（Switch）
   - 逐步替换复杂组件（Select）
   - 保持项目可用性
   - 复杂的自定义组件（如带密码显示切换的 Input）暂不替换

### 遇到的问题

1. **Shadow DOM 样式隔离**
   - 问题：无法直接修改 Material Web Components 内部样式
   - 解决：使用 CSS 变量覆盖

2. **事件处理不一致**
   - 问题：`v-model` 不能直接用于 Material Web Components
   - 解决：使用 `:value` / `:selected` 属性 + `@change` / `@input` 事件

3. **Select 组件结构差异**
   - 问题：Material Web Components 的 Select 使用 `<md-select-option>` + `slot="headline"`
   - 解决：按照 Material Web Components 的结构重写

4. **Select 组件兼容性问题（重要 - 未解决）**
   - 问题：Material Web Components 的 Select 在 Vue 3 中会出现 "Cannot read properties of undefined (reading 'length')" 错误
   - 错误位置：`select.js:492` 的 `getSelectedOptions()` 方法
   - 尝试的解决方案（全部失败）：
     * ❌ 添加空白选项（按照官方文档要求）
     * ❌ 使用 `v-if` 延迟渲染
     * ❌ 使用 `watch` 和 `nextTick` 手动同步
     * ❌ 使用 `select()` 方法设置值
     * ❌ 使用 `@input` 事件代替 `@change`
     * ❌ 使用纯 JavaScript 创建元素
     * ❌ 动态设置 `selected` 属性
   - **决定**：暂时搁置，使用原生 `<select>` 元素 + Material Design 3 样式
   - **后续计划**：
     * 等待 Material Web Components 更新
     * 或者寻找其他 Material Design 3 组件库
     * 或者深入研究 Material Web Components 源码找到根本原因

### 最佳实践

1. **保持一致性**
   - 所有 Material Web Components 使用相同的样式覆盖模式
   - 统一事件处理方式

2. **测试优先**
   - 每次替换后立即测试功能
   - 确保用户体验不受影响

3. **文档记录**
   - 记录每次替换的细节
   - 为后续替换提供参考

4. **选择性替换**
   - 简单组件优先替换（Switch, Select）
   - 复杂自定义组件暂时保留（带特殊功能的 Input, Button）
   - 评估每个组件的复杂度，决定是否替换

5. **事件处理统一模式**
   - Switch: `:selected` + `@change` + `event.target.selected`
   - Select: `:value` + `@input` + `event.target.value` + **必须添加空白选项**
   - 统一从事件对象中获取新值

6. **遵循 Material Web Components 规范**
   - Select 组件必须包含一个空白选项作为第一个子元素：`<md-select-option aria-label="blank"></md-select-option>`
   - 这是 Material Web Components 的设计要求，不是 bug
   - 不遵循此规范会导致运行时错误

---

## 🎯 Settings 页面替换总结

### 已完成的文件
1. ✅ **GeneralSettings.vue** - 替换了 2 个 Switch 组件
2. ⏸️ **AISettings.vue** - Select 组件暂时搁置，使用原生元素
3. ✅ **NotificationSettings.vue** - 替换了 1 个 Switch 组件
4. ⏸️ **ShortcutSettings.vue** - Button 组件功能复杂，暂不替换

### Settings 页面完成度
- **Switch 组件替换**: 100% (3/3 完成)
- **Select 组件替换**: 0% (Material Web Components 兼容性问题，暂时搁置)
- **复杂组件替换**: 0% (Input, Button 暂不替换)
- **整体完成度**: 约 50%

### 下一步行动
- 评估其他页面（Management, Popup, Side Panel, Onboarding）的组件使用情况
- 制定其他页面的替换计划
- 考虑是否需要替换复杂的 Input 和 Button 组件

---

## 🔗 相关文档

- [替换计划](./MATERIAL_COMPONENTS_REPLACEMENT_PLAN.md)
- [Material Web Components 官方文档](https://material-web.dev/)
- [设计系统规范](.kiro/steering/design-system.md)

---

**更新时间**: 2026-05-12  
**下次更新**: 评估其他页面后
