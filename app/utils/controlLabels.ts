import type { MessageParams } from '~/utils/i18n';

type Translate = (key: string, params?: MessageParams) => string;

const camel = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, next) => (next ? next.toUpperCase() : ''));

/** Translated name of a keyboard or MIDI action, from its id. */
export const controlActionLabel = (t: Translate, actionId: string): string => {
  const slot = /^trigger-slot-(\d+)$/.exec(actionId);
  if (slot) return t('controls.cartSlot', { slot: Number(slot[1]) + 1 });
  return t(`controls.actions.${camel(actionId)}`);
};

/** Translated heading of an action category ("Cart Slots", "Playback", "Volume"). */
export const controlCategoryLabel = (t: Translate, category: string): string =>
  t(`controls.categories.${camel(category)}`);
