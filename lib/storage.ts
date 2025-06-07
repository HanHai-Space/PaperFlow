// 本地存储相关工具函数
import { Settings, ProcessedFile, ProcessingSession, ProcessingRecord } from '@/types/pdf-processor';

const SETTINGS_KEY = 'paperBurnerSettings';
const PROCESSED_FILES_KEY = 'paperBurnerProcessedFiles';
const PROCESSING_SESSIONS_KEY = 'paperBurnerProcessingSessions';

// 获取默认下载路径
function getDefaultDownloadPath(): string {
  // 统一使用 ./pdf2md/ 作为默认目录（这个函数将被异步版本替代）
  return './pdf2md/';
}

// 异步获取默认下载路径
export async function getDefaultDownloadPathAsync(): Promise<string> {
  try {
    const { getDefaultPdf2mdDir } = await import('./tauri-utils');
    return await getDefaultPdf2mdDir();
  } catch (error) {
    console.warn('Failed to get default path from Tauri:', error);
    return './pdf2md/';
  }
}

// API Key 存储与管理
export function updateApiKeyStorage(keyName: string, value: string, shouldRemember: boolean): void {
  if (shouldRemember) {
    localStorage.setItem(keyName, value);
  } else {
    localStorage.removeItem(keyName);
  }
}

export function loadApiKeysFromStorage(): { mistralApiKeys: string; translationApiKeys: string } {
  // 检查是否在浏览器环境中
  if (typeof window === 'undefined') {
    return {
      mistralApiKeys: '',
      translationApiKeys: ''
    };
  }

  return {
    mistralApiKeys: localStorage.getItem('mistralApiKeys') || '',
    translationApiKeys: localStorage.getItem('translationApiKeys') || ''
  };
}

// 已处理文件记录管理
export function loadProcessedFilesRecord(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(PROCESSED_FILES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to load processed files record from localStorage:', e);
    return {};
  }
}

export function saveProcessedFilesRecord(processedFilesRecord: Record<string, boolean>): void {
  try {
    localStorage.setItem(PROCESSED_FILES_KEY, JSON.stringify(processedFilesRecord));
    console.log("Saved processed files record.");
  } catch (e) {
    console.error("Failed to save processed files record to localStorage:", e);
  }
}

export function isAlreadyProcessed(fileIdentifier: string, processedFilesRecord: Record<string, boolean>): boolean {
  return processedFilesRecord.hasOwnProperty(fileIdentifier) && processedFilesRecord[fileIdentifier] === true;
}

export function markFileAsProcessed(fileIdentifier: string, processedFilesRecord: Record<string, boolean>): void {
  processedFilesRecord[fileIdentifier] = true;
}

export function generateFileIdentifier(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

// 通用设置项存储
export function saveSettings(settingsData: Partial<Settings>): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsData));
    console.log("Settings saved:", settingsData);
  } catch (e) {
    console.error('保存设置失败:', e);
  }
}

export function loadSettings(): Settings {
  const defaultSettings: Settings = {
    maxTokensPerChunk: 9000,
    skipProcessedFiles: false,
    concurrencyLevel: 1,
    translationConcurrencyLevel: 2,
    defaultSystemPrompt: '',
    defaultUserPromptTemplate: '',
    useCustomPrompts: false,
    customApiEndpoint: '',
    customModelId: '',
    customRequestFormat: 'openai',
    customTemperature: 0.5,
    customMaxTokens: 8000,
    // 新增的设置项
    saveLocation: getDefaultDownloadPath(),
    autoSaveCompleted: true,
    enableProcessingRecord: true,
    // 翻译设置
    translationModel: 'none',
    targetLanguage: 'chinese',
    customTargetLanguage: '',
    // Google Drive 设置
    enableGoogleDrive: false,
    googleDriveClientId: '',
    googleDriveClientSecret: '',
    googleDriveFolderId: '',
    googleDriveAutoUpload: false,
    // EPUB 转换设置
    enableRecognitionToEpub: false,
    enableTranslationToEpub: false,
    pandocPath: 'pandoc',
    pandocArgs: '-f markdown -s -t epub'
  };

  // 检查是否在浏览器环境中
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      return { ...defaultSettings, ...parsedSettings };
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }

  return defaultSettings;
}

// 清除所有存储数据
export function clearAllStorageData(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(PROCESSED_FILES_KEY);
    localStorage.removeItem('mistralApiKeys');
    localStorage.removeItem('translationApiKeys');
    console.log('All storage data cleared');
  } catch (e) {
    console.error('Failed to clear storage data:', e);
  }
}

