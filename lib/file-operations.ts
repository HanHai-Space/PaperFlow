// 文件操作相关工具函数
import { ProcessingResult, Settings } from '@/types/pdf-processor';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { downloadAllResults, autoSaveZipToDirectory } from './zip-operations';

// 检查是否在 Tauri 环境中
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // 检查多个 Tauri 特有的全局变量
  return !!(
    (window as any).__TAURI__ ||
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI_INVOKE__
  );
}

// 安全的 Tauri API 导入
async function importTauriFS() {
  if (!isTauriEnvironment()) return null;
  try {
    // 使用动态导入避免构建时的模块解析错误
    const fs = await eval('import("@tauri-apps/api/fs")');
    return fs;
  } catch (error) {
    console.warn('Failed to import Tauri FS API:', error);
    return null;
  }
}

async function importTauriPath() {
  if (!isTauriEnvironment()) return null;
  try {
    // 使用动态导入避免构建时的模块解析错误
    const path = await eval('import("@tauri-apps/api/path")');
    return path;
  } catch (error) {
    console.warn('Failed to import Tauri Path API:', error);
    return null;
  }
}

async function importTauriDialog() {
  if (!isTauriEnvironment()) return null;
  try {
    // 使用动态导入避免构建时的模块解析错误
    const dialog = await eval('import("@tauri-apps/api/dialog")');
    return dialog;
  } catch (error) {
    console.warn('Failed to import Tauri Dialog API:', error);
    return null;
  }
}

// 在 Tauri 环境中保存单个文件
export async function saveFileInTauri(
  content: string,
  fileName: string,
  saveLocation: string
): Promise<boolean> {
  if (!isTauriEnvironment()) {
    console.warn('Not in Tauri environment, cannot save file directly');
    return false;
  }

  try {
    // 使用安全的导入函数
    const [fs, path] = await Promise.all([
      importTauriFS(),
      importTauriPath()
    ]);

    if (!fs || !path) {
      console.warn('Tauri APIs not available');
      return false;
    }

    // 构建完整的文件路径
    const fullPath = await path.join(saveLocation, fileName);

    // 写入文件
    await fs.writeTextFile(fullPath, content);

    console.log(`File saved successfully: ${fullPath}`);
    return true;
  } catch (error) {
    console.error('Failed to save file in Tauri:', error);
    return false;
  }
}

// 在 Tauri 环境中保存二进制文件（如图片）
export async function saveBinaryFileInTauri(
  data: Uint8Array,
  fileName: string,
  saveLocation: string
): Promise<boolean> {
  if (!isTauriEnvironment()) {
    console.warn('Not in Tauri environment, cannot save binary file directly');
    return false;
  }

  try {
    // 使用安全的导入函数
    const [fs, path] = await Promise.all([
      importTauriFS(),
      importTauriPath()
    ]);

    if (!fs || !path) {
      console.warn('Tauri APIs not available');
      return false;
    }

    // 构建完整的文件路径
    const fullPath = await path.join(saveLocation, fileName);

    // 写入文件
    await fs.writeBinaryFile(fullPath, data);

    console.log(`Binary file saved successfully: ${fullPath}`);
    return true;
  } catch (error) {
    console.error('Failed to save binary file in Tauri:', error);
    return false;
  }
}

