<template>
  <div v-if="isOpen" class="dialog-overlay" @click.self="closeModal">
    <div class="dialog youtube-dialog" role="dialog" aria-modal="true" :aria-label="t('youtube.importFromYouTube')">
      <div class="dialog-header">
        <h3>{{ t('youtube.importFromYouTube') }}</h3>
        <button class="icon-btn" :title="t('actions.close')" :aria-label="t('actions.close')" @click="closeModal">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-field">
          <span class="material-symbols-rounded search-icon">search</span>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('youtube.searchPlaceholder')"
            :aria-label="t('youtube.searchPlaceholder')"
            @keyup.enter="performSearch"
          />
        </div>
        <button class="btn primary" @click="performSearch" :disabled="isSearching || !searchQuery">
          {{ t('dialogs.search') }}
        </button>
      </div>

      <div class="dialog-body results-section">
        <div v-if="isSearching" class="state-message">
          <span class="material-symbols-rounded spinning">progress_activity</span>
          <p>{{ t('youtube.searching') }}</p>
        </div>

        <div v-else-if="searchError" class="state-message error">
          <span class="material-symbols-rounded">error</span>
          <p>{{ searchError }}</p>
        </div>

        <div v-else-if="searchResults.length === 0 && hasSearched" class="state-message">
          <span class="material-symbols-rounded">search_off</span>
          <p>{{ t('youtube.noResults') }}</p>
        </div>

        <div v-else-if="searchResults.length > 0" class="results-list">
          <div
            v-for="video in searchResults"
            :key="video.id"
            class="video-item"
            :class="{ selected: selectedVideo?.id === video.id }"
          >
            <img :src="video.thumbnail" :alt="video.title" class="video-thumbnail" />
            <div class="video-info">
              <h4 class="video-title">{{ video.title }}</h4>
              <p class="video-channel">{{ video.channelTitle }}</p>
              <p v-if="video.length" class="video-duration">{{ video.length }}</p>
            </div>
            <div class="video-actions">
              <button class="btn" @click="previewVideo(video)">
                <span class="material-symbols-rounded">play_circle</span>
                <span>{{ t('youtube.preview') }}</span>
              </button>
              <button
                class="btn primary"
                @click="downloadVideo(video)"
                :disabled="isDownloading(video.id)"
              >
                <span class="material-symbols-rounded">download</span>
                <span>{{ isDownloading(video.id) ? t('youtube.downloading') : t('youtube.download') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Download Queue -->
      <div v-if="downloadQueue.length > 0" class="download-queue">
        <h4>{{ t('youtube.downloadQueue') }}</h4>
        <div class="queue-list">
          <div
            v-for="download in downloadQueue"
            :key="download.videoId"
            class="queue-item"
            :class="`status-${download.status}`"
          >
            <div class="queue-info">
              <span class="queue-title">{{ download.title }}</span>
              <span class="queue-status">{{ getDownloadStatus(download) }}</span>
            </div>
            <div class="progress-row">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: download.progress + '%' }"></div>
              </div>
              <span class="progress-text">{{ download.progress.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProject } from '~/composables/useProject';
import { resolveWaveformPath } from '~/utils/paths';

const { t } = useLocalization();
const { currentProject, addItem, triggerWaveformUpdate } = useProject();

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  length?: string;
}

interface DownloadProgress {
  videoId: string;
  title: string;
  progress: number;
  status: 'downloading' | 'converting' | 'completed' | 'error';
  error?: string;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const searchQuery = ref('');
const searchResults = ref<YouTubeVideo[]>([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const searchError = ref('');
const selectedVideo = ref<YouTubeVideo | null>(null);
const downloadQueue = ref<DownloadProgress[]>([]);

const performSearch = async () => {
  if (!searchQuery.value.trim()) return;

  isSearching.value = true;
  searchError.value = '';
  hasSearched.value = true;
  searchResults.value = [];

  try {
    const results = await window.electronAPI.searchYouTube(searchQuery.value);
    searchResults.value = results;
  } catch (error: any) {
    searchError.value = error.message || t('youtube.searchError');
    console.error('YouTube search error:', error);
  } finally {
    isSearching.value = false;
  }
};

const previewVideo = (video: YouTubeVideo) => {
  selectedVideo.value = video;
  // Open in system browser instead of iframe (works in production)
  if (import.meta.client && window.electronAPI) {
    window.electronAPI.openExternal(`https://www.youtube.com/watch?v=${video.id}`);
  }
};

const downloadVideo = async (video: YouTubeVideo) => {
  if (!currentProject.value) return;
  
  // Add to download queue
  const downloadItem: DownloadProgress = {
    videoId: video.id,
    title: video.title,
    progress: 0,
    status: 'downloading'
  };
  downloadQueue.value.push(downloadItem);

  try {
    // Check if project is loaded
    console.log('Current project:', currentProject.value);
    console.log('Project folderPath:', currentProject.value?.folderPath);
    
    if (!currentProject.value || !currentProject.value.folderPath) {
      throw new Error(t('dialogs.noProjectOpen'));
    }
    
    console.log('Downloading to project:', currentProject.value.folderPath);
    
    // Start download
    const result = await window.electronAPI.downloadYouTubeAudio(
      video.id,
      video.title,
      currentProject.value.folderPath,
      (progress: any) => {
        // Update progress
        const item = downloadQueue.value.find(d => d.videoId === video.id);
        if (item) {
          item.progress = progress.percentage || 0;
          item.status = progress.status || 'downloading';
        }
      }
    );

    // Mark as completed
    const item = downloadQueue.value.find(d => d.videoId === video.id);
    if (item) {
      item.progress = 100;
      item.status = 'completed';
      
      // Import the downloaded file to the playlist
      await importDownloadedFile(result.fileName, result.file);
      
      // Remove from queue after 2 seconds
      setTimeout(() => {
        downloadQueue.value = downloadQueue.value.filter(d => d.videoId !== video.id);
      }, 2000);
    }
  } catch (error: any) {
    const item = downloadQueue.value.find(d => d.videoId === video.id);
    if (item) {
      item.status = 'error';
      item.error = error.message || t('youtube.downloadError');
    }
    console.error('YouTube download error:', error);
  }
};

const importDownloadedFile = async (fileName: string, filePath: string) => {
  if (!currentProject.value) return;

  try {
    const { v4: uuidv4 } = await import('uuid');
    const { createDefaultAudioItem } = await import('~/types/project');
    
    // Get audio duration
    const duration = await getAudioDuration(filePath);

    // Create audio item
    const uuid = uuidv4();
    const audioItem: any = {
      ...createDefaultAudioItem(),
      uuid,
      index: [currentProject.value.items.length],
      displayName: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
      type: 'audio',
      mediaFileName: fileName,
      mediaPath: `media/${fileName}`, // Relative path
      waveformPath: `${uuid}.json`, // bare filename; resolved against folderPath at runtime
      waveform: undefined,
      outPoint: duration,
      duration
    };

    // Add to playlist
    addItem(audioItem);
    
    // Generate waveform asynchronously
    generateWaveformAsync(audioItem);
  } catch (error) {
    console.error('Failed to import downloaded file:', error);
  }
};

const getAudioDuration = async (filePath: string): Promise<number> => {
  // Use Audio API to get duration
  return new Promise((resolve) => {
    const audio = new Audio(`file:///${filePath.replace(/\\/g, '/')}`);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      resolve(60); // Default to 60 seconds if can't determine
    });
  });
};

const generateWaveformAsync = async (audioItem: any) => {
  if (!currentProject.value) return;
  
  try {
    const mediaPath = `${currentProject.value.folderPath}/media/${audioItem.mediaFileName}`;
    const waveformPath = resolveWaveformPath(currentProject.value.folderPath, audioItem.waveformPath);
    const result = await window.electronAPI.generateWaveform(mediaPath, waveformPath);

    if (result.success) {
      const waveformFile = await window.electronAPI.readFile(waveformPath);
      if (waveformFile.success && waveformFile.data) {
        audioItem.waveform = JSON.parse(waveformFile.data);
        console.log('Waveform loaded and applied to item');
        triggerWaveformUpdate();
        
        // Force a save to trigger reactivity
        const { saveProject } = useProject();
        await saveProject();
      }
    }
  } catch (error) {
    console.error('Failed to generate waveform:', error);
  }
};

const isDownloading = (videoId: string) => {
  return downloadQueue.value.some(d => d.videoId === videoId && d.status !== 'completed' && d.status !== 'error');
};

const getDownloadStatus = (download: DownloadProgress) => {
  switch (download.status) {
    case 'downloading':
      return t('youtube.statusDownloading');
    case 'converting':
      return t('youtube.statusConverting');
    case 'completed':
      return t('youtube.statusCompleted');
    case 'error':
      return download.error || t('youtube.statusError');
    default:
      return '';
  }
};

const closeModal = () => {
  emit('close');
  // Reset state
  searchQuery.value = '';
  searchResults.value = [];
  hasSearched.value = false;
  selectedVideo.value = null;
};
</script>

<style scoped lang="scss">
@use '~/assets/styles/dialog' as dialog;
@include dialog.base;

.youtube-dialog {
  width: 760px;
  height: 80vh;
}

.search-section {
  flex: none;
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-divider);
}

.search-field {
  position: relative;
  flex: 1;

  input {
    width: 100%;
    height: var(--size-control);
    box-sizing: border-box;
    padding: 0 10px 0 32px;
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius-control);
    background: var(--color-field);
    color: var(--color-text-primary);
    font: inherit;
    outline: none;

    &:focus {
      border-color: var(--color-accent);
    }
  }
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.results-section {
  flex: 1;
  min-height: 0;
  padding: 8px;
}

.state-message {
  height: 100%;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);

  p {
    margin: 0;
    max-width: 360px;
    line-height: 1.5;
  }

  .material-symbols-rounded {
    font-size: 36px;
  }

  &.error {
    color: var(--color-danger-text);
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.video-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--radius-control);

  &:hover {
    background-color: var(--color-surface-hover);
  }

  &.selected {
    background-color: var(--color-accent-tint);
    outline: 1.5px solid var(--color-accent);
    outline-offset: -1.5px;
  }
}

.video-thumbnail {
  width: 120px;
  height: 68px;
  flex: none;
  object-fit: cover;
  border-radius: var(--radius-control);
  background: var(--color-field);
}

.video-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.video-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-channel {
  margin: 0;
  font-size: var(--font-size-label);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-duration {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

.video-actions {
  flex: none;
  display: flex;
  gap: 6px;
}

.download-queue {
  flex: none;
  max-height: 30%;
  overflow-y: auto;
  padding: 12px 16px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-panel);

  h4 {
    margin: 0 0 8px;
    font-size: var(--font-size-label);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queue-info {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.queue-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-status {
  flex: none;
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.status-completed .queue-status {
  color: var(--color-success);
}

.status-error .queue-status {
  color: var(--color-danger-text);
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: var(--color-field);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-pill);
  transition: width 0.3s ease;
}

.status-completed .progress-fill {
  background: var(--color-success);
}

.status-error .progress-fill {
  background: var(--color-danger);
}

.progress-text {
  min-width: 48px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
