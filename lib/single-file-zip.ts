// 单个文件ZIP创建和Google Drive上传
import JSZip from 'jszip';
import { ProcessingResult, Settings } from '@/types/pdf-processor';
import { uploadZipToGoogleDrive, GoogleDriveUploadResult } from '@/lib/google-drive';
import { translateFileName, generateFileNames, sanitizeFileName } from './filename-translator';
import { apiKeyManager } from './api';

/**
 * 为单个处理结果创建ZIP并上传到Google Drive
 */
export async function createSingleFileZip(
  result: ProcessingResult,
  settings: Settings
): Promise<GoogleDriveUploadResult> {
  console.log('🚀 Creating single file ZIP for Google Drive upload:', {
    fileName: result.fileName,
    hasMarkdown: !!result.markdownContent,
    hasTranslation: !!result.translationContent,
    hasImages: !!(result.imagesData && result.imagesData.length > 0),
    enableGoogleDrive: settings.enableGoogleDrive,
    googleDriveAutoUpload: settings.googleDriveAutoUpload
  });

  try {
    // 获取文件名翻译
    const originalName = result.fileName.replace(/\.pdf$/i, '');
    let translatedName = originalName;

    // 如果有翻译内容，尝试翻译文件名
    if (result.translationContent && settings.translationModel !== 'none') {
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
            console.log(`📝 文件名翻译: ${originalName} -> ${translatedName}`);
          }
        }
      } catch (error) {
        console.warn('文件名翻译失败，使用原始文件名:', error);
      }
    }

    // 创建ZIP文件
    const zip = new JSZip();
    const safeFolderName = sanitizeFileName(originalName);
    const folder = zip.folder(safeFolderName);

    if (!folder) {
      throw new Error('Failed to create ZIP folder');
    }

    // 生成文件名
    const fileNames = generateFileNames(result.fileName, translatedName);

    // 添加Markdown文件
    if (result.markdownContent) {
      folder.file(fileNames.markdownFileName, result.markdownContent);
      console.log(`✅ Added ${fileNames.markdownFileName} to ZIP`);
    }

    // 添加翻译文件
    if (result.translationContent) {
      folder.file(fileNames.translationFileName, result.translationContent);
      console.log(`✅ Added ${fileNames.translationFileName} to ZIP`);
    }

    // 添加图片文件
    if (result.imagesData && result.imagesData.length > 0) {
      const imagesFolder = folder.folder('images');
      if (imagesFolder) {
        for (const img of result.imagesData) {
          try {
            let base64Data: string;
            let filename: string;

            // 处理不同的图片数据结构
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
              console.log(`✅ Added image ${filename} to ZIP`);
            }
          } catch (imgError) {
            console.error(`Error adding image to ZIP:`, imgError);
          }
        }
      }
    }

    // 生成ZIP内容
    console.log('📦 Generating ZIP content...');
    const zipContent = await zip.generateAsync({
      type: 'uint8array',
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `PaperBurner_${safeFolderName}_${timestamp}.zip`;

    console.log('☁️ Uploading to Google Drive...', {
      fileName: zipFileName,
      fileSize: zipContent.length
    });

    // 上传到Google Drive
    const uploadResult = await uploadZipToGoogleDrive(
      zipContent,
      zipFileName,
      settings
    );

    console.log('📤 Google Drive upload result:', uploadResult);
    return uploadResult;

  } catch (error) {
    console.error('❌ Single file ZIP creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 检查是否应该为单个文件创建ZIP并上传
 */
export function shouldUploadSingleFile(settings: Settings): boolean {
  return !!(
    settings.enableGoogleDrive &&
    settings.googleDriveAutoUpload &&
    settings.googleDriveClientId &&
    settings.googleDriveClientSecret
  );
}
