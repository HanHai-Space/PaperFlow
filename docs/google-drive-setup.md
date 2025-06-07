# Google Drive 集成设置指南

本文档介绍如何配置和使用 PDF2MD 应用的 Google Drive 自动上传功能。

## 功能概述

Google Drive 集成功能允许您：
- 自动将处理完成的 ZIP 文件上传到 Google Drive
- 配置特定的 Google Drive 文件夹作为上传目标
- 在本地保存的同时备份到云端

## 前置要求

1. 拥有 Google 账户
2. 访问 Google Cloud Console 的权限
3. 基本的 API 配置知识

## 设置步骤

### 1. 创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 记录项目 ID

### 2. 启用 Google Drive API

1. 在 Google Cloud Console 中，导航到 "APIs & Services" > "Library"
2. 搜索 "Google Drive API"
3. 点击启用

### 3. 创建 OAuth 2.0 凭据

1. 导航到 "APIs & Services" > "Credentials"
2. 点击 "Create Credentials" > "OAuth client ID"
3. 选择应用类型为 "Desktop application"
4. 设置名称（例如：PDF2MD Desktop App）
5. 点击创建
6. 记录 Client ID 和 Client Secret

### 4. 配置应用设置

1. 打开 PDF2MD 应用
2. 进入设置页面
3. 找到 "Google Drive 设置" 部分
4. 启用 "启用 Google Drive 集成"
5. 填入获取的 Client ID 和 Client Secret

### 5. 获取文件夹 ID（可选）

如果您想上传到特定文件夹：

1. 在 Google Drive 中创建或选择目标文件夹
2. 打开该文件夹
3. 从 URL 中复制文件夹 ID
   - URL 格式：`https://drive.google.com/drive/folders/FOLDER_ID`
   - 复制 `FOLDER_ID` 部分
4. 在应用设置中填入文件夹 ID

### 6. 完成认证

1. 在设置页面点击 "开始认证"
2. 系统会打开浏览器窗口
3. 登录您的 Google 账户
4. 授权应用访问 Google Drive
5. 复制授权码
6. 返回应用，粘贴授权码并点击确认

## 使用方法

### 自动上传

1. 确保 Google Drive 集成已启用并认证成功
2. 启用 "自动上传完成的文件" 选项
3. 处理 PDF 文件时，完成的 ZIP 文件会自动上传到 Google Drive

### 手动上传

即使没有启用自动上传，您也可以在处理完成后手动触发上传功能。

## 故障排除

### 认证失败

- 检查 Client ID 和 Client Secret 是否正确
- 确保 Google Drive API 已启用
- 验证授权码是否正确复制

### 上传失败

- 检查网络连接
- 验证 Google Drive 存储空间是否充足
- 确认文件夹 ID 是否正确（如果指定了）

### 权限问题

- 确保 OAuth 应用已获得必要的权限
- 检查 Google 账户是否有 Google Drive 访问权限

## 安全注意事项

1. **保护凭据**：不要分享您的 Client ID 和 Client Secret
2. **定期检查**：定期检查 Google Cloud Console 中的 API 使用情况
3. **权限最小化**：应用只请求必要的 Google Drive 权限

## 支持的文件格式

- ZIP 文件（包含处理结果的压缩包）
- 自动生成的文件名格式：`pdf2md_YYYYMMDD_HHMMSS.zip`

## 限制

- 单个文件大小限制：根据 Google Drive API 限制
- 上传速度：取决于网络连接和文件大小
- API 配额：受 Google Cloud 项目配额限制

## 常见问题

**Q: 可以上传到共享文件夹吗？**
A: 可以，只要您有该文件夹的写入权限，并使用正确的文件夹 ID。

**Q: 上传失败后会重试吗？**
A: 目前不会自动重试，但本地文件仍会保存。您可以手动重新上传。

**Q: 如何撤销应用权限？**
A: 在 Google 账户设置中的"安全性"部分，找到"第三方应用权限"并撤销相关权限。

## 更新日志

- v1.0.0: 初始 Google Drive 集成功能
  - 基本上传功能
  - OAuth 2.0 认证
  - 文件夹指定功能
  - 自动上传选项
