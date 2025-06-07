// Tauri 文件对话框工具函数
import { isTauriApp, safeTauriInvoke } from './tauri';

/**
 * 触发浏览器原生文件选择（内部实现）
 * @param accept 接受的文件类型
 * @param multiple 是否允许多选
 * @returns Promise<File[]> 选择的文件列表
 */
function triggerBrowserFileSelectInternal(accept: string, multiple: boolean = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';

    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;
      if (files) {
        resolve(Array.from(files));
      } else {
        resolve([]);
      }
      document.body.removeChild(input);
    };

    input.oncancel = () => {
      resolve([]);
      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * 使用 Tauri 选择 PDF 文件
 * @returns Promise<File[]> 选择的文件列表
 */
export async function selectPdfFiles(): Promise<File[]> {
  // 无论在什么环境中，都使用浏览器原生的文件选择
  // 这样可以确保功能正常工作
  return triggerBrowserFileSelectInternal('.pdf', true);
}

/**
 * 使用 Tauri 选择保存目录或文件路径
 * @returns Promise<string | null> 选择的路径，如果取消则返回 null
 */
export async function selectSaveDirectory(): Promise<string | null> {
  if (!isTauriApp()) {
    // 在浏览器环境中，提供选择：目录选择或文件路径选择
    return triggerBrowserPathSelect();
  }

  // 暂时返回 null，直到模块导入问题解决
  console.log('Tauri directory selection not yet implemented');
  return null;
}

/**
 * 检查是否可以使用 Tauri 文件对话框
 * @returns boolean
 */
export function canUseTauriFileDialog(): boolean {
  return isTauriApp();
}

/**
 * 触发浏览器原生文件选择（作为备用方案）
 * @param accept 接受的文件类型
 * @param multiple 是否允许多选
 * @returns Promise<File[]>
 */
export function triggerBrowserFileSelect(
  accept: string = '.pdf',
  multiple: boolean = true
): Promise<File[]> {
  return triggerBrowserFileSelectInternal(accept, multiple);
}

/**
 * 触发浏览器目录选择
 * @returns Promise<string | null> 选择的目录路径，如果取消则返回 null
 */
async function triggerBrowserDirectorySelect(): Promise<string | null> {
  // 检查是否支持 File System Access API
  if ('showDirectoryPicker' in window) {
    try {
      const directoryHandle = await (window as any).showDirectoryPicker();
      return directoryHandle.name; // 返回目录名称
    } catch (error) {
      // 用户取消选择
      console.log('Directory selection cancelled');
      return null;
    }
  } else {
    // 备用方案：使用 prompt 让用户输入路径
    const path = prompt('请输入保存目录路径:', './pdf2md/');
    return path && path.trim() ? path.trim() : null;
  }
}

/**
 * 触发浏览器路径选择（通过文件选择来获取目录路径）
 * @returns Promise<string | null> 选择的路径，如果取消则返回 null
 */
async function triggerBrowserPathSelect(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true; // 选择目录
    input.style.display = 'none';

    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0) {
        // 从第一个文件的路径中提取目录路径
        const firstFile = files[0];
        const fullPath = (firstFile as any).webkitRelativePath || firstFile.name;
        const pathParts = fullPath.split('/');
        if (pathParts.length > 1) {
          // 返回目录名称
          resolve(pathParts[0]);
        } else {
          // 如果无法获取目录，使用默认路径
          resolve('./pdf2md/');
        }
      } else {
        resolve(null);
      }
      document.body.removeChild(input);
    };

    input.oncancel = () => {
      resolve(null);
      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  });
}
