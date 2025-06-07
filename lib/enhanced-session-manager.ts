// 增强的会话管理器 - 使用Tauri文件系统进行持久化存储
import { ProcessingSession, ProcessingRecord, ProcessingResult, Settings } from '@/types/pdf-processor';
import { safeTauriInvoke, isTauriApp } from '@/lib/tauri-utils';

export interface EnhancedProcessingSession extends ProcessingSession {
  // 添加暂停/继续相关字段
  isPaused: boolean;
  pausedAt?: number;
  resumedAt?: number;
  pauseCount: number;

  // 临时文件路径
  tempFiles: {
    [key: string]: string; // 文件类型 -> 临时文件路径
  };

  // 翻译进度状态
  translationState?: {
    currentFileIndex: number;
    currentChunkIndex: number;
    totalChunks: number;
    completedChunks: number;
    partialResults: string[];
  };
}

export interface SessionStateSnapshot {
  sessionId: string;
  timestamp: number;
  currentStep: string;
  fileProgress: {
    [fileName: string]: {
      status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'translating';
      progress: number;
      markdownContent?: string;
      translationContent?: string;
      imagesData?: any[];
      error?: string;
    };
  };
  translationState?: any;
}

export class EnhancedSessionManager {
  private sessions: Map<string, EnhancedProcessingSession> = new Map();
  private saveDirectory: string;

  constructor(saveDirectory: string = './pdf2md/') {
    this.saveDirectory = saveDirectory;
    this.loadSessionsFromDisk();
  }

  // 创建新的增强会话
  async createEnhancedSession(
    name: string,
    files: File[],
    settings: Partial<Settings>
  ): Promise<EnhancedProcessingSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const records: ProcessingRecord[] = files.map((file, index) => ({
      id: `record_${sessionId}_${index}`,
      fileName: file.name,
      fileSize: file.size,
      status: 'pending',
      progress: 0,
      startTime: now
    }));

    const session: EnhancedProcessingSession = {
      id: sessionId,
      name,
      createdAt: now,
      updatedAt: now,
      totalFiles: files.length,
      completedFiles: 0,
      failedFiles: 0,
      records,
      settings,

      // 增强字段
      isPaused: false,
      pauseCount: 0,
      tempFiles: {},
      translationState: {
        currentFileIndex: 0,
        currentChunkIndex: 0,
        totalChunks: 0,
        completedChunks: 0,
        partialResults: []
      }
    };

    this.sessions.set(sessionId, session);
    await this.saveSessionToDisk(session);

