// 国际化配置
export type Language = 'zh' | 'en';

export interface Translations {
  // 应用标题
  appTitle: string;
  appSubtitle: string;

  // 导航
  fileProcessing: string;
  systemSettings: string;

  // 文件处理
  fileUpload: string;
  fileUploadMultiple: string;
  dragDropFiles: string;
  browseFiles: string;
  startProcessing: string;
  processingRecords: string;
  downloadResults: string;
  clearFiles: string;

  // 翻译设置
  translationSettings: string;
  translationModel: string;
  targetLanguage: string;
  noTranslation: string;
  customLanguage: string;

  // 设置页面
  apiKeySettings: string;
  mistralApiKey: string;
  translationApiKey: string;
  addApiKey: string;
  removeApiKey: string;

  // 文件保存设置
  fileSaveSettings: string;
  saveLocation: string;
  browse: string;
  reset: string;
  autoSaveCompleted: string;
  autoSaveDescription: string;
  enableProcessingRecord: string;
  enableProcessingRecordDescription: string;

  // Google Drive 设置
  googleDriveSettings: string;
  enableGoogleDrive: string;
  googleDriveClientId: string;
  googleDriveClientSecret: string;
  googleDriveFolderId: string;
  googleDriveAutoUpload: string;

  // 高级设置
  advancedSettings: string;
  fileConcurrency: string;
  translationConcurrency: string;
  maxTokensPerChunk: string;
  skipProcessedFiles: string;

  // 自定义模型
  customModel: string;
  apiEndpoint: string;
  modelId: string;
  requestFormat: string;
  temperature: string;
  maxTokens: string;

  // 处理状态
  pending: string;
  processing: string;
  completed: string;
  failed: string;
  paused: string;
  ready: string;

  // 按钮和操作
  save: string;
  cancel: string;
  delete: string;
  continue: string;
  pause: string;
  resume: string;
  close: string;

  // 消息
  processingComplete: string;
  processingFailed: string;
  filesSaved: string;
  noFilesSelected: string;

  // 窗口控制
  minimize: string;
  maximize: string;
  restore: string;
  closeWindow: string;

  // 主题
  lightTheme: string;
  darkTheme: string;

  // 语言
  chinese: string;
  english: string;

  // 版权信息
  basedOnPaperBurner: string;

  // 处理会话管理
  sessionManagement: string;
  noSessionRecords: string;
  createdAt: string;
  updatedAt: string;
  continueProcessing: string;
  overallProgress: string;
  totalFiles: string;
  completedFiles: string;
  failedFiles: string;
  downloadRecognition: string;
  downloadTranslation: string;
  confirmDelete: string;
  deleteSessionConfirm: string;
  unknown: string;

  // 菜单栏
  file: string;
  edit: string;
  view: string;
  help: string;
  settings: string;
  exit: string;
  about: string;
  language: string;
  currentPage: string;

