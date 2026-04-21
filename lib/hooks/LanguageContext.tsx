"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionaries, Language } from '@/lib/dictionaries';

type LanguageContextType = {
  lang: Language;
  t: typeof dictionaries.tr;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('tr');

  useEffect(() => {
    const saved = localStorage.getItem('app_lang') as Language;
    if (saved === 'tr' || saved === 'en') setLang(saved);
  }, []);

  const toggleLanguage = () => {
    const next = lang === 'tr' ? 'en' : 'tr';
    setLang(next);
    localStorage.setItem('app_lang', next);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: dictionaries[lang], toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
