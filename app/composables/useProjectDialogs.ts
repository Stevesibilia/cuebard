/**
 * The New Project and Open Project flows: folder/file dialog, project name
 * prompt, then create or open. Used by the welcome screen's buttons and by
 * the File menu (subscribed once, in useMenuListeners), so the menu items
 * work whether or not a project is open.
 */
export const useProjectDialogs = () => {
  const { createNewProject, openProject } = useProject();
  const { t } = useLocalization();

  const handleNewProject = async () => {
    if (!import.meta.client || !window.electronAPI) return;

    const folderPath = await window.electronAPI.selectProjectFolder();
    if (!folderPath) return;

    // Get project name from user - using a simple component since prompt() doesn't work in Electron
    const projectName = await getProjectName();
    if (!projectName) return;

    const success = await createNewProject(projectName, folderPath);
    if (!success) {
      alert('Failed to create project');
    }
  };

  const handleOpenProject = async () => {
    if (!import.meta.client || !window.electronAPI) return;

    const projectFilePath = await window.electronAPI.selectProjectFile();
    if (!projectFilePath) return;

    // openProject reports its own failures
    await openProject(projectFilePath);
  };

  // Simple inline project name dialog
  const getProjectName = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'modal-dialog';

      const h3 = document.createElement('h3');
      h3.textContent = t('project.enterName');
      h3.className = 'modal-title';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'modal-input';
      input.placeholder = t('project.placeholder');

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'modal-buttons';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-btn modal-btn-cancel';
      cancelBtn.textContent = t('project.cancel');

      const okBtn = document.createElement('button');
      okBtn.className = 'modal-btn modal-btn-primary';
      okBtn.textContent = t('project.ok');

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(okBtn);
    
      dialog.appendChild(h3);
      dialog.appendChild(input);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);
    
      // Append to #app instead of body to inherit theme variables
      const appElement = document.getElementById('app') || document.body;
      appElement.appendChild(overlay);

      input.focus();

      const cleanup = () => {
        appElement.removeChild(overlay);
      };

      okBtn.onclick = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value || null);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          okBtn.click();
        } else if (e.key === 'Escape') {
          cancelBtn.click();
        }
      };
    });
  };

  return { handleNewProject, handleOpenProject };
};
