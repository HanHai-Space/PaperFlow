'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, Translations, getTranslations } from '@/lib/i18n';

export type Theme = 'light' | 'dark';

export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface AppContextType {
  // 主题相关
  theme: Theme;
  toggleTheme: () => void;

  // 语言相关
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;

  // 通知相关
  showNotification: (options: NotificationOptions) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguageState] = useState<Language>('zh');
  const [notifications, setNotifications] = useState<(NotificationOptions & { id: string })[]>([]);

  // 从本地存储加载设置
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    const savedLanguage = localStorage.getItem('app-language') as Language;

    if (savedTheme) {
      setTheme(savedTheme);
    }

    if (savedLanguage) {
      setLanguageState(savedLanguage);
    }
  }, []);

  // 应用主题到文档
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = getTranslations(language);

  // 显示通知
  const showNotification = (options: NotificationOptions) => {
    const id = Date.now().toString();
    const notification = { ...options, id };

    setNotifications(prev => [...prev, notification]);

    // 自动移除通知
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, options.duration || 3000);
  };

  const value: AppContextType = {
    theme,
    toggleTheme,
    language,
    setLanguage,
    t,
    showNotification,
  };

  return (
    <AppContext.Provider value={value}>
      {children}

      {/* 通知显示区域 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              px-4 py-3 rounded-lg shadow-lg border max-w-sm
              ${notification.type === 'success' ? 'bg-success/10 border-success text-success' : ''}
              ${notification.type === 'error' ? 'bg-danger/10 border-danger text-danger' : ''}
              ${notification.type === 'warning' ? 'bg-warning/10 border-warning text-warning' : ''}
              ${notification.type === 'info' ? 'bg-primary/10 border-primary text-primary' : ''}
              animate-in slide-in-from-right duration-300
            `}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'warning' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
