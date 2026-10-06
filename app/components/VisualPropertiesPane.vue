<template>
  <div v-if="item" class="visual-properties-pane">
    <div class="pane-header">
      <button class="back-btn" :title="t('visuals.backToMedia')" :aria-label="t('visuals.backToMedia')" @click="onClose">
        <span class="material-symbols-rounded">chevron_left</span>
      </button>
      <span class="pane-title">{{ t('visuals.visualProperties') }}</span>
    </div>

    <div class="pane-content">
      <div class="preview">
        <img v-if="item.mediaType === 'image' && previewSrc" :src="previewSrc" :alt="item.displayName" />
        <span v-else-if="item.mediaType !== 'image'" class="material-symbols-rounded">picture_as_pdf</span>
      </div>

      <!-- Display Name -->
      <div class="property-field">
        <label :for="`vp-name-${item.uuid}`">{{ t('visuals.name') }}</label>
        <input
          :id="`vp-name-${item.uuid}`"
          type="text"
          :value="localName"
          @input="localName = ($event.target as HTMLInputElement).value"
          @blur="commitName"
          @keydown.enter="commitName"
        />
      </div>

      <!-- Linked Cue -->
      <div class="property-field">
        <span class="field-label">{{ t('visuals.linkedCue') }}</span>
        <div class="cue-display" :class="{ missing: linkedCueMissing, none: !item.linkedCueUuid }">
          <span
            class="color-dot"
            :style="linkedCueRef ? { backgroundColor: linkedCueRef.color } : undefined"
          ></span>
          <span class="cue-name" :title="linkedCueLabel">{{ linkedCueLabel }}</span>
        </div>
        <div class="cue-actions">
          <button class="btn" @click="showPicker = true">
            {{ item.linkedCueUuid ? t('visuals.changeLink') : t('visuals.link') }}
          </button>
          <button
            v-if="item.linkedCueUuid"
            class="btn quiet"
            @click="clearLink"
          >
            {{ t('visuals.clearLink') }}
          </button>
        </div>
      </div>

      <div class="property-field">
        <div class="slider-head">
          <label :for="`vp-linkDelay-${item.uuid}`">{{ t('visuals.linkDelay') }}</label>
          <span class="num-wrap">
            <input
              :id="`vp-linkDelay-${item.uuid}`"
              type="number"
              min="-30"
              max="30"
              step="0.1"
              :value="linkDelayValue"
              class="num-input"
              @change="onDelayInput($event)"
            />
            <span class="unit">s</span>
          </span>
        </div>
        <input
          type="range"
          min="-30"
          max="30"
          step="0.1"
          :value="linkDelayValue"
          :aria-label="t('visuals.linkDelay')"
          @input="onDelayInput($event)"
        />
        <p class="hint">{{ t('visuals.linkDelayHint') }}</p>
      </div>
      <div class="property-field">
        <div class="slider-head">
          <label :for="`vp-fadeIn-${item.uuid}`">{{ t('visuals.fadeIn') }}</label>
          <span class="num-wrap">
            <input
              :id="`vp-fadeIn-${item.uuid}`"
              type="number"
              min="0"
              max="10"
              step="0.1"
              :value="fadeInValue"
              class="num-input"
              @change="onFadeInInput($event)"
            />
            <span class="unit">s</span>
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          :value="fadeInValue"
          :aria-label="t('visuals.fadeIn')"
          @input="onFadeInInput($event)"
        />
      </div>
      <div class="property-field">
        <div class="slider-head">
          <label :for="`vp-fadeOut-${item.uuid}`">{{ t('visuals.fadeOut') }}</label>
          <span class="num-wrap">
            <input
              :id="`vp-fadeOut-${item.uuid}`"
              type="number"
              min="0"
              max="10"
              step="0.1"
              :value="fadeOutValue"
              class="num-input"
              @change="onFadeOutInput($event)"
            />
            <span class="unit">s</span>
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          :value="fadeOutValue"
          :aria-label="t('visuals.fadeOut')"
          @input="onFadeOutInput($event)"
        />
      </div>
    </div>

    <CuePicker
      v-if="showPicker"
      :current-uuid="item.linkedCueUuid ?? null"
      @select="onPickCue"
      @cancel="showPicker = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { VisualMediaItem } from '~/types/project';

