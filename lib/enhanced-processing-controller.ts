// 增强的处理控制器 - 支持暂停/继续和状态持久化
import { ProcessingResult, TranslationModel, Settings } from '@/types/pdf-processor';
import { EnhancedSessionManager, EnhancedProcessingSession } from './enhanced-session-manager';
import { enhancedZipManager } from './enhanced-zip-manager';
import { ProcessingLogger } from './logger';
import { processSinglePdf, TranslationSemaphoreManager } from './processing';
import { apiKeyManager } from './api';
import { TranslationControllerImpl } from './translation-controller';

export interface ProcessingControllerOptions {
  onProgress?: (message: string) => void;
  onFileProgress?: (fileName: string, status: string, progress: number) => void;
  onSessionUpdate?: (session: EnhancedProcessingSession) => void;
  onPaused?: (sessionId: string) => void;
  onResumed?: (sessionId: string) => void;
  language?: 'zh' | 'en';
}

export interface ProcessingState {
  isProcessing: boolean;
  isPaused: boolean;
  currentFileIndex: number;
  totalFiles: number;
  currentSession?: EnhancedProcessingSession;
  results: ProcessingResult[];
}

export class EnhancedProcessingController {
  private sessionManager: EnhancedSessionManager;
  private logger: ProcessingLogger;
  private state: ProcessingState;
  private options: ProcessingControllerOptions;
  private abortController?: AbortController;
  private semaphoreManager?: TranslationSemaphoreManager;
  private translationController: TranslationControllerImpl;

  constructor(
    sessionManager: EnhancedSessionManager,
    options: ProcessingControllerOptions = {}
  ) {
    this.sessionManager = sessionManager;
    this.options = options;
    this.logger = new ProcessingLogger(
      options.onProgress,
      options.onFileProgress,
      options.language || 'zh'
    );
    this.translationController = new TranslationControllerImpl();

    this.state = {
      isProcessing: false,
      isPaused: false,
      currentFileIndex: 0,
      totalFiles: 0,
      results: []
    };
  }

  // 开始处理文件
  async startProcessing(
    files: File[],
    mistralKeys: string[],
    translationKeys: string[],
    translationModel: TranslationModel,
    targetLanguage: string,
    customTargetLanguage: string,
    settings: Settings
  ): Promise<ProcessingResult[]> {
    if (this.state.isProcessing) {
      throw new Error('Processing is already in progress');
    }

    // 创建新会话
    const session = await this.sessionManager.createEnhancedSession(
      `Processing Session - ${new Date().toLocaleString()}`,
      files,
      settings
    );

    return this.processWithSession(
      session,
      files,
      mistralKeys,
      translationKeys,
      translationModel,
      targetLanguage,
      customTargetLanguage,
      settings
    );
  }

