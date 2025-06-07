// PDF 处理主流程与工具函数
import {
  ProcessingResult,
  ImageData,
  OcrResponse,
  ProcessedOcrResult,
  TranslationSemaphore,
  TranslationModel,
  Settings
} from '@/types/pdf-processor';
import {
  apiKeyManager,
  uploadToMistral,
  getMistralSignedUrl,
  callMistralOcr,
  deleteMistralFile,
  callTranslationApi,
  buildPredefinedApiConfig,
  buildCustomApiConfig
} from './api';
import { backupSystem, ProcessingSession } from './backup-system';
import { ProcessingLogger } from './logger';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getFinalTranslationPrompts } from './translation-prompts';
import { smartSplitTextIntoChunks, estimateTokenCount } from './document-splitter';
import { ConcurrentTranslationManager } from './concurrent-translation-manager';

// OCR 结果处理函数 - 修复为使用正确的字段名
export function processOcrResults(ocrData: OcrResponse): ProcessedOcrResult {
  let markdownContent = '';
  const images: ImageData[] = [];

  if (!ocrData.pages || ocrData.pages.length === 0) {
    return { markdown: '', images: [] };
  }

  try {
    console.log(`Processing OCR results for ${ocrData.pages.length} pages`);

    for (const page of ocrData.pages) {
      const pageImages: Record<string, string> = {};

      // 处理页面中的图片
      if (page.images && Array.isArray(page.images)) {
        console.log(`Page has ${page.images.length} images`);
        for (const img of page.images) {
          console.log(`Processing image:`, { id: img.id, hasBase64: !!img.image_base64, base64Length: img.image_base64?.length });
          if (img.id && img.image_base64) {
            const imgId = img.id;
            const imgData = img.image_base64;
            const imageData: ImageData = {
              filename: `${imgId}.png`,
              base64: imgData,
              mimeType: 'image/png'
            };
            images.push(imageData);
            // 记录图片 ID 到 markdown 路径的映射
            pageImages[imgId] = `images/${imgId}.png`;
            console.log(`Added image: ${imgId}, base64 length: ${imgData.length}`);
          } else {
            console.warn(`Skipping image due to missing id or base64:`, { id: img.id, hasBase64: !!img.image_base64 });
          }
        }
      } else {
        console.log(`Page has no images or images is not an array:`, { hasImages: !!page.images, isArray: Array.isArray(page.images) });
      }

      // 使用正确的字段名：page.markdown 而不是 page.text
      let pageMarkdown = page.markdown || '';

      // 替换图片引用路径
      for (const [imgName, imgPath] of Object.entries(pageImages)) {
        const escapedImgName = escapeRegex(imgName);
        const imgRegex = new RegExp(`!\\[([^\\]]*?)\\]\\(${escapedImgName}\\)`, 'g');
        pageMarkdown = pageMarkdown.replace(imgRegex, (match, altText) => {
          const finalAltText = altText || imgName;
          return `![${finalAltText}](${imgPath})`;
        });
      }

      markdownContent += pageMarkdown + '\n\n';
    }

    return { markdown: markdownContent.trim(), images };
  } catch (error) {
    console.error('处理OCR结果时出错:', error);
    return {
      markdown: `[错误：处理OCR结果时发生错误 - ${error instanceof Error ? error.message : String(error)}]`,
      images: []
    };
  }
}

// 正则表达式转义函数
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 根据文件名推断 MIME 类型
function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'image/png';
  }
}

