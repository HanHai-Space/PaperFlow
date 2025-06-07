// 文档级并发处理管理器 - 支持多个文档同时处理
import { ProcessingResult, TranslationModel, Settings } from '@/types/pdf-processor';
import { apiKeyManager } from './api';
import { ProcessingLogger } from './logger';
import { processSinglePdf, TranslationSemaphoreManager } from './processing';

export interface DocumentProcessingTask {
  id: string;
  file: File;
  fileIndex: number;
  totalFiles: number;
  mistralKey: string;
  translationKey: string;
  attempt: number;
  maxAttempts: number;
}

export interface DocumentProcessingResult {
  success: boolean;
  fileIndex: number;
  fileName: string;
  result?: ProcessingResult;
  error?: string;
  mistralKey: string;
  translationKey: string;
  attempt: number;
  duration: number;
}

export class DocumentConcurrentManager {
  private maxDocumentConcurrency: number;
  private translationSemaphoreManager: TranslationSemaphoreManager;
  private logger: ProcessingLogger;
  private settings: Settings;

  constructor(
    maxDocumentConcurrency: number,
    translationConcurrencyLevel: number,
    logger: ProcessingLogger,
    settings: Settings
  ) {
    this.maxDocumentConcurrency = maxDocumentConcurrency;
    this.translationSemaphoreManager = new TranslationSemaphoreManager(translationConcurrencyLevel);
    this.logger = logger;
    this.settings = settings;
  }

  // 并发处理多个文档
  async processDocumentsConcurrently(
    files: File[],
    translationModel: TranslationModel,
    targetLanguage: string,
    customTargetLanguage: string,
    onProgress?: (message: string) => void,
    onFileProgress?: (fileName: string, status: string, progress: number) => void,
    saveDirectory?: string,
    language?: 'zh' | 'en',
    translationController?: any
  ): Promise<ProcessingResult[]> {

    // 检查可用密钥
    const availableMistralKeys = apiKeyManager.getAvailableKeyCount('mistral');
    const availableTranslationKeys = translationModel !== 'none'
      ? apiKeyManager.getAvailableKeyCount('translation')
      : files.length; // 如果不需要翻译，假设有足够的"密钥"

    if (availableMistralKeys === 0) {
      throw new Error('没有可用的Mistral API密钥');
    }

    if (translationModel !== 'none' && availableTranslationKeys === 0) {
      throw new Error('没有可用的翻译API密钥');
    }

    // 计算实际并发数（不能超过可用密钥数）
    const actualConcurrency = Math.min(
      this.maxDocumentConcurrency,
      availableMistralKeys,
      translationModel !== 'none' ? availableTranslationKeys : files.length
    );

    this.logger.logBatchStart(
      files.length,
      actualConcurrency,
      this.translationSemaphoreManager.getLimit(),
      3, // 最大重试次数
      this.settings.skipProcessedFiles || false
    );

    this.logger.log(`开始并发处理 ${files.length} 个文档，实际并发数: ${actualConcurrency}`);

    // 创建文档处理任务
    const tasks: DocumentProcessingTask[] = files.map((file, index) => ({
      id: `doc_${index}_${file.name}`,
      file,
      fileIndex: index,
      totalFiles: files.length,
      mistralKey: '', // 将在执行时分配
      translationKey: '', // 将在执行时分配
      attempt: 1,
      maxAttempts: 3
    }));

    // 执行并发处理
    const results = await this.executeConcurrentDocumentTasks(
      tasks,
      translationModel,
      targetLanguage,
      customTargetLanguage,
      onProgress,
      onFileProgress,
      saveDirectory,
      language,
      translationController
    );

    // 按文件索引排序结果
    results.sort((a, b) => a.fileIndex - b.fileIndex);

    // 转换为ProcessingResult数组
    const processingResults: ProcessingResult[] = [];
    for (const result of results) {
      if (result.success && result.result) {
        processingResults.push(result.result);
      } else {
        // 创建失败的ProcessingResult
        processingResults.push({
          success: false,
          fileName: result.fileName,
          error: result.error || '处理失败',
          originalFile: tasks[result.fileIndex].file,
          fileUrl: URL.createObjectURL(tasks[result.fileIndex].file),
          sessionId: ''
        });
      }
    }

    return processingResults;
  }

