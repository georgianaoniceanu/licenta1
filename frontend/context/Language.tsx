import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from '@/constants/translations';

interface LangCtx { lang: Lang; setLang: (l: Lang) => void }
const LangContext = createContext<LangCtx>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem('app_settings').then(raw => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.language === 'ro' || s.language === 'en') setLangState(s.language);
      } catch {}
    });
  }, []);

  const setLang = async (l: Lang) => {
    setLangState(l);
    try {
      const raw = await AsyncStorage.getItem('app_settings');
      const s = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem('app_settings', JSON.stringify({ ...s, language: l }));
    } catch {}
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLanguage() { return useContext(LangContext); }
