import type { Language } from '@shared/configTypes';
import { enUS } from './en-US';
import { zhCN, type TranslationDictionary } from './zh-CN';

const dictionaries: Record<Language, TranslationDictionary> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

let activeLanguage: Language = detectSystemLanguage();

export function detectSystemLanguage(): Language {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

export function getLanguage(): Language {
  return activeLanguage;
}

export function setLanguage(language: Language): void {
  activeLanguage = language;
}

export function t(key: string): string {
  return resolve(dictionaries[activeLanguage], key)
    ?? resolve(dictionaries['en-US'], key)
    ?? key;
}

function resolve(dictionary: Record<string, unknown>, key: string): string | null {
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return null;
    return (current as Record<string, unknown>)[segment];
  }, dictionary);
  return typeof value === 'string' ? value : null;
}
