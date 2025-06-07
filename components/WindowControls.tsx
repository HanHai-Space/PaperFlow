'use client';

import React, { useState, useEffect } from 'react';
import { isTauriApp, windowControls, listenToWindowChanges } from '@/lib/utils/tauri';

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  // 检测 Tauri 环境并监听窗口状态变化
  useEffect(() => {
    const checkTauri = () => {
      const tauriExists = isTauriApp();
      setIsTauri(tauriExists);
    };

    checkTauri();
    // 延迟检测，确保 Tauri 环境完全加载
    const timeout = setTimeout(checkTauri, 1000);
    return () => clearTimeout(timeout);
  }, []);

  // 监听窗口状态变化
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;

    const setupListeners = async () => {
      unlisten = await listenToWindowChanges(setIsMaximized);
    };

    setupListeners();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [isTauri]);

  // 窗口控制处理函数
  const handleMinimize = async () => {
    if (isTauri) {
      await windowControls.minimize();
    }
  };

  const handleToggleMaximize = async () => {
    if (isTauri) {
      await windowControls.toggleMaximize();
      // 立即更新状态，不等待监听器
      const maximized = await windowControls.isMaximized();
      setIsMaximized(maximized);
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      await windowControls.close();
    }
  };

  // 只在 Tauri 环境中显示窗口控制按钮
  if (!isTauri) {
    return null;
  }

  return (
    <div className="window-controls fixed top-0 right-0 z-[9999] flex items-center">
      {/* 最小化 */}
      <button
        onClick={handleMinimize}
        className="w-12 h-8 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-all duration-200 border-none outline-none bg-transparent"
        title="最小化"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
          <line x1="3" y1="6" x2="9" y2="6" />
        </svg>
      </button>

      {/* 最大化/还原 */}
      <button
        onClick={handleToggleMaximize}
        className="w-12 h-8 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-all duration-200 border-none outline-none bg-transparent"
        title={isMaximized ? "还原" : "最大化"}
      >
        {isMaximized ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
            <rect x="3" y="3" width="6" height="6" />
            <path d="M7 3V1a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H9" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" />
          </svg>
        )}
      </button>

      {/* 关闭 */}
      <button
        onClick={handleClose}
        className="w-12 h-8 flex items-center justify-center text-foreground/60 hover:text-white hover:bg-red-500 transition-all duration-200 border-none outline-none bg-transparent"
        title="关闭"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      </button>
    </div>
  );
}
