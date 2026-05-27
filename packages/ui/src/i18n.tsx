import { createContext, useContext } from 'react';

export type Locale = 'en' | 'cn';

export interface TranslationsContextType {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}

export const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

/**
 * Hook to access translation functions and current locale.
 */
export const useTranslations = () => {
  const context = useContext(TranslationsContext);
  if (!context) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[i18n] TranslationsContext not found, using fallback. This usually means multiple copies of @claw/ui are present or the provider is missing.'
      );
    }
    // Return a default context for tests or cases where provider is missing
    return {
      t: (key: string) => key,
      locale: 'en' as Locale,
      setLocale: async () => {},
      formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === 'number' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', options);
      },
      formatTime: (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === 'number' ? new Date(date) : date;
        return d.toLocaleTimeString('en-US', options);
      },
    };
  }
  return context;
};
