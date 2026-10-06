<template>
  <div class="playlist-view">
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
  </div>
</template>

<script setup lang="ts">
const { currentProject } = useProject();
const { t } = useLocalization();
const { importAudioFile } = usePlaylistActions();

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
