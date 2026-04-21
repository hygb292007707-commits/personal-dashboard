// components/LanguageToggle.tsx
"use client";

import { useLanguage } from '@/lib/hooks/LanguageContext';
export default function LanguageToggle() {
    const { lang, toggleLanguage } = useLanguage();

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1 text-sm font-medium border rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
            <span className={lang === 'tr' ? 'text-blue-500 font-bold' : 'text-gray-400'}>TR</span>
            <span className="text-gray-300">|</span>
            <span className={lang === 'en' ? 'text-blue-500 font-bold' : 'text-gray-400'}>EN</span>
        </button>
    );
}