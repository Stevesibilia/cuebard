/**
 * The recent projects list of the welcome screen. The list itself lives in
 * the main process (recent-projects.json in the app's data folder); this
 * composable reads it and records opened or created projects.
 */
import type { RecentProject } from '~/types/ipc';

export const useRecentProjects = () => {
  const recentProjects = useState<RecentProject[]>('recentProjects', () => []);

  // Reads the list; the main process drops entries whose file is gone
  const refreshRecentProjects = async () => {
    if (!import.meta.client || !window.electronAPI) return;
    try {
      recentProjects.value = await window.electronAPI.getRecentProjects();
    } catch (error) {
      console.error('Failed to read recent projects:', error);
    }
  };

  // Never fails the open or create it follows
  const recordRecentProject = async (filePath: string, name: string) => {
    if (!import.meta.client || !window.electronAPI) return;
    try {
      await window.electronAPI.addRecentProject(filePath, name);
    } catch (error) {
      console.error('Failed to record recent project:', error);
    }
  };

  return { recentProjects, refreshRecentProjects, recordRecentProject };
};
