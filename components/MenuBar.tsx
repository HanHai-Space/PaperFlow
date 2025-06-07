'use client';

import React, { useState } from 'react';
import { Button } from '@heroui/button';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/dropdown';
import { useApp } from '@/contexts/AppContext';

interface MenuBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function MenuBar({ activeTab, onTabChange }: MenuBarProps) {
  const { theme, toggleTheme, language, setLanguage, t } = useApp();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menuItems = [
    {
      key: 'file',
      label: t.file || '文件',
      items: [
        { key: 'upload', label: t.fileProcessing || '文件处理', action: () => onTabChange('upload') },
        { key: 'separator1', type: 'separator' },
        { key: 'exit', label: t.exit || '退出', action: () => window.close() }
      ]
    },
    {
      key: 'edit',
      label: t.edit || '编辑',
      items: [
        { key: 'settings', label: t.settings || '设置', action: () => onTabChange('settings') }
      ]
    },
    {
      key: 'view',
      label: t.view || '视图',
      items: [
        { key: 'theme', label: theme === 'light' ? (t.darkTheme || '深色主题') : (t.lightTheme || '浅色主题'), action: toggleTheme },
        { key: 'separator2', type: 'separator' },
        { key: 'language-zh', label: '中文', action: () => setLanguage('zh') },
        { key: 'language-en', label: 'English', action: () => setLanguage('en') }
      ]
    },
    {
      key: 'help',
      label: t.help || '帮助',
      items: [
        { key: 'about', label: t.about || '关于', action: () => console.log('About') }
      ]
    }
  ];

  const handleMenuClick = (menuKey: string) => {
    setActiveMenu(activeMenu === menuKey ? null : menuKey);
  };

  const handleItemClick = (item: any) => {
    if (item.action) {
      item.action();
    }
    setActiveMenu(null);
  };

  return (
    <div className="h-8 bg-background/95 backdrop-blur-md border-b border-divider/20 flex items-center px-2 select-none">
      {/* 应用图标和名称 */}
      <div className="flex items-center mr-4">
        <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-sm flex items-center justify-center mr-2">
          <span className="text-white font-bold text-xs">PB</span>
        </div>
        <span className="text-xs font-medium text-foreground/70">Paper Burner</span>
      </div>

      {/* 菜单项 */}
      <div className="flex items-center">
        {menuItems.map((menu) => (
          <Dropdown
            key={menu.key}
            isOpen={activeMenu === menu.key}
            onOpenChange={(isOpen) => setActiveMenu(isOpen ? menu.key : null)}
          >
            <DropdownTrigger>
              <Button
                variant="light"
                size="sm"
                className={`h-6 px-2 text-xs font-normal rounded-sm ${
                  activeMenu === menu.key
                    ? 'bg-primary/20 text-primary'
                    : 'text-foreground/70 hover:text-foreground hover:bg-default-100/50'
                }`}
                onPress={() => handleMenuClick(menu.key)}
              >
                {menu.label}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={menu.label}
              className="min-w-48"
              onAction={(key) => {
                const item = menu.items.find(item => item.key === key);
                if (item) {
                  handleItemClick(item);
                }
              }}
            >
              {menu.items.map((item) => {
                if (item.type === 'separator') {
                  return (
                    <DropdownItem
                      key={item.key}
                      className="h-px p-0 bg-divider/50"
                      isDisabled
                    >
                      <div />
                    </DropdownItem>
                  );
                }

                return (
                  <DropdownItem
                    key={item.key}
                    className="text-xs"
                    startContent={
                      (item.key === activeTab) ||
                      (item.key === 'language-zh' && language === 'zh') ||
                      (item.key === 'language-en' && language === 'en') ? (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      ) : (
                        <div className="w-2 h-2" />
                      )
                    }
                  >
                    {item.label}
                  </DropdownItem>
                );
              })}
            </DropdownMenu>
          </Dropdown>
        ))}
      </div>

      {/* 右侧状态区域 */}
      <div className="flex-1" />

      {/* 当前页面指示器 */}
      <div className="flex items-center text-xs text-foreground/50">
        <span>{activeTab === 'upload' ? (t.fileProcessing || '文件处理') : (t.settings || '设置')}</span>
      </div>
    </div>
  );
}
