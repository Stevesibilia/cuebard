<template>
  <div 
    class="playlist-item"
    :class="{ 
      'is-selected': isSelected, 
      'is-group': item.type === 'group',
      'is-audio': item.type === 'audio',
      'is-playing': isPlaying,
      'is-paused': isPlaying && isPaused,
      'drag-over-top': dragPosition === 'top',
      'drag-over-bottom': dragPosition === 'bottom',
      'drag-over-group': dragPosition === 'group',
      'warning-yellow': warningState === 'yellow',
      'warning-orange': warningState === 'orange',
      'warning-red': warningState === 'red'
    }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div 
      class="item-content"
      @click="handleSelect"
      :draggable="true"
      @dragstart="handleDragStart"
    >
      <!-- Waveform background for audio items, shown on hover -->
      <canvas 
        v-if="item.type === 'audio' && item.waveform"
        ref="waveformCanvas"
        class="waveform-canvas"
      ></canvas>

      <!-- Progress line for playing items (audio and groups) -->
      <div v-if="(isPlaying && item.type === 'audio') || (isGroupPlaying && item.type === 'group')" class="item-progress" :style="progressStyle"></div>

      <span class="chevron-slot">
        <button 
          v-if="item.type === 'group'" 
          class="expand-btn"
          :title="isOpen ? t('rows.collapse') : t('rows.expand')"
          @click.stop="toggleExpand"
        >
          <span class="material-symbols-rounded">{{ isOpen ? 'expand_more' : 'chevron_right' }}</span>
        </button>
      </span>

      <span class="item-index">{{ indexDisplay }}</span>

      <span v-if="item.type === 'group'" class="group-icon material-symbols-rounded" :title="t('rows.group')">folder</span>

      <span
        v-if="item.type === 'audio' || hasCustomColor"
        class="color-dot"
        :class="{ 'is-neutral': !hasCustomColor }"
        :style="hasCustomColor ? { backgroundColor: item.color } : undefined"
      ></span>

      <span class="item-name">{{ item.displayName }}</span>

      <span v-if="showSpaceChip" class="space-chip" :title="t('rows.spaceHint')">{{ t('rows.spaceKey') }}</span>

      <span v-if="chips.length" class="behavior-chips">
        <span
          v-for="chip in chips"
          :key="chip.id"
          class="behavior-chip"
          :title="chip.title"
        >{{ chip.label }}</span>
      </span>

      <span v-if="item.type === 'group'" class="group-meta">{{ groupMeta }}</span>

      <span class="item-actions">
        <button 
          v-if="!isPlaying"
          class="item-btn play" 
          @click.stop="handlePlay" 
          :title="t('actions.play')"
        >
          <span class="material-symbols-rounded">play_arrow</span>
        </button>
        <button 
          v-if="isPlaying && !isPaused" 
          class="item-btn pause" 
          @click.stop="handlePause" 
          :title="t('actions.pause')"
        >
          <span class="material-symbols-rounded">pause</span>
        </button>
        <button 
          v-if="isPlaying && isPaused" 
          class="item-btn resume" 
          @click.stop="handleResume" 
          :title="t('actions.resume')"
        >
          <span class="material-symbols-rounded">play_arrow</span>
        </button>
        <button class="item-btn stop" @click.stop="handleStop" :title="t('actions.stop')" v-if="isPlaying">
          <span class="material-symbols-rounded">stop</span>
        </button>
        <button class="item-btn delete" @click.stop="handleDelete" :title="t('actions.delete')">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </span>

      <span v-if="item.type === 'audio'" class="item-duration">{{ durationDisplay }}</span>
    </div>
    
    <div v-if="item.type === 'group' && childrenShown" class="group-children">
      <PlaylistItem
        v-for="child in visibleChildren"
        :key="child.uuid"
        :item="child"
        :depth="depth + 1"
        :filter-show-all="childrenShowAll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AudioItem, GroupItem, BaseItem } from '~/types/project';
