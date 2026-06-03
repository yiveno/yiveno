# Supabase 本地开发指南

## 🚀 快速开始

### 启动本地 Supabase

```bash
supabase start
```

### 停止本地 Supabase

```bash
supabase stop
```

### 重置数据库（清空所有数据）

```bash
supabase db reset
```

---

## 📊 服务地址

### 开发工具

- **Studio (管理界面)**: http://127.0.0.1:54323
  - 可视化管理数据库、查看表、执行 SQL
- **Mailpit (邮件测试)**: http://127.0.0.1:54324
  - 查看本地发送的所有邮件（注册、重置密码等）

- **MCP 服务器**: http://127.0.0.1:54321/mcp
  - Kiro Power 连接地址

### API 端点

- **Project URL**: http://127.0.0.1:54321
- **REST API**: http://127.0.0.1:54321/rest/v1
- **GraphQL**: http://127.0.0.1:54321/graphql/v1

### 数据库

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

## 🔑 认证密钥

本地开发密钥（仅用于本地，不要提交到 Git）：

```bash
# Publishable Key (前端使用)
sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# Secret Key (后端使用)
sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

---

## 🔄 环境切换

### 本地开发

使用 `.env.development.local`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### 生产环境

使用 `.env.local`:

```bash
VITE_SUPABASE_URL=https://ugxgxytykxblctsyulsg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 📝 数据库迁移

### 当前数据库状态

✅ **已同步**：本地数据库已从云端同步（2025-12-12）

**现有表**：

- `subscriptions` - 订阅记录表
- `payment_records` - 支付记录表

### 创建新迁移

```bash
supabase migration new <migration_name>
```

例如：

```bash
supabase migration new create_bookmarks_table
```

### 应用迁移到本地

```bash
supabase db reset
```

### 推送迁移到云端

```bash
supabase db push
```

### 从云端拉取 Schema

注意：如果使用 VPN（如 Clash），需要关闭 TUN 模式。

---

## 🎯 常用命令

```bash
# 查看状态
supabase status

# 查看日志
supabase logs

# 重启服务
supabase stop
supabase start

# 生成 TypeScript 类型
supabase gen types typescript --local > types/supabase.ts
```

---

## 💡 使用技巧

### 1. 数据持久化

本地数据存储在 Docker volumes 中，`supabase stop` 不会删除数据。

### 2. 完全重置

```bash
supabase stop --no-backup
supabase start
```

### 3. 查看 Docker 容器

```bash
docker ps | grep supabase
```

### 4. Studio 管理界面

访问 http://127.0.0.1:54323 可以：

- 查看和编辑表数据
- 执行 SQL 查询
- 管理用户
- 查看 API 日志
- 测试 RLS 策略

---

## 🐛 故障排除

### VPN 连接问题（中国内地用户）

如果使用 Clash 等 VPN 工具，在执行 `supabase db pull/push` 时可能遇到连接超时：

**解决方案**：

1. 临时关闭 Clash 的 **"虚拟网卡模式"**（TUN 模式）
2. 保持 **"系统代理"** 开启（浏览器仍可访问外网）
3. 执行 Supabase 命令
4. 完成后重新开启虚拟网卡模式

**或者**：在 Clash 配置中添加直连规则：

```yaml
rules:
  - DOMAIN-SUFFIX,supabase.co,DIRECT
  - DOMAIN-KEYWORD,supabase,DIRECT
```

### 端口被占用

```bash
# 查看端口占用
lsof -i :54321
lsof -i :54322
lsof -i :54323

# 停止 Supabase
supabase stop
```

### Docker 问题

```bash
# 重启 Docker Desktop
# 然后重新启动 Supabase
supabase start
```

### 数据库连接失败

```bash
# 检查服务状态
supabase status

# 重启服务
supabase stop
supabase start
```

---

## 📚 相关文档

- [Supabase 本地开发文档](https://supabase.com/docs/guides/cli/local-development)
- [Supabase CLI 参考](https://supabase.com/docs/reference/cli)
- [数据库迁移指南](https://supabase.com/docs/guides/cli/local-development#database-migrations)

---

**最后更新**: 2025-12-12
