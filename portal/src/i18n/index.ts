import {
  DEFAULT_LOCALE,
  LOCALES,
  catalogs,
  isRtlLocale,
  isolate,
  type Catalog,
  type Locale,
} from '@meetingpnt/shared';
import i18n from 'i18next';
import { useEffect } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

// Typed keys: `t('nav.users')` is checked against the English catalog, so a typo or a removed key
// fails `tsc` instead of rendering the key name in a browser.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Catalog };
  }
}

/** Signed out — the login page, an invitation link — the browser decides. */
function browserLocale(): Locale {
  const code = navigator.language?.split('-')[0];
  // The legacy code for Hebrew.
  const normalised = code === 'iw' ? 'he' : code;
  return LOCALES.find((l) => l === normalised) ?? DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: catalogs.en },
    he: { translation: catalogs.he },
  },
  lng: browserLocale(),
  fallbackLng: DEFAULT_LOCALE,
  // React escapes what it renders; the default would turn "&" in a group name into "&amp;".
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** The language the UI is in right now, for `Intl` calls that need the same answer. */
export function useLocale(): Locale {
  const { i18n: instance } = useTranslation();
  return (LOCALES.find((l) => l === instance.language) ?? DEFAULT_LOCALE) as Locale;
}

/**
 * Keeps the UI language, and the page's `lang` and `dir`, in step with the signed-in person's
 * `locale`. Unlike the phone, a browser can flip direction on the fly, so there is no restart.
 */
export function useLocaleSync() {
  const locale = useAuthStore((s) => s.user?.locale);

  useEffect(() => {
    const active = locale ?? browserLocale();
    void i18n.changeLanguage(active);
    document.documentElement.lang = active;
    document.documentElement.dir = isRtlLocale(active) ? 'rtl' : 'ltr';
  }, [locale]);
}

/**
 * What to show for a failed request. The server sends a `code` (and any blanks to fill, like a
 * group name) rather than a sentence, so the words come from our own catalog in the reader's
 * language. A code this build doesn't have yet falls back to the server's English, and anything
 * that isn't an API refusal at all (no network, say) uses the caller's own wording.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (!err.code) return err.message;
  // Names and titles come from people; fence them off so they can't reorder the sentence.
  const params = Object.fromEntries(
    Object.entries(err.params ?? {}).map(([key, value]) => [
      key,
      typeof value === 'string' ? isolate(value) : value,
    ]),
  );
  return i18n.t(`errors.${err.code}` as 'errors.internal', { ...params, defaultValue: err.message });
}

export { i18n, useTranslation };
