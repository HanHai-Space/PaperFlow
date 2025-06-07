// ZIP 操作工具
// 完全移植自 simple/js/processing.js 中的 downloadAllResults 函数

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProcessingResult, Settings } from '@/types/pdf-processor';
import { uploadZipToGoogleDrive } from '@/lib/google-drive';
import { convertMarkdownToEpub, generateEpubConversionOptions } from '@/lib/epub-converter';
import { safeTauriInvoke, isTauriApp } from '@/lib/tauri-utils';
import { translateFileName, generateFileNames, sanitizeFileName } from './filename-translator';
import { apiKeyManager } from './api';

/**
 * 处理单个文件的EPUB转换
 */
async function processEpubConversion(
  result: ProcessingResult,
  settings: Settings,
  addProgressLog: (message: string) => void,
  translatedName?: string
): Promise<{ documentEpub?: string; translationEpub?: string }> {
  const epubResults: { documentEpub?: string; translationEpub?: string } = {};

  console.log('processEpubConversion called:', {
    fileName: result.fileName,
    enableRecognitionToEpub: settings.enableRecognitionToEpub,
    enableTranslationToEpub: settings.enableTranslationToEpub,
    hasMarkdownContent: !!result.markdownContent,
    hasTranslationContent: !!result.translationContent,
    isTauriApp: isTauriApp()
  });

  if (!isTauriApp()) {
    addProgressLog(`⚠️ EPUB转换跳过: 非桌面环境`);
    return epubResults;
  }

  try {
    const pdfName = result.fileName.replace(/\.pdf$/i, '');

    // 转换识别文件为EPUB
    if (settings.enableRecognitionToEpub && result.markdownContent) {
      addProgressLog(`🔄 开始将识别结果转换为EPUB: ${pdfName}`);
      console.log('Starting recognition EPUB conversion for:', pdfName);

      // 创建临时Markdown文件
      const tempMdPath = `temp_${pdfName}_document.md`;
      console.log('Creating temp markdown file:', tempMdPath);

      // 创建临时图片目录和文件
      const tempImagesDir = `temp_${pdfName}_images`;
      const createdImagePaths: string[] = [];

      try {
        // 如果有图片数据，创建临时图片文件
        if (result.imagesData && result.imagesData.length > 0) {
          addProgressLog(`📸 创建临时图片文件 (${result.imagesData.length} 张)...`);

          // 创建临时图片目录
          await safeTauriInvoke('create_dir_all', { path: tempImagesDir });

          for (const img of result.imagesData) {
            try {
              let base64Data: string;
              let filename: string;

              // 处理不同的图片数据结构
              if ('data' in img && 'id' in img) {
                base64Data = (img as any).data.includes(',') ? (img as any).data.split(',')[1] : (img as any).data;
                filename = `${(img as any).id}.png`;
              } else {
                base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
                filename = img.filename;
              }

              if (base64Data) {
                const imagePath = `${tempImagesDir}/${filename}`;

                // 将base64转换为二进制数据
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                // 保存图片文件
                await safeTauriInvoke('write_binary_file', {
                  path: imagePath,
                  data: Array.from(imageBuffer)
                });

                createdImagePaths.push(imagePath);
                console.log(`Created temp image: ${imagePath}`);
              }
            } catch (imgError) {
              console.error(`Error creating temp image:`, imgError);
              addProgressLog(`⚠️ 创建临时图片文件时出错: ${imgError instanceof Error ? imgError.message : String(imgError)}`);
            }
          }
        }

        // 修改markdown内容中的图片路径，使其指向临时图片目录
        let modifiedMarkdownContent = result.markdownContent;
        if (result.imagesData && result.imagesData.length > 0) {
          // 将 images/ 路径替换为临时图片目录路径
          modifiedMarkdownContent = modifiedMarkdownContent.replace(/images\//g, `${tempImagesDir}/`);
        }

        await safeTauriInvoke('write_text_file', {
          path: tempMdPath,
          data: modifiedMarkdownContent
        });

        const epubOptions = generateEpubConversionOptions(
          tempMdPath,
          result.fileName,
          settings,
          'recognition',
          translatedName
        );

        console.log('EPUB conversion options:', epubOptions);
        addProgressLog(`📝 临时文件已创建，开始Pandoc转换...`);

        const conversionResult = await convertMarkdownToEpub(epubOptions);
        console.log('EPUB conversion result:', conversionResult);

        if (conversionResult.success && conversionResult.epubPath) {
          addProgressLog(`📖 EPUB文件生成成功，正在读取文件...`);

          // 读取生成的EPUB文件
          const epubData = await safeTauriInvoke('read_binary_file', {
            path: conversionResult.epubPath
          });

          if (epubData) {
            epubResults.documentEpub = epubData;
            addProgressLog(`✅ 识别结果EPUB转换成功: ${pdfName}`);
            console.log('Recognition EPUB conversion successful, data length:', epubData.length);
          } else {
            addProgressLog(`❌ 无法读取生成的EPUB文件: ${conversionResult.epubPath}`);
          }

          // 清理临时文件
          await safeTauriInvoke('remove_file', { path: tempMdPath });
          await safeTauriInvoke('remove_file', { path: conversionResult.epubPath });
        } else {
          addProgressLog(`❌ 识别结果EPUB转换失败: ${conversionResult.error}`);
          console.error('Recognition EPUB conversion failed:', conversionResult.error);
          // 清理临时markdown文件
          await safeTauriInvoke('remove_file', { path: tempMdPath });
        }
      } finally {
        // 清理临时图片文件和目录
        for (const imagePath of createdImagePaths) {
          try {
            await safeTauriInvoke('remove_file', { path: imagePath });
          } catch (cleanupError) {
            console.warn(`Failed to cleanup temp image: ${imagePath}`, cleanupError);
          }
        }

        if (createdImagePaths.length > 0) {
          try {
            await safeTauriInvoke('remove_dir', { path: tempImagesDir });
            addProgressLog(`🧹 临时图片文件已清理`);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup temp images directory: ${tempImagesDir}`, cleanupError);
          }
        }
      }
    } else {
      if (!settings.enableRecognitionToEpub) {
        console.log('Recognition to EPUB is disabled');
      }
      if (!result.markdownContent) {
        console.log('No markdown content available for recognition EPUB');
      }
    }

    // 转换翻译文件为EPUB
    if (settings.enableTranslationToEpub && result.translationContent) {
      addProgressLog(`🔄 开始将翻译结果转换为EPUB: ${pdfName}`);
      console.log('Starting translation EPUB conversion for:', pdfName);

      // 创建临时Markdown文件
      const tempMdPath = `temp_${pdfName}_translation.md`;
      console.log('Creating temp translation markdown file:', tempMdPath);

      // 创建临时图片目录和文件
      const tempImagesDir = `temp_${pdfName}_translation_images`;
      const createdImagePaths: string[] = [];

      try {
        // 如果有图片数据，创建临时图片文件
        if (result.imagesData && result.imagesData.length > 0) {
          addProgressLog(`📸 创建翻译临时图片文件 (${result.imagesData.length} 张)...`);

          // 创建临时图片目录
          await safeTauriInvoke('create_dir_all', { path: tempImagesDir });

          for (const img of result.imagesData) {
            try {
              let base64Data: string;
              let filename: string;

              // 处理不同的图片数据结构
              if ('data' in img && 'id' in img) {
                base64Data = (img as any).data.includes(',') ? (img as any).data.split(',')[1] : (img as any).data;
                filename = `${(img as any).id}.png`;
              } else {
                base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
                filename = img.filename;
              }

              if (base64Data) {
                const imagePath = `${tempImagesDir}/${filename}`;

                // 将base64转换为二进制数据
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                // 保存图片文件
                await safeTauriInvoke('write_binary_file', {
                  path: imagePath,
                  data: Array.from(imageBuffer)
                });

                createdImagePaths.push(imagePath);
                console.log(`Created temp translation image: ${imagePath}`);
              }
            } catch (imgError) {
              console.error(`Error creating temp translation image:`, imgError);
              addProgressLog(`⚠️ 创建翻译临时图片文件时出错: ${imgError instanceof Error ? imgError.message : String(imgError)}`);
            }
          }
        }

        // 修改markdown内容中的图片路径，使其指向临时图片目录
        let modifiedTranslationContent = result.translationContent;
        if (result.imagesData && result.imagesData.length > 0) {
          // 将 images/ 路径替换为临时图片目录路径
          modifiedTranslationContent = modifiedTranslationContent.replace(/images\//g, `${tempImagesDir}/`);
        }

        await safeTauriInvoke('write_text_file', {
          path: tempMdPath,
          data: modifiedTranslationContent
        });

        const epubOptions = generateEpubConversionOptions(
          tempMdPath,
          result.fileName,
          settings,
          'translation',
          translatedName
        );

        console.log('Translation EPUB conversion options:', epubOptions);
        addProgressLog(`📝 翻译临时文件已创建，开始Pandoc转换...`);

        const conversionResult = await convertMarkdownToEpub(epubOptions);
        console.log('Translation EPUB conversion result:', conversionResult);

        if (conversionResult.success && conversionResult.epubPath) {
          addProgressLog(`📖 翻译EPUB文件生成成功，正在读取文件...`);

          // 读取生成的EPUB文件
          const epubData = await safeTauriInvoke('read_binary_file', {
            path: conversionResult.epubPath
          });

          if (epubData) {
            epubResults.translationEpub = epubData;
            addProgressLog(`✅ 翻译结果EPUB转换成功: ${pdfName}`);
            console.log('Translation EPUB conversion successful, data length:', epubData.length);
          } else {
            addProgressLog(`❌ 无法读取生成的翻译EPUB文件: ${conversionResult.epubPath}`);
          }

          // 清理临时文件
          await safeTauriInvoke('remove_file', { path: tempMdPath });
          await safeTauriInvoke('remove_file', { path: conversionResult.epubPath });
        } else {
          addProgressLog(`❌ 翻译结果EPUB转换失败: ${conversionResult.error}`);
          console.error('Translation EPUB conversion failed:', conversionResult.error);
          // 清理临时markdown文件
          await safeTauriInvoke('remove_file', { path: tempMdPath });
        }
      } finally {
        // 清理临时图片文件和目录
        for (const imagePath of createdImagePaths) {
          try {
            await safeTauriInvoke('remove_file', { path: imagePath });
          } catch (cleanupError) {
            console.warn(`Failed to cleanup temp translation image: ${imagePath}`, cleanupError);
          }
        }

        if (createdImagePaths.length > 0) {
          try {
            await safeTauriInvoke('remove_dir', { path: tempImagesDir });
            addProgressLog(`🧹 翻译临时图片文件已清理`);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup temp translation images directory: ${tempImagesDir}`, cleanupError);
          }
        }
      }
    } else {
      if (!settings.enableTranslationToEpub) {
        console.log('Translation to EPUB is disabled');
      }
      if (!result.translationContent) {
        console.log('No translation content available for translation EPUB');
      }
    }
  } catch (error) {
    addProgressLog(`⚠️ EPUB转换过程中出错: ${error instanceof Error ? error.message : String(error)}`);
  }

  return epubResults;
}

