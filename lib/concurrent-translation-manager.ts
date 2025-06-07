// 并发翻译管理器 - 支持多密钥并发翻译
import { TranslationModel, Settings, TranslationController } from '@/types/pdf-processor';
import { apiKeyManager, callTranslationApi, buildPredefinedApiConfig, buildCustomApiConfig } from './api';
import { ProcessingLogger } from './logger';
import { checkTranslationPause } from './translation-controller';

export interface ConcurrentTranslationTask {
  id: string;
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  apiKey: string;
  attempt: number;
  maxAttempts: number;
}

export interface ConcurrentTranslationResult {
  success: boolean;
  chunkIndex: number;
  translatedText?: string;
  error?: string;
  apiKey: string;
  attempt: number;
  duration: number;
}

export class ConcurrentTranslationManager {
  private activeTasks: Map<string, ConcurrentTranslationTask> = new Map();
  private completedTasks: Map<number, ConcurrentTranslationResult> = new Map();
  private maxConcurrency: number;
  private logger: ProcessingLogger;

  constructor(maxConcurrency: number, logger: ProcessingLogger) {
    this.maxConcurrency = maxConcurrency;
    this.logger = logger;
  }

  // 并发翻译文本块
  async translateChunksConcurrently(
    chunks: string[],
    fileName: string,
    translationModel: TranslationModel,
    targetLanguage: string,
    settings: Settings,
    systemPrompt?: string,
    userPromptTemplate?: string,
    translationController?: TranslationController
  ): Promise<string[]> {
    this.completedTasks.clear();

    // 获取可用的翻译密钥
    const availableKeys = apiKeyManager.getMultipleTranslationKeys(this.maxConcurrency);
    if (availableKeys.length === 0) {
      throw new Error('没有可用的翻译API密钥');
    }

    this.logger.logFileStep(fileName, `开始并发翻译，使用 ${availableKeys.length} 个密钥，最大并发数: ${this.maxConcurrency}`);

    // 创建翻译任务
    const tasks: ConcurrentTranslationTask[] = chunks.map((chunk, index) => ({
      id: `${fileName}_chunk_${index}`,
      chunk,
      chunkIndex: index,
      totalChunks: chunks.length,
      fileName,
      apiKey: availableKeys[index % availableKeys.length], // 轮询分配密钥
      attempt: 1,
      maxAttempts: 3
    }));

    // 执行并发翻译
    const results = await this.executeConcurrentTasks(
      tasks,
      translationModel,
      targetLanguage,
      settings,
      systemPrompt,
      userPromptTemplate,
      translationController
    );

    // 按顺序组装结果
    const translatedChunks: string[] = new Array(chunks.length);
    for (const result of results) {
      if (result.success && result.translatedText) {
        translatedChunks[result.chunkIndex] = result.translatedText;
      } else {
        throw new Error(`翻译块 ${result.chunkIndex + 1} 失败: ${result.error}`);
      }
    }

    return translatedChunks;
  }

  // 执行并发任务
  private async executeConcurrentTasks(
    tasks: ConcurrentTranslationTask[],
    translationModel: TranslationModel,
    targetLanguage: string,
    settings: Settings,
    systemPrompt?: string,
    userPromptTemplate?: string,
    translationController?: TranslationController
  ): Promise<ConcurrentTranslationResult[]> {
    const semaphore = new Semaphore(this.maxConcurrency);

    // 创建所有任务的Promise，保持与原始任务的对应关系
    const taskPromises = tasks.map(task =>
      this.executeTaskWithRetry(
        task,
        translationModel,
        targetLanguage,
        settings,
        systemPrompt,
        userPromptTemplate,
        semaphore,
        translationController
      )
    );

    // 等待所有任务完成
    const taskResults = await Promise.allSettled(taskPromises);

    // 处理结果，保持正确的索引对应关系
    const results: ConcurrentTranslationResult[] = [];
    for (let i = 0; i < taskResults.length; i++) {
      const taskResult = taskResults[i];
      const originalTask = tasks[i];

      if (taskResult.status === 'fulfilled') {
        results.push(taskResult.value);
      } else {
        // 任务失败，创建失败结果，使用原始任务的chunkIndex
        results.push({
          success: false,
          chunkIndex: originalTask.chunkIndex,
          error: taskResult.reason?.message || '未知错误',
          apiKey: originalTask.apiKey,
          attempt: originalTask.maxAttempts,
          duration: 0
        });
      }
    }

    return results;
  }

