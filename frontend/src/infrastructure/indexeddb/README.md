# IndexedDB Infrastructure Layer

该目录现已承载完整的 IndexedDB 实现，不再依赖任何 legacy 代码。

## 结构说明

- `manager.ts`：提供统一的数据库访问接口，负责初始化、事务封装、CRUD、筛选、统计、设置与元数据等业务方法。
- `connection-pool.ts`：维护单例数据库连接，供事务管理器复用。
- `transaction-manager.ts`：包裹原生事务，提供重试与统一错误处理。
- `validation/`：使用 `zod` 定义各类数据与查询的校验 schema。
- `types/`：导出业务层所需的类型别名。
- `schema.ts`：集中描述数据库配置、对象存储与字段结构。

## 使用约定

- 仅通过 `manager.ts` 暴露的 API 访问 IndexedDB，不得自行操作底层连接。
- 新增的数据结构需先在 `schema.ts` 与 `validation/` 中补充类型与校验。
- 对外暴露的应用/服务层请依赖 `@/infrastructure/indexeddb/manager`，确保 DDD 边界清晰。

## 维护建议

- 修改数据库结构时，务必同步更新 `schema.ts`、`validation/` 以及相关迁移/脚本。
- 大规模变更前建议编写迁移脚本，确保用户数据兼容。
- 按需补充 Vitest 测试覆盖常见 CRUD、筛选和批处理场景。

---

如需进一步拆分仓储层，可在 `manager.ts` 基础上构建 repository 模式，但需保持现有 API 稳定。
