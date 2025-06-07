'use client';

import { useEffect } from 'react';

export default function DisableContextMenu() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 添加全局右键禁用事件监听器
    document.addEventListener('contextmenu', handleContextMenu);

    // 清理函数
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return null; // 这个组件不渲染任何内容
}
