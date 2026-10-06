<template>
  <div class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog update-dialog" role="dialog" aria-modal="true" :aria-label="t('update.updateAvailable')">
      <div class="dialog-header">
        <div class="header-title">
          <span class="material-symbols-rounded header-icon">system_update</span>
          <h3>{{ t('update.updateAvailable') }}</h3>
        </div>
        <button
          class="icon-btn"
          :disabled="downloading"
          :title="t('actions.close')"
          :aria-label="t('actions.close')"
          @click="handleCancel"
        >
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="dialog-body">
        <div v-if="!downloading && !downloaded" class="update-info">
          <dl class="versions">
            <dt>{{ t('update.currentVersion') }}</dt>
            <dd>{{ currentVersion }}</dd>
            <dt>{{ t('update.newVersion') }}</dt>
            <dd class="new-version">{{ newVersion }}</dd>
          </dl>

          <div v-if="releaseNotes" class="release-notes">
            <h4>{{ t('update.whatsNew') }}</h4>
            <div class="notes-content">{{ releaseNotes }}</div>
          </div>

          <p class="update-prompt">
            {{ isManualUpdate ? t('update.manualUpdatePrompt') : t('update.updatePrompt') }}
          </p>
        </div>

        <div v-if="downloading" class="download-progress">
          <div class="progress-info">
            <span class="material-symbols-rounded spinning">sync</span>
            <p>{{ t('update.downloading') }}...</p>
            <span class="progress-text">{{ Math.round(downloadPercent) }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: downloadPercent + '%' }"></div>
          </div>
        </div>

        <div v-if="downloaded" class="download-complete">
          <span class="material-symbols-rounded icon-success">check_circle</span>
          <p class="complete-title">{{ t('update.downloadComplete') }}</p>
          <p class="install-info">{{ t('update.installInfo') }}</p>
        </div>

        <div v-if="error" class="error-message" role="alert">
          <span class="material-symbols-rounded">error</span>
          <p>{{ error }}</p>
        </div>
      </div>

      <div v-if="!downloading" class="dialog-footer">
        <button
          v-if="!downloaded"
          class="btn"
          @click="handleCancel"
        >
          {{ t('update.later') }}
        </button>
        <button
          v-if="!downloaded && !isManualUpdate"
          class="btn primary"
          @click="handleDownload"
        >
          {{ t('update.downloadAndInstall') }}
        </button>
        <button
          v-if="!downloaded && isManualUpdate"
          class="btn primary"
          @click="handleOpenDownloadPage"
        >
          {{ t('update.goToDownloadPage') }}
        </button>
        <button
          v-if="downloaded"
          class="btn"
          @click="handleCancel"
        >
          {{ t('update.installOnExit') }}
        </button>
        <button
          v-if="downloaded"
          class="btn primary"
          @click="handleInstall"
        >
          {{ t('update.installNow') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  currentVersion: string;
  newVersion: string;
  releaseNotes?: string;
  releaseDate?: string;
  isManualUpdate?: boolean;
  downloadUrl?: string;
}>();

const emit = defineEmits<{
  close: [];
  download: [];
  install: [];
}>();

const { t } = useLocalization();

const downloading = ref(false);
const downloaded = ref(false);
const downloadPercent = ref(0);
const error = ref('');

let updateUnsubscribers: (() => void)[] = [];

onMounted(() => {
  if (import.meta.client && window.electronAPI) {
    updateUnsubscribers = [
      // Listen for download progress
      window.electronAPI.onUpdateDownloadProgress((_event, progress) => {
        downloading.value = true;
        downloadPercent.value = progress.percent;
      }),

      // Listen for download complete
      window.electronAPI.onUpdateDownloaded(() => {
        downloading.value = false;
        downloaded.value = true;
      }),

      // Listen for errors
      window.electronAPI.onUpdateError((_event, errorMessage) => {
        error.value = errorMessage;
        downloading.value = false;
      }),
    ];
  }
});

onUnmounted(() => {
  updateUnsubscribers.forEach(unsubscribe => unsubscribe());
  updateUnsubscribers = [];
});

const handleDownload = async () => {
  if (import.meta.client && window.electronAPI) {
    downloading.value = true;
    error.value = '';
    const result = await window.electronAPI.downloadUpdate();
    if (!result.success) {
      error.value = result.error || t('update.downloadFailed');
      downloading.value = false;
    }
  }
};

const handleOpenDownloadPage = async () => {
  if (import.meta.client && window.electronAPI) {
    const url = props.downloadUrl || 'https://github.com/Stevesibilia/cuebard/releases/latest';
    await window.electronAPI.openExternal(url);
    emit('close');
  }
};

const handleInstall = () => {
  if (import.meta.client && window.electronAPI) {
    window.electronAPI.installUpdate();
  }
};

const handleCancel = () => {
  if (!downloading.value) {
    emit('close');
  }
};
</script>

<style scoped lang="scss">
@use '~/assets/styles/dialog' as dialog;
@include dialog.base;

.update-dialog {
  width: 520px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-icon {
  font-size: 20px;
  color: var(--color-accent);
}

.versions {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  margin: 0 0 16px;

  dt {
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .new-version {
    color: var(--color-accent);
  }
}

.release-notes {
  margin-bottom: 16px;

  h4 {
    margin: 0 0 6px;
    font-size: var(--font-size-label);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}

.notes-content {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
  background: var(--color-field);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.update-prompt {
  margin: 0;
  color: var(--color-text-primary);
  line-height: 1.5;
}

.download-progress {
  padding: 8px 0;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  p {
    flex: 1;
    margin: 0;
  }

  .material-symbols-rounded {
    font-size: 20px;
    color: var(--color-accent);
  }
}

.spinning {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-text {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
}

.progress-track {
  width: 100%;
  height: 6px;
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

.download-complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 8px 0;

  p {
    margin: 0;
  }
}

.icon-success {
  font-size: 40px;
  color: var(--color-success);
}

.complete-title {
  font-weight: 600;
}

.install-info {
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.error-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--color-danger-tint);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
  color: var(--color-danger-text);

  p {
    margin: 0;
  }

  .material-symbols-rounded {
    font-size: 18px;
  }
}
</style>
