<template>
  <div 
    class="active-cue-item" 
    :class="{
      'is-paused': cue.isPaused,
      'warning-yellow': warningState === 'yellow',
      'warning-orange': warningState === 'orange',
      'warning-red': warningState === 'red'
    }"
    :style="itemStyle"
  >
    <div class="cue-header">
      <span class="cue-name" :title="cue.displayName">{{ cue.displayName }}</span>
      <button 
        v-if="!cue.isPaused" 
        class="action-btn" 
        @click="handlePause" 
        :title="t('actions.pause')"
        :aria-label="t('actions.pause')"
      >
        <span class="material-symbols-rounded">pause</span>
      </button>
      <button 
        v-else
        class="action-btn" 
        @click="handleResume" 
        :title="t('actions.resume')"
        :aria-label="t('actions.resume')"
      >
        <span class="material-symbols-rounded">play_arrow</span>
      </button>
      <button
        class="action-btn"
        @click="handleStop"
        :title="t('actions.stop')"
        :aria-label="t('actions.stop')"
      >
        <span class="material-symbols-rounded">stop</span>
      </button>
    </div>

    <div class="cue-progress">
      <span class="time-elapsed">{{ formatTime(cue.currentTime) }}</span>

      <div class="cue-bars">
        <div class="progress-bar" @click="handleSeek">
          <div class="progress-track">
            <div class="progress-fill" :style="progressStyle"></div>
          </div>
        </div>
        <VUMeter 
          :level="cue.currentLevel ?? -60" 
          :peakLevel="cue.peakLevel ?? -60"
          :showPeakHold="true"
        />
      </div>

      <span class="time-remaining">-{{ formatTime(cue.duration - cue.currentTime) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NEUTRAL_CUE_COLOR } from '~/types/project';

interface ActiveCueState {
  uuid: string;
  displayName: string;
  duration: number;
  currentTime: number;
  volume: number;
  isDucked: boolean;
  isPaused: boolean;
  originalVolume: number;
  howl?: any;
  progressInterval?: any;
  color?: string;
  inPoint?: number;
  outPoint?: number;
  currentLevel?: number;
  peakLevel?: number;
}

const props = defineProps<{
  cue: ActiveCueState;
}>();

const { stopCue, pauseCue, resumeCue, seekCue } = useAudioEngine();
const { t } = useLocalization();

// Use the cue's currentTime directly (updated by the audio engine)
const progress = computed(() => {
  if (!props.cue.duration || props.cue.duration === 0) return 0;
  return (props.cue.currentTime / props.cue.duration) * 100;
});

// Warning state based on time remaining
// Note: This is per-cue visual feedback only
// The ProjectHeader handles the actual silence detection across all cues
const warningState = computed(() => {
  const timeRemaining = props.cue.duration - props.cue.currentTime;
  if (timeRemaining <= 5) return 'red';
  if (timeRemaining <= 10) return 'orange';
  if (timeRemaining <= 30) return 'yellow';
  return null;
});

// Item colour: left stripe always; tint and progress only for a custom
// colour, otherwise the progress uses the accent
const hasCustomColor = computed(() => !!props.cue.color && props.cue.color !== NEUTRAL_CUE_COLOR);

const itemStyle = computed(() => ({
  '--cue-color': props.cue.color || NEUTRAL_CUE_COLOR,
  '--cue-tint': hasCustomColor.value
    ? `color-mix(in srgb, ${props.cue.color} 8%, var(--color-field))`
    : 'var(--color-field)',
}));

const progressStyle = computed(() => ({
  width: `${progress.value}%`,
  backgroundColor: props.cue.isPaused
    ? 'var(--color-warning)'
    : hasCustomColor.value ? props.cue.color : 'var(--color-accent)',
}));

const handleStop = () => {
  stopCue(props.cue.uuid);
};

const handlePause = () => {
  pauseCue(props.cue.uuid);
};

const handleResume = () => {
  resumeCue(props.cue.uuid);
};

const handleSeek = (e: MouseEvent) => {
  // Seeking with fade support
  if (props.cue.howl) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    
    // Calculate seek time relative to trimmed duration
    const relativeSeekTime = percent * props.cue.duration;
    
    // For trimmed items, add inPoint to get absolute position in file
    const absoluteSeekTime = relativeSeekTime + (props.cue.inPoint || 0);
    
    // Use the audio engine's seekCue function which handles fade
    seekCue(props.cue.uuid, absoluteSeekTime);
  }
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
</script>

<style scoped lang="scss">
.active-cue-item {
  position: relative;
  width: 300px;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px 12px 8px 15px;
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);
  background-color: var(--cue-tint);
  overflow: hidden;
  transition: box-shadow var(--transition-fast);

  /* Item colour stripe; a pseudo-element so the warning flash (box-shadow)
     does not hide it */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--cue-color);
  }
  
  &.warning-yellow {
    animation: flash-yellow 2s ease-in-out infinite;
  }
  
  &.warning-orange {
    animation: flash-orange 1s ease-in-out infinite;
  }
  
  &.warning-red {
    animation: flash-red 0.5s ease-in-out infinite;
  }
}

@keyframes flash-yellow {
  0%, 100% { 
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-state-armed) 40%, transparent);
  }
  50% { 
    box-shadow: 0 0 6px 2px color-mix(in srgb, var(--color-state-armed) 60%, transparent);
  }
}

@keyframes flash-orange {
  0%, 100% { 
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-state-paused) 40%, transparent);
  }
  50% { 
    box-shadow: 0 0 8px 3px color-mix(in srgb, var(--color-state-paused) 70%, transparent);
  }
}

@keyframes flash-red {
  0%, 100% { 
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger) 50%, transparent);
  }
  50% { 
    box-shadow: 0 0 10px 4px color-mix(in srgb, var(--color-danger) 80%, transparent);
  }
}

.cue-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cue-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--color-text-primary);
}

.action-btn {
  width: 28px;
  height: 28px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background-color: var(--color-divider);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 18px;
  }
  
  &:hover {
    background-color: var(--color-control-border);
  }
}

.cue-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-elapsed {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.cue-bars {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.progress-bar {
  /* Taller hit area than the 4 px track it holds */
  padding: 3px 0;
  margin: -3px 0;
  cursor: pointer;
  /* Force LTR direction for progress bars in RTL languages */
  direction: ltr;
}

.progress-track {
  height: 4px;
  border-radius: 2px;
  background-color: var(--color-control-border);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 100ms linear;
}

.time-remaining {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);

  .is-paused & {
    color: var(--color-warning-text);
  }
}
</style>
