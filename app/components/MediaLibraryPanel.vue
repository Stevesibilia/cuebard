<template>
  <div
    class="media-library-panel"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
    :class="{ 'drag-active': isDragging }"
  >
    <div class="library-header">
      <span class="section-title">{{ t('visuals.media') }}</span>
      <div class="header-actions">
        <button class="small-btn quiet" :title="t('visuals.newFolder')" @click="showNewFolderDialog">
          <span class="material-symbols-rounded">add</span>
          <span>{{ t('visuals.folder') }}</span>
        </button>
        <button class="small-btn" @click="handleImportClick">{{ t('visuals.import') }}</button>
      </div>
    </div>

    <!-- Folders: All, Unfiled and the user's folders -->
    <ul class="folder-list">
      <li
        class="folder-item"
        :class="{ active: selectedFolder === null }"
        @click="selectedFolder = null"
      >
        <span class="folder-name">{{ t('visuals.allFolders') }}</span>
        <span class="folder-count">{{ allItems.length }}</span>
      </li>
      <li
        class="folder-item"
        :class="{ active: selectedFolder === '__unfiled__', 'drop-target': dragOverFolder === '__unfiled__' }"
        @click="selectedFolder = '__unfiled__'"
        @dragover.prevent="onFolderDragOver('__unfiled__')"
        @dragleave="onFolderDragLeave"
        @drop.prevent.stop="onFolderDrop($event, '__unfiled__')"
      >
        <span class="folder-name">{{ t('visuals.unfiled') }}</span>
        <span class="folder-count">{{ folderCounts.__unfiled__ ?? 0 }}</span>
      </li>
      <li
        v-for="folder in folders"
        :key="folder"
        class="folder-item"
        :class="{ active: selectedFolder === folder, 'drop-target': dragOverFolder === folder }"
        @click="selectedFolder = folder"
        @dblclick="startRenameFolder(folder)"
        @dragover.prevent="onFolderDragOver(folder)"
        @dragleave="onFolderDragLeave"
        @drop.prevent.stop="onFolderDrop($event, folder)"
      >
        <span v-if="renamingFolder !== folder" class="folder-name" :title="folder">{{ folder }}</span>
        <input
          v-else
          ref="folderRenameInput"
          class="rename-input"
          :value="folder"
          @keydown.enter="confirmRenameFolder($event, folder)"
          @keydown.escape="renamingFolder = null"
          @blur="confirmRenameFolder($event, folder)"
        />
        <template v-if="renamingFolder !== folder">
          <span class="folder-count">{{ folderCounts[folder] ?? 0 }}</span>
          <button
            class="folder-delete-btn"
            :title="t('visuals.deleteFolder')"
            :aria-label="t('visuals.deleteFolder')"
            @click.stop="confirmDeleteFolderFromButton(folder)"
          >
            <span class="material-symbols-rounded">close</span>
          </button>
        </template>
      </li>
    </ul>

    <div class="divider"></div>

    <div class="grid-meta">
      <span>{{ filteredItems.length === 1 ? t('visuals.itemCountOne') : t('visuals.itemCount', { count: filteredItems.length }) }}</span>
      <span v-if="importProgress.active" class="import-progress">
        {{ t('visuals.importing', { current: importProgress.current, total: importProgress.total }) }}
      </span>
    </div>

    <div v-if="filteredItems.length === 0" class="empty-state">
      <span class="material-symbols-rounded">image</span>
      <p>{{ t('visuals.emptyTitle') }}</p>
      <p class="hint">{{ t('visuals.emptyHint') }}</p>
    </div>

    <div v-else class="thumbnail-grid">
      <MediaLibraryItem
        v-for="item in filteredItems"
        :key="item.uuid"
        :item="item"
        :selected="selectedUuids.has(item.uuid)"
        :selection="selectionArray"
        @select="selectItem(item, $event)"
        @push="pushItem(item)"
        @properties="openItemProperties(item)"
        @delete="confirmDeleteItemFromButton(item)"
      />
    </div>

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <div v-if="deleteDialog.visible" class="dialog-overlay" @click.self="deleteDialog.visible = false">
        <div class="dialog" role="dialog" aria-modal="true">
          <h3>{{ deleteDialog.type === 'folder' ? t('visuals.deleteFolderTitle') : t('visuals.deleteItemTitle') }}</h3>
          <p v-if="deleteDialog.type === 'folder'">
            {{ t('visuals.deleteFolderConfirm', { name: deleteDialog.name }) }}
          </p>
          <p v-else>
            {{ t('visuals.deleteItemConfirm', { name: deleteDialog.name }) }}
          </p>
          <div class="dialog-actions">
            <button class="btn-cancel" @click="deleteDialog.visible = false">{{ t('visuals.cancel') }}</button>
            <button class="btn-confirm danger" @click="executeDelete">{{ t('visuals.delete') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New Folder Dialog -->
    <Teleport to="body">
      <div v-if="newFolderDialog.visible" class="dialog-overlay" @click.self="newFolderDialog.visible = false">
        <div class="dialog" role="dialog" aria-modal="true">
          <h3>{{ t('visuals.newFolder') }}</h3>
          <input
            ref="newFolderInput"
            v-model="newFolderDialog.value"
            class="dialog-input"
            :placeholder="t('visuals.folderName')"
            @keydown.enter="confirmNewFolder"
            @keydown.escape="newFolderDialog.visible = false"
          />
          <div class="dialog-actions">
            <button class="btn-cancel" @click="newFolderDialog.visible = false">{{ t('visuals.cancel') }}</button>
            <button class="btn-confirm" @click="confirmNewFolder">{{ t('visuals.create') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { VisualMediaItem } from '~/types/project';
import { getVisualMediaType } from '~/types/project';

const { t } = useLocalization();
const { currentProject } = useProject();
const { addVisualMedia, removeVisualMedia, updateVisualMedia, moveItemsToFolder, addVisualFolder, removeVisualFolder } = useVisualMedia();
const { selectItem: visualDisplaySelect, addLayer, selectLayer, openProperties } = useVisualDisplay();

// --- State ---
const selectedFolder = ref<string | null>(null);
// Active single item (drives the properties pane / emit) = the last item clicked.
const selectedItemId = ref<string | null>(null);
// Multi-selection set (drives the visual selection + group drag).
const selectedUuids = ref<Set<string>>(new Set());
const anchorUuid = ref<string | null>(null);
const selectionArray = computed(() => [...selectedUuids.value]);
// Folder currently hovered during a drag (for drop highlight); '' = none.
const dragOverFolder = ref<string | null | ''>('');
const isDragging = ref(false);
const renamingFolder = ref<string | null>(null);

const importProgress = reactive({ active: false, current: 0, total: 0 });

// Active targets for the dialog flows (button-driven now)
const targetItem = ref<VisualMediaItem | null>(null);
const targetFolder = ref<string | null>(null);

const deleteDialog = reactive({ visible: false, type: '' as 'item' | 'folder', name: '' });
const newFolderDialog = reactive({ visible: false, value: '' });

const newFolderInput = ref<HTMLInputElement | null>(null);

// --- Computed ---
const folders = computed(() => currentProject.value?.visualFolders || []);

const allItems = computed(() => currentProject.value?.visualMedia || []);

// Items per folder, keyed by folder name; '__unfiled__' counts items without one.
const folderCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const item of allItems.value) {
    const key = item.folder || '__unfiled__';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
});

const filteredItems = computed(() => {
  if (selectedFolder.value === null) return allItems.value;
  if (selectedFolder.value === '__unfiled__') return allItems.value.filter(i => !i.folder);
  return allItems.value.filter(i => i.folder === selectedFolder.value);
});

// --- Selection ---
const emit = defineEmits<{
  'item-selected': [item: VisualMediaItem];
}>();

const selectItem = (item: VisualMediaItem, event?: MouseEvent) => {
  const uuid = item.uuid;
  const isCtrl = !!event && (event.metaKey || event.ctrlKey);
  const isShift = !!event && event.shiftKey;

  if (isShift && anchorUuid.value) {
    // Range select over the current filtered order, from anchor to clicked.
    const ids = filteredItems.value.map((i) => i.uuid);
    const a = ids.indexOf(anchorUuid.value);
    const b = ids.indexOf(uuid);
    if (a !== -1 && b !== -1) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      selectedUuids.value = new Set(ids.slice(lo, hi + 1));
    }
  } else if (isCtrl) {
    // Toggle membership; clicked item becomes the new anchor.
    const next = new Set(selectedUuids.value);
    next.has(uuid) ? next.delete(uuid) : next.add(uuid);
    selectedUuids.value = next;
    anchorUuid.value = uuid;
  } else {
    // Plain click → single selection (unchanged behavior for downstream panels).
    selectedUuids.value = new Set([uuid]);
    anchorUuid.value = uuid;
  }

  // Active item (properties pane / emit) is always the most recently clicked.
  selectedItemId.value = uuid;
  visualDisplaySelect(item);
  emit('item-selected', item);
};

// Clear the multi-selection when switching folders.
watch(selectedFolder, () => {
  selectedUuids.value = new Set();
  anchorUuid.value = null;
});

// --- Folder drop targets (move dragged items into a folder) ---
const parseDraggedUuids = (e: DragEvent): string[] => {
  const multi = e.dataTransfer?.getData('application/x-visual-media-uuids');
  if (multi) {
    try {
      const arr = JSON.parse(multi);
      if (Array.isArray(arr)) return arr;
    } catch { /* fall through */ }
  }
  const single = e.dataTransfer?.getData('application/x-visual-media-uuid');
  return single ? [single] : [];
};

const onFolderDragOver = (folder: string | null) => {
  dragOverFolder.value = folder;
};
const onFolderDragLeave = () => {
  dragOverFolder.value = '';
};
const onFolderDrop = (e: DragEvent, folder: string | null) => {
  dragOverFolder.value = '';
  isDragging.value = false;
  // "All" (null) is not a real folder — nothing to assign there.
  if (folder === null) return;
  const uuids = parseDraggedUuids(e);
  if (uuids.length) moveItemsToFolder(uuids, folder);
};

// Push from the media library = add as a new draft layer in the composition.
// It does NOT appear on the player until the GM publishes it.
// PDF support is deferred — addLayer returns null for non-image media.
const pushItem = (item: VisualMediaItem) => {
  const layer = addLayer(item);
  if (layer) selectLayer(layer.id);
};

// --- Drag and Drop ---
// Only arm the import outline for external file drags, not internal item drags
// (otherwise dragging items to a folder leaves the panel outline stuck).
const onDragOver = (e: DragEvent) => {
  if (e.dataTransfer?.types.includes('Files')) isDragging.value = true;
};
const onDragLeave = () => { isDragging.value = false; };

const onDrop = async (e: DragEvent) => {
  isDragging.value = false;
  if (!e.dataTransfer?.files?.length || !currentProject.value) return;
  const files = Array.from(e.dataTransfer.files);
  // Electron no longer sets File.path; the preload resolves it (webUtils)
  const paths = files
    .map(f => window.electronAPI?.getFilePath(f))
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    await importFiles(paths);
  }
};

