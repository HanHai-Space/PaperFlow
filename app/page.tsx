'use client';

import React, { useState, useEffect, useCallback } from 'react';
import FileUploadPage from '@/components/FileUploadPage';
import SettingsPage from '@/components/SettingsPage';
import ProgressDisplay, { useProgressDisplay } from '@/components/ProgressDisplay';
import DisableContextMenu from '@/components/DisableContextMenu';
import CenteredNavigation from '@/components/CenteredNavigation';
import TauriThemeManager from '@/components/TauriThemeManager';
import WindowControls from '@/components/WindowControls';
// import WindowControlsTest from '@/components/WindowControlsTest';
import DragRegion from '@/components/DragRegion';
import { AppProvider, useApp } from '@/contexts/AppContext';
import {
  ProcessingResult,
  TranslationModel,
  TargetLanguage,
  Settings
} from '@/types/pdf-processor';
import {
  loadSettings,
  saveSettings,
  loadApiKeysFromStorage,
  updateApiKeyStorage
} from '@/lib/storage';
import { Button } from '@heroui/button';
import { initializeTray } from '@/lib/utils/tray';
import { useErrorModal } from '@/components/ErrorModal';

function HomeContent() {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState('home');
  const [mistralKeys, setMistralKeys] = useState<string[]>([]);
  const [translationKeys, setTranslationKeys] = useState<string[]>([]);
  const [translationModel, setTranslationModel] = useState<TranslationModel>('none');
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>('chinese');
  const [customTargetLanguage, setCustomTargetLanguage] = useState('');
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);

  // 错误提示模态框
  const { showError, showWarning, showInfo, showSuccess, ErrorModal } = useErrorModal();

  // 添加测试数据按钮（仅用于调试）
  const addTestData = () => {
    const testResult: ProcessingResult = {
      success: true,
      fileName: 'test-document',
      markdownContent: '# 测试文档\n\n这是一个测试文档的内容。\n\n## 章节 1\n\n这里是一些测试内容。\n\n```javascript\nconsole.log("Hello World");\n```\n\n## 章节 2\n\n更多的测试内容。',
      translationContent: '# Test Document\n\nThis is the content of a test document.\n\n## Section 1\n\nHere is some test content.\n\n```javascript\nconsole.log("Hello World");\n```\n\n## Section 2\n\nMore test content.',
      imagesData: [],
      originalFile: undefined, // 暂时没有文件
      fileUrl: undefined
    };
    setProcessingResults([testResult]);
    setActiveTab('viewer');
  };

  // 添加测试处理记录
  const addTestProcessingRecord = () => {
    // 导入处理记录相关函数
    import('@/lib/storage').then(async ({ createProcessingSession, saveProcessingSession, updateProcessingRecord }) => {
      // 创建一个虚拟文件对象
      const testFile = new File(['test content'], 'test-document.pdf', { type: 'application/pdf' });

      // 创建测试会话
      const session = createProcessingSession('测试处理会话', [testFile], settings);

      // 更新记录为完成状态
      const recordId = session.records[0].id;
      const testResult: ProcessingResult = {
        success: true,
        fileName: 'test-document',
        markdownContent: '# 测试文档\n\n这是一个测试文档的内容。\n\n## 章节 1\n\n这里是一些测试内容。\n\n```javascript\nconsole.log("Hello World");\n```\n\n## 章节 2\n\n更多的测试内容。',
        translationContent: '# Test Document\n\nThis is the content of a test document.\n\n## Section 1\n\nHere is some test content.\n\n```javascript\nconsole.log("Hello World");\n```\n\n## Section 2\n\nMore test content.',
        imagesData: [],
        originalFile: testFile,
        fileUrl: URL.createObjectURL(testFile)
      };

      updateProcessingRecord(session.id, recordId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
        processingResult: testResult
      });

      // 保存会话
      await saveProcessingSession(session);

      showSuccess('测试处理记录已添加！请在文件处理页面点击"处理记录"查看。', '测试数据');
    });
  };
  const [settings, setSettings] = useState<Settings>({
    maxTokensPerChunk: 9000,
    skipProcessedFiles: false,
    concurrencyLevel: 1,
    translationConcurrencyLevel: 2,
    defaultSystemPrompt: '',
    defaultUserPromptTemplate: '',
    useCustomPrompts: false,
    customApiEndpoint: '',
    customModelId: '',
    customRequestFormat: 'openai',
    customTemperature: 0.5,
    customMaxTokens: 8000,
    saveLocation: './pdf2md/',
    autoSaveCompleted: true,
    enableProcessingRecord: true,
    translationModel: 'none',
    targetLanguage: 'chinese',
    customTargetLanguage: '',
    enableGoogleDrive: false,
    googleDriveClientId: '',
    googleDriveClientSecret: '',
    googleDriveFolderId: '',
    googleDriveAutoUpload: false,
    enableRecognitionToEpub: false,
    enableTranslationToEpub: false,
    pandocPath: 'pandoc',
    pandocArgs: '-f native -s -t epub'
  });

  const progressDisplay = useProgressDisplay();

  // Translation controller state
  const [translationController, setTranslationController] = useState<any>(null);



  // 初始化加载
  useEffect(() => {
    const initializeApp = async () => {
      // 加载设置
      const loadedSettings = loadSettings();

      // 如果保存位置是默认的相对路径，尝试获取用户特定的默认路径
      if (loadedSettings.saveLocation === './pdf2md/') {
        try {
          const { getDefaultDownloadPathAsync } = await import('@/lib/storage');
          const defaultPath = await getDefaultDownloadPathAsync();
          loadedSettings.saveLocation = defaultPath;
          // 保存更新后的设置
          saveSettings(loadedSettings);
        } catch (error) {
          console.warn('Failed to get user-specific default path:', error);
        }
      }

      setSettings(loadedSettings);

      // 从设置中加载翻译配置
      setTranslationModel(loadedSettings.translationModel);
      setTargetLanguage(loadedSettings.targetLanguage);
      setCustomTargetLanguage(loadedSettings.customTargetLanguage);

      // 加载API Keys
      const savedKeys = loadApiKeysFromStorage();
      if (savedKeys.mistralApiKeys) {
        setMistralKeys(savedKeys.mistralApiKeys.split('\n').filter(k => k.trim()));
      }
      if (savedKeys.translationApiKeys) {
        setTranslationKeys(savedKeys.translationApiKeys.split('\n').filter(k => k.trim()));
      }

      // 初始化托盘功能
      initializeTray(
        () => setActiveTab('settings'),    // 导航到设置页面
        () => setActiveTab('upload')       // 导航到文件处理页面
      );
    };

    initializeApp();
  }, []);

  const handleProgress = (message: string) => {
    progressDisplay.addLog(message);
  };

  const handleFileProgress = (fileName: string, status: string, progress: number) => {
    progressDisplay.updateCurrentFileProgress(fileName, status, progress);
  };

  const handleProcessingStart = (totalFiles: number) => {
    progressDisplay.startProcessing(totalFiles);
  };

  const handleFileComplete = () => {
    progressDisplay.incrementProcessedFiles();
    progressDisplay.clearCurrentFileProgress();
  };

  const handleResults = (results: ProcessingResult[]) => {
    progressDisplay.finishProcessing();
    setProcessingResults(results);
    console.log('handleResults - Processing results:', results);
    console.log('handleResults - Results count:', results.length);
    console.log('handleResults - Successful results:', results.filter(r => r.success));

    // 不自动切换页面，保持在当前文件处理页面
    // 用户可以手动切换到查看页面查看结果
    console.log('handleResults - Processing completed, staying on current page');
  };

  // API Keys 管理
  const handleMistralKeysChange = (keys: string[]) => {
    setMistralKeys(keys);
    updateApiKeyStorage('mistralApiKeys', keys.join('\n'), keys.length > 0);
  };

  const handleTranslationKeysChange = (keys: string[]) => {
    setTranslationKeys(keys);
    updateApiKeyStorage('translationApiKeys', keys.join('\n'), keys.length > 0);
  };

  // 设置管理
  const handleSettingsChange = (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  // 翻译设置变化处理
  const handleTranslationModelChange = (model: TranslationModel) => {
    setTranslationModel(model);
    const updatedSettings = { ...settings, translationModel: model };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  const handleTargetLanguageChange = (language: TargetLanguage) => {
    setTargetLanguage(language);
    const updatedSettings = { ...settings, targetLanguage: language };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  const handleCustomTargetLanguageChange = (customLanguage: string) => {
    setCustomTargetLanguage(customLanguage);
    const updatedSettings = { ...settings, customTargetLanguage: customLanguage };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  // Translation controller ready handler
  const handleTranslationControllerReady = (controller: any) => {
    setTranslationController(controller);
  };



  return (
    <div className="flex flex-col flex-1 overflow-hidden">
        {/* 主内容区域 */}
        <div className="flex-1 overflow-auto hide-scrollbar">
          {/* 显示居中导航或具体页面 */}
          {activeTab === 'home' || !activeTab ? (
            <CenteredNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          ) : (
            <div className="p-6 space-y-6">
              {/* 返回按钮 */}
              <div className="flex items-center space-x-4 mb-6">
                <button
                  onClick={() => setActiveTab('home')}
                  className="flex items-center space-x-2 text-foreground/70 hover:text-foreground transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>{t.settingsPage.backToHome}</span>
                </button>
                <div className="h-6 w-px bg-divider" />
                <h2 className="text-xl font-semibold text-foreground">
                  {activeTab === 'upload' ? (t.fileProcessing || '文件处理') :
                   (t.settings || '设置')}
                </h2>
              </div>

              {/* 页面内容 */}
              {activeTab === 'upload' && (
                <FileUploadPage
                  mistralKeys={mistralKeys}
                  translationKeys={translationKeys}
                  translationModel={translationModel}
                  targetLanguage={targetLanguage}
                  customTargetLanguage={customTargetLanguage}
                  settings={settings}
                  onProgress={handleProgress}
                  onFileProgress={handleFileProgress}
                  onProcessingStart={handleProcessingStart}
                  onFileComplete={handleFileComplete}
                  onResults={handleResults}
                  onTranslationControllerReady={handleTranslationControllerReady}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage
                  mistralKeys={mistralKeys}
                  translationKeys={translationKeys}
                  translationModel={translationModel}
                  targetLanguage={targetLanguage}
                  customTargetLanguage={customTargetLanguage}
                  settings={settings}
                  onMistralKeysChange={handleMistralKeysChange}
                  onTranslationKeysChange={handleTranslationKeysChange}
                  onTranslationModelChange={handleTranslationModelChange}
                  onTargetLanguageChange={handleTargetLanguageChange}
                  onCustomTargetLanguageChange={handleCustomTargetLanguageChange}
                  onSettingsChange={handleSettingsChange}
                />
              )}


            </div>
          )}
        </div>

        {/* 进度显示组件 */}
        <ProgressDisplay
          isVisible={progressDisplay.isVisible}
          isProcessing={progressDisplay.isProcessing}
          totalFiles={progressDisplay.totalFiles}
          processedFiles={progressDisplay.processedFiles}
          logs={progressDisplay.logs}
          currentFileProgress={progressDisplay.currentFileProgress}
          onClear={progressDisplay.clear}
        />

        {/* 错误提示模态框 */}
        <ErrorModal />
      </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <div className="h-screen flex flex-col relative overflow-hidden rounded-xl">
        {/* 禁用右键菜单 */}
        <DisableContextMenu />

        {/* Tauri主题管理器 */}
        <TauriThemeManager />

        {/* 拖拽区域组件 */}
        <DragRegion />

        {/* 窗口控制按钮 */}
        <WindowControls />

        {/* 主要内容 */}
        <HomeContent />
      </div>
    </AppProvider>
  );
}
