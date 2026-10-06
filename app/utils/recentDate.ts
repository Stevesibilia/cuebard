/**
 * When a recent project was last opened, as the welcome screen shows it:
 * "today", "yesterday", "3 days ago", "last week", then the month (and the
 * year when it is not the current one). Worded by Intl in the UI locale, so
 * no locale keys are needed.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const formatOpenedAt = (openedAt: string, now: Date, locale: string): string => {
  const opened = new Date(openedAt);
  if (!openedAt || Number.isNaN(opened.getTime())) return '';

  const days = Math.round((startOfDay(now) - startOfDay(opened)) / DAY_MS);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (days <= 0) return capitalize(relative.format(0, 'day'), locale);
  if (days < 7) return capitalize(relative.format(-days, 'day'), locale);
  if (days < 28) return capitalize(relative.format(-Math.floor(days / 7), 'week'), locale);

  const sameYear = opened.getFullYear() === now.getFullYear();
  const month = new Intl.DateTimeFormat(locale, sameYear ? { month: 'long' } : { month: 'short', year: 'numeric' });
  return capitalize(month.format(opened), locale);
};

const capitalize = (text: string, locale: string): string =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
