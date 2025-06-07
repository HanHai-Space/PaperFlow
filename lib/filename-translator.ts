// 文件名翻译工具
import { TranslationModel, Settings } from '@/types/pdf-processor';
import { callTranslationApi, buildPredefinedApiConfig, buildCustomApiConfig } from './api';

export interface FileNameTranslationResult {
  originalName: string;
  translatedName: string;
  success: boolean;
  error?: string;
}

/**
 * 翻译文件名（去除扩展名）
 */
export async function translateFileName(
  fileName: string,
  translationModel: TranslationModel,
  apiKey: string,
  targetLanguage: string,
  settings?: Settings
): Promise<FileNameTranslationResult> {
  // 移除文件扩展名
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

  const result: FileNameTranslationResult = {
    originalName: nameWithoutExt,
    translatedName: nameWithoutExt,
    success: false
  };

  // 如果不需要翻译，直接返回原名
  if (translationModel === 'none') {
    result.success = true;
    return result;
  }

  try {
    // 构建翻译配置
    let config;
    if (translationModel === 'custom' && settings) {
      config = buildCustomApiConfig(
        apiKey,
        settings.customApiEndpoint,
        settings.customModelId,
        settings.customRequestFormat,
        settings.customTemperature,
        settings.customMaxTokens
      );
    } else {
      config = buildPredefinedApiConfig(translationModel, apiKey);
    }

    // 构建翻译提示词
    const systemPrompt = `你是一个专业的文件名翻译助手。请将给定的文件名翻译成${getLanguageName(targetLanguage)}。

要求：
1. 只返回翻译后的文件名，不要添加任何解释或其他内容
2. 保持文件名的简洁性和可读性
3. 如果是英文书名，请翻译成对应的中文书名
4. 如果是学术论文标题，请准确翻译专业术语
5. 避免使用特殊字符，使用常见的中文字符`;

    const userPrompt = `请将以下文件名翻译成${getLanguageName(targetLanguage)}：

${nameWithoutExt}

翻译后的文件名：`;

    // 调用翻译API
    const requestBody = config.requestBuilder(userPrompt, targetLanguage, systemPrompt);
    const translatedText = await callTranslationApi(config, requestBody);

    if (translatedText && translatedText.trim()) {
      // 清理翻译结果，移除可能的引号和多余空格
      const cleanedName = translatedText
        .trim()
        .replace(/^["']|["']$/g, '') // 移除首尾引号
        .replace(/[/\\:*?"<>|]/g, '') // 移除文件名非法字符
        .trim();

      if (cleanedName) {
        result.translatedName = cleanedName;
        result.success = true;
      } else {
        result.error = '翻译结果为空';
      }
    } else {
      result.error = '翻译API返回空结果';
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('文件名翻译失败:', error);
  }

  return result;
}

/**
 * 获取语言名称
 */
function getLanguageName(targetLanguage: string): string {
  switch (targetLanguage) {
    case 'chinese':
      return '中文';
    case 'english':
      return '英文';
    case 'japanese':
      return '日文';
    case 'korean':
      return '韩文';
    case 'french':
      return '法文';
    default:
      return targetLanguage;
  }
}

/**
 * 生成文件名（包含扩展名）
 */
export function generateFileNames(
  originalFileName: string,
  translatedName?: string
): {
  markdownFileName: string;
  translationFileName: string;
  epubFileName: string;
  translationEpubFileName: string;
} {
  // 移除原始文件的扩展名
  const baseFileName = originalFileName.replace(/\.[^/.]+$/, '');

  return {
    markdownFileName: `${baseFileName}.md`,
    translationFileName: `${translatedName || baseFileName}.md`,
    epubFileName: `${baseFileName}.epub`,
    translationEpubFileName: `${translatedName || baseFileName}.epub`
  };
}

/**
 * 批量翻译文件名
 */
export async function translateFileNames(
  fileNames: string[],
  translationModel: TranslationModel,
  apiKey: string,
  targetLanguage: string,
  settings?: Settings,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<Map<string, FileNameTranslationResult>> {
  const results = new Map<string, FileNameTranslationResult>();

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    onProgress?.(i + 1, fileNames.length, fileName);

    const result = await translateFileName(
      fileName,
      translationModel,
      apiKey,
      targetLanguage,
      settings
    );

    results.set(fileName, result);

    // 添加小延迟避免API限制
    if (i < fileNames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * 清理文件名中的非法字符
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\:*?"<>|]/g, '_') // 替换非法字符为下划线
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim()
    .substring(0, 200); // 限制长度
}
