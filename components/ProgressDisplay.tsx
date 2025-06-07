'use client';

import React, { useState, useEffect, useRef } from 'react';

import { Progress } from '@heroui/progress';
import { Chip } from '@heroui/chip';
import { Button } from '@heroui/button';
import { Divider } from '@heroui/divider';
import { useApp } from '@/contexts/AppContext';

interface ProgressDisplayProps {
  isVisible: boolean;
  isProcessing: boolean;
  totalFiles?: number;
  processedFiles?: number;
  logs?: string[];
  onClear?: () => void;
  currentFileProgress?: {
    fileName: string;
    status: string;
    progress: number;
  };
}

export default function ProgressDisplay({
  isVisible,
  isProcessing,
  totalFiles = 0,
  processedFiles = 0,
  logs: externalLogs = [],
  onClear,
  currentFileProgress
}: ProgressDisplayProps) {
  const [internalLogs, setInternalLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useApp();

  // Use external logs if provided, otherwise use internal logs
  const displayLogs = externalLogs.length > 0 ? externalLogs : internalLogs;



  // 计算进度百分比
  useEffect(() => {
    if (totalFiles > 0) {
      setProgress((processedFiles / totalFiles) * 100);
    } else {
      setProgress(0);
    }
  }, [processedFiles, totalFiles]);

  // 添加日志的方法 (only for internal logs)
  const addLog = React.useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setInternalLogs(prev => [...prev, logEntry]);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [displayLogs]);

  // 清除日志
  const clearLogs = React.useCallback(() => {
    setInternalLogs([]);
    setProgress(0);
    onClear?.();
  }, [onClear]);

  // 切换折叠状态
  const toggleCollapse = React.useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // 复制日志到剪贴板
  const copyLogsToClipboard = React.useCallback(async () => {
    if (displayLogs.length === 0) return;

    try {
      const logsText = displayLogs.join('\n');
      await navigator.clipboard.writeText(logsText);

      showNotification({
        type: 'success',
        message: `已复制 ${displayLogs.length} 条日志到剪贴板`,
        duration: 2000
      });
    } catch (error) {
      console.error('复制日志失败:', error);

      // 降级方案：使用传统的复制方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = displayLogs.join('\n');
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        showNotification({
          type: 'success',
          message: `已复制 ${displayLogs.length} 条日志到剪贴板`,
          duration: 2000
        });
      } catch (fallbackError) {
        console.error('降级复制方案也失败:', fallbackError);
        showNotification({
          type: 'error',
          message: '复制日志失败，请手动选择复制',
          duration: 3000
        });
      }
    }
  }, [displayLogs, showNotification]);

  if (!isVisible) return null;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center py-2 px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h2 className="text-lg font-semibold text-foreground">处理进度</h2>
        </div>
        <div className="flex items-center gap-1">
          {/* 折叠/展开按钮 */}
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={toggleCollapse}
            className="text-foreground/70 hover:text-foreground w-6 h-6"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Button>
          {!isProcessing && displayLogs.length > 0 && (
            <Button
              size="sm"
              color="danger"
              variant="light"
              onPress={clearLogs}
              className="text-xs px-2 py-1 h-6"
            >
              清除日志
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-3 py-3 px-4">
        {/* 批次进度信息 - 紧凑布局 */}
        {totalFiles > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                批次进度: {processedFiles}/{totalFiles} 文件
              </span>
              <Chip
                size="sm"
                color={isProcessing ? "primary" : "success"}
                variant="flat"
                className="text-xs px-2 py-1 h-6"
              >
                {Math.round(progress)}%
              </Chip>
            </div>
            <Progress
              value={progress}
              color={isProcessing ? "primary" : "success"}
              className="w-full"
              size="sm"
            />

            {/* 当前文件详细进度 - 更紧凑的设计 */}
            {currentFileProgress && isProcessing && (
              <div className="p-2 bg-content2 rounded-md border border-divider">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-foreground truncate max-w-[65%]" title={currentFileProgress.fileName}>
                    当前文件: {currentFileProgress.fileName}
                  </span>
                  <Chip
                    size="sm"
                    color="primary"
                    variant="flat"
                    className="text-xs px-2 py-1 h-5 flex-shrink-0"
                  >
                    {currentFileProgress.progress}%
                  </Chip>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-foreground/70">
                    {/* 处理中时不显示状态文字，只显示进度条 */}
                    {!isProcessing && currentFileProgress.status && (
                      <span>状态: {currentFileProgress.status}</span>
                    )}
                  </div>
                </div>
                <Progress
                  value={currentFileProgress.progress}
                  color="primary"
                  className="w-full"
                  size="sm"
                />
              </div>
            )}
          </div>
        )}



        {/* 日志显示区域 - 紧凑设计 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-foreground/70">处理日志:</span>
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="flat" color="default" className="text-xs px-2 py-1 h-5">
                {displayLogs.length} 条记录
              </Chip>
              {displayLogs.length > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  onPress={() => copyLogsToClipboard()}
                  className="text-foreground/70 hover:text-foreground w-6 h-6"
                  title="复制日志内容"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                  </svg>
                </Button>
              )}
            </div>
          </div>

          <div
            ref={logContainerRef}
            className="logs-container bg-content2 rounded-md p-2 h-28 overflow-auto text-xs text-foreground/80 font-mono border border-divider w-full"
          >
            {displayLogs.length === 0 ? (
              <div className="text-foreground/40 italic">暂无日志记录...</div>
            ) : (
              displayLogs.map((log, index) => (
                <div
                  key={index}
                  className={`leading-tight mb-0.5 ${
                    log.includes('错误') || log.includes('失败')
                      ? 'text-danger'
                      : log.includes('完成') || log.includes('成功')
                      ? 'text-success'
                      : log.includes('开始') || log.includes('处理')
                      ? 'text-primary'
                      : 'text-foreground/80'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>


        </div>
      )}
    </div>
  );
}

// 创建一个Hook来管理进度显示
export function useProgressDisplay() {
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentFileProgress, setCurrentFileProgress] = useState<{
    fileName: string;
    status: string;
    progress: number;
  } | undefined>(undefined);

  const addLog = React.useCallback((message: string) => {
    // 检查消息是否已经包含时间戳，避免重复添加
    const hasTimestamp = message.match(/^\[\d{2}:\d{2}:\d{2}\]/);
    if (hasTimestamp) {
      setLogs(prev => [...prev, message]);
    } else {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${message}`;
      setLogs(prev => [...prev, logEntry]);
    }
  }, []);

  const startProcessing = React.useCallback((totalFileCount: number) => {
    setIsVisible(true);
    setIsProcessing(true);
    setTotalFiles(totalFileCount);
    setProcessedFiles(0);
    setLogs([]);
    addLog('开始处理...');
  }, [addLog]);

  const finishProcessing = React.useCallback(() => {
    setIsProcessing(false);
    // 确保进度条显示100%，但不超过实际处理的文件数
    setProcessedFiles(prev => Math.max(prev, totalFiles));
    addLog('所有文件处理完成');
  }, [addLog, totalFiles]);

  const incrementProcessedFiles = React.useCallback(() => {
    setProcessedFiles(prev => prev + 1);
  }, []);

  const updateCurrentFileProgress = React.useCallback((fileName: string, status: string, progress: number) => {
    setCurrentFileProgress({ fileName, status, progress });
  }, []);

  const clearCurrentFileProgress = React.useCallback(() => {
    setCurrentFileProgress(undefined);
  }, []);

  const clear = React.useCallback(() => {
    setIsVisible(false);
    setIsProcessing(false);
    setTotalFiles(0);
    setProcessedFiles(0);
    setLogs([]);
    setCurrentFileProgress(undefined);
  }, []);

  return {
    // 状态
    isVisible,
    isProcessing,
    totalFiles,
    processedFiles,
    logs,
    currentFileProgress,

    // 方法
    addLog,
    startProcessing,
    finishProcessing,
    incrementProcessedFiles,
    updateCurrentFileProgress,
    clearCurrentFileProgress,
    clear
  };
}
