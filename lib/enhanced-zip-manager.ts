// 增强的ZIP管理器 - 使用Tauri直接保存到Windows文件系统
import JSZip from 'jszip';
import { ProcessingResult, ImageData, Settings } from '@/types/pdf-processor';
import { safeTauriInvoke, isTauriApp } from '@/lib/tauri-utils';
import { saveAs } from 'file-saver';
import { uploadZipToGoogleDrive } from '@/lib/google-drive';
import { convertMarkdownToEpub, generateEpubConversionOptions } from '@/lib/epub-converter';

export interface ZipCreationOptions {
  includeImages: boolean;
  includeMarkdown: boolean;
  includeTranslation: boolean;
  includeMetadata: boolean;
  compressionLevel: number; // 0-9
}

export interface ZipCreationResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
  creationTime: number;
}

export class EnhancedZipManager {
  private defaultOptions: ZipCreationOptions = {
    includeImages: true,
    includeMarkdown: true,
    includeTranslation: true,
    includeMetadata: true,
    compressionLevel: 6
  };

  // 创建并保存ZIP文件到指定目录
  async createAndSaveZip(
    results: ProcessingResult[],
    saveDirectory: string,
    fileName?: string,
    options?: Partial<ZipCreationOptions>,
    settings?: Settings
  ): Promise<ZipCreationResult> {
    const startTime = Date.now();
    const finalOptions = { ...this.defaultOptions, ...options };

    try {
      // 创建ZIP内容
      const zipBlob = await this.createZipBlob(results, finalOptions, settings);

      // 生成文件名
      const zipFileName = fileName || this.generateZipFileName(results.length);

      // 处理保存路径 - 确保是绝对路径
      let finalSaveDirectory = saveDirectory;

      // 如果是相对路径（如 /pdf2md/），转换为绝对路径
      if (saveDirectory.startsWith('/') && !saveDirectory.includes(':')) {
        try {
          const { getDefaultPdf2mdDir } = await import('@/lib/tauri-utils');
          finalSaveDirectory = await getDefaultPdf2mdDir();
        } catch (error) {
          // 如果获取默认目录失败，使用用户下载目录
          finalSaveDirectory = 'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\Downloads\\pdf2md\\';
        }
      }

      const fullPath = `${finalSaveDirectory}/${zipFileName}`;

      // 根据环境选择保存方式
      if (isTauriApp()) {
        return await this.saveZipWithTauri(zipBlob, fullPath, startTime, settings, zipFileName);
      } else {
        return await this.saveZipWithBrowser(zipBlob, zipFileName, startTime, settings);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        creationTime: Date.now() - startTime
      };
    }
  }

