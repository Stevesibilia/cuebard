import { watch } from 'vue';
import type { ThemeMode } from '~/types/project';
import { THEME_LIST, DEFAULT_THEME } from '~/types/project';

/**
 * Registers IPC listeners for application menu actions (theme toggle,
 * accent color, language, about, open-project-file, minimal mode).
 */
export const useMenuListeners = () => {
  const { currentProject, saveProject, openProject, closeProject, flushPendingSave, visualDisplayEnabled, setVisualDisplayEnabled } = useProject();
  const { setLocale, currentLocale } = useLocalization();
  const theme = useState('theme', () => 'cobalt');

  const showColorPicker = ref(false);
  const showAboutModal = ref(false);
  const isMinimalMode = ref(false);

  const toggleMinimalMode = async () => {
    if (!import.meta.client || !window.electronAPI) return;
    isMinimalMode.value = !isMinimalMode.value;
    if (isMinimalMode.value) {
      await window.electronAPI.enterMinimalMode();
    } else {
      await window.electronAPI.exitMinimalMode();
    }
  };

  const registerListeners = () => {
    if (!import.meta.client || !window.electronAPI) return;

    window.electronAPI.onMenuSetTheme((_event, themeId) => {
      if (!THEME_LIST.some(t => t.id === themeId)) return;
      theme.value = themeId;
      if (currentProject.value) {
        currentProject.value.theme ??= { ...DEFAULT_THEME };
        currentProject.value.theme.mode = themeId as ThemeMode;
        saveProject();
      }
      // Mirror to main so the menu radio survives rebuilds
      window.electronAPI.setCurrentTheme(themeId);
    });

    window.electronAPI.onMenuChangeAccentColor(() => {
      showColorPicker.value = true;
    });

    window.electronAPI.onMenuChangeLanguage((_event, locale) => {
      setLocale(locale);
    });

    window.electronAPI.onMenuShowAbout(() => {
      showAboutModal.value = true;
    });

    window.electronAPI.onMenuToggleMinimalMode(() => {
      toggleMinimalMode();
    });

    window.electronAPI.onMenuToggleVisualDisplay(() => {
      setVisualDisplayEnabled(!visualDisplayEnabled.value);
    });

    // Keep the main process menu state in sync with the active project's flag.
    watch(
      visualDisplayEnabled,
      (enabled) => {
        if (window.electronAPI?.setVisualDisplayEnabled) {
          window.electronAPI.setVisualDisplayEnabled(enabled);
        }
      },
      { immediate: true }
    );

    // File association / double-click: same open path as File > Open.
    // openProject reports its own failures, so nothing is shown here.
    window.electronAPI.onOpenProjectFile(async (_event, data) => {
      if (currentProject.value) {
        await closeProject();
      }
      const ok = await openProject(data.filePath);
      if (ok) console.log('Opened project from file association:', data.filePath);
    });

    // Close handshake: main holds the window close until the pending
    // debounced save is written (or it gives up after 3 s)
    window.electronAPI.onBeforeClose(async () => {
      try {
        await flushPendingSave();
      } finally {
        window.electronAPI.notifyFlushed();
      }
    });

    // Sync menu with current UI language on startup
    window.electronAPI.updateMenuLanguage(currentLocale.value);
  };

  return {
    theme,
    showColorPicker,
    showAboutModal,
    isMinimalMode,
    toggleMinimalMode,
    registerListeners,
  };
};
