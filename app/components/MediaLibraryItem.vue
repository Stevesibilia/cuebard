<template>
  <div
    class="media-library-item"
    :class="{ selected }"
    draggable="true"
    @click="$emit('select', $event)"
    @dragstart="onDragStart"
  >
    <div class="thumbnail">
      <img v-if="item.mediaType === 'image' && thumbnailSrc" :src="thumbnailSrc" :alt="item.displayName" />
      <div v-else-if="item.mediaType !== 'image'" class="pdf-icon">
        <span class="material-symbols-rounded">picture_as_pdf</span>
      </div>

      <div v-if="item.linkedCueUuid" class="link-badge" :title="t('visuals.linkedBadge')">
        <span class="material-symbols-rounded">music_note</span>
      </div>

      <div class="action-row">
        <button
          class="thumb-btn"
          :title="t('visuals.visualProperties')"
          :aria-label="t('visuals.visualProperties')"
          @click.stop="$emit('properties')"
        >
          <span class="material-symbols-rounded">tune</span>
        </button>
        <button
          class="thumb-btn"
          :title="t('visuals.addToComposition')"
          :aria-label="t('visuals.addToComposition')"
          @click.stop="$emit('push')"
        >
          <span class="material-symbols-rounded">add</span>
        </button>
        <button
          class="thumb-btn danger"
          :title="t('visuals.deleteItem')"
          :aria-label="t('visuals.deleteItem')"
          @click.stop="$emit('delete')"
        >
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
    </div>
    <div class="item-name" :title="item.displayName">{{ item.displayName }}</div>
  </div>
</template>

<script setup lang="ts">
import type { VisualMediaItem } from '~/types/project';

const props = defineProps<{
  item: VisualMediaItem;
  selected?: boolean;
  // The full current selection (uuids). When this item is selected, dragging
  // it drags the whole selection.
  selection?: string[];
}>();

const emit = defineEmits<{
  select: [event?: MouseEvent];
  push: [];
  properties: [];
  delete: [];
}>();

const onDragStart = (e: DragEvent) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'copy';

  // Dragging a selected item drags the whole selection; dragging an unselected
  // item drags just it (and makes it the selection).
  const uuids =
    props.selected && props.selection?.length ? props.selection : [props.item.uuid];
  if (!props.selected) emit('select');

  e.dataTransfer.setData('application/x-visual-media-uuids', JSON.stringify(uuids));
  // Legacy single-uuid key kept for back-compat with older drop handlers.
  e.dataTransfer.setData('application/x-visual-media-uuid', props.item.uuid);
};

const { t } = useLocalization();
const { currentProject } = useProject();

const thumbnailSrc = ref<string | null>(null);

const loadThumbnail = async () => {
  if (props.item.mediaType !== 'image' || !currentProject.value || !import.meta.client || !window.electronAPI) return;
  try {
    const result = await (window.electronAPI as any).readVisualMedia(
      currentProject.value.folderPath,
      props.item.mediaPath
    );
    if (result.success && result.data) {
      thumbnailSrc.value = `data:${result.mimeType};base64,${result.data}`;
    }
  } catch (e) {
    console.warn('Failed to load thumbnail for', props.item.displayName, e);
  }
};

onMounted(loadThumbnail);
watch(() => props.item.mediaPath, loadThumbnail);
</script>

<style scoped lang="scss">
.media-library-item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;

  &:hover .action-row,
  .action-row:focus-within {
    opacity: 1;
  }

  &.selected {
    .thumbnail {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    .item-name {
      color: var(--color-text-primary);
    }
  }
}

.thumbnail {
  position: relative;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  overflow: hidden;
  background-color: var(--color-field);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
}

// Small chips drawn over the thumbnail: chrome at 85% so they read on any image
.link-badge,
.thumb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background-color: color-mix(in srgb, var(--color-chrome) 85%, transparent);
  color: var(--color-text-primary);
}

.link-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  width: 20px;
  height: 20px;
  pointer-events: none;

  .material-symbols-rounded {
    font-size: 13px;
  }
}

.action-row {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.thumb-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  cursor: pointer;

  .material-symbols-rounded {
    font-size: 15px;
  }

  &:hover {
    background-color: var(--color-chrome);
  }

  &.danger {
    color: var(--color-danger-text);
  }
}

.pdf-icon .material-symbols-rounded {
  font-size: 36px;
  color: var(--color-text-muted);
}

.item-name {
  font-size: var(--font-size-label);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
