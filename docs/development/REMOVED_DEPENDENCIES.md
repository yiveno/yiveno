# 已移除的依赖

本文档记录在依赖优化过程中移除的依赖包及其原因。

## Frontend 依赖

### 已移除 (2026-05-06)

| 依赖包                                          | 版本                           | 移除原因       | 备注                            |
| ----------------------------------------------- | ------------------------------ | -------------- | ------------------------------- |
| `@atlaskit/pragmatic-drag-and-drop-auto-scroll` | ^2.1.2                         | 未在代码中使用 | 如需自动滚动功能，可重新添加    |
| `onnxruntime-web`                               | 1.26.0-dev.20260416-b7804b056c | 未在代码中使用 | AI 功能相关，如需启用可重新添加 |

### 保留但未使用的依赖

以下依赖虽然当前未使用，但保留用于未来功能：

| 依赖包                            | 版本         | 用途            | 状态   |
| --------------------------------- | ------------ | --------------- | ------ |
| `@acuity-bookmarks/auth-core`     | workspace:\* | 认证核心库      | 计划中 |
| `@acuity-bookmarks/design-tokens` | workspace:\* | 设计系统 tokens | 计划中 |
| `@huggingface/transformers`       | ^4.2.0       | AI 模型推理     | 计划中 |

## 如何重新添加

如果需要重新添加已移除的依赖：

```bash
# 添加到 frontend
cd frontend
bun add <package-name>

# 或在根目录使用 turbo
bun add <package-name> --filter=frontend
```

## 依赖审查建议

建议每季度审查一次依赖使用情况：

1. 运行 `bunx depcheck` 检查未使用的依赖
2. 检查是否有安全漏洞 `bun audit`
3. 更新过时的依赖 `bun update`
4. 清理不再需要的依赖

---

**最后更新**: 2026-05-06  
**审查周期**: 每季度
