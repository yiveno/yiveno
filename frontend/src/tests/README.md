# 🧪 测试目录

当前保留的自动化测试只覆盖真实生产模块或必要的环境 smoke。

## 📁 当前结构

```text
tests/
├── setup.ts
├── unit/
│   ├── bookmark-gateway.test.ts
│   ├── bookmark-tree.test.ts
│   ├── chrome-storage-service.test.ts
│   └── query-service.test.ts
├── chrome/
│   └── alarms.test.ts
└── service-worker/
    ├── lifecycle.test.ts
    └── basic-e2e.test.ts
```

另有基础设施测试：

```text
src/infrastructure/indexeddb/__tests__/performance-monitor.test.ts
```

## 🚀 运行方式

```bash
cd frontend
bun run test:run
```

按类别运行：

```bash
bun run test:unit
bun run test:chrome
bun run test:service-worker
```

Service Worker smoke：

```bash
bun run test:smoke
```

## 原则

- 只保留直接覆盖真实生产实现的测试
- 示例型、内联实现型、失效视觉脚本不再计入主测试集
- `bun run test:run` 是 CI 必跑项
