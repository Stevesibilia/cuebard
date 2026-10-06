<template>
  <section class="properties-panel" :aria-label="t('drawer.label')">
    <div class="drawer-header">
      <span class="item-dot" :style="{ backgroundColor: selectedItem.color }"></span>
      <span class="item-name">{{ selectedItem.displayName }}</span>
      <span class="item-meta">{{ headerMeta }}</span>
      <div class="header-gap"></div>
      <div class="drawer-tabs" role="tablist" :aria-label="t('drawer.label')">
        <button
          v-for="tab in availableTabs"
          :key="tab.id"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >{{ tab.label }}</button>
      </div>
      <button class="close-btn" :aria-label="t('drawer.close')" :title="t('drawer.close')" @click="handleClose">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>

    <div class="drawer-body">
      <!-- Playback -->
      <div v-if="activeTab === 'playback' && selectedItem.type === 'audio'" class="tab-panel tab-playback">
        <WaveformTrimmer
          v-if="audioItem && audioItem.mediaPath && audioItem.duration > 0"
          :audio-item="audioItem"
          @update:volume="(v) => { audioItem.volume = v; if (activeCues.has(audioItem.uuid)) setVolume(audioItem.uuid, v); }"
          @update:in-point="(v) => { audioItem.inPoint = v; rescheduleCueTriggers(audioItem.uuid); }"
          @update:out-point="(v) => { audioItem.outPoint = v; rescheduleCueTriggers(audioItem.uuid); }"
          @update:play-fade="handlePlayFadeUpdate"
          @update:stop-fade="handleStopFadeUpdate"
          @update:cross-fade="handleCrossFadeUpdate"
          @change="handleSave"
          @normalize="handleNormalize"
          @trim-silence="handleTrimSilence"
        />
        <div v-else class="loading-message">
          <span class="material-symbols-rounded">pending</span>
          <p>{{ t('properties.loadingAudioData') }}</p>
        </div>
      </div>

      <!-- Behaviour -->
      <div
        v-if="activeTab === 'behaviour'"
        :class="['tab-panel', 'tab-behaviour', { 'is-group': selectedItem.type === 'group' }]"
      >
        <div class="behaviour-col">
          <label for="drawer-start" class="col-title">{{ t('drawer.whenStarts') }}</label>
          <select id="drawer-start" v-model="startBehaviorAction" class="field" @change="handleSave">
            <template v-if="selectedItem.type === 'audio'">
              <option value="nothing">{{ t('drawer.start.nothing') }}</option>
              <option value="play-next">{{ t('drawer.start.playNext') }}</option>
              <option value="play-item">{{ t('drawer.start.playItem') }}</option>
              <option value="play-index">{{ t('drawer.start.playIndex') }}</option>
            </template>
            <template v-else>
              <option value="play-first">{{ t('drawer.start.playFirst') }}</option>
              <option value="play-all">{{ t('drawer.start.playAll') }}</option>
            </template>
          </select>

          <template v-if="startBehaviorAction === 'play-item'">
            <label for="drawer-start-target" class="field-label">{{ t('drawer.targetCue') }}</label>
            <input
              id="drawer-start-target"
              v-model="startBehaviorTargetUuid"
              class="field"
              type="text"
              @change="handleSave"
            />
          </template>

          <template v-if="startBehaviorAction === 'play-index'">
            <label for="drawer-start-index" class="field-label">{{ t('drawer.targetIndex') }}</label>
            <input
              id="drawer-start-index"
              class="field mono"
              type="text"
              :value="startBehaviorTargetIndex?.join(',') || ''"
              :placeholder="t('drawer.indexPlaceholder')"
              @change="handleStartBehaviorIndexChange"
            />
          </template>
        </div>

        <div class="behaviour-col">
          <label for="drawer-end" class="col-title">{{ t('drawer.whenEnds') }}</label>
          <select id="drawer-end" v-model="endBehaviorAction" class="field" @change="handleSave">
            <option value="nothing">{{ t('drawer.end.nothing') }}</option>
            <option value="next">{{ t('drawer.end.next') }}</option>
            <option value="goto-item">{{ t('drawer.end.gotoItem') }}</option>
            <option value="goto-index">{{ t('drawer.end.gotoIndex') }}</option>
            <option v-if="selectedItem.type === 'audio'" value="loop">{{ t('drawer.end.loop') }}</option>
          </select>

          <template v-if="endBehaviorAction === 'goto-item'">
            <label for="drawer-end-target" class="field-label">{{ t('drawer.targetCue') }}</label>
            <input
              id="drawer-end-target"
              v-model="endBehaviorTargetUuid"
              class="field"
              type="text"
              @change="handleSave"
            />
          </template>

          <template v-if="endBehaviorAction === 'goto-index'">
            <label for="drawer-end-index" class="field-label">{{ t('drawer.targetIndex') }}</label>
            <input
              id="drawer-end-index"
              class="field mono"
              type="text"
              :value="endBehaviorTargetIndex?.join(',') || ''"
              :placeholder="t('drawer.indexPlaceholder')"
              @change="handleEndBehaviorIndexChange"
            />
          </template>
        </div>

        <div v-if="selectedItem.type === 'audio'" class="behaviour-col">
          <label for="drawer-duck" class="col-title">{{ t('drawer.otherCues') }}</label>
          <select id="drawer-duck" v-model="audioItem.duckingBehavior.mode" class="field" @change="handleDuckingModeChange">
            <option value="stop-all">{{ t('drawer.ducking.stopAll') }}</option>
            <option value="no-ducking">{{ t('drawer.ducking.noDucking') }}</option>
            <option value="duck-others">{{ t('drawer.ducking.duckOthers') }}</option>
          </select>

          <template v-if="audioItem.duckingBehavior.mode === 'duck-others'">
            <label for="drawer-duck-level" class="field-label field-label-row">
              {{ t('drawer.duckLevel') }}
              <span class="mono">{{ formatDb(duckLevelDB) }}</span>
            </label>
            <input
              id="drawer-duck-level"
              v-model.number="duckLevelDB"
              class="range"
              type="range"
              min="-60"
              max="0"
              step="0.5"
              @change="handleSave"
            />
          </template>
        </div>
      </div>

      <!-- Details -->
      <div v-if="activeTab === 'details'" class="tab-panel tab-details">
        <label for="drawer-name" class="detail-label">{{ t('drawer.name') }}</label>
        <input
          id="drawer-name"
          v-model="selectedItem.displayName"
          class="field"
          type="text"
          @change="handleSave"
        />

        <span class="detail-label">{{ t('drawer.colour') }}</span>
        <div class="swatches">
          <button
            v-for="color in PRESET_COLORS"
            :key="color"
            :class="['swatch', { active: selectedItem.color === color }]"
            :style="{ backgroundColor: color }"
            :aria-label="t('drawer.colourSwatch', { color })"
            :aria-pressed="selectedItem.color === color"
            @click="() => { selectedItem.color = color; handleSave(); }"
          ></button>
        </div>

        <template v-if="selectedItem.type === 'audio'">
          <span class="detail-label">{{ t('drawer.file') }}</span>
          <div class="detail-row">
            <span class="detail-value mono">{{ audioItem.mediaFileName }} · {{ formatTime(audioItem.duration) }}</span>
            <button class="small-btn" @click="handleReplaceMedia">{{ t('drawer.replace') }}</button>
          </div>

          <span class="detail-label">{{ t('drawer.triggerUrl') }}</span>
          <div class="detail-row">
            <span class="detail-value mono ellipsis" :title="triggerUrl">{{ triggerUrl }}</span>
            <button class="small-btn" @click="copyToClipboard(triggerUrl)">{{ t('drawer.copy') }}</button>
          </div>
        </template>

        <span class="detail-label">{{ t('drawer.uuidIndex') }}</span>
        <div class="detail-row">
          <span class="detail-value mono muted ellipsis" :title="selectedItem.uuid">{{ selectedItem.uuid }} · {{ selectedItem.index.join(',') }}</span>
          <button class="small-btn" @click="copyToClipboard(selectedItem.uuid)">{{ t('drawer.copyUuid') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AudioItem, GroupItem } from '~/types/project';
import { PRESET_COLORS, DEFAULT_DUCK_LEVEL } from '~/types/project';
import { calculatePerceivedLoudness } from '~/utils/audio';

const { selectedItem, selectedItems, getSelectedItems, saveProject } = useProject();
const { t } = useLocalization();
const { activeCues, setVolume, rescheduleCueTriggers } = useAudioEngine();

const audioItem = computed(() => selectedItem.value as AudioItem);
const groupItem = computed(() => selectedItem.value as GroupItem);

// Check if selected item is a cart item
const isCartItem = computed(() => {
  if (selectedItem.value && selectedItem.value.type === 'audio') {
    const item = selectedItem.value as AudioItem;
    return item.index && item.index.length > 0 && item.index[0] === -1;
  }
  return false;
});

// Tab management: audio gets Playback, Behaviour, Details; groups the last two
type TabId = 'playback' | 'behaviour' | 'details';
const activeTab = ref<TabId>('playback');

const availableTabs = computed<{ id: TabId; label: string }[]>(() => {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'behaviour', label: t('drawer.behaviour') },
    { id: 'details', label: t('drawer.details') },
  ];
  if (selectedItem.value?.type === 'audio') {
    tabs.unshift({ id: 'playback', label: t('drawer.playback') });
  }
  return tabs;
});

