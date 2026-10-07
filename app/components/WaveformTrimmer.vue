<template>
  <div class="waveform-trimmer">
    <!-- Volume: vertical slider, -60 (-inf) to +10 dB -->
    <div class="volume-col">
      <span class="col-label">{{ t('drawer.volume') }}</span>
      <div class="volume-body">
        <input
          type="range"
          class="volume-slider"
          :min="-60"
          :max="10"
          step="0.1"
          :value="volumeDB"
          :aria-label="t('properties.volume')"
          :title="t('drawer.volumeHint')"
          :style="{ '--volume-fill': volumeFill + '%', '--volume-colour': volumeHandleColor }"
          @input="handleVolumeChange"
          @dblclick="resetVolume"
        />
        <div class="volume-markers" aria-hidden="true">
          <span
            v-for="marker in volumeMarkers"
            :key="marker.label"
            :style="{ bottom: marker.position + '%' }"
          >{{ marker.label }}</span>
        </div>
      </div>
      <span class="volume-readout">{{ formatDb(volumeDB) }}</span>
    </div>

    <!-- Waveform with handles, scroll bar and time fields -->
    <div class="wave-col">
      <div
        class="waveform-container"
        ref="waveformContainer"
        @wheel.prevent="handleWheel"
      >
        <canvas
          ref="waveformCanvas"
          class="waveform-canvas"
          @mousedown="handleCanvasMouseDown"
        ></canvas>

        <!-- Trim Region Overlay -->
        <div
          class="trim-overlay trim-overlay-left"
          :style="{ width: inPointPosition + 'px' }"
        ></div>
        <div
          class="trim-overlay trim-overlay-right"
          :style="{ left: outPointPosition + 'px' }"
        ></div>

        <!-- Trim Handles -->
        <div
          class="trim-handle trim-handle-in"
          :style="{ left: inPointPosition + 'px' }"
          @mousedown.prevent="startDragHandle('in', $event)"
        >
          <div class="trim-line"></div>
          <div class="trim-grip">
            <span class="material-symbols-rounded">arrow_forward</span>
          </div>
        </div>

        <div
          class="trim-handle trim-handle-out"
          :style="{ left: outPointPosition + 'px' }"
          @mousedown.prevent="startDragHandle('out', $event)"
        >
          <div class="trim-line"></div>
          <div class="trim-grip">
            <span class="material-symbols-rounded">arrow_back</span>
          </div>
        </div>

        <!-- Fade Handles (hidden for cart items) -->
        <template v-if="!isCartItem">
          <!-- Play Fade Handle (fade in end) -->
          <div
            v-if="playFade > 0"
            class="fade-handle fade-handle-play"
            :style="{ left: playFadePosition + 'px' }"
            :title="t('drawer.fadeInHandle', { seconds: playFade.toFixed(1) })"
            @mousedown.prevent="startDragFade('play', $event)"
          >
            <div class="fade-line fade-line-red"></div>
            <div class="fade-grip fade-grip-red">
              <span class="material-symbols-rounded">trending_up</span>
            </div>
          </div>

          <!-- Stop Fade Handle (fade out start) -->
          <div
            v-if="stopFade > 0"
            class="fade-handle fade-handle-stop"
            :style="{ left: stopFadePosition + 'px' }"
            :title="t('drawer.fadeOutHandle', { seconds: stopFade.toFixed(1) })"
            @mousedown.prevent="startDragFade('stop', $event)"
          >
            <div class="fade-line fade-line-red"></div>
            <div class="fade-grip fade-grip-red">
              <span class="material-symbols-rounded">trending_down</span>
            </div>
          </div>

          <!-- Cross Fade Handle (crossfade start) -->
          <div
            v-if="crossFade > 0"
            class="fade-handle fade-handle-cross"
            :style="{ left: crossFadePosition + 'px' }"
            :title="t('drawer.crossFadeHandle', { seconds: crossFade.toFixed(1) })"
            @mousedown.prevent="startDragFade('cross', $event)"
          >
            <div class="fade-line fade-line-yellow"></div>
            <div class="fade-grip fade-grip-yellow">
              <span class="material-symbols-rounded">swap_horiz</span>
            </div>
          </div>
        </template>
      </div>

      <!-- Horizontal scroll bar, only usable while zoomed -->
      <div :class="['waveform-scrollbar', { hidden: maxScroll === 0 }]">
        <input
          type="range"
          class="scroll-slider"
          min="0"
          :max="maxScroll"
          step="0.1"
          :disabled="maxScroll === 0"
          :aria-label="t('drawer.zoom')"
          v-model.number="scrollPosition"
        />
      </div>

      <!-- In, Out, Length, then the fades (not for cart items) -->
      <div class="time-fields">
        <div class="time-field">
          <span class="time-label">{{ t('drawer.inPoint') }}</span>
          <span class="stepper">
            <button type="button" :aria-label="t('drawer.minusHalf')" :title="t('drawer.minusHalf')" @click="adjustInPoint(-0.5)">−</button>
            <input
              type="text"
              :aria-label="t('drawer.inPoint')"
              class="time-input wide"
              :value="formatTimeDetailed(inPoint)"
              @change="handleInPointTextChange"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button type="button" :aria-label="t('drawer.plusHalf')" :title="t('drawer.plusHalf')" @click="adjustInPoint(0.5)">+</button>
          </span>
        </div>
        <div class="time-field">
          <span class="time-label">{{ t('drawer.outPoint') }}</span>
          <span class="stepper">
            <button type="button" :aria-label="t('drawer.minusHalf')" :title="t('drawer.minusHalf')" @click="adjustOutPoint(-0.5)">−</button>
            <input
              type="text"
              :aria-label="t('drawer.outPoint')"
              class="time-input wide"
              :value="formatTimeDetailed(outPoint)"
              @change="handleOutPointTextChange"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button type="button" :aria-label="t('drawer.plusHalf')" :title="t('drawer.plusHalf')" @click="adjustOutPoint(0.5)">+</button>
          </span>
        </div>
        <div class="time-field">
          <span class="time-label">{{ t('drawer.length') }}</span>
          <span class="stepper">
            <input
              type="text"
              :aria-label="t('drawer.length')"
              class="time-input wide"
              :value="formatTimeDetailed(Math.max(0, outPoint - inPoint))"
              readonly
            />
          </span>
        </div>

        <template v-if="!isCartItem">
          <div class="time-field">
            <span class="time-label">{{ t('drawer.fadeIn') }}</span>
            <span class="stepper">
              <button type="button" :aria-label="t('drawer.minusHalf')" :title="t('drawer.minusHalf')" @click="adjustPlayFade(-0.5)">−</button>
              <input
                type="text"
                :aria-label="t('drawer.fadeIn')"
                class="time-input"
                :value="formatFade(playFade)"
                @change="handlePlayFadeTextChange"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button type="button" :aria-label="t('drawer.plusHalf')" :title="t('drawer.plusHalf')" @click="adjustPlayFade(0.5)">+</button>
            </span>
          </div>
          <div class="time-field">
            <span class="time-label">{{ t('drawer.fadeOut') }}</span>
            <span class="stepper">
              <button type="button" :aria-label="t('drawer.minusHalf')" :title="t('drawer.minusHalf')" @click="adjustStopFade(-0.5)">−</button>
              <input
                type="text"
                :aria-label="t('drawer.fadeOut')"
                class="time-input"
                :value="formatFade(stopFade)"
                @change="handleStopFadeTextChange"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button type="button" :aria-label="t('drawer.plusHalf')" :title="t('drawer.plusHalf')" @click="adjustStopFade(0.5)">+</button>
            </span>
          </div>
          <div class="time-field">
            <span class="time-label">{{ t('drawer.crossFade') }}</span>
            <span class="stepper">
              <button type="button" :aria-label="t('drawer.minusHalf')" :title="t('drawer.minusHalf')" @click="adjustCrossFade(-0.5)">−</button>
              <input
                type="text"
                :aria-label="t('drawer.crossFade')"
                class="time-input"
                :value="formatFade(crossFade)"
                @change="handleCrossFadeTextChange"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button type="button" :aria-label="t('drawer.plusHalf')" :title="t('drawer.plusHalf')" @click="adjustCrossFade(0.5)">+</button>
            </span>
          </div>
        </template>
      </div>
    </div>

    <!-- Zoom and audio tools -->
    <div class="tools-col">
      <label for="waveform-zoom" class="zoom-label">
        {{ t('drawer.zoom') }}
        <span class="mono">{{ Math.round(zoomLevel * 100) }}%</span>
      </label>
      <input
        id="waveform-zoom"
        type="range"
        class="zoom-slider"
        min="1"
        max="20"
        step="0.5"
        v-model.number="zoomLevel"
      />
      <button type="button" class="tool-btn" @click="trimSilence">
        <span class="material-symbols-rounded">content_cut</span>
        {{ t('drawer.trimSilence') }}
      </button>
      <button type="button" class="tool-btn" @click="normalizeAudio">
        <span class="material-symbols-rounded">tune</span>
        {{ t('drawer.normalize') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AudioItem } from '~/types/project';
import { calculatePerceivedLoudness, calculateNormalizationGain, waveformDisplayScale } from '~/utils/audio';

const props = defineProps<{
  audioItem: AudioItem;
}>();

const emit = defineEmits<{
  'update:volume': [value: number];
  'update:inPoint': [value: number];
  'update:outPoint': [value: number];
  'update:playFade': [value: number];
  'update:stopFade': [value: number];
  'update:pauseFade': [value: number];
  'update:crossFade': [value: number];
  'change': [];
  'normalize': [];
  'trimSilence': [];
}>();

const { t } = useLocalization();

// Get audio engine for playback position
const { activeCues } = useAudioEngine();

// Check if this is a cart item
const isCartItem = computed(() => {
  return props.audioItem.index && props.audioItem.index.length > 0 && props.audioItem.index[0] === -1;
});

// Fade values
const playFade = computed(() => props.audioItem.playFade || 0);
const stopFade = computed(() => props.audioItem.stopFade || 0);
const crossFade = computed(() => props.audioItem.crossFade || 0);

// Refs
const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const waveformContainer = ref<HTMLDivElement | null>(null);
const isDrawing = ref(false);

// Zoom and scroll
const zoomLevel = ref(1);
const scrollPosition = ref(0);

// Get playback position for playhead
const playbackPosition = computed(() => {
  const cue = activeCues.value.get(props.audioItem.uuid);
  if (!cue) return null;
  
  // currentTime is relative to inPoint, we need absolute position in file
  const inPoint = props.audioItem.inPoint || 0;
  return cue.currentTime + inPoint;
});

// Use existing waveform data from audioItem
const waveformData = computed(() => props.audioItem?.waveform?.peaks ?? null);
const hasWaveform = computed(() => waveformData.value && waveformData.value.length > 0);

// Volume in dB
const volumeDB = computed({
  get: () => {
    // Convert linear volume (0-2+) to dB
    const linear = props.audioItem?.volume ?? 1;
    if (linear <= 0) return -60; // -infinity
    return 20 * Math.log10(linear);
  },
  set: (db: number) => {
    // Convert dB to linear volume
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    emit('update:volume', linear);
    emit('change');
  }
});

// Level colour of the volume slider, from the meter tokens
const volumeHandleColor = computed(() => {
  const db = volumeDB.value;
  if (db > 0) return 'var(--color-meter-clip)';    // above 0 dB
  if (db > -1) return 'var(--color-meter-peak)';   // 0 to -1 dB
  if (db > -6) return 'var(--color-meter-high)';   // -1 to -6 dB
  if (db > -18) return 'var(--color-meter-mid)';   // -6 to -18 dB
  if (db > -36) return 'var(--color-meter-low)';   // -18 to -36 dB
  return 'var(--color-meter-lowest)';              // below -36 dB
});

// Slider position (0-100 from the bottom) of a dB value on the -60..+10 scale
const volumePosition = (db: number) => ((Math.max(-60, Math.min(10, db)) + 60) / 70) * 100;
const volumeFill = computed(() => volumePosition(volumeDB.value));
const volumeMarkers = [
  { label: '+10', position: volumePosition(10) },
  { label: '0', position: volumePosition(0) },
  { label: '−12', position: volumePosition(-12) },
  { label: '−24', position: volumePosition(-24) },
  { label: '−∞', position: volumePosition(-60) },
];

const formatDb = (db: number): string => (db <= -60 ? '−∞ dB' : `${db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`);

// Time values
const inPoint = computed(() => props.audioItem?.inPoint ?? 0);
const outPoint = computed(() => props.audioItem?.outPoint ?? props.audioItem?.duration ?? 0);
const duration = computed(() => props.audioItem?.duration ?? 0);

// Canvas dimensions - use reactive ref to ensure handle positions update on resize
const containerWidth = ref(800);
const canvasWidth = computed(() => containerWidth.value);

// The waveform fills the drawer's height, so its height follows the container too
const containerHeight = ref(120);

// Calculate visible range based on zoom and scroll
const visibleDuration = computed(() => duration.value / zoomLevel.value);
const visibleStart = computed(() => {
  const maxStart = Math.max(0, duration.value - visibleDuration.value);
  return (scrollPosition.value / 100) * maxStart;
});
const visibleEnd = computed(() => Math.min(duration.value, visibleStart.value + visibleDuration.value));

// Max scroll value
const maxScroll = computed(() => (zoomLevel.value > 1 ? 100 : 0));

// Position calculations for trim handles
const inPointPosition = computed(() => {
  const relativeTime = inPoint.value - visibleStart.value;
  return (relativeTime / visibleDuration.value) * canvasWidth.value;
});

const outPointPosition = computed(() => {
  const relativeTime = outPoint.value - visibleStart.value;
  return (relativeTime / visibleDuration.value) * canvasWidth.value;
});

// Fade handle positions (respecting trim points)
const playFadePosition = computed(() => {
  const fadeEndTime = inPoint.value + playFade.value;
  const relativeTime = fadeEndTime - visibleStart.value;
  return (relativeTime / visibleDuration.value) * canvasWidth.value;
});

const stopFadePosition = computed(() => {
  const fadeStartTime = outPoint.value - stopFade.value;
  const relativeTime = fadeStartTime - visibleStart.value;
  return (relativeTime / visibleDuration.value) * canvasWidth.value;
});

const crossFadePosition = computed(() => {
  const crossFadeStartTime = outPoint.value - crossFade.value;
  const relativeTime = crossFadeStartTime - visibleStart.value;
  return (relativeTime / visibleDuration.value) * canvasWidth.value;
});

// Seek to position (when clicking waveform)
const seekToPosition = (absoluteTime: number) => {
  const cue = activeCues.value.get(props.audioItem.uuid);
  if (!cue || !cue.howl) return;
  
  // Convert absolute time to time relative to inPoint for Howler
  // Howler expects time relative to sprite start when using sprites
  const inPoint = props.audioItem.inPoint || 0;
  const seekTime = absoluteTime;
  
  // Clamp to valid range
  const clampedTime = Math.max(inPoint, Math.min(seekTime, props.audioItem.outPoint || props.audioItem.duration));
  
  // Seek the Howler instance
  cue.howl.seek(clampedTime);
};

// Handle dragging
const dragState = ref<{ handle: 'in' | 'out' | 'play' | 'stop' | 'cross' | null; startX: number; startValue: number }>({
  handle: null,
  startX: 0,
  startValue: 0
});

const startDragHandle = (handle: 'in' | 'out', event: MouseEvent) => {
  dragState.value = {
    handle,
    startX: event.clientX,
    startValue: handle === 'in' ? inPoint.value : outPoint.value
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.value.handle) return;

    const deltaX = e.clientX - dragState.value.startX;
    const deltaTime = (deltaX / canvasWidth.value) * visibleDuration.value;
    const newValue = Math.max(0, Math.min(duration.value, dragState.value.startValue + deltaTime));

    if (dragState.value.handle === 'in') {
      emit('update:inPoint', Math.min(newValue, outPoint.value - 0.01));
    } else if (dragState.value.handle === 'out') {
      emit('update:outPoint', Math.max(newValue, inPoint.value + 0.01));
    }
  };

  const handleMouseUp = () => {
    if (dragState.value.handle) {
      emit('change');
    }
    dragState.value.handle = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Handle fade dragging
const startDragFade = (fadeType: 'play' | 'stop' | 'cross', event: MouseEvent) => {
  const currentValue = fadeType === 'play' ? playFade.value : fadeType === 'stop' ? stopFade.value : crossFade.value;
  
  dragState.value = {
    handle: fadeType,
    startX: event.clientX,
    startValue: currentValue
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.value.handle) return;

    const deltaX = e.clientX - dragState.value.startX;
    const deltaTime = (deltaX / canvasWidth.value) * visibleDuration.value;
    
    if (dragState.value.handle === 'play') {
      // Play fade: drag right increases fade duration
      const newValue = Math.max(0, Math.min(10, dragState.value.startValue + deltaTime));
      emit('update:playFade', newValue);
    } else if (dragState.value.handle === 'stop') {
      // Stop fade: drag left increases fade duration (moving the start point earlier)
      const newValue = Math.max(0, Math.min(10, dragState.value.startValue - deltaTime));
      emit('update:stopFade', newValue);
    } else if (dragState.value.handle === 'cross') {
      // Cross fade: drag left increases fade duration (moving the start point earlier)
      const newValue = Math.max(0, Math.min(10, dragState.value.startValue - deltaTime));
      emit('update:crossFade', newValue);
    }
  };

  const handleMouseUp = () => {
    if (dragState.value.handle) {
      emit('change');
    }
    dragState.value.handle = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Handle canvas click for setting trim points
const handleCanvasMouseDown = (event: MouseEvent) => {
  if (dragState.value.handle) return;

  const rect = waveformCanvas.value?.getBoundingClientRect();
  if (!rect) return;

  const x = event.clientX - rect.left;
  const clickedTime = visibleStart.value + (x / canvasWidth.value) * visibleDuration.value;

  // Seek to clicked position
  seekToPosition(clickedTime);
};

// Handle wheel zoom
const handleWheel = (event: WheelEvent) => {
  const delta = event.deltaY > 0 ? -0.5 : 0.5;
  zoomLevel.value = Math.max(1, Math.min(20, zoomLevel.value + delta));
};

// Handle volume change
const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  volumeDB.value = parseFloat(target.value);
};

// Double-click the slider to snap back to unity gain (0 dB).
const resetVolume = () => {
  volumeDB.value = 0;
};

// Fade change handlers
const handlePlayFadeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  emit('update:playFade', value);
  emit('change');
};

const handleStopFadeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  emit('update:stopFade', value);
  emit('change');
};

const handlePauseFadeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  emit('update:pauseFade', value);
  emit('change');
};

const handleCrossFadeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  emit('update:crossFade', value);
  emit('change');
};

// Format time as HH:MM:SS.mmm
const formatTimeDetailed = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

// Parse time from HH:MM:SS.mmm format
const parseTimeDetailed = (timeStr: string): number => {
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;

  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const secondsParts = parts[2].split('.');
  const seconds = parseInt(secondsParts[0]) || 0;
  const milliseconds = parseInt(secondsParts[1]) || 0;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

// Fades show as seconds ("2.5 s"); typing hh:mm:ss.mmm still works
const formatFade = (seconds: number): string => `${seconds.toFixed(1)} s`;
const parseFade = (text: string): number => {
  if (text.includes(':')) return parseTimeDetailed(text);
  const value = parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
};

// Handle time input changes
const handleInPointTextChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const parsed = parseTimeDetailed(value);
  emit('update:inPoint', Math.max(0, Math.min(parsed, outPoint.value - 0.01)));
  emit('change');
};

const handleOutPointTextChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const parsed = parseTimeDetailed(value);
  emit('update:outPoint', Math.min(props.audioItem.duration, Math.max(parsed, inPoint.value + 0.01)));
  emit('change');
};

// Adjustment functions for increment/decrement buttons
const adjustInPoint = (delta: number) => {
  const newValue = Math.max(0, Math.min(inPoint.value + delta, outPoint.value - 0.01));
  emit('update:inPoint', newValue);
  emit('change');
};

