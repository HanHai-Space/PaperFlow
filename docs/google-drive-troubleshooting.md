# Google Drive 上传故障排除指南

如果您发现Google Drive自动上传功能没有正常工作，请按照以下步骤进行排查：

## 1. 检查基本配置

### 确认设置已启用
1. 进入应用设置页面
2. 找到"Google Drive 设置"部分
3. 确认以下选项已启用：
   - ✅ "启用 Google Drive 集成"
   - ✅ "自动上传完成的文件"

### 确认认证状态
1. 在Google Drive设置区域查看认证状态
2. 状态应显示为"已认证"（绿色）
3. 如果显示"未认证"，请重新进行认证流程

## 2. 使用测试上传功能

### 执行测试上传
1. 在Google Drive设置区域，点击"测试上传"按钮
2. 观察是否出现成功或失败的提示
3. 检查浏览器控制台是否有错误信息

### 查看控制台日志
1. 按F12打开浏览器开发者工具
2. 切换到"Console"标签页
3. 点击"测试上传"按钮
4. 查看控制台输出的详细日志信息

## 3. 检查API配置

### 验证Client ID和Client Secret
1. 确认Client ID和Client Secret正确无误
2. 检查是否有多余的空格或特殊字符
3. 确认这些凭据来自正确的Google Cloud项目

### 验证API权限
1. 登录Google Cloud Console
2. 确认Google Drive API已启用
3. 检查OAuth同意屏幕配置
4. 确认应用状态不是"需要验证"

## 4. 检查文件处理流程

### 确认自动保存已启用
1. 在设置页面检查"文件保存设置"
2. 确认"自动保存完成的文件"已启用
3. 确认保存位置路径正确

### 检查处理日志
1. 处理PDF文件时，观察日志输出
2. 查找以下关键信息：
   - "ZIP 文件已成功保存到: ..."
   - "开始上传到 Google Drive..."
   - "文件已成功上传到 Google Drive: ..."

## 5. 常见问题及解决方案

### 问题1: 认证失败
**症状**: 点击"开始认证"后无法完成认证
**解决方案**:
- 检查网络连接
- 确认Client ID和Client Secret正确
- 清除浏览器缓存和Cookie
- 尝试使用无痕模式

### 问题2: 上传失败 - "Not authenticated"
**症状**: 测试上传显示"Google Drive not authenticated"
**解决方案**:
- 重新进行认证流程
- 检查访问令牌是否过期
- 清除本地存储的认证信息并重新认证

### 问题3: 上传失败 - "Upload failed"
**症状**: 文件上传到Google Drive时失败
**解决方案**:
- 检查Google Drive存储空间是否充足
- 验证文件夹ID是否正确（如果指定了）
- 检查网络连接稳定性
- 确认Google Drive API配额未超限

### 问题4: 没有上传日志
**症状**: 处理完成后没有看到Google Drive相关日志
**解决方案**:
- 确认"自动上传到 Google Drive"选项已启用
- 检查是否有成功处理的文件
- 确认Google Drive集成已正确配置

## 6. 调试步骤

### 步骤1: 检查设置对象
在浏览器控制台中执行：
```javascript
console.log('Settings:', JSON.parse(localStorage.getItem('pdf-processor-settings')));
```

### 步骤2: 检查认证令牌
在浏览器控制台中执行：
```javascript
console.log('Google Drive Tokens:', localStorage.getItem('googleDriveTokens'));
```

### 步骤3: 手动测试API调用
使用设置页面的"测试上传"功能，观察控制台输出

## 7. 获取详细日志

### 启用详细日志
1. 打开浏览器开发者工具
2. 在Console中设置日志级别为"Verbose"
3. 重新执行文件处理或测试上传
4. 复制所有相关日志信息

### 日志信息包含内容
- Google Drive配置信息
- 认证状态
- 文件上传请求和响应
- 错误详情

## 8. 联系支持

如果以上步骤都无法解决问题，请提供以下信息：

1. **错误描述**: 详细描述遇到的问题
2. **操作步骤**: 重现问题的具体步骤
3. **控制台日志**: 浏览器控制台的完整错误信息
4. **配置信息**: Google Drive设置（隐藏敏感信息）
5. **环境信息**: 浏览器版本、操作系统等

## 9. 预防措施

### 定期检查
- 定期测试Google Drive上传功能
- 监控Google Cloud Console中的API使用情况
- 检查Google Drive存储空间

### 备份策略
- 即使启用了Google Drive上传，本地文件仍会保存
- 定期备份重要的处理结果
- 考虑使用多种云存储服务

### 安全建议
- 定期更新API凭据
- 监控异常的API调用
- 及时撤销不需要的访问权限