const props = defineProps<{
  item: VisualMediaItem | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useLocalization();
const { updateVisualMedia } = useVisualMedia();
const { currentProject, findItemByUuid } = useProject();

const showPicker = ref(false);
const localName = ref('');

watch(
  () => props.item?.uuid,
  () => {
    localName.value = props.item?.displayName ?? '';
  },
  { immediate: true }
);

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const linkDelayValue = computed(() => props.item?.linkDelay ?? 0);
const fadeInValue = computed(() => props.item?.fadeIn ?? 0);
const fadeOutValue = computed(() => props.item?.fadeOut ?? 0);

const linkedCueRef = computed(() => {
  if (!props.item?.linkedCueUuid) return null;
  return findItemByUuid(props.item.linkedCueUuid);
});

const linkedCueMissing = computed(
  () => !!props.item?.linkedCueUuid && !linkedCueRef.value
);

const linkedCueLabel = computed(() => {
  if (!props.item?.linkedCueUuid) return t('visuals.noLink');
  if (!linkedCueRef.value) return t('visuals.linkDeleted');
  return linkedCueRef.value.displayName;
});

const commitName = () => {
  if (!props.item) return;
  const trimmed = localName.value.trim();
  if (trimmed && trimmed !== props.item.displayName) {
    updateVisualMedia(props.item.uuid, { displayName: trimmed });
  } else {
    localName.value = props.item.displayName;
  }
};

const clearLink = () => {
  if (!props.item) return;
  updateVisualMedia(props.item.uuid, { linkedCueUuid: undefined });
};

const onPickCue = (uuid: string) => {
  if (!props.item) return;
  updateVisualMedia(props.item.uuid, { linkedCueUuid: uuid });
  showPicker.value = false;
};

const onDelayInput = (e: Event) => {
  if (!props.item) return;
  const v = clamp(parseFloat((e.target as HTMLInputElement).value) || 0, -30, 30);
  updateVisualMedia(props.item.uuid, { linkDelay: v });
};

const onFadeInInput = (e: Event) => {
  if (!props.item) return;
  const v = clamp(parseFloat((e.target as HTMLInputElement).value) || 0, 0, 10);
  updateVisualMedia(props.item.uuid, { fadeIn: v });
};

const onFadeOutInput = (e: Event) => {
  if (!props.item) return;
  const v = clamp(parseFloat((e.target as HTMLInputElement).value) || 0, 0, 10);
  updateVisualMedia(props.item.uuid, { fadeOut: v });
};

const onClose = () => emit('close');

// Preview image, read the same way as the library thumbnails
const previewSrc = ref<string | null>(null);

const loadPreview = async () => {
  previewSrc.value = null;
  const item = props.item;
  if (!item || item.mediaType !== 'image' || !currentProject.value || !import.meta.client || !window.electronAPI) return;
  try {
    const result = await (window.electronAPI as any).readVisualMedia(
      currentProject.value.folderPath,
      item.mediaPath
    );
    if (result.success && result.data && props.item?.uuid === item.uuid) {
      previewSrc.value = `data:${result.mimeType};base64,${result.data}`;
    }
  } catch (e) {
    console.warn('Failed to load preview for', item.displayName, e);
  }
};

watch(() => [props.item?.uuid, props.item?.mediaPath], loadPreview, { immediate: true });
</script>

<style scoped lang="scss">
.visual-properties-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.back-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 7px;
  background-color: var(--color-field);
  color: var(--color-text-secondary);
  cursor: pointer;

  .material-symbols-rounded { font-size: 18px; }

  &:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-hover);
  }
}

.pane-title {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-emphasis);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.pane-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview {
  height: 120px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  background-color: var(--color-field);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .material-symbols-rounded {
    font-size: 40px;
    color: var(--color-text-muted);
  }
}

.property-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label,
  .field-label {
    font-size: var(--font-size-label);
    color: var(--color-text-muted);
  }

  input[type='text'],
  input[type='number'] {
    height: var(--size-control);
    box-sizing: border-box;
    padding: 0 10px;
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-control);
    background-color: var(--color-field);
    color: var(--color-text-primary);
    font: inherit;
    outline: none;

    &:focus { border-color: var(--color-accent); }
  }

  input[type='range'] {
    width: 100%;
    margin: 0;
    accent-color: var(--color-accent);
  }
}

.slider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.num-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-label);
}

.property-field .num-input {
  width: 64px;
  height: 26px;
  padding: 0 6px;
  font-family: var(--font-mono);
  font-size: var(--font-size-label);
  text-align: right;
}

.cue-display {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-radius: var(--radius-control);
  background-color: var(--color-field);
  color: var(--color-text-primary);
  overflow: hidden;

  .color-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: var(--radius-pill);
    background-color: var(--color-text-muted);
  }

  .cue-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.none {
    color: var(--color-text-muted);
  }

  &.missing {
    color: var(--color-danger-text);

    .color-dot { background-color: var(--color-danger); }
  }
}

.cue-actions {
  display: flex;
  gap: 8px;
}

.btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-control-border);
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--font-size-label);
  cursor: pointer;

  &:hover { background-color: var(--color-surface-hover); }

  &.quiet {
    border-color: transparent;
    color: var(--color-text-secondary);
  }
}

.hint {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
