'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@heroui/button';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/dropdown';
import { useApp } from '@/contexts/AppContext';
import { Language } from '@/lib/i18n';

// Tauri type declaration
declare global {
  interface Window {
    __TAURI__?: any;
  }
}

// 窗口控制函数
async function minimizeWindow() {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    try {
      const { appWindow } = await eval('import("@tauri-apps/api/window")');
      await appWindow.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  }
}

async function toggleMaximize() {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    try {
      const { appWindow } = await eval('import("@tauri-apps/api/window")');
      const isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      console.error('Failed to toggle maximize:', error);
    }
  }
}

async function closeWindow() {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    try {
      const { appWindow } = await eval('import("@tauri-apps/api/window")');
      await appWindow.close();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }
}

export default function CustomTitleBar() {
  const { theme, toggleTheme, language, setLanguage, t } = useApp();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  // 检测Tauri环境并监听窗口状态变化
  useEffect(() => {
    // 检测是否在Tauri环境中
    const checkTauriEnvironment = () => {
      setIsTauri(typeof window !== 'undefined' && !!window.__TAURI__);
    };

    checkTauriEnvironment();

    if (typeof window !== 'undefined' && window.__TAURI__) {
      const setupWindowListeners = async () => {
        try {
          const { appWindow } = await eval('import("@tauri-apps/api/window")');

          // 监听窗口最大化状态变化
          const unlisten = await appWindow.onResized(() => {
            appWindow.isMaximized().then(setIsMaximized);
          });

          // 初始状态
          appWindow.isMaximized().then(setIsMaximized);

          return unlisten;
        } catch (error) {
          console.error('Failed to setup window listeners:', error);
        }
      };

      setupWindowListeners();
    }
  }, []);

  // 在开发环境中也显示标题栏，方便调试和预览
  // 只有在生产环境的浏览器中才隐藏标题栏
  if (!isTauri && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between h-8 bg-background/95 backdrop-blur-md shadow-sm select-none border-b border-divider/20"
      data-tauri-drag-region
    >
      {/* 左侧应用标识 */}
      <div className="flex items-center pl-3">
        <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-xs">PB</span>
        </div>
        <span className="ml-2 text-xs font-medium text-foreground/70">Paper Burner</span>
      </div>

      {/* 右侧控制按钮区域 - 参考用户软件样式 */}
      <div className="flex items-center bg-background/50 rounded-md mr-2 p-1 border border-divider/30">
        {/* 主题切换 */}
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-6 w-6 min-w-6 text-foreground/70 hover:text-foreground hover:bg-default-100/50 rounded-sm"
          onPress={toggleTheme}
          title={theme === 'light' ? t.darkTheme : t.lightTheme}
        >
          {theme === 'light' ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </Button>

        {/* 语言切换 */}
        <Dropdown>
          <DropdownTrigger>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-6 w-6 min-w-6 text-foreground/70 hover:text-foreground hover:bg-default-100/50 rounded-sm"
              title={language === 'zh' ? t.chinese : t.english}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.723 1.447a1 1 0 11-1.79-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
              </svg>
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Language selection"
            onAction={(key) => setLanguage(key as Language)}
          >
            <DropdownItem key="zh" className={language === 'zh' ? 'bg-primary/10' : ''}>
              中文
            </DropdownItem>
            <DropdownItem key="en" className={language === 'en' ? 'bg-primary/10' : ''}>
              English
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-divider/50 mx-1" />

        {/* 最小化 */}
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-6 w-6 min-w-6 text-foreground/70 hover:text-foreground hover:bg-default-100/50 rounded-sm"
          onPress={minimizeWindow}
          title={t.minimize}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
            <rect x="2" y="5" width="8" height="2" />
          </svg>
        </Button>

        {/* 最大化/还原 */}
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-6 w-6 min-w-6 text-foreground/70 hover:text-foreground hover:bg-default-100/50 rounded-sm"
          onPress={toggleMaximize}
          title={isMaximized ? t.restore : t.maximize}
        >
          {isMaximized ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
              <path d="M3 3h6v6H3V3zm1 1v4h4V4H4z" />
              <path d="M2 2h6v1H3v5H2V2z" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </Button>

        {/* 关闭 */}
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-6 w-6 min-w-6 text-foreground/70 hover:text-white hover:bg-red-500 rounded-sm"
          onPress={closeWindow}
          title={t.closeWindow}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
            <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