  // 使用Tauri保存ZIP文件
  private async saveZipWithTauri(
    zipBlob: Blob,
    fullPath: string,
    startTime: number,
    settings?: Settings,
    fileName?: string
  ): Promise<ZipCreationResult> {
    try {
      // 将Blob转换为Uint8Array
      const arrayBuffer = await zipBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 使用Tauri命令保存文件
      let zipSaveSuccessful = false;
      try {
        await safeTauriInvoke('save_zip_file', {
          zipData: Array.from(uint8Array),
          filePath: fullPath
        });
        zipSaveSuccessful = true;
        console.log('ZIP file saved successfully via Tauri');
      } catch (saveError) {
        console.error('Tauri save_zip_file failed:', saveError);

        // 检查文件是否实际上已经被保存了
        try {
          const { exists } = await import('@/lib/tauri-utils');
          const fileExists = await exists(fullPath);
          if (fileExists) {
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

      // 如果启用了Google Drive自动上传，且ZIP文件保存成功，则上传到Google Drive
      if (zipSaveSuccessful && settings?.enableGoogleDrive && settings?.googleDriveAutoUpload && fileName) {
        try {
          const uploadResult = await uploadZipToGoogleDrive(
            uint8Array,
            fileName,
            settings
          );

          if (uploadResult.success) {
            console.log(`ZIP file uploaded to Google Drive: ${uploadResult.fileName}`);
          } else {
            console.warn(`Google Drive upload failed: ${uploadResult.error}`);
          }
        } catch (uploadError) {
          console.error('Google Drive upload failed:', uploadError);
        }
      }

      return {
        success: true,
        filePath: fullPath,
        fileSize: zipBlob.size,
        creationTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to save ZIP with Tauri: ${error}`);
    }
  }

  // 使用浏览器下载ZIP文件（后备方案）
  private async saveZipWithBrowser(
    zipBlob: Blob,
    fileName: string,
    startTime: number,
    settings?: Settings
  ): Promise<ZipCreationResult> {
    try {
      saveAs(zipBlob, fileName);

      return {
        success: true,
        filePath: fileName, // 浏览器环境下只返回文件名
        fileSize: zipBlob.size,
        creationTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to save ZIP with browser: ${error}`);
    }
  }

  // 处理单个文件的EPUB转换
  private async processEpubConversion(
    result: ProcessingResult,
    settings?: Settings
  ): Promise<{ documentEpub?: Uint8Array; translationEpub?: Uint8Array }> {
    const epubResults: { documentEpub?: Uint8Array; translationEpub?: Uint8Array } = {};

    if (!isTauriApp() || !settings) {
      return epubResults;
    }

    try {
      const pdfName = result.fileName.replace(/\.pdf$/i, '');

      // 转换识别文件为EPUB
      if (settings.enableRecognitionToEpub && result.markdownContent) {
        console.log('Starting recognition EPUB conversion for:', pdfName);

        // 创建临时Markdown文件
        const tempMdPath = `temp_${pdfName}_document.md`;

        // 创建临时图片目录和文件
        const tempImagesDir = `temp_${pdfName}_images`;
        const createdImagePaths: string[] = [];

        try {
          // 如果有图片数据，创建临时图片文件
          if (result.imagesData && result.imagesData.length > 0) {
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
            'recognition'
          );

          const conversionResult = await convertMarkdownToEpub(epubOptions);

          if (conversionResult.success && conversionResult.epubPath) {
            // 读取生成的EPUB文件
            const epubData = await safeTauriInvoke('read_binary_file', {
              path: conversionResult.epubPath
            });

            if (epubData) {
              epubResults.documentEpub = new Uint8Array(epubData);
              console.log('Recognition EPUB conversion successful, data length:', epubData.length);
            }

            // 清理临时文件
            await safeTauriInvoke('remove_file', { path: tempMdPath });
            await safeTauriInvoke('remove_file', { path: conversionResult.epubPath });
          } else {
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
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temp images directory: ${tempImagesDir}`, cleanupError);
            }
          }
        }
      }

      // 转换翻译文件为EPUB
      if (settings.enableTranslationToEpub && result.translationContent) {
        console.log('Starting translation EPUB conversion for:', pdfName);

        // 创建临时Markdown文件
        const tempMdPath = `temp_${pdfName}_translation.md`;

        // 创建临时图片目录和文件
        const tempImagesDir = `temp_${pdfName}_translation_images`;
        const createdImagePaths: string[] = [];

        try {
          // 如果有图片数据，创建临时图片文件
          if (result.imagesData && result.imagesData.length > 0) {
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
            'translation'
          );

          const conversionResult = await convertMarkdownToEpub(epubOptions);

          if (conversionResult.success && conversionResult.epubPath) {
            // 读取生成的EPUB文件
            const epubData = await safeTauriInvoke('read_binary_file', {
              path: conversionResult.epubPath
            });

            if (epubData) {
              epubResults.translationEpub = new Uint8Array(epubData);
              console.log('Translation EPUB conversion successful, data length:', epubData.length);
            }

            // 清理临时文件
            await safeTauriInvoke('remove_file', { path: tempMdPath });
            await safeTauriInvoke('remove_file', { path: conversionResult.epubPath });
          } else {
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
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temp translation images directory: ${tempImagesDir}`, cleanupError);
            }
          }
        }
      }
    } catch (error) {
      console.error('EPUB conversion error:', error);
    }

    return epubResults;
  }

  // 创建ZIP Blob
  private async createZipBlob(
    results: ProcessingResult[],
    options: ZipCreationOptions,
    settings?: Settings
  ): Promise<Blob> {
    const zip = new JSZip();

    // 为每个处理结果创建文件夹
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.success) continue;

      const baseName = result.fileName.replace(/\.pdf$/i, '');
      const safeBaseName = this.sanitizeFileName(baseName);
      const folder = zip.folder(safeBaseName);

      if (!folder) continue;

      // 处理EPUB转换（如果启用且在Tauri环境中）
      let epubResults: { documentEpub?: Uint8Array; translationEpub?: Uint8Array } = {};
      if (settings && (settings.enableRecognitionToEpub || settings.enableTranslationToEpub)) {
        epubResults = await this.processEpubConversion(result, settings);
      }

      // 添加Markdown文件
      if (options.includeMarkdown && result.markdownContent) {
        folder.file(`${safeBaseName}.md`, result.markdownContent);
      }

      // 添加识别结果的EPUB文件（如果转换成功）
      if (epubResults.documentEpub) {
        folder.file(`${safeBaseName}.epub`, epubResults.documentEpub);
      }

      // 添加翻译文件
      if (options.includeTranslation && result.translationContent) {
        folder.file(`${safeBaseName}_translated.md`, result.translationContent);
      }

      // 添加翻译结果的EPUB文件（如果转换成功）
      if (epubResults.translationEpub) {
        folder.file(`${safeBaseName}_translated.epub`, epubResults.translationEpub);
      }

      // 添加图片文件
      if (options.includeImages && result.imagesData && result.imagesData.length > 0) {
        const imgFolder = folder.folder('images');
        if (imgFolder) {
          for (const imageData of result.imagesData) {
            // 适配不同的图片数据结构
            let base64Data: string;
            let filename: string = 'unknown';

            try {
              // 检查是否是旧版本的数据结构 { id, data }
              if ('data' in imageData && 'id' in imageData) {
                // simple 版本的结构：{ id, data }
                base64Data = (imageData as any).data.includes(',') ? (imageData as any).data.split(',')[1] : (imageData as any).data;
                filename = `${(imageData as any).id}.png`;
              } else {
                // 当前版本的结构：{ filename, base64, mimeType }
                base64Data = imageData.base64.includes(',') ? imageData.base64.split(',')[1] : imageData.base64;
                filename = imageData.filename;
              }

              if (base64Data) {
                imgFolder.file(filename, base64Data, { base64: true });
              }
            } catch (error) {
              console.error(`Failed to add image ${filename || 'unknown'}:`, error);
            }
          }
        }
      }

      // 添加元数据文件
      if (options.includeMetadata) {
        const metadata = {
          fileName: result.fileName,
          processedAt: new Date().toISOString(),
          imageCount: result.imagesData?.length || 0,
          hasTranslation: !!result.translationContent,
          success: result.success,
          error: result.error
        };

        folder.file('metadata.json', JSON.stringify(metadata, null, 2));
      }
    }