// 创建目录（如果不存在）
export async function ensureDirectoryExists(dirPath: string): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false;
  }

  try {
    const fs = await importTauriFS();

    if (!fs) {
      console.warn('Tauri fs API not available');
      return false;
    }

    const dirExists = await fs.exists(dirPath);
    if (!dirExists) {
      await fs.createDir(dirPath, { recursive: true });
      console.log(`Directory created: ${dirPath}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to create directory:', error);
    return false;
  }
}

// 自动保存处理结果
export async function autoSaveProcessingResult(
  result: ProcessingResult,
  settings: Settings
): Promise<boolean> {
  if (!settings.autoSaveCompleted || !result.success) {
    return false;
  }

  const saveLocation = settings.saveLocation;

  if (isTauriEnvironment()) {
    // 在 Tauri 环境中直接保存到文件系统
    try {
      // 确保保存目录存在
      await ensureDirectoryExists(saveLocation);

      let savedFiles = 0;

      // 保存 Markdown 文件
      if (result.markdownContent) {
        const markdownFileName = `${result.fileName}_markdown.md`;
        const success = await saveFileInTauri(
          result.markdownContent,
          markdownFileName,
          saveLocation
        );
        if (success) savedFiles++;
      }

      // 保存翻译文件
      if (result.translationContent) {
        const translationFileName = `${result.fileName}_translation.md`;
        const success = await saveFileInTauri(
          result.translationContent,
          translationFileName,
          saveLocation
        );
        if (success) savedFiles++;
      }

      // 保存图片文件
      if (result.imagesData && result.imagesData.length > 0) {
        const imagesDir = `${saveLocation}/${result.fileName}_images`;
        await ensureDirectoryExists(imagesDir);

        for (const img of result.imagesData) {
          try {
            // 处理base64数据，移除可能的数据URL前缀
            let base64Data = img.base64;
            if (base64Data.includes(',')) {
              base64Data = base64Data.split(',')[1];
            }

            // 将 base64 转换为 Uint8Array
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const success = await saveBinaryFileInTauri(
              binaryData,
              img.filename,
              imagesDir
            );
            if (success) savedFiles++;
          } catch (error) {
            console.error(`Failed to save image ${img.filename}:`, error);
          }
        }
      }

      console.log(`Auto-saved ${savedFiles} files for ${result.fileName}`);
      return savedFiles > 0;

    } catch (error) {
      console.error('Failed to auto-save in Tauri:', error);
      return false;
    }
  } else {
    // 在浏览器环境中，仍然使用下载方式
    console.log('Browser environment: auto-save not supported, use download instead');
    return false;
  }
}

// 批量自动保存多个处理结果
export async function autoSaveMultipleResults(
  results: ProcessingResult[],
  settings: Settings
): Promise<number> {
  if (!settings.autoSaveCompleted) {
    return 0;
  }

  let savedCount = 0;

  for (const result of results) {
    if (result.success) {
      const success = await autoSaveProcessingResult(result, settings);
      if (success) {
        savedCount++;
      }
    }
  }

  return savedCount;
}

// 选择保存位置（Tauri 环境）
export async function selectSaveLocation(): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null;
  }

  try {
    const dialog = await importTauriDialog();

    if (!dialog) {
      console.warn('Tauri dialog API not available');
      return null;
    }

    const selected = await dialog.open({
      directory: true,
      title: '选择保存位置'
    });

    return selected as string | null;
  } catch (error) {
    console.error('Failed to open directory dialog:', error);
    return null;
  }
}

// 获取默认下载目录（Tauri 环境）
export async function getDefaultDownloadDirectory(): Promise<string> {
  try {
    const { getDefaultPdf2mdDir } = await import('./tauri-utils');
    return await getDefaultPdf2mdDir();
  } catch (error) {
    console.warn('Failed to get default path from Tauri:', error);
    return './pdf2md/';
  }
}

// 自动保存 ZIP 文件到指定目录
// 使用移植自 simple 版本的 ZIP 操作逻辑
export async function autoSaveZipFile(
  results: ProcessingResult[],
  settings: Settings
): Promise<boolean> {
  console.log('🔍 autoSaveZipFile called with:', {
    resultsCount: results.length,
    autoSaveCompleted: settings.autoSaveCompleted,
    saveLocation: settings.saveLocation,
    enableGoogleDrive: settings.enableGoogleDrive,
    googleDriveAutoUpload: settings.googleDriveAutoUpload
  });

  if (results.length === 0 || !settings.autoSaveCompleted) {
    console.log('❌ autoSaveZipFile early return: no results or auto-save disabled');
    return false;
  }

  console.log('✅ autoSaveZipFile proceeding to autoSaveZipToDirectory');
  // 使用新的 ZIP 操作逻辑
  const result = await autoSaveZipToDirectory(results, settings.saveLocation, settings);
  console.log('🔍 autoSaveZipToDirectory returned:', result);
  return result;
}

// 传统的浏览器下载方式（作为备用）
// 使用移植自 simple 版本的 ZIP 操作逻辑
export async function downloadProcessingResults(results: ProcessingResult[], settings?: Settings): Promise<void> {
  // 使用移植自 simple 版本的下载逻辑
  await downloadAllResults(results, settings);
}