const adjustOutPoint = (delta: number) => {
  const newValue = Math.min(props.audioItem.duration, Math.max(outPoint.value + delta, inPoint.value + 0.01));
  emit('update:outPoint', newValue);
  emit('change');
};

const adjustPlayFade = (delta: number) => {
  const newValue = Math.max(0, Math.min(playFade.value + delta, 10));
  emit('update:playFade', newValue);
  emit('change');
};

const adjustStopFade = (delta: number) => {
  const newValue = Math.max(0, Math.min(stopFade.value + delta, 10));
  emit('update:stopFade', newValue);
  emit('change');
};

const adjustCrossFade = (delta: number) => {
  const newValue = Math.max(0, Math.min(crossFade.value + delta, 10));
  emit('update:crossFade', newValue);
  emit('change');
};

// Text change handlers for fade inputs
const handlePlayFadeTextChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const parsed = parseFade(value);
  emit('update:playFade', Math.max(0, Math.min(parsed, 10)));
  emit('change');
};

const handleStopFadeTextChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const parsed = parseFade(value);
  emit('update:stopFade', Math.max(0, Math.min(parsed, 10)));
  emit('change');
};

const handleCrossFadeTextChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const parsed = parseFade(value);
  emit('update:crossFade', Math.max(0, Math.min(parsed, 10)));
  emit('change');
};