    // 添加批量处理摘要
    if (options.includeMetadata) {
      const summary = {
        totalFiles: results.length,
        successfulFiles: results.filter(r => r.success).length,
        failedFiles: results.filter(r => !r.success).length,
        createdAt: new Date().toISOString(),
        zipOptions: options
      };

      zip.file('processing_summary.json', JSON.stringify(summary, null, 2));
    }

    // 生成ZIP
    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: options.compressionLevel
      }
    });
  }

  // 生成ZIP文件名
  private generateZipFileName(fileCount: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `pdf_processing_results_${fileCount}files_${timestamp}.zip`;
  }

  // 清理文件名中的非法字符
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100); // 限制长度
  }

  // 验证保存目录是否可写
  async validateSaveDirectory(directory: string): Promise<boolean> {
    if (!isTauriApp()) {
      return true; // 浏览器环境总是返回true
    }

    try {
      // 尝试创建目录
      await safeTauriInvoke('create_dir_all', { path: directory });

      // 尝试写入测试文件
      const testFile = `${directory}/test_write_permission.tmp`;
      await safeTauriInvoke('write_text_file', {
        path: testFile,
        data: 'test'
      });

      // 删除测试文件
      await safeTauriInvoke('remove_file', { path: testFile });

      return true;
    } catch (error) {
      console.error('Directory validation failed:', error);
      return false;
    }
  }

  // 获取目录大小信息
  async getDirectoryInfo(directory: string): Promise<{
    exists: boolean;
    writable: boolean;
    freeSpace?: number;
  }> {
    if (!isTauriApp()) {
      return { exists: true, writable: true };
    }

    try {
      const exists = await safeTauriInvoke('exists', { path: directory });
      const writable = exists ? await this.validateSaveDirectory(directory) : false;

      return {
        exists,
        writable,
        // TODO: 可以添加获取磁盘空间的Tauri命令
      };
    } catch (error) {
      return { exists: false, writable: false };
    }
  }

  // 批量创建多个ZIP文件（按文件数量分组）
  async createBatchZips(
    results: ProcessingResult[],
    saveDirectory: string,
    filesPerZip: number = 10,
    options?: Partial<ZipCreationOptions>
  ): Promise<ZipCreationResult[]> {
    const batches: ProcessingResult[][] = [];

    // 将结果分组
    for (let i = 0; i < results.length; i += filesPerZip) {
      batches.push(results.slice(i, i + filesPerZip));
    }

    const zipResults: ZipCreationResult[] = [];

    // 为每个批次创建ZIP
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const fileName = `pdf_processing_batch_${i + 1}_of_${batches.length}.zip`;

      try {
        const result = await this.createAndSaveZip(
          batch,
          saveDirectory,
          fileName,
          options
        );
        zipResults.push(result);
      } catch (error) {
        zipResults.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          creationTime: 0
        });
      }
    }

    return zipResults;
  }
}

// 导出单例实例
export const enhancedZipManager = new EnhancedZipManager();
