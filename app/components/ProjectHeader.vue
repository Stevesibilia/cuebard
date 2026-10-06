<template>
  <header class="project-header">
    <div class="brand">
      <img
        :src="'./assets/icons/cuebard-mark.svg'"
        alt=""
        class="brand-mark"
      />
      <span class="brand-wordmark">CueBard</span>
    </div>
    <div class="header-divider"></div>
    <h2 class="project-name">{{ currentProject?.name || t('project.noProject') }}</h2>

    <div class="header-spacer"></div>

    <div
      v-if="silenceWarning"
      class="header-pill silence-warning"
      :class="silenceWarningClass"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
      {{ t('project.silenceIn', { time: silenceCountdown }) }}
    </div>

    <div v-if="remoteViewerEnabled" class="header-pill viewer-status">
      <span class="viewer-dot"></span>
      {{ t('project.viewerOn') }}
    </div>

    <div class="digital-clock">{{ currentTime }}</div>
  </header>
</template>

<script setup lang="ts">

const { currentProject, findItemByUuid, findItemByIndex } = useProject();
const { t } = useLocalization();
const { activeCues } = useAudioEngine();

const currentTime = ref('00:00:00');

// Silence warning system
const silenceWarning = ref<number | null>(null);

// Countdown as m:ss, rounded up like the old whole-second readout
const silenceCountdown = computed(() => {
  const total = Math.ceil(silenceWarning.value ?? 0);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
});

const silenceWarningClass = computed(() => {
  if (!silenceWarning.value) return '';
  
  const seconds = silenceWarning.value;
  if (seconds <= 5) return 'flash-fast'; // Fast red flash
  if (seconds <= 10) return 'flash-medium'; // Medium red flash
  if (seconds <= 30) return 'flash-slow'; // Slow orange flash
  return 'warning-yellow'; // Yellow background
});

// Check if we're approaching silence
const checkForSilence = () => {
  if (!currentProject.value || activeCues.value.size === 0) {
    silenceWarning.value = null;
    return;
  }
  
  // Track when each cue will end
  const cueEndTimes = new Map<string, { time: number; hasValidBehavior: boolean }>();
  
  // Collect end times and behaviors for all cues
  for (const [uuid, cue] of activeCues.value) {
    const item = findItemByUuid(uuid);
    if (!item || item.type !== 'audio') continue;
    
    const audioItem = item as any;
    const timeRemaining = cue.duration - cue.currentTime;
    const hasValidEndBehavior = validateEndBehavior(audioItem);
    
    cueEndTimes.set(uuid, {
      time: timeRemaining,
      hasValidBehavior: hasValidEndBehavior
    });
  }
  
  // Special case: only one cue playing
  if (cueEndTimes.size === 1) {
    const [uuid, { time, hasValidBehavior }] = Array.from(cueEndTimes.entries())[0];
    if (!hasValidBehavior && time <= 60) {
      silenceWarning.value = time;
      return;
    }
    silenceWarning.value = null;
    return;
  }
  
  // Multiple cues: find the minimum time until we have NO active cues
  let minTimeToActualSilence = Infinity;
  
  // Sort cues by end time
  const sortedCues = Array.from(cueEndTimes.entries())
    .sort((a, b) => a[1].time - b[1].time);
  
  // Check each point in time where a cue ends
  for (let i = 0; i < sortedCues.length; i++) {
    const [uuid, { time, hasValidBehavior }] = sortedCues[i];
    
    // Count how many cues will still be playing at this time
    let cuesStillPlaying = 0;
    let willSpawnNewCue = hasValidBehavior;
    
    for (let j = 0; j < sortedCues.length; j++) {
      if (i === j) continue; // Skip the cue that's ending
      const otherTime = sortedCues[j][1].time;
      if (otherTime > time) {
        cuesStillPlaying++;
      }
    }
    
    // If this cue ends and there are no other cues playing and it won't spawn a new cue
    // then we have silence
    if (cuesStillPlaying === 0 && !willSpawnNewCue) {
      minTimeToActualSilence = Math.min(minTimeToActualSilence, time);
      break; // Found the first point of silence
    }
  }
  
  // Only show warning if we're within 60 seconds of actual silence
  if (minTimeToActualSilence <= 60 && minTimeToActualSilence !== Infinity) {
    silenceWarning.value = minTimeToActualSilence;
  } else {
    silenceWarning.value = null;
  }
};

