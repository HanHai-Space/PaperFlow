'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Button } from '@heroui/button';
import { Progress } from '@heroui/progress';
import { Chip } from '@heroui/chip';
import { Divider } from '@heroui/divider';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal';
import { Input } from '@heroui/input';
import {
  ProcessingSession,
  ProcessingRecord,
  ProcessingResult,
  Settings
} from '@/types/pdf-processor';
import {
  loadProcessingSessions,
  saveProcessingSession,
  deleteProcessingSession,
  updateProcessingRecord,
  createProcessingSession
} from '@/lib/storage';
import { useApp } from '@/contexts/AppContext';

interface ProcessingSessionManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onResumeSession: (session: ProcessingSession) => void;
  onViewResult: (result: ProcessingResult) => void;
  settings: Settings;
}

export default function ProcessingSessionManager({
  isVisible,
  onClose,
  onResumeSession,
  onViewResult,
  settings
}: ProcessingSessionManagerProps) {
  const { t, language } = useApp();
  const [sessions, setSessions] = useState<ProcessingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ProcessingSession | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // 加载处理会话
  const loadSessions = useCallback(async () => {
    const loadedSessions = await loadProcessingSessions();
    setSessions(loadedSessions);
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadSessions();
    }
  }, [isVisible, loadSessions]);

  // 删除会话
  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteSession = useCallback(async () => {
    if (sessionToDelete) {
      await deleteProcessingSession(sessionToDelete);
      await loadSessions();
      setSessionToDelete(null);
      setShowDeleteConfirm(false);
    }
  }, [sessionToDelete, loadSessions]);

  // 继续处理会话
  const handleResumeSession = useCallback((session: ProcessingSession) => {
    onResumeSession(session);
    onClose();
  }, [onResumeSession, onClose]);



  // 在外部打开文件
  const handleOpenExternal = useCallback(async (record: ProcessingRecord, fileType: 'pdf' | 'markdown' | 'translation') => {
    if (!record.processingResult) return;

    const result = record.processingResult;
    let content = '';
    let filename = '';

    switch (fileType) {
      case 'pdf':
        if (result.originalFile) {
          // 创建临时 URL 并在新窗口打开
          const url = URL.createObjectURL(result.originalFile);
          window.open(url, '_blank');
          // 延迟清理 URL
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        return;
      case 'markdown':
        content = result.markdownContent || '';
        filename = `${result.fileName}_markdown.md`;
        break;
      case 'translation':
        content = result.translationContent || '';
        filename = `${result.fileName}_translation.md`;
        break;
    }

    if (content) {
      // 创建下载链接
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, []);

  // 获取状态颜色
  const getStatusColor = (status: ProcessingRecord['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'danger';
      case 'processing': return 'primary';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: ProcessingRecord['status']) => {
    switch (status) {
      case 'pending': return t.pending;
      case 'processing': return t.processing;
      case 'completed': return t.completed;
      case 'failed': return t.failed;
      case 'paused': return t.paused;
      default: return t.unknown;
    }
  };

  // 计算会话进度
  const calculateSessionProgress = (session: ProcessingSession) => {
    const totalFiles = session.totalFiles;
    const completedFiles = session.records.filter(r => r.status === 'completed').length;
    return totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  };

  return (
    <>
      <Modal
        isOpen={isVisible}
        onClose={onClose}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-semibold">{t.sessionManagement}</h2>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>{t.noSessionRecords}</p>
                </div>
              ) : (
                sessions.map((session) => {
                  const progress = calculateSessionProgress(session);
                  const hasUnfinished = session.records.some(r =>
                    r.status === 'pending' || r.status === 'processing' || r.status === 'paused'
                  );

                  return (
                    <Card key={session.id} className="w-full">
                      <CardHeader className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <h3 className="text-lg font-semibold">{session.name}</h3>
                          <p className="text-sm text-gray-500">
                            {t.createdAt}: {formatTime(session.createdAt)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {t.updatedAt}: {formatTime(session.updatedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {hasUnfinished && (
                            <Button
                              color="primary"
                              size="sm"
                              onPress={() => handleResumeSession(session)}
                            >
                              {t.continueProcessing}
                            </Button>
                          )}
                          <Button
                            color="danger"
                            variant="light"
                            size="sm"
                            onPress={() => handleDeleteSession(session.id)}
                          >
                            {t.delete}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">{t.overallProgress}</span>
                            <span className="text-sm">{Math.round(progress)}%</span>
                          </div>
                          <Progress
                            value={progress}
                            color="primary"
                            className="w-full"
                          />

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-semibold">{session.totalFiles}</div>
                              <div className="text-gray-500">{t.totalFiles}</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-green-600">{session.completedFiles}</div>
                              <div className="text-gray-500">{t.completedFiles}</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-red-600">{session.failedFiles}</div>
                              <div className="text-gray-500">{t.failedFiles}</div>
                            </div>
                          </div>

                          <Divider />

                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {session.records.map((record) => (
                              <div key={record.id} className="p-3 bg-content2 hover:bg-content3 rounded-lg transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{record.fileName}</p>
                                    <p className="text-xs text-foreground/60">
                                      {(record.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Chip
                                      color={getStatusColor(record.status)}
                                      size="sm"
                                      variant="flat"
                                    >
                                      {getStatusText(record.status)}
                                    </Chip>
                                    {record.progress > 0 && record.status !== 'completed' && (
                                      <span className="text-xs text-foreground/60">
                                        {Math.round(record.progress)}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 文件操作按钮 */}
                                {record.status === 'completed' && record.processingResult && (
                                  <div className="flex flex-wrap gap-1 mt-2">

                                    {record.processingResult.markdownContent && (
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        color="success"
                                        onPress={() => handleOpenExternal(record, 'markdown')}
                                        className="text-xs"
                                      >
                                        {t.downloadRecognition}
                                      </Button>
                                    )}

                                    {record.processingResult.translationContent && (
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        color="warning"
                                        onPress={() => handleOpenExternal(record, 'translation')}
                                        className="text-xs"
                                      >
                                        {t.downloadTranslation}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="light" onPress={onClose}>
              {t.close}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <ModalContent>
          <ModalHeader>{t.confirmDelete}</ModalHeader>
          <ModalBody>
            <p>{t.deleteSessionConfirm}</p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="light"
              onPress={() => setShowDeleteConfirm(false)}
            >
              {t.cancel}
            </Button>
            <Button
              color="danger"
              onPress={confirmDeleteSession}
            >
              {t.delete}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