import { NEUTRAL_CUE_COLOR } from '~/types/project';
import { resolveWaveformPath } from '~/utils/paths';
import { outPointAfterDuration } from '~/utils/trim';
import { waveformDisplayScale } from '~/utils/audio';
import { normalizeMoveSet, canDropOnto } from '~/utils/tree';
import { behaviourChips, groupSummary, formatLength } from '~/utils/rowDisplay';

const props = defineProps<{
  item: AudioItem | GroupItem;
  depth: number;
  // An ancestor group matched the playlist search by name: show every child
  filterShowAll?: boolean;
}>();

const { selectedItem, selectedItems, toggleItemSelection, removeItem, findItemByUuid, currentProject, waveformUpdateKey, triggerWaveformUpdate, saveProject } = useProject();
const { playCue, stopCue, pauseCue, resumeCue, activeCues, activeGroups, triggerGroup } = useAudioEngine();
const { getCartOnlyItem } = useCartItems();
const { t, currentLocale } = useLocalization();

const isExpanded = ref(props.item.type === 'group' ? props.item.isExpanded : false);

// Playlist search (display only): a group shown for a matching descendant
// opens without changing its saved expanded state
const { isFiltering, matchesByName, visible: visibleForFilter } = usePlaylistFilter();
const childrenShowAll = computed(() => !!props.filterShowAll || matchesByName(props.item));
const visibleChildren = computed(() =>
  props.item.type === 'group' ? visibleForFilter(props.item.children, childrenShowAll.value) : []
);
const isOpen = computed(() =>
  isExpanded.value ||
  (isFiltering.value && !childrenShowAll.value && visibleChildren.value.length > 0)
);
const childrenShown = computed(() => isOpen.value && visibleChildren.value.length > 0);
const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const dragPosition = ref<'top' | 'bottom' | 'group' | null>(null);

const isSelected = computed(() => selectedItems.value.has(props.item.uuid));
const isPlaying = computed(() => activeCues.value.has(props.item.uuid));
const isPaused = computed(() => {
  const cue = activeCues.value.get(props.item.uuid);
  return cue?.isPaused || false;
});
const isGroupPlaying = computed(() => props.item.type === 'group' && activeGroups.value.has(props.item.uuid));

const indexDisplay = computed(() => {
  return props.item.index.join(',');
});

const durationDisplay = computed(() => {
  if (props.item.type !== 'audio') return '';
  
  const audioItem = props.item as AudioItem;
  
  // If playing, show countdown
  if (isPlaying.value) {
    const timeRemaining = playbackDuration.value - currentPlaybackTime.value;
    const totalSeconds = Math.floor(timeRemaining);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `-${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `-${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  // Otherwise show trimmed duration
  const totalDuration = audioItem.duration;
  const inPoint = audioItem.inPoint || 0;
  const outPoint = audioItem.outPoint || totalDuration;
  const trimmedDuration = outPoint - inPoint;
  
  const totalSeconds = Math.floor(trimmedDuration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
});

// Draw waveform
const drawWaveform = () => {
  if (!waveformCanvas.value || props.item.type !== 'audio') return;
  
  const audioItem = props.item as AudioItem;
  if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) return;
  
  const canvas = waveformCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Set canvas size to match element size (use actual pixels for clarity)
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  // Get computed text color for waveform
  const computedStyle = getComputedStyle(canvas);
  const textColor = computedStyle.getPropertyValue('color');
  
  // Parse RGB values - use full opacity, canvas element itself has opacity set via CSS
  const rgb = textColor.match(/\d+/g);
  if (!rgb) return;
  
  ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  
  const peaks = audioItem.waveform.peaks;
  
  // Calculate trimmed region if in/out points are set
  const totalDuration = audioItem.duration;
  const inPoint = audioItem.inPoint || 0;
  const outPoint = audioItem.outPoint || totalDuration;
  const trimmedDuration = outPoint - inPoint;
  
  // Calculate which peaks to show (slice based on in/out ratios)
  const startIndex = Math.floor((inPoint / totalDuration) * peaks.length);
  const endIndex = Math.ceil((outPoint / totalDuration) * peaks.length);
  const trimmedPeaks = peaks.slice(startIndex, endIndex);
  
  const barWidth = rect.width / trimmedPeaks.length;
  const centerY = rect.height / 2;

  // Apply volume scaling to waveform display
  const volumeMultiplier = audioItem.volume || 1.0;
  // Peak-normalize display so quiet cues stay visible. Scale is computed over
  // the whole track so trimming doesn't rescale the surviving region.
  const displayScale = waveformDisplayScale(peaks);

  trimmedPeaks.forEach((value, i) => {
    // Values are already normalized 0-1, scale by volume and display scale
    const barHeight = Math.min(value * volumeMultiplier * displayScale, 1) * rect.height * 0.8; // Use 80% of height
    const x = i * barWidth;
    const y = centerY - barHeight / 2;

    ctx.fillRect(x, y, Math.max(barWidth, 1), barHeight);
  });
};

// Redraw waveform when component mounts or updates
let resizeObserver: ResizeObserver | null = null;
let waveformPollInterval: NodeJS.Timeout | null = null;

// Watch for canvas availability and set up observer
watch(waveformCanvas, (canvas) => {
  if (canvas && props.item.type === 'audio') {
    // Canvas is now available, draw waveform
    nextTick(drawWaveform);
    
    // Set up resize observer if not already set up
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        drawWaveform();
      });
      resizeObserver.observe(canvas);
    }
  }
});

