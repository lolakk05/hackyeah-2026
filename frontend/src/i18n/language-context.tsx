import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { setAccountLanguage } from '@/api/account';
import { setApiLanguage } from '@/api/client';
import { readJson, writeJson } from '@/storage/json-file';

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

/** The last chosen language (so a restart or a page reload keeps it). */
const LANG_FILE = 'language-v1.json';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);
  /** True once a language is set (picked or restored), so the saved one never overrides a choice. */
  const chosen = useRef(false);

  const setLang = (next: Lang) => {
    setApiLanguage(next); // API calls now ask for texts in this language
    setAccountLanguage(next);
    chosen.current = true;
    setLangState(next);
    writeJson(LANG_FILE, next);
  };

  // Restore the saved language (the first screen can still change it).
  useEffect(() => {
    readJson<Lang>(LANG_FILE).then((saved) => {
      if ((saved === 'pl' || saved === 'en') && !chosen.current) setLang(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <LanguageContext value={{ lang, setLang, s: STRINGS[lang ?? 'en'], fmt }}>{children}</LanguageContext>;
}

/** Current language and its texts: `const { s, fmt } = useI18n();` */
export function useI18n(): LanguageState {
  const ctx = use(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
