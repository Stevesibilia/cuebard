/**
 * Playlist search: filters what the playlist shows by cue name. Display only;
 * indices, selection, drag and drop and playback never see the filter.
 *
 * A group is shown when its own name matches (then all its children show) or
 * when a descendant matches (then only the matching descendants show).
 */
import type { AudioItem, GroupItem } from '~/types/project';

type PlaylistEntry = AudioItem | GroupItem;

/** Lower-cased, trimmed search text; empty means no filter. */
export const normalizeQuery = (text: string): string => text.trim().toLowerCase();

export const nameMatches = (item: PlaylistEntry, query: string): boolean =>
  (item.displayName || '').toLowerCase().includes(query);

export const hasMatchingDescendant = (item: PlaylistEntry, query: string): boolean =>
  item.type === 'group' &&
  item.children.some(child => nameMatches(child, query) || hasMatchingDescendant(child, query));

/** True when the item is shown, given that no ancestor matched by name. */
export const itemMatches = (item: PlaylistEntry, query: string): boolean =>
  !query || nameMatches(item, query) || hasMatchingDescendant(item, query);

/**
 * Items to render at one level. `showAll` is true below a group whose name
 * (or an ancestor's name) matched: then every child shows.
 */
export const visibleItems = (items: PlaylistEntry[], query: string, showAll = false): PlaylistEntry[] =>
  !query || showAll ? items : items.filter(item => itemMatches(item, query));

/** Audio cues in the playlist tree: all of them, and those the filter shows. */
export const countCues = (items: PlaylistEntry[], query: string): { shown: number; total: number } => {
  let shown = 0;
  let total = 0;
  const walk = (list: PlaylistEntry[], showAll: boolean) => {
    for (const item of list) {
      const passes = showAll || !query || nameMatches(item, query);
      if (item.type === 'group') {
        walk(item.children, passes);
      } else {
        total++;
        if (passes) shown++;
      }
    }
  };
  walk(items, false);
  return { shown, total };
};

export const usePlaylistFilter = () => {
  const { currentProject } = useProject();
  const filterText = useState<string>('playlistFilter', () => '');

  const query = computed(() => normalizeQuery(filterText.value));
  const isFiltering = computed(() => query.value.length > 0);

  const matches = (item: PlaylistEntry): boolean => itemMatches(item, query.value);
  const matchesByName = (item: PlaylistEntry): boolean =>
    isFiltering.value && nameMatches(item, query.value);
  const visible = (items: PlaylistEntry[], showAll = false): PlaylistEntry[] =>
    visibleItems(items, query.value, showAll);

  const counts = computed(() => countCues(currentProject.value?.items ?? [], query.value));

  const clearFilter = () => {
    filterText.value = '';
  };

  return {
    filterText,
    isFiltering,
    matches,
    matchesByName,
    visible,
    counts,
    clearFilter,
  };
};
