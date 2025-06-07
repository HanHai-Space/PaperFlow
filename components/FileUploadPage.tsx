'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Select, SelectItem } from '@heroui/select';
import { Divider } from '@heroui/divider';
import { useApp } from '@/contexts/AppContext';
import ProcessingSessionManager from './ProcessingSessionManager';
import {
  TranslationModel,
  TargetLanguage,
  ProcessingResult,
  ProcessingSession,
  Settings
} from '@/types/pdf-processor';
import {
  processSinglePdf,
  TranslationSemaphoreManager,
  createDownloadFiles,
  getTargetLanguageName
} from '@/lib/processing';
import { DocumentConcurrentManager } from '@/lib/document-concurrent-manager';
import { ProcessingLogger } from '@/lib/logger';
import {
  autoSaveProcessingResult,
  downloadProcessingResults,
  autoSaveZipFile
} from '@/lib/file-operations';
import { apiKeyManager } from '@/lib/api';
import {
  loadProcessedFilesRecord,
  saveProcessedFilesRecord,
  generateFileIdentifier,
  markFileAsProcessed,
  createProcessingSession,
  saveProcessingSession,
  updateProcessingRecord
} from '@/lib/storage';
import { selectPdfFiles, canUseTauriFileDialog, triggerBrowserFileSelect } from '@/lib/utils/file-dialog';
import { useErrorModal } from '@/components/ErrorModal';

interface FileUploadPageProps {
  mistralKeys: string[];
  translationKeys: string[];
  translationModel: TranslationModel;
  targetLanguage: TargetLanguage;
  customTargetLanguage: string;
  settings: Settings;
  onProgress?: (message: string) => void;
  onFileProgress?: (fileName: string, status: string, progress: number) => void;
  onProcessingStart?: (totalFiles: number) => void;
  onFileComplete?: () => void;
  onResults?: (results: ProcessingResult[]) => void;
  onTranslationControllerReady?: (controller: any) => void;
}

