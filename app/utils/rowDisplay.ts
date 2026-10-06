import type { AudioItem, GroupItem } from '~/types/project';
import type { MessageParams } from '~/utils/i18n';

type Translate = (key: string, params?: MessageParams) => string;

export interface BehaviourChip {
  id: string;
  label: string;
  title: string;
}

// Playable length of a cue: Out minus In, the whole file when untrimmed
export const trimmedLength = (item: AudioItem): number => {
  const inPoint = item.inPoint || 0;
  const outPoint = item.outPoint || item.duration;
  return Math.max(0, outPoint - inPoint);
};

// m:ss, or h:mm:ss from an hour up (the row duration format)
export const formatLength = (seconds: number): string => {
  const total = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = (total % 60).toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
};

// Audio cues anywhere under a group, and their summed playable length
export const groupSummary = (group: GroupItem): { count: number; length: number } => {
  let count = 0;
  let length = 0;
  const walk = (items: (AudioItem | GroupItem)[]) => {
    for (const child of items) {
      if (child.type === 'audio') {
        count++;
        length += trimmedLength(child);
      } else if (child.type === 'group') {
        walk(child.children);
      }
    }
  };
  walk(group.children);
  return { count, length };
};

/**
 * Readable chips for a cue's behaviour, in the order the row shows them:
 * what happens at the end, ducking, crossfade, what happens at the start.
 * `resolveName` returns a target cue's name, or null when it was deleted.
 */
export const behaviourChips = (
  item: AudioItem,
  t: Translate,
  resolveName: (uuid: string) => string | null,
  locale = 'en',
): BehaviourChip[] => {
  const chips: BehaviourChip[] = [];
  const target = (uuid?: string) => (uuid ? resolveName(uuid) : null);
  const index = (value?: number[]) => (value && value.length ? value.join(',') : '?');

  const end = item.endBehavior;
  if (end?.action === 'loop') {
    chips.push({ id: 'loop', label: t('rows.chipLoop'), title: t('rows.chipLoopTitle') });
  } else if (end?.action === 'next') {
    chips.push({ id: 'next', label: t('rows.chipThenNext'), title: t('rows.chipThenNextTitle') });
  } else if (end?.action === 'goto-item') {
    const name = target(end.targetUuid);
    chips.push(name === null
      ? { id: 'goto', label: t('rows.chipGotoMissing'), title: t('rows.chipGotoMissingTitle') }
      : { id: 'goto', label: t('rows.chipGoto', { name }), title: t('rows.chipGotoTitle', { name }) });
  } else if (end?.action === 'goto-index') {
    const at = index(end.targetIndex);
    chips.push({ id: 'goto', label: t('rows.chipGoto', { name: at }), title: t('rows.chipGotoIndexTitle', { index: at }) });
  }

  if (item.duckingBehavior?.mode === 'duck-others') {
    chips.push({ id: 'duck', label: t('rows.chipDuck'), title: t('rows.chipDuckTitle') });
  }

  if (item.crossFade > 0) {
    const seconds = item.crossFade.toLocaleString(locale, { maximumFractionDigits: 1 });
    chips.push({ id: 'crossfade', label: t('rows.chipCrossfade', { seconds }), title: t('rows.chipCrossfadeTitle', { seconds }) });
  }

  const start = item.startBehavior;
  if (start?.action === 'play-next') {
    chips.push({ id: 'start', label: t('rows.chipPlaysNext'), title: t('rows.chipPlaysNextTitle') });
  } else if (start?.action === 'play-item') {
    const name = target(start.targetUuid);
    chips.push(name === null
      ? { id: 'start', label: t('rows.chipPlaysMissing'), title: t('rows.chipPlaysMissingTitle') }
      : { id: 'start', label: t('rows.chipPlays', { name }), title: t('rows.chipPlaysTitle', { name }) });
  } else if (start?.action === 'play-index') {
    const at = index(start.targetIndex);
    chips.push({ id: 'start', label: t('rows.chipPlays', { name: at }), title: t('rows.chipPlaysIndexTitle', { index: at }) });
  }

  return chips;
};
