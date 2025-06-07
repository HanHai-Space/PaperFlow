// 备份系统 - 在每个主要处理步骤创建备份点
import { ProcessingResult, ImageData, Settings } from '@/types/pdf-processor';
import { safeTauriInvoke, isTauriApp } from '@/lib/tauri-utils';
import { translateFileName, generateFileNames, sanitizeFileName } from './filename-translator';
import { apiKeyManager } from './api';

export interface BackupPoint {
  id: string;
  timestamp: Date;
  step: 'upload' | 'ocr' | 'translation' | 'complete';
  fileName: string;
  data: {
    originalFile?: File;
    fileId?: string;
    markdownContent?: string;
    translationContent?: string;
    imagesData?: ImageData[];
    error?: string;
  };
}

export interface ProcessingSession {
  id: string;
  fileName: string;
  startTime: Date;
  saveDirectory: string;
  backupPoints: BackupPoint[];
  currentStep: string;
  isComplete: boolean;
  error?: string;
}

class BackupSystemManager {
  private sessions: Map<string, ProcessingSession> = new Map();
  private defaultSaveDirectory: string = '';

  constructor() {
    this.loadSessions();
    this.initializeDefaultDirectory();
  }

  private async initializeDefaultDirectory() {
    if (isTauriApp()) {
      try {
        // 获取默认下载目录
        const downloadDir = await safeTauriInvoke('get_download_dir');
        this.defaultSaveDirectory = downloadDir || 'C:/download';
      } catch (error) {
        console.warn('Failed to get download directory:', error);
        this.defaultSaveDirectory = 'C:/download';
      }
    } else {
      this.defaultSaveDirectory = 'downloads';
    }
  }

  // 创建新的处理会话
  createSession(fileName: string, saveDirectory?: string): ProcessingSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: ProcessingSession = {
      id: sessionId,
      fileName,
      startTime: new Date(),
      saveDirectory: saveDirectory || this.defaultSaveDirectory,
      backupPoints: [],
      currentStep: 'upload',
      isComplete: false
    };

