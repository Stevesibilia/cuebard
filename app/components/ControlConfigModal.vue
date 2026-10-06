<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog control-config-panel" role="dialog" aria-modal="true" :aria-label="t('cartUi.keysAndMidi')">
      <div class="dialog-header">
        <div class="header-left">
          <h3>{{ t('cartUi.keysAndMidi') }}</h3>
          <span v-if="activeTab === 'midi' && connectedDevices.length > 0" class="device-info">
            {{ connectedDevices.join(', ') }}
          </span>
          <span v-else-if="activeTab === 'midi'" class="device-info no-device">{{ t('midi.noDevices') }}</span>
        </div>
        <button class="icon-btn" :title="t('cart.close')" :aria-label="t('cart.close')" @click="$emit('close')">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="tab-bar">
        <div class="tab-switch" role="tablist">
        <button
          class="tab-btn"
          role="tab"
          :aria-selected="activeTab === 'keyboard'"
          :class="{ active: activeTab === 'keyboard' }"
          @click="activeTab = 'keyboard'"
        >
          <span class="material-symbols-rounded">keyboard</span> {{ t('cart.tabKeyboard') }}
        </button>
        <button
          class="tab-btn"
          role="tab"
          :aria-selected="activeTab === 'midi'"
          :class="{ active: activeTab === 'midi' }"
          @click="activeTab = 'midi'"
        >
          <span class="material-symbols-rounded">piano</span> {{ t('cart.tabMidi') }}
        </button>
        </div>
      </div>

      <!-- Keyboard tab -->
      <div v-if="activeTab === 'keyboard'" class="config-body">
        <div class="category-header">{{ controlCategoryLabel(t, 'Cart Slots') }}</div>
        <!-- Cart slot rows -->
        <div
          v-for="slot in CART_SLOT_COUNT"
          :key="slot"
          class="action-row key-slot-row"
          :class="{ capturing: capturingSlot === slot - 1, conflict: conflictSlot === slot - 1 }"
          @click="startCapture(slot - 1)"
        >
          <span class="action-label">{{ t('controls.cartSlot', { slot }) }}</span>
          <span class="action-binding" :class="{ 'is-default': capturingSlot !== slot - 1 && isDefaultKey(slot - 1) }">
            <template v-if="capturingSlot === slot - 1">
              {{ t('cart.pressAnyKey') }}
            </template>
            <template v-else>
              {{ getKeyLabel(slot - 1) }}
            </template>
          </span>
          <span v-if="keyErrorMessage && keyErrorSlot === slot - 1" class="error-msg">{{ keyErrorMessage }}</span>
        </div>
        <!-- Global shortcut sections (remappable) -->
        <template v-for="category in globalCategories" :key="category">
          <div class="category-header">{{ controlCategoryLabel(t, category) }}</div>
          <div
            v-for="action in globalActionsByCategory(category)"
            :key="action.id"
            class="action-row key-slot-row"
            :class="{ capturing: capturingGlobal === action.id, conflict: globalErrorAction === action.id && !!globalKeyErrorMessage }"
            @click="startGlobalCapture(action.id)"
          >
            <span class="action-label">{{ controlActionLabel(t, action.id) }}</span>
            <span class="action-binding" :class="{ 'is-default': capturingGlobal !== action.id && isDefaultGlobalKey(action.id) }">
              <template v-if="capturingGlobal === action.id">
                {{ t('cart.pressAnyKey') }}
              </template>
              <template v-else>
                {{ getGlobalKeyLabel(action.id) }}
              </template>
            </span>
            <span v-if="globalKeyErrorMessage && globalErrorAction === action.id" class="error-msg">{{ globalKeyErrorMessage }}</span>
          </div>
        </template>
      </div>

      <!-- MIDI tab -->
      <div v-if="activeTab === 'midi'" class="config-body">
        <template v-for="category in midiCategories" :key="category">
          <div class="category-header">{{ controlCategoryLabel(t, category) }}</div>
          <div
            v-for="action in midiActionsByCategory(category)"
            :key="action.id"
            class="action-row"
            :class="{ learning: learning === action.id }"
          >
            <span class="action-label">{{ controlActionLabel(t, action.id) }}</span>
            <span class="action-binding">
              <template v-if="learning === action.id">
                {{ t('midi.waitingForInput') }}
              </template>
              <template v-else-if="getMidiBinding(action.id)">
                {{ formatMidiBindingLabel(action.id) }}
              </template>
              <template v-else>
                —
              </template>
            </span>
            <div class="action-buttons">
              <button
                class="btn small learn-btn"
                :class="{ active: learning === action.id }"
                @click="toggleLearn(action.id)"
              >
                {{ learning === action.id ? t('midi.cancel') : t('midi.learn') }}
              </button>
              <button
                v-if="getMidiBinding(action.id)"
                class="btn small"
                @click="handleMidiClear(action.id)"
              >
                {{ t('midi.clear') }}
              </button>
            </div>
          </div>
        </template>
      </div>

      <div class="dialog-footer config-footer">
        <button class="btn" @click="handleReset">
          {{ activeTab === 'keyboard' ? t('cart.resetDefaults') : t('midi.resetAll') }}
        </button>
        <button class="btn primary" @click="$emit('close')">{{ t('cart.close') }}</button>
      </div>

      <!-- MIDI Conflict dialog -->
      <div v-if="midiConflictInfo" class="conflict-overlay" @click.self="midiConflictInfo = null">
        <div class="conflict-dialog">
          <p>{{ midiConflictMessage }}</p>
          <div class="conflict-buttons">
            <button class="btn" @click="midiConflictInfo = null">{{ t('midi.cancel') }}</button>
            <button class="btn primary" @click="resolveMidiConflict">{{ t('midi.reassignConfirm') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  formatKeyLabel,
  eventToBinding,
  globalEventToBinding,
  isReservedCombo,
  bindingsMatch,
  GLOBAL_ACTIONS,
} from '~/composables/useCartHotkeys';
import { DEFAULT_CART_SLOT_KEYS, type GlobalActionId } from '~/types/project';
import {
  MIDI_ACTIONS,
  formatMidiBinding,
  type MidiBinding,
  type MidiActionId,
} from '~/composables/useMidiController';
import { CART_SLOT_COUNT } from '~/utils/cart';

const emit = defineEmits<{
  close: [];
}>();

const { t } = useLocalization();

// Keyboard state
const { keyMappings, globalKeyMappings, updateBinding: updateKeyBinding, updateGlobalBinding, resetToDefaults } = useCartHotkeys();
const { currentProject, saveProject } = useProject();
const capturingSlot = ref<number | null>(null);
const keyErrorMessage = ref<string | null>(null);
const keyErrorSlot = ref<number | null>(null);
const conflictSlot = ref<number | null>(null);

// MIDI state
const {
  config: midiConfig,
  connectedDevices,
  learning,
  startLearn,
  stopLearn,
  updateBinding: updateMidiBinding,
  clearBinding: clearMidiBinding,
  clearAllBindings,
} = useMidiController();

const midiConflictInfo = ref<{ actionId: MidiActionId; binding: MidiBinding; conflictAction: string } | null>(null);

const activeTab = ref<'keyboard' | 'midi'>('keyboard');

// --- Global shortcuts (remappable) ---

const capturingGlobal = ref<GlobalActionId | null>(null);
const globalKeyErrorMessage = ref<string | null>(null);
const globalErrorAction = ref<GlobalActionId | null>(null);

const globalCategories = computed(() => {
  const cats: string[] = [];
  for (const action of GLOBAL_ACTIONS) {
    if (!cats.includes(action.category)) cats.push(action.category);
  }
  return cats;
});

const globalActionsByCategory = (category: string) =>
  GLOBAL_ACTIONS.filter(a => a.category === category);

const isDefaultGlobalKey = (actionId: GlobalActionId): boolean =>
  !currentProject.value?.globalKeyBindings?.[actionId];

const getGlobalKeyLabel = (actionId: GlobalActionId): string => {
  const binding = globalKeyMappings.value[actionId];
  return binding ? formatKeyLabel(binding) : '—';
};

const startGlobalCapture = (actionId: GlobalActionId) => {
  capturingGlobal.value = actionId;
  globalKeyErrorMessage.value = null;
  globalErrorAction.value = null;
  capturingSlot.value = null;
};

// --- Keyboard helpers ---

const isDefaultKey = (slotIndex: number): boolean => {
  return !currentProject.value?.cartSlotKeys?.[slotIndex];
};

const getKeyLabel = (slotIndex: number): string => {
  const binding = keyMappings.value[slotIndex];
  if (binding) return formatKeyLabel(binding);
  const def = DEFAULT_CART_SLOT_KEYS[slotIndex];
  return def ? formatKeyLabel(def) : '—';
};

const startCapture = (slotIndex: number) => {
  capturingSlot.value = slotIndex;
  keyErrorMessage.value = null;
  keyErrorSlot.value = null;
  conflictSlot.value = null;
  capturingGlobal.value = null;
};

const handleKeydown = (e: KeyboardEvent) => {
  // Escape handling (works for both tabs)
  if (e.key === 'Escape') {
    if (activeTab.value === 'keyboard' && capturingSlot.value !== null) {
      capturingSlot.value = null;
      keyErrorMessage.value = null;
      keyErrorSlot.value = null;
      e.preventDefault();
      return;
    }
    if (activeTab.value === 'keyboard' && capturingGlobal.value !== null) {
      capturingGlobal.value = null;
      globalKeyErrorMessage.value = null;
      globalErrorAction.value = null;
      e.preventDefault();
      return;
    }
    if (activeTab.value === 'midi' && learning.value) {
      stopLearn();
      e.preventDefault();
      return;
    }
    emit('close');
    return;
  }

  if (activeTab.value !== 'keyboard') return;
  if (['Control', 'Alt', 'Meta'].includes(e.key)) return;

  // Global action capture
  if (capturingGlobal.value !== null) {
    // Allow Shift alone (for Right Shift binding), but skip other modifier-only keys
    if (e.key === 'Shift' && e.location !== KeyboardEvent.DOM_KEY_LOCATION_RIGHT) return;

    e.preventDefault();
    e.stopPropagation();

    const binding = globalEventToBinding(e);
    const capturingId = capturingGlobal.value;

    // Check conflict with other global actions
    for (const action of GLOBAL_ACTIONS) {
      if (action.id === capturingId) continue;
      const existing = globalKeyMappings.value[action.id];
      if (existing && bindingsMatch(existing, binding)) {
        globalKeyErrorMessage.value = t('cart.conflictAction', { action: controlActionLabel(t, action.id) });
        globalErrorAction.value = capturingId;
        return;
      }
    }

    // Check conflict with cart slots
    for (const [slotStr, slotBinding] of Object.entries(keyMappings.value)) {
      if (bindingsMatch(slotBinding, binding)) {
        const slotNum = parseInt(slotStr, 10) + 1;
        globalKeyErrorMessage.value = t('cart.conflictAction', { action: t('controls.cartSlot', { slot: slotNum }) });
        globalErrorAction.value = capturingId;
        return;
      }
    }

    updateGlobalBinding(capturingId, binding);
    globalKeyErrorMessage.value = null;
    globalErrorAction.value = null;
    capturingGlobal.value = null;
    saveProject();
    return;
  }

  // Cart slot capture
  if (capturingSlot.value === null) return;
  if (e.key === 'Shift') return;

  e.preventDefault();
  e.stopPropagation();

  const binding = eventToBinding(e);

  if (isReservedCombo(binding)) {
    keyErrorMessage.value = t('cart.reserved');
    keyErrorSlot.value = capturingSlot.value;
    return;
  }

  // Check conflict with global actions
  for (const action of GLOBAL_ACTIONS) {
    const existing = globalKeyMappings.value[action.id];
    if (existing && bindingsMatch(existing, binding)) {
      keyErrorMessage.value = t('cart.conflictAction', { action: controlActionLabel(t, action.id) });
      keyErrorSlot.value = capturingSlot.value;
      return;
    }
  }

  const result = updateKeyBinding(capturingSlot.value, binding);
  if (result.conflict >= 0) {
    keyErrorMessage.value = t('cart.conflict', { slot: result.conflict + 1 });
    keyErrorSlot.value = capturingSlot.value;
    conflictSlot.value = result.conflict;
    return;
  }

  keyErrorMessage.value = null;
  keyErrorSlot.value = null;
  conflictSlot.value = null;
  capturingSlot.value = null;
  saveProject();
};

// --- MIDI helpers ---

const midiCategories = computed(() => {
  const cats: string[] = [];
  for (const action of MIDI_ACTIONS) {
    if (!cats.includes(action.category)) cats.push(action.category);
  }
  return cats;
});

const midiActionsByCategory = (category: string) => {
  return MIDI_ACTIONS.filter(a => a.category === category);
};

const getMidiBinding = (actionId: string): MidiBinding | undefined => {
  return midiConfig.value.bindings[actionId];
};

const formatMidiBindingLabel = (actionId: string): string => {
  const binding = midiConfig.value.bindings[actionId];
  return binding ? formatMidiBinding(binding) : '';
};

const midiConflictMessage = computed(() => {
  if (!midiConflictInfo.value) return '';
  return t('midi.reassign', { action: controlActionLabel(t, midiConflictInfo.value.conflictAction) });
});

const toggleLearn = (actionId: MidiActionId) => {
  if (learning.value === actionId) {
    stopLearn();
    return;
  }
  startLearn(actionId, (binding: MidiBinding) => {
    stopLearn();
    const result = updateMidiBinding(actionId, binding);
    if (result.conflict) {
      midiConflictInfo.value = { actionId, binding, conflictAction: result.conflict };
    }
  });
};

const resolveMidiConflict = () => {
  if (!midiConflictInfo.value) return;
  const { actionId, binding, conflictAction } = midiConflictInfo.value;
  clearMidiBinding(conflictAction as MidiActionId);
  updateMidiBinding(actionId, binding);
  midiConflictInfo.value = null;
};

const handleMidiClear = (actionId: MidiActionId) => {
  clearMidiBinding(actionId);
};

// --- Shared ---

const handleReset = () => {
  if (activeTab.value === 'keyboard') {
    resetToDefaults();
    saveProject();
  } else {
    clearAllBindings();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true);
  if (learning.value) stopLearn();
});
</script>

