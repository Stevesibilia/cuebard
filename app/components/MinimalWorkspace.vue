<template>
  <div class="minimal-workspace">
    <!-- Active Cues -->
    <div class="minimal-cues">
      <div v-if="activeCues.size === 0" class="no-cues">{{ t('playback.noActiveCues') }}</div>
      <div v-else class="cue-list">
        <div
          v-for="[uuid, cue] in Array.from(activeCues.entries())"
          :key="uuid"
          class="mini-cue"
          :class="{ paused: cue.isPaused }"
        >
          <span class="cue-name">{{ cue.displayName }}</span>
          <span class="cue-time">{{ formatTime(cue.currentTime) }} / {{ formatTime(cue.duration) }}</span>
          <div class="cue-actions">
            <button v-if="!cue.isPaused" class="mini-btn" @click="pauseCue(uuid)" :title="t('actions.pause')" :aria-label="t('actions.pause')">
              <span class="material-symbols-rounded">pause</span>
            </button>
            <button v-else class="mini-btn" @click="resumeCue(uuid)" :title="t('actions.resume')" :aria-label="t('actions.resume')">
              <span class="material-symbols-rounded">play_arrow</span>
            </button>
            <button class="mini-btn stop" @click="stopCue(uuid)" :title="t('actions.stop')" :aria-label="t('actions.stop')">
              <span class="material-symbols-rounded">stop</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact Cart Grid -->
    <div class="minimal-cart">
      <div
        v-for="slot in CART_SLOT_COUNT"
        :key="slot"
        class="mini-slot"
        :class="{ empty: !getCartItem(slot - 1), playing: isSlotPlaying(slot - 1) }"
        @click="triggerSlot(slot - 1)"
      >
        <span v-if="getKeyLabel(slot - 1)" class="slot-hotkey">{{ getKeyLabel(slot - 1) }}</span>
        <span class="slot-name" :class="{ marquee: isOverflowing(slot - 1) }">
          <span class="slot-name-inner">{{ getSlotName(slot - 1) }}</span>
        </span>
      </div>
    </div>

    <!-- Master Volume + Expand -->
    <div class="minimal-footer">
      <span class="master-label">{{ t('minimal.out') }}</span>
      <input
        type="range"
        class="master-slider"
        :min="-60"
        :max="0"
        step="0.5"
        :value="masterGainDb"
        :aria-label="t('controls.actions.masterVolume')"
        @input="handleVolumeChange"
      />
      <span class="master-db">{{ masterGainDb <= -60 ? '-∞' : masterGainDb.toFixed(0) }} dB</span>
      <button class="expand-btn" @click="$emit('exit-minimal')" :title="t('minimal.exit')" :aria-label="t('minimal.exit')">
        <span class="material-symbols-rounded">open_in_full</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatKeyLabel } from '~/composables/useCartHotkeys';
import { CART_SLOT_COUNT } from '~/utils/cart';

const emit = defineEmits<{ 'exit-minimal': [] }>();

const { currentProject } = useProject();
const { activeCues, pauseCue, resumeCue, stopCue, masterGainDb, setMasterGain } = useAudioEngine();
const { getCartItem } = useCartItems();
const { keyMappings, triggerSlot } = useCartHotkeys();
const { t } = useLocalization();

const getKeyLabel = (slotIndex: number): string => {
  const binding = keyMappings.value[slotIndex];
  return binding ? formatKeyLabel(binding) : '';
};

const getSlotName = (slotIndex: number): string => {
  const item = getCartItem(slotIndex);
  return item ? item.displayName : '';
};

const isSlotPlaying = (slotIndex: number): boolean => {
  const item = getCartItem(slotIndex);
  return item ? activeCues.value.has(item.uuid) : false;
};

const isOverflowing = (_slotIndex: number): boolean => {
  // Approximation: names longer than 8 chars will likely overflow in the compact grid
  const name = getSlotName(_slotIndex);
  return name.length > 8;
};

const handleVolumeChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  setMasterGain(parseFloat(target.value));
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.minimal-workspace {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  color: var(--color-text-primary);
  overflow: hidden;
  font-size: var(--font-size-label);
}

/* Active Cues */
.minimal-cues {
  flex: 0 1 auto;
  max-height: 40%;
  overflow-y: auto;
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-chrome);
  padding: 6px;
}

.no-cues {
  color: var(--color-text-muted);
  text-align: center;
  padding: 8px;
}

.mini-cue {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 4px 0 8px;
  border-radius: var(--radius-control);
  background: var(--color-field);
  box-shadow: inset 3px 0 0 var(--color-accent);
  margin-bottom: 4px;
}

.mini-cue:last-child {
  margin-bottom: 0;
}

.mini-cue.paused {
  box-shadow: inset 3px 0 0 var(--color-warning);
}

.mini-cue .cue-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: var(--color-text-primary);
}

.mini-cue .cue-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.mini-cue.paused .cue-time {
  color: var(--color-warning-text);
}

.cue-actions {
  display: flex;
  gap: 2px;
}

.mini-btn {
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  border-radius: var(--radius-key);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.mini-btn.stop:hover {
  color: var(--color-danger-text);
}

.mini-btn .material-symbols-rounded {
  font-size: 16px;
}

/* Cart Grid */
.minimal-cart {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  grid-auto-rows: minmax(40px, 1fr);
  gap: 4px;
  padding: 6px;
  background: var(--color-panel);
  overflow: hidden;
}

.mini-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px;
  border-radius: var(--radius-control);
  background: var(--color-field);
  border: 1px solid var(--color-divider);
  cursor: pointer;
  min-height: 40px;
  overflow: hidden;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.mini-slot:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-accent);
}

.mini-slot.playing {
  background: var(--color-accent-tint);
  border-color: var(--color-accent);
}

.mini-slot.playing .slot-name {
  color: var(--color-accent);
}

.mini-slot.empty {
  background: transparent;
  border-style: dashed;
  border-color: var(--color-control-border);
  opacity: 0.6;
  cursor: default;
}

.slot-hotkey {
  min-width: 14px;
  padding: 0 4px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-key);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  color: var(--color-text-secondary);
}

.slot-name {
  width: 100%;
  overflow: hidden;
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.slot-name.marquee .slot-name-inner {
  display: inline-block;
  animation: marquee 6s linear infinite;
  padding-left: 100%;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}

/* Master Footer */
.minimal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 8px 0 10px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-chrome);
}

.master-label {
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.master-slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
  accent-color: var(--color-accent);
}

.master-db {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 48px;
  text-align: right;
}

.expand-btn {
  width: 26px;
  height: 26px;
  background: none;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.expand-btn .material-symbols-rounded {
  font-size: 16px;
}
</style>
