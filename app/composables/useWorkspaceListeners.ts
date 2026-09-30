import type { AudioItem } from '~/types/project';

/**
 * IPC listeners scoped to the main workspace: save, export, close,
 * open folder, and keyboard shortcuts. Trigger/stop items from the
 * remote-control API live in useControlSurfaces.
 */
export const useWorkspaceListeners = () => {
  const { selectedItem, saveNow, closeProject, currentProject } = useProject();
  const { playCue } = useAudioEngine();
  const { t } = useLocalization();

  const progressModal = ref({
    visible: false,
    title: '',
    message: '',
    percentage: 0,
  });

  /**
   * Subscribe to the workspace's menu events. Returns a function that
   * removes every subscription it added; call it when the workspace unmounts.
   */
  const registerListeners = (): (() => void) => {
    if (!import.meta.client || !window.electronAPI) return () => {};

    const unsubscribers: (() => void)[] = [];

    // Explicit Save writes immediately, without the debounce
    unsubscribers.push(window.electronAPI.onMenuSaveProject(() => {
      saveNow();
    }));

    unsubscribers.push(window.electronAPI.onMenuExportProject(async () => {
      if (!currentProject.value) return;

      try {
        const progressListener: Parameters<typeof window.electronAPI.onExportProgress>[0] = (_event, data) => {
          progressModal.value = {
            visible: true,
            title: t('exportProgress.title'),
            message: `${t('exportProgress.message')} ${data.fileName}...`,
            percentage: data.percentage,
          };
        };

        const removeProgressListener = window.electronAPI.onExportProgress(progressListener);
        let result: Awaited<ReturnType<typeof window.electronAPI.exportProject>>;
        try {
          result = await window.electronAPI.exportProject(currentProject.value.folderPath, currentProject.value.name);
        } finally {
          removeProgressListener();
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        progressModal.value.visible = false;

        if (result.success) {
          console.log('Project exported successfully:', result.path);
        }
      } catch (error) {
        console.error('Export failed:', error);
        progressModal.value.visible = false;
      }
    }));

    unsubscribers.push(window.electronAPI.onMenuCloseProject(() => {
      closeProject();
    }));

    unsubscribers.push(window.electronAPI.onMenuOpenProjectFolder(() => {
      if (currentProject.value) {
        window.electronAPI.openFolder(currentProject.value.folderPath);
      }
    }));

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'F1') {
      e.preventDefault();
      if (selectedItem.value && selectedItem.value.type === 'audio') {
        playCue(selectedItem.value as AudioItem);
      }
    }
  };

  return {
    progressModal,
    registerListeners,
    handleKeydown,
  };
};
