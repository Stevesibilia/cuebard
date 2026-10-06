<template>
  <div class="main-workspace">
    <ProjectHeader />
    <PlaybackControls />

    <div class="workspace-toolbar">
      <div class="workspace-switch" role="tablist" :aria-label="t('toolbar.workspace')">
        <button
          role="tab"
          class="switch-btn"
          :class="{ active: activeTab === 'audio' }"
          :aria-selected="activeTab === 'audio'"
          @click="activeTab = 'audio'"
        >
          {{ t('toolbar.audio') }}
        </button>
        <button
          v-if="visualDisplayEnabled"
          role="tab"
          class="switch-btn"
          :class="{ active: activeTab === 'media' }"
          :aria-selected="activeTab === 'media'"
          @click="activeTab = 'media'"
        >
          {{ t('toolbar.visuals') }}
        </button>
      </div>

      <button
        v-if="activeTab === 'media'"
        class="toolbar-icon-btn"
        :title="mediaColumnOpen ? t('visuals.hidePanel') : t('visuals.showPanel')"
        :aria-label="mediaColumnOpen ? t('visuals.hidePanel') : t('visuals.showPanel')"
        :aria-expanded="mediaColumnOpen"
        @click="mediaColumnOpen = !mediaColumnOpen"
      >
        <span class="material-symbols-rounded">{{ mediaColumnOpen ? 'left_panel_close' : 'left_panel_open' }}</span>
      </button>

      <label v-if="activeTab === 'audio'" class="toolbar-search">
        <span class="material-symbols-rounded">search</span>
        <!-- Hotkeys ignore text fields, so Esc here clears the search
             instead of stopping all cues -->
        <input
          v-model="filterText"
          type="search"
          :placeholder="t('toolbar.search')"
          :aria-label="t('toolbar.search')"
          @keydown.esc.prevent.stop="clearFilter"
        />
      </label>

      <div class="toolbar-gap"></div>

      <template v-if="activeTab === 'audio'">
        <button class="toolbar-btn" :disabled="!currentProject" @click="handleImport">
          <span class="material-symbols-rounded">download</span>
          <span>{{ t('toolbar.importAudio') }}</span>
        </button>
        <button
          class="toolbar-btn"
          :disabled="!currentProject"
          :title="t('youtube.importFromYouTube')"
          @click="showYouTubeModal = true"
        >
          <span class="material-symbols-rounded">smart_display</span>
          <span>{{ t('toolbar.youtube') }}</span>
        </button>
        <button class="toolbar-btn" :disabled="!currentProject" @click="handleAddGroup">
          <span class="material-symbols-rounded">create_new_folder</span>
          <span>{{ t('toolbar.newGroup') }}</span>
        </button>
      </template>

      <!-- Visuals tab: composition actions -->
      <template v-else>
        <span class="layer-count">
          {{ layerCount === 1 ? t('visuals.layerCountOne') : t('visuals.layerCount', { count: layerCount }) }}
        </span>
        <button class="toolbar-btn primary" :disabled="!hasDrafts" @click="publishAll">
          {{ t('visuals.publishAll') }}
        </button>
        <button class="toolbar-btn" :disabled="!hasPublished" @click="blackOut">
          {{ t('visuals.black') }}
        </button>
        <RemoteViewerControl />
      </template>
    </div>

    <div v-if="activeTab === 'audio' && isFiltering" class="filter-status">
      <span>{{ t('toolbar.filterCount', { shown: filterCounts.shown, total: filterCounts.total }) }}</span>
      <span aria-hidden="true">·</span>
      <button class="filter-clear" @click="clearFilter">{{ t('toolbar.clearFilter') }}</button>
    </div>

    <div class="workspace-content">
      <template v-if="activeTab === 'audio'">
        <div v-if="!cartFullscreen" class="playlist-section" :style="{ width: cartClosed ? '100%' : `calc(100% - ${cartWidth}px)` }">
          <PlaylistView />
        </div>

        <div
          class="resize-handle"
          :class="{ 'collapsed-left': cartFullscreen, 'collapsed-right': cartClosed }"
          @mousedown="startResize"
        ></div>

        <div v-if="!cartClosed" class="cart-section" :style="{ width: cartFullscreen ? '100%' : `${cartWidth}px` }">
          <CartPlayer />
        </div>
      </template>

      <template v-if="activeTab === 'media' && visualDisplayEnabled">
        <!-- One side column: the library, or an item's visual properties in
             its place. v-show keeps the library's folder and selection while
             the column is hidden or shows properties. -->
        <aside
          v-show="mediaColumnOpen"
          class="media-column"
          :aria-label="showVisualProperties ? t('visuals.visualProperties') : t('visuals.mediaLibrary')"
        >
          <MediaLibraryPanel v-show="!showVisualProperties" />
          <VisualPropertiesPane
            v-if="showVisualProperties"
            :item="visualSelected"
            @close="closeVisualProperties"
          />
        </aside>
        <LiveDisplayPanel />
      </template>
    </div>
    
    <PropertiesPanel v-if="selectedItem" />
    
    <ProgressModal
      :visible="progressModal.visible"
      :title="progressModal.title"
      :message="progressModal.message"
      :percentage="progressModal.percentage"
    />

    <YouTubeImportModal :isOpen="showYouTubeModal" @close="showYouTubeModal = false" />
  </div>
