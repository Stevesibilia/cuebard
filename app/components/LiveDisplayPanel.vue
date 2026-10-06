<template>
  <div class="live-display-panel">
    <div
      ref="workspaceRef"
      class="workspace"
      :class="{ 'drag-over': isDragOver }"
      @click.self="onWorkspaceClick"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- Fixed 16:9 canvas: the coordinate origin for all layers. Letterboxed
           (centered) inside the panel so a layer's x/y/width/height
           percentages map to the same relative rectangle here and in the player. -->
      <div ref="canvasRef" class="canvas" :aria-label="t('visuals.composition')">
        <div v-if="layers.length === 0" class="empty-placeholder">
          <span class="material-symbols-rounded">layers</span>
          <p>{{ t('visuals.canvasEmpty') }}</p>
        </div>

        <div
          v-for="layer in sortedLayers"
          :key="layer.id"
          class="layer"
          :class="{
            published: layer.published,
            draft: !layer.published,
            selected: selectedLayerId === layer.id,
            pending: isLayerPending(layer.id),
          }"
          :style="{
            left: layer.x + '%',
            top: layer.y + '%',
            width: layer.width + '%',
            height: layer.height + '%',
            zIndex: layer.zIndex,
          }"
          @mousedown.stop="onLayerMouseDown($event, layer)"
          @click.stop="onSelectLayer(layer.id)"
        >
          <img
            :src="imageSrcMap[layer.id] || ''"
            :alt="layer.mediaItem.displayName"
            draggable="false"
            class="layer-content"
            @load="onImageLoad($event, layer)"
          />

          <template v-if="selectedLayerId === layer.id && !layer.isBackground">
            <div
              v-for="handle in resizeHandles"
              :key="handle"
              class="resize-handle"
              :class="`handle-${handle}`"
              @mousedown.stop="onResizeStart($event, layer, handle)"
            ></div>
          </template>

          <div v-if="layer.isBackground" class="bg-badge">
            <span class="material-symbols-rounded">wallpaper</span>
            <span>{{ t('visuals.backgroundBadge') }}</span>
          </div>

          <div v-if="isLayerPending(layer.id)" class="pending-tag">
            <span class="material-symbols-rounded">schedule</span>
            <span>{{ t('visuals.queued') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected-layer row. Always takes its height, so selecting a layer
         (which also starts a drag) never resizes the canvas under the pointer. -->
    <div class="layer-bar">
      <template v-if="selectedLayer">
        <span class="layer-name" :title="selectedLayer.mediaItem.displayName">
          {{ selectedLayer.mediaItem.displayName }}
        </span>
        <div class="layer-bar-gap"></div>
        <button
          class="bar-btn"
          :class="{ primary: !selectedLayer.published }"
          @click="togglePublish(selectedLayer)"
        >
          {{ selectedLayer.published ? t('visuals.unpublish') : t('visuals.publish') }}
        </button>
        <button
          class="bar-btn"
          :class="{ active: selectedLayer.isBackground }"
          @click="onToggleBackground(selectedLayer)"
        >
          {{ selectedLayer.isBackground ? t('visualDisplay.unsetBackground') : t('visualDisplay.setBackground') }}
        </button>
        <button
          class="bar-btn"
          :disabled="selectedLayer.isBackground"
          @click="onBringToFront(selectedLayer)"
        >
          {{ t('visuals.front') }}
        </button>
        <button
          class="bar-btn"
          :disabled="selectedLayer.isBackground"
          @click="onSendToBack(selectedLayer)"
        >
          {{ t('visuals.back') }}
        </button>
        <button class="bar-btn danger" @click="onRemove(selectedLayer.id)">
          {{ t('visuals.remove') }}
        </button>
      </template>
      <span v-else class="layer-bar-hint">{{ t('visuals.noLayerSelected') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VisualMediaItem } from '~/types/project';
import type { DisplayLayer } from '~/types/ipc';

const { t } = useLocalization();
const { currentProject, findItemByUuid } = useProject();
const {
  layers,
  selectedLayerId,
  selectLayer,
  addLayer,
  removeLayer,
  updateLayer,
  publishLayerWithLinking,
  unpublishLayerWithFade,
  setBackground,
  bringToFront,
  sendToBack,
  isLayerPending,
} = useVisualDisplay();
const { syncIfReady } = useCompositionActions();
const { playCue } = useAudioEngine();

const workspaceRef = ref<HTMLElement | null>(null);
// The fixed 16:9 canvas. All layer coordinate math (drop, drag, resize, fit)
// is measured against this element, not the variable-aspect workspace.
const canvasRef = ref<HTMLElement | null>(null);
const isDragOver = ref(false);

// Output aspect ratio. The canvas and the player both render at 16:9, so layer
// percentages map identically between them and stay valid across any resize.
const CANVAS_AR = 16 / 9;

const imageSrcMap = ref<Record<string, string>>({});

const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const;
type ResizeHandle = typeof resizeHandles[number];

// --- Derived state ---
const sortedLayers = computed(() =>
  [...layers.value].sort((a, b) => a.zIndex - b.zIndex)
);
const selectedLayer = computed(() =>
  selectedLayerId.value
    ? layers.value.find((l) => l.id === selectedLayerId.value) ?? null
    : null
);

// --- Media loading ---
const loadImage = async (item: VisualMediaItem): Promise<string | null> => {
  if (!currentProject.value || !window.electronAPI) return null;
  try {
    const result = await (window.electronAPI as any).readVisualMedia(
      currentProject.value.folderPath,
      item.mediaPath
    );
    if (result.success && result.data) {
      return `data:${result.mimeType};base64,${result.data}`;
    }
  } catch (e) {
    console.warn('Failed to load layer image:', e);
  }
  return null;
};

// Ensure image src is loaded for every image layer
watch(
  layers,
  async (current) => {
    const knownIds = new Set(Object.keys(imageSrcMap.value));
    for (const layer of current) {
      if (layer.mediaItem.mediaType !== 'image') continue;
      if (knownIds.has(layer.id)) continue;
      const src = await loadImage(layer.mediaItem);
      if (src) imageSrcMap.value = { ...imageSrcMap.value, [layer.id]: src };
    }
    // Drop entries for removed layers
    const liveIds = new Set(current.map((l) => l.id));
    for (const id of Object.keys(imageSrcMap.value)) {
      if (!liveIds.has(id)) {
        const next = { ...imageSrcMap.value };
        delete next[id];
        imageSrcMap.value = next;
      }
    }
  },
  { immediate: true, deep: true }
);

// Fit the layer's bounding box to the image's natural aspect ratio the
// first time the image loads. Keeps the layer centered on its current
// position and clamps to the workspace bounds. Once per layer (the flag is
// on the layer, so returning to the Media tab does not re-fit), and never
// for a background, which is full-screen by definition.
const onImageLoad = (e: Event, layer: DisplayLayer) => {
  if (layer.fitted || layer.isBackground) return;
  const img = e.target as HTMLImageElement;
  if (!img.naturalWidth || !img.naturalHeight) return;

  const imageAspect = img.naturalWidth / img.naturalHeight;

  // Fit against the FIXED canvas aspect ratio, not the live panel size. Because
  // the canvas is always 16:9, this fit is resolution-independent and stays
  // correct across window/panel resizes — no re-fit needed.
  let widthPct = layer.width;
  let heightPct = widthPct * (CANVAS_AR / imageAspect);
  if (heightPct > 100) {
    heightPct = 100;
    widthPct = heightPct * (imageAspect / CANVAS_AR);
  }

  // Keep the layer centered on its current center.
  const centerX = layer.x + layer.width / 2;
  const centerY = layer.y + layer.height / 2;
  const x = Math.max(0, Math.min(100 - widthPct, centerX - widthPct / 2));
  const y = Math.max(0, Math.min(100 - heightPct, centerY - heightPct / 2));

  const changed = x !== layer.x || y !== layer.y
    || widthPct !== layer.width || heightPct !== layer.height;
  updateLayer(layer.id, { x, y, width: widthPct, height: heightPct, fitted: true });
  if (changed && layer.published) void syncIfReady();
};

// --- Workspace interactions ---

const onWorkspaceClick = () => {
  selectLayer(null);
};

const onSelectLayer = (id: string) => {
  selectLayer(id);
};

// --- Drag from media library ---

const onDragOver = (e: DragEvent) => {
  if (e.dataTransfer?.types.includes('application/x-visual-media-uuid')) {
    isDragOver.value = true;
    e.dataTransfer.dropEffect = 'copy';
  }
};

const onDragLeave = () => {
  isDragOver.value = false;
};

const onDrop = (e: DragEvent) => {
  isDragOver.value = false;
  const project = currentProject.value;
  if (!project) return;

  // Read the multi-uuid payload; fall back to the legacy single-uuid key.
  let uuids: string[] = [];
  const multi = e.dataTransfer?.getData('application/x-visual-media-uuids');
  if (multi) {
    try {
      const arr = JSON.parse(multi);
      if (Array.isArray(arr)) uuids = arr;
    } catch { /* fall through */ }
  }
  if (!uuids.length) {
    const single = e.dataTransfer?.getData('application/x-visual-media-uuid');
    if (single) uuids = [single];
  }
  if (!uuids.length) return;

  const rect = canvasRef.value?.getBoundingClientRect();
  const width = 50;
  const height = 50;
  const baseX = rect ? ((e.clientX - rect.left) / rect.width) * 100 - width / 2 : 0;
  const baseY = rect ? ((e.clientY - rect.top) / rect.height) * 100 - height / 2 : 0;

  let lastLayer: DisplayLayer | null = null;
  uuids.forEach((uuid, i) => {
    const item = project.visualMedia?.find((m) => m.uuid === uuid);
    if (!item) return;
    let x: number | undefined;
    let y: number | undefined;
    if (rect) {
      const off = i * 3; // cascade so stacked drops don't perfectly overlap
      x = Math.max(0, Math.min(100 - width, baseX + off));
      y = Math.max(0, Math.min(100 - height, baseY + off));
    }
    const layer = addLayer(item, { x, y }); // returns null for non-image
    if (layer) lastLayer = layer;
  });
  if (lastLayer) selectLayer((lastLayer as DisplayLayer).id);
};

// --- Move + Resize ---

interface DragSession {
  layerId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
  rectWidth: number;
  rectHeight: number;
  mode: 'move' | 'resize';
  handle?: ResizeHandle;
}

let dragSession: DragSession | null = null;

const onLayerMouseDown = (e: MouseEvent, layer: DisplayLayer) => {
  selectLayer(layer.id);
  // Background layers are locked full-screen — selectable but not movable.
  if (layer.isBackground) return;
  beginDrag(e, layer, 'move');
};

const onResizeStart = (e: MouseEvent, layer: DisplayLayer, handle: ResizeHandle) => {
  beginDrag(e, layer, 'resize', handle);
};

const beginDrag = (
  e: MouseEvent,
  layer: DisplayLayer,
  mode: 'move' | 'resize',
  handle?: ResizeHandle
) => {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  dragSession = {
    layerId: layer.id,
    startX: e.clientX,
    startY: e.clientY,
    origX: layer.x,
    origY: layer.y,
    origWidth: layer.width,
    origHeight: layer.height,
    rectWidth: rect.width,
    rectHeight: rect.height,
    mode,
    handle,
  };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
};

const onDragMove = (e: MouseEvent) => {
  if (!dragSession) return;
  const dxPct = ((e.clientX - dragSession.startX) / dragSession.rectWidth) * 100;
  const dyPct = ((e.clientY - dragSession.startY) / dragSession.rectHeight) * 100;

  if (dragSession.mode === 'move') {
    const nx = clamp(
      dragSession.origX + dxPct,
      0,
      Math.max(0, 100 - dragSession.origWidth)
    );
    const ny = clamp(
      dragSession.origY + dyPct,
      0,
      Math.max(0, 100 - dragSession.origHeight)
    );
    updateLayer(dragSession.layerId, { x: nx, y: ny });
  } else if (dragSession.mode === 'resize' && dragSession.handle) {
    const next = computeResize(dragSession, dxPct, dyPct);
    updateLayer(dragSession.layerId, next);
  }
};

const onDragEnd = () => {
  if (dragSession) {
    const layer = layers.value.find((l) => l.id === dragSession!.layerId);
    if (layer?.published) void syncIfReady();
  }
  dragSession = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const computeResize = (s: DragSession, dx: number, dy: number) => {
  let { origX: x, origY: y, origWidth: w, origHeight: h } = s;
  const aspect = s.origWidth / s.origHeight;
  const isCorner = s.handle!.length === 2;

  const handle = s.handle!;
  if (handle.includes('e')) w = clamp(s.origWidth + dx, 5, 100 - s.origX);
  if (handle.includes('w')) {
    const nw = clamp(s.origWidth - dx, 5, s.origX + s.origWidth);
    x = s.origX + (s.origWidth - nw);
    w = nw;
  }
  if (handle.includes('s')) h = clamp(s.origHeight + dy, 5, 100 - s.origY);
  if (handle.includes('n')) {
    const nh = clamp(s.origHeight - dy, 5, s.origY + s.origHeight);
    y = s.origY + (s.origHeight - nh);
    h = nh;
  }

  if (isCorner) {
    // Preserve aspect ratio on corner drags
    const candidateH = w / aspect;
    if (candidateH <= 100 - y && candidateH >= 5) {
      if (handle.includes('n')) y = s.origY + (s.origHeight - candidateH);
      h = candidateH;
    } else {
      const candidateW = h * aspect;
      if (handle.includes('w')) x = s.origX + (s.origWidth - candidateW);
      w = candidateW;
    }
  }

  return { x, y, width: w, height: h };
};

// --- Layer row handlers ---

const togglePublish = (layer: DisplayLayer) => {
  if (layer.published) {
    unpublishLayerWithFade(layer.id, { syncCallback: syncIfReady });
  } else {
    publishLayerWithLinking(layer.id, {
      syncCallback: syncIfReady,
      playCue,
      findItemByUuid,
    });
  }
};

const onToggleBackground = (layer: DisplayLayer) => {
  // Enabling publishes the backdrop; disabling may change what's shown — always sync.
  setBackground(layer.id, !layer.isBackground);
  void syncIfReady();
};

// Re-ordering only affects the player when the layer is already live, but the
// z-index change must be pushed so the player restacks. Sync when published.
const onBringToFront = (layer: DisplayLayer) => {
  bringToFront(layer.id);
  if (layer.published) void syncIfReady();
};

const onSendToBack = (layer: DisplayLayer) => {
  sendToBack(layer.id);
  if (layer.published) void syncIfReady();
};

const onRemove = (id: string) => {
  const layer = layers.value.find((l) => l.id === id);
  removeLayer(id);
  if (layer?.published) void syncIfReady();
};

// Keyboard: delete removes selected layer
const onKeyDown = (e: KeyboardEvent) => {
  if (
    (e.key === 'Delete' || e.key === 'Backspace') &&
    selectedLayerId.value &&
    document.activeElement === document.body
  ) {
    onRemove(selectedLayerId.value);
  }
};

onMounted(() => {
  if (import.meta.client) window.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKeyDown);
});
</script>

<style scoped lang="scss">
.live-display-panel {
  // The canvas is the player's output and is black in every theme, so what is
  // drawn on it keeps fixed light-on-black colours instead of theme tokens.
  --canvas-bg: #000;
  --canvas-ink: #fff;
  --canvas-scrim: rgba(0, 0, 0, 0.6);

  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  background-color: var(--color-background);
  overflow: hidden;
}

.workspace {
  flex: 1;
  min-height: 0;
  position: relative;
  border-radius: var(--radius-card);
  overflow: hidden;
  // Center the fixed-AR canvas in whatever space is left.
  display: flex;
  align-items: center;
  justify-content: center;
  // Query container so the canvas can size itself to fit at exactly 16:9.
  container-type: size;

  &.drag-over {
    outline: 2px dashed var(--color-accent);
    outline-offset: -2px;
  }
}

// Fixed 16:9 canvas. Layers are positioned relative to this, so their
// percentages mean the same pixels here and in the player window.
.canvas {
  position: relative;
  aspect-ratio: 16 / 9;
  // Largest 16:9 box that fits the panel in EITHER orientation: take the
  // smaller of full width or the width a full-height 16:9 box would need.
  // Height follows from aspect-ratio, so the box is always exactly 16:9.
  width: min(100cqw, calc(100cqh * 16 / 9));
  height: auto;
  margin: auto;
  border-radius: var(--radius-card);
  background-color: var(--canvas-bg);
  overflow: hidden;
  // Own stacking context so negative-z layers (backgrounds, repeated send-to-back)
  // paint above the canvas's black fill instead of being hidden behind it.
  isolation: isolate;
  // The 16:9 output frame, so the GM sees exactly what the player window
  // shows (WYSIWYG). An outline, so it does not change the box size.
  outline: 1px solid var(--color-divider);
  outline-offset: -1px;
}

.empty-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  pointer-events: none;

  .material-symbols-rounded {
    font-size: 48px;
    opacity: 0.5;
  }

  p {
    margin-top: 8px;
    font-size: var(--font-size-label);
  }
}

.layer {
  position: absolute;
  cursor: move;
  user-select: none;
  box-sizing: border-box;

  .layer-content {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    display: block;
  }

  &.draft {
    border: 2px dashed color-mix(in srgb, var(--canvas-ink) 55%, transparent);
    opacity: 0.6;
  }

  &.published {
    border: 2px solid var(--color-success);
  }

  &.selected {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    /* No z-index boost: selection must not override layer stacking, otherwise
       Front/Back and Background act on a layer pinned to the top. The outline
       paints regardless of stacking order. */
  }

  &.pending {
    border: 2px dashed var(--color-state-queued);
  }
}

.pending-tag,
.bg-badge {
  position: absolute;
  top: 6px;
  height: 20px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 6px;
  border-radius: var(--radius-key);
  background-color: var(--canvas-scrim);
  font-size: 11px;
  font-weight: var(--font-weight-emphasis);
  pointer-events: none;

  .material-symbols-rounded {
    font-size: 13px;
  }
}

.pending-tag {
  left: 6px;
  color: var(--color-state-queued);
}

.bg-badge {
  right: 6px;
  color: var(--canvas-ink);
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: var(--canvas-ink);
  border: 1px solid var(--color-accent);
  border-radius: 2px;

  &.handle-nw { top: -5px; left: -5px; cursor: nwse-resize; }
  &.handle-ne { top: -5px; right: -5px; cursor: nesw-resize; }
  &.handle-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
  &.handle-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
  &.handle-n  { top: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
  &.handle-s  { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
  &.handle-e  { right: -5px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
  &.handle-w  { left: -5px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
}

.layer-bar {
  height: var(--size-action);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-radius: var(--radius-card);
  background-color: var(--color-chrome);
  border: 1px solid var(--color-divider);
  box-sizing: border-box;
}

.layer-name {
  min-width: 0;
  padding: 0 6px;
  font-weight: var(--font-weight-emphasis);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-bar-hint {
  padding: 0 6px;
  color: var(--color-text-muted);
}

.layer-bar-gap {
  flex: 1;
}

.bar-btn {
  height: var(--size-control);
  flex-shrink: 0;
  padding: 0 12px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);

  &:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
  }

  &.primary {
    border-color: var(--color-accent);
    background-color: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-emphasis);

    &:hover:not(:disabled) {
      background-color: var(--color-accent-hover);
    }
  }

  &.active {
    border-color: var(--color-accent);
    background-color: var(--color-accent-tint);
    color: var(--color-text-primary);
  }

  &.danger {
    color: var(--color-danger-text);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