  // 设置页面详细翻译
  settingsPage: {
    // 导航
    backToHome: string;

    // API密钥部分
    enterMistralKey: string;
    enterTranslationKey: string;
    noMistralKeys: string;
    noTranslationKeys: string;
    translationApiKeysOptional: string;

    // 翻译设置
    customTargetLanguageName: string;
    customTargetLanguagePlaceholder: string;

    // 文件保存设置
    defaultPath: string;
    autoSaveCompletedFiles: string;
    autoSaveDescription: string;
    enableProcessingRecords: string;
    enableProcessingRecordsDescription: string;

    // 测试功能
    testFeatures: string;
    testZipSave: string;
    testUpload: string;
    disconnect: string;
    authenticated: string;
    authenticationStatus: string;
    pending: string;
    unauthenticated: string;
    startAuth: string;
    confirm: string;
    desktopVersion: string;
    browserVersion: string;
    detection: string;
    enterAuthCode: string;
    authInstructions: string;
    authCodeRequired: string;
    authSuccess: string;
    authFailed: string;
    authError: string;

    // EPUB转换设置
    epubConversionSettings: string;
    convertRecognitionToEpub: string;
    convertRecognitionToEpubDescription: string;
    convertTranslationToEpub: string;
    convertTranslationToEpubDescription: string;
    pandocPath: string;
    pandocPathDescription: string;
    pandocParameters: string;
    pandocParametersDescription: string;
    testPandoc: string;
    usageInstructions: string;
    checking: string;
    available: string;
    unavailable: string;
    pandocInstalled: string;
    usageInstructionsList: string[];

    // Google Drive 设置
    googleDriveSettings: string;
    enableGoogleDrive: string;
    enableGoogleDriveDescription: string;
    googleDriveClientId: string;
    googleDriveClientIdPlaceholder: string;
    googleDriveClientSecret: string;
    googleDriveClientSecretPlaceholder: string;
    googleDriveFolderId: string;
    googleDriveFolderIdPlaceholder: string;
    googleDriveFolderIdDescription: string;
    googleDriveAutoUpload: string;
    googleDriveAutoUploadDescription: string;

    // 高级设置
    fileProcessingConcurrency: string;
    translationTaskConcurrency: string;
    maxTokensPerTranslationChunk: string;
    skipProcessedFiles: string;

    // 自定义提示词
    customPrompts: string;
    useCustomPrompts: string;
    useCustomPromptsDescription: string;
    systemPrompt: string;
    systemPromptPlaceholder: string;
    systemPromptDescription: string;
    userPromptTemplate: string;
    userPromptTemplatePlaceholder: string;
    userPromptTemplateDescription: string;
    promptTips: string;
    promptTipsList: string[];

    // 自定义模型
    customModelSettings: string;

    // 通用
    optional: string;
    example: string;
    tip: string;
    defaultValue: string;

    // 自定义模型格式
    openaiFormat: string;
    anthropicFormat: string;
    geminiFormat: string;

    // 描述文本
    temperatureDescription: string;
    maxTokensDescription: string;
  };

  // 日志消息 - 处理状态
  logs: {
    // 批量处理
    batchProcessingStart: string;
    batchProcessingComplete: string;
    batchProgress: string;

    // 文件处理
    fileProcessingStart: string;
    fileProcessingComplete: string;
    fileProcessingFailed: string;
    fileInfo: string;

    // 上传和OCR
    uploadingToMistral: string;
    uploadSuccess: string;
    gettingSignedUrl: string;
    signedUrlSuccess: string;
    startingOcr: string;
    ocrComplete: string;
    processingOcrResults: string;
    markdownGenerated: string;

    // 翻译
    translationCheck: string;
    preparingTranslation: string;
    translating: string;
    translationComplete: string;
    skipTranslation: string;
    documentSegmentation: string;
    translationProgress: string;
    translationPartStart: string;
    translationPartComplete: string;
    translationQueue: string;

    // 状态变更
    statusChange: string;
    pending: string;
    processing: string;
    completed: string;
    failed: string;

    // 保存和备份
    savingFiles: string;
    saveSuccess: string;
    saveFailure: string;
    backupCreated: string;
    cleanup: string;

    // ZIP操作
    zipCreating: string;
    zipCreated: string;
    zipFailed: string;
    zipSaved: string;

    // 错误和警告
    error: string;
    warning: string;
    retry: string;

    // 性能统计
    performanceStats: string;
    duration: string;

    // 通用
    success: string;
    failure: string;
    filesProcessed: string;
    totalTime: string;
  };
}

