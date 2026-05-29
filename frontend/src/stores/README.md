# Stores 目录规范说明

## 设计目标

- 所有 Pinia store 均属于 `presentation` 层，用于 UI 状态与轻量缓存
- 业务流程通过 `application` 服务封装，禁止直接在组件中访问 `core`/`infrastructure`

## 使用规则

1. **引用渠道**：组件仅 import `@/stores/<xxx>` 或 `@/stores/index` 中暴露的 hook
2. **依赖方向**：Store 可调用 `application` 服务，但不得跨层访问 `core` 或 `infrastructure`
3. **命名约定**：导出使用 `useXXXStore` 命名，确保唯一

## 静态检查规划

- 构建 ESLint 规则（或自定义脚本）校验跨层 import，避免 `presentation` 直接依赖 `core`
- 配合 `tsconfig` 中的 `paths` 限制，保障层级清晰

## 后续改进

- 为各 store 补充文档与单测
- 将核心业务方法迁移至 `application`，store 仅负责状态与调用
