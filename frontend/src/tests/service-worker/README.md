# Service Worker 测试

当前仅保留两类测试：

1. `lifecycle.test.ts`
   说明：基于 Mock 的生命周期/消息通道规则测试
   命令：`bun run test:service-worker`

2. `basic-e2e.test.ts`
   说明：基于真实浏览器与构建产物的 smoke test，只验证扩展能加载、Service Worker 能启动
   命令：`bun run test:service-worker:e2e`

## 运行建议

- `test:service-worker` 属于主测试集
- `test:service-worker:e2e` 属于 smoke，不进入默认 CI 快速路径

## 注意

- 旧文档中的 `termination.test.ts` 与 `test:service-worker:unit` 已不再存在
- 如需更高价值的 Service Worker 测试，应直接覆盖真实 `background` 初始化与 listener 注册逻辑，而不是继续增加示例型测试
