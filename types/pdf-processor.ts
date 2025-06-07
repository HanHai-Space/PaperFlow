// PDF处理相关类型定义

export interface ProcessedFile {
  name: string;
  size: number;
  identifier: string;
}

export interface ProcessingResult {
  success: boolean;
  fileName: string;
  markdownContent?: string;
  translationContent?: string;
  imagesData?: ImageData[];
  error?: string;
  // 添加原始文件引用用于PDF预览
  originalFile?: File;
  fileUrl?: string;
  // 添加会话ID用于备份系统
  sessionId?: string;
}

export interface ImageData {
  filename: string;
  base64: string;
  mimeType: string;
}

export interface ApiKeyManager {
  mistralKeys: string[];
  translationKeys: string[];
  mistralKeyIndex: number;
  translationKeyIndex: number;
  parseKeys: (keyType: 'mistral' | 'translation') => boolean;
  getMistralKey: () => string;
  getTranslationKey: () => string;
  markKeyInvalid: (keyType: 'mistral' | 'translation', key: string) => void;

  // 新增方法
  getSpecificKey: (keyType: 'mistral' | 'translation', excludeKeys?: string[]) => string | null;
  getMultipleTranslationKeys: (count: number) => string[];
  recordKeyError: (keyType: 'mistral' | 'translation', key: string) => void;
  getKeyStats: (keyType: 'mistral' | 'translation') => Array<{key: string; count: number; errors: number; lastUsed: number}>;
  resetBlacklist: (keyType?: 'mistral' | 'translation') => void;
  getAvailableKeyCount: (keyType: 'mistral' | 'translation') => number;
  setKeys: (keyType: 'mistral' | 'translation', keys: string[]) => void;
}

export interface TranslationConfig {
  endpoint: string;
  headers: Record<string, string>;
  requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => any;
  responseExtractor: (response: any) => string;
}

export interface Settings {
  maxTokensPerChunk: number;
  skipProcessedFiles: boolean;
  concurrencyLevel: number;
  translationConcurrencyLevel: number;
  defaultSystemPrompt: string;
  defaultUserPromptTemplate: string;
  useCustomPrompts: boolean;
  customApiEndpoint: string;
  customModelId: string;
  customRequestFormat: CustomRequestFormat;
  customTemperature: number;
  customMaxTokens: number;
  // 新增保存位置设置
  saveLocation: string;
  autoSaveCompleted: boolean;
  enableProcessingRecord: boolean;
  // 新增翻译设置
  translationModel: TranslationModel;
  targetLanguage: TargetLanguage;
  customTargetLanguage: string;
  // Google Drive 设置
  enableGoogleDrive: boolean;
  googleDriveClientId: string;
  googleDriveClientSecret: string;
  googleDriveFolderId: string;
  googleDriveAutoUpload: boolean;
  // EPUB 转换设置
  enableRecognitionToEpub: boolean;
  enableTranslationToEpub: boolean;
  pandocPath: string;
  pandocArgs: string;
}

export interface OcrPage {
  page_number?: number;
  markdown?: string;  // Mistral OCR 返回的是 markdown 字段，不是 text
  images?: Array<{
    id: string;
    image_base64: string;
  }>;
}

export interface OcrResponse {
  pages: OcrPage[];
}

export interface ProcessedOcrResult {
  markdown: string;
  images: ImageData[];
}

export interface TranslationSemaphore {
  limit: number;
  count: number;
  queue: Array<() => void>;
}

export interface ProgressInfo {
  step: string;
  percentage: number;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
}

export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// 翻译模型类型
export type TranslationModel =
  | 'none'
  | 'mistral'
  | 'deepseek'
  | 'gemini'
  | 'claude'
  | 'tongyi-deepseek-v3'
  | 'volcano-deepseek-v3'
  | 'chutes-deepseek-v3'
  | 'custom';

// 目标语言类型
export type TargetLanguage =
  | 'chinese'
  | 'english'
  | 'japanese'
  | 'korean'
  | 'french'
  | 'custom';

// 自定义请求格式类型
export type CustomRequestFormat =
  | 'openai'
  | 'anthropic'
  | 'gemini';

// 处理记录相关类型
export interface ProcessingRecord {
  id: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'translating';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  resultPath?: string;
  translationModel?: TranslationModel;
  targetLanguage?: TargetLanguage;
  // 新增文件路径信息
  originalFilePath?: string;
  markdownFilePath?: string;
  translationFilePath?: string;
  imagesFolder?: string;
  // 新增处理结果引用
  processingResult?: ProcessingResult;
  // Translation-specific state for pause/resume
  translationState?: {
    currentChunkIndex: number;
    totalChunks: number;
    completedChunks: number;
    partialResults: string[];
    isPausedDuringTranslation: boolean;
    pausedAt?: number;
    resumedAt?: number;
    chunks?: string[]; // Store original chunks for resume
  };
}

export interface ProcessingSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  records: ProcessingRecord[];
  settings: Partial<Settings>;
}

// Translation control interface for pause/resume functionality
export interface TranslationController {
  isPaused: boolean;
  pauseRequested: boolean;
  resumeRequested: boolean;
  abortController?: AbortController;
  pauseTranslation: () => void;
  resumeTranslation: () => void;
  checkPauseStatus: () => boolean;
  waitForResume: () => Promise<void>;
}