    this.sessions.set(sessionId, session);
    this.saveSessions();
    return session;
  }

  // 创建备份点
  async createBackupPoint(
    sessionId: string,
    step: BackupPoint['step'],
    data: BackupPoint['data']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const backupPoint: BackupPoint = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      step,
      fileName: session.fileName,
      data
    };

    session.backupPoints.push(backupPoint);
    session.currentStep = step;

    // 保存备份点到文件系统
    await this.saveBackupPointToFile(session, backupPoint);

    this.saveSessions();
  }

  // 保存备份点到文件系统
  private async saveBackupPointToFile(session: ProcessingSession, backupPoint: BackupPoint): Promise<void> {
    try {
      const baseFileName = session.fileName.replace(/\.pdf$/i, '');
      const safeFolderName = baseFileName.replace(/[/\\:*?"<>|]/g, '_').substring(0, 100);
      const backupDir = `${session.saveDirectory}/${safeFolderName}/backups`;

      if (isTauriApp()) {
        // 确保目录存在
        await safeTauriInvoke('create_dir_all', { path: backupDir });

        // 保存不同类型的数据
        switch (backupPoint.step) {
          case 'upload':
            if (backupPoint.data.originalFile) {
              const fileBuffer = await backupPoint.data.originalFile.arrayBuffer();
              await safeTauriInvoke('write_binary_file', {
                path: `${backupDir}/original_file.pdf`,
                data: Array.from(new Uint8Array(fileBuffer))
              });
            }
            break;

          case 'ocr':
            if (backupPoint.data.markdownContent) {
              await safeTauriInvoke('write_text_file', {
                path: `${backupDir}/ocr_result.md`,
                data: backupPoint.data.markdownContent
              });
            }
            if (backupPoint.data.imagesData && backupPoint.data.imagesData.length > 0) {
              const imagesDir = `${backupDir}/images`;
              await safeTauriInvoke('create_dir_all', { path: imagesDir });

              for (const img of backupPoint.data.imagesData) {
                const base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                await safeTauriInvoke('write_binary_file', {
                  path: `${imagesDir}/${img.filename}`,
                  data: Array.from(imageBuffer)
                });
              }
            }
            break;

          case 'translation':
            if (backupPoint.data.translationContent) {
              await safeTauriInvoke('write_text_file', {
                path: `${backupDir}/translation_result.md`,
                data: backupPoint.data.translationContent
              });
            }
            break;

          case 'complete':
            // 保存完整的处理结果
            await this.saveCompleteResult(session, backupPoint);
            break;
        }

        // 保存备份点元数据
        await safeTauriInvoke('write_text_file', {
          path: `${backupDir}/backup_${backupPoint.step}.json`,
          data: JSON.stringify({
            id: backupPoint.id,
            timestamp: backupPoint.timestamp,
            step: backupPoint.step,
            fileName: backupPoint.fileName,
            hasOriginalFile: !!backupPoint.data.originalFile,
            hasMarkdown: !!backupPoint.data.markdownContent,
            hasTranslation: !!backupPoint.data.translationContent,
            hasImages: !!(backupPoint.data.imagesData && backupPoint.data.imagesData.length > 0),
            error: backupPoint.data.error
          }, null, 2)
        });
      }
    } catch (error) {
      console.error('Failed to save backup point to file:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  // 保存完整的处理结果
  private async saveCompleteResult(session: ProcessingSession, backupPoint: BackupPoint): Promise<void> {
    const baseFileName = session.fileName.replace(/\.pdf$/i, '');
    const safeFolderName = sanitizeFileName(baseFileName);
    const resultDir = `${session.saveDirectory}/${safeFolderName}`;

    if (isTauriApp()) {
      await safeTauriInvoke('create_dir_all', { path: resultDir });

      // 获取文件名翻译
      let translatedName = baseFileName;
      try {
        if (backupPoint.data.translationContent) {
          const translationKey = apiKeyManager.getTranslationKey();
          if (translationKey) {
            const translationResult = await translateFileName(
              session.fileName,
              'claude', // 使用默认模型进行文件名翻译
              translationKey,
              'chinese', // 默认翻译为中文
            );

            if (translationResult.success) {
              translatedName = translationResult.translatedName;
            }
          }
        }
      } catch (error) {
        console.warn('备份时文件名翻译失败，使用原始文件名:', error);
      }

      // 生成文件名
      const fileNames = generateFileNames(session.fileName, translatedName);

      // 保存 Markdown 文件
      if (backupPoint.data.markdownContent) {
        await safeTauriInvoke('write_text_file', {
          path: `${resultDir}/${fileNames.markdownFileName}`,
          data: backupPoint.data.markdownContent
        });
      }

      // 保存翻译文件
      if (backupPoint.data.translationContent) {
        await safeTauriInvoke('write_text_file', {
          path: `${resultDir}/${fileNames.translationFileName}`,
          data: backupPoint.data.translationContent
        });
      }

      // 保存图片
      if (backupPoint.data.imagesData && backupPoint.data.imagesData.length > 0) {
        const imagesDir = `${resultDir}/images`;
        await safeTauriInvoke('create_dir_all', { path: imagesDir });

        for (const img of backupPoint.data.imagesData) {
          const base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          await safeTauriInvoke('write_binary_file', {
            path: `${imagesDir}/${img.filename}`,
            data: Array.from(imageBuffer)
          });
        }
      }
    }
  }

  // 从备份点恢复处理
  async recoverFromBackupPoint(sessionId: string, backupPointId: string): Promise<BackupPoint | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const backupPoint = session.backupPoints.find(bp => bp.id === backupPointId);
    return backupPoint || null;
  }

  // 获取会话的最新备份点
  getLatestBackupPoint(sessionId: string): BackupPoint | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.backupPoints.length === 0) return null;

    return session.backupPoints[session.backupPoints.length - 1];
  }

  // 标记会话完成
  completeSession(sessionId: string, error?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isComplete = true;
      session.error = error;
      this.saveSessions();
    }
  }

  // 获取所有会话
  getAllSessions(): ProcessingSession[] {
    return Array.from(this.sessions.values());
  }

  // 获取未完成的会话
  getIncompleteSessions(): ProcessingSession[] {
    return Array.from(this.sessions.values()).filter(session => !session.isComplete);
  }

  // 删除会话
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.saveSessions();
  }

  // 保存会话到本地存储
  private saveSessions(): void {
    if (typeof window === 'undefined') return; // 服务端渲染时跳过

    try {
      if (isTauriApp()) {
        // 在Tauri环境中，将完整数据保存到文件系统
        this.saveSessionsToFile();
      } else {
        // 在浏览器环境中，只保存基本信息到localStorage
        this.saveSessionsToLocalStorage();
      }
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }

  // 保存会话到文件系统（Tauri环境）
  private async saveSessionsToFile(): Promise<void> {
    try {
      const sessionsData = Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
        ...session,
        backupPoints: session.backupPoints.map(bp => ({
          ...bp,
          data: {
            ...bp.data,
            originalFile: undefined // 不保存文件对象
          }
        }))
      }));

      const dataString = JSON.stringify(sessionsData, null, 2);
      const sessionsFilePath = `${this.defaultSaveDirectory}/processing_sessions.json`;

      await safeTauriInvoke('write_text_file', {
        path: sessionsFilePath,
        data: dataString
      });

      // 在localStorage中只保存会话索引
      const sessionIndex = Array.from(this.sessions.keys());
      localStorage.setItem('processing_sessions_index', JSON.stringify(sessionIndex));

      console.log(`Sessions saved to file: ${sessionsFilePath}`);
    } catch (error) {
      console.error('Failed to save sessions to file:', error);
      // 降级到localStorage保存
      this.saveSessionsToLocalStorage();
    }
  }

  // 保存会话到localStorage（浏览器环境或降级方案）
  private saveSessionsToLocalStorage(): void {
    try {
      // 只保存基本会话信息，不包含大数据
      const sessionsData = Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
        id: session.id,
        fileName: session.fileName,
        startTime: session.startTime,
        saveDirectory: session.saveDirectory,
        currentStep: session.currentStep,
        isComplete: session.isComplete,
        error: session.error,
        backupPointsCount: session.backupPoints.length // 只保存备份点数量
      }));

      localStorage.setItem('processing_sessions', JSON.stringify(sessionsData));
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error);
    }
  }

  // 从本地存储加载会话
  private loadSessions(): void {
    if (typeof window === 'undefined') return; // 服务端渲染时跳过

    if (isTauriApp()) {
      // 在Tauri环境中，从文件系统加载
      this.loadSessionsFromFile();
    } else {
      // 在浏览器环境中，从localStorage加载
      this.loadSessionsFromLocalStorage();
    }
  }

  // 从文件系统加载会话（Tauri环境）
  private async loadSessionsFromFile(): Promise<void> {
    try {
      const sessionsFilePath = `${this.defaultSaveDirectory}/processing_sessions.json`;

      // 检查文件是否存在
      const fileExists = await safeTauriInvoke('exists', { path: sessionsFilePath });
      if (!fileExists) {
        console.log('No sessions file found, starting fresh');
        return;
      }

      const sessionsData = await safeTauriInvoke('read_text_file', { path: sessionsFilePath });
      const sessions = JSON.parse(sessionsData);

      sessions.forEach((sessionData: any) => {
        const session: ProcessingSession = {
          ...sessionData,
          startTime: new Date(sessionData.startTime),
          backupPoints: sessionData.backupPoints ? sessionData.backupPoints.map((bp: any) => ({
            ...bp,
            timestamp: new Date(bp.timestamp)
          })) : []
        };
        this.sessions.set(session.id, session);
      });

      console.log(`Loaded ${sessions.length} sessions from file`);
    } catch (error) {
      console.error('Failed to load sessions from file:', error);
      // 降级到localStorage加载
      this.loadSessionsFromLocalStorage();
    }
  }

  // 从localStorage加载会话（浏览器环境或降级方案）
  private loadSessionsFromLocalStorage(): void {
    try {
      const sessionsData = localStorage.getItem('processing_sessions');
      if (sessionsData) {
        const sessions = JSON.parse(sessionsData);
        sessions.forEach((sessionData: any) => {
          const session: ProcessingSession = {
            ...sessionData,
            startTime: new Date(sessionData.startTime),
            backupPoints: sessionData.backupPoints ? sessionData.backupPoints.map((bp: any) => ({
              ...bp,
              timestamp: new Date(bp.timestamp)
            })) : []
          };
          this.sessions.set(session.id, session);
        });
      }
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error);
    }
  }

  // 清理旧会话（超过30天的已完成会话）
  cleanupOldSessions(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionsToDelete: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (session.isComplete && session.startTime < thirtyDaysAgo) {
        sessionsToDelete.push(sessionId);
      }
    });

    sessionsToDelete.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });

    if (sessionsToDelete.length > 0) {
      console.log(`Cleaned up ${sessionsToDelete.length} old sessions`);
      this.saveSessions();
    }
  }

  // 获取存储使用情况
  getStorageUsage(): { used: number; total: number; percentage: number } {
    if (isTauriApp()) {
      // 在Tauri环境中，返回文件大小信息
      return { used: 0, total: 0, percentage: 0 }; // 文件系统没有严格限制
    } else {
      // 在浏览器环境中，检查localStorage使用情况
      try {
        const data = localStorage.getItem('processing_sessions') || '';
        const used = new Blob([data]).size;
        const total = 5 * 1024 * 1024; // 5MB限制
        return {
          used,
          total,
          percentage: (used / total) * 100
        };
      } catch {
        return { used: 0, total: 0, percentage: 0 };
      }
    }
  }
}

// 导出单例实例
export const backupSystem = new BackupSystemManager();