// File name and length for audio, cue count for groups
const headerMeta = computed(() => {
  const item = selectedItem.value;
  if (item?.type === 'audio') {
    const audio = item as AudioItem;
    return `${audio.mediaFileName} · ${formatTime(audio.duration)}`;
  }
  if (item?.type === 'group') {
    const count = (item as GroupItem).children.length;
    return count === 1 ? t('drawer.groupMetaOne') : t('drawer.groupMetaMany', { count });
  }
  return '';
});

// The API server moves to the next free port when 8080 is taken
const apiPort = ref(8080);
onMounted(async () => {
  try {
    const status = await window.electronAPI?.getRemoteViewerStatus?.();
    if (status?.port) apiPort.value = status.port;
  } catch (error) {
    console.error('Failed to read the API port:', error);
  }
});
const triggerUrl = computed(() => `http://localhost:${apiPort.value}/api/trigger/uuid/${selectedItem.value?.uuid ?? ''}`);

const formatDb = (db: number): string => `${db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`;

// Computed properties for behavior fields
const endBehaviorAction = computed({
  get: () => {
    if (selectedItem.value?.type === 'audio') {
      return audioItem.value.endBehavior.action;
    } else if (selectedItem.value?.type === 'group') {
      return groupItem.value.endBehavior.action;
    }
    return 'nothing';
  },
  set: (value) => {
    if (selectedItem.value?.type === 'audio') {
      audioItem.value.endBehavior.action = value as any;
    } else if (selectedItem.value?.type === 'group') {
      groupItem.value.endBehavior.action = value as any;
    }
  }
});