// 文本分段函数（用于翻译）
export function splitTextIntoChunks(text: string, maxTokensPerChunk: number): string[] {
  if (!text || text.trim().length === 0) return [];

  // 简单的分段策略：按段落分割，然后合并到指定大小
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const estimatedTokens = estimateTokenCount(currentChunk + '\n\n' + paragraph);

    if (estimatedTokens > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// 注意：智能分割和token估算函数已移至 document-splitter.ts 文件中

// 翻译单个文本块（支持重试时切换密钥）
export async function translateTextChunk(
  chunk: string,
  model: TranslationModel,
  apiKey: string,
  targetLanguage: string,
  systemPrompt?: string,
  userPromptTemplate?: string,
  customSettings?: any,
  maxRetries: number = 3,
  excludeKeys: string[] = [],
  abortSignal?: AbortSignal
): Promise<string> {
  if (model === 'none') {
    return chunk; // 不翻译
  }

  let currentApiKey = apiKey;
  let lastError: Error | null = null;
  const usedKeys = new Set<string>([apiKey, ...excludeKeys]);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let config;
      if (model === 'custom' && customSettings) {
        config = buildCustomApiConfig(
          currentApiKey,
          customSettings.apiEndpoint,
          customSettings.modelId,
          customSettings.requestFormat,
          customSettings.temperature,
          customSettings.maxTokens
        );
      } else {
        config = buildPredefinedApiConfig(model, currentApiKey);
      }

      const requestBody = config.requestBuilder(chunk, targetLanguage, systemPrompt, userPromptTemplate);
      return await callTranslationApi(config, requestBody, abortSignal);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 记录密钥错误
      apiKeyManager.recordKeyError('translation', currentApiKey);

      // 如果还有重试机会，尝试获取新的密钥
      if (attempt < maxRetries) {
        const newKey = apiKeyManager.getSpecificKey('translation', Array.from(usedKeys));
        if (newKey) {
          currentApiKey = newKey;
          usedKeys.add(newKey);
          console.warn(`翻译失败，切换到新密钥重试 (尝试 ${attempt + 1}/${maxRetries}): ...${newKey.slice(-4)}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
        } else {
          // 没有更多可用密钥，直接抛出错误
          throw new Error(`翻译失败且无更多可用密钥: ${lastError.message}`);
        }
      }
    }
  }

  throw lastError || new Error('翻译失败');
}

// 并发翻译管理
export class TranslationSemaphoreManager {
  private semaphore: TranslationSemaphore;

  constructor(limit: number = 2) {
    this.semaphore = {
      limit,
      count: 0,
      queue: []
    };
  }

  async acquire(): Promise<void> {
    if (this.semaphore.count < this.semaphore.limit) {
      this.semaphore.count++;
      return Promise.resolve();
    } else {
      return new Promise(resolve => {
        this.semaphore.queue.push(resolve);
      });
    }
  }

  release(): void {
    this.semaphore.count--;
    if (this.semaphore.queue.length > 0) {
      const next = this.semaphore.queue.shift();
      if (next) {
        this.semaphore.count++;
        next();
      }
    }
  }

  updateLimit(newLimit: number): void {
    this.semaphore.limit = newLimit;
  }

  getLimit(): number {
    return this.semaphore.limit;
  }
}

// 获取目标语言的显示名称
export function getTargetLanguageName(targetLanguage: string, customLanguageName?: string): string {
  if (targetLanguage === 'custom' && customLanguageName) {
    return customLanguageName;
  }

  const languageNames: Record<string, string> = {
    'chinese': '中文',
    'english': 'English',
    'japanese': '日本語',
    'korean': '한국어',
    'french': 'Français'
  };

  return languageNames[targetLanguage] || targetLanguage;
}

// 创建下载文件
export async function createDownloadFiles(results: ProcessingResult[]): Promise<void> {
  if (results.length === 0) return;

  if (results.length === 1) {
    // 单个文件，直接下载
    const result = results[0];
    if (result.markdownContent) {
      const blob = new Blob([result.markdownContent], { type: 'text/markdown' });
      saveAs(blob, `${result.fileName}_markdown.md`);
    }
    if (result.translationContent) {
      const blob = new Blob([result.translationContent], { type: 'text/markdown' });
      saveAs(blob, `${result.fileName}_translation.md`);
    }
  } else {
    // 多个文件，打包为 ZIP
    const zip = new JSZip();

    results.forEach(result => {
      if (result.markdownContent) {
        zip.file(`${result.fileName}_markdown.md`, result.markdownContent);
      }
      if (result.translationContent) {
        zip.file(`${result.fileName}_translation.md`, result.translationContent);
      }
      if (result.imagesData && result.imagesData.length > 0) {
        const imagesFolder = zip.folder(`${result.fileName}_images`);
        result.imagesData.forEach(img => {
          if (imagesFolder) {
            imagesFolder.file(img.filename, img.base64, { base64: true });
          }
        });
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'pdf_processing_results.zip');
  }
}

// 单个 PDF 文件处理主流程（带备份系统和详细日志）
export async function processSinglePdf(
  file: File,
  mistralKey: string,
  translationKey: string,
  translationModel: TranslationModel,
  maxTokensPerChunk: number,
  targetLanguage: string,
  semaphoreManager: TranslationSemaphoreManager,
  settings: Settings,
  onProgress?: (message: string) => void,
  onFileProgress?: (fileName: string, status: string, progress: number) => void,
  saveDirectory?: string,
  language?: 'zh' | 'en',
  translationController?: import('./translation-controller').TranslationControllerImpl,
  sessionId?: string
): Promise<ProcessingResult> {
  let markdownContent = '';
  let translationContent = '';
  let imagesData: ImageData[] = [];
  let fileId: string | null = null;

  // 创建日志系统
  const logger = new ProcessingLogger(onProgress, onFileProgress, language || 'zh');

  // 创建处理会话和备份系统
  const session = backupSystem.createSession(file.name, saveDirectory);

  try {
    // 记录文件信息和状态变更
    logger.logFileInfo(file.name, file.size, file.type);
    logger.logStatusChange(file.name, '等待中', '开始处理', 0);
    logger.logApiKeyUsage(file.name, 'Mistral', mistralKey.slice(-4));

    // 备份点 1: 文件上传前
    await backupSystem.createBackupPoint(session.id, 'upload', {
      originalFile: file
    });
    logger.logBackupOperation(file.name, '创建', 'upload', true);

    // 1. 上传文件到 Mistral
    logger.logUploadStart(file.name, 'Mistral');
    logger.logStatusChange(file.name, '开始处理', '上传中', 10);

    const uploadStartTime = Date.now();
    fileId = await uploadToMistral(file, mistralKey);
    const uploadDuration = Date.now() - uploadStartTime;

    logger.logUploadSuccess(file.name, fileId);
    logger.logPerformanceStats(file.name, '文件上传', uploadDuration);
    logger.logStatusChange(file.name, '上传中', '上传完成', 20);

    // 2. 等待一秒钟让文件处理完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 获取签名 URL
    logger.logFileStep(file.name, '获取签名 URL...');
    logger.logStatusChange(file.name, '上传完成', '准备OCR', 25);
    const signedUrl = await getMistralSignedUrl(fileId, mistralKey);
    logger.logFileStep(file.name, '成功获取 URL');

    // 4. 调用 OCR
    logger.logOcrStart(file.name);
    logger.logStatusChange(file.name, '准备OCR', 'OCR处理中', 30);

    const ocrStartTime = Date.now();
    const ocrData = await callMistralOcr(signedUrl, mistralKey);
    const ocrDuration = Date.now() - ocrStartTime;

    logger.logOcrComplete(file.name);
    logger.logPerformanceStats(file.name, 'OCR处理', ocrDuration);
    logger.logStatusChange(file.name, 'OCR处理中', 'OCR完成', 50);

    // 5. 处理 OCR 结果
    logger.logFileStep(file.name, '处理 OCR 结果...');
    const processedOcr = processOcrResults(ocrData);
    markdownContent = processedOcr.markdown;
    imagesData = processedOcr.images;

    // 记录OCR统计信息
    const pageCount = ocrData.pages ? ocrData.pages.length : 0;
    const imageCount = imagesData.length;
    const textLength = markdownContent.length;
    logger.logOcrStats(file.name, pageCount, imageCount, textLength);
    logger.logMarkdownGeneration(file.name, textLength);
    logger.logStatusChange(file.name, 'OCR完成', 'Markdown生成完成', 60);

    // 保存图片到指定位置
    if (imagesData.length > 0) {
      logger.logImagesSaved(file.name, imagesData.length, '图片文件夹');
    }

    // 备份点 2: OCR 完成后
    await backupSystem.createBackupPoint(session.id, 'ocr', {
      fileId,
      markdownContent,
      imagesData
    });
    logger.logBackupOperation(file.name, '创建', 'ocr', true);

    // 6. 翻译（如果需要）
    logger.logFileStep(file.name, `翻译检查: 模型=${translationModel}, 内容长度=${markdownContent.length}, 密钥=${translationKey ? '已提供' : '未提供'}`);

    if (translationModel !== 'none' && markdownContent && translationKey) {
      logger.logStatusChange(file.name, 'Markdown生成完成', '准备翻译', 65);
      logger.logApiKeyUsage(file.name, '翻译', translationKey.slice(-4));
      logger.logTranslationConfig(file.name, translationModel, targetLanguage, maxTokensPerChunk);

      // 估算token数量并决定分割策略
      const estimatedTokens = estimateTokenCount(markdownContent);

      if (estimatedTokens > maxTokensPerChunk) {
        logger.logDocumentSegmentation(file.name, estimatedTokens, maxTokensPerChunk, 0);
      }

      // 智能分割文档，保持段落完整性（使用改进的分割算法）
      const chunks = smartSplitTextIntoChunks(markdownContent, maxTokensPerChunk, `[${file.name}]`);

      logger.logFileStep(file.name, `文档被分割为 ${chunks.length} 部分进行翻译`);
      logger.logStatusChange(file.name, '准备翻译', '翻译中', 70);

      // Check for existing translation progress if resuming
      let startChunkIndex = 0;
      let partialResults: string[] = [];

      if (translationController && sessionId) {
        const { loadTranslationProgress } = await import('./translation-controller');
        const savedProgress = await loadTranslationProgress(sessionId, file.name);

        if (savedProgress && savedProgress.chunks.length === chunks.length) {
          startChunkIndex = savedProgress.currentChunkIndex;
          partialResults = savedProgress.partialResults;
          logger.logFileStep(file.name, `恢复翻译进度: 从第 ${startChunkIndex + 1}/${chunks.length} 块开始`);
        }
      }

      const translationStartTime = Date.now();

      // 获取最终的翻译提示词
      const finalPrompts = getFinalTranslationPrompts(
        settings.targetLanguage,
        settings.customTargetLanguage,
        settings.useCustomPrompts,
        settings.defaultSystemPrompt,
        settings.defaultUserPromptTemplate
      );

      let translatedChunks: string[];

      // 根据设置决定使用并发翻译还是顺序翻译
      const availableTranslationKeys = apiKeyManager.getAvailableKeyCount('translation');
      const shouldUseConcurrent = chunks.length > 1 &&
                                  availableTranslationKeys > 1 &&
                                  settings.translationConcurrencyLevel > 1;

      if (shouldUseConcurrent) {
        // 使用并发翻译管理器
        logger.logFileStep(file.name, `使用并发翻译模式，可用密钥: ${availableTranslationKeys}，并发级别: ${settings.translationConcurrencyLevel}`);

        const concurrentManager = new ConcurrentTranslationManager(
          Math.min(settings.translationConcurrencyLevel, availableTranslationKeys),
          logger
        );

        translatedChunks = await concurrentManager.translateChunksConcurrently(
          chunks,
          file.name,
          translationModel,
          targetLanguage,
          settings,
          finalPrompts.systemPrompt,
          finalPrompts.userPromptTemplate,
          translationController
        );
      } else {
        // 使用传统的顺序翻译
        logger.logFileStep(file.name, `使用顺序翻译模式 (块数: ${chunks.length}, 可用密钥: ${availableTranslationKeys})`);

        // 初始化翻译结果数组，确保正确的长度和索引对应
        translatedChunks = new Array(chunks.length);

        // 如果有部分结果，先填充已完成的部分
        if (partialResults.length > 0) {
          for (let j = 0; j < Math.min(partialResults.length, startChunkIndex); j++) {
            translatedChunks[j] = partialResults[j];
          }
        }

        for (let i = startChunkIndex; i < chunks.length; i++) {
          const partIndex = i + 1;

          logger.logTranslationPartStart(file.name, partIndex, chunks.length, 1);
          await semaphoreManager.acquire();

          try {
            const chunkStartTime = Date.now();
            const translatedChunk = await translateTextChunk(
              chunks[i],
              translationModel,
              translationKey,
              targetLanguage,
              finalPrompts.systemPrompt,
              finalPrompts.userPromptTemplate,
              translationModel === 'custom' ? {
                apiEndpoint: settings.customApiEndpoint,
                modelId: settings.customModelId,
                requestFormat: settings.customRequestFormat,
                temperature: settings.customTemperature,
                maxTokens: settings.customMaxTokens
              } : undefined,
              3, // 最大重试次数
              [], // 不排除任何密钥
              translationController?.abortController?.signal
            );
            const chunkDuration = Date.now() - chunkStartTime;

            // 将翻译结果放在正确的索引位置
            translatedChunks[i] = translatedChunk;
            logger.logTranslationPartComplete(file.name, partIndex, chunks.length, true);

            logger.logPerformanceStats(file.name, `翻译块${partIndex}`, chunkDuration);

            // 更新翻译进度
            logger.logTranslationProgress(file.name, partIndex, chunks.length);
            const progressPercent = 70 + Math.round((partIndex / chunks.length) * 25); // 70-95%
            logger.logStatusChange(file.name, '翻译中', '翻译中', progressPercent);

          } finally {
            semaphoreManager.release();
          }
        }
      }

      // 过滤掉可能的undefined值，然后合并翻译结果
      translationContent = translatedChunks.filter(chunk => chunk != null && chunk.trim().length > 0).join('\n\n');
      const translationDuration = Date.now() - translationStartTime;

      logger.logTranslationComplete(file.name);
      logger.logTranslationStats(file.name, markdownContent.length, translationContent.length);
      logger.logPerformanceStats(file.name, '完整翻译', translationDuration);
      logger.logStatusChange(file.name, '翻译中', '翻译完成', 95);

      // 备份点 3: 翻译完成后
      await backupSystem.createBackupPoint(session.id, 'translation', {
        markdownContent,
        translationContent,
        imagesData
      });
      logger.logBackupOperation(file.name, '创建', 'translation', true);
    } else {
      logger.logFileStep(file.name, `跳过翻译原因: 模型=${translationModel}, 内容=${markdownContent ? '有' : '无'}, 密钥=${translationKey ? '有' : '无'}`);
      logger.logStatusChange(file.name, 'Markdown生成完成', '跳过翻译', 95);
    }

    // 7. 清理 Mistral 文件
    if (fileId) {
      logger.logFileStep(file.name, '清理临时文件...');
      try {
        await deleteMistralFile(fileId, mistralKey);
        logger.logCleanup(file.name, '临时文件', true);
      } catch (cleanupError) {
        logger.logCleanup(file.name, '临时文件', false);
        logger.logWarning(file.name, `清理失败: ${cleanupError}`);
      }
    }

    // 备份点 4: 处理完成，保存最终结果
    await backupSystem.createBackupPoint(session.id, 'complete', {
      markdownContent,
      translationContent,
      imagesData
    });
    logger.logBackupOperation(file.name, '创建', 'complete', true);

    // 标记会话完成
    backupSystem.completeSession(session.id);
    logger.logSessionInfo(session.id, file.name, '会话完成');

    // 详细的完成日志
    const hasTranslation = translationContent && translationContent.length > 0;
    const hasImages = imagesData && imagesData.length > 0;

    let completionDetails = '处理完成 - ';
    const completedTasks = [];

    if (markdownContent) completedTasks.push('OCR识别');
    if (hasTranslation) completedTasks.push('文本翻译');
    if (hasImages) completedTasks.push(`图片提取(${imagesData.length}张)`);

    completionDetails += completedTasks.join('、');
    completionDetails += '，文件已自动保存到指定目录';

    logger.logStatusChange(file.name, hasTranslation ? '翻译完成' : '跳过翻译', '处理完成', 100);
    logger.logFileComplete(file.name, true);
    logger.logFileStep(file.name, completionDetails);

    return {
      success: true,
      fileName: file.name.replace(/\.pdf$/i, ''),
      markdownContent,
      translationContent: translationContent || undefined,
      imagesData: imagesData.length > 0 ? imagesData : undefined,
      originalFile: file,
      fileUrl: URL.createObjectURL(file),
      sessionId: session.id
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logError(file.name, errorMessage);
    logger.logStatusChange(file.name, '处理中', '处理失败', 0);

    // 清理文件（如果有）
    if (fileId) {
      try {
        logger.logFileStep(file.name, '清理临时文件...');
        await deleteMistralFile(fileId, mistralKey);
        logger.logCleanup(file.name, '临时文件', true);
      } catch (cleanupError) {
        logger.logCleanup(file.name, '临时文件', false);
        logger.logWarning(file.name, `清理文件失败: ${cleanupError}`);
      }
    }

    logger.logFileComplete(file.name, false, errorMessage);

    // 标记会话失败
    backupSystem.completeSession(session.id, errorMessage);
    logger.logSessionInfo(session.id, file.name, '会话失败');

    return {
      success: false,
      fileName: file.name.replace(/\.pdf$/i, ''),
      error: errorMessage,
      originalFile: file,
      fileUrl: URL.createObjectURL(file),
      sessionId: session.id
    };
  }
}