// Validate if end behavior will actually trigger something (not lead to silence)
const validateEndBehavior = (audioItem: any): boolean => {
  if (!audioItem.endBehavior || audioItem.endBehavior.action === 'nothing') {
    return false; // No end behavior = silence
  }
  
  const action = audioItem.endBehavior.action;
  
  if (action === 'next' || action === 'play-next') {
    // Check if there's actually a next item
    const currentIndex = audioItem.index;
    if (!currentIndex || !currentProject.value) return false;
    
    // Find parent and check for next sibling
    const parentIndex = currentIndex.slice(0, -1);
    const currentPosition = currentIndex[currentIndex.length - 1];
    
    if (parentIndex.length === 0) {
      // Top level - check project items
      const nextItem = currentProject.value.items[currentPosition + 1];
      return !!nextItem; // Valid if next item exists
    } else {
      // Inside a group - need to find parent group
      const parent = findItemByIndex(parentIndex);
      if (parent && parent.type === 'group') {
        const nextItem = (parent as any).children[currentPosition + 1];
        return !!nextItem; // Valid if next sibling exists
      }
      return false;
    }
  }
  
  if (action === 'goto-item') {
    // Check if target UUID is valid
    const targetUuid = audioItem.endBehavior.targetUuid;
    if (!targetUuid) return false;
    
    const targetItem = findItemByUuid(targetUuid);
    return !!targetItem; // Valid if target item exists
  }
  
  if (action === 'goto-index') {
    // Check if target index is valid
    const targetIndex = audioItem.endBehavior.targetIndex;
    if (!targetIndex || !Array.isArray(targetIndex)) return false;
    
    const targetItem = findItemByIndex(targetIndex);
    return !!targetItem; // Valid if target index resolves to an item
  }
  
  if (action === 'loop') {
    return true; // Loop always continues
  }
  
  return false; // Unknown action = assume silence
};

// Remote viewer state lives in the main process and has no change event,
// so the header asks once per second, on the clock tick
const remoteViewerEnabled = ref(false);

const refreshRemoteViewer = async () => {
  const status = await window.electronAPI?.getRemoteViewerStatus?.();
  remoteViewerEnabled.value = !!status?.enabled;
};

const updateClock = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  currentTime.value = `${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  updateClock();
  void refreshRemoteViewer();
  const clockInterval = setInterval(() => {
    updateClock();
    void refreshRemoteViewer();
  }, 1000);
  
  // Check for silence every 100ms for accuracy
  const silenceInterval = setInterval(checkForSilence, 100);
  
  onUnmounted(() => {
    clearInterval(clockInterval);
    clearInterval(silenceInterval);
  });
});
</script>

<style scoped lang="scss">
.project-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  height: var(--size-header);
  flex: none;
  padding: 0 var(--spacing-md);
  background-color: var(--color-chrome);
  border-bottom: 1px solid var(--color-divider);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: none;
}

.brand-mark {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.brand-wordmark {
  font-family: var(--font-brand);
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.header-divider {
  width: 1px;
  height: 20px;
  flex: none;
  background-color: var(--color-control-border);
}

.project-name {
  min-width: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-spacer {
  flex: 1;
}

.header-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  flex: none;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-label);
  white-space: nowrap;
}

.viewer-status {
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
}

.viewer-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--color-success);
}

.digital-clock {
  flex: none;
  font-family: var(--font-mono);
  font-size: var(--font-size-clock);
  font-weight: 500;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.silence-warning {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

// More than 30 s left
.silence-warning.warning-yellow {
  background-color: var(--color-warning-tint);
  color: var(--color-warning);
}

// 30 s or less
.silence-warning.flash-slow {
  background-color: var(--color-warning-tint);
  color: var(--color-warning);
  animation: flash-slow 2s ease-in-out infinite;
}

// 10 s or less
.silence-warning.flash-medium {
  background-color: var(--color-danger-tint);
  color: var(--color-danger-text);
  animation: flash-medium 1s ease-in-out infinite;
}

// 5 s or less
.silence-warning.flash-fast {
  background-color: var(--color-danger);
  color: var(--color-on-accent);
  animation: flash-fast 0.5s ease-in-out infinite;
}

@keyframes flash-slow {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

@keyframes flash-medium {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

@keyframes flash-fast {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}
</style>