onMounted(() => {
  if (props.item.type === 'audio' && waveformCanvas.value) {
    nextTick(drawWaveform);
    
    // Redraw on resize
    resizeObserver = new ResizeObserver(() => {
      drawWaveform();
    });
    resizeObserver.observe(waveformCanvas.value);
  }
  
  // Start polling for waveform if not available yet
  if (props.item.type === 'audio') {
    const audioItem = props.item as AudioItem;
    if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) {
      startWaveformPolling();
    }
  }
});

onUnmounted(() => {
  if (resizeObserver && waveformCanvas.value) {
    resizeObserver.unobserve(waveformCanvas.value);
    resizeObserver.disconnect();
  }
  
  if (waveformPollInterval) {
    clearInterval(waveformPollInterval);
  }
});

// Poll for waveform data if not yet available
const startWaveformPolling = () => {
  if (waveformPollInterval) return; // Already polling
  
  waveformPollInterval = setInterval(async () => {
    if (props.item.type !== 'audio') {
      clearInterval(waveformPollInterval!);
      waveformPollInterval = null;
      return;
    }
    
    const audioItem = props.item as AudioItem;
    
    // Check if waveform is now available
    if (audioItem.waveform && audioItem.waveform.peaks && audioItem.waveform.peaks.length > 0) {
      // Waveform loaded, stop polling and redraw
      clearInterval(waveformPollInterval!);
      waveformPollInterval = null;
      nextTick(drawWaveform);
      return;
    }
    
    // Try to load waveform from file
    if (window.electronAPI && audioItem.waveformPath && currentProject.value) {
      try {
        const result = await window.electronAPI.readFile(resolveWaveformPath(currentProject.value.folderPath, audioItem.waveformPath));
        if (result.success && result.data) {
          const waveformData = JSON.parse(result.data);
          if (waveformData.peaks && waveformData.peaks.length > 0) {
            // Find the actual item in the project to ensure reactivity
            const projectItem = findItemByUuid(audioItem.uuid);
            if (projectItem && projectItem.type === 'audio') {
              projectItem.waveform = waveformData;
              
              // Update duration from waveform data if available (more accurate than Audio API)
              if (waveformData.duration && waveformData.duration > 0) {
                projectItem.outPoint = outPointAfterDuration(projectItem.outPoint, projectItem.duration, waveformData.duration);
                projectItem.duration = waveformData.duration;
              }
              
              // Save the project to persist changes
              const { saveProject } = useProject();
              await saveProject();
            }
            
            clearInterval(waveformPollInterval!);
            waveformPollInterval = null;
            
            // Force reactivity update
            triggerWaveformUpdate();
            nextTick(drawWaveform);
            console.log(`Waveform polling found data for ${audioItem.displayName}`);
          }
        }
      } catch (error) {
        // Silently ignore, will retry on next poll
      }
    }
  }, 2000); // Poll every 2 seconds
  
  // Stop polling after 30 seconds
  setTimeout(() => {
    if (waveformPollInterval) {
      clearInterval(waveformPollInterval);
      waveformPollInterval = null;
    }
  }, 30000);
};