</template>

<script setup lang="ts">
const { t } = useLocalization();
const { currentProject, selectedItem, visualDisplayEnabled } = useProject();
const { handleImport, handleAddGroup, showYouTubeModal } = usePlaylistActions();
const { filterText, isFiltering, counts: filterCounts, clearFilter } = usePlaylistFilter();
const {
  selectedItem: visualSelected,
  propertiesOpen: visualPropertiesOpen,
  closeProperties: closeVisualProperties,
} = useVisualDisplay();
const { layerCount, hasDrafts, hasPublished, publishAll, blackOut } = useCompositionActions();
const showVisualProperties = computed(() => visualPropertiesOpen.value && !!visualSelected.value);
// Hidden by the user stays hidden for the session (not saved with the project)
const mediaColumnOpen = useState<boolean>('visuals.columnOpen', () => true);
const { cartWidth, cartClosed, cartFullscreen, startResize } = useResizablePanel();
const { progressModal, registerListeners, handleKeydown } = useWorkspaceListeners();

const activeTab = ref<'audio' | 'media'>('audio');

// If visuals get disabled while the Media tab is active, fall back to Audio.
watch(visualDisplayEnabled, (enabled) => {
  if (!enabled && activeTab.value === 'media') {
    activeTab.value = 'audio';
  }
});

// IPC listeners and keyboard shortcut live as long as the workspace is mounted
let unregisterListeners: (() => void) | undefined;

onMounted(() => {
  if (import.meta.client) {
    unregisterListeners = registerListeners();
    window.addEventListener('keydown', handleKeydown);
  }
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown);
    unregisterListeners?.();
  }
});
</script>

<style scoped lang="scss">
.main-workspace {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-toolbar {
  height: var(--size-toolbar);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-divider);
}

.workspace-switch {
  display: flex;
  padding: 3px;
  border-radius: 9px;
  background-color: var(--color-field);
  flex-shrink: 0;
}

.switch-btn {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-fast), background-color var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
  }

  &.active {
    background-color: var(--color-control-border);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-emphasis);
  }
}

.toolbar-search {
  width: 260px;
  height: var(--size-control);
  flex-shrink: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background-color: var(--color-field);
  color: var(--color-text-muted);
  cursor: text;

  &:focus-within {
    border-color: var(--color-accent);
  }

  .material-symbols-rounded {
    font-size: 17px;
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    outline: none;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
    }
  }
}

.filter-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--color-divider);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.filter-clear {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font: inherit;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.toolbar-gap {
  flex: 1;
}

.toolbar-btn {
  height: var(--size-control);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 17px;
  }

  &:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    border-color: var(--color-accent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.primary {
    border-color: var(--color-accent);
    background-color: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-emphasis);

    &:hover:not(:disabled) {
      border-color: var(--color-accent-hover);
      background-color: var(--color-accent-hover);
    }
  }
}

.toolbar-icon-btn {
  width: var(--size-control);
  height: var(--size-control);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;

  .material-symbols-rounded {
    font-size: 18px;
  }

  &:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
}

.layer-count {
  flex-shrink: 0;
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.workspace-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.playlist-section {
  min-width: 30%;
  overflow: hidden;
}

.resize-handle {
  width: 9px;
  flex: none;
  box-sizing: border-box;
  border-left: 1px solid var(--color-divider);
  background-color: var(--color-background);
  cursor: col-resize;
  position: relative;
  z-index: 10;

  /* Grip */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 3px;
    height: 32px;
    border-radius: 2px;
    background-color: var(--color-control-border);
    transform: translate(-50%, -50%);
    transition: background-color var(--transition-fast);
  }
  
  &:hover::before,
  &:active::before {
    background-color: var(--color-accent);
  }
  
  &.collapsed-left {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 9px;
    border-left: 0;
    border-right: 1px solid var(--color-divider);
    background-color: transparent;
  }
  
  &.collapsed-right {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 9px;
    background-color: transparent;
  }

  &.collapsed-left:hover,
  &.collapsed-right:hover {
    background-color: var(--color-accent-tint);
  }
}

.cart-section {
  overflow: hidden;
}

.media-column {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
  border-right: 1px solid var(--color-divider);
  background-color: var(--color-panel);
  overflow: hidden;
}
</style>