// --- Import ---
const handleImportClick = async () => {
  if (!import.meta.client || !window.electronAPI || !currentProject.value) return;
  const filePaths = await window.electronAPI.selectVisualMediaFiles();
  if (filePaths && filePaths.length > 0) {
    await importFiles(filePaths);
  }
};

const importFiles = async (filePaths: string[]) => {
  if (!currentProject.value || !import.meta.client || !window.electronAPI) return;

  const validPaths = filePaths.filter(p => getVisualMediaType(p) !== null);
  if (!validPaths.length) return;

  importProgress.active = true;
  importProgress.total = validPaths.length;
  importProgress.current = 0;

  for (const filePath of validPaths) {
    importProgress.current++;
    const uuid = crypto.randomUUID();
    const mediaType = getVisualMediaType(filePath)!;
    const fileName = filePath.split(/[/\\]/).pop() || 'unnamed';
    const displayName = fileName.replace(/\.[^.]+$/, '');

    try {
      const result = await (window.electronAPI as any).importVisualMedia(
        currentProject.value.folderPath,
        filePath,
        uuid
      );
      if (result.success) {
        addVisualMedia({
          uuid,
          displayName,
          mediaFileName: result.mediaFileName!,
          mediaPath: result.mediaPath!,
          mediaType,
          folder: selectedFolder.value && selectedFolder.value !== '__unfiled__' ? selectedFolder.value : undefined,
        });
      }
    } catch (e) {
      console.error('Failed to import:', filePath, e);
    }
  }

  importProgress.active = false;
};