  // 执行单个任务（带重试）
  private async executeTaskWithRetry(
    task: ConcurrentTranslationTask,
    translationModel: TranslationModel,
    targetLanguage: string,
    settings: Settings,
    systemPrompt?: string,
    userPromptTemplate?: string,
    semaphore?: Semaphore,
    translationController?: TranslationController
  ): Promise<ConcurrentTranslationResult> {
    let lastError: Error | null = null;
    let currentApiKey = task.apiKey;
    const usedKeys = new Set<string>([currentApiKey]);

    for (let attempt = 1; attempt <= task.maxAttempts; attempt++) {
      try {
        // 获取信号量
        if (semaphore) {
          await semaphore.acquire();
        }

        this.logger.logTranslationPartStart(task.fileName, task.chunkIndex + 1, task.totalChunks, attempt);

        const startTime = Date.now();

        // 执行翻译
        const translatedText = await this.translateSingleChunk(
          task.chunk,
          translationModel,
          currentApiKey,
          targetLanguage,
          settings,
          systemPrompt,
          userPromptTemplate,
          translationController
        );

        const duration = Date.now() - startTime;

        this.logger.logTranslationPartComplete(task.fileName, task.chunkIndex + 1, task.totalChunks, true);
        this.logger.logPerformanceStats(task.fileName, `翻译块${task.chunkIndex + 1}`, duration);

        return {
          success: true,
          chunkIndex: task.chunkIndex,
          translatedText,
          apiKey: currentApiKey,
          attempt,
          duration
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 记录密钥错误
        apiKeyManager.recordKeyError('translation', currentApiKey);

        this.logger.logTranslationPartComplete(task.fileName, task.chunkIndex + 1, task.totalChunks, false);

        // 如果还有重试机会，尝试获取新的密钥
        if (attempt < task.maxAttempts) {
          const newKey = apiKeyManager.getSpecificKey('translation', Array.from(usedKeys));
          if (newKey) {
            currentApiKey = newKey;
            usedKeys.add(newKey);
            this.logger.logRetry(task.fileName, `翻译块${task.chunkIndex + 1}`, attempt + 1, task.maxAttempts);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
          } else {
            // 没有更多可用密钥，直接失败
            break;
          }
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
      chunkIndex: task.chunkIndex,
      error: lastError?.message || '翻译失败',
      apiKey: currentApiKey,
      attempt: task.maxAttempts,
      duration: 0
    };
  }

  // 翻译单个文本块
  private async translateSingleChunk(
    chunk: string,
    model: TranslationModel,
    apiKey: string,
    targetLanguage: string,
    settings: Settings,
    systemPrompt?: string,
    userPromptTemplate?: string,
    translationController?: TranslationController
  ): Promise<string> {
    if (model === 'none') {
      return chunk; // 不翻译
    }

    let config;
    if (model === 'custom' && settings) {
      config = buildCustomApiConfig(
        apiKey,
        settings.customApiEndpoint,
        settings.customModelId,
        settings.customRequestFormat,
        settings.customTemperature,
        settings.customMaxTokens
      );
    } else {
      config = buildPredefinedApiConfig(model, apiKey);
    }

    const requestBody = config.requestBuilder(chunk, targetLanguage, systemPrompt, userPromptTemplate);
    return await callTranslationApi(config, requestBody, translationController?.abortController?.signal);
  }
}

// 简单的信号量实现
class Semaphore {
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
