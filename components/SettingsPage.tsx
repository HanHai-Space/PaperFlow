'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Button } from '@heroui/button';
import { Input, Textarea } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import { Divider } from '@heroui/divider';
import { Chip } from '@heroui/chip';
import { Switch } from '@heroui/switch';
import {
  TranslationModel,
  TargetLanguage,
  Settings,
  CustomRequestFormat
} from '@/types/pdf-processor';

import { useApp } from '@/contexts/AppContext';
import { createGoogleDriveService, uploadZipToGoogleDrive } from '@/lib/google-drive';
import { safeTauriInvoke, isTauriApp } from '@/lib/tauri-utils';
import { checkPandocAvailability } from '@/lib/epub-converter';
import { useErrorModal } from '@/components/ErrorModal';

interface SettingsPageProps {
  mistralKeys: string[];
  translationKeys: string[];
  translationModel: TranslationModel;
  targetLanguage: TargetLanguage;
  customTargetLanguage: string;
  settings: Settings;
  onMistralKeysChange: (keys: string[]) => void;
  onTranslationKeysChange: (keys: string[]) => void;
  onTranslationModelChange: (model: TranslationModel) => void;
  onTargetLanguageChange: (language: TargetLanguage) => void;
  onCustomTargetLanguageChange: (language: string) => void;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export default function SettingsPage({
  mistralKeys,
  translationKeys,
  translationModel,
  targetLanguage,
  customTargetLanguage,
  settings,
  onMistralKeysChange,
  onTranslationKeysChange,
  onTranslationModelChange,
  onTargetLanguageChange,
  onCustomTargetLanguageChange,
  onSettingsChange
}: SettingsPageProps) {
  const { t } = useApp();
  const [newMistralKey, setNewMistralKey] = useState('');
  const [newTranslationKey, setNewTranslationKey] = useState('');
  const [googleDriveAuthStatus, setGoogleDriveAuthStatus] = useState<'none' | 'pending' | 'authenticated'>('none');
  const [googleDriveAuthUrl, setGoogleDriveAuthUrl] = useState('');
  const [googleDriveAuthCode, setGoogleDriveAuthCode] = useState('');
  const [pandocStatus, setPandocStatus] = useState<'unknown' | 'checking' | 'available' | 'unavailable'>('unknown');
  const [pandocVersion, setPandocVersion] = useState<string>('');

  // 错误提示模态框
  const { showError, showWarning, showInfo, showSuccess, ErrorModal } = useErrorModal();



  // API Key 管理
  const addMistralKey = useCallback(() => {
    if (newMistralKey.trim()) {
      // 支持多行输入，按行切分
      const keys = newMistralKey
        .split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0 && !mistralKeys.includes(key));

      if (keys.length > 0) {
        onMistralKeysChange([...mistralKeys, ...keys]);
        setNewMistralKey('');
      }
    }
  }, [newMistralKey, mistralKeys, onMistralKeysChange]);

  const removeMistralKey = useCallback((index: number) => {
    onMistralKeysChange(mistralKeys.filter((_, i) => i !== index));
  }, [mistralKeys, onMistralKeysChange]);

