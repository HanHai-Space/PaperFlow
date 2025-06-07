'use client';

import React, { useState } from 'react';
import { Button } from '@heroui/button';
import { Card } from '@heroui/card';
import { useApp } from '@/contexts/AppContext';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { t } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      key: 'upload',
      label: t.fileProcessing,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
          <path d="M6 8h8v2H6V8zm0 3h8v1H6v-1z" />
        </svg>
      )
    },
    {
      key: 'settings',
      label: t.systemSettings,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} h-full bg-background/80 backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out shadow-lg border-r border-divider/20`}>
      {/* 应用标题区域 */}
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} relative transition-all duration-300`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-white font-bold text-lg">PB</span>
          </div>
          {!isCollapsed && (
            <div className="transition-all duration-300 opacity-100 overflow-hidden">
              <h1 className="text-lg font-bold text-foreground whitespace-nowrap">{t.appTitle}</h1>
              <p className="text-xs text-foreground/60 whitespace-nowrap">{t.appSubtitle}</p>
            </div>
          )}
        </div>

        {/* 折叠按钮 */}
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className={`absolute ${isCollapsed ? 'top-1/2 -translate-y-1/2 -right-3 bg-background border border-divider/20 shadow-md rounded-full w-6 h-6 min-w-6' : 'top-2 right-2'} text-foreground/60 hover:text-foreground hover:bg-default-100/50 transition-all duration-300 z-10`}
          onPress={() => setIsCollapsed(!isCollapsed)}
        >
          <svg
            className={`${isCollapsed ? 'w-3 h-3' : 'w-4 h-4'} transition-all duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
      </div>

      {/* 导航菜单 */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2 py-4' : 'p-2'} transition-all duration-300`}>
        <div className={`${isCollapsed ? 'space-y-3' : 'space-y-1'}`}>
          {navItems.map((item) => (
            <div key={item.key} className="relative group">
              <Button
                variant={activeTab === item.key ? "flat" : "light"}
                color={activeTab === item.key ? "primary" : "default"}
                className={`w-full ${isCollapsed ? 'justify-center px-0 h-12 min-w-12 rounded-xl' : 'justify-start px-4 h-12'} transition-all duration-300 ${
                  activeTab === item.key
                    ? 'bg-primary/15 text-primary shadow-sm'
                    : 'text-foreground/70 hover:text-foreground hover:bg-default-100/50'
                }`}
                startContent={
                  <div className={`${activeTab === item.key ? 'text-primary' : 'text-foreground/50'} ${isCollapsed ? 'mx-0' : 'mr-2'} transition-colors duration-300`}>
                    {item.icon}
                  </div>
                }
                onPress={() => onTabChange(item.key)}
              >
                {!isCollapsed && (
                  <span className="font-medium transition-all duration-300 opacity-100">{item.label}</span>
                )}
              </Button>

              {/* 折叠状态下的悬浮提示 */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-background/95 backdrop-blur-sm border border-divider/20 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-background/95 mr-1"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* 状态指示器 */}
      <div className={`${isCollapsed ? 'px-2 pb-4' : 'p-2'} transition-all duration-300`}>
        <Card className="bg-success/10 shadow-sm">
          <div className={`${isCollapsed ? 'p-3' : 'p-3'} flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} transition-all duration-300`}>
            <div className={`${isCollapsed ? 'w-3 h-3' : 'w-2 h-2'} bg-success rounded-full animate-pulse transition-all duration-300`} />
            {!isCollapsed && (
              <span className="text-xs font-medium text-success transition-all duration-300 opacity-100">{t.ready}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