watch(() => props.item, () => {
  if (props.item.type === 'audio') {
    nextTick(drawWaveform);
  }
}, { deep: true });

// Watch for waveform updates
watch(() => waveformUpdateKey.value, () => {
  if (props.item.type === 'audio') {
    nextTick(drawWaveform);
  }
});

// Calculate playback progress
const playbackProgress = ref(0);
const currentPlaybackTime = ref(0);
const playbackDuration = ref(0);
let progressInterval: any = null;

// Warning state based on time remaining
const warningState = computed(() => {
  if (!isPlaying.value || props.item.type !== 'audio') return null;
  
  const cue = activeCues.value.get(props.item.uuid);
  if (!cue) return null;
  
  const timeRemaining = cue.duration - cue.currentTime;
  if (timeRemaining <= 5) return 'red';
  if (timeRemaining <= 10) return 'orange';
  if (timeRemaining <= 30) return 'yellow';
  return null;
});

watch(isPlaying, (playing) => {
  if (playing && props.item.type === 'audio') {
    const cue = activeCues.value.get(props.item.uuid);
    if (cue) {
      progressInterval = setInterval(() => {
        // Now we get currentTime directly from the cue state updated by IPC events
        const current = cue.currentTime;
        const duration = cue.duration;
        currentPlaybackTime.value = current;
        playbackDuration.value = duration;
        playbackProgress.value = duration > 0 ? Math.min((current / duration) * 100, 100) : 0;
      }, 100);
    }
  } else {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    playbackProgress.value = 0;
    currentPlaybackTime.value = 0;
    playbackDuration.value = 0;
  }
}, { immediate: true }); // a row mounted mid-cue shows its countdown

// Watch for group playing state
watch(isGroupPlaying, (playing) => {
  if (playing && props.item.type === 'group') {
    const groupState = activeGroups.value.get(props.item.uuid);
    if (groupState) {
      progressInterval = setInterval(() => {
        const state = activeGroups.value.get(props.item.uuid);
        if (state) {
          const current = state.currentTime;
          const duration = state.totalDuration;
          playbackProgress.value = duration > 0 ? Math.min((current / duration) * 100, 100) : 0;
        }
      }, 100);
    }
  } else if (!playing && props.item.type === 'group') {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    playbackProgress.value = 0;
  }
}, { immediate: true });

onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval);
  }
});

// Deliberately coloured cues show their colour in the dot; neutral-default
// cues get a muted dot (audio) or none (groups)
const hasCustomColor = computed(() =>
  !!props.item.color && props.item.color.toLowerCase() !== NEUTRAL_CUE_COLOR
);

const progressStyle = computed(() => ({ width: `${playbackProgress.value}%` }));

// Readable behaviour chips; targets resolve by name in the playlist or cart
const chips = computed(() => {
  if (props.item.type !== 'audio') return [];
  const resolveName = (uuid: string) =>
    (findItemByUuid(uuid) ?? getCartOnlyItem(uuid))?.displayName ?? null;
  return behaviourChips(props.item as AudioItem, t, resolveName, currentLocale.value);
});

// Space plays the selected audio cue when nothing plays
const showSpaceChip = computed(() =>
  props.item.type === 'audio' &&
  selectedItem.value?.uuid === props.item.uuid &&
  activeCues.value.size === 0
);

