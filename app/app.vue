<template>
  <div id="app" :data-theme="theme">
    <WelcomeScreen v-if="!currentProject" />
    <MinimalWorkspace v-else-if="isMinimalMode" @exit-minimal="toggleMinimalMode" />
    <MainWorkspace v-else />
    
    <!-- Accent Color Picker Modal -->
    <div v-if="showColorPicker" class="color-picker-overlay" @click="showColorPicker = false">
      <div class="color-picker-dialog" role="dialog" aria-modal="true" :aria-label="t('app.chooseAccentColor')" @click.stop>
        <div class="picker-header">
          <h3>{{ t('app.chooseAccentColor') }}</h3>
        </div>
        <div class="color-grid">
          <button
            v-for="color in accentColors"
            :key="color"
            class="color-option"
            :class="{ current: color === currentAccent }"
            :style="{ backgroundColor: color }"
            :title="color"
            :aria-label="color"
            @click="changeAccentColor(color)"
          ></button>
        </div>
        <div class="picker-footer">
          <button class="close-dialog" @click="showColorPicker = false">{{ t('project.cancel') }}</button>
        </div>
      </div>
    </div>

    <!-- About Modal -->
    <AboutModal v-if="showAboutModal" @close="showAboutModal = false" />
    
    <!-- Update Modal -->
    <UpdateModal
      v-if="showUpdateModal"
      :current-version="updateInfo.currentVersion"
      :new-version="updateInfo.newVersion"
      :release-notes="updateInfo.releaseNotes"
      :release-date="updateInfo.releaseDate"
      :is-manual-update="updateInfo.isManualUpdate"
      :download-url="updateInfo.downloadUrl"
      @close="showUpdateModal = false"
    />
    
    <!-- Progress Modal for Import/Export -->
    <ProgressModal
      :visible="progressModal.visible"
      :title="progressModal.title"
      :message="progressModal.message"
      :percentage="progressModal.percentage"
    />
    
    <!-- Project Selection Modal -->
    <ProjectSelectionModal
      :visible="showProjectSelection"
      :projects="availableProjects"
      @select="handleProjectSelection"
      @cancel="handleProjectSelectionCancel"
    />

    <!-- Non-blocking error messages -->
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import 'material-symbols';
import { DEFAULT_THEME } from '~/types/project';

const { currentProject, saveProject } = useProject();
const { currentLocale, getDirection, t } = useLocalization();

// Initialize state viewer for dev mode
useStateViewer();

// Composables
const { theme, showColorPicker, showAboutModal, isMinimalMode, toggleMinimalMode, registerListeners: registerMenuListeners } = useMenuListeners();
const { progressModal, showProjectSelection, availableProjects, handleProjectSelection, handleProjectSelectionCancel, registerListeners: registerImportExportListeners } = useImportExport();
const { showUpdateModal, updateInfo, registerListeners: registerUpdateListeners } = useUpdateChecker();
// Hotkeys, MIDI and remote-control triggers: one instance for the whole app
const controlSurfaces = useControlSurfaces();

const accentColors = [
  '#0f62fe', '#0353e9', '#002d9c', // Blues
  '#da1e28', '#a2191f', '#750e13', // Reds
  '#24a148', '#198038', '#0e6027', // Greens
  '#f1c21b', '#d2a106', '#b28600', // Yellows
  '#8a3ffc', '#6929c4', '#491d8b', // Purples
  '#ff7eb6', '#ee5396', '#d02670', // Pinks
];

const currentAccent = computed(() => currentProject.value?.theme?.accentColor?.toLowerCase() ?? null);

const changeAccentColor = (color: string) => {
  if (currentProject.value) {
    currentProject.value.theme ??= { ...DEFAULT_THEME };
    currentProject.value.theme.accentColor = color;
    document.documentElement.style.setProperty('--color-accent-custom', color);
    saveProject();
    showColorPicker.value = false;
  }
};

// Register IPC listeners
onMounted(() => {
  registerMenuListeners();
  registerImportExportListeners();
  registerUpdateListeners();
  controlSurfaces.mount();
});

onUnmounted(() => {
  controlSurfaces.unmount();
});

// Mirror data-theme onto <html> so CSS variables cascade to Teleport portals
// (the menu/dialog overlays that mount under <body>, outside #app).
watch(theme, (mode) => {
  if (import.meta.client) {
    document.documentElement.setAttribute('data-theme', mode);
  }
}, { immediate: true });

// Set initial theme from project
watch(currentProject, (project) => {
  if (project) {
    // theme may be absent in files from other builds (normalizeProject
    // defaults it on open; read defensively anyway)
    const mode = project.theme?.mode ?? DEFAULT_THEME.mode;
    const accentColor = project.theme?.accentColor;
    theme.value = mode;
    if (import.meta.client && window.electronAPI) {
      // Mirror to main so the View > Theme radio matches the loaded project
      window.electronAPI.setCurrentTheme(mode);
    }
    if (import.meta.client) {
      if (accentColor) {
        document.documentElement.style.setProperty('--color-accent-custom', accentColor);
      } else {
        // No custom accent — let the active theme's own accent show through
        document.documentElement.style.removeProperty('--color-accent-custom');
      }
    }
  }
}, { immediate: true });

// Apply RTL direction when locale changes
watch(currentLocale, () => {
  if (import.meta.client) {
    const direction = getDirection();
    document.documentElement.setAttribute('dir', direction);
  }
}, { immediate: true });

// Enable drag-and-drop globally.
onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
    }, true);
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    }, true);
    // A drop outside any drop zone must do nothing (by default the window
    // would navigate to the dropped file). Bubble phase: drop zones run first.
    document.addEventListener('drop', (e) => {
      e.preventDefault();
    });
  }
});
</script>

<style scoped>
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.color-picker-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--color-background) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.color-picker-dialog {
  background: var(--color-chrome);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-card);
  color: var(--color-text-primary);
  max-width: 90vw;
}

.picker-header {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-divider);
}

.picker-header h3 {
  margin: 0;
  font-size: var(--font-size-title);
  font-weight: 600;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(6, 44px);
  gap: 8px;
  padding: 16px;
}

.color-option {
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.color-option:hover {
  transform: scale(1.08);
}

.color-option.current {
  box-shadow: 0 0 0 2px var(--color-chrome), 0 0 0 4px var(--color-text-primary);
}

.picker-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--color-divider);
}

.close-dialog {
  height: var(--size-control);
  padding: 0 14px;
  background: transparent;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  color: var(--color-text-primary);
  font: inherit;
  cursor: pointer;
}

.close-dialog:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-accent);
}
</style>