// 导出存储数据（用于备份）
export function exportStorageData(): string {
  try {
    const data = {
      settings: loadSettings(),
      processedFiles: loadProcessedFilesRecord(),
      apiKeys: loadApiKeysFromStorage()
    };
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('Failed to export storage data:', e);
    return '';
  }
}

// 导入存储数据（用于恢复）
export function importStorageData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);

    if (data.settings) {
      saveSettings(data.settings);
    }

    if (data.processedFiles) {
      saveProcessedFilesRecord(data.processedFiles);
    }

    if (data.apiKeys) {
      if (data.apiKeys.mistralApiKeys) {
        localStorage.setItem('mistralApiKeys', data.apiKeys.mistralApiKeys);
      }
      if (data.apiKeys.translationApiKeys) {
        localStorage.setItem('translationApiKeys', data.apiKeys.translationApiKeys);
      }
    }

    console.log('Storage data imported successfully');
    return true;
  } catch (e) {
    console.error('Failed to import storage data:', e);
    return false;
  }
}

// 处理会话管理 - 使用 Tauri 文件系统避免 localStorage 配额限制
export async function saveProcessingSession(session: ProcessingSession): Promise<void> {
  try {
    // 在 Tauri 环境中使用文件系统
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      await saveProcessingSessionToFile(session);
    } else {
      // 在浏览器环境中，只保存基本信息到 localStorage
      await saveProcessingSessionToLocalStorage(session);
    }
    console.log('Processing session saved:', session.id);
  } catch (e) {
    console.error('Failed to save processing session:', e);
    // 降级到 localStorage
    try {
      await saveProcessingSessionToLocalStorage(session);
    } catch (fallbackError) {
      console.error('Fallback to localStorage also failed:', fallbackError);
    }
  }
}

// 保存到 Tauri 文件系统
async function saveProcessingSessionToFile(session: ProcessingSession): Promise<void> {
  const { safeTauriInvoke } = await import('./tauri-utils');

  // 获取默认保存目录
  let saveDir: string;
  try {
    saveDir = await safeTauriInvoke('get_default_pdf2md_dir');
  } catch (error) {
    saveDir = 'C:/Users/Downloads/pdf2md';
  }

  const sessionFilePath = `${saveDir}/sessions`;

  // 确保目录存在
  await safeTauriInvoke('create_dir_all', { path: sessionFilePath });

  // 保存会话数据到文件
  await safeTauriInvoke('save_session_state', {
    sessionId: session.id,
    stateData: JSON.stringify(session),
    saveDir: sessionFilePath
  });
}

// 保存到 localStorage（降级方案，只保存基本信息）
async function saveProcessingSessionToLocalStorage(session: ProcessingSession): Promise<void> {
  const sessions = await loadProcessingSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  // 创建轻量级会话数据（移除大型数据）
  const lightSession: ProcessingSession = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: Date.now(),
    totalFiles: session.totalFiles,
    completedFiles: session.completedFiles,
    failedFiles: session.failedFiles,
    settings: session.settings,
    records: session.records.map(record => ({
      ...record,
      // 移除 processingResult 以减少存储大小，或者保留基本信息
      processingResult: record.processingResult ? {
        fileName: record.processingResult.fileName,
        success: record.processingResult.success,
        error: record.processingResult.error,
        // 不保存大型内容到 localStorage，只保留占位符
        markdownContent: record.processingResult.markdownContent ? '[Content saved to file]' : undefined,
        translationContent: record.processingResult.translationContent ? '[Content saved to file]' : undefined,
        imagesData: [] // 清空图片数据，只在文件中保存
      } : undefined
    }))
  };

  if (existingIndex >= 0) {
    sessions[existingIndex] = lightSession;
  } else {
    sessions.push(lightSession);
  }

  localStorage.setItem(PROCESSING_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function loadProcessingSessions(): Promise<ProcessingSession[]> {
  try {
    // 在 Tauri 环境中从文件系统加载
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return await loadProcessingSessionsFromFile();
    } else {
      // 在浏览器环境中从 localStorage 加载
      return loadProcessingSessionsFromLocalStorage();
    }
  } catch (e) {
    console.error('Failed to load processing sessions:', e);
    // 降级到 localStorage
    try {
      return loadProcessingSessionsFromLocalStorage();
    } catch (fallbackError) {
      console.error('Fallback to localStorage also failed:', fallbackError);
      return [];
    }
  }
}

