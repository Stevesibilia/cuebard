export type LocaleData = Record<string, unknown>;
export type MessageParams = Record<string, string | number>;

export const FALLBACK_LOCALE = 'en';

const lookup = (data: LocaleData | undefined, key: string): string | undefined => {
  let value: unknown = data;
  for (const part of key.split('.')) {
    if (!value || typeof value !== 'object' || part === '_metadata') return undefined;
    value = (value as LocaleData)[part];
  }
  return typeof value === 'string' ? value : undefined;
};

/**
 * Resolve a dotted key in the given locale, then in English, and fill
 * `{name}` placeholders. Returns the key itself when no locale has it.
 */
export const resolveMessage = (
  locales: Record<string, LocaleData>,
  locale: string,
  key: string,
  params?: MessageParams,
): string => {
  const message = lookup(locales[locale], key) ?? lookup(locales[FALLBACK_LOCALE], key);
  if (message === undefined) return key;
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in params ? String(params[name]) : placeholder);
};