// Trim silence from start and end based on waveform peaks
const trimSilence = () => {
  if (!waveformData.value || waveformData.value.length === 0) {
    console.warn('No waveform data available for trimming');
    return;
  }

  // The parent trims every selected cue on its own and saves; no 'change'
  // here, which would copy the shown cue's points onto the others
  emit('trimSilence');
};

// Normalize audio to target loudness
const normalizeAudio = () => {
  if (!waveformData.value || waveformData.value.length === 0) {
    console.warn('No waveform data available for normalization');
    return;
  }

  // The parent normalizes every selected cue on its own and saves; no
  // 'change' here, which would copy the shown cue's volume onto the others
  emit('normalize');
};

// Canvas colours come from the theme tokens. Canvas cannot resolve var(),
// so they are read from the document and read again when the theme or the
// custom accent changes.
interface WaveformPalette {
  background: string;
  grid: string;
  label: string;
  base: string;
  rms: string;
  fade: string;
  crossFade: string;
  accent: string;
  meterLowest: string;
  meterLow: string;
  meterMid: string;
  meterHigh: string;
  meterPeak: string;
  meterClip: string;
}

const readPalette = (): WaveformPalette => {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return {
    background: token('--color-background'),
    grid: token('--color-divider'),
    label: token('--color-text-muted'),
    base: token('--color-text-muted'),
    rms: token('--color-warning'),
    fade: token('--color-danger'),
    crossFade: token('--color-warning'),
    accent: token('--color-accent'),
    meterLowest: token('--color-meter-lowest'),
    meterLow: token('--color-meter-low'),
    meterMid: token('--color-meter-mid'),
    meterHigh: token('--color-meter-high'),
    meterPeak: token('--color-meter-peak'),
    meterClip: token('--color-meter-clip'),
  };
};

