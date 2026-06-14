# Material 覆盖矩阵

本文档记录 frontend 对 Material Design 3 / Material Web 的采用边界。复杂业务控件允许自研，但交互状态、色彩、排版、动效应回落到 Material tokens。

| 能力                     | 当前状态              | 组件/文件                                                    | 优化方向                                                                         |
| ------------------------ | --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Button                   | 已封装 Material Web   | `components/base/Button`                                     | 继续统一所有普通按钮入口，避免页面直接写原生按钮。                               |
| Text Field               | 已封装 Material Web   | `components/base/Input`                                      | 保持 `MdInput` 为输入首选；复杂组合输入优先复用它。                              |
| Dialog                   | 已封装 Material Web   | `components/composite/Dialog`                                | 将常用宽度、最小高度收敛为 size token / enum。                                   |
| Progress                 | 已封装 Material Web   | `components/base/Loading`、同步进度组件                      | 继续使用 `md-circular-progress` / `md-linear-progress`。                         |
| List                     | 部分采用 Material Web | Popup、SidePanel、`BookmarkSearchInput`、`AsyncSearchSelect` | 普通列表优先 `md-list` / `md-list-item`；虚拟树保留自研。                        |
| Menu                     | 部分采用 Material Web | `ThemeToggle`、`UserMenu`                                    | ContextMenu 可评估迁移到 `md-menu`，拖拽/右键定位需先验证。                      |
| Tabs                     | 已封装 Material Web   | `components/base/Tabs`                                       | 新增 `MdTabs` 封装，`v-model` + `@change`。`md-primary-tab` 保持裸用。          |
| Switch                   | 已封装 Material Web   | `components/base/Switch`                                     | 新增 `MdSwitch` 封装，`v-model` + `disabled` + `@change`。                      |
| Slider / Select          | 已采用 Material Web   | Settings                                                     | 保持 Material Web，页面只覆盖必要 token。                                        |
| Chip                     | 部分采用 Material Web | `BookmarkSearchInput`、`AsyncSearchSelect`                   | 快捷筛选、已选标签优先映射到 chip 语义。                                         |
| Card / Surface           | 混合                  | `components/composite/Card`                                  | 保留自研布局，明确 filled / outlined / elevated 与 M3 surface/elevation 的映射。 |
| Tooltip                  | 自研                  | `components/base/Tooltip`                                    | 若 Material tooltip 能满足 rich content，再评估迁移；当前保留。                  |
| BookmarkTree / 虚拟树    | 自研                  | `components/business/BookmarkTree`                           | 保留自研，重点对齐 focus、state layer、密度、可访问性。                          |
| AsyncSearchSelect        | 已完成                | `components/base/AsyncSearchSelect`                          | 多选使用 chip-in-input + Material list。                                         |

## 规则

- 页面新增表单、按钮、列表、菜单、tabs 时，优先使用已封装 Material 组件。
- 自研组件必须使用 `--md-sys-*` 或项目语义 token，不新增孤立颜色/阴影/动效。
- 可点击非原生元素必须补齐 `role`、`tabindex`、Enter/Space 键盘触发。
- 产品文案统一使用 Filter / 筛选；除技术类命名外，UI 不出现 Search。
