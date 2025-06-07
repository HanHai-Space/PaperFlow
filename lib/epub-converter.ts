// EPUB 转换工具模块
import { Settings } from '@/types/pdf-processor';
import { safeTauriInvoke, isTauriApp } from '@/lib/tauri-utils';

export interface EpubConversionResult {
  success: boolean;
  epubPath?: string;
  error?: string;
  originalPath: string;
}

export interface EpubConversionOptions {
  inputPath: string;
  outputPath: string;
  pandocPath: string;
  pandocArgs: string;
  title?: string;
  author?: string;
}

/**
 * 将 Markdown 文件转换为 EPUB 格式
 */
export async function convertMarkdownToEpub(
  options: EpubConversionOptions
): Promise<EpubConversionResult> {
  const { inputPath, outputPath, pandocPath, pandocArgs, title, author } = options;

  try {
    if (!isTauriApp()) {
      return {
        success: false,
        error: 'EPUB conversion is only available in desktop version',
        originalPath: inputPath
      };
    }

    // 构建 pandoc 命令参数
    let args = pandocArgs.replace('${outputPath}', outputPath);

    // 添加输入和输出文件
    const commandArgs = [
      inputPath,
      '-o', outputPath,
      ...args.split(' ').filter(arg => arg.trim() !== '')
    ];

    // 如果提供了标题和作者，添加元数据
    if (title) {
      commandArgs.push('--metadata', `title="${title}"`);
    }
    if (author) {
      commandArgs.push('--metadata', `author="${author}"`);
    }

    console.log('Converting to EPUB:', {
      pandocPath,
      args: commandArgs,
      inputPath,
      outputPath
    });

    // 调用 Tauri 后端执行 pandoc 命令
    const result = await safeTauriInvoke('execute_pandoc', {
      pandocPath,
      args: commandArgs
    }) as { success: boolean; output?: string; error?: string };

    if (result.success) {
      console.log('EPUB conversion successful:', outputPath);
      return {
        success: true,
        epubPath: outputPath,
        originalPath: inputPath
      };
    } else {
      console.error('EPUB conversion failed:', result.error);
      return {
        success: false,
        error: result.error || 'Unknown error during EPUB conversion',
        originalPath: inputPath
      };
    }
  } catch (error) {
    console.error('Error during EPUB conversion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      originalPath: inputPath
    };
  }
}

/**
 * 批量转换多个 Markdown 文件为 EPUB
 */
export async function convertMultipleMarkdownToEpub(
  conversions: EpubConversionOptions[]
): Promise<EpubConversionResult[]> {
  const results: EpubConversionResult[] = [];

  for (const options of conversions) {
    const result = await convertMarkdownToEpub(options);
    results.push(result);
  }

  return results;
}

/**
 * 根据设置和文件信息生成 EPUB 转换选项
 */
export function generateEpubConversionOptions(
  markdownPath: string,
  fileName: string,
  settings: Settings,
  type: 'recognition' | 'translation',
  translatedTitle?: string
): EpubConversionOptions {
  // 生成输出路径 - 直接使用 markdown 文件名，只改变扩展名
  const outputPath = markdownPath.replace(/\.md$/, '.epub');

  // 确定标题
  let title: string;
  if (type === 'recognition') {
    // 识别结果使用原始文件名
    title = fileName.replace(/\.pdf$/i, '');
  } else {
    // 翻译结果使用翻译后的标题（如果有的话）
    title = translatedTitle || fileName.replace(/\.pdf$/i, '');
  }

  return {
    inputPath: markdownPath,
    outputPath,
    pandocPath: settings.pandocPath,
    pandocArgs: settings.pandocArgs,
    title
  };
}

/**
 * 检查 Pandoc 是否可用
 */
export async function checkPandocAvailability(pandocPath: string): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  try {
    if (!isTauriApp()) {
      return {
        available: false,
        error: 'Pandoc check is only available in desktop version'
      };
    }

    const result = await safeTauriInvoke('execute_pandoc', {
      pandocPath,
      args: ['--version']
    }) as { success: boolean; output?: string; error?: string };

    if (result.success) {
      // 从输出中提取版本信息
      const versionMatch = result.output?.match(/pandoc\s+([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version
      };
    } else {
      return {
        available: false,
        error: result.error || 'Failed to execute pandoc --version'
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 验证 EPUB 转换设置
 */
export function validateEpubSettings(settings: Settings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!settings.pandocPath || settings.pandocPath.trim() === '') {
    errors.push('Pandoc 路径不能为空');
  }

  if (!settings.pandocArgs || settings.pandocArgs.trim() === '') {
    errors.push('Pandoc 参数不能为空');
  }

  // 检查参数中是否包含必要的格式
  if (settings.pandocArgs && !settings.pandocArgs.includes('-t epub')) {
    errors.push('Pandoc 参数必须包含 "-t epub" 以生成 EPUB 格式');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