let palette: WaveformPalette | null = null;

// Draw waveform on canvas
const drawWaveform = () => {
  const canvas = waveformCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colours = palette ?? (palette = readPalette());
  const canvasHeight = containerHeight.value;

  // Set canvas dimensions with device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasWidth.value * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = `${canvasWidth.value}px`;
  ctx.scale(dpr, dpr);

  // Clear canvas with background color
  ctx.globalAlpha = 1;
  ctx.fillStyle = colours.background;
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight);

  const middleY = canvasHeight / 2;

  // Draw time grid (always shown, behind waveform if present)
  ctx.strokeStyle = colours.grid;
  ctx.lineWidth = 1;
  ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillStyle = colours.label;

  // Calculate dynamic time step based on visible duration and zoom level
  // Goal: Show grid lines every ~50-100 pixels
  const pixelsPerSecond = canvasWidth.value / visibleDuration.value;
  const targetPixelsPerGrid = 75; // Ideal spacing between grid lines

  // Calculate initial time step
  let timeStep = targetPixelsPerGrid / pixelsPerSecond;

  // Round to nice intervals: 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600 seconds
  const niceIntervals = [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600];
  timeStep = niceIntervals.reduce((prev, curr) =>
    Math.abs(curr - timeStep) < Math.abs(prev - timeStep) ? curr : prev
  );

  for (let time = Math.ceil(visibleStart.value / timeStep) * timeStep; time <= visibleEnd.value; time += timeStep) {
    const x = (time - visibleStart.value) * pixelsPerSecond;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();

    // Draw time label - format depends on scale
    let label: string;
    if (timeStep < 1) {
      // Show with decimal for sub-second intervals
      label = time.toFixed(1) + 's';
    } else if (timeStep < 60) {
      // Show seconds
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      label = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
    } else {
      // Show minutes:seconds
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    ctx.fillText(label, x + 4, 12);
  }

  if (hasWaveform.value && waveformData.value && duration.value > 0) {
    // Draw waveform bars from existing data (like in PlaylistItem)
    const peaks = waveformData.value;
    const totalPeaks = peaks.length;
    // Peak-normalize display height so quiet cues aren't a flat line. Computed
    // over the whole track (not just the visible slice) so zoom/scroll doesn't
    // rescale the waveform. Colors below still use the true level.
    const displayScale = waveformDisplayScale(peaks);

    // Calculate visible peak range
    const startPeak = Math.floor((visibleStart.value / duration.value) * totalPeaks);
    const endPeak = Math.floor((visibleEnd.value / duration.value) * totalPeaks);
    const visiblePeaksArray = peaks.slice(startPeak, endPeak);

    if (visiblePeaksArray.length > 0) {
      const barWidth = canvasWidth.value / visiblePeaksArray.length;
      const volumeMultiplier = props.audioItem?.volume ?? 1;

      // Meter colour for a bar's level
      const getColorForDB = (db: number): string => {
        if (db > 0) return colours.meterClip;     // above 0 dB
        if (db > -1) return colours.meterPeak;    // 0 to -1 dB
        if (db > -6) return colours.meterHigh;    // -1 to -6 dB
        if (db > -18) return colours.meterMid;    // -6 to -18 dB
        if (db > -36) return colours.meterLow;    // -18 to -36 dB
        return colours.meterLowest;               // below -36 dB
      };

      // Draw each bar with individual coloring
      visiblePeaksArray.forEach((value, i) => {
        const normalizedPeak = value; // Already normalized 0-1

        // Base waveform bar height (use 80% of canvas height like PlaylistItem).
        // displayScale lifts quiet tracks off the center line.
        const baseBarHeight = Math.min(normalizedPeak * displayScale, 1) * canvasHeight * 0.8;
        const baseY = middleY - baseBarHeight / 2;
        const x = i * barWidth;

        // Draw base waveform (subtle)
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = colours.base;
        ctx.fillRect(x, baseY, Math.max(barWidth, 1), baseBarHeight);

        // Calculate bar height after volume multiplication (display-scaled)
        const amplifiedPeak = Math.min(normalizedPeak * volumeMultiplier * displayScale, 1); // Clamp to 1
        const amplifiedBarHeight = amplifiedPeak * canvasHeight * 0.8;
        const amplifiedY = middleY - amplifiedBarHeight / 2;

        // Convert this bar's amplitude to dB for color selection
        const linearAmplitude = normalizedPeak * volumeMultiplier;
        const barDB = linearAmplitude <= 0 ? -60 : 20 * Math.log10(linearAmplitude);

        // Draw colored bar with opacity based on whether it's clipping
        ctx.globalAlpha = linearAmplitude > 1 ? 0.8 : 0.5; // More opaque if clipping
        ctx.fillStyle = getColorForDB(barDB);
        ctx.fillRect(x, amplifiedY, Math.max(barWidth, 1), amplifiedBarHeight);
      });
      ctx.globalAlpha = 1;

      // Draw perceived loudness line (RMS level)
      const perceivedLoudness = calculatePerceivedLoudness(visiblePeaksArray);

      // Convert perceived loudness (dB) back to linear for display height
      const rmsLinear = perceivedLoudness <= -60 ? 0 : Math.pow(10, perceivedLoudness / 20);
      const rmsAmplified = rmsLinear * volumeMultiplier;
      const rmsHeight = Math.min(rmsAmplified * displayScale, 1) * canvasHeight * 0.8;

      // Draw dashed horizontal lines at RMS level (on both sides of center)
      ctx.strokeStyle = colours.rms;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);

      const topY = middleY - rmsHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, topY);
      ctx.lineTo(canvasWidth.value, topY);
      ctx.stroke();

      const bottomY = middleY + rmsHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, bottomY);
      ctx.lineTo(canvasWidth.value, bottomY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  } else {
    // Draw "No Waveform Data" message
    ctx.font = '14px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillStyle = colours.label;
    ctx.textAlign = 'center';
    ctx.fillText(t('drawer.noWaveform'), canvasWidth.value / 2, middleY);
    ctx.textAlign = 'left';
  }

  // Draw center line
  ctx.strokeStyle = colours.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, middleY);
  ctx.lineTo(canvasWidth.value, middleY);
  ctx.stroke();

  // Draw fade regions if configured (whether or not the cue is playing)
  if (duration.value > 0) {
    // Play Fade (fade in at start) - danger colour with diagonal line
    if (props.audioItem.playFade && props.audioItem.playFade > 0) {
      const fadeStartTime = inPoint.value;
      const fadeEndTime = inPoint.value + props.audioItem.playFade;

      // Only draw if visible in current view
      if (fadeEndTime >= visibleStart.value && fadeStartTime <= visibleEnd.value) {
        const fadeStartX = Math.max(0, (fadeStartTime - visibleStart.value) * pixelsPerSecond);
        const fadeEndX = Math.min(canvasWidth.value, (fadeEndTime - visibleStart.value) * pixelsPerSecond);
        const fadeWidth = fadeEndX - fadeStartX;

        if (fadeWidth > 0) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = colours.fade;
          ctx.fillRect(fadeStartX, 0, fadeWidth, canvasHeight);

          // Draw diagonal line from bottom-left to top-right (fade in)
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = colours.fade;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fadeStartX, canvasHeight);
          ctx.lineTo(fadeEndX, 0);
          ctx.stroke();

          // Vertical line at fade end boundary
          ctx.beginPath();
          ctx.moveTo(fadeEndX, 0);
          ctx.lineTo(fadeEndX, canvasHeight);
          ctx.stroke();
        }
      }
    }

    // Stop Fade (fade out before end) - danger colour with diagonal line
    if (props.audioItem.stopFade && props.audioItem.stopFade > 0) {
      const fadeStartTime = outPoint.value - props.audioItem.stopFade;
      const fadeEndTime = outPoint.value;

      // Only draw if visible in current view
      if (fadeStartTime <= visibleEnd.value && fadeEndTime >= visibleStart.value) {
        const fadeStartX = Math.max(0, (fadeStartTime - visibleStart.value) * pixelsPerSecond);
        const fadeEndX = Math.min(canvasWidth.value, (fadeEndTime - visibleStart.value) * pixelsPerSecond);
        const fadeWidth = fadeEndX - fadeStartX;

        if (fadeWidth > 0) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = colours.fade;
          ctx.fillRect(fadeStartX, 0, fadeWidth, canvasHeight);

          // Draw diagonal line from top-left to bottom-right (fade out)
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = colours.fade;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fadeStartX, 0);
          ctx.lineTo(fadeEndX, canvasHeight);
          ctx.stroke();

          // Vertical line at fade start boundary
          ctx.beginPath();
          ctx.moveTo(fadeStartX, 0);
          ctx.lineTo(fadeStartX, canvasHeight);
          ctx.stroke();
        }
      }
    }

    // Cross Fade visualization - warning colour X with a tinted rectangle
    if (props.audioItem.crossFade && props.audioItem.crossFade > 0) {
      const crossFadeStartTime = outPoint.value - props.audioItem.crossFade;
      const crossFadeEndTime = outPoint.value;

      // Only draw if visible in current view
      if (crossFadeStartTime <= visibleEnd.value && crossFadeEndTime >= visibleStart.value) {
        const crossStartX = Math.max(0, (crossFadeStartTime - visibleStart.value) * pixelsPerSecond);
        const crossEndX = Math.min(canvasWidth.value, (crossFadeEndTime - visibleStart.value) * pixelsPerSecond);
        const crossWidth = crossEndX - crossStartX;

        if (crossWidth > 0) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = colours.crossFade;
          ctx.fillRect(crossStartX, 0, crossWidth, canvasHeight);

          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = colours.crossFade;
          ctx.lineWidth = 2;

          // Diagonal line from top-left to bottom-right
          ctx.beginPath();
          ctx.moveTo(crossStartX, 0);
          ctx.lineTo(crossEndX, canvasHeight);
          ctx.stroke();

          // Diagonal line from bottom-left to top-right
          ctx.beginPath();
          ctx.moveTo(crossStartX, canvasHeight);
          ctx.lineTo(crossEndX, 0);
          ctx.stroke();

          // Draw vertical lines at boundaries
          ctx.beginPath();
          ctx.moveTo(crossStartX, 0);
          ctx.lineTo(crossStartX, canvasHeight);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(crossEndX, 0);
          ctx.lineTo(crossEndX, canvasHeight);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Draw playhead if item is currently playing
  if (playbackPosition.value !== null && duration.value > 0) {
    // Calculate position respecting zoom and scroll
    const relativeTime = playbackPosition.value - visibleStart.value;
    const playheadX = (relativeTime / visibleDuration.value) * canvasWidth.value;

    // Only draw if within visible range
    if (playheadX >= 0 && playheadX <= canvasWidth.value) {
      // Item colour, or the theme accent (read from the tokens: canvas
      // cannot resolve var())
      const itemColor = props.audioItem.color || colours.accent;

      // Draw vertical line
      ctx.strokeStyle = itemColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();

      // Draw triangle at top
      ctx.fillStyle = itemColor;
      ctx.beginPath();
      ctx.moveTo(playheadX, 10);
      ctx.lineTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.closePath();
      ctx.fill();

      // Draw triangle at bottom
      ctx.beginPath();
      ctx.moveTo(playheadX, canvasHeight - 10);
      ctx.lineTo(playheadX - 6, canvasHeight);
      ctx.lineTo(playheadX + 6, canvasHeight);
      ctx.closePath();
      ctx.fill();
    }
  }
};

// Throttle drawWaveform to prevent excessive redraws
let drawTimeout: NodeJS.Timeout | null = null;
const throttledDraw = () => {
  if (drawTimeout) clearTimeout(drawTimeout);
  drawTimeout = setTimeout(() => {
    drawWaveform();
  }, 16); // ~60fps
};

// Watch for changes and redraw
watch([
  zoomLevel, 
  scrollPosition, 
  () => props.audioItem?.volume, 
  () => props.audioItem?.inPoint, 
  () => props.audioItem?.outPoint,
  () => props.audioItem?.playFade,
  () => props.audioItem?.stopFade,
  () => props.audioItem?.crossFade,
  waveformData, 
  playbackPosition
], () => {
  throttledDraw();
});

// Also watch for waveform changes directly (deep watch for reactivity)
watch(() => props.audioItem?.waveform, () => {
  console.log('Waveform changed, redrawing...');
  throttledDraw();
}, { deep: true });

// Watch for canvas width changes
const resizeObserver = ref<ResizeObserver | null>(null);

// Theme switches and a custom accent change attributes on <html>
let themeObserver: MutationObserver | null = null;

onMounted(() => {
  // Set initial container size
  if (waveformContainer.value) {
    containerWidth.value = waveformContainer.value.clientWidth;
    containerHeight.value = waveformContainer.value.clientHeight || containerHeight.value;
  }

  themeObserver = new MutationObserver(() => {
    palette = readPalette();
    throttledDraw();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  
  // Initial draw
  setTimeout(() => {
    drawWaveform();
  }, 100);

  if (waveformContainer.value) {
    resizeObserver.value = new ResizeObserver(() => {
      // Update the reactive container width
      if (waveformContainer.value) {
        containerWidth.value = waveformContainer.value.clientWidth;
        containerHeight.value = waveformContainer.value.clientHeight || containerHeight.value;
      }
      throttledDraw();
    });
    resizeObserver.value.observe(waveformContainer.value);
  }
});

onUnmounted(() => {
  // Clear any pending draw operations
  if (drawTimeout) clearTimeout(drawTimeout);
  themeObserver?.disconnect();
  
  // Clean up resize observer
  if (resizeObserver.value && waveformContainer.value) {
    resizeObserver.value.unobserve(waveformContainer.value);
    resizeObserver.value.disconnect();
  }
});

</script>

<style scoped>
.waveform-trimmer {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  gap: 16px;
}

.mono {
  font-family: var(--font-mono);
}

/* Volume column */
.volume-col {
  width: 56px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 0;
}

.col-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.volume-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 6px;
}

.volume-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.volume-slider::-webkit-slider-runnable-track {
  width: 6px;
  height: 100%;
  margin: 0 auto;
  border-radius: 3px;
  background: linear-gradient(
    to top,
    var(--volume-colour) 0%,
    var(--volume-colour) var(--volume-fill),
    var(--color-control-border) var(--volume-fill),
    var(--color-control-border) 100%
  );
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-left: -5px;
  border-radius: 50%;
  background: var(--color-text-primary);
  box-shadow: 0 0 0 2px var(--volume-colour);
}

.volume-slider:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Marker positions match the slider's thumb travel (8 px inset each end) */
.volume-markers {
  position: relative;
  width: 24px;
  margin: 8px 0;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);

  span {
    position: absolute;
    left: 0;
    transform: translateY(50%);
    line-height: 1;
    white-space: nowrap;
  }
}

.volume-readout {
  font-family: var(--font-mono);
  font-size: var(--font-size-label);
  color: var(--color-text-primary);
  white-space: nowrap;
}

/* Waveform column */
.wave-col {
  flex: 1 1 600px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.waveform-container {
  position: relative;
  flex: 1;
  min-height: 48px;
  border-radius: var(--radius-card);
  background: var(--color-background);
  overflow: hidden;
  cursor: crosshair;
}

.waveform-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Trim Overlays */
.trim-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--color-background) 72%, transparent);
  pointer-events: none;
}