    return session;
  }

  // 暂停会话
  async pauseSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.isPaused) {
      return false;
    }

    session.isPaused = true;
    session.pausedAt = Date.now();
    session.pauseCount++;
    session.updatedAt = Date.now();

    // 保存当前状态快照
    await this.saveStateSnapshot(session);
    await this.saveSessionToDisk(session);

    return true;
  }

  // 继续会话
  async resumeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isPaused) {
      return false;
    }

    session.isPaused = false;
    session.resumedAt = Date.now();
    session.updatedAt = Date.now();

    await this.saveSessionToDisk(session);
    return true;
  }

  // 保存临时文件
  async saveTempFile(
    sessionId: string,
    fileType: string,
    content: string
  ): Promise<string | null> {
    if (!isTauriApp()) {
      console.warn('Temp file saving only available in Tauri environment');
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const fileName = `${sessionId}_${fileType}_${Date.now()}.tmp`;
      const filePath = await safeTauriInvoke('save_temp_file', {
        fileName,
        content,
        tempDir: this.saveDirectory
      });

      if (filePath) {
        session.tempFiles[fileType] = filePath;
        session.updatedAt = Date.now();
        await this.saveSessionToDisk(session);
        return filePath;
      }
    } catch (error) {
      console.error('Failed to save temp file:', error);
    }

    return null;
  }

  // 加载临时文件
  async loadTempFile(sessionId: string, fileType: string): Promise<string | null> {
    if (!isTauriApp()) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session || !session.tempFiles[fileType]) {
      return null;
    }

    try {
      const content = await safeTauriInvoke('load_temp_file', {
        filePath: session.tempFiles[fileType]
      });
      return content;
    } catch (error) {
      console.error('Failed to load temp file:', error);
      return null;
    }
  }

  // 保存状态快照
  private async saveStateSnapshot(session: EnhancedProcessingSession): Promise<void> {
    if (!isTauriApp()) {
      return;
    }

    const snapshot: SessionStateSnapshot = {
      sessionId: session.id,
      timestamp: Date.now(),
      currentStep: 'paused',
      fileProgress: {},
      translationState: session.translationState
    };

    // 收集文件进度信息
    session.records.forEach(record => {
      snapshot.fileProgress[record.fileName] = {
        status: record.status,
        progress: record.progress,
        error: record.error
      };
    });

    try {
      await safeTauriInvoke('save_session_state', {
        sessionId: session.id,
        stateData: JSON.stringify(snapshot),
        saveDir: this.saveDirectory
      });
    } catch (error) {
      console.error('Failed to save state snapshot:', error);
    }
  }

  // 加载状态快照
  async loadStateSnapshot(sessionId: string): Promise<SessionStateSnapshot | null> {
    if (!isTauriApp()) {
      return null;
    }

    try {
      const stateData = await safeTauriInvoke('load_session_state', {
        sessionId,
        saveDir: this.saveDirectory
      });

      if (stateData) {
        return JSON.parse(stateData);
      }
    } catch (error) {
      console.error('Failed to load state snapshot:', error);
    }

    return null;
  }

  // 清理会话临时文件
  async cleanupSession(sessionId: string): Promise<void> {
    if (!isTauriApp()) {
      return;
    }

    try {
      await safeTauriInvoke('cleanup_temp_files', {
        tempDir: this.saveDirectory,
        sessionId
      });

      const session = this.sessions.get(sessionId);
      if (session) {
        session.tempFiles = {};
        await this.saveSessionToDisk(session);
      }
    } catch (error) {
      console.error('Failed to cleanup session:', error);
    }
  }

  // 保存会话到磁盘
  private async saveSessionToDisk(session: EnhancedProcessingSession): Promise<void> {
    if (!isTauriApp()) {
      // 在非Tauri环境中使用localStorage作为后备
      localStorage.setItem(`session_${session.id}`, JSON.stringify(session));
      return;
    }

    try {
      await safeTauriInvoke('save_session_state', {
        sessionId: `meta_${session.id}`,
        stateData: JSON.stringify(session),
        saveDir: this.saveDirectory
      });
    } catch (error) {
      console.error('Failed to save session to disk:', error);
    }
  }

  // 从磁盘加载会话
  private async loadSessionsFromDisk(): Promise<void> {
    if (!isTauriApp()) {
      // 在非Tauri环境中从localStorage加载
      this.loadSessionsFromLocalStorage();
      return;
    }

    try {
      const sessionIds = await safeTauriInvoke('list_session_files', {
        saveDir: this.saveDirectory
      });

      if (Array.isArray(sessionIds)) {
        for (const sessionId of sessionIds) {
          if (sessionId.startsWith('meta_')) {
            const actualSessionId = sessionId.replace('meta_', '');
            try {
              const sessionData = await safeTauriInvoke('load_session_state', {
                sessionId,
                saveDir: this.saveDirectory
              });

              if (sessionData) {
                const session: EnhancedProcessingSession = JSON.parse(sessionData);
                this.sessions.set(actualSessionId, session);
              }
            } catch (error) {
              console.error(`Failed to load session ${sessionId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sessions from disk:', error);
    }
  }

  // 从localStorage加载会话（后备方案）
  private loadSessionsFromLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('session_')) {
          const sessionData = localStorage.getItem(key);
          if (sessionData) {
            const session: EnhancedProcessingSession = JSON.parse(sessionData);
            this.sessions.set(session.id, session);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error);
    }
  }

  // 获取所有会话
  getAllSessions(): EnhancedProcessingSession[] {
    return Array.from(this.sessions.values());
  }

  // 获取特定会话
  getSession(sessionId: string): EnhancedProcessingSession | undefined {
    return this.sessions.get(sessionId);
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // 清理临时文件
    await this.cleanupSession(sessionId);

    // 从内存中删除
    this.sessions.delete(sessionId);

    // 从磁盘删除
    if (isTauriApp()) {
      try {
        await safeTauriInvoke('remove_file', {
          path: `${this.saveDirectory}/sessions/meta_${sessionId}.json`
        });
        await safeTauriInvoke('remove_file', {
          path: `${this.saveDirectory}/sessions/${sessionId}.json`
        });
      } catch (error) {
        console.error('Failed to delete session files:', error);
      }
    } else {
      localStorage.removeItem(`session_${sessionId}`);
    }

    return true;
  }
}

// 导出单例实例
export const enhancedSessionManager = new EnhancedSessionManager();
