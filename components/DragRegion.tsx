'use client';

import React, { useState, useEffect } from 'react';
import { isTauriApp } from '@/lib/utils/tauri';

export default function DragRegion() {
  const [isTauri, setIsTauri] = useState(false);

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

  // 只在 Tauri 环境中显示拖拽区域
  if (!isTauri) {
    return null;
  }

  return (
    <>
      {/* 顶部标题栏拖拽区域 - 严格限制在红框区域内，避开窗口控制按钮 */}
      <div
        className="drag-region fixed top-0 left-0 right-36 h-8 z-30 rounded-tl-xl"
        data-tauri-drag-region
        style={{
          WebkitAppRegion: 'drag',
          pointerEvents: 'auto',
          // 调试用：取消注释下面这行可以看到拖拽区域
          // backgroundColor: 'rgba(255, 0, 0, 0.3)'
        } as React.CSSProperties}
      />

      {/* 确保窗口控制按钮区域禁用拖拽 */}
      <div
        className="fixed top-0 right-0 w-36 h-8 z-50 rounded-tr-xl"
        style={{
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'auto'
        } as React.CSSProperties}
      />

      {/* 确保页面内容区域禁用拖拽 */}
      <div
        className="fixed top-8 left-0 right-0 bottom-0 z-10"
        style={{
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'none'
        } as React.CSSProperties}
      />
    </>
  );
}
