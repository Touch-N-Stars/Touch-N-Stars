import { createI18n } from 'vue-i18n';
import en from './locales/en.json';

const languageToBackendCode = {
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT',
  ja: 'ja-JP',
  cz: 'cs-CZ',
  cn: 'zh-CN',
  pt: 'pt-PT',
  es: 'es-ES',
  pl: 'pl-PL',
  nl: 'nl-NL',
  uk: 'uk-UA',
  ko: 'ko-KR',
  ca: 'ca-ES',
};

export function getBackendLanguageCode(frontendCode) {
  return languageToBackendCode[frontendCode] ?? null;
}

// Available languages with their display names
const availableLanguages = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'cz', name: 'Čeština' },
  { code: 'cn', name: '中文' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'uk', name: 'Українська' },
  { code: 'ko', name: '한국어' },
  { code: 'ca', name: 'Català' },
];

const messages = {
  en,
};

const localeLoaders = {
  en: () => Promise.resolve({ default: en }),
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  it: () => import('./locales/it.json'),
  cz: () => import('./locales/cz.json'),
  cn: () => import('./locales/cn.json'),
  pt: () => import('./locales/pt.json'),
  es: () => import('./locales/es.json'),
  pl: () => import('./locales/pl.json'),
  nl: () => import('./locales/nl.json'),
  ja: () => import('./locales/ja.json'),
  uk: () => import('./locales/uk.json'),
  ko: () => import('./locales/ko.json'),
  ca: () => import('./locales/ca.json'),
};

const loadedLocales = new Set(['en']);

// Name of the backend the app is connected to. Locale strings reference it as the
// linked message @:{'general.backendName'}, so a single runtime switch makes every
// such text read "PINS" on a PINS device and "NINA" otherwise. The JSON files carry
// "NINA" as the value until PINS has been detected.
let backendName = 'NINA';

function applyBackendName(locale) {
  i18n.global.mergeLocaleMessage(locale, { general: { backendName } });
}

export function setBackendName(name) {
  if (name === backendName) return;
  backendName = name;
  for (const locale of loadedLocales) {
    applyBackendName(locale);
  }
}

// Create i18n instance
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
});

// Export i18n instance and initialize function
export function getAvailableLanguages() {
  return availableLanguages;
}

export async function loadLocaleMessages(locale) {
  const normalizedLocale = localeLoaders[locale] ? locale : 'en';
  if (!loadedLocales.has(normalizedLocale)) {
    const module = await localeLoaders[normalizedLocale]();
    i18n.global.setLocaleMessage(normalizedLocale, module.default ?? module);
    loadedLocales.add(normalizedLocale);
    applyBackendName(normalizedLocale);
  }
  return normalizedLocale;
}

// The app's locale ids are not all BCP 47 language tags.
const HTML_LANG = { cn: 'zh', cz: 'cs' };

export async function setLocaleLanguage(locale) {
  const normalizedLocale = await loadLocaleMessages(locale);
  i18n.global.locale.value = normalizedLocale;
  // Browsers format number fields (decimal comma or point) by the document language where they
  // support it; without it an English UI showed "4,0" on a German system.
  if (typeof document !== 'undefined') {
    document.documentElement.lang = HTML_LANG[normalizedLocale] ?? normalizedLocale;
  }
  if (settingsStore) {
    settingsStore.setLanguage(normalizedLocale);
  }
  return normalizedLocale;
}

export { i18n as default, initializeI18n };

// Initialize store and set locale after app is mounted
let settingsStore;
async function initializeI18n(store) {
  settingsStore = store;

  // Initialize language from store or default to 'en'
  const storedLanguage = settingsStore.language;
  const activeLanguage = await setLocaleLanguage(storedLanguage || 'en');

  // Update store with current language
  if (!storedLanguage) {
    settingsStore.setLanguage(activeLanguage);
  }

  // Add language change handler
  i18n.global.onLanguageChanged = (locale) => {
    settingsStore.setLanguage(locale);
  };
}
