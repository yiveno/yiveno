# Cursor Hooks（Yiveno 项目级）

> **配置：** [`.cursor/hooks.json`](../hooks.json)  
> **Agent 开机上下文：** 以 [`.cursor/rules/session-boot.mdc`](../rules/session-boot.mdc)（`alwaysApply`）为准，**不依赖** hook 注入。

| Hook                   | 脚本                       | 作用                                                          |
| ---------------------- | -------------------------- | ------------------------------------------------------------- |
| `beforeShellExecution` | `block_destructive_git.py` | 拦截 `checkout --` / `restore` / `reset --hard` / `clean -fd` |

`session_start_context.py` 保留作备用，**已从 hooks.json 移除**（避免与 session-boot 重复占上下文）。

修改后保存 `hooks.json`；未生效时重载 Cursor 窗口。