// 从 Tauri 文件系统加载
async function loadProcessingSessionsFromFile(): Promise<ProcessingSession[]> {
  const { safeTauriInvoke } = await import('./tauri-utils');

  try {
    // 获取默认保存目录
    let saveDir: string;
    try {
      saveDir = await safeTauriInvoke('get_default_pdf2md_dir');
    } catch (error) {
      saveDir = 'C:/Users/Downloads/pdf2md';
    }

    const sessionFilePath = `${saveDir}/sessions`;

    // 检查目录是否存在
    const dirExists = await safeTauriInvoke('exists', { path: sessionFilePath });
    if (!dirExists) {
      return [];
    }

    // 获取所有会话文件
    const sessionIds = await safeTauriInvoke('list_session_files', {
      saveDir: sessionFilePath
    });

    const sessions: ProcessingSession[] = [];

    if (Array.isArray(sessionIds)) {
      for (const sessionId of sessionIds) {
        try {
          const sessionData = await safeTauriInvoke('load_session_state', {
            sessionId,
            saveDir: sessionFilePath
          });

          if (sessionData) {
            const session: ProcessingSession = JSON.parse(sessionData);
            sessions.push(session);
          }
        } catch (error) {
          console.error(`Failed to load session ${sessionId}:`, error);
        }
      }
    }

    return sessions;
  } catch (error) {
    console.error('Failed to load sessions from file system:', error);
    return [];
  }
}

// 从 localStorage 加载（降级方案）
function loadProcessingSessionsFromLocalStorage(): ProcessingSession[] {
  try {
    const stored = localStorage.getItem(PROCESSING_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load processing sessions from localStorage:', e);
    return [];
  }
}

export async function deleteProcessingSession(sessionId: string): Promise<void> {
  try {
    // 在 Tauri 环境中删除文件
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      await deleteProcessingSessionFromFile(sessionId);
    } else {
      // 在浏览器环境中从 localStorage 删除
      await deleteProcessingSessionFromLocalStorage(sessionId);
    }
    console.log('Processing session deleted:', sessionId);
  } catch (e) {
    console.error('Failed to delete processing session:', e);
  }
}

// 从文件系统删除会话
async function deleteProcessingSessionFromFile(sessionId: string): Promise<void> {
  const { safeTauriInvoke } = await import('./tauri-utils');

  try {
    // 获取默认保存目录
    let saveDir: string;
    try {
      saveDir = await safeTauriInvoke('get_default_pdf2md_dir');
    } catch (error) {
      saveDir = 'C:/Users/Downloads/pdf2md';
    }

    const sessionFilePath = `${saveDir}/sessions/${sessionId}.json`;

    // 删除会话文件
    const fileExists = await safeTauriInvoke('exists', { path: sessionFilePath });
    if (fileExists) {
      await safeTauriInvoke('remove_file', { path: sessionFilePath });
    }
  } catch (error) {
    console.error('Failed to delete session file:', error);
  }
}

// 从 localStorage 删除会话
async function deleteProcessingSessionFromLocalStorage(sessionId: string): Promise<void> {
  const sessions = await loadProcessingSessions();
  const filteredSessions = sessions.filter(s => s.id !== sessionId);
  localStorage.setItem(PROCESSING_SESSIONS_KEY, JSON.stringify(filteredSessions));
}

export async function updateProcessingRecord(sessionId: string, recordId: string, updates: Partial<ProcessingRecord>): Promise<void> {
  try {
    const sessions = await loadProcessingSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);

    if (sessionIndex >= 0) {
      const recordIndex = sessions[sessionIndex].records.findIndex(r => r.id === recordId);
      if (recordIndex >= 0) {
        sessions[sessionIndex].records[recordIndex] = {
          ...sessions[sessionIndex].records[recordIndex],
          ...updates
        };
        sessions[sessionIndex].updatedAt = Date.now();

        // 保存更新后的会话
        await saveProcessingSession(sessions[sessionIndex]);
      }
    }
  } catch (e) {
    console.error('Failed to update processing record:', e);
  }
}

export function createProcessingSession(name: string, files: File[], settings: Partial<Settings>): ProcessingSession {
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

  return {
    id: sessionId,
    name,
    createdAt: now,
    updatedAt: now,
    totalFiles: files.length,
    completedFiles: 0,
    failedFiles: 0,
    records,
    settings
  };
}
