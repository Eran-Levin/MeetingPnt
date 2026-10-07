import { en } from '../locales/en.js';
import { renderText } from '../locales/render.js';

type Catalog = typeof en;
/** Plural variants (`party_needs_members_one` …) are one code with a `count`. */
type StripPlural<K> = K extends `${infer Base}_${'one' | 'two' | 'other'}` ? Base : K;

/** Every reason the server can refuse a request. The catalog's `errors` section is the source. */
export type ErrorCode = StripPlural<keyof Catalog['errors']>;
export type ErrorParams = Record<string, string | number>;

/** The body of every error response. `error` stays English for clients that don't translate. */
export interface ApiErrorBody {
  error: string;
  code?: ErrorCode;
  params?: ErrorParams;
  issues?: unknown[];
}

const errorCatalog = en.errors as Record<string, string>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' &&
    (value in errorCatalog || `${value}_other` in errorCatalog)
  );
}

/** The English sentence for a code — what the server sends as `error`. */
export function englishErrorMessage(code: ErrorCode, params: ErrorParams = {}): string {
  return renderText('en', errorCatalog, code, params);
}