<style scoped lang="scss">
@use '~/assets/styles/dialog' as dialog;
@include dialog.base;

.dialog-overlay {
  z-index: 1000;
}

.control-config-panel {
  width: 560px;
  max-height: 80vh;
  position: relative;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.device-info {
  font-size: var(--font-size-label);
  color: var(--color-success);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-info.no-device {
  color: var(--color-text-muted);
}

.tab-bar {
  flex: none;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-divider);
}

.tab-switch {
  display: inline-flex;
  padding: 3px;
  border-radius: 9px;
  background-color: var(--color-field);
}

.tab-btn {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
  transition: color var(--transition-fast), background-color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 17px;
  }

  &:hover {
    color: var(--color-text-primary);
  }

  &.active {
    background-color: var(--color-control-border);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-emphasis);
  }
}

/* Body */
.config-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
}

.category-header {
  padding: 12px 8px 6px;
  font-size: var(--font-size-label);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.action-row {
  min-height: var(--size-control-lg);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 2px 8px;
  border-radius: var(--radius-control);
  transition: background-color var(--transition-fast);
}

.action-row:hover {
  background: var(--color-surface-hover);
}

.key-slot-row {
  cursor: pointer;
}

.key-slot-row.capturing,
.action-row.learning {
  background: var(--color-accent-tint);
  outline: 1.5px solid var(--color-accent);
  outline-offset: -1.5px;
}

.key-slot-row.conflict {
  background: var(--color-danger-tint);
  outline: 1.5px solid var(--color-danger);
  outline-offset: -1.5px;
}

.action-label {
  flex: 1;
  min-width: 0;
  color: var(--color-text-primary);
}

.action-binding {
  min-width: 28px;
  padding: 2px 8px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-key);
  background: var(--color-field);
  font-family: var(--font-mono);
  font-size: var(--font-size-label);
  font-weight: 500;
  text-align: center;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.capturing .action-binding,
.learning .action-binding {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.action-binding.is-default {
  color: var(--color-text-muted);
  border-style: dashed;
}

.error-msg {
  flex-basis: 100%;
  padding-bottom: 4px;
  font-size: var(--font-size-label);
  color: var(--color-danger-text);
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.btn.small {
  height: 26px;
  padding: 0 10px;
  font-size: var(--font-size-label);
}

.learn-btn.active {
  border-color: var(--color-accent);
  background-color: var(--color-accent);
  color: var(--color-on-accent);
}

.config-footer {
  justify-content: space-between;
}

/* MIDI reassign dialog, inside the panel */
.conflict-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-background) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-card);
}

.conflict-dialog {
  max-width: 320px;
  padding: 16px;
  background: var(--color-chrome);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);

  p {
    margin: 0 0 16px;
    color: var(--color-text-primary);
    line-height: 1.5;
  }
}

.conflict-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