const endBehaviorTargetUuid = computed({
  get: () => {
    if (selectedItem.value?.type === 'audio') {
      return audioItem.value.endBehavior.targetUuid || '';
    } else if (selectedItem.value?.type === 'group') {
      return groupItem.value.endBehavior.targetUuid || '';
    }
    return '';
  },
  set: (value) => {
    if (selectedItem.value?.type === 'audio') {
      audioItem.value.endBehavior.targetUuid = value;
    } else if (selectedItem.value?.type === 'group') {
      groupItem.value.endBehavior.targetUuid = value;
    }
  }
});

const endBehaviorTargetIndex = computed(() => {
  if (selectedItem.value?.type === 'audio') {
    return audioItem.value.endBehavior.targetIndex;
  } else if (selectedItem.value?.type === 'group') {
    return groupItem.value.endBehavior.targetIndex;
  }
  return undefined;
});

const handleEndBehaviorIndexChange = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  const parsed = value.split(',').map(i => parseInt(i));
  if (selectedItem.value?.type === 'audio') {
    audioItem.value.endBehavior.targetIndex = parsed;
  } else if (selectedItem.value?.type === 'group') {
    groupItem.value.endBehavior.targetIndex = parsed;
  }
  handleSave();
};

const startBehaviorAction = computed({
  get: () => {
    if (selectedItem.value?.type === 'audio') {
      return audioItem.value.startBehavior.action;
    } else if (selectedItem.value?.type === 'group') {
      return groupItem.value.startBehavior.action;
    }
    return 'nothing';
  },
  set: (value) => {
    if (selectedItem.value?.type === 'audio') {
      audioItem.value.startBehavior.action = value as any;
    } else if (selectedItem.value?.type === 'group') {
      groupItem.value.startBehavior.action = value as any;
    }
  }
});

const startBehaviorTargetUuid = computed({
  get: () => {
    if (selectedItem.value?.type === 'audio') {
      return audioItem.value.startBehavior.targetUuid || '';
    }
    return '';
  },
  set: (value) => {
    if (selectedItem.value?.type === 'audio') {
      audioItem.value.startBehavior.targetUuid = value;
    }
  }
});

