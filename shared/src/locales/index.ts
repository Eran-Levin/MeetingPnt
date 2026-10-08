import type { Locale } from '../enums/index.js';
import { en, type Catalog } from './en.js';
import { he } from './he.js';

export type { Catalog };

/** Every language's words, keyed by locale — the clients hand this straight to i18next. */
export const catalogs: Record<Locale, Catalog> = { en, he };