// --- Item Operations (button-driven) ---

// Cog button → open the Visual Properties pane for this item
const openItemProperties = (item: VisualMediaItem) => {
  selectItem(item);
  openProperties(item);
};

// Trash button → confirm-then-delete flow
const confirmDeleteItemFromButton = (item: VisualMediaItem) => {
  targetItem.value = item;
  deleteDialog.type = 'item';
  deleteDialog.name = item.displayName;
  deleteDialog.visible = true;
};


// --- Folder Operations ---
const showNewFolderDialog = () => {
  newFolderDialog.value = '';
  newFolderDialog.visible = true;
  nextTick(() => newFolderInput.value?.focus());
};

const confirmNewFolder = () => {
  const name = newFolderDialog.value.trim();
  if (!name) return;
  addVisualFolder(name);
  newFolderDialog.visible = false;
};

const startRenameFolder = (folder: string) => {
  renamingFolder.value = folder;
};

const confirmRenameFolder = (event: Event, oldName: string) => {
  const input = event.target as HTMLInputElement;
  const newName = input.value.trim();
  if (newName && newName !== oldName) {
    // Rename: add new, move items, remove old
    addVisualFolder(newName);
    for (const item of allItems.value) {
      if (item.folder === oldName) {
        updateVisualMedia(item.uuid, { folder: newName });
      }
    }
    removeVisualFolder(oldName);
    if (selectedFolder.value === oldName) selectedFolder.value = newName;
  }
  renamingFolder.value = null;
};