const startBehaviorTargetIndex = computed(() => {
  if (selectedItem.value?.type === 'audio') {
    return audioItem.value.startBehavior.targetIndex;
  }
  return undefined;
});

const handleStartBehaviorIndexChange = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  const parsed = value.split(',').map(i => parseInt(i));
  if (selectedItem.value?.type === 'audio') {
    audioItem.value.startBehavior.targetIndex = parsed;
  }
  handleSave();
};

// "Duck others" always has a level: seed it when the mode is first chosen
const handleDuckingModeChange = () => {
  const behavior = audioItem.value.duckingBehavior;
  if (behavior.mode === 'duck-others' && behavior.duckLevel === undefined) {
    behavior.duckLevel = DEFAULT_DUCK_LEVEL;
  }
  handleSave();
};

// Duck level in dB
const duckLevelDB = computed({
  get: () => {
    const linear = audioItem.value.duckingBehavior.duckLevel ?? DEFAULT_DUCK_LEVEL;
    if (linear <= 0) return -60;
    return 20 * Math.log10(linear);
  },
  set: (db: number) => {
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    audioItem.value.duckingBehavior.duckLevel = linear;
  }
});

// Store a snapshot of the original values when properties panel opens
const originalSnapshot = ref<any>(null);
const isInitializing = ref(false);

// When selectedItem changes, take a snapshot
watch(selectedItem, (newItem, oldItem) => {
  if (newItem) {
    // Only reset tab if it's a different item (not just property updates)
    const isDifferentItem = !oldItem || newItem.uuid !== oldItem.uuid;
    
    if (isDifferentItem) {
      isInitializing.value = true;
      originalSnapshot.value = JSON.parse(JSON.stringify(newItem));
      
      // A freshly opened drawer starts on the first tab; an open one keeps
      // the current tab when the new item has it
      const ids = availableTabs.value.map(tab => tab.id);
      if (!oldItem || !ids.includes(activeTab.value)) {
        activeTab.value = ids[0];
      }
      
      setTimeout(() => {
        isInitializing.value = false;
      }, 0);
    }
  } else {
    originalSnapshot.value = null;
  }
}, { immediate: true });

const handleClose = () => {
  selectedItem.value = null;
  selectedItems.value.clear();
  originalSnapshot.value = null;
};

const handleSave = async () => {
  // If multiple items are selected, update all of them with ONLY changed properties
  const items = getSelectedItems();
  if (items.length > 1 && originalSnapshot.value && selectedItem.value) {
    const current = selectedItem.value;
    const original = originalSnapshot.value;
    
    items.forEach(item => {
      // Only update properties that have changed
      if (current.displayName !== original.displayName) {
        item.displayName = current.displayName;
      }
      if (current.color !== original.color) {
        item.color = current.color;
      }
      
      // Copy type-specific properties only if they changed
      if (item.type === 'audio' && current.type === 'audio') {
        const sourceAudio = current as AudioItem;
        const originalAudio = original as AudioItem;
        const targetAudio = item as AudioItem;
        
        if (sourceAudio.volume !== originalAudio.volume) {
          targetAudio.volume = sourceAudio.volume;
        }
        if (sourceAudio.inPoint !== originalAudio.inPoint) {
          targetAudio.inPoint = sourceAudio.inPoint;
        }
        if (sourceAudio.outPoint !== originalAudio.outPoint) {
          targetAudio.outPoint = sourceAudio.outPoint;
        }
        if (JSON.stringify(sourceAudio.duckingBehavior) !== JSON.stringify(originalAudio.duckingBehavior)) {
          targetAudio.duckingBehavior = { ...sourceAudio.duckingBehavior };
        }
        if (JSON.stringify(sourceAudio.endBehavior) !== JSON.stringify(originalAudio.endBehavior)) {
          targetAudio.endBehavior = { ...sourceAudio.endBehavior };
        }
        if (JSON.stringify(sourceAudio.startBehavior) !== JSON.stringify(originalAudio.startBehavior)) {
          targetAudio.startBehavior = { ...sourceAudio.startBehavior };
        }
      } else if (item.type === 'group' && current.type === 'group') {
        const sourceGroup = current as GroupItem;
        const originalGroup = original as GroupItem;
        const targetGroup = item as GroupItem;
        
        if (JSON.stringify(sourceGroup.startBehavior) !== JSON.stringify(originalGroup.startBehavior)) {
          targetGroup.startBehavior = { ...sourceGroup.startBehavior };
        }
        if (JSON.stringify(sourceGroup.endBehavior) !== JSON.stringify(originalGroup.endBehavior)) {
          targetGroup.endBehavior = { ...sourceGroup.endBehavior };
        }
      }
    });
    
    // Update the snapshot to the current state after saving
    originalSnapshot.value = JSON.parse(JSON.stringify(current));
  }
  
  await saveProject();
};