  // 执行并发文档任务
  private async executeConcurrentDocumentTasks(
    tasks: DocumentProcessingTask[],
    translationModel: TranslationModel,
    targetLanguage: string,
    customTargetLanguage: string,
    onProgress?: (message: string) => void,
    onFileProgress?: (fileName: string, status: string, progress: number) => void,
    saveDirectory?: string,
    language?: 'zh' | 'en',
    translationController?: any
  ): Promise<DocumentProcessingResult[]> {
    const results: DocumentProcessingResult[] = [];
    const semaphore = new DocumentSemaphore(this.maxDocumentConcurrency);

    // 创建所有任务的Promise
    const taskPromises = tasks.map(task =>
      this.executeDocumentTaskWithRetry(
        task,
        translationModel,
        targetLanguage,
        customTargetLanguage,
        onProgress,
        onFileProgress,
        saveDirectory,
        language,
        semaphore,
        translationController
      )
    );

    // 等待所有任务完成
    const taskResults = await Promise.allSettled(taskPromises);

    // 处理结果
    for (let i = 0; i < taskResults.length; i++) {
      const taskResult = taskResults[i];
      if (taskResult.status === 'fulfilled') {
        results.push(taskResult.value);
      } else {
        // 任务失败，创建失败结果
        results.push({
          success: false,
          fileIndex: tasks[i].fileIndex,
          fileName: tasks[i].file.name,
          error: taskResult.reason?.message || '未知错误',
          mistralKey: tasks[i].mistralKey,
          translationKey: tasks[i].translationKey,
          attempt: tasks[i].attempt,
          duration: 0
        });
      }
    }

    return results;
  }

  // 执行单个文档任务（带重试）
  private async executeDocumentTaskWithRetry(
    task: DocumentProcessingTask,
    translationModel: TranslationModel,
    targetLanguage: string,
    customTargetLanguage: string,
    onProgress?: (message: string) => void,
    onFileProgress?: (fileName: string, status: string, progress: number) => void,
    saveDirectory?: string,
    language?: 'zh' | 'en',
    semaphore?: DocumentSemaphore,
    translationController?: any
  ): Promise<DocumentProcessingResult> {
    let lastError: Error | null = null;
    const usedMistralKeys = new Set<string>();
    const usedTranslationKeys = new Set<string>();

    for (let attempt = 1; attempt <= task.maxAttempts; attempt++) {
      try {
        // 获取信号量
        if (semaphore) {
          await semaphore.acquire();
        }

        // 分配密钥
        const mistralKey = apiKeyManager.getSpecificKey('mistral', Array.from(usedMistralKeys));
        const translationKey = translationModel !== 'none'
          ? apiKeyManager.getSpecificKey('translation', Array.from(usedTranslationKeys))
          : '';

        if (!mistralKey) {
          throw new Error('无法获取可用的Mistral API密钥');
        }

        if (translationModel !== 'none' && !translationKey) {
          throw new Error('无法获取可用的翻译API密钥');
        }

        task.mistralKey = mistralKey;
        task.translationKey = translationKey || '';
        task.attempt = attempt;

        usedMistralKeys.add(mistralKey);
        if (translationKey) {
          usedTranslationKeys.add(translationKey);
        }

        this.logger.logFileStart(task.fileIndex + 1, task.totalFiles, task.file.name);
        if (attempt > 1) {
          this.logger.logRetry(task.file.name, '文档处理', attempt, task.maxAttempts);
        }

        const startTime = Date.now();

        // 处理文档
        const result = await processSinglePdf(
          task.file,
          mistralKey,
          translationKey || '',
          translationModel,
          this.settings.maxTokensPerChunk,
          targetLanguage === 'custom' ? customTargetLanguage : targetLanguage,
          this.translationSemaphoreManager,
          this.settings,
          onProgress,
          onFileProgress,
          saveDirectory,
          language,
          translationController
        );

        const duration = Date.now() - startTime;

        this.logger.logFileComplete(task.file.name, result.success);
        this.logger.logPerformanceStats(task.file.name, '完整处理', duration);

        return {
          success: result.success,
          fileIndex: task.fileIndex,
          fileName: task.file.name,
          result,
          mistralKey,
          translationKey: translationKey || '',
          attempt,
          duration
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 记录密钥错误
        if (task.mistralKey) {
          apiKeyManager.recordKeyError('mistral', task.mistralKey);
        }
        if (task.translationKey) {
          apiKeyManager.recordKeyError('translation', task.translationKey);
        }

        this.logger.logFileComplete(task.file.name, false, lastError.message);

        // 如果还有重试机会，等待一段时间
        if (attempt < task.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 递增延迟
        }
      } finally {
        // 释放信号量
        if (semaphore) {
          semaphore.release();
        }
      }
    }

    return {
      success: false,
      fileIndex: task.fileIndex,
      fileName: task.file.name,
      error: lastError?.message || '文档处理失败',
      mistralKey: task.mistralKey,
      translationKey: task.translationKey,
      attempt: task.maxAttempts,
      duration: 0
    };
  }
}

// 文档级信号量实现
class DocumentSemaphore {
  private count: number;
  private waitQueue: Array<() => void> = [];

  constructor(initialCount: number) {
    this.count = initialCount;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    } else {
      return new Promise<void>(resolve => {
        this.waitQueue.push(resolve);
      });
    }
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    } else {
      this.count++;
    }
  }
}
