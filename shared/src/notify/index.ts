import { catalogs } from '../locales/index.js';
import type { Locale } from '../enums/index.js';
import { renderText } from '../locales/render.js';

type Params = Record<string, string | number>;
/** Plural variants (`seriesPublishedBody_one` …) are one key with a `count`. */
type StripPlural<K> = K extends `${infer Base}_${'one' | 'two' | 'other'}` ? Base : K;

export type PushKey = StripPlural<keyof (typeof catalogs)['en']['push']>;
export type EmailKey = StripPlural<keyof (typeof catalogs)['en']['email']>;

/** A push notification line in the language of whoever will read it. */
export function pushText(locale: Locale, key: PushKey, params?: Params): string {
  return renderText(locale, catalogs[locale].push, key, params);
}

/** A line of an email, in the language of whoever will read it. */
export function emailText(locale: Locale, key: EmailKey, params?: Params): string {
  return renderText(locale, catalogs[locale].email, key, params);
}
