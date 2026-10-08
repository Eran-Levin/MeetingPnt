/**
 * Fills in a catalog string outside i18next — the backend has no use for the whole library to
 * write one notification. Same rules the clients get from it: `{{name}}` blanks, and when `count`
 * is given the `_one` / `_two` / `_other` variant the locale's plural rules pick (Hebrew has a
 * dual, English never reaches it).
 */
export function renderText(
  locale: string,
  section: Record<string, string>,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const category =
    typeof params.count === 'number' ? new Intl.PluralRules(locale).select(params.count) : null;
  const template =
    (category && section[`${key}_${category}`]) ||
    section[key] ||
    section[`${key}_other`] ||
    key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}
