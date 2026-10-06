<template>
  <div class="playlist-view">
    <div class="playlist-header">
      <h2>{{ t('playlist.title') }}</h2>
      <div class="playlist-actions">
        <button class="action-btn" @click="handleImport" :disabled="!currentProject">
          <span class="material-symbols-rounded">audio_file</span>
          <span>{{ t('playlist.importAudio') }}</span>
        </button>
        <button class="action-btn youtube-btn" @click="showYouTubeModal = true" :disabled="!currentProject">
          <span class="material-symbols-rounded">youtube_activity</span>
          <span>{{ t('youtube.importFromYouTube') }}</span>
        </button>
        <button class="action-btn" @click="handleAddGroup" :disabled="!currentProject">
          <span class="material-symbols-rounded">folder</span>
          <span>{{ t('playlist.addGroup') }}</span>
        </button>
      </div>
    </div>
    
    <div class="playlist-content" @drop="handleDrop" @dragover.prevent">
      <div v-if="currentProject?.items.length === 0" class="empty-state">
        <p>{{ t('playlist.noItems') }}</p>
        <p class="hint">{{ t('playlist.importHint') }}</p>
      </div>
      
      <div v-else class="item-list">
        <PlaylistItem
          v-for="item in currentProject.items"
          :key="item.uuid"
          :item="item"
          :depth="0"
        />
      </div>
    </div>

    <!-- YouTube Import Modal -->
    <YouTubeImportModal :isOpen="showYouTubeModal" @close="showYouTubeModal = false" />
  </div>
</template>

<script setup lang="ts">
import YouTubeImportModal from './YouTubeImportModal.vue';

const { currentProject } = useProject();
const { t } = useLocalization();
const { handleImport, importAudioFile, handleAddGroup, showYouTubeModal } = usePlaylistActions();

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  
  if (!e.dataTransfer) return;
  
  const files = Array.from(e.dataTransfer.files);
  const audioFiles = files.filter(file => 
    /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)
  );

  for (const file of audioFiles) {
    // Get the file path using webUtils in Electron
    if (window.electronAPI && window.electronAPI.getFilePath) {
      const filePath = window.electronAPI.getFilePath(file);
      if (filePath) {
        await importAudioFile(filePath);
      }
    }
  }
};
</script>

<style scoped>
.playlist-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
}

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  min-height: 56px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
}

.playlist-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.playlist-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.action-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    border-color: var(--color-accent);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.playlist-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xxl);
  color: var(--color-text-secondary);
  
  p {
    margin-bottom: var(--spacing-sm);
  }
  
  .hint {
    font-size: 13px;
    font-style: italic;
  }
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>
