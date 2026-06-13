'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { TranslationsContext, Locale } from '@claw/ui';
export type { Locale };
import { useTranslations as useSharedTranslations } from '@claw/ui';
import en from '../../../messages/en.json';
import cn from '../../../messages/cn.json';
import extEn from 'virtual-messages-en';
import extCn from 'virtual-messages-cn';
import { CONFIG_KEYS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';

export type Messages = typeof en;
export type TranslationKey = keyof Messages;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actualExtEn = ((extEn as any)?.default || extEn || {}) as Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actualExtCn = ((extCn as any)?.default || extCn || {}) as Record<string, string>;

const mergedEn = { ...en, ...actualExtEn };
const mergedCn = { ...cn, ...actualExtCn };

if (typeof window !== 'undefined') {
  logger.info(
    `[i18n] Merged translations. Keys count: en=${Object.keys(mergedEn).length}, cn=${Object.keys(mergedCn).length}`
  );
  if (actualExtEn && Object.keys(actualExtEn).length > 0) {
    logger.info(`[i18n] Extension translations detected: ${Object.keys(actualExtEn).length} keys`);
  } else {
    logger.warn('[i18n] No extension translations found');
  }
}

const STORAGE_KEY = 'clawcenter_locale';

/**
 * TranslationsProvider manages the UI localization state and provides a translation utility.
 * It supports dynamic language switching and persists the language direction on the document element.
 * It also persists the user's preference in localStorage and synchronizes it with the backend.
 */
export const TranslationsProvider: React.FC<{
  children: React.ReactNode;
  initialLocale?: Locale;
}> = ({ children, initialLocale = 'cn' }) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const messages = useMemo<Messages>(
    () => (locale === 'cn' ? (mergedCn as Messages) : (mergedEn as Messages)),
    [locale]
  );

  // Sync with localStorage on mount (Client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedLocale = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (
        savedLocale &&
        savedLocale !== initialLocale &&
        (savedLocale === 'en' || savedLocale === 'cn')
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(savedLocale);
      }
    }
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }

    // Persist to backend
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: CONFIG_KEYS.ACTIVE_LOCALE,
          value: newLocale,
        }),
      });
    } catch (error) {
      logger.error('Failed to persist locale to backend:', error);
    }
  };

  const t = (key: string): string => {
    if (key === 'DASHBOARD_TITLE' && process.env.NEXT_PUBLIC_APP_TITLE) {
      return process.env.NEXT_PUBLIC_APP_TITLE;
    }
    if (key === 'LOGIN_TITLE' && process.env.NEXT_PUBLIC_APP_TITLE) {
      return `${process.env.NEXT_PUBLIC_APP_TITLE} Auth`;
    }
    return (messages as Record<string, string>)[key] ?? key;
  };

  const getLanguageTag = (loc: Locale) => (loc === 'cn' ? 'zh-CN' : 'en-US');

  const formatDate = (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString(getLanguageTag(locale), options);
  };

  const formatTime = (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleTimeString(getLanguageTag(locale), options);
  };

  return (
    <TranslationsContext.Provider value={{ t, locale, setLocale, formatDate, formatTime }}>
      {children}
    </TranslationsContext.Provider>
  );
};

/**
 * Hook to access translation functions and current locale.
 */
export { useSharedTranslations as useTranslations };
