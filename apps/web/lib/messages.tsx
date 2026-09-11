'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@guide/contracts';
import { translations } from './translations';
const Interface = createContext<Locale>('en-IN');
export function WordsProvider({ locale, children }: { locale: Locale; children: ReactNode }) { return <Interface.Provider value={locale}>{children}</Interface.Provider>; }
const indexes: Record<Locale, number> = { 'en-IN': -1, 'hi-IN': 0, 'bn-IN': 1, 'mr-IN': 2, 'te-IN': 3, 'ta-IN': 4, 'ur-IN': 5 };
export function words(locale: Locale) { return (text: string) => indexes[locale] < 0 ? text : translations[text]?.[indexes[locale]] || text; }
export function useWords() { const uiLocale = useContext(Interface); return { uiLocale, m: words(uiLocale) }; }
