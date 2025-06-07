# Google Drive 自动令牌刷新功能

## 问题解决

根据您的错误信息：
```
Error: 401 Unauthorized - Invalid Credentials
```

这个错误表明Google Drive的访问令牌已经过期。OAuth 2.0访问令牌通常有较短的有效期（通常1小时），需要使用刷新令牌来获取新的访问令牌。

## 实施的解决方案

我已经添加了完整的自动令牌刷新机制，现在系统具有以下功能：

### 1. 自动令牌刷新
- 当收到401错误时，自动尝试刷新访问令牌
- 使用存储的刷新令牌获取新的访问令牌
- 自动保存新令牌到本地存储

### 2. 智能API请求处理
- 所有Google Drive API请求都通过统一的认证方法
- 自动添加Authorization头
- 401错误时自动重试

### 3. 无缝用户体验
- 用户无需手动重新认证
- 令牌刷新在后台自动进行
- 失败的请求会自动重试

## 工作流程

```
API请求 → 收到401错误 → 使用刷新令牌获取新访问令牌 → 保存新令牌 → 重试原始请求
```

## 预期的控制台日志

### 成功的令牌刷新：
```
Starting Google Drive upload: {fileName: "test_upload_...", fileSize: 45, ...}
Folder ID pdf2md not found, searching by name...
Received 401, attempting to refresh token...
Access token refreshed successfully
Creating new folder: pdf2md
Created new folder: pdf2md (1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x)
File metadata: {name: "test_upload_...", parents: ["1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x"]}
Using simple upload method...
File metadata created: {id: "1abc...", name: "test_upload_..."}
Upload completed successfully: {...}
```

### 令牌刷新失败（需要重新认证）：
```
Starting Google Drive upload: {fileName: "test_upload_...", fileSize: 45, ...}
Received 401, attempting to refresh token...
No refresh token available
或
Token refresh failed: {"error": "invalid_grant"}
```

## 令牌管理机制

### 访问令牌（Access Token）
- **有效期**: 通常1小时
- **用途**: 实际的API调用
- **自动刷新**: 是

### 刷新令牌（Refresh Token）
- **有效期**: 长期有效（除非被撤销）
- **用途**: 获取新的访问令牌
- **存储**: 本地localStorage

### 令牌存储格式
```json
{
  "access_token": "ya29.a0AfH6SMC...",
  "refresh_token": "1//04...",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

## 常见情况处理

### 情况1: 访问令牌过期（正常情况）
- **现象**: 收到401错误
- **处理**: 自动刷新令牌并重试
- **用户体验**: 无感知，操作继续进行

### 情况2: 刷新令牌无效或过期
- **现象**: 令牌刷新失败
- **处理**: 需要重新进行OAuth认证
- **用户体验**: 需要重新点击"开始认证"

### 情况3: 网络问题
- **现象**: 请求超时或网络错误
- **处理**: 显示具体错误信息
- **用户体验**: 可以重试操作

## 故障排除

### 如果看到"No refresh token available"
1. 刷新令牌可能丢失或损坏
2. 在设置页面点击"断开连接"
3. 重新进行OAuth认证流程

### 如果看到"Token refresh failed: invalid_grant"
1. 刷新令牌已被撤销或过期
2. 可能的原因：
   - 用户更改了Google账户密码
   - 用户在Google账户中撤销了应用权限
   - 刷新令牌超过6个月未使用
3. 解决方案：重新认证

### 如果令牌刷新成功但仍然收到401错误
1. 可能是Google Drive API权限问题
2. 检查Google Cloud Console中的API权限设置
3. 确认OAuth应用的权限范围包含Google Drive

## 安全考虑

### 令牌安全
- 令牌存储在浏览器的localStorage中
- 仅在HTTPS环境下安全
- 定期自动更新减少令牌泄露风险

### 权限管理
- 应用只请求必要的Google Drive权限
- 用户可以随时在Google账户中撤销权限
- 支持细粒度的文件夹权限控制

## 测试步骤

1. **刷新浏览器页面**以加载新代码
2. **打开开发者工具**（F12）
3. **进入设置页面**
4. **点击"测试上传"按钮**
5. **观察控制台日志**

如果之前的访问令牌已过期，您应该看到自动刷新的过程。如果刷新令牌也无效，系统会提示需要重新认证。

## 优势

- **自动化**: 无需手动处理令牌过期
- **用户友好**: 大多数情况下用户无感知
- **可靠性**: 自动重试机制提高成功率
- **安全性**: 定期更新令牌减少安全风险

现在Google Drive集成应该能够自动处理令牌过期问题，提供更稳定的用户体验！
