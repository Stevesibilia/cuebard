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

      <!-- Visuals tab: the right side of the toolbar (layer count, Publish
           all, Black, Viewer) belongs to restyle step 5. Left empty here. -->
      <template v-else>
        <div class="toolbar-visuals-slot"></div>
      </template>
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
        <div class="media-section" :style="{ width: `${mediaWidth}px` }">
          <MediaLibraryPanel />
        </div>
        <div class="media-resize-handle" @mousedown="startMediaResize"></div>
        <LiveDisplayPanel />
        <VisualPropertiesPane
          v-if="visualPropertiesOpen && visualSelected"
          :item="visualSelected"
          @close="closeVisualProperties"
        />
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
const {
  selectedItem: visualSelected,
  propertiesOpen: visualPropertiesOpen,
  closeProperties: closeVisualProperties,
} = useVisualDisplay();
const { cartWidth, cartClosed, cartFullscreen, startResize } = useResizablePanel();
const { progressModal, registerListeners, handleKeydown } = useWorkspaceListeners();

const activeTab = ref<'audio' | 'media'>('audio');

// If visuals get disabled while the Media tab is active, fall back to Audio.
watch(visualDisplayEnabled, (enabled) => {
  if (!enabled && activeTab.value === 'media') {
    activeTab.value = 'audio';
  }
});
const mediaWidth = ref(350);

const startMediaResize = (e: MouseEvent) => {
  e.preventDefault();
  const handleMouseMove = (e: MouseEvent) => {
    const container = document.querySelector('.workspace-content');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    mediaWidth.value = Math.max(200, Math.min(rect.width * 0.6, newWidth));
  };
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

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
  width: 5px;
  background-color: var(--color-border);
  cursor: col-resize;
  transition: background-color var(--transition-fast);
  position: relative;
  z-index: 10;
  
  &:hover {
    background-color: var(--color-accent);
  }
  
  &:active {
    background-color: var(--color-accent);
  }
  
  &.collapsed-left {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    background-color: transparent;
    
    &::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: var(--color-border);
      opacity: 0.5;
    }
    
    &:hover::after {
      width: 4px;
      background-color: var(--color-accent);
      opacity: 1;
    }
  }
  
  &.collapsed-right {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    background-color: transparent;
    
    &::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: var(--color-border);
      opacity: 0.5;
    }
    
    &:hover::after {
      width: 4px;
      background-color: var(--color-accent);
      opacity: 1;
    }
  }
}

.cart-section {
  overflow: hidden;
}

.media-section {
  overflow: hidden;
  flex-shrink: 0;
}

.media-resize-handle {
  width: 5px;
  background-color: var(--color-border);
  cursor: col-resize;
  transition: background-color var(--transition-fast);
  flex-shrink: 0;

  &:hover {
    background-color: var(--color-accent);
  }
}
</style>
