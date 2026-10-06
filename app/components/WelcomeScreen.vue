<template>
  <div class="welcome-screen">
    <div class="welcome-container" :class="{ 'has-recent': recentProjects.length > 0 }">
      <div class="welcome-intro">
        <div class="welcome-mark">
          <img
            :src="'./assets/icons/cuebard-mark.svg'"
            alt=""
            class="welcome-logo"
          />
        </div>
        <h1 class="welcome-title">{{ t('welcome.title') }}</h1>
        <p class="welcome-subtitle">{{ t('welcome.subtitle') }}</p>

        <div class="welcome-actions">
          <button class="welcome-button primary" @click="handleNewProject">
            <span class="material-symbols-rounded">add</span>
            <span>{{ t('welcome.newProject') }}</span>
          </button>
          <button class="welcome-button" @click="handleOpenProject">
            <span class="material-symbols-rounded">folder_open</span>
            <span>{{ t('welcome.openProject') }}</span>
          </button>
        </div>

        <span v-if="appVersion" class="welcome-version">{{ t('recent.versionLine', { version: appVersion }) }}</span>
      </div>

      <section v-if="recentProjects.length > 0" class="welcome-recent" :aria-label="t('recent.title')">
        <h2 class="recent-label">{{ t('recent.title') }}</h2>
        <button
          v-for="project in recentProjects"
          :key="project.path"
          class="recent-entry"
          :title="project.path"
          @click="openProject(project.path)"
        >
          <span class="recent-icon">
            <span class="material-symbols-rounded">description</span>
          </span>
          <span class="recent-text">
            <span class="recent-name">{{ project.name || fileStem(project.path) }}</span>
            <span class="recent-path">{{ project.path }}</span>
          </span>
          <span class="recent-when">{{ formatOpenedAt(project.openedAt, now, currentLocale) }}</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatOpenedAt } from '~/utils/recentDate';

const { handleNewProject, handleOpenProject } = useProjectDialogs();
const { openProject } = useProject();
const { recentProjects, refreshRecentProjects } = useRecentProjects();
const { t, currentLocale } = useLocalization();

// Shown once it arrives; no made-up fallback
const appVersion = ref('');
const now = new Date();

const fileStem = (filePath: string): string => {
  const base = filePath.split(/[\\/]/).pop() || filePath;
  return base.replace(/\.[^.]+$/, '');
};

onMounted(async () => {
  refreshRecentProjects();
  if (import.meta.client && window.electronAPI?.getAppVersion) {
    appVersion.value = await window.electronAPI.getAppVersion();
  }
});
</script>

<style scoped lang="scss">
.welcome-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  background: var(--color-background);
  color: var(--color-text-primary);
}

.welcome-container {
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: 32px;
  display: flex;
  flex-wrap: wrap;
  gap: 56px;
  align-items: flex-start;

  &.has-recent {
    max-width: 880px;
  }
}

.welcome-intro {
  flex: 1 1 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}

.welcome-mark {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  background: var(--color-field);
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.welcome-title {
  margin: 0;
  font-family: var(--font-brand);
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary);
}

.welcome-subtitle {
  margin: 0;
  max-width: 320px;
  font-size: 16px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.welcome-button {
  height: var(--size-action);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 20px;
  }

  &:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-accent);
  }

  &.primary {
    border-color: var(--color-accent);
    background-color: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 600;

    &:hover {
      border-color: var(--color-accent-hover);
      background-color: var(--color-accent-hover);
    }
  }
}

.welcome-version {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
}

.welcome-recent {
  flex: 1 1 360px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recent-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.recent-entry {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);
  background: var(--color-panel);
  color: var(--color-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);

  &:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-accent);
  }
}

.recent-icon {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--radius-control);
  background: var(--color-field);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);

  .material-symbols-rounded {
    font-size: 18px;
  }
}

.recent-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.recent-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-path {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-when {
  flex: none;
  font-size: 12px;
  color: var(--color-text-muted);
}

/* Project name prompt (built in useProjectDialogs, appended to #app) */
:global(.name-prompt-overlay) {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: color-mix(in srgb, var(--color-background) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.name-prompt) {
  width: 400px;
  max-width: 90vw;
  box-sizing: border-box;
  background: var(--color-chrome);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);
  color: var(--color-text-primary);
}

:global(.name-prompt-title) {
  height: 44px;
  margin: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  font-size: var(--font-size-title);
  font-weight: 600;
}

:global(.name-prompt-input) {
  display: block;
  width: calc(100% - 32px);
  height: var(--size-control-lg);
  margin: 16px;
  box-sizing: border-box;
  padding: 0 10px;
  background: var(--color-field);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  color: var(--color-text-primary);
  font: inherit;
  outline: none;
}

:global(.name-prompt-input:focus) {
  border-color: var(--color-accent);
}

:global(.name-prompt-buttons) {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--color-divider);
}

:global(.name-prompt-btn) {
  height: var(--size-control);
  padding: 0 14px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

:global(.name-prompt-btn:hover) {
  background-color: var(--color-surface-hover);
}

:global(.name-prompt-btn.primary) {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 600;
}

:global(.name-prompt-btn.primary:hover) {
  border-color: var(--color-accent-hover);
  background: var(--color-accent-hover);
}
</style>