// Handle normalize: normalize ALL selected audio items individually
const handleNormalize = () => {
  let items = getSelectedItems();
  
  // Fallback to selectedItem if no items in selectedItems set (shouldn't happen now, but safe)
  if (items.length === 0 && selectedItem.value) {
    items = [selectedItem.value];
  }
  
  const targetLoudness = -10; // Our "0dB" with headroom
  
  let normalizedCount = 0;
  
  items.forEach(item => {
    if (item.type !== 'audio') return;
    
    const audioItem = item as AudioItem;
    
    // Skip if no waveform data
    if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) {
      console.warn(`Skipping ${audioItem.displayName}: no waveform data`);
      return;
    }
    
    const peaks = audioItem.waveform.peaks;
    const duration = audioItem.duration;
    
    // Get trimmed region
    const inPoint = audioItem.inPoint || 0;
    const outPoint = audioItem.outPoint || duration;
    const startIndex = Math.floor((inPoint / duration) * peaks.length);
    const endIndex = Math.ceil((outPoint / duration) * peaks.length);
    const trimmedPeaks = peaks.slice(startIndex, endIndex);
    
    // Calculate INTRINSIC perceived loudness
    const intrinsicLoudness = calculatePerceivedLoudness(trimmedPeaks);
    
    // Calculate the ABSOLUTE volume needed
    const gainDb = targetLoudness - intrinsicLoudness;
    const newVolume = Math.pow(10, gainDb / 20);
    
    // Clamp to reasonable range (0.001 to 3.162, where 3.162 = +10dB max)
    const maxVolume = Math.pow(10, 10 / 20); // +10dB = 3.162
    const clampedVolume = Math.min(Math.max(newVolume, 0.001), maxVolume);
    audioItem.volume = clampedVolume;
    
    normalizedCount++;
    console.log(`Normalized ${audioItem.displayName}: ${intrinsicLoudness.toFixed(1)}dB -> ${targetLoudness}dB (volume: ${clampedVolume.toFixed(3)})`);
  });
  
  if (normalizedCount > 0) {
    saveProject();
    console.log(`Normalized ${normalizedCount} item(s)`);
  }
};

// Handle trim silence: trim ALL selected audio items individually
const handleTrimSilence = () => {
  let items = getSelectedItems();
  
  // Fallback to selectedItem if no items in selectedItems set (shouldn't happen now, but safe)
  if (items.length === 0 && selectedItem.value) {
    items = [selectedItem.value];
  }
  
  const padding = 0.1; // Padding in seconds
  
  let trimmedCount = 0;
  
  items.forEach(item => {
    if (item.type !== 'audio') return;
    
    const audioItem = item as AudioItem;
    
    // Skip if no waveform data
    if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) {
      console.warn(`Skipping ${audioItem.displayName}: no waveform data`);
      return;
    }
    
    const peaks = audioItem.waveform.peaks;
    const duration = audioItem.duration;
    
    // Find the maximum peak value to calculate relative threshold
    const maxPeak = Math.max(...peaks);
    
    // Use 5% of max peak as threshold (more sensitive to actual silence)
    const threshold = maxPeak * 0.05;
    
    // Find first non-silent sample from start
    let startIndex = 0;
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i] > threshold) {
        startIndex = i;
        break;
      }
    }
    
    // Find first non-silent sample from end
    let endIndex = peaks.length - 1;
    for (let i = peaks.length - 1; i >= 0; i--) {
      if (peaks[i] > threshold) {
        endIndex = i;
        break;
      }
    }
    
    // Convert indices to time
    const newInPoint = (startIndex / peaks.length) * duration;
    const newOutPoint = ((endIndex + 1) / peaks.length) * duration;
    
    // Apply with padding
    audioItem.inPoint = Math.max(0, newInPoint - padding);
    audioItem.outPoint = Math.min(duration, newOutPoint + padding);
    
    trimmedCount++;
    console.log(`Trimmed ${audioItem.displayName}: maxPeak=${maxPeak.toFixed(3)}, threshold=${threshold.toFixed(3)}, ${newInPoint.toFixed(2)}s - ${newOutPoint.toFixed(2)}s`);
  });
  
  if (trimmedCount > 0) {
    saveProject();
    console.log(`Trimmed ${trimmedCount} item(s)`);
  }
};

