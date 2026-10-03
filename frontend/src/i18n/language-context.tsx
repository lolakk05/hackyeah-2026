import { createContext, use, useState, type ReactNode } from 'react';

import { setApiLanguage } from '@/api/client';

import { STRINGS, fmt, type Lang, type Strings } from './strings';

interface LanguageState {
  /** null until the visitor picks a language on the first screen. */
  lang: Lang | null;
  setLang: (lang: Lang) => void;
  /** Texts in the current language (English until one is chosen). */
  s: Strings;
  fmt: typeof fmt;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  const setLang = (next: Lang) => {
    setApiLanguage(next); // API calls now ask for texts in this language
    setLangState(next);
  };

  return <LanguageContext value={{ lang, setLang, s: STRINGS[lang ?? 'en'], fmt }}>{children}</LanguageContext>;
}

/** Current language and its texts: `const { s, fmt } = useI18n();` */
export function useI18n(): LanguageState {
  const ctx = use(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
