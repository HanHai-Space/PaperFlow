# Google Drive 文件夹自动创建功能

## 问题解决

根据您的错误信息：
```
Error: File not found: pdf2md.
```

这个错误表明您在Google Drive设置中指定了文件夹ID "pdf2md"，但这个文件夹在Google Drive中不存在。

## 实施的解决方案

我已经添加了智能文件夹处理功能，现在系统会：

### 1. 自动检查文件夹是否存在
- 首先尝试将输入作为文件夹ID查找
- 如果ID查找失败，尝试作为文件夹名称搜索
- 支持文件夹ID和文件夹名称两种输入方式

### 2. 自动创建不存在的文件夹
- 如果指定的文件夹不存在，自动创建新文件夹
- 使用您指定的名称作为文件夹名称
- 创建成功后返回新文件夹的ID

### 3. 智能降级处理
- 如果文件夹操作失败，文件将上传到Google Drive根目录
- 确保上传不会因为文件夹问题而完全失败

## 工作流程

```
输入文件夹ID/名称 "pdf2md"
        ↓
检查是否存在ID为"pdf2md"的文件夹
        ↓
如果不存在，搜索名称为"pdf2md"的文件夹
        ↓
如果仍不存在，创建名称为"pdf2md"的新文件夹
        ↓
使用找到或创建的文件夹ID上传文件
```

## 预期的控制台日志

### 场景1: 文件夹不存在，需要创建
```
Starting Google Drive upload: {fileName: "test_upload_...", fileSize: 45, folderId: "pdf2md", ...}
Folder ID pdf2md not found, searching by name...
Creating new folder: pdf2md
Created new folder: pdf2md (1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x)
File metadata: {name: "test_upload_...", parents: ["1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x"]}
Using simple upload method...
File metadata created: {id: "1abc...", name: "test_upload_..."}
Upload completed successfully: {...}
```

### 场景2: 文件夹已存在
```
Starting Google Drive upload: {fileName: "test_upload_...", fileSize: 45, folderId: "pdf2md", ...}
Found existing folder by name: pdf2md (1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x)
File metadata: {name: "test_upload_...", parents: ["1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x"]}
Using simple upload method...
File metadata created: {id: "1abc...", name: "test_upload_..."}
Upload completed successfully: {...}
```

### 场景3: 使用真实的文件夹ID
```
Starting Google Drive upload: {fileName: "test_upload_...", fileSize: 45, folderId: "1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x", ...}
Folder exists: pdf2md (1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x)
File metadata: {name: "test_upload_...", parents: ["1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x"]}
Using simple upload method...
File metadata created: {id: "1abc...", name: "test_upload_..."}
Upload completed successfully: {...}
```

## 配置建议

### 推荐的文件夹ID设置

1. **使用文件夹名称**（推荐）
   ```
   文件夹ID: pdf2md
   ```
   - 简单易记
   - 如果不存在会自动创建
   - 适合大多数用户

2. **使用真实的Google Drive文件夹ID**
   ```
   文件夹ID: 1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x
   ```
   - 最精确的方式
   - 需要从Google Drive URL中获取
   - 适合高级用户

3. **留空**
   ```
   文件夹ID: (空白)
   ```
   - 文件将上传到Google Drive根目录
   - 最简单的配置

## 获取Google Drive文件夹ID的方法

如果您想使用真实的文件夹ID：

1. 在Google Drive中打开目标文件夹
2. 查看浏览器地址栏的URL
3. URL格式：`https://drive.google.com/drive/folders/1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x`
4. 复制最后的ID部分：`1BcD3fG4hI5jK6lM7nO8pQ9rS0tU1vW2x`

## 测试步骤

1. **刷新浏览器页面**以加载新代码
2. **打开开发者工具**（F12）
3. **进入设置页面**
4. **确认文件夹ID设置**（可以保持"pdf2md"）
5. **点击"测试上传"按钮**
6. **观察控制台日志**，应该看到文件夹创建过程

## 优势

- **用户友好**: 不需要手动创建文件夹
- **智能处理**: 支持文件夹名称和ID两种输入
- **容错性强**: 即使文件夹操作失败，文件仍能上传
- **自动化**: 一次配置，永久使用

现在您可以重新测试Google Drive上传功能。系统会自动处理文件夹的创建和管理！
