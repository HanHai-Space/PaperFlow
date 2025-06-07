/**
 * Tauri 工具函数
 * 提供统一的 Tauri 环境检测和 API 调用方法
 */

/**
 * 检测是否在 Tauri 环境中运行
 */
export function isTauriApp(): boolean {
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

/**
 * 安全地调用 Tauri API
 */
export async function safeTauriInvoke<T>(
  command: string,
  args?: Record<string, any>
): Promise<T | null> {
  if (!isTauriApp()) {
    console.warn(`Tauri command "${command}" called outside Tauri environment`);
    return null;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Failed to invoke Tauri command "${command}":`, error);
    return null;
  }
}

/**
 * 窗口控制函数
 */
export const windowControls = {
  /**
   * 最小化窗口
   */
  minimize: async (): Promise<boolean> => {
    try {
      await safeTauriInvoke("minimize_window");
      return true;
    } catch (error) {
      console.error("Failed to minimize window:", error);
      return false;
    }
  },

  /**
   * 切换最大化状态
   */
  toggleMaximize: async (): Promise<boolean> => {
    try {
      await safeTauriInvoke("toggle_maximize");
      return true;
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
      return false;
    }
  },

  /**
   * 关闭窗口
   */
  close: async (): Promise<boolean> => {
    try {
      await safeTauriInvoke("close_window");
      return true;
    } catch (error) {
      console.error("Failed to close window:", error);
      return false;
    }
  },

  /**
   * 检查窗口是否最大化
   */
  isMaximized: async (): Promise<boolean> => {
    try {
      const result = await safeTauriInvoke<boolean>("is_window_maximized");
      return result ?? false;
    } catch (error) {
      console.error("Failed to check maximize state:", error);
      return false;
    }
  }
};

/**
 * 监听窗口状态变化
 */
export async function listenToWindowChanges(
  onMaximizeChange?: (isMaximized: boolean) => void
): Promise<(() => void) | null> {
  if (!isTauriApp()) {
    return null;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();

    // 监听窗口大小变化
    const unlisten = await appWindow.onResized(async () => {
      if (onMaximizeChange) {
        const isMaximized = await windowControls.isMaximized();
        onMaximizeChange(isMaximized);
      }
    });

    // 获取初始状态
    if (onMaximizeChange) {
      const isMaximized = await windowControls.isMaximized();
      onMaximizeChange(isMaximized);
    }

    return unlisten;
  } catch (error) {
    console.error("Failed to setup window listeners:", error);
    return null;
  }
}