export const translations: Record<Language, Translations> = {
  zh: {
    // 应用标题
    appTitle: 'Paper Burner',
    appSubtitle: 'PDF OCR & 翻译工具',

    // 导航
    fileProcessing: '文件处理',
    systemSettings: '系统设置',

    // 文件处理
    fileUpload: 'PDF 文件上传',
    fileUploadMultiple: 'PDF 文件上传 (可多选)',
    dragDropFiles: '拖放 PDF 文件到这里',
    browseFiles: '浏览文件',
    startProcessing: '开始处理',
    processingRecords: '处理记录',
    downloadResults: '下载全部结果',
    clearFiles: '清空文件',

    // 翻译设置
    translationSettings: '翻译设置',
    translationModel: '翻译模型',
    targetLanguage: '目标语言',
    noTranslation: '不需要翻译',
    customLanguage: '自定义语言',

    // 设置页面
    apiKeySettings: 'API 密钥设置',
    mistralApiKey: 'Mistral API Key',
    translationApiKey: '翻译 API Key',
    addApiKey: '添加',
    removeApiKey: '删除',

    // 文件保存设置
    fileSaveSettings: '文件保存设置',
    saveLocation: '保存位置',
    browse: '浏览',
    reset: '重置',
    autoSaveCompleted: '自动保存完成的文件',
    autoSaveDescription: '完成处理后立即保存到指定位置',
    enableProcessingRecord: '启用处理记录',
    enableProcessingRecordDescription: '记录处理进度，支持暂停和继续',

    // Google Drive 设置
    googleDriveSettings: 'Google Drive 设置',
    enableGoogleDrive: '启用 Google Drive',
    googleDriveClientId: 'Google Drive Client ID',
    googleDriveClientSecret: 'Google Drive Client Secret',
    googleDriveFolderId: 'Google Drive 文件夹 ID',
    googleDriveAutoUpload: '自动上传到 Google Drive',

    // 高级设置
    advancedSettings: '高级设置',
    fileConcurrency: '文件处理并发数',
    translationConcurrency: '翻译任务并发数',
    maxTokensPerChunk: '翻译分段最大Token数',
    skipProcessedFiles: '跳过已处理文件',

    // 自定义模型
    customModel: '自定义模型',
    apiEndpoint: 'API 端点',
    modelId: '模型 ID',
    requestFormat: '请求格式',
    temperature: '温度',
    maxTokens: '最大 Tokens',

    // 处理状态
    pending: '等待中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停',
    ready: '就绪',

    // 按钮和操作
    save: '保存',
    cancel: '取消',
    delete: '删除',
    continue: '继续',
    pause: '暂停',
    resume: '继续处理',
    close: '关闭',

    // 消息
    processingComplete: '处理完成',
    processingFailed: '处理失败',
    filesSaved: '文件已保存',
    noFilesSelected: '未选择文件',

    // 窗口控制
    minimize: '最小化',
    maximize: '最大化',
    restore: '还原',
    closeWindow: '关闭',

    // 主题
    lightTheme: '浅色主题',
    darkTheme: '深色主题',

    // 语言
    chinese: '中文',
    english: 'English',

    // 版权信息
    basedOnPaperBurner: '基于 paper-burner 二次开发',

    // 处理会话管理
    sessionManagement: '处理会话管理',
    noSessionRecords: '暂无处理会话记录',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    continueProcessing: '继续处理',
    overallProgress: '总体进度',
    totalFiles: '总文件',
    completedFiles: '已完成',
    failedFiles: '失败',
    downloadRecognition: '下载识别',
    downloadTranslation: '下载翻译',
    confirmDelete: '确认删除',
    deleteSessionConfirm: '确定要删除这个处理会话吗？此操作无法撤销。',
    unknown: '未知',

    // 菜单栏
    file: '文件',
    edit: '编辑',
    view: '视图',
    help: '帮助',
    settings: '设置',
    exit: '退出',
    about: '关于',
    language: '语言',
    currentPage: '当前页面',

    // 设置页面详细翻译
    settingsPage: {
      // 导航
      backToHome: '返回主页',

      // API密钥部分
      enterMistralKey: '输入 Mistral API Key',
      enterTranslationKey: '输入翻译 API Key',
      noMistralKeys: '暂无 Mistral API Key',
      noTranslationKeys: '暂无翻译 API Key',
      translationApiKeysOptional: '翻译 API Keys (可选)',

      // 翻译设置
      customTargetLanguageName: '自定义目标语言名称',
      customTargetLanguagePlaceholder: '例如: Spanish',

      // 文件保存设置
      defaultPath: '默认路径',
      autoSaveCompletedFiles: '自动保存完成的文件',
      autoSaveDescription: '完成处理后立即保存到指定位置',
      enableProcessingRecords: '启用处理记录',
      enableProcessingRecordsDescription: '记录处理进度，支持暂停和继续',

      // 测试功能
      testFeatures: '测试功能',
      testZipSave: '测试ZIP保存',
      testUpload: '测试上传',
      disconnect: '断开连接',
      authenticated: '已认证',
      authenticationStatus: '认证状态',
      pending: '等待认证',
      unauthenticated: '未认证',
      startAuth: '开始认证',
      confirm: '确认',
      desktopVersion: '桌面版',
      browserVersion: '浏览器版',
      detection: '检测',
      enterAuthCode: '输入授权码',
      authInstructions: '请在新打开的窗口中完成 Google Drive 授权，然后将授权码粘贴到下方：',
      authCodeRequired: '请输入授权码',
      authSuccess: 'Google Drive 认证成功！',
      authFailed: 'Google Drive 认证失败，请检查授权码是否正确',
      authError: 'Google Drive 认证失败',

      // EPUB转换设置
      epubConversionSettings: 'EPUB 转换设置',
      convertRecognitionToEpub: '识别文件转为 EPUB',
      convertRecognitionToEpubDescription: '将识别完成的 Markdown 文件转换为 EPUB 格式',
      convertTranslationToEpub: '翻译文件转为 EPUB',
      convertTranslationToEpubDescription: '将翻译完成的 Markdown 文件转换为 EPUB 格式',
      pandocPath: 'Pandoc 路径',
      pandocPathDescription: 'Pandoc 可执行文件的路径，如果已添加到系统 PATH 则直接填写 \'pandoc\'',
      pandocParameters: 'Pandoc 参数',
      pandocParametersDescription: 'Pandoc 转换参数，${outputPath} 会被替换为输出文件路径',
      testPandoc: '测试 Pandoc',
      usageInstructions: '使用说明',
      checking: '检测中...',
      available: '可用',
      unavailable: '不可用',
      pandocInstalled: 'Pandoc 已正确安装并可以使用',

      // 使用说明详细内容
      usageInstructionsList: [
        '需要先安装 Pandoc：',
        '默认参数会生成标准的 EPUB 文件',
        '转换后的 EPUB 文件会与原 Markdown 文件一起打包到 ZIP 中',
        '如果转换失败，会在日志中显示错误信息，但不会影响其他处理流程'
      ],

      // Google Drive 设置
      googleDriveSettings: 'Google Drive 设置',
      enableGoogleDrive: '启用 Google Drive 集成',
      enableGoogleDriveDescription: '启用后可以自动将完成的 ZIP 文件上传到 Google Drive',
      googleDriveClientId: 'Google Drive Client ID',
      googleDriveClientIdPlaceholder: '输入 Google Drive API Client ID',
      googleDriveClientSecret: 'Google Drive Client Secret',
      googleDriveClientSecretPlaceholder: '输入 Google Drive API Client Secret',
      googleDriveFolderId: 'Google Drive 文件夹 ID',
      googleDriveFolderIdPlaceholder: '输入目标文件夹 ID（可选）',
      googleDriveFolderIdDescription: '留空将上传到根目录，或输入特定文件夹 ID',
      googleDriveAutoUpload: '自动上传完成的文件',
      googleDriveAutoUploadDescription: '处理完成后自动将 ZIP 文件上传到 Google Drive',

      // 高级设置
      fileProcessingConcurrency: '文件处理并发数',
      translationTaskConcurrency: '翻译任务并发数',
      maxTokensPerTranslationChunk: '翻译分段最大Token数',
      skipProcessedFiles: '跳过已处理文件',

      // 自定义提示词
      customPrompts: '自定义提示词',
      useCustomPrompts: '使用自定义提示词',
      useCustomPromptsDescription: '启用后将使用下方自定义的系统提示词和用户提示词模板',
      systemPrompt: '系统提示词 (System Prompt)',
      systemPromptPlaceholder: '你是一个专业的文档翻译助手，擅长将文本精确翻译为目标语言，同时保留原始的 Markdown 格式。',
      systemPromptDescription: '定义AI助手的角色和基本行为',
      userPromptTemplate: '用户提示词模板 (User Prompt Template)',
      userPromptTemplatePlaceholder: '请将以下内容翻译为 **目标语言**。\\n要求:\\n\\n1. 保持所有 Markdown 语法元素不变\\n2. 学术/专业术语应准确翻译\\n3. 保持原文的段落结构和格式\\n4. 仅输出翻译后的内容，不要包含任何额外的解释或注释\\n\\n文档内容:\\n\\n${content}',
      userPromptTemplateDescription: '翻译请求的具体指令模板，使用 ${content} 作为内容占位符',
      promptTips: '提示',
      promptTipsList: [
        '系统提示词定义AI的角色和基本行为',
        '用户提示词模板中使用 ${content} 作为待翻译内容的占位符',
        '如果不启用自定义提示词，系统将根据目标语言自动选择合适的预设提示词'
      ],

      // 自定义模型
      customModelSettings: '自定义模型设置',

      // 通用
      optional: '可选',
      example: '例如',
      tip: '提示',
      defaultValue: '默认',

      // 自定义模型格式
      openaiFormat: 'OpenAI 格式',
      anthropicFormat: 'Anthropic 格式',
      geminiFormat: 'Google Gemini 格式',

      // 描述文本
      temperatureDescription: '控制输出的多样性，0~2，默认0.5',
      maxTokensDescription: '单次生成最大token数，默认8000',
    },

    // 日志消息 - 处理状态
    logs: {
      // 批量处理
      batchProcessingStart: '=== 开始批量处理 ===',
      batchProcessingComplete: '=== 批量处理完成 ===',
      batchProgress: '批次进度',

      // 文件处理
      fileProcessingStart: '开始处理',
      fileProcessingComplete: '处理完成，文件已自动保存到指定目录',
      fileProcessingFailed: '处理失败',
      fileInfo: '文件信息',

      // 上传和OCR
      uploadingToMistral: '上传到 Mistral...',
      uploadSuccess: '上传成功',
      gettingSignedUrl: '获取签名 URL...',
      signedUrlSuccess: '成功获取 URL',
      startingOcr: '开始 OCR 处理...',
      ocrComplete: 'OCR 完成',
      processingOcrResults: '处理 OCR 结果...',
      markdownGenerated: 'Markdown 生成完成',

      // 翻译
      translationCheck: '翻译检查',
      preparingTranslation: '准备翻译',
      translating: '翻译中',
      translationComplete: '翻译完成',
      skipTranslation: '跳过翻译',
      documentSegmentation: '文档分段',
      translationProgress: '翻译进度',
      translationPartStart: '开始翻译',
      translationPartComplete: '翻译完成',
      translationQueue: '排队等待翻译槽',

      // 状态变更
      statusChange: '状态变更',
      pending: '等待中',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',

      // 保存和备份
      savingFiles: '保存文件',
      saveSuccess: '保存成功',
      saveFailure: '保存失败',
      backupCreated: '备份已创建',
      cleanup: '清理',

      // ZIP操作
      zipCreating: '开始创建',
      zipCreated: '创建完成',
      zipFailed: '创建失败',
      zipSaved: 'ZIP 文件已成功保存到',

      // 错误和警告
      error: '错误',
      warning: '警告',
      retry: '重试',

      // 性能统计
      performanceStats: '耗时',
      duration: '秒',

      // 通用
      success: '成功',
      failure: '失败',
      filesProcessed: '个文件已处理',
      totalTime: '总耗时',
    },
  },

  en: {
    // 应用标题
    appTitle: 'Paper Burner',
    appSubtitle: 'PDF OCR & Translation Tool',

    // 导航
    fileProcessing: 'File Processing',
    systemSettings: 'System Settings',

    // 文件处理
    fileUpload: 'PDF File Upload',
    fileUploadMultiple: 'PDF File Upload (Multiple)',
    dragDropFiles: 'Drag and drop PDF files here',
    browseFiles: 'Browse Files',
    startProcessing: 'Start Processing',
    processingRecords: 'Processing Records',
    downloadResults: 'Download All Results',
    clearFiles: 'Clear Files',

    // 翻译设置
    translationSettings: 'Translation Settings',
    translationModel: 'Translation Model',
    targetLanguage: 'Target Language',
    noTranslation: 'No Translation',
    customLanguage: 'Custom Language',

    // 设置页面
    apiKeySettings: 'API Key Settings',
    mistralApiKey: 'Mistral API Key',
    translationApiKey: 'Translation API Key',
    addApiKey: 'Add',
    removeApiKey: 'Remove',

    // 文件保存设置
    fileSaveSettings: 'File Save Settings',
    saveLocation: 'Save Location',
    browse: 'Browse',
    reset: 'Reset',
    autoSaveCompleted: 'Auto-save completed files',
    autoSaveDescription: 'Save immediately after processing completion',
    enableProcessingRecord: 'Enable processing records',
    enableProcessingRecordDescription: 'Record processing progress, support pause and resume',

    // Google Drive 设置
    googleDriveSettings: 'Google Drive Settings',
    enableGoogleDrive: 'Enable Google Drive',
    googleDriveClientId: 'Google Drive Client ID',
    googleDriveClientSecret: 'Google Drive Client Secret',
    googleDriveFolderId: 'Google Drive Folder ID',
    googleDriveAutoUpload: 'Auto-upload to Google Drive',

    // 高级设置
    advancedSettings: 'Advanced Settings',
    fileConcurrency: 'File Processing Concurrency',
    translationConcurrency: 'Translation Task Concurrency',
    maxTokensPerChunk: 'Max Tokens Per Translation Chunk',
    skipProcessedFiles: 'Skip Processed Files',

    // 自定义模型
    customModel: 'Custom Model',
    apiEndpoint: 'API Endpoint',
    modelId: 'Model ID',
    requestFormat: 'Request Format',
    temperature: 'Temperature',
    maxTokens: 'Max Tokens',

    // 处理状态
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    paused: 'Paused',
    ready: 'Ready',

    // 按钮和操作
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    continue: 'Continue',
    pause: 'Pause',
    resume: 'Resume Processing',
    close: 'Close',

    // 消息
    processingComplete: 'Processing Complete',
    processingFailed: 'Processing Failed',
    filesSaved: 'Files Saved',
    noFilesSelected: 'No Files Selected',

    // 窗口控制
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
    closeWindow: 'Close',

    // 主题
    lightTheme: 'Light Theme',
    darkTheme: 'Dark Theme',

    // 语言
    chinese: '中文',
    english: 'English',

    // 版权信息
    basedOnPaperBurner: 'Based on paper-burner secondary development',

    // 处理会话管理
    sessionManagement: 'Session Management',
    noSessionRecords: 'No session records',
    createdAt: 'Created',
    updatedAt: 'Updated',
    continueProcessing: 'Continue Processing',
    overallProgress: 'Overall Progress',
    totalFiles: 'Total Files',
    completedFiles: 'Completed',
    failedFiles: 'Failed',
    downloadRecognition: 'Download Recognition',
    downloadTranslation: 'Download Translation',
    confirmDelete: 'Confirm Delete',
    deleteSessionConfirm: 'Are you sure you want to delete this processing session? This action cannot be undone.',
    unknown: 'Unknown',

    // 菜单栏
    file: 'File',
    edit: 'Edit',
    view: 'View',
    help: 'Help',
    settings: 'Settings',
    exit: 'Exit',
    about: 'About',
    language: 'Language',
    currentPage: 'Current Page',

    // 设置页面详细翻译
    settingsPage: {
      // 导航
      backToHome: 'Back to Home',

      // API密钥部分
      enterMistralKey: 'Enter Mistral API Key',
      enterTranslationKey: 'Enter Translation API Key',
      noMistralKeys: 'No Mistral API Keys',
      noTranslationKeys: 'No Translation API Keys',
      translationApiKeysOptional: 'Translation API Keys (Optional)',

      // 翻译设置
      customTargetLanguageName: 'Custom Target Language Name',
      customTargetLanguagePlaceholder: 'e.g., Spanish',

      // 文件保存设置
      defaultPath: 'Default Path',
      autoSaveCompletedFiles: 'Auto-save completed files',
      autoSaveDescription: 'Save immediately after processing completion',
      enableProcessingRecords: 'Enable processing records',
      enableProcessingRecordsDescription: 'Record processing progress, support pause and resume',

      // 测试功能
      testFeatures: 'Test Features',
      testZipSave: 'Test ZIP Save',
      testUpload: 'Test Upload',
      disconnect: 'Disconnect',
      authenticated: 'Authenticated',
      authenticationStatus: 'Authentication Status',
      pending: 'Pending',
      unauthenticated: 'Unauthenticated',
      startAuth: 'Start Authentication',
      confirm: 'Confirm',
      desktopVersion: 'Desktop Version',
      browserVersion: 'Browser Version',
      detection: 'Detection',
      enterAuthCode: 'Enter authorization code',
      authInstructions: 'Please complete Google Drive authorization in the newly opened window, then paste the authorization code below:',
      authCodeRequired: 'Please enter authorization code',
      authSuccess: 'Google Drive authentication successful!',
      authFailed: 'Google Drive authentication failed, please check if the authorization code is correct',
      authError: 'Google Drive authentication failed',

      // EPUB转换设置
      epubConversionSettings: 'EPUB Conversion Settings',
      convertRecognitionToEpub: 'Convert Recognition to EPUB',
      convertRecognitionToEpubDescription: 'Convert recognized Markdown files to EPUB format',
      convertTranslationToEpub: 'Convert Translation to EPUB',
      convertTranslationToEpubDescription: 'Convert translated Markdown files to EPUB format',
      pandocPath: 'Pandoc Path',
      pandocPathDescription: 'Path to Pandoc executable, use \'pandoc\' if added to system PATH',
      pandocParameters: 'Pandoc Parameters',
      pandocParametersDescription: 'Pandoc conversion parameters, ${outputPath} will be replaced with output file path',
      testPandoc: 'Test Pandoc',
      usageInstructions: 'Usage Instructions',
      checking: 'Checking...',
      available: 'Available',
      unavailable: 'Unavailable',
      pandocInstalled: 'Pandoc is correctly installed and ready to use',

      // 使用说明详细内容
      usageInstructionsList: [
        'Install Pandoc first:',
        'Default parameters will generate standard EPUB files',
        'Converted EPUB files will be packaged together with original Markdown files into ZIP',
        'If conversion fails, error messages will be shown in logs, but won\'t affect other processing workflows'
      ],

      // Google Drive 设置
      googleDriveSettings: 'Google Drive Settings',
      enableGoogleDrive: 'Enable Google Drive Integration',
      enableGoogleDriveDescription: 'Enable automatic upload of completed ZIP files to Google Drive',
      googleDriveClientId: 'Google Drive Client ID',
      googleDriveClientIdPlaceholder: 'Enter Google Drive API Client ID',
      googleDriveClientSecret: 'Google Drive Client Secret',
      googleDriveClientSecretPlaceholder: 'Enter Google Drive API Client Secret',
      googleDriveFolderId: 'Google Drive Folder ID',
      googleDriveFolderIdPlaceholder: 'Enter target folder ID (optional)',
      googleDriveFolderIdDescription: 'Leave empty to upload to root directory, or enter specific folder ID',
      googleDriveAutoUpload: 'Auto-upload completed files',
      googleDriveAutoUploadDescription: 'Automatically upload ZIP files to Google Drive after processing completion',

      // 高级设置
      fileProcessingConcurrency: 'File Processing Concurrency',
      translationTaskConcurrency: 'Translation Task Concurrency',
      maxTokensPerTranslationChunk: 'Max Tokens Per Translation Chunk',
      skipProcessedFiles: 'Skip Processed Files',

      // 自定义提示词
      customPrompts: 'Custom Prompts',
      useCustomPrompts: 'Use Custom Prompts',
      useCustomPromptsDescription: 'When enabled, the custom system prompt and user prompt template below will be used',
      systemPrompt: 'System Prompt',
      systemPromptPlaceholder: 'You are a professional document translation assistant, skilled at accurately translating text into the target language while preserving the original Markdown format.',
      systemPromptDescription: 'Define the AI assistant\'s role and basic behavior',
      userPromptTemplate: 'User Prompt Template',
      userPromptTemplatePlaceholder: 'Please translate the following content into **target language**.\\n\\nRequirements:\\n\\n1. Keep all Markdown syntax elements unchanged\\n2. Academic/professional terms should be accurately translated\\n3. Maintain the original paragraph structure and format\\n4. Only output the translated content, do not include any additional explanations or comments\\n\\nDocument content:\\n\\n${content}',
      userPromptTemplateDescription: 'Specific instruction template for translation requests, use ${content} as content placeholder',
      promptTips: 'Tips',
      promptTipsList: [
        'System prompt defines the AI\'s role and basic behavior',
        'Use ${content} as placeholder for content to be translated in user prompt template',
        'If custom prompts are not enabled, the system will automatically select appropriate preset prompts based on target language'
      ],

      // 自定义模型
      customModelSettings: 'Custom Model Settings',

      // 通用
      optional: 'Optional',
      example: 'e.g.',
      tip: 'Tip',
      defaultValue: 'Default',

      // 自定义模型格式
      openaiFormat: 'OpenAI Format',
      anthropicFormat: 'Anthropic Format',
      geminiFormat: 'Google Gemini Format',

      // 描述文本
      temperatureDescription: 'Controls output diversity, 0~2, default 0.5',
      maxTokensDescription: 'Maximum tokens per generation, default 8000',
    },

    // 日志消息 - 处理状态
    logs: {
      // 批量处理
      batchProcessingStart: '=== Starting Batch Processing ===',
      batchProcessingComplete: '=== Batch Processing Complete ===',
      batchProgress: 'Batch Progress',

      // 文件处理
      fileProcessingStart: 'Starting processing',
      fileProcessingComplete: 'Processing complete, files automatically saved to specified directory',
      fileProcessingFailed: 'Processing failed',
      fileInfo: 'File info',

      // 上传和OCR
      uploadingToMistral: 'Uploading to Mistral...',
      uploadSuccess: 'Upload successful',
      gettingSignedUrl: 'Getting signed URL...',
      signedUrlSuccess: 'Successfully obtained URL',
      startingOcr: 'Starting OCR processing...',
      ocrComplete: 'OCR complete',
      processingOcrResults: 'Processing OCR results...',
      markdownGenerated: 'Markdown generation complete',

      // 翻译
      translationCheck: 'Translation check',
      preparingTranslation: 'Preparing translation',
      translating: 'Translating',
      translationComplete: 'Translation complete',
      skipTranslation: 'Skip translation',
      documentSegmentation: 'Document segmentation',
      translationProgress: 'Translation progress',
      translationPartStart: 'Starting translation',
      translationPartComplete: 'Translation complete',
      translationQueue: 'Queuing for translation slot',

      // 状态变更
      statusChange: 'Status change',
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',

      // 保存和备份
      savingFiles: 'Saving files',
      saveSuccess: 'Save successful',
      saveFailure: 'Save failed',
      backupCreated: 'Backup created',
      cleanup: 'Cleanup',

      // ZIP操作
      zipCreating: 'Creating',
      zipCreated: 'Created',
      zipFailed: 'Creation failed',
      zipSaved: 'ZIP file successfully saved to',

      // 错误和警告
      error: 'Error',
      warning: 'Warning',
      retry: 'Retry',

      // 性能统计
      performanceStats: 'Duration',
      duration: 'seconds',

      // 通用
      success: 'Success',
      failure: 'Failed',
      filesProcessed: 'files processed',
      totalTime: 'Total time',
    },
  }
};

// 获取翻译文本
export function getTranslation(language: Language, key: keyof Translations): any {
  return translations[language][key];
}

// 获取当前语言的所有翻译
export function getTranslations(language: Language): Translations {
  return translations[language];
}
