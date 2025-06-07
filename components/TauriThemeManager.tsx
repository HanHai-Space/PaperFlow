'use client';

import { useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';

export default function TauriThemeManager() {
  const { theme } = useApp();

  useEffect(() => {
    // 只在Tauri环境中执行
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const updateTauriTheme = async () => {
        try {
          console.log('Updating Tauri theme to:', theme);

          // 优先使用我们的自定义命令
          const { invoke } = await eval('import("@tauri-apps/api/tauri")');
          await invoke('set_window_theme', { theme: theme });
          console.log('Tauri theme updated successfully via custom command');
        } catch (error) {
          console.error('Failed to update Tauri theme via custom command:', error);

          // 备用方法：使用原生API
          try {
            const { getCurrent } = await eval('import("@tauri-apps/api/window")');
            const appWindow = getCurrent();

            if (theme === 'dark') {
              await appWindow.setTheme('dark');
            } else {
              await appWindow.setTheme('light');
            }
            console.log('Tauri theme updated via native API');
          } catch (nativeError) {
            console.error('Both methods failed:', nativeError);
          }
        }
      };

      updateTauriTheme();
    }
  }, [theme]);

  // 这个组件不渲染任何内容
  return null;
}