  // 继续处理已暂停的会话
  async resumeProcessing(sessionId: string): Promise<ProcessingResult[]> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.isPaused) {
      throw new Error('Session is not paused');
    }

    // 恢复会话状态
    await this.sessionManager.resumeSession(sessionId);
    this.options.onResumed?.(sessionId);

    // 从暂停点继续处理
    return this.continueProcessingFromState(session);
  }



  // 获取翻译控制器
  getTranslationController(): TranslationControllerImpl {
    return this.translationController;
  }

  // 使用会话处理文件
  private async processWithSession(
    session: EnhancedProcessingSession,
    files: File[],
    mistralKeys: string[],
    translationKeys: string[],
    translationModel: TranslationModel,
    targetLanguage: string,
    customTargetLanguage: string,
    settings: Settings
  ): Promise<ProcessingResult[]> {
    this.state = {
      isProcessing: true,
      isPaused: false,
      currentFileIndex: 0,
      totalFiles: files.length,
      currentSession: session,
      results: []
    };

    this.abortController = new AbortController();
    this.semaphoreManager = new TranslationSemaphoreManager(settings.translationConcurrencyLevel);

    try {
      // 设置API Keys
      apiKeyManager.setKeys('mistral', mistralKeys);
      if (translationModel !== 'none') {
        apiKeyManager.setKeys('translation', translationKeys);
      }

      // 记录开始
      this.logger.logBatchStart(
        files.length,
        settings.concurrencyLevel || 3,
        settings.translationConcurrencyLevel || 4,
        3,
        settings.skipProcessedFiles || false
      );

      // 处理每个文件
      for (let i = 0; i < files.length; i++) {
        this.state.currentFileIndex = i;
        const file = files[i];

        this.logger.logFileStart(i + 1, files.length, file.name);

        try {
          // 保存当前文件到临时存储
          await this.sessionManager.saveTempFile(
            session.id,
            `current_file_${i}`,
            JSON.stringify({
              name: file.name,
              size: file.size,
              type: file.type,
              index: i
            })
          );

          const result = await processSinglePdf(
            file,
            apiKeyManager.getMistralKey(),
            translationModel !== 'none' ? apiKeyManager.getTranslationKey() : '',
            translationModel,
            settings.maxTokensPerChunk,
            targetLanguage === 'custom' ? customTargetLanguage : targetLanguage,
            this.semaphoreManager,
            settings,
            this.options.onProgress,
            this.options.onFileProgress,
            settings.saveLocation,
            this.options.language,
            this.translationController,
            session.id
          );

          this.state.results.push(result);

          // 更新会话记录
          if (session.records[i]) {
            session.records[i].status = result.success ? 'completed' : 'failed';
            session.records[i].progress = 100;
            session.records[i].endTime = Date.now();
            session.records[i].error = result.error;
          }

          // 保存中间结果
          if (result.success) {
            await this.sessionManager.saveTempFile(
              session.id,
              `result_${i}`,
              JSON.stringify(result)
            );
          }

          this.options.onSessionUpdate?.(session);

        } catch (error) {
          // 处理错误
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.logError(file.name, errorMessage);

          this.state.results.push({
            fileName: file.name,
            success: false,
            error: errorMessage,
            markdownContent: '',
            translationContent: '',
            imagesData: []
          });
        }
      }

      // 完成处理
      await this.completeProcessing(session, settings);

      return this.state.results;

    } catch (error) {
      this.logger.log(`Processing failed: ${error}`);
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.state.currentSession = undefined;
    }
  }

  // 从暂停状态继续处理
  private async continueProcessingFromState(
    session: EnhancedProcessingSession
  ): Promise<ProcessingResult[]> {
    // 加载保存的状态
    const snapshot = await this.sessionManager.loadStateSnapshot(session.id);
    if (!snapshot) {
      throw new Error('Failed to load session state');
    }

    // 恢复处理状态
    this.state = {
      isProcessing: true,
      isPaused: false,
      currentFileIndex: snapshot.translationState?.currentFileIndex || 0,
      totalFiles: session.totalFiles,
      currentSession: session,
      results: []
    };

    // 加载已完成的结果
    for (let i = 0; i < this.state.currentFileIndex; i++) {
      try {
        const resultData = await this.sessionManager.loadTempFile(session.id, `result_${i}`);
        if (resultData) {
          const result: ProcessingResult = JSON.parse(resultData);
          this.state.results.push(result);
        }
      } catch (error) {
        console.error(`Failed to load result ${i}:`, error);
      }
    }

    this.logger.log(`Resuming processing from file ${this.state.currentFileIndex + 1}/${this.state.totalFiles}`);

    // 继续处理剩余文件
    // 注意：这里需要重新获取文件列表，因为File对象无法序列化
    // 实际实现中可能需要用户重新选择文件或使用其他方式恢复文件引用

    return this.state.results;
  }

  // 保存当前进度
  private async saveCurrentProgress(): Promise<void> {
    if (!this.state.currentSession) {
      return;
    }

    const progressData = {
      currentFileIndex: this.state.currentFileIndex,
      totalFiles: this.state.totalFiles,
      completedResults: this.state.results.length,
      timestamp: Date.now()
    };

    await this.sessionManager.saveTempFile(
      this.state.currentSession.id,
      'progress',
      JSON.stringify(progressData)
    );
  }

  // 完成处理
  private async completeProcessing(
    session: EnhancedProcessingSession,
    settings: Settings
  ): Promise<void> {
    const successCount = this.state.results.filter(r => r.success).length;
    const failureCount = this.state.results.filter(r => !r.success).length;

    this.logger.logBatchComplete(successCount, failureCount, Date.now() - session.createdAt);

    // 自动保存ZIP文件
    if (successCount > 0 && settings.autoSaveCompleted) {
      try {
        const successfulResults = this.state.results.filter(r => r.success);
        const zipResult = await enhancedZipManager.createAndSaveZip(
          successfulResults,
          settings.saveLocation
        );

        if (zipResult.success) {
          this.logger.log(`ZIP file saved: ${zipResult.filePath}`);
        } else {
          this.logger.log(`ZIP creation failed: ${zipResult.error}`);
        }
      } catch (error) {
        this.logger.log(`ZIP auto-save failed: ${error}`);
      }
    }

    // 清理临时文件
    await this.sessionManager.cleanupSession(session.id);
  }

  // 获取当前状态
  getCurrentState(): ProcessingState {
    return { ...this.state };
  }


}

// 导出工厂函数
export function createEnhancedProcessingController(
  sessionManager: EnhancedSessionManager,
  options: ProcessingControllerOptions = {}
): EnhancedProcessingController {
  return new EnhancedProcessingController(sessionManager, options);
}
