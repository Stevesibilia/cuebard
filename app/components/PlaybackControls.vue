<template>
  <section class="playback-controls" :aria-label="t('strip.nowPlaying')">
    <button class="stop-all-btn" @click="handlePanic" :disabled="activeCues.size === 0">
      <span class="stop-all-label">{{ t('strip.stopAll') }}</span>
      <span class="stop-all-hint">{{ t('strip.stopAllHint') }}</span>
    </button>

    <div class="active-cues">
      <div v-if="activeCues.size === 0" class="no-cues">
        {{ t('playback.noActiveCues') }}
      </div>

      <template v-else>
        <ActiveCueItem
          v-for="[uuid, cue] in Array.from(activeCues.entries())"
          :key="uuid"
          :cue="cue"
        />
      </template>
    </div>

    <!-- Master: output volume and the MIX meter -->
    <div class="master-section">
      <div class="master-header">
        <span class="master-label">{{ t('strip.master') }}</span>
        <span class="master-db-value">{{ masterGainDb <= -60 ? '-∞' : masterGainDb.toFixed(1) }} dB</span>
      </div>

      <input
        type="range"
        class="master-volume-slider"
        :min="-60"
        :max="0"
        step="0.1"
        :value="masterGainDb"
        @input="handleMasterVolumeChange"
        :aria-label="t('strip.masterVolume')"
        :title="`${masterGainDb <= -60 ? '-∞' : masterGainDb.toFixed(1)} dB`"
        :style="masterSliderStyle"
      />

      <!-- MIX meter, only while something plays -->
      <div class="master-meter" :title="t('strip.mixLevel')">
        <VUMeter
          v-if="activeCues.size > 0"
          variant="segments"
          :segments="24"
          :level="masterOutputLevel"
          :peakLevel="masterPeakLevel"
          :showPeakHold="true"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { activeCues, panicStop, masterOutputLevel, masterPeakLevel, masterGainDb, setMasterGain } = useAudioEngine();
const { t } = useLocalization();

const handlePanic = () => {
  panicStop();
};

const handleMasterVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  setMasterGain(parseFloat(target.value));
};

const masterVolumeHandleColor = computed(() => {
  const db = masterGainDb.value;
  if (db <= -60) return 'var(--color-text-disabled)';
  if (db < -6) return 'var(--color-meter-low)';
  if (db < -1) return 'var(--color-meter-high)';
  return 'var(--color-meter-peak)';
});

const masterSliderStyle = computed(() => ({
  '--volume-handle-color': masterVolumeHandleColor.value,
  '--volume-fill': `${((masterGainDb.value + 60) / 60) * 100}%`,
}));
</script>

<style scoped>
.playback-controls {
  height: var(--size-strip);
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-divider);
  background-color: var(--color-background);
}

.stop-all-btn {
  width: 112px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1.5px solid var(--color-danger);
  border-radius: var(--radius-card);
  background-color: var(--color-danger-tint);
  color: var(--color-danger-text);
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);

  &:hover:not(:disabled) {
    background-color: color-mix(in srgb, var(--color-danger) 22%, transparent);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.stop-all-label {
  font-size: 14px;
  font-weight: 600;
}

.stop-all-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.active-cues {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
}

.no-cues {
  align-self: center;
  padding: 0 4px;
  color: var(--color-text-muted);
  font-style: italic;
}

.master-section {
  width: 168px;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.master-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.master-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.master-db-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.master-meter {
  height: 6px;
}

.master-volume-slider {
  width: 100%;
  height: 16px;
  margin: 0;
  padding: 0;
  border: 0;
  /* Fills left to right, also in RTL languages */
  direction: ltr;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}

.master-volume-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--color-accent) var(--volume-fill),
    var(--color-control-border) var(--volume-fill)
  );
}

.master-volume-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--color-accent) var(--volume-fill),
    var(--color-control-border) var(--volume-fill)
  );
}

.master-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -5px; /* center the 16px knob on the 6px track */
  border: 2px solid var(--color-background);
  border-radius: 50%;
  background: var(--volume-handle-color, var(--color-text-secondary));
  cursor: pointer;
}

.master-volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-background);
  border-radius: 50%;
  background: var(--volume-handle-color, var(--color-text-secondary));
  cursor: pointer;
}
</style>