  const addTranslationKey = useCallback(() => {
    if (newTranslationKey.trim()) {
      // 支持多行输入，按行切分
      const keys = newTranslationKey
        .split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0 && !translationKeys.includes(key));

      if (keys.length > 0) {
        onTranslationKeysChange([...translationKeys, ...keys]);
        setNewTranslationKey('');
      }
    }
  }, [newTranslationKey, translationKeys, onTranslationKeysChange]);

  const removeTranslationKey = useCallback((index: number) => {
    onTranslationKeysChange(translationKeys.filter((_, i) => i !== index));
  }, [translationKeys, onTranslationKeysChange]);

  // 处理键盘快捷键
  const handleMistralKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addMistralKey();
    }
  }, [addMistralKey]);

  const handleTranslationKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addTranslationKey();
    }
  }, [addTranslationKey]);

  // Google Drive 认证管理
  const handleGoogleDriveAuth = useCallback(async () => {
    if (!settings.googleDriveClientId || !settings.googleDriveClientSecret) {
      showWarning('请先填写 Google Drive Client ID 和 Client Secret', 'Google Drive 认证');
      return;
    }

    try {
      const service = createGoogleDriveService(settings);
      if (service) {
        const authUrl = service.getAuthUrl();
        setGoogleDriveAuthUrl(authUrl);
        setGoogleDriveAuthStatus('pending');

        // 在新窗口中打开认证URL
        window.open(authUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to start Google Drive authentication:', error);
      showError('启动 Google Drive 认证失败', 'Google Drive 认证');
    }
  }, [settings]);

  const handleGoogleDriveAuthCode = useCallback(async () => {
    if (!googleDriveAuthCode.trim()) {
      alert(t.settingsPage.authCodeRequired);
      return;
    }

    try {
      const service = createGoogleDriveService(settings);
      if (service) {
        const success = await service.setAuthCode(googleDriveAuthCode.trim());
        if (success) {
          setGoogleDriveAuthStatus('authenticated');
          setGoogleDriveAuthCode('');
          alert(t.settingsPage.authSuccess);
        } else {
          alert(t.settingsPage.authFailed);
        }
      }
    } catch (error) {
      console.error('Failed to authenticate with Google Drive:', error);
      alert(t.settingsPage.authError);
    }
  }, [googleDriveAuthCode, settings, t]);

  const handleGoogleDriveDisconnect = useCallback(() => {
    try {
      const service = createGoogleDriveService(settings);
      if (service) {
        service.clearAuth();
        setGoogleDriveAuthStatus('none');
        setGoogleDriveAuthUrl('');
        setGoogleDriveAuthCode('');
        showSuccess('已断开 Google Drive 连接', 'Google Drive');
      }
    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error);
    }
  }, [settings]);

  const handleTestGoogleDriveUpload = useCallback(async () => {
    try {
      // 创建一个测试ZIP文件
      const testContent = 'This is a test file for Google Drive upload.';
      const encoder = new TextEncoder();
      const testData = encoder.encode(testContent);

      const fileName = `test_upload_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;

      console.log('Starting test upload to Google Drive...');
      const result = await uploadZipToGoogleDrive(testData, fileName, settings);

      if (result.success) {
        showSuccess(`测试上传成功！\n文件名: ${result.fileName}\n文件ID: ${result.fileId}`, 'Google Drive 测试');
      } else {
        showError(`测试上传失败: ${result.error}`, 'Google Drive 测试');
      }
    } catch (error) {
      console.error('Test upload failed:', error);
      showError(`测试上传失败: ${error instanceof Error ? error.message : String(error)}`, 'Google Drive 测试');
    }
  }, [settings]);

  const handleTestZipSave = useCallback(async () => {
    console.log('Testing Tauri environment detection:', {
      isTauriApp: isTauriApp(),
      hasTauriGlobal: typeof window !== 'undefined' && '__TAURI__' in window,
      windowTauri: typeof window !== 'undefined' ? (window as any).__TAURI__ : undefined
    });

    // 强制尝试调用Tauri命令，忽略检测结果
    console.log('Attempting to call Tauri command regardless of detection...');

    try {
      // 创建一个测试ZIP文件内容
      const testContent = 'This is a test ZIP file content.';
      const encoder = new TextEncoder();
      const testData = encoder.encode(testContent);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `test_zip_${timestamp}.txt`;
      const normalizedSaveDirectory = settings.saveLocation.replace(/\//g, '\\');
      const filePath = `${normalizedSaveDirectory}\\${fileName}`;

      console.log('Testing ZIP save with:', {
        filePath,
        saveLocation: settings.saveLocation,
        normalizedSaveDirectory,
        dataLength: testData.length,
        isTauriApp: isTauriApp()
      });

      await safeTauriInvoke('save_zip_file', {
        zipData: Array.from(testData),
        filePath: filePath
      });

      console.log('ZIP save test successful');
      showSuccess(`测试ZIP保存成功！文件路径: ${filePath}`, 'ZIP 保存测试');

    } catch (error) {
      console.error('Test ZIP save failed:', error);
      showError(`测试ZIP保存失败: ${error instanceof Error ? error.message : String(error)}`, 'ZIP 保存测试');
    }
  }, [settings]);

  // 测试Pandoc可用性
  const handleTestPandoc = useCallback(async () => {
    setPandocStatus('checking');
    setPandocVersion('');

    try {
      const result = await checkPandocAvailability(settings.pandocPath);

      if (result.available) {
        setPandocStatus('available');
        setPandocVersion(result.version || 'unknown');
      } else {
        setPandocStatus('unavailable');
        showError('Pandoc 不可用: ' + (result.error || '未知错误'), 'Pandoc 测试');
      }
    } catch (error) {
      setPandocStatus('unavailable');
      showError('测试 Pandoc 时出错: ' + (error instanceof Error ? error.message : String(error)), 'Pandoc 测试');
    }
  }, [settings.pandocPath]);

  // 检查Google Drive认证状态
  useEffect(() => {
    if (settings.enableGoogleDrive && settings.googleDriveClientId && settings.googleDriveClientSecret) {
      try {
        const service = createGoogleDriveService(settings);
        if (service) {
          service.loadTokens();
          if (service.isAuth()) {
            setGoogleDriveAuthStatus('authenticated');
          } else {
            setGoogleDriveAuthStatus('none');
          }
        } else {
          setGoogleDriveAuthStatus('none');
        }
      } catch (error) {
        console.error('Failed to check Google Drive auth status:', error);
        setGoogleDriveAuthStatus('none');
      }
    } else {
      setGoogleDriveAuthStatus('none');
    }
  }, [settings.enableGoogleDrive, settings.googleDriveClientId, settings.googleDriveClientSecret]);

  return (
    <div className="space-y-6">
      {/* API 密钥设置 */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            🔑 {t.apiKeySettings}
          </h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Mistral API Keys */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t.mistralApiKey} <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3 mb-3">
              <Textarea
                placeholder={`${t.settingsPage.enterMistralKey}\n\n支持多行输入，每行一个API Key：\nkey1\nkey2\nkey3`}
                value={newMistralKey}
                onValueChange={setNewMistralKey}
                onKeyDown={handleMistralKeyDown}
                minRows={3}
                maxRows={8}
                className="w-full"
                description="支持单个或多个API Key，每行一个。快捷键：Ctrl+Enter 添加"
              />
              <div className="flex justify-between items-center">
                <div className="text-sm text-foreground/60">
                  {newMistralKey.split('\n').filter(k => k.trim()).length > 1
                    ? `检测到 ${newMistralKey.split('\n').filter(k => k.trim()).length} 个API Key`
                    : ''}
                </div>
                <Button
                  color="primary"
                  onPress={addMistralKey}
                  isDisabled={!newMistralKey.trim()}
                  size="sm"
                >
                  {newMistralKey.split('\n').filter(k => k.trim()).length > 1 ? '批量添加' : t.addApiKey}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mistralKeys.map((key, index) => (
                <Chip
                  key={index}
                  variant="flat"
                  color="primary"
                  size="sm"
                  onClose={() => removeMistralKey(index)}
                >
                  ...{key.slice(-8)}
                </Chip>
              ))}
              {mistralKeys.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t.settingsPage.noMistralKeys}</p>
              )}
            </div>
          </div>

          <Divider />

          {/* Translation API Keys */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t.settingsPage.translationApiKeysOptional}
            </label>
            <div className="space-y-3 mb-3">
              <Textarea
                placeholder={`${t.settingsPage.enterTranslationKey}\n\n支持多行输入，每行一个API Key：\nkey1\nkey2\nkey3`}
                value={newTranslationKey}
                onValueChange={setNewTranslationKey}
                onKeyDown={handleTranslationKeyDown}
                minRows={3}
                maxRows={8}
                className="w-full"
                description="支持单个或多个API Key，每行一个。快捷键：Ctrl+Enter 添加"
              />
              <div className="flex justify-between items-center">
                <div className="text-sm text-foreground/60">
                  {newTranslationKey.split('\n').filter(k => k.trim()).length > 1
                    ? `检测到 ${newTranslationKey.split('\n').filter(k => k.trim()).length} 个API Key`
                    : ''}
                </div>
                <Button
                  color="primary"
                  onPress={addTranslationKey}
                  isDisabled={!newTranslationKey.trim()}
                  size="sm"
                >
                  {newTranslationKey.split('\n').filter(k => k.trim()).length > 1 ? '批量添加' : t.addApiKey}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {translationKeys.map((key, index) => (
                <Chip
                  key={index}
                  variant="flat"
                  color="secondary"
                  size="sm"
                  onClose={() => removeTranslationKey(index)}
                >
                  ...{key.slice(-8)}
                </Chip>
              ))}
              {translationKeys.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t.settingsPage.noTranslationKeys}</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 翻译设置 */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            🌐 {t.translationSettings}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label={t.translationModel}
              selectedKeys={[translationModel]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as TranslationModel;
                onTranslationModelChange(selected);
              }}
            >
              <SelectItem key="none">{t.noTranslation}</SelectItem>
              <SelectItem key="mistral">Mistral Large</SelectItem>
              <SelectItem key="deepseek">DeepSeek v3</SelectItem>
              <SelectItem key="gemini">Gemini 2.0 Flash</SelectItem>
              <SelectItem key="claude">Claude 3.5 Sonnet</SelectItem>
              <SelectItem key="tongyi-deepseek-v3">通义百炼 DeepSeek v3</SelectItem>
              <SelectItem key="volcano-deepseek-v3">火山引擎 DeepSeek v3</SelectItem>
              <SelectItem key="chutes-deepseek-v3">Chutes AI DeepSeek v3</SelectItem>
              <SelectItem key="custom">{t.customModel}</SelectItem>
            </Select>

            <div>
              <Select
                label={t.targetLanguage}
                selectedKeys={[targetLanguage]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as TargetLanguage;
                  onTargetLanguageChange(selected);
                }}
              >
                <SelectItem key="chinese">{t.chinese}</SelectItem>
                <SelectItem key="english">{t.english}</SelectItem>
                <SelectItem key="japanese">日本語</SelectItem>
                <SelectItem key="korean">한국어</SelectItem>
                <SelectItem key="french">Français</SelectItem>
                <SelectItem key="custom">{t.customLanguage}</SelectItem>
              </Select>

              {targetLanguage === 'custom' && (
                <Input
                  label={t.settingsPage.customTargetLanguageName}
                  placeholder={t.settingsPage.customTargetLanguagePlaceholder}
                  value={customTargetLanguage}
                  onValueChange={onCustomTargetLanguageChange}
                  className="mt-2"
                />
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 文件保存设置 */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            💾 {t.fileSaveSettings}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t.saveLocation}
            </label>
            <Input
              value={settings.saveLocation}
              onValueChange={(value) => onSettingsChange({ saveLocation: value })}
              placeholder={t.saveLocation}
              description={t.settingsPage.autoSaveDescription}
            />
          </div>

          <div className="space-y-6">
            <div>
              <Switch
                isSelected={settings.autoSaveCompleted}
                onValueChange={(checked) => onSettingsChange({ autoSaveCompleted: checked })}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t.settingsPage.autoSaveCompletedFiles}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.autoSaveDescription}</span>
                </div>
              </Switch>
            </div>

            <div>
              <Switch
                isSelected={settings.enableProcessingRecord}
                onValueChange={(checked) => onSettingsChange({ enableProcessingRecord: checked })}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t.settingsPage.enableProcessingRecords}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.enableProcessingRecordsDescription}</span>
                </div>
              </Switch>
            </div>
          </div>

          <Divider />

          {/* 测试功能 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t.settingsPage.testFeatures}</h3>
            <div className="flex gap-2">
              <Button
                color="primary"
                size="sm"
                variant="light"
                onPress={handleTestZipSave}
              >
                {t.settingsPage.testZipSave}
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-300 self-center">
                ({t.settingsPage.detection}: {isTauriApp() ? t.settingsPage.desktopVersion : t.settingsPage.browserVersion})
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Google Drive 设置 */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            ☁️ {t.settingsPage.googleDriveSettings}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Switch
              isSelected={settings.enableGoogleDrive}
              onValueChange={(checked) => onSettingsChange({ enableGoogleDrive: checked })}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{t.settingsPage.enableGoogleDrive}</span>
                <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.enableGoogleDriveDescription}</span>
              </div>
            </Switch>
          </div>

          {settings.enableGoogleDrive && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t.settingsPage.googleDriveClientId}
                  placeholder={t.settingsPage.googleDriveClientIdPlaceholder}
                  value={settings.googleDriveClientId}
                  onValueChange={(value) => onSettingsChange({ googleDriveClientId: value })}
                  isRequired
                />
                <Input
                  label={t.settingsPage.googleDriveClientSecret}
                  placeholder={t.settingsPage.googleDriveClientSecretPlaceholder}
                  value={settings.googleDriveClientSecret}
                  onValueChange={(value) => onSettingsChange({ googleDriveClientSecret: value })}
                  type="password"
                  isRequired
                />
              </div>

              <Input
                label={t.settingsPage.googleDriveFolderId}
                placeholder={t.settingsPage.googleDriveFolderIdPlaceholder}
                value={settings.googleDriveFolderId}
                onValueChange={(value) => onSettingsChange({ googleDriveFolderId: value })}
                description={t.settingsPage.googleDriveFolderIdDescription}
              />

              <div>
                <Switch
                  isSelected={settings.googleDriveAutoUpload}
                  onValueChange={(checked) => onSettingsChange({ googleDriveAutoUpload: checked })}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.settingsPage.googleDriveAutoUpload}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.googleDriveAutoUploadDescription}</span>
                  </div>
                </Switch>
              </div>

              <Divider />

              {/* Google Drive 认证状态 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t.settingsPage.authenticationStatus}</h3>

                <div className="flex items-center space-x-3">
                  <Chip
                    color={googleDriveAuthStatus === 'authenticated' ? 'success' :
                           googleDriveAuthStatus === 'pending' ? 'warning' : 'default'}
                    variant="flat"
                  >
                    {googleDriveAuthStatus === 'authenticated' ? t.settingsPage.authenticated :
                     googleDriveAuthStatus === 'pending' ? t.settingsPage.pending : t.settingsPage.unauthenticated}
                  </Chip>

                  {googleDriveAuthStatus === 'none' && (
                    <Button
                      color="primary"
                      size="sm"
                      onPress={handleGoogleDriveAuth}
                      isDisabled={!settings.googleDriveClientId || !settings.googleDriveClientSecret}
                    >
                      {t.settingsPage.startAuth}
                    </Button>
                  )}

                  {googleDriveAuthStatus === 'authenticated' && (
                    <div className="flex gap-2">
                      <Button
                        color="success"
                        size="sm"
                        variant="light"
                        onPress={handleTestGoogleDriveUpload}
                      >
                        {t.settingsPage.testUpload}
                      </Button>
                      <Button
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={handleGoogleDriveDisconnect}
                      >
                        {t.settingsPage.disconnect}
                      </Button>
                    </div>
                  )}
                </div>

                {googleDriveAuthStatus === 'pending' && (
                  <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {t.settingsPage.authInstructions}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t.settingsPage.enterAuthCode}
                        value={googleDriveAuthCode}
                        onValueChange={setGoogleDriveAuthCode}
                        className="flex-1"
                      />
                      <Button
                        color="primary"
                        onPress={handleGoogleDriveAuthCode}
                        isDisabled={!googleDriveAuthCode.trim()}
                      >
                        {t.settingsPage.confirm}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* EPUB 转换设置 */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            📚 {t.settingsPage.epubConversionSettings}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-6">
            <div>
              <Switch
                isSelected={settings.enableRecognitionToEpub}
                onValueChange={(checked) => onSettingsChange({ enableRecognitionToEpub: checked })}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t.settingsPage.convertRecognitionToEpub}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.convertRecognitionToEpubDescription}</span>
                </div>
              </Switch>
            </div>

            <div>
              <Switch
                isSelected={settings.enableTranslationToEpub}
                onValueChange={(checked) => onSettingsChange({ enableTranslationToEpub: checked })}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t.settingsPage.convertTranslationToEpub}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.convertTranslationToEpubDescription}</span>
                </div>
              </Switch>
            </div>
          </div>

          {(settings.enableRecognitionToEpub || settings.enableTranslationToEpub) && (
            <div className="space-y-4">
              <Divider />

              <div className="grid grid-cols-1 gap-4">
                <Input
                  label={t.settingsPage.pandocPath}
                  placeholder="pandoc"
                  value={settings.pandocPath}
                  onValueChange={(value) => onSettingsChange({ pandocPath: value })}
                  description={t.settingsPage.pandocPathDescription}
                />

                <Input
                  label={t.settingsPage.pandocParameters}
                  placeholder="-f markdown -s -t epub"
                  value={settings.pandocArgs}
                  onValueChange={(value) => onSettingsChange({ pandocArgs: value })}
                  description={t.settingsPage.pandocParametersDescription}
                />
              </div>

              {/* Pandoc 测试 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    color="primary"
                    size="sm"
                    variant="light"
                    onPress={handleTestPandoc}
                    isLoading={pandocStatus === 'checking'}
                    isDisabled={!settings.pandocPath.trim()}
                  >
                    {pandocStatus === 'checking' ? t.settingsPage.checking : t.settingsPage.testPandoc}
                  </Button>

                  {pandocStatus !== 'unknown' && pandocStatus !== 'checking' && (
                    <Chip
                      color={pandocStatus === 'available' ? 'success' : 'danger'}
                      variant="flat"
                      size="sm"
                    >
                      {pandocStatus === 'available'
                        ? `${t.settingsPage.available} ${pandocVersion ? `(v${pandocVersion})` : ''}`
                        : t.settingsPage.unavailable
                      }
                    </Chip>
                  )}
                </div>

                {pandocStatus === 'available' && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    ✅ {t.settingsPage.pandocInstalled}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-300 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <strong>{t.settingsPage.usageInstructions}：</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>{t.settingsPage.usageInstructionsList[0]}<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">https://pandoc.org/installing.html</code></li>
                  <li>{t.settingsPage.usageInstructionsList[1]}</li>
                  <li>{t.settingsPage.usageInstructionsList[2]}</li>
                  <li>{t.settingsPage.usageInstructionsList[3]}</li>
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 高级设置 */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            🔧 {t.advancedSettings}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label={t.settingsPage.fileProcessingConcurrency}
              value={settings.concurrencyLevel.toString()}
              onValueChange={(value) => onSettingsChange({ concurrencyLevel: parseInt(value) || 1 })}
              min={1}
              max={10}
              description={`${t.settingsPage.fileProcessingConcurrency}，${t.settingsPage.defaultValue} 1。`}
            />
            <Input
              type="number"
              label={t.settingsPage.translationTaskConcurrency}
              value={settings.translationConcurrencyLevel.toString()}
              onValueChange={(value) => onSettingsChange({ translationConcurrencyLevel: parseInt(value) || 2 })}
              min={1}
              max={150}
              description={`${t.settingsPage.translationTaskConcurrency}，${t.settingsPage.defaultValue} 2。`}
            />
          </div>

          <Input
            type="range"
            label={`${t.settingsPage.maxTokensPerTranslationChunk} (${settings.maxTokensPerChunk})`}
            value={settings.maxTokensPerChunk.toString()}
            onValueChange={(value) => onSettingsChange({ maxTokensPerChunk: parseInt(value) || 9000 })}
            min={500}
            max={10000}
            step={100}
            description={`${t.settingsPage.maxTokensPerTranslationChunk}，${t.settingsPage.defaultValue} 9000。`}
          />

          {/* 自定义模型设置 */}
          {translationModel === 'custom' && (
            <>
              <Divider />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t.settingsPage.customModelSettings}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t.apiEndpoint}
                    value={settings.customApiEndpoint}
                    onValueChange={(value) => onSettingsChange({ customApiEndpoint: value })}
                    placeholder={`${t.settingsPage.example}: https://api.openai.com/v1/chat/completions`}
                    isRequired
                  />
                  <Input
                    label={t.modelId}
                    value={settings.customModelId}
                    onValueChange={(value) => onSettingsChange({ customModelId: value })}
                    placeholder={`${t.settingsPage.example}: gpt-4-turbo 或 claude-3-opus-20240229`}
                    isRequired
                  />
                  <Select
                    label={t.requestFormat}
                    selectedKeys={[settings.customRequestFormat]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as CustomRequestFormat;
                      onSettingsChange({ customRequestFormat: selected });
                    }}
                  >
                    <SelectItem key="openai">{t.settingsPage.openaiFormat}</SelectItem>
                    <SelectItem key="anthropic">{t.settingsPage.anthropicFormat}</SelectItem>
                    <SelectItem key="gemini">{t.settingsPage.geminiFormat}</SelectItem>
                  </Select>
                  <Input
                    type="number"
                    label={t.temperature}
                    value={settings.customTemperature.toString()}
                    onValueChange={(value) => onSettingsChange({ customTemperature: parseFloat(value) || 0.5 })}
                    min={0}
                    max={2}
                    step={0.01}
                    description={t.settingsPage.temperatureDescription}
                  />
                  <Input
                    type="number"
                    label={t.maxTokens}
                    value={settings.customMaxTokens.toString()}
                    onValueChange={(value) => onSettingsChange({ customMaxTokens: parseInt(value) || 8000 })}
                    min={1}
                    max={32768}
                    description={t.settingsPage.maxTokensDescription}
                  />
                </div>
              </div>
            </>
          )}

          {/* 翻译提示词设置 */}
          <Divider />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t.settingsPage.customPrompts}</h3>
            <div>
              <Switch
                isSelected={settings.useCustomPrompts}
                onValueChange={(checked) => onSettingsChange({ useCustomPrompts: checked })}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t.settingsPage.useCustomPrompts}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">{t.settingsPage.useCustomPromptsDescription}</span>
                </div>
              </Switch>
            </div>

            {settings.useCustomPrompts && (
              <div className="space-y-4">
                <Textarea
                  label={t.settingsPage.systemPrompt}
                  placeholder={t.settingsPage.systemPromptPlaceholder}
                  value={settings.defaultSystemPrompt}
                  onValueChange={(value) => onSettingsChange({ defaultSystemPrompt: value })}
                  minRows={3}
                  maxRows={6}
                  description={t.settingsPage.systemPromptDescription}
                />
                <Textarea
                  label={t.settingsPage.userPromptTemplate}
                  placeholder={t.settingsPage.userPromptTemplatePlaceholder}
                  value={settings.defaultUserPromptTemplate}
                  onValueChange={(value) => onSettingsChange({ defaultUserPromptTemplate: value })}
                  minRows={6}
                  maxRows={12}
                  description={t.settingsPage.userPromptTemplateDescription}
                />
                <div className="text-xs text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <strong>{t.settingsPage.promptTips}：</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {t.settingsPage.promptTipsList.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 错误提示模态框 */}
      <ErrorModal />
    </div>
  );
}
