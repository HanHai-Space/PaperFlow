// 详细日志系统 - 模仿simple/目录的日志格式
import { Language, getTranslations } from '@/lib/i18n';

export class ProcessingLogger {
  private logs: string[] = [];
  private onLogCallback?: (message: string) => void;
  private onProgressCallback?: (fileName: string, status: string, progress: number) => void;
  private language: Language;

  constructor(
    onLogCallback?: (message: string) => void,
    onProgressCallback?: (fileName: string, status: string, progress: number) => void,
    language: Language = 'zh'
  ) {
    this.onLogCallback = onLogCallback;
    this.onProgressCallback = onProgressCallback;
    this.language = language;
  }

  // 获取翻译文本
  t() {
    return getTranslations(this.language);
  }

  // 设置语言
  setLanguage(language: Language): void {
    this.language = language;
  }

  // 获取当前时间戳
  private getTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
  }

  // 记录日志
  log(message: string): void {
    const timestampedMessage = `${this.getTimestamp()} ${message}`;
    this.logs.push(timestampedMessage);
    console.log(timestampedMessage);

    if (this.onLogCallback) {
      this.onLogCallback(timestampedMessage);
    }
  }

  // 记录批量处理开始
  logBatchStart(fileCount: number, concurrency: number, translationConcurrency: number, maxRetries: number, skipProcessed: boolean): void {
    const t = this.t();
    this.log(t.logs.batchProcessingStart);
    this.log(`File concurrency: ${concurrency}, Translation concurrency: ${translationConcurrency}, Max retries: ${maxRetries}, Skip processed: ${skipProcessed}`);
  }

  // 记录文件处理开始
  logFileStart(index: number, total: number, fileName: string): void {
    const t = this.t();
    this.log(`--- [${index}/${total}] ${t.logs.fileProcessingStart}: ${fileName} ---`);
  }

  // 记录文件处理步骤
  logFileStep(fileName: string, step: string, details?: string): void {
    const message = details ? `[${fileName}] ${step} ${details}` : `[${fileName}] ${step}`;
    this.log(message);
  }

  // 记录上传成功
  logUploadSuccess(fileName: string, fileId: string): void {
    const t = this.t();
    this.logFileStep(fileName, `${t.logs.uploadSuccess}, File ID: ${fileId}`);
  }

  // 记录OCR完成
  logOcrComplete(fileName: string): void {
    const t = this.t();
    this.logFileStep(fileName, t.logs.ocrComplete);
  }

  // 记录翻译开始
  logTranslationStart(fileName: string, model: string, keyHint: string): void {
    const t = this.t();
    this.logFileStep(fileName, `${t.logs.translationPartStart} (${model}, Key: ${keyHint})`);
  }

  // 记录文档分割
  logDocumentSegmentation(fileName: string, tokenCount: number, chunkLimit: number, chunkCount: number): void {
    const t = this.t();
    this.logFileStep(fileName, `Document large (~${Math.round(tokenCount/1000)}K tokens), ${t.logs.documentSegmentation}`);
    this.logFileStep(fileName, `Estimated total tokens: ~${tokenCount}, chunk limit: ${chunkLimit}`);
    this.logFileStep(fileName, `Document exceeds size limit, starting segmentation...`);
    this.logFileStep(fileName, `Initial segmentation into ${chunkCount} chunks.`);
    this.logFileStep(fileName, `Document segmented into ${chunkCount} parts for translation`);
  }

  // 记录翻译队列状态
  logTranslationQueue(fileName: string, partIndex: number, totalParts: number, attempt: number): void {
    const t = this.t();
    this.logFileStep(fileName, `(Part ${partIndex}/${totalParts}) ${t.logs.translationQueue} (attempt ${attempt})...`);
  }

  // 记录翻译开始
  logTranslationPartStart(fileName: string, partIndex: number, totalParts: number, attempt: number): void {
    const t = this.t();
    this.logFileStep(fileName, `(Part ${partIndex}/${totalParts}) Translation slot acquired. ${t.logs.translationPartStart} (attempt ${attempt})...`);
  }

  // 记录翻译完成
  logTranslationPartComplete(fileName: string, partIndex: number, totalParts: number, success: boolean): void {
    const t = this.t();
    const status = success ? t.logs.success : t.logs.failure;
    this.logFileStep(fileName, `(Part ${partIndex}/${totalParts}) Translation slot released (${status}).`);
  }

  // 记录翻译全部完成
  logTranslationComplete(fileName: string): void {
    const t = this.t();
    this.logFileStep(fileName, t.logs.translationComplete);
  }

  // 记录文件处理完成
  logFileComplete(fileName: string, success: boolean, error?: string): void {
    const t = this.t();
    if (success) {
      this.logFileStep(fileName, t.logs.fileProcessingComplete);
    } else {
      this.logFileStep(fileName, `${t.logs.fileProcessingFailed}: ${error || 'Unknown error'}`);
    }
  }

  // 记录批量处理完成
  logBatchComplete(successCount: number, failureCount: number, totalTime: number): void {
    const t = this.t();
    this.log(t.logs.batchProcessingComplete);
    this.log(`${t.logs.success}: ${successCount} ${t.logs.filesProcessed}`);
    if (failureCount > 0) {
      this.log(`${t.logs.failure}: ${failureCount} ${t.logs.filesProcessed}`);
    }
    this.log(`${t.logs.totalTime}: ${Math.round(totalTime / 1000)} ${t.logs.duration}`);
  }

  // 记录备份创建
  logBackupCreated(fileName: string, step: string, location: string): void {
    this.logFileStep(fileName, `备份已创建 [${step}]: ${location}`);
  }

  // 记录图片保存
  logImagesSaved(fileName: string, imageCount: number, location: string): void {
    this.logFileStep(fileName, `已保存 ${imageCount} 张图片到: ${location}`);
  }

  // 记录错误
  logError(fileName: string, error: string, step?: string): void {
    const message = step ? `[${fileName}] 错误 (${step}): ${error}` : `[${fileName}] 错误: ${error}`;
    this.log(message);
  }

  // 记录警告
  logWarning(fileName: string, warning: string): void {
    this.logFileStep(fileName, `警告: ${warning}`);
  }

  // 记录重试
  logRetry(fileName: string, step: string, attempt: number, maxAttempts: number): void {
    this.logFileStep(fileName, `重试 ${step} (${attempt}/${maxAttempts})`);
  }

  // ===== 新增详细状态日志方法 =====

  // 记录处理状态变更
  logStatusChange(fileName: string, fromStatus: string, toStatus: string, progress?: number): void {
    const progressText = progress !== undefined ? ` (进度: ${progress}%)` : '';
    this.logFileStep(fileName, `状态变更: ${fromStatus} → ${toStatus}${progressText}`);

    // 触发进度回调
    if (this.onProgressCallback && progress !== undefined) {
      this.onProgressCallback(fileName, toStatus, progress);
    }
  }

  // 记录文件信息
  logFileInfo(fileName: string, fileSize: number, fileType: string): void {
    const sizeInMB = (fileSize / 1024 / 1024).toFixed(2);
    this.logFileStep(fileName, `文件信息: 大小 ${sizeInMB} MB, 类型 ${fileType}`);
  }

  // 记录API密钥使用情况
  logApiKeyUsage(fileName: string, apiType: string, keyHint: string): void {
    this.logFileStep(fileName, `使用 ${apiType} API Key: ...${keyHint}`);
  }

  // 记录上传进度
  logUploadProgress(fileName: string, progress: number): void {
    this.logFileStep(fileName, `上传进度: ${progress}%`);
  }

  // 记录上传开始
  logUploadStart(fileName: string, destination: string): void {
    this.logFileStep(fileName, `开始上传到 ${destination}...`);
  }

  // 记录OCR开始
  logOcrStart(fileName: string): void {
    this.logFileStep(fileName, '开始 OCR 识别...');
  }

  // 记录OCR进度
  logOcrProgress(fileName: string, progress: number): void {
    this.logFileStep(fileName, `OCR 进度: ${progress}%`);
  }

  // 记录OCR结果统计
  logOcrStats(fileName: string, pageCount: number, imageCount: number, textLength: number): void {
    this.logFileStep(fileName, `OCR 完成: ${pageCount} 页, ${imageCount} 张图片, ${textLength} 字符`);
  }

  // 记录Markdown生成
  logMarkdownGeneration(fileName: string, contentLength: number): void {
    this.logFileStep(fileName, `Markdown 生成完成: ${contentLength} 字符`);
  }

  // 记录翻译配置
  logTranslationConfig(fileName: string, model: string, targetLanguage: string, chunkSize: number): void {
    this.logFileStep(fileName, `翻译配置: 模型 ${model}, 目标语言 ${targetLanguage}, 分块大小 ${chunkSize}`);
  }

  // 记录翻译进度
  logTranslationProgress(fileName: string, completedChunks: number, totalChunks: number): void {
    const progress = Math.round((completedChunks / totalChunks) * 100);
    this.logFileStep(fileName, `翻译进度: ${completedChunks}/${totalChunks} 块 (${progress}%)`);
  }

  // 记录翻译结果统计
  logTranslationStats(fileName: string, originalLength: number, translatedLength: number): void {
    this.logFileStep(fileName, `翻译完成: 原文 ${originalLength} 字符 → 译文 ${translatedLength} 字符`);
  }

  // 记录文件保存开始
  logSaveStart(fileName: string, saveLocation: string): void {
    this.logFileStep(fileName, `开始保存到: ${saveLocation}`);
  }

  // 记录文件保存成功
  logSaveSuccess(fileName: string, filePath: string, fileType: string): void {
    this.logFileStep(fileName, `${fileType} 保存成功: ${filePath}`);
  }

  // 记录文件保存失败
  logSaveFailure(fileName: string, fileType: string, error: string): void {
    this.logFileStep(fileName, `${fileType} 保存失败: ${error}`);
  }

  // 记录备份操作
  logBackupOperation(fileName: string, operation: string, step: string, success: boolean): void {
    const status = success ? '成功' : '失败';
    this.logFileStep(fileName, `备份${operation} [${step}]: ${status}`);
  }

  // 记录清理操作
  logCleanup(fileName: string, resource: string, success: boolean): void {
    const status = success ? '成功' : '失败';
    this.logFileStep(fileName, `清理${resource}: ${status}`);
  }

  // 记录性能统计
  logPerformanceStats(fileName: string, step: string, duration: number, memoryUsage?: number): void {
    const durationText = duration > 1000 ? `${(duration / 1000).toFixed(1)}秒` : `${duration}毫秒`;
    const memoryText = memoryUsage ? `, 内存使用: ${(memoryUsage / 1024 / 1024).toFixed(1)}MB` : '';
    this.logFileStep(fileName, `${step} 耗时: ${durationText}${memoryText}`);
  }

  // 记录会话信息
  logSessionInfo(sessionId: string, fileName: string, operation: string): void {
    this.logFileStep(fileName, `会话 ${sessionId}: ${operation}`);
  }

  // 记录ZIP文件操作
  logZipOperation(operation: string, fileCount: number, totalSize?: number): void {
    const sizeText = totalSize ? `, total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB` : '';
    this.log(`ZIP ${operation}: ${fileCount} files${sizeText}`);
  }

  // 获取所有日志
  getAllLogs(): string[] {
    return [...this.logs];
  }

  // 清空日志
  clearLogs(): void {
    this.logs = [];
  }

  // 导出日志到文件
  exportLogs(): string {
    return this.logs.join('\n');
  }
}
