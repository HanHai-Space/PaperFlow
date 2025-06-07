/**
 * 系统托盘工具函数
 * 提供托盘事件监听和窗口控制功能
 */

import { isTauriApp, safeTauriInvoke } from './tauri';

/**
 * 托盘事件监听器
 */
export class TrayEventListener {
  private unlistenNavigateToSettings?: () => void;
  private unlistenNavigateToUpload?: () => void;

  /**
   * 初始化托盘事件监听
   */
  async initialize(onNavigateToSettings?: () => void, onNavigateToUpload?: () => void) {
    if (!isTauriApp()) {
      console.warn('Tray events not available outside Tauri environment');
      return;
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();

      // 监听导航到设置页面事件
      if (onNavigateToSettings) {
        this.unlistenNavigateToSettings = await appWindow.listen('navigate-to-settings', () => {
          onNavigateToSettings();
        });
      }

      // 监听导航到文件上传页面事件
      if (onNavigateToUpload) {
        this.unlistenNavigateToUpload = await appWindow.listen('navigate-to-upload', () => {
          onNavigateToUpload();
        });
      }

      console.log('Tray event listeners initialized');
    } catch (error) {
      console.error('Failed to initialize tray event listeners:', error);
    }
  }

  /**
   * 清理事件监听器
   */
  cleanup() {
    if (this.unlistenNavigateToSettings) {
      this.unlistenNavigateToSettings();
      this.unlistenNavigateToSettings = undefined;
    }

    if (this.unlistenNavigateToUpload) {
      this.unlistenNavigateToUpload();
      this.unlistenNavigateToUpload = undefined;
    }
  }
}

/**
 * 托盘窗口控制函数
 */
export const trayWindowControls = {
  /**
   * 显示主窗口
   */
  showMainWindow: async (): Promise<boolean> => {
    try {
      await safeTauriInvoke('show_main_window');
      return true;
    } catch (error) {
      console.error('Failed to show main window:', error);
      return false;
    }
  },

  /**
   * 隐藏到托盘
   */
  hideToTray: async (): Promise<boolean> => {
    try {
      await safeTauriInvoke('hide_to_tray');
      return true;
    } catch (error) {
      console.error('Failed to hide to tray:', error);
      return false;
    }
  },

  /**
   * 检查是否支持托盘功能
   */
  isTraySupported: (): boolean => {
    return isTauriApp();
  },

  /**
   * 退出应用程序
   */
  quitApp: async (): Promise<boolean> => {
    try {
      await safeTauriInvoke('quit_app');
      return true;
    } catch (error) {
      console.error('Failed to quit app:', error);
      return false;
    }
  }
};

/**
 * 全局托盘事件监听器实例
 */
export const globalTrayListener = new TrayEventListener();

/**
 * 初始化托盘功能
 */
export async function initializeTray(
  onNavigateToSettings?: () => void,
  onNavigateToUpload?: () => void
) {
  if (!isTauriApp()) {
    return;
  }

  await globalTrayListener.initialize(onNavigateToSettings, onNavigateToUpload);

  // 在页面卸载时清理监听器
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      globalTrayListener.cleanup();
    });
  }
}
