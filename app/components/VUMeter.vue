<template>
  <!-- Thin horizontal bar (per-cue meter) -->
  <div v-if="variant === 'bar'" class="vu-meter vu-bar">
    <div class="bar-level" :style="barStyle"></div>
    <div v-if="showPeakHold && peakHold > -60" class="bar-peak" :style="barPeakStyle"></div>
  </div>

  <!-- Row of segments (master mix meter) -->
  <div v-else class="vu-meter vu-segments">
    <div
      v-for="segment in segmentStates"
      :key="segment.index"
      class="segment"
      :style="segment.style"
    ></div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  level: number; // Current level in dB (-60 to 0)
  peakLevel?: number; // Peak level in dB (for peak hold)
  showPeakHold?: boolean; // Show peak hold indicator
  variant?: 'bar' | 'segments';
  segments?: number; // Segment count for the 'segments' variant
}>(), {
  variant: 'bar',
  segments: 24,
});

// Meter zones: red from -6 dB, yellow from -18 dB, green below. Colours are
// the theme's --color-meter-* tokens.
const ZONE_PEAK_DB = -6;
const ZONE_HIGH_DB = -18;

// Convert dB to percentage (0-100) for display
// -60 dB = 0%, 0 dB = 100%
const dbToPercent = (db: number): number => {
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
};

// Get color based on dB level
const getLevelColor = (db: number): string => {
  if (db >= ZONE_PEAK_DB) return 'var(--color-meter-peak)';
  if (db >= ZONE_HIGH_DB) return 'var(--color-meter-high)';
  return 'var(--color-meter-low)';
};

const peakHold = computed(() => props.peakLevel ?? -60);

const barStyle = computed(() => ({
  width: `${dbToPercent(props.level)}%`,
  backgroundColor: getLevelColor(props.level),
}));

const barPeakStyle = computed(() => ({
  left: `${dbToPercent(peakHold.value)}%`,
  backgroundColor: getLevelColor(peakHold.value),
}));

const segmentStates = computed(() => {
  const count = props.segments;
  const levelPercent = dbToPercent(props.level);
  const peakIndex = props.showPeakHold && peakHold.value > -60
    ? Math.min(count - 1, Math.floor((dbToPercent(peakHold.value) / 100) * count))
    : -1;

  return Array.from({ length: count }, (_, index) => {
    // A segment's colour is the zone of its upper edge
    const topDb = -60 + ((index + 1) / count) * 60;
    const lit = levelPercent > (index / count) * 100 || index === peakIndex;
    return {
      index,
      style: { backgroundColor: lit ? getLevelColor(topDb) : 'var(--color-divider)' },
    };
  });
});
</script>

<style scoped lang="scss">
.vu-meter {
  /* Meters always fill left to right, also in RTL languages */
  direction: ltr;
}

.vu-bar {
  position: relative;
  height: 3px;
  border-radius: 2px;
  background-color: var(--color-divider);
  overflow: hidden;
}

.bar-level {
  height: 100%;
  border-radius: 2px;
  transition: width 50ms linear, background-color 100ms ease;
}

.bar-peak {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -2px;
  transition: left 100ms ease-out;
}

.vu-segments {
  display: flex;
  gap: 2px;
}

.segment {
  flex: 1;
  height: 6px;
  border-radius: 1px;
  transition: background-color 50ms linear;
}
</style>
