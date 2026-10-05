import React, { createContext, useContext, useEffect, useState } from 'react';
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';

export type Language = 'en' | 'hi';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
];

// Extensible map for future Indian languages
const translations: Record<Language, any> = {
  en,
  hi,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isHindi: boolean;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'kisanconnect-lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
      if (savedLang === 'en' || savedLang === 'hi') {
        return savedLang;
      }
    } catch (e) {
      // Local storage unavailable
    }
    return 'en'; // Default language: English
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      // Synchronize farmer dashboard storage key if present
      localStorage.setItem('kc_farmer_lang', newLang);
    } catch (e) {
      console.warn('Failed to persist language preference', e);
    }
  };

  /**
   * Translates a dot-notated key with optional variable interpolation
   * Example: t('common.getStarted')
   * Example: t('navbar.switchRole', { role: 'Farmer' })
   */
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    
    // 1. Look in current language
    let value: any = translations[language];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // 2. Fallback to English if not found
    if (value === undefined && language !== 'en') {
      let fallbackValue: any = translations.en;
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object' && k in fallbackValue) {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }

    // 3. Fallback to key itself
    if (value === undefined) {
      return keys[keys.length - 1] || key;
    }

    if (typeof value !== 'string') {
      return String(value);
    }

    // Parameter interpolation
    if (params) {
      return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
        return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      }, value);
    }

    return value;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isHindi: language === 'hi',
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