const confirmDeleteFolderFromButton = (folder: string) => {
  targetFolder.value = folder;
  deleteDialog.type = 'folder';
  deleteDialog.name = folder;
  deleteDialog.visible = true;
};

// --- Delete Execution ---
const executeDelete = async () => {
  if (deleteDialog.type === 'item' && targetItem.value) {
    const item = targetItem.value;
    await removeVisualMedia(item.uuid, true);
    if (selectedItemId.value === item.uuid) {
      selectedItemId.value = null;
    }
    targetItem.value = null;
  } else if (deleteDialog.type === 'folder' && targetFolder.value) {
    const folder = targetFolder.value;
    removeVisualFolder(folder);
    if (selectedFolder.value === folder) {
      selectedFolder.value = null;
    }
    targetFolder.value = null;
  }
  deleteDialog.visible = false;
};
</script>

<style scoped lang="scss">
.media-library-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  color: var(--color-text-primary);
  border-radius: var(--radius-control);

  &.drag-active {
    outline: 2px dashed var(--color-accent);
    outline-offset: 2px;
    background-color: var(--color-accent-tint);
  }
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.section-title {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-emphasis);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  gap: 6px;
}

.small-btn {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  border: 1px solid var(--color-control-border);
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--font-size-label);
  white-space: nowrap;
  cursor: pointer;

  .material-symbols-rounded { font-size: 15px; }

  &.quiet { color: var(--color-text-secondary); }

  &:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
}

.folder-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-shrink: 0;
  max-height: 35%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.folder-item {
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;

  .folder-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .folder-delete-btn {
    display: none;
    width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;

    .material-symbols-rounded { font-size: 15px; }

    &:hover {
      color: var(--color-danger-text);
      background-color: var(--color-danger-tint);
    }
  }

  // On hover the delete button takes the count's place
  &:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);

    .folder-count { display: none; }
    .folder-delete-btn { display: flex; }
  }

  &.active {
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-emphasis);
  }

  &.drop-target {
    outline: 2px dashed var(--color-accent);
    outline-offset: -2px;
    background-color: var(--color-accent-tint);
  }
}

.rename-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  box-sizing: border-box;
  padding: 0 6px;
  border: 1px solid var(--color-accent);
  border-radius: 5px;
  background-color: var(--color-field);
  color: var(--color-text-primary);
  font: inherit;
  outline: none;
}

.divider {
  height: 1px;
  flex-shrink: 0;
  background-color: var(--color-divider);
}

.grid-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.import-progress {
  color: var(--color-text-secondary);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-muted);

  .material-symbols-rounded { font-size: 40px; margin-bottom: 8px; opacity: 0.6; }
  p { margin: 2px 0; font-size: 13px; color: var(--color-text-secondary); }
  .hint { font-size: 11px; color: var(--color-text-muted); }
}

.thumbnail-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
  // Room for the selection outline (2px + 2px offset) inside the scroll box
  padding: 4px;
  margin: -4px;
}

// Dialogs (teleported to body)
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: color-mix(in srgb, var(--color-background) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 360px;
  max-width: 90vw;
  box-sizing: border-box;
  padding: 20px;
  background: var(--color-chrome);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);
  color: var(--color-text-primary);

  h3 { margin: 0 0 12px; font-size: var(--font-size-title); font-weight: 600; }
  p { margin: 0 0 16px; color: var(--color-text-secondary); }
}

.dialog-input {
  width: 100%;
  height: var(--size-control);
  box-sizing: border-box;
  padding: 0 10px;
  margin-bottom: 16px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-field);
  color: var(--color-text-primary);
  font: inherit;
  outline: none;

  &:focus { border-color: var(--color-accent); }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  height: var(--size-control);
  padding: 0 14px;
  border-radius: var(--radius-control);
  font: inherit;
  cursor: pointer;
}

.btn-cancel {
  border: 1px solid var(--color-control-border);
  background: transparent;
  color: var(--color-text-primary);

  &:hover { background: var(--color-surface-hover); }
}

.btn-confirm {
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: var(--font-weight-emphasis);

  &:hover { background: var(--color-accent-hover); border-color: var(--color-accent-hover); }

  &.danger {
    background: var(--color-danger);
    border-color: var(--color-danger);

    &:hover { background: var(--color-danger); opacity: 0.9; }
  }
}
</style>