// Handle fade updates: apply to ALL selected audio items
const handlePlayFadeUpdate = (value: number) => {
  const items = getSelectedItems();
  items.forEach(item => {
    if (item.type === 'audio') {
      (item as AudioItem).playFade = value;
    }
  });
};

const handleStopFadeUpdate = (value: number) => {
  const items = getSelectedItems();
  items.forEach(item => {
    if (item.type === 'audio') {
      (item as AudioItem).stopFade = value;
      rescheduleCueTriggers(item.uuid);
    }
  });
};

const handleCrossFadeUpdate = (value: number) => {
  const items = getSelectedItems();
  items.forEach(item => {
    if (item.type === 'audio') {
      (item as AudioItem).crossFade = value;
      rescheduleCueTriggers(item.uuid);
    }
  });
};

const handleReplaceMedia = async () => {
  if (!import.meta.client || !window.electronAPI) return;
  
  const files = await window.electronAPI.selectAudioFiles();
  if (!files || files.length === 0) return;
  
  // Implementation would replace the media file
  console.log('Replace media with:', files[0]);
};

const copyToClipboard = async (text: string) => {
  if (import.meta.client) {
    try {
      await window.electronAPI.writeClipboardText(text);
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.properties-panel {
  height: var(--size-drawer);
  flex: none;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-divider);
  background-color: var(--color-chrome);
  color: var(--color-text-primary);
}

/* Header: dot, name, meta, tabs, close */
.drawer-header {
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-divider);
  min-width: 0;
}

.item-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}

.item-name {
  font-weight: 600;
  font-size: var(--font-size-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.item-meta {
  font-family: var(--font-mono);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 0 1 auto;
}

.header-gap {
  flex: 1;
}

.drawer-tabs {
  display: flex;
  flex: none;
  padding: 3px;
  border-radius: 9px;
  background: var(--color-field);
}

.tab-btn {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    color: var(--color-text-primary);
  }

  &.active {
    background: var(--color-control-border);
    color: var(--color-text-primary);
    font-weight: 600;
  }
}

.close-btn {
  width: var(--size-control);
  height: var(--size-control);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;

  &:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);
  }

  .material-symbols-rounded {
    font-size: 18px;
    color: inherit;
  }
}

/* Body */
.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.tab-panel {
  height: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
}

.tab-playback {
  display: flex;
}

/* Shared controls */
.field {
  height: 34px;
  box-sizing: border-box;
  width: 100%;
  padding: 0 10px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-field);
  color: var(--color-text-primary);
  font: inherit;

  &:focus {
    outline: none;
    border-color: var(--color-accent);
  }
}

select.field {
  padding: 0 8px;
}

.mono {
  font-family: var(--font-mono);
}

.muted {
  color: var(--color-text-muted);
}

.range {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  accent-color: var(--color-accent);
}

.small-btn {
  height: 28px;
  flex: none;
  padding: 0 10px;
  border: 1px solid var(--color-control-border);
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-label);
  cursor: pointer;

  &:hover {
    background: var(--color-surface-hover);
  }
}

/* Behaviour: three columns (two for groups) */
.tab-behaviour {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  padding: 16px;

  &.is-group {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 66%;
  }
}

.behaviour-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.col-title {
  font-size: var(--font-size-label);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.field-label {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.field-label-row {
  display: flex;
  justify-content: space-between;
}

/* Details: label column and value column */
.tab-details {
  display: grid;
  grid-template-columns: 96px minmax(0, 640px);
  align-content: start;
  align-items: center;
  gap: 10px 12px;
  padding: 16px;
}

.tab-details .field {
  height: var(--size-control);
}

.detail-label {
  color: var(--color-text-secondary);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.detail-value {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-label);
  color: var(--color-text-secondary);
}

.detail-value.muted {
  color: var(--color-text-muted);
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--color-control-border);
  cursor: pointer;

  &.active {
    border: 2px solid var(--color-text-primary);
  }
}

.loading-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  color: var(--color-text-secondary);
}

.loading-message .material-symbols-rounded {
  font-size: 48px;
  animation: spin 2s linear infinite;
}

.loading-message p {
  font-size: 14px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