/**
 * 获取文件的翻译名称
 */
async function getTranslatedFileName(
  result: ProcessingResult,
  settings?: Settings
): Promise<{ originalName: string; translatedName: string }> {
  const originalName = result.fileName.replace(/\.pdf$/i, '');
  let translatedName = originalName;

  // 如果有翻译设置且有翻译内容，尝试翻译文件名
  if (settings && result.translationContent && settings.translationModel !== 'none') {
    try {
      const translationKey = apiKeyManager.getTranslationKey();
      if (translationKey) {
        const translationResult = await translateFileName(
          result.fileName,
          settings.translationModel,
          translationKey,
          settings.targetLanguage || 'chinese',
          settings
        );

        if (translationResult.success) {
          translatedName = translationResult.translatedName;
        }
      }
    } catch (error) {
      console.warn('文件名翻译失败，使用原始文件名:', error);
    }
  }

  return { originalName, translatedName };
}

/**
 * 下载所有处理结果为 ZIP 文件（支持EPUB转换和文件名翻译）
 * 完全移植自 simple/js/processing.js 中的 downloadAllResults 函数
 */
export async function downloadAllResults(allResultsData: ProcessingResult[], settings?: Settings): Promise<void> {
  // 过滤成功的结果 - 与 simple 版本逻辑一致
  const successfulResults = allResultsData.filter(result =>
    result &&
    result.success &&
    result.markdownContent &&
    !result.error
  );

  if (successfulResults.length === 0) {
    // 这里应该调用 showNotification，但我们用 console.warn 代替
    console.warn('没有成功的处理结果可供下载');
    return;
  }

  // 添加日志回调支持（如果可用）
  const addProgressLog = (message: string) => {
    console.log(message);
    // 如果有全局的 addProgressLog 函数，也调用它
    if (typeof (globalThis as any).addProgressLog === 'function') {
      (globalThis as any).addProgressLog(message);
    }
  };

  addProgressLog('开始打包下载结果...');
  const zip = new JSZip();
  let filesAdded = 0;

  for (const result of successfulResults) {
    // 获取文件名翻译
    const { originalName, translatedName } = await getTranslatedFileName(result, settings);
    addProgressLog(`📝 处理文件: ${originalName}${translatedName !== originalName ? ` -> ${translatedName}` : ''}`);

    // 生成文件名
    const fileNames = generateFileNames(result.fileName, translatedName);
    const safeFolderName = sanitizeFileName(originalName);
    const folder = zip.folder(safeFolderName);

    if (!folder) {
      console.warn(`Failed to create folder for ${safeFolderName}`);
      continue;
    }

    // 处理EPUB转换（如果启用且在Tauri环境中）
    let epubResults: { documentEpub?: string; translationEpub?: string } = {};
    if (settings && (settings.enableRecognitionToEpub || settings.enableTranslationToEpub)) {
      epubResults = await processEpubConversion(result, settings, addProgressLog, translatedName);
    }

    // 添加识别结果的 Markdown 文件 - 使用真实文件名
    if (result.markdownContent) {
      folder.file(fileNames.markdownFileName, result.markdownContent);
    }

    // 添加识别结果的EPUB文件（如果转换成功）
    if (epubResults.documentEpub) {
      folder.file(fileNames.epubFileName, epubResults.documentEpub, { base64: true });
    }

    // 添加翻译文件（如果存在）- 使用翻译后的文件名
    if (result.translationContent) {
      folder.file(fileNames.translationFileName, result.translationContent);
    }

    // 添加翻译结果的EPUB文件（如果转换成功）
    if (epubResults.translationEpub) {
      folder.file(fileNames.translationEpubFileName, epubResults.translationEpub, { base64: true });
    }

    // 添加图片文件（如果存在）- 与 simple 版本一致
    if (result.imagesData && result.imagesData.length > 0) {
      const imagesFolder = folder.folder('images');
      if (imagesFolder) {
        for (const img of result.imagesData) {
          try {
            // 处理图片数据 - 适配当前系统的数据结构
            let base64Data: string;
            let filename: string;

            // 适配不同的图片数据结构
            if ('data' in img && 'id' in img) {
              // simple 版本的结构：{ id, data }
              base64Data = (img as any).data.includes(',') ? (img as any).data.split(',')[1] : (img as any).data;
              filename = `${(img as any).id}.png`;
            } else {
              // 当前版本的结构：{ filename, base64, mimeType }
              base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
              filename = img.filename;
            }

            if (base64Data) {
              imagesFolder.file(filename, base64Data, { base64: true });
            } else {
              console.warn(`Skipping image ${filename} in ${safeFolderName} due to missing data.`);
              addProgressLog(`警告: 跳过图片 ${filename} (文件: ${safeFolderName})，数据缺失。`);
            }
          } catch (imgError) {
            console.error(`Error adding image to zip for ${safeFolderName}:`, imgError);
            addProgressLog(`警告: 打包图片 (文件: ${safeFolderName}) 时出错: ${imgError instanceof Error ? imgError.message : String(imgError)}`);
          }
        }
      }
    }
    filesAdded++;
  }

  if (filesAdded === 0) {
    console.warn('没有成功处理的文件可以打包下载');
    addProgressLog('没有可打包的文件。');
    return;
  }

  try {
    addProgressLog(`正在生成包含 ${filesAdded} 个文件结果的 ZIP 包...`);

    // 生成 ZIP 文件 - 与 simple 版本完全一致的配置
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    // 生成文件名 - 与 simple 版本一致
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    saveAs(zipBlob, `PaperBurner_Results_${timestamp}.zip`);
    addProgressLog('ZIP 文件生成完毕，开始下载。');
  } catch (error) {
    console.error('创建或下载 ZIP 文件失败:', error);
    addProgressLog('错误: 创建 ZIP 文件失败 - ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * 自动保存 ZIP 文件到指定目录（Tauri 环境）
 * 基于 simple 版本的逻辑，但适配 Tauri 环境
 */
export async function autoSaveZipToDirectory(
  allResultsData: ProcessingResult[],
  saveDirectory: string,
  settings?: Settings
): Promise<boolean> {
  console.log('🚀 autoSaveZipToDirectory called with:', {
    resultsCount: allResultsData.length,
    saveDirectory,
    hasSettings: !!settings,
    enableGoogleDrive: settings?.enableGoogleDrive,
    googleDriveAutoUpload: settings?.googleDriveAutoUpload
  });

  // 检查是否在 Tauri 环境中
  const isTauriEnvironment = () => {
    return typeof window !== 'undefined' &&
           window.__TAURI__ !== undefined;
  };

  if (!isTauriEnvironment()) {
    // 在浏览器环境中，使用传统下载方式
    await downloadAllResults(allResultsData, settings);
    return false;
  }

  // 过滤成功的结果
  const successfulResults = allResultsData.filter(result =>
    result &&
    result.success &&
    result.markdownContent &&
    !result.error
  );

  if (successfulResults.length === 0) {
    return false;
  }

  // 定义日志函数
  const addProgressLog = (message: string) => {
    console.log(message);
    if (typeof (globalThis as any).addProgressLog === 'function') {
      (globalThis as any).addProgressLog(message);
    }
  };

  // 调试：打印当前设置
  console.log('Current settings for ZIP operation:', {
    enableGoogleDrive: settings?.enableGoogleDrive,
    googleDriveAutoUpload: settings?.googleDriveAutoUpload,
    hasClientId: !!settings?.googleDriveClientId,
    hasClientSecret: !!settings?.googleDriveClientSecret,
    saveLocation: saveDirectory,
    autoSaveCompleted: settings ? 'settings provided' : 'no settings'
  });

  // 定义ZIP保存成功标志
  let zipSaveSuccessful = false;

  try {
    // 使用 safeTauriInvoke 替代直接的 Tauri API 调用
    const { safeTauriInvoke } = await import('@/lib/tauri-utils');

    addProgressLog('开始创建 ZIP 文件...');
    addProgressLog(`准备打包 ${successfulResults.length} 个处理结果`);
    const zip = new JSZip();
    let filesAdded = 0;

    // 使用与 downloadAllResults 相同的逻辑创建 ZIP
    for (const result of successfulResults) {
      // 获取文件名翻译
      const { originalName, translatedName } = await getTranslatedFileName(result, settings);
      addProgressLog(`📝 处理文件: ${originalName}${translatedName !== originalName ? ` -> ${translatedName}` : ''}`);

      // 生成文件名
      const fileNames = generateFileNames(result.fileName, translatedName);
      const safeFolderName = sanitizeFileName(originalName);
      const folder = zip.folder(safeFolderName);

      if (!folder) continue;

      // 处理EPUB转换（如果启用且在Tauri环境中）
      let epubResults: { documentEpub?: string; translationEpub?: string } = {};
      if (settings && (settings.enableRecognitionToEpub || settings.enableTranslationToEpub)) {
        epubResults = await processEpubConversion(result, settings, addProgressLog, translatedName);
      }

      // 使用新的文件命名系统
      if (result.markdownContent) {
        folder.file(fileNames.markdownFileName, result.markdownContent);
      }

      // 添加识别结果的EPUB文件（如果转换成功）
      if (epubResults.documentEpub) {
        folder.file(fileNames.epubFileName, epubResults.documentEpub, { base64: true });
      }

      if (result.translationContent) {
        folder.file(fileNames.translationFileName, result.translationContent);
      }

      // 添加翻译结果的EPUB文件（如果转换成功）
      if (epubResults.translationEpub) {
        folder.file(fileNames.translationEpubFileName, epubResults.translationEpub, { base64: true });
      }

      if (result.imagesData && result.imagesData.length > 0) {
        const imagesFolder = folder.folder('images');
        if (imagesFolder) {
          for (const img of result.imagesData) {
            try {
              let base64Data: string;
              let filename: string;

              if ('data' in img && 'id' in img) {
                base64Data = (img as any).data.includes(',') ? (img as any).data.split(',')[1] : (img as any).data;
                filename = `${(img as any).id}.png`;
              } else {
                base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
                filename = img.filename;
              }

              if (base64Data) {
                imagesFolder.file(filename, base64Data, { base64: true });
              }
            } catch (imgError) {
              console.error(`Error adding image to zip:`, imgError);
            }
          }
        }
      }
      filesAdded++;
    }

    if (filesAdded === 0) {
      return false;
    }

    // 生成 ZIP 内容
    addProgressLog(`正在压缩 ${filesAdded} 个文件夹...`);
    const zipContent = await zip.generateAsync({
      type: 'uint8array',
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    // 生成文件名并保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `PaperBurner_Results_${timestamp}.zip`;

    // 处理保存路径 - 确保是绝对路径
    let finalSaveDirectory = saveDirectory;

    // 如果是相对路径（如 /pdf2md/），转换为绝对路径
    if (saveDirectory.startsWith('/') && !saveDirectory.includes(':')) {
      // 获取用户下载目录并拼接
      try {
        const { getDefaultPdf2mdDir } = await import('@/lib/tauri-utils');
        const defaultDir = await getDefaultPdf2mdDir();
        finalSaveDirectory = defaultDir;
        addProgressLog(`使用默认保存目录: ${finalSaveDirectory}`);
      } catch (error) {
        // 如果获取默认目录失败，使用用户下载目录
        finalSaveDirectory = 'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\Downloads\\pdf2md\\';
        addProgressLog(`使用备用保存目录: ${finalSaveDirectory}`);
      }
    }

    // 确保路径分隔符正确（Windows使用反斜杠）
    const normalizedSaveDirectory = finalSaveDirectory.replace(/\//g, '\\');
    const zipPath = `${normalizedSaveDirectory}\\${zipFileName}`;

    addProgressLog(`正在保存 ZIP 文件到: ${zipPath}`);

    // 使用 Tauri 后端命令保存 ZIP 文件
    try {
      console.log('Calling save_zip_file with:', {
        zipDataLength: zipContent.length,
        filePath: zipPath,
        saveDirectory: saveDirectory
      });

      await safeTauriInvoke('save_zip_file', {
        zipData: Array.from(zipContent),
        filePath: zipPath
      });

      addProgressLog(`✅ ZIP 文件已成功保存到: ${zipPath}`);
      console.log('ZIP file saved successfully');
      zipSaveSuccessful = true;
    } catch (saveError) {
      console.error('Tauri save_zip_file failed:', saveError);
      console.error('Error details:', {
        error: saveError,
        zipPath: zipPath,
        saveDirectory: saveDirectory,
        zipContentLength: zipContent.length
      });
      addProgressLog(`❌ ZIP 文件保存失败: ${saveError instanceof Error ? saveError.message : String(saveError)}`);

      // 检查文件是否实际上已经被保存了
      try {
        const { exists } = await import('@/lib/tauri-utils');
        const fileExists = await exists(zipPath);
        if (fileExists) {
          addProgressLog(`⚠️ 尽管出现错误，ZIP 文件似乎已成功保存到: ${zipPath}`);
          console.log('ZIP file exists despite error, treating as successful');
          zipSaveSuccessful = true;
        } else {
          throw saveError;
        }
      } catch (checkError) {
        console.error('Failed to check if ZIP file exists:', checkError);
        throw saveError;
      }
    }

    // 检查 Google Drive 上传条件
    console.log('Google Drive upload conditions:', {
      zipSaveSuccessful,
      enableGoogleDrive: settings?.enableGoogleDrive,
      googleDriveAutoUpload: settings?.googleDriveAutoUpload,
      hasClientId: !!settings?.googleDriveClientId,
      hasClientSecret: !!settings?.googleDriveClientSecret
    });

    // 如果启用了Google Drive自动上传，且ZIP文件保存成功，则上传到Google Drive
    if (zipSaveSuccessful && settings?.enableGoogleDrive && settings?.googleDriveAutoUpload) {
      try {
        addProgressLog('开始上传到 Google Drive...');
        console.log('Starting Google Drive upload with settings:', {
          enableGoogleDrive: settings.enableGoogleDrive,
          googleDriveAutoUpload: settings.googleDriveAutoUpload,
          clientId: settings.googleDriveClientId ? 'configured' : 'missing',
          clientSecret: settings.googleDriveClientSecret ? 'configured' : 'missing',
          folderId: settings.googleDriveFolderId || 'root'
        });

        const uploadResult = await uploadZipToGoogleDrive(
          zipContent,
          zipFileName,
          settings
        );

        if (uploadResult.success) {
          addProgressLog(`✅ 文件已成功上传到 Google Drive: ${uploadResult.fileName}`);
          if (uploadResult.webViewLink) {
            addProgressLog(`🔗 Google Drive 链接: ${uploadResult.webViewLink}`);
          }
        } else {
          addProgressLog(`❌ Google Drive 上传失败: ${uploadResult.error}`);
        }
      } catch (uploadError) {
        console.error('Google Drive 上传失败:', uploadError);
        addProgressLog(`❌ Google Drive 上传失败: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
      }
    } else if (settings?.enableGoogleDrive && settings?.googleDriveAutoUpload && !zipSaveSuccessful) {
      addProgressLog('⚠️ 由于 ZIP 文件保存失败，跳过 Google Drive 上传');
    } else if (settings?.enableGoogleDrive && !settings?.googleDriveAutoUpload) {
      addProgressLog('ℹ️ Google Drive 已启用但自动上传已禁用');
    } else if (!settings?.enableGoogleDrive) {
      addProgressLog('ℹ️ Google Drive 未启用，跳过上传');
    }

    // 返回ZIP保存是否成功，而不是整个流程是否成功
    return zipSaveSuccessful;

  } catch (error) {
    console.error('自动保存 ZIP 文件失败:', error);
    addProgressLog(`错误: 自动保存 ZIP 文件失败 - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
