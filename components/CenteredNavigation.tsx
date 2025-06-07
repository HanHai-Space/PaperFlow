'use client';

import React from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { useApp } from '@/contexts/AppContext';

interface CenteredNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function CenteredNavigation({ activeTab, onTabChange }: CenteredNavigationProps) {
  const { theme, toggleTheme, language, setLanguage, t } = useApp();

  const navigationItems = [
    {
      key: 'upload',
      label: t.fileProcessing || '文件处理',
      description: t.fileUpload || 'PDF文件上传和处理',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
          <path d="M6 8h8v2H6V8zm0 3h8v1H6v-1z" />
        </svg>
      ),
      color: 'primary' as const
    },
    {
      key: 'settings',
      label: t.settings || '设置',
      description: t.systemSettings || '系统设置和配置',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
      color: 'secondary' as const
    }
  ];

  const utilityButtons = [
    {
      key: 'theme',
      label: theme === 'light' ? (t.darkTheme || '深色主题') : (t.lightTheme || '浅色主题'),
      action: toggleTheme,
      icon: theme === 'light' ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ),
      color: 'default' as const
    },
    {
      key: 'language-zh',
      label: '中文',
      action: () => setLanguage('zh'),
      icon: (
        <span className="text-sm font-bold">中</span>
      ),
      color: language === 'zh' ? 'primary' : 'default' as const
    },
    {
      key: 'language-en',
      label: 'English',
      action: () => setLanguage('en'),
      icon: (
        <span className="text-sm font-bold">EN</span>
      ),
      color: language === 'en' ? 'primary' : 'default' as const
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-8">
      {/* 应用标题 */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">PB</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Paper Burner</h1>
            <p className="text-foreground/60">{t.appSubtitle || 'PDF OCR & 翻译工具'}</p>
          </div>
        </div>
      </div>

      {/* 主要导航按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {navigationItems.map((item) => (
          <Card
            key={item.key}
            isPressable
            isHoverable
            className={`transition-all duration-200 ${
              activeTab === item.key
                ? 'ring-2 ring-primary shadow-lg scale-105'
                : 'hover:scale-102 hover:shadow-md'
            }`}
            onPress={() => onTabChange(item.key)}
          >
            <CardBody className="p-6 text-center space-y-4">
              <div className={`flex justify-center ${
                activeTab === item.key ? 'text-primary' : 'text-foreground/70'
              }`}>
                {item.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{item.label}</h3>
                <p className="text-sm text-foreground/60 mt-1">{item.description}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* 工具按钮 */}
      <div className="flex flex-wrap justify-center gap-3">
        {utilityButtons.map((button) => (
          <Button
            key={button.key}
            variant={button.color === 'primary' ? 'solid' : 'bordered'}
            color={button.color as "default" | "primary" | "secondary" | "success" | "warning" | "danger"}
            size="sm"
            startContent={button.icon}
            onPress={button.action}
            className="min-w-20"
          >
            {button.label}
          </Button>
        ))}
      </div>

      {/* 基于 paper-burner 二次开发说明 */}
      <div className="text-center text-sm text-foreground/50 mt-8">
        {language === 'zh' ? (
          <>
            <span>基于 </span>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open('https://github.com/baoyudu/paper-burner', '_blank', 'noopener,noreferrer');
                }
              }}
              className="text-primary hover:text-primary/80 underline transition-colors cursor-pointer"
            >
              paper-burner
            </button>
            <span> 二次开发</span>
          </>
        ) : (
          <>
            <span>Based on </span>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open('https://github.com/baoyudu/paper-burner', '_blank', 'noopener,noreferrer');
                }
              }}
              className="text-primary hover:text-primary/80 underline transition-colors cursor-pointer"
            >
              paper-burner
            </button>
            <span> secondary development</span>
          </>
        )}
      </div>

    </div>
  );
}
