// Tauri 工具函数
import { invoke } from '@tauri-apps/api/core';

// 检查是否在 Tauri 环境中运行
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // 检查多个 Tauri 特有的全局变量（使用与 lib/utils/tauri.ts 相同的逻辑）
  const hasTauriGlobal = !!(
    (window as any).__TAURI__ ||
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI_INVOKE__
  );

  // 额外检查用户代理字符串作为备用方案
  const userAgent = navigator.userAgent;
  const isTauriUserAgent = userAgent.includes('Tauri') || userAgent.includes('tauri');

  console.log('Tauri detection:', {
    hasTauriGlobal,
    isTauriUserAgent,
    userAgent,
    windowKeys: Object.keys(window).filter(key => key.includes('TAURI') || key.includes('tauri'))
  });

  // 主要依赖全局变量检测，用户代理作为备用
  return hasTauriGlobal || isTauriUserAgent;
}

// 安全的 Tauri 调用函数
export async function safeTauriInvoke(command: string, args?: any): Promise<any> {
  console.log(`Attempting to invoke Tauri command: ${command}`, args);

  try {
    // 直接尝试调用，不进行环境检测
    const result = await invoke(command, args);
    console.log(`Tauri command ${command} succeeded:`, result);
    return result;
  } catch (error) {
    console.error(`Tauri invoke error for command ${command}:`, error);

    // 如果是因为Tauri不可用，提供更详细的错误信息
    if (error instanceof Error && error.message.includes('__TAURI_INVOKE__')) {
      throw new Error(`Tauri环境不可用: ${error.message}`);
    }

    throw error;
  }
}

// 文件系统操作函数
export async function createDirAll(path: string): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('create_dir_all', { path });
  }
}

export async function writeTextFile(path: string, data: string): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('write_text_file', { path, data });
  }
}

export async function writeBinaryFile(path: string, data: number[]): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('write_binary_file', { path, data });
  }
}

export async function readTextFile(path: string): Promise<string> {
  if (isTauriApp()) {
    return await safeTauriInvoke('read_text_file', { path });
  }
  throw new Error('Not in Tauri environment');
}

export async function readBinaryFile(path: string): Promise<number[]> {
  if (isTauriApp()) {
    return await safeTauriInvoke('read_binary_file', { path });
  }
  throw new Error('Not in Tauri environment');
}

export async function exists(path: string): Promise<boolean> {
  if (isTauriApp()) {
    try {
      return await safeTauriInvoke('exists', { path });
    } catch {
      return false;
    }
  }
  return false;
}

export async function removeFile(path: string): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('remove_file', { path });
  }
}

export async function removeDir(path: string): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('remove_dir', { path });
  }
}

export async function getDownloadDir(): Promise<string> {
  if (isTauriApp()) {
    return await safeTauriInvoke('get_download_dir');
  }
  return 'downloads';
}

export async function getUsername(): Promise<string> {
  if (isTauriApp()) {
    return await safeTauriInvoke('get_username');
  }
  return 'User';
}

export async function getDefaultPdf2mdDir(): Promise<string> {
  if (isTauriApp()) {
    return await safeTauriInvoke('get_default_pdf2md_dir');
  }
  // 浏览器环境下的默认路径
  return './pdf2md/';
}

// 窗口控制函数
export async function minimizeWindow(): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('minimize_window');
  }
}

export async function toggleMaximize(): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('toggle_maximize');
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauriApp()) {
    await safeTauriInvoke('close_window');
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  if (isTauriApp()) {
    return await safeTauriInvoke('is_window_maximized');
  }
  return false;
}

// 文件选择对话框
export async function selectFiles(): Promise<string[]> {
  if (isTauriApp()) {
    return await safeTauriInvoke('select_files');
  }
  return [];
}

export async function selectDirectory(): Promise<string | null> {
  if (isTauriApp()) {
    return await safeTauriInvoke('select_directory');
  }
  return null;
}
