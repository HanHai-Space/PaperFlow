'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { isTauriApp, windowControls } from '@/lib/utils/tauri';

/**
 * 窗口控制测试组件
 * 用于测试窗口控制按钮的功能
 */
export default function WindowControlsTest() {
  const [isTauri, setIsTauri] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    setIsTauri(isTauriApp());
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testMinimize = async () => {
    addTestResult('测试最小化功能...');
    const success = await windowControls.minimize();
    addTestResult(success ? '✅ 最小化成功' : '❌ 最小化失败');
  };

  const testToggleMaximize = async () => {
    addTestResult('测试最大化/还原功能...');
    const success = await windowControls.toggleMaximize();
    if (success) {
      const maximized = await windowControls.isMaximized();
      setIsMaximized(maximized);
      addTestResult(`✅ 最大化/还原成功，当前状态: ${maximized ? '最大化' : '正常'}`);
    } else {
      addTestResult('❌ 最大化/还原失败');
    }
  };

  const testCheckMaximized = async () => {
    addTestResult('检查窗口最大化状态...');
    const maximized = await windowControls.isMaximized();
    setIsMaximized(maximized);
    addTestResult(`✅ 当前窗口状态: ${maximized ? '最大化' : '正常'}`);
  };

  const testClose = async () => {
    addTestResult('测试关闭功能...');
    const success = await windowControls.close();
    addTestResult(success ? '✅ 关闭成功' : '❌ 关闭失败');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!isTauri) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <h3 className="text-lg font-semibold">窗口控制测试</h3>
        </CardHeader>
        <CardBody>
          <p className="text-warning">⚠️ 当前不在 Tauri 环境中，无法测试窗口控制功能</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h3 className="text-lg font-semibold">窗口控制测试</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="space-y-2">
          <Button onClick={testMinimize} color="primary" size="sm" className="w-full">
            测试最小化
          </Button>
          <Button onClick={testToggleMaximize} color="secondary" size="sm" className="w-full">
            测试最大化/还原
          </Button>
          <Button onClick={testCheckMaximized} color="default" size="sm" className="w-full">
            检查窗口状态
          </Button>
          <Button onClick={testClose} color="danger" size="sm" className="w-full">
            测试关闭 (谨慎使用)
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">当前状态:</span>
            <span className={`text-sm ${isMaximized ? 'text-success' : 'text-default'}`}>
              {isMaximized ? '最大化' : '正常'}
            </span>
          </div>
          <Button onClick={clearResults} size="sm" variant="flat" className="w-full">
            清除测试结果
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium">测试结果:</h4>
            <div className="bg-content2 rounded-lg p-3 max-h-40 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-xs text-foreground/80 font-mono">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