.trim-overlay-left {
  left: 0;
}

.trim-overlay-right {
  right: 0;
  width: auto;
}

/* Trim Handles */
.trim-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  cursor: ew-resize;
  z-index: 2;
  user-select: none;
}

.trim-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-accent);
}

.trim-handle-out .trim-line {
  left: -2px;
}

.trim-grip {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-key);
  background: var(--color-accent);
  color: var(--color-on-accent);
  user-select: none;
}

.trim-handle-in .trim-grip {
  left: 0;
}

.trim-handle-out .trim-grip {
  right: 0;
}

.trim-grip .material-symbols-rounded {
  font-size: 13px;
}

/* Fade Handles */
.fade-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  cursor: ew-resize;
  z-index: 3;
  user-select: none;
}

.fade-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -1px;
  width: 2px;
}

.fade-line-red {
  background: var(--color-danger);
}

.fade-line-yellow {
  background: var(--color-warning);
}

/* Fade grips sit near the top so they never cover the trim grips */
.fade-grip {
  position: absolute;
  top: 26px;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: var(--color-chrome);
  user-select: none;
  transition: transform var(--transition-fast);
}

.fade-handle:hover .fade-grip {
  transform: translate(-50%, -50%) scale(1.15);
}

.fade-grip-red {
  color: var(--color-danger);
}