export default function FileUploadPage({
  mistralKeys,
  translationKeys,
  translationModel,
  targetLanguage,
  customTargetLanguage,
  settings,
  onProgress,
  onFileProgress,
  onProcessingStart,
  onFileComplete,
  onResults,
  onTranslationControllerReady
}: FileUploadPageProps) {
  const { t, language } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [currentSession, setCurrentSession] = useState<ProcessingSession | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 防止浏览器默认的拖拽行为
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGlobalDragEnter = (e: DragEvent) => {
      preventDefaults(e);
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      preventDefaults(e);
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      preventDefaults(e);
    };

    const handleGlobalDrop = (e: DragEvent) => {
      preventDefaults(e);
    };

    // 添加全局事件监听器
    document.addEventListener('dragenter', handleGlobalDragEnter);
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('dragleave', handleGlobalDragLeave);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      // 清理事件监听器
      document.removeEventListener('dragenter', handleGlobalDragEnter);
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('dragleave', handleGlobalDragLeave);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  // Tauri拖拽事件处理
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const setupTauriListeners = async () => {
        try {
          // 动态导入Tauri API
          const { listen } = await eval('import("@tauri-apps/api/event")');
          const { readBinaryFile } = await eval('import("@tauri-apps/api/fs")');

          // 监听文件拖拽事件
          const unlistenDrop = await listen('tauri-file-drop', (event: any) => {
            console.log('Tauri file drop:', event.payload);
            const filePaths = event.payload as string[];

            // 将文件路径转换为File对象
            const convertPathsToFiles = async () => {
              const files: File[] = [];
              for (const path of filePaths) {
                try {
                  // 使用Tauri的fs API读取文件
                  const fileData = await readBinaryFile(path);
                  const fileName = path.split(/[\\/]/).pop() || 'unknown.pdf';
                  const file = new File([fileData], fileName, { type: 'application/pdf' });
                  files.push(file);
                } catch (error) {
                  console.error('Failed to read file:', path, error);
                }
              }

              if (files.length > 0) {
                setFiles(prev => [...prev, ...files]);
                setIsDragOver(false);
              }
            };

            convertPathsToFiles();
          });

          // 监听文件悬停事件
          const unlistenHover = await listen('tauri-file-hover', (event: any) => {
            console.log('Tauri file hover:', event.payload);
            setIsDragOver(event.payload as boolean);
          });

          return () => {
            unlistenDrop();
            unlistenHover();
          };
        } catch (error) {
          console.error('Failed to setup Tauri listeners:', error);
        }
      };

      setupTauriListeners();
    }
  }, []);

  // 错误提示模态框
  const { showError, showWarning, showInfo, showSuccess, ErrorModal } = useErrorModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Translation controller
  const [translationController, setTranslationController] = useState<any>(null);

  // Initialize translation controller
  useEffect(() => {
    import('@/lib/translation-controller').then(({ TranslationControllerImpl }) => {
      const controller = new TranslationControllerImpl();
      setTranslationController(controller);
      onTranslationControllerReady?.(controller);
    });
  }, []); // Remove onTranslationControllerReady from dependencies to prevent infinite loop

  // 文件处理
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const pdfFiles = Array.from(selectedFiles).filter(file =>
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    setFiles(prev => [...prev, ...pdfFiles]);
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      console.log('Files dropped:', files.length);
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 确保允许拖放
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 检查是否真的离开了拖放区域
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  // 使用 Tauri 文件选择对话框
  const handleBrowseFiles = useCallback(async () => {
    try {
      if (canUseTauriFileDialog()) {
        // 使用 Tauri 文件对话框
        const selectedFiles = await selectPdfFiles();
        if (selectedFiles.length > 0) {
          setFiles(prev => [...prev, ...selectedFiles]);
        }
      } else {
        // 使用浏览器原生文件选择
        const selectedFiles = await triggerBrowserFileSelect('.pdf', true);
        if (selectedFiles.length > 0) {
          const pdfFiles = selectedFiles.filter(file =>
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
          );
          setFiles(prev => [...prev, ...pdfFiles]);
        }
      }
    } catch (error) {
      console.error('Failed to select files:', error);
      // 备用方案：触发原生 input
      fileInputRef.current?.click();
    }
  }, []);

  // 处理会话管理
  const handleResumeSession = useCallback((session: ProcessingSession) => {
    setCurrentSession(session);
    // 从会话中恢复文件列表（这里需要根据实际需求实现）
    // 注意：由于浏览器安全限制，我们无法直接恢复File对象
    // 可以显示文件名列表，让用户重新选择文件
    console.log('Resume session:', session);
  }, []);

  const handleShowSessionManager = useCallback(() => {
    setShowSessionManager(true);
  }, []);

  // 处理开始
  const handleProcess = useCallback(async () => {
    if (isProcessing) return;

    // 验证输入
    if (mistralKeys.length === 0) {
      showWarning('请在设置页面配置至少一个 Mistral API Key', '配置检查');
      return;
    }

    if (translationModel !== 'none' && translationKeys.length === 0) {
      showWarning('选择了翻译模型，请在设置页面配置至少一个翻译 API Key', '配置检查');
      return;
    }

    if (files.length === 0) {
      showWarning('请选择至少一个 PDF 文件', '文件选择');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    // 通知开始处理
    onProcessingStart?.(files.length);

    // 创建批量处理日志系统
    const batchLogger = new ProcessingLogger(onProgress, undefined, language);
    const startTime = Date.now();

    try {
      // 记录批量处理开始
      batchLogger.logBatchStart(
        files.length,
        settings.concurrencyLevel || 3,
        settings.translationConcurrencyLevel || 4,
        3, // 最大重试次数
        settings.skipProcessedFiles || false
      );

      // 设置 API Keys
      apiKeyManager.setKeys('mistral', mistralKeys);
      if (translationModel !== 'none') {
        apiKeyManager.setKeys('translation', translationKeys);
      }

      // 创建处理会话
      const sessionName = `Processing Session - ${new Date().toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}`;
      const session = createProcessingSession(sessionName, files, {
        ...settings,
        translationModel,
        targetLanguage,
        customTargetLanguage
      });
      setCurrentSession(session);
      await saveProcessingSession(session);

      // 处理文件
      const processedFilesRecord = loadProcessedFilesRecord();
      const effectiveTargetLanguage = getTargetLanguageName(targetLanguage, customTargetLanguage);
      let newResults: ProcessingResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      // 根据设置决定使用文档级并发还是顺序处理
      const availableMistralKeys = apiKeyManager.getAvailableKeyCount('mistral');
      const availableTranslationKeys = translationModel !== 'none'
        ? apiKeyManager.getAvailableKeyCount('translation')
        : files.length;

      const shouldUseDocumentConcurrency = files.length > 1 &&
                                          availableMistralKeys > 1 &&
                                          settings.concurrencyLevel > 1;

      if (shouldUseDocumentConcurrency) {
        // 使用文档级并发处理
        batchLogger.log(`使用文档级并发处理模式，可用Mistral密钥: ${availableMistralKeys}，可用翻译密钥: ${availableTranslationKeys}，并发级别: ${settings.concurrencyLevel}`);

        const documentManager = new DocumentConcurrentManager(
          Math.min(settings.concurrencyLevel, availableMistralKeys),
          settings.translationConcurrencyLevel,
          batchLogger,
          settings
        );

        newResults = await documentManager.processDocumentsConcurrently(
          files,
          translationModel,
          targetLanguage,
          customTargetLanguage,
          onProgress,
          onFileProgress,
          settings.saveLocation,
          language,
          translationController
        );

        // 更新处理记录
        for (let i = 0; i < newResults.length; i++) {
          const result = newResults[i];
          const recordId = session.records[i].id;

          if (result.success) {
            successCount++;
            const fileIdentifier = generateFileIdentifier(files[i]);
            markFileAsProcessed(fileIdentifier, processedFilesRecord);

            await updateProcessingRecord(session.id, recordId, {
              status: 'completed',
              progress: 100,
              endTime: Date.now(),
              processingResult: result
            });
          } else {
            failureCount++;
            await updateProcessingRecord(session.id, recordId, {
              status: 'failed',
              progress: 0,
              endTime: Date.now(),
              error: result.error
            });
          }
        }
      } else {
        // 使用传统的顺序处理
        batchLogger.log(`使用顺序处理模式 (文件数: ${files.length}, 可用Mistral密钥: ${availableMistralKeys}, 可用翻译密钥: ${availableTranslationKeys})`);

        const semaphoreManager = new TranslationSemaphoreManager(settings.translationConcurrencyLevel);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileIdentifier = generateFileIdentifier(file);
          const recordId = session.records[i].id;

          // 记录文件处理开始
          batchLogger.logFileStart(i + 1, files.length, file.name);
          batchLogger.logFileInfo(file.name, file.size, file.type);

          // 更新记录状态为处理中
          updateProcessingRecord(session.id, recordId, {
            status: 'processing',
            progress: 0
          });
          batchLogger.logStatusChange(file.name, 'pending', 'processing', 0);

          const mistralKey = apiKeyManager.getMistralKey();
          const translationKey = translationModel !== 'none' ? apiKeyManager.getTranslationKey() : '';

          const result = await processSinglePdf(
            file,
            mistralKey,
            translationKey,
            translationModel,
            settings.maxTokensPerChunk,
            effectiveTargetLanguage,
            semaphoreManager,
            settings,
            (message: string) => {
              // 转发进度消息到批量日志
              onProgress?.(message);
            },
            (fileName: string, status: string, progress: number) => {
              // 转发文件进度到进度显示组件
              onFileProgress?.(fileName, status, progress);
            },
            settings.saveLocation,
            language,
            translationController
          );

          newResults.push(result);

          if (result.success) {
            successCount++;
            markFileAsProcessed(fileIdentifier, processedFilesRecord);

            // 更新记录状态为完成，并保存处理结果
            updateProcessingRecord(session.id, recordId, {
              status: 'completed',
              progress: 100,
              endTime: Date.now(),
              processingResult: result
            });
            batchLogger.logStatusChange(file.name, 'processing', 'completed', 100);
          } else {
            failureCount++;
            // 更新记录状态为失败
            updateProcessingRecord(session.id, recordId, {
              status: 'failed',
              progress: 0,
              endTime: Date.now(),
              error: result.error
            });
            batchLogger.logStatusChange(file.name, 'processing', 'failed', 0);
            batchLogger.logError(file.name, result.error || 'Unknown error');
          }

          // 通知文件处理完成
          onFileComplete?.();

          // 记录处理进度
          const t = batchLogger.t();
          batchLogger.log(`${t.logs.batchProgress}: ${successCount + failureCount}/${files.length} ${t.logs.filesProcessed}`);
        }
      }

      // 自动保存完成的文件
      if (settings.autoSaveCompleted) {
        const successfulResults = newResults.filter(result => result.success);
        for (const result of successfulResults) {
          try {
            batchLogger.logSaveStart(result.fileName, settings.saveLocation);
            await autoSaveProcessingResult(result, settings);
            batchLogger.logSaveSuccess(result.fileName, settings.saveLocation, 'Processing result');

            // 如果启用了Google Drive自动上传，立即上传单个文件的ZIP包
            if (settings.enableGoogleDrive && settings.googleDriveAutoUpload) {
              try {
                batchLogger.log('开始为单个文件创建ZIP并上传到Google Drive...');
                const { createSingleFileZip } = await import('@/lib/single-file-zip');
                const zipResult = await createSingleFileZip(result, settings);

                if (zipResult.success) {
                  batchLogger.log(`✅ 文件已成功上传到 Google Drive: ${zipResult.fileName}`);
                  if (zipResult.webViewLink) {
                    batchLogger.log(`🔗 Google Drive 链接: ${zipResult.webViewLink}`);
                  }
                } else {
                  batchLogger.log(`❌ Google Drive 上传失败: ${zipResult.error}`);
                }
              } catch (uploadError) {
                console.error('Individual file Google Drive upload failed:', uploadError);
                batchLogger.log(`❌ Google Drive 上传失败: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
              }
            }
          } catch (error) {
            console.error('Auto-save failed:', error);
            batchLogger.logSaveFailure(result.fileName, 'Processing result', error instanceof Error ? error.message : String(error));
          }
        }
      }

      // 保存处理记录
      saveProcessedFilesRecord(processedFilesRecord);

      // 记录批量处理完成
      const totalTime = Date.now() - startTime;
      batchLogger.logBatchComplete(successCount, failureCount, totalTime);

      // 自动保存 ZIP 文件（如果有成功的结果）
      const successfulResults = newResults.filter(result => result.success);
      if (successfulResults.length > 0 && settings.autoSaveCompleted) {
        try {
          const t = batchLogger.t();
          batchLogger.logZipOperation(t.logs.zipCreating, successfulResults.length);
          batchLogger.log(`Creating ZIP package with ${successfulResults.length} files...`);
          const zipStartTime = Date.now();
          const zipSaved = await autoSaveZipFile(successfulResults, settings);
          const zipDuration = Date.now() - zipStartTime;

            batchLogger.logZipOperation(t.logs.zipCreated, successfulResults.length);
            batchLogger.logPerformanceStats('Batch processing', 'ZIP file creation', zipDuration);

          // if (zipSaved) {
          //   batchLogger.logZipOperation(t.logs.zipCreated, successfulResults.length);
          //   batchLogger.logPerformanceStats('Batch processing', 'ZIP file creation', zipDuration);
          //   batchLogger.log(`✅ ${t.logs.zipSaved} ${settings.saveLocation}`);
          // } else {
          //   batchLogger.logZipOperation(t.logs.zipFailed, successfulResults.length);
          //   // batchLogger.logError('ZIP save', 'ZIP file save failed, please check save path settings and permissions');
          // }
        } catch (error) {
          console.error('Auto-save ZIP failed:', error);
          const t = batchLogger.t();
          batchLogger.logZipOperation(t.logs.zipFailed, successfulResults.length);
          batchLogger.logError('ZIP save', `ZIP file auto-save failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (successfulResults.length === 0) {
        batchLogger.log('No successfully processed files, skipping ZIP file creation');
      } else if (!settings.autoSaveCompleted) {
        batchLogger.log('Auto-save disabled, skipping ZIP file creation');
      }

      setResults(newResults);
      onResults?.(newResults);

      // 通知处理完成
      const t = batchLogger.t();
      onProgress?.(t.logs.batchProcessingComplete);
      onProgress?.(`${t.logs.success}: ${successCount} ${t.logs.filesProcessed}`);
      if (failureCount > 0) {
        onProgress?.(`${t.logs.failure}: ${failureCount} ${t.logs.filesProcessed}`);
      }
      onProgress?.(`${t.logs.totalTime}: ${Math.round(totalTime / 1000)} ${t.logs.duration}`);

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      batchLogger.log(`Error occurred during batch processing: ${errorMessage}`);
      onProgress?.(`Error occurred during processing: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    mistralKeys,
    translationKeys,
    translationModel,
    files,
    settings,
    targetLanguage,
    customTargetLanguage,
    onProgress,
    onResults
  ]);



  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* 翻译设置快速选择 */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.723 1.447a1 1 0 11-1.79-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.translationSettings}</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                {t.translationModel}
              </label>
              <Select
                selectedKeys={[translationModel]}
                isDisabled
                variant="bordered"
                classNames={{
                  trigger: "bg-background/50 border-divider"
                }}
              >
                <SelectItem key={translationModel}>
                  {translationModel === 'none' ? t.noTranslation :
                   translationModel === 'mistral' ? 'Mistral Large' :
                   translationModel === 'deepseek' ? 'DeepSeek v3' :
                   translationModel === 'gemini' ? 'Gemini 2.0 Flash' :
                   translationModel === 'claude' ? 'Claude 3.5 Sonnet' :
                   translationModel === 'tongyi-deepseek-v3' ? '通义百炼 DeepSeek v3' :
                   translationModel === 'volcano-deepseek-v3' ? '火山引擎 DeepSeek v3' :
                   translationModel === 'chutes-deepseek-v3' ? 'Chutes AI DeepSeek v3' :
                   translationModel === 'custom' ? t.customModel : translationModel}
                </SelectItem>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                {t.targetLanguage}
              </label>
              <Select
                selectedKeys={[targetLanguage]}
                isDisabled
                variant="bordered"
                classNames={{
                  trigger: "bg-background/50 border-divider"
                }}
              >
                <SelectItem key={targetLanguage}>
                  {targetLanguage === 'chinese' ? t.chinese :
                   targetLanguage === 'english' ? t.english :
                   targetLanguage === 'japanese' ? '日本語' :
                   targetLanguage === 'korean' ? '한국어' :
                   targetLanguage === 'french' ? 'Français' :
                   targetLanguage === 'custom' ? customTargetLanguage || t.customLanguage : targetLanguage}
                </SelectItem>
              </Select>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 {t.systemSettings}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* PDF 文件上传区域 */}
      <Card className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-green-200 dark:border-green-800">
        <CardHeader className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                <path d="M6 8h8v2H6V8zm0 3h8v1H6v-1z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.fileUploadMultiple}</h2>
          </div>
          {settings.enableProcessingRecord && (
            <Button
              color="secondary"
              variant="bordered"
              size="sm"
              onPress={handleShowSessionManager}
              startContent={
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd" />
                </svg>
              }
            >
              {t.processingRecords}
            </Button>
          )}
        </CardHeader>
        <CardBody className="space-y-6">
          <div
            className={`
              border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer group
              ${isDragOver
                ? 'border-primary bg-primary/10 scale-105'
                : 'border-primary/30 hover:border-primary/60 hover:bg-primary/5'
              }
            `}
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onClick={handleBrowseFiles}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <div className={`
              mx-auto mb-6 w-20 h-20 flex items-center justify-center rounded-full transition-all duration-300
              ${isDragOver
                ? 'bg-gradient-to-br from-primary/30 to-secondary/30 scale-110'
                : 'bg-gradient-to-br from-primary/10 to-secondary/10 group-hover:from-primary/20 group-hover:to-secondary/20'
              }
            `}>
              <svg className={`w-10 h-10 transition-all duration-300 ${isDragOver ? 'text-primary scale-110' : 'text-primary'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className={`text-xl font-semibold mb-2 transition-colors ${isDragOver ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
              {isDragOver ? '松开以上传文件' : t.dragDropFiles}
            </h3>
            <p className="text-foreground/60 mb-6">
              {isDragOver ? '支持 PDF 格式文件' : t.browseFiles}
            </p>
            <Button
              color="primary"
              size="lg"
              className="font-semibold"
              onPress={handleBrowseFiles}
              startContent={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              }
            >
              {t.browseFiles}
            </Button>
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <Card>
              <CardHeader className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground/70">已选文件:</span>
                <Button size="sm" color="danger" variant="light" onPress={clearFiles}>
                  清空列表
                </Button>
              </CardHeader>
              <CardBody>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-content2 hover:bg-content3 rounded-lg transition-colors">
                      <div className="flex items-center overflow-hidden mr-2">
                        <svg className="w-5 h-5 text-danger mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                          <path d="M6 8h8v2H6V8zm0 3h8v1H6v-1z" />
                        </svg>
                        <span className="text-sm text-foreground truncate" title={file.name}>
                          {file.name}
                        </span>
                        <Chip size="sm" variant="flat" color="default" className="ml-2">
                          {formatFileSize(file.size)}
                        </Chip>
                      </div>
                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        onPress={() => removeFile(index)}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* 处理按钮 */}
          <div className="flex justify-center">
            <Button
              color="primary"
              size="lg"
              onPress={handleProcess}
              isDisabled={files.length === 0 || mistralKeys.length === 0 || isProcessing}
              isLoading={isProcessing}
              className={`
                relative overflow-hidden transition-all duration-300 font-semibold
                ${isProcessing ? 'animate-pulse-enhanced' : 'hover:scale-105 hover:shadow-lg'}
                ${isProcessing ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-gradient-x' : ''}
                ${!isProcessing ? 'hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600' : ''}
              `}
              startContent={
                isProcessing ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce-dots"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce-dots"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce-dots"></div>
                  </div>
                ) : (
                  <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                )
              }
            >
              {isProcessing ? t.processing : t.startProcessing}
            </Button>
          </div>

          {/* 处理结果提示 */}
          {results.length > 0 && (
            <>
              <Divider />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-4">处理完成</h3>
                <p className="text-foreground/70 mb-4">
                  成功处理 {results.filter(r => r.success).length} 个文件，
                  失败 {results.filter(r => !r.success).length} 个文件
                </p>
                {settings.autoSaveCompleted && (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center space-x-2 text-success">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">文件已自动保存到: {settings.saveLocation}</span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-foreground/60">
                  可以通过顶部导航切换到查看页面查看处理结果
                </p>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* 处理会话管理器 */}
      <ProcessingSessionManager
        isVisible={showSessionManager}
        onClose={() => setShowSessionManager(false)}
        onResumeSession={handleResumeSession}
        onViewResult={(result) => {
          // 将结果传递给父组件以在查看器中显示
          onResults?.([result]);
        }}
        settings={settings}
      />

      {/* 错误提示模态框 */}
      <ErrorModal />
    </div>
  );
}
