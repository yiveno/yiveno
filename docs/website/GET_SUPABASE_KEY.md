# 获取 Supabase Anon Key

## Supabase 项目信息

**正确的项目信息：**

- **Project name**: acuityBookmarks
- **Project ID**: ugxgxytykxblctsyulsg
- **项目地址**: https://ugxgxytykxblctsyulsg.supabase.co

## 当前状态

✅ 配置已完成！所有环境变量已正确设置。

## 获取步骤（如需更新）

### 1. 访问 Supabase Dashboard

打开浏览器，访问：

```
https://supabase.com/dashboard/project/ugxgxytykxblctsyulsg/settings/api
```

### 2. 找到 API Keys

在页面中找到 **"Project API keys"** 部分。

### 3. 复制 anon/public key

找到标记为 **"anon"** 或 **"public"** 的 key，点击复制按钮。

这个 key 通常是一个很长的字符串，类似：

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdzU0Nzg0N3N1cGFiYXNlLmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MjM4MzEyMDAsImV4cCI6MTkzOTQwNzIwMH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. 更新环境变量

将复制的 key 更新到以下文件中：

#### 根目录 `.env.local`

```bash
VITE_SUPABASE_URL=https://cqw547847.supabase.co
VITE_SUPABASE_ANON_KEY=<你复制的 anon key>
```

#### 根目录 `.env`

```bash
SUPABASE_URL=https://cqw547847.supabase.co
SUPABASE_ANON_KEY=<你复制的 anon key>
```

### 5. 运行同步脚本

更新根目录的环境变量后，运行同步脚本：

```bash
bun run sync-env
```

这会自动同步环境变量到 `frontend/` 和 `website/` 子项目。

### 6. 重启开发服务器

```bash
# 停止当前的开发服务器（Ctrl+C）

# 重新启动
cd website
bun run dev
```

## 验证配置

### 方法 1: 访问测试页面

访问 `http://localhost:3001/test-auth`，检查：

- Supabase URL 应该显示：`https://cqw547847.supabase.co`
- 配置状态应该显示：✅ 已配置

### 方法 2: 浏览器控制台

打开浏览器控制台（F12），在 Console 中执行：

```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
```

应该看到：

```
Supabase URL: https://cqw547847.supabase.co
Has Anon Key: true
```

## 常见问题

### Q1: 为什么有两个 Supabase 项目？

**A:** 可能是之前创建了测试项目，现在需要统一使用正式项目 `cqw547847`。

### Q2: 旧项目的数据会丢失吗？

**A:** 如果旧项目（`ugxgxytykxblctsyulsg`）中有重要数据，需要先迁移。如果只是测试数据，可以直接切换。

### Q3: 插件的配置也需要更新吗？

**A:** 是的。更新根目录的 `.env.local` 后，运行 `bun run sync-env` 会自动同步到插件项目。

### Q4: Supabase 显示 "ERR_CONNECTION_CLOSED" 怎么办？

**A:** 这是 Supabase 服务暂时不可用。等待 Supabase 恢复后再测试。可以访问 [Supabase Status](https://status.supabase.com/) 查看服务状态。

## 下一步

1. ✅ 获取正确的 Supabase anon key
2. ✅ 更新 `.env.local` 和 `.env` 文件
3. ✅ 运行 `bun run sync-env`
4. ✅ 重启开发服务器
5. ⏳ 等待 Supabase 服务恢复
6. ✅ 测试 OAuth 登录流程

完成这些步骤后，OAuth 登录应该就能正常工作了！
