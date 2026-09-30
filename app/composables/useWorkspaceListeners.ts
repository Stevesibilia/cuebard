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

  const registerListeners = () => {
    if (!import.meta.client || !window.electronAPI) return;

    // Explicit Save writes immediately, without the debounce
    window.electronAPI.onMenuSaveProject(() => {
      saveNow();
    });

    window.electronAPI.onMenuExportProject(async () => {
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

        window.electronAPI.onExportProgress(progressListener);
        const result = await window.electronAPI.exportProject(currentProject.value.folderPath, currentProject.value.name);
        window.electronAPI.removeExportProgressListener(progressListener);
        await new Promise(resolve => setTimeout(resolve, 500));
        progressModal.value.visible = false;

        if (result.success) {
          console.log('Project exported successfully:', result.path);
        }
      } catch (error) {
        console.error('Export failed:', error);
        progressModal.value.visible = false;
      }
    });

    window.electronAPI.onMenuCloseProject(() => {
      closeProject();
    });

    window.electronAPI.onMenuOpenProjectFolder(() => {
      if (currentProject.value) {
        window.electronAPI.openFolder(currentProject.value.folderPath);
      }
    });
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