const groupMeta = computed(() => {
  if (props.item.type !== 'group') return '';
  const { count, length } = groupSummary(props.item as GroupItem);
  return count === 1
    ? t('rows.groupMetaOne', { length: formatLength(length) })
    : t('rows.groupMetaMany', { count, length: formatLength(length) });
});

const handleSelect = (event: MouseEvent) => {
  toggleItemSelection(props.item.uuid, event.ctrlKey || event.metaKey, event.shiftKey);
};

const handlePlay = () => {
  if (props.item.type === 'audio') {
    playCue(props.item as AudioItem);
  } else if (props.item.type === 'group') {
    triggerGroup(props.item);
  }
};

const handleStop = () => {
  stopCue(props.item.uuid);
};

const handlePause = () => {
  pauseCue(props.item.uuid);
};

const handleResume = () => {
  resumeCue(props.item.uuid);
};

const handleDelete = () => {
  if (confirm(t('playlist.confirmDelete', { name: props.item.displayName }))) {
    removeItem(props.item.uuid);
  }
};

const toggleExpand = () => {
  if (props.item.type === 'group') {
    isExpanded.value = !isExpanded.value;
    props.item.isExpanded = isExpanded.value;
    saveProject(); // isExpanded is persisted
  }
};

const handleDragStart = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('item-uuid', props.item.uuid);
    e.dataTransfer.setData('item-depth', props.depth.toString());
    
    // If this item is part of a multi-selection, store all selected UUIDs
    if (selectedItems.value.has(props.item.uuid) && selectedItems.value.size > 1) {
      const selectedUuids = Array.from(selectedItems.value);
      e.dataTransfer.setData('selected-items', JSON.stringify(selectedUuids));
    }
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!e.dataTransfer) return;
  
  e.dataTransfer.dropEffect = 'move';
  
  // Determine drop position based on mouse position
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  
  if (props.item.type === 'group' && y > height * 0.3 && y < height * 0.7) {
    // Middle third of group = drop inside
    dragPosition.value = 'group';
  } else if (y < height / 2) {
    // Top half = insert before
    dragPosition.value = 'top';
  } else {
    // Bottom half = insert after
    dragPosition.value = 'bottom';
  }
};

const handleDragLeave = () => {
  dragPosition.value = null;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  dragPosition.value = null;
  
  if (!e.dataTransfer || !currentProject.value) return;
  
  const draggedUuid = e.dataTransfer.getData('item-uuid');
  if (!draggedUuid || draggedUuid === props.item.uuid) return;
  
  // Check if we're dragging multiple items
  const selectedItemsData = e.dataTransfer.getData('selected-items');
  // A child selected together with its group moves inside the group, once
  const itemsToMove = normalizeMoveSet(
    currentProject.value.items,
    selectedItemsData ? JSON.parse(selectedItemsData) : [draggedUuid]
  );

  // Don't drop onto one of the items being moved, or anywhere inside one
  if (!canDropOnto(currentProject.value.items, itemsToMove, props.item.uuid)) return;
  
  // Collect all items to move (in their current order)
  const allProjectItems = getAllItemsFlattened(currentProject.value.items);
  const itemObjects = itemsToMove
    .map(uuid => findItemByUuid(uuid))
    .filter(item => item !== null);
  
  if (itemObjects.length === 0) return;
  
  // Remove all items from their current locations (in reverse order to maintain indices)
  for (let i = itemObjects.length - 1; i >= 0; i--) {
    const item = itemObjects[i];
    if (item) {
      removeItem(item.uuid);
    }
  }
  
  // Determine insertion point
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  
  if (props.item.type === 'group' && y > height * 0.3 && y < height * 0.7) {
    // Drop inside group
    const groupItem = props.item as GroupItem;
    itemObjects.forEach(item => {
      if (item) {
        groupItem.children.push(item);
      }
    });
    const { updateIndices } = useProject();
    updateIndices(groupItem.children, groupItem.index);
  } else {
    // Find parent array and insert before/after
    const insertAfter = y >= height / 2;
    const targetIndex = props.item.index;
    
    // Find parent array (either root items or group children)
    let parentArray = currentProject.value.items;
    let parentIndex: number[] = [];
    
    if (targetIndex.length > 1) {
      // Item is in a group, find the parent group
      const parentGroupIndex = targetIndex.slice(0, -1);
      const parentGroup = findItemByIndex(parentGroupIndex);
      if (parentGroup && parentGroup.type === 'group') {
        const groupParent = parentGroup as GroupItem;
        parentArray = groupParent.children;
        parentIndex = groupParent.index;
      }
    }
    
    // Find position in parent array
    const itemPosInArray = parentArray.findIndex(i => i.uuid === props.item.uuid);
    let insertPos = insertAfter ? itemPosInArray + 1 : itemPosInArray;
    
    // Insert all items at the position
    itemObjects.forEach((item, idx) => {
      if (item) {
        parentArray.splice(insertPos + idx, 0, item);
      }
    });
    
    // Update all indices
    const { updateIndices } = useProject();
    updateIndices(parentArray, parentIndex);
  }
  
  // Save project
  const { saveProject } = useProject();
  saveProject();
};

