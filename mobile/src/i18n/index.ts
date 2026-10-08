import {
  DEFAULT_LOCALE,
  LOCALES,
  catalogs,
  isRtlLocale,
  isolate,
  type Catalog,
  type Locale,
} from '@meetingpnt/shared';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import i18n from 'i18next';
import { useEffect } from 'react';
import { Alert, DevSettings, I18nManager } from 'react-native';
import { initReactI18next, useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';

// Typed keys: `t('auth.login.signIn')` is checked against the English catalog, so a typo or a
// removed key fails `tsc` instead of rendering the key name on a phone.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Catalog };
  }
}

/** Before anyone is signed in the device decides; once they are, their account does. */
function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  // Android's legacy code for Hebrew.
  const normalised = code === 'iw' ? 'he' : code;
  return LOCALES.find((l) => l === normalised) ?? DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: catalogs.en },
    he: { translation: catalogs.he },
  },
  lng: deviceLocale(),
  fallbackLng: DEFAULT_LOCALE,
  // React Native escapes nothing; the default would turn "&" in a group name into "&amp;".
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** The language the UI is in right now, for `Intl` calls that need the same answer. */
export function useLocale(): Locale {
  const { i18n: instance } = useTranslation();
  return (LOCALES.find((l) => l === instance.language) ?? DEFAULT_LOCALE) as Locale;
}

const RESTART_KEY = 'rtl-restart-for';

/** Reloads the app from inside. False when there is nothing to reload with (a plain release build
 * without updates, or a failed reload) and the person has to do it themselves. */
async function reloadApp(): Promise<boolean> {
  try {
    if (Updates.isEnabled) {
      await Updates.reloadAsync();
      return true;
    }
    if (__DEV__) {
      DevSettings.reload();
      return true;
    }
  } catch {
    // fall through to asking the person
  }
  return false;
}

/**
 * Layout direction is fixed when the app starts, so flipping it needs a restart. This does it for
 * them once; if the direction is still wrong afterwards it stops and asks, rather than reloading
 * forever — the attempt is written down *before* reloading, so the second pass can see it.
 */
async function applyDirection(rtl: boolean) {
  if (I18nManager.isRTL === rtl) {
    await SecureStore.deleteItemAsync(RESTART_KEY).catch(() => undefined);
    return;
  }
  I18nManager.forceRTL(rtl);

  const alreadyTried = (await SecureStore.getItemAsync(RESTART_KEY).catch(() => null)) === String(rtl);
  if (!alreadyTried) {
    await SecureStore.setItemAsync(RESTART_KEY, String(rtl)).catch(() => undefined);
    if (await reloadApp()) return;
  }
  Alert.alert(i18n.t('restart.title'), i18n.t('restart.body'));
}

/**
 * Keeps the UI language and layout direction in step with the signed-in person's `locale`.
 * The words change immediately; the direction restarts the app (see `applyDirection`).
 */
export function useLocaleSync() {
  const locale = useAuthStore((s) => s.user?.locale);

  useEffect(() => {
    if (!locale) return;
    void i18n.changeLanguage(locale);

    I18nManager.allowRTL(true);
    void applyDirection(isRtlLocale(locale));
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