.fade-grip-yellow {
  color: var(--color-warning);
}

.fade-grip .material-symbols-rounded {
  font-size: 13px;
}

/* Scroll bar: keeps its space so the waveform does not jump on zoom */
.waveform-scrollbar {
  flex: none;
  height: 8px;
  display: flex;
  align-items: center;

  &.hidden {
    visibility: hidden;
  }
}

.scroll-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.scroll-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-control-border);
}

.scroll-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 40px;
  height: 8px;
  margin-top: -2px;
  border-radius: 4px;
  background: var(--color-text-muted);
}

/* Time fields */
.time-fields {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.time-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.stepper {
  height: 28px;
  display: flex;
  align-items: center;
  border: 1px solid var(--color-control-border);
  border-radius: 7px;
  background: var(--color-field);
  overflow: hidden;

  button {
    width: 24px;
    height: 100%;
    border: 0;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;

    &:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-primary);
    }
  }
}

.time-input {
  width: 56px;
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  text-align: center;
  font-family: var(--font-mono);
  font-size: var(--font-size-label);
  outline: none;

  &.wide {
    width: 96px;
  }

  &:focus {
    background: var(--color-accent-tint);
  }

  &[readonly] {
    color: var(--color-text-muted);
    cursor: default;
  }

  &[readonly]:focus {
    background: transparent;
  }
}

/* Zoom and tools column */
.tools-col {
  width: 200px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zoom-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.zoom-slider {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  accent-color: var(--color-accent);
}

.tool-btn {
  height: var(--size-control);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  cursor: pointer;

  &:hover {
    background: var(--color-surface-hover);
  }

  .material-symbols-rounded {
    font-size: 16px;
    color: var(--color-text-secondary);
  }
}
</style>
