<template>
  <Teleport to="body">
    <div class="cue-picker-overlay" @click.self="onCancel">
      <div class="cue-picker" role="dialog" aria-modal="true" :aria-label="title">
        <div class="picker-header">
          <h3>{{ title }}</h3>
          <button class="icon-btn" :title="t('drawer.picker.close')" :aria-label="t('drawer.picker.close')" @click="onCancel">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div class="picker-search">
          <span class="material-symbols-rounded search-icon">search</span>
          <input
            ref="searchInput"
            v-model="search"
            class="search-input"
            :placeholder="t('drawer.picker.filter')"
            :aria-label="t('drawer.picker.filter')"
            @keydown.escape="onCancel"
          />
        </div>

        <ul v-if="filtered.length" class="picker-list">
          <li
            v-for="cue in filtered"
            :key="cue.uuid"
            class="picker-item"
            :class="{ current: cue.uuid === currentUuid, group: cue.type === 'group' }"
            @click="onSelect(cue.uuid)"
          >
            <span v-if="cue.type === 'group'" class="material-symbols-rounded group-icon">folder</span>
            <span
              v-else
              class="color-dot"
              :style="{ backgroundColor: cue.color }"
            ></span>
            <span class="cue-name">{{ cue.displayName }}</span>
            <span v-if="cue.uuid === currentUuid" class="current-tag">{{ t('drawer.picker.current') }}</span>
            <span class="cue-index">{{ indexLabel(cue) }}</span>
          </li>
        </ul>
        <div v-else class="picker-empty">{{ includeGroups ? t('drawer.picker.emptyAny') : t('drawer.picker.emptyAudio') }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AudioItem, GroupItem } from '~/types/project';

const props = withDefaults(defineProps<{
  currentUuid?: string | null;
  // List groups too (behaviour targets can be groups; linked visuals cannot)
  includeGroups?: boolean;
}>(), {
  currentUuid: null,
  includeGroups: false,
});

const emit = defineEmits<{
  select: [uuid: string];
  cancel: [];
}>();

const { currentProject } = useProject();
const { t } = useLocalization();
const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

// Playlist order, depth first; groups are listed before their children
const flatten = (items: (AudioItem | GroupItem)[] | undefined, withGroups: boolean): (AudioItem | GroupItem)[] => {
  if (!items) return [];
  const result: (AudioItem | GroupItem)[] = [];
  for (const item of items) {
    if (item.type === 'audio') result.push(item);
    else if (item.type === 'group') {
      if (withGroups) result.push(item);
      result.push(...flatten(item.children, withGroups));
    }
  }
  return result;
};

const allCues = computed<(AudioItem | GroupItem)[]>(() => {
  const project = currentProject.value;
  if (!project) return [];
  const playlist = flatten(project.items, props.includeGroups);
  const cartOnly = project.cartOnlyItems ?? [];
  return [...playlist, ...cartOnly];
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return allCues.value;
  return allCues.value.filter((c) => c.displayName.toLowerCase().includes(q));
});

const title = computed(() => (props.includeGroups ? t('drawer.picker.titleAny') : t('drawer.picker.titleAudio')));

// Cart-only cues have no playlist index ([-1, slot])
const indexLabel = (item: AudioItem | GroupItem) =>
  item.index?.[0] === -1 ? t('drawer.picker.cart') : (item.index ?? []).join(',');

const onSelect = (uuid: string) => emit('select', uuid);
const onCancel = () => emit('cancel');

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});
</script>

<style scoped lang="scss">
.cue-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: color-mix(in srgb, var(--color-background) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cue-picker {
  background: var(--color-chrome);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);
  width: 440px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-text-primary);
}

.picker-header {
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 16px;
  border-bottom: 1px solid var(--color-divider);

  h3 {
    margin: 0;
    font-size: var(--font-size-title);
    font-weight: 600;
  }
}

.icon-btn {
  width: var(--size-control);
  height: var(--size-control);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-control);
  display: flex;
  align-items: center;
  justify-content: center;

  .material-symbols-rounded { font-size: 18px; }

  &:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-hover);
  }
}

.picker-search {
  position: relative;
  flex: none;
  padding: 12px;
  border-bottom: 1px solid var(--color-divider);

  .search-icon {
    position: absolute;
    left: 22px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
    color: var(--color-text-muted);
    pointer-events: none;
  }
}

.search-input {
  width: 100%;
  height: var(--size-control);
  box-sizing: border-box;
  padding: 0 10px 0 32px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-field);
  color: var(--color-text-primary);
  font: inherit;
  outline: none;

  &:focus { border-color: var(--color-accent); }
}

.picker-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
}

.picker-item {
  height: var(--size-control-lg);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-radius: var(--radius-control);
  cursor: pointer;
  color: var(--color-text-primary);

  &:hover { background-color: var(--color-surface-hover); }

  &.group .cue-name { font-weight: 600; }

  &.current {
    background-color: var(--color-accent-tint);
    outline: 1.5px solid var(--color-accent);
    outline-offset: -1.5px;
  }
}

.color-dot {
  width: 8px;
  height: 8px;
  margin: 0 4px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-icon {
  width: 16px;
  display: flex;
  justify-content: center;
  font-size: 16px;
  color: var(--color-text-muted);
}

.cue-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-tag {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.cue-index {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

.picker-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
}
</style>