// Helper to get all items flattened
const getAllItemsFlattened = (items: (AudioItem | GroupItem)[]): (AudioItem | GroupItem)[] => {
  const result: (AudioItem | GroupItem)[] = [];
  for (const item of items) {
    result.push(item);
    if (item.type === 'group') {
      const groupItem = item as GroupItem;
      result.push(...getAllItemsFlattened(groupItem.children));
    }
  }
  return result;
};

// Helper to find item by index
const findItemByIndex = (index: number[]): AudioItem | GroupItem | null => {
  if (!currentProject.value) return null;
  
  let current: any = { children: currentProject.value.items };
  for (const i of index) {
    if (!current.children || !current.children[i]) return null;
    current = current.children[i];
  }
  return current;
};
</script>

<style scoped>
.playlist-item {
  position: relative;
  border-radius: var(--radius-control);

  /* Drop zones: a line before or after the item, or the whole group */
  &.drag-over-top::before,
  &.drag-over-bottom::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 1px;
    background-color: var(--color-accent);
    z-index: 10;
    pointer-events: none;
  }

  &.drag-over-top::before {
    top: -1px;
  }

  &.drag-over-bottom::after {
    bottom: -1px;
  }

  &.drag-over-group {
    background-color: var(--color-accent-tint);
    box-shadow: inset 0 0 0 1.5px var(--color-accent);
  }
}

.item-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--size-row);
  padding: 0 10px 0 4px;
  border-radius: var(--radius-control);
  overflow: hidden;
  cursor: pointer;
  container: row / inline-size;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--color-field);
  }
}

/* Playing row: accent tint, bold name, progress line at the bottom */
.playlist-item.is-playing > .item-content {
  background-color: var(--color-accent-tint);

  .item-name {
    font-weight: var(--font-weight-emphasis);
  }
}

.playlist-item.is-paused > .item-content {
  background-color: var(--color-warning-tint);

  .item-duration {
    color: var(--color-warning-text);
  }
}

.playlist-item.is-selected > .item-content {
  outline: 1.5px solid var(--color-accent);
  outline-offset: -1.5px;
}

.playlist-item.is-selected:not(.is-playing) > .item-content {
  background-color: var(--color-surface);
}

.playlist-item.warning-yellow > .item-content {
  animation: flash-yellow 2s ease-in-out infinite;
}

.playlist-item.warning-orange > .item-content {
  animation: flash-orange 1s ease-in-out infinite;
}

.playlist-item.warning-red > .item-content {
  animation: flash-red 0.5s ease-in-out infinite;
}

