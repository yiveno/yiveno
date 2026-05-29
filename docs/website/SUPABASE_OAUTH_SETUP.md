# Supabase OAuth 配置指南

## 问题说明

官网的 OAuth 登录失败，原因是 Supabase Dashboard 中缺少官网的回调 URL 配置。

当前 Supabase 项目信息：

- **Project name**: acuityBookmarks
- **Project ID**: ugxgxytykxblctsyulsg
- **项目地址**: https://ugxgxytykxblctsyulsg.supabase.co

当前 Supabase 只配置了插件的回调 URL：

- `https://<extension-id>.chromiumapp.org/`

官网需要额外添加以下回调 URL：

- `http://localhost:3001/auth/callback` （开发环境）
- `https://acuitybookmarks.com/auth/callback` （生产环境）

## 配置步骤

### 1. 访问 Supabase Dashboard

打开浏览器，访问：

```
https://supabase.com/dashboard/project/ugxgxytykxblctsyulsg/auth/url-configuration
```

### 2. 找到 "Redirect URLs" 配置区域

在页面中找到 **"Redirect URLs"** 部分。

### 3. 添加官网回调 URL

在 "Redirect URLs" 输入框中，**保留现有的 Chrome Extension URL**，然后添加以下两个 URL：

```
http://localhost:3001/auth/callback
https://acuitybookmarks.com/auth/callback
```

**重要提示：**

- ✅ **保留** 现有的 `https://<extension-id>.chromiumapp.org/` URL（插件需要）
- ✅ **添加** 官网的两个回调 URL
- ✅ 每个 URL 占一行，或用逗号分隔
- ❌ **不要删除** 插件的回调 URL，否则插件的 OAuth 会失效

### 4. 保存配置

点击 **"Save"** 按钮保存配置。

### 5. 验证配置

配置保存后，你应该看到类似这样的 Redirect URLs 列表：

```
https://<extension-id>.chromiumapp.org/
http://localhost:3001/auth/callback
https://acuitybookmarks.com/auth/callback
```

## 测试 OAuth 流程

### 开发环境测试

1. 启动官网开发服务器：

   ```bash
   cd website
   bun run dev
   ```

2. 访问登录页面：

   ```
   http://localhost:3001/login
   ```

3. 点击 "使用 Google 登录" 或 "使用 Microsoft 登录"

4. 预期流程：
   - 跳转到 Google/Microsoft 授权页面
   - 授权后跳转回 `http://localhost:3001/auth/callback`
   - 自动处理 token 并跳转到 `/account` 页面

### 生产环境测试

部署到生产环境后，访问：

```
https://acuitybookmarks.com/login
```

流程与开发环境相同，只是回调 URL 变为生产环境的 URL。

## 常见问题

### Q1: 配置后还是失败？

**A:** 清除浏览器缓存和 Supabase 的 session：

```javascript
// 在浏览器控制台执行
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### Q2: 插件的 OAuth 会受影响吗？

**A:** 不会。Supabase 支持多个回调 URL，插件和官网的 OAuth 流程完全独立。

### Q3: 如何查看当前配置的回调 URL？

**A:** 访问 Supabase Dashboard 的 URL Configuration 页面：

```
https://supabase.com/dashboard/project/cqw547847/auth/url-configuration
```

### Q4: 为什么需要两个回调 URL？

**A:**

- `http://localhost:3001/auth/callback` - 开发环境使用
- `https://acuitybookmarks.com/auth/callback` - 生产环境使用

Supabase 会根据请求的来源自动选择正确的回调 URL。

## 技术细节

### 插件 vs 官网的 OAuth 差异

| 项目 | 回调 URL                                    | 环境             | OAuth 流程                          |
| ---- | ------------------------------------------- | ---------------- | ----------------------------------- |
| 插件 | `https://<extension-id>.chromiumapp.org/`   | Chrome Extension | `chrome.identity.launchWebAuthFlow` |
| 官网 | `http://localhost:3001/auth/callback`       | Web (开发)       | 标准 Web OAuth                      |
| 官网 | `https://acuitybookmarks.com/auth/callback` | Web (生产)       | 标准 Web OAuth                      |

### OAuth 流程对比

**插件流程：**

```
用户点击登录
  ↓
chrome.identity.launchWebAuthFlow
  ↓
Google/Microsoft 授权
  ↓
回调到 https://<extension-id>.chromiumapp.org/
  ↓
提取 token → 设置 session
```

**官网流程：**

```
用户点击登录
  ↓
window.location.href = authUrl
  ↓
Google/Microsoft 授权
  ↓
回调到 http://localhost:3001/auth/callback
  ↓
/auth/callback 页面提取 token → 设置 session
```

## 下一步

配置完成后，请测试以下场景：

1. ✅ 官网开发环境 Google 登录
2. ✅ 官网开发环境 Microsoft 登录
3. ✅ 插件 Google 登录（确保不受影响）
4. ✅ 插件 Microsoft 登录（确保不受影响）

如果所有测试通过，说明配置成功！
