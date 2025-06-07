// 错误提示模态框组件
'use client';

import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/modal';
import { Button } from '@heroui/button';

export interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
}

export function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'error'
}: ErrorModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return '❌';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'error':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'primary';
      case 'success':
        return 'success';
      default:
        return 'danger';
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'error':
        return '错误';
      case 'warning':
        return '警告';
      case 'info':
        return '信息';
      case 'success':
        return '成功';
      default:
        return '错误';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      classNames={{
        backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20"
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getIcon()}</span>
            <span className="text-lg font-semibold">
              {title || getDefaultTitle()}
            </span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {message}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color={getColor()}
            variant="light"
            onPress={onClose}
          >
            确定
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Hook for using error modal
export function useErrorModal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalProps, setModalProps] = React.useState<{
    title?: string;
    message: string;
    type?: 'error' | 'warning' | 'info' | 'success';
  }>({
    message: ''
  });

  const showError = React.useCallback((message: string, title?: string) => {
    setModalProps({ message, title, type: 'error' });
    onOpen();
  }, [onOpen]);

  const showWarning = React.useCallback((message: string, title?: string) => {
    setModalProps({ message, title, type: 'warning' });
    onOpen();
  }, [onOpen]);

  const showInfo = React.useCallback((message: string, title?: string) => {
    setModalProps({ message, title, type: 'info' });
    onOpen();
  }, [onOpen]);

  const showSuccess = React.useCallback((message: string, title?: string) => {
    setModalProps({ message, title, type: 'success' });
    onOpen();
  }, [onOpen]);

  const ErrorModalComponent = React.useCallback(() => (
    <ErrorModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalProps.title}
      message={modalProps.message}
      type={modalProps.type}
    />
  ), [isOpen, onClose, modalProps]);

  return {
    showError,
    showWarning,
    showInfo,
    showSuccess,
    ErrorModal: ErrorModalComponent
  };
}