@keyframes flash-yellow {
  0%, 100% { 
    box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--color-state-armed) 40%, transparent);
  }
  50% { 
    box-shadow: inset 0 0 12px 2px color-mix(in srgb, var(--color-state-armed) 60%, transparent);
  }
}

@keyframes flash-orange {
  0%, 100% { 
    box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--color-state-paused) 40%, transparent);
  }
  50% { 
    box-shadow: inset 0 0 14px 3px color-mix(in srgb, var(--color-state-paused) 70%, transparent);
  }
}

@keyframes flash-red {
  0%, 100% { 
    box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--color-danger) 50%, transparent);
  }
  50% { 
    box-shadow: inset 0 0 16px 4px color-mix(in srgb, var(--color-danger) 80%, transparent);
  }
}

.waveform-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  color: var(--color-text-primary);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.item-content:hover > .waveform-canvas {
  opacity: 0.12;
}

.item-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background-color: var(--color-accent);
  transition: width 100ms linear;
  pointer-events: none;
}

.playlist-item.is-paused > .item-content > .item-progress {
  background-color: var(--color-warning);
}

/* Everything except the canvas and progress line sits above them */
.item-content > :not(.waveform-canvas):not(.item-progress) {
  position: relative;
}

.chevron-slot {
  width: 20px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-key);
  color: var(--color-text-secondary);

  .material-symbols-rounded {
    font-size: 18px;
  }

  &:hover {
    color: var(--color-text-primary);
    background-color: var(--color-control-border);
  }
}

.item-index {
  min-width: 28px;
  flex: none;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: right;
  white-space: nowrap;
}

.color-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;

  &.is-neutral {
    background-color: var(--color-control-border);
  }
}

.item-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-primary);
}

.space-chip {
  flex: none;
  height: 20px;
  display: flex;
  align-items: center;
  padding: 0 7px;
  border-radius: var(--radius-key);
  background-color: var(--color-accent);
  color: var(--color-on-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 color-mix(in srgb, black 25%, transparent);
}

/* Chips give way before the name: those that do not fit wrap onto a hidden
   second line, and on narrow rows they hide altogether */
.behavior-chips {
  flex: 0 100 auto;
  min-width: 0;
  height: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  overflow: hidden;
}

@container row (max-width: 440px) {
  .behavior-chips {
    display: none;
  }
}

.behavior-chip {
  flex: none;
  height: 20px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
  font-size: 11px;
  white-space: nowrap;
  max-width: min(180px, 100%);
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-duration {
  min-width: 52px;
  flex: none;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Hover actions: shown on the hovered row only */
.item-actions {
  display: none;
  flex: none;
  gap: 4px;
}

.item-content:hover > .item-actions {
  display: flex;
}

.item-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: var(--color-control-border);
  color: var(--color-text-primary);
  transition: background-color var(--transition-fast), color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 16px;
  }

  &.play:hover,
  &.resume:hover {
    background-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  &.pause:hover {
    background-color: var(--color-warning);
    color: var(--color-on-accent);
  }

  &.stop:hover,
  &.delete:hover {
    background-color: var(--color-danger);
    color: var(--color-on-accent);
  }
}

/* Group header: uppercase label, count and total length */
.playlist-item.is-group > .item-content {
  height: 32px;
  margin-top: 6px;
  font-size: var(--font-size-label);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);

  .item-name {
    font-size: var(--font-size-label);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .item-index {
    letter-spacing: 0;
  }

  /* A group's Play is always offered; Delete appears on hover */
  > .item-actions {
    display: flex;

    .item-btn:not(.play) {
      display: none;
    }
  }

  &:hover > .item-actions .item-btn {
    display: flex;
  }
}

.playlist-item.is-group:first-child > .item-content {
  margin-top: 0;
}

.group-icon {
  flex: none;
  font-size: 16px;
  color: var(--color-text-muted);
}

.group-meta {
  flex: none;
  font-family: var(--font-mono);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* 24 px per nesting level */
.group-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  padding-left: 24px;
}
</style>
