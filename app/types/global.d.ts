import type { IpcEvent, TriggerItemPayload, StopItemPayload, UpdateInfo, MidiConfig, DisplayState, PlayerDisplayState } from './ipc';

export {};

// Removes the subscription that returned it
type Unsubscribe = () => void;

declare global {
  interface Window {
    electronAPI: {
      selectProjectFolder: () => Promise<string | null>;
      selectProjectFile: () => Promise<string | null>;
      selectAudioFiles: () => Promise<string[] | null>;
      selectVisualMediaFiles: () => Promise<string[] | null>;
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>;
      copyFile: (source: string, destination: string, options?: { noOverwrite?: boolean }) => Promise<{ success: boolean; destPath?: string; error?: string }>;
      ensureDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      generateWaveform: (audioPath: string, outputPath: string) => Promise<{ success: boolean; error?: string }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      setCurrentProject: (projectPath: string | null) => Promise<{ success: boolean }>;
      exportProject: (projectFolderPath: string, projectName?: string) => Promise<{ success: boolean; path?: string; size?: number; canceled?: boolean; error?: string }>;
      importProject: () => Promise<{ 
        success: boolean; 
        projectPath?: string; 
        extractPath?: string; 
        multipleProjects?: boolean;
        projectFiles?: string[];
        canceled?: boolean; 
        error?: string 
      }>;
      importLpaFile: (lpaPath: string) => Promise<{ 
        success: boolean; 
        projectPath?: string; 
        extractPath?: string; 
        multipleProjects?: boolean;
        projectFiles?: string[];
        canceled?: boolean; 
        error?: string 
      }>;
      onExportProgress: (callback: (event: IpcEvent, data: { percentage: number; fileName: string }) => void) => Unsubscribe;
      onImportProgress: (callback: (event: IpcEvent, data: { percentage: number; fileName: string }) => void) => Unsubscribe;
      getFilePath: (file: File) => string | null;
      searchYouTube: (query: string) => Promise<Array<{
        id: string;
        title: string;
        thumbnail: string;
        channelTitle: string;
        length?: string;
      }>>;
      downloadYouTubeAudio: (
        videoId: string,
        title: string,
        projectFolderPath: string,
        progressCallback?: (progress: { videoId: string; percentage: number; status: string }) => void
      ) => Promise<{ success: boolean; file: string; fileName: string; title: string }>;
      onMenuNewProject: (callback: () => void) => Unsubscribe;
      onMenuOpenProject: (callback: () => void) => Unsubscribe;
      onMenuSaveProject: (callback: () => void) => Unsubscribe;
      onMenuExportProject: (callback: () => void) => Unsubscribe;
      onMenuImportProject: (callback: () => void) => Unsubscribe;
      onMenuCloseProject: (callback: () => void) => Unsubscribe;
      onMenuOpenProjectFolder: (callback: () => void) => Unsubscribe;
      onMenuSetTheme: (callback: (event: IpcEvent, themeId: string) => void) => Unsubscribe;
      onMenuChangeAccentColor: (callback: () => void) => Unsubscribe;
      onMenuChangeLanguage: (callback: (event: IpcEvent, locale: string) => void) => Unsubscribe;
      onMenuShowAbout: (callback: () => void) => Unsubscribe;
      onMenuToggleMinimalMode: (callback: () => void) => Unsubscribe;
      onMenuToggleVisualDisplay: (callback: () => void) => Unsubscribe;
      setVisualDisplayEnabled: (enabled: boolean) => Promise<{ success: boolean }>;
      setCurrentTheme: (themeId: string) => Promise<{ success: boolean }>;
      enterMinimalMode: () => Promise<void>;
      exitMinimalMode: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      updateMenuLanguage: (locale: string) => Promise<{ success: boolean }>;
      getSystemLocale: () => Promise<string>;
      getAvailableLocales: () => Promise<Array<{ code: string; name: string; direction: string }>>;
      getLocaleData: (localeCode: string) => Promise<Record<string, string>>;
      checkForUpdates: () => Promise<{ success: boolean; updateInfo?: UpdateInfo; error?: string; isManualUpdate?: boolean }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => void;
      getAppVersion: () => Promise<string>;
      onUpdateAvailable: (callback: (event: IpcEvent, info: { currentVersion: string; newVersion: string; releaseNotes?: string; releaseDate?: string }) => void) => Unsubscribe;
      onUpdateDownloadProgress: (callback: (event: IpcEvent, progress: { percent: number; transferred: number; total: number }) => void) => Unsubscribe;
      onUpdateDownloaded: (callback: (event: IpcEvent, info: { version: string }) => void) => Unsubscribe;
      onUpdateError: (callback: (event: IpcEvent, error: string) => void) => Unsubscribe;
      onManualUpdateAvailable: (callback: (event: IpcEvent, info: { currentVersion: string; newVersion: string; downloadUrl: string; isManualUpdate: boolean }) => void) => Unsubscribe;
      onTriggerItem: (callback: (event: IpcEvent, data: TriggerItemPayload) => void) => Unsubscribe;
      onStopItem: (callback: (event: IpcEvent, data: StopItemPayload) => void) => Unsubscribe;
      onOpenProjectFile: (callback: (event: IpcEvent, data: { filePath: string }) => void) => Unsubscribe;
      onOpenLpaFile: (callback: (event: IpcEvent, data: { lpaPath: string }) => void) => Unsubscribe;
      onBeforeClose: (callback: () => void) => Unsubscribe;
      notifyFlushed: () => void;
      readMidiConfig: () => Promise<MidiConfig>;
      writeMidiConfig: (config: MidiConfig) => Promise<{ success: boolean }>;
      writeClipboardText: (text: string) => Promise<{ success: boolean }>;
      importVisualMedia: (projectFolderPath: string, sourceFilePath: string, uuid: string) => Promise<{ success: boolean; mediaFileName?: string; mediaPath?: string; error?: string }>;
      readVisualMedia: (projectFolderPath: string, mediaPath: string) => Promise<{ success: boolean; data?: string; mimeType?: string; error?: string }>;
      deleteVisualMedia: (projectFolderPath: string, mediaPath: string) => Promise<{ success: boolean; error?: string }>;
      // Player window
      pushToPlayer: (displayState: PlayerDisplayState | DisplayState) => Promise<{ success: boolean; error?: string }>;
      onPlayerWindowStatusChanged: (callback: (isOpen: boolean) => void) => Unsubscribe;
      // Remote viewer (LAN browser)
      setRemoteViewerEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
      getRemoteViewerStatus: () => Promise<{ enabled: boolean; localEnabled: boolean; port: number | null; urls: string[] }>;
      // Remote Control API from the network (off = loopback only)
      setApiNetworkEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
      getApiNetworkEnabled: () => Promise<{ enabled: boolean }>;
      // Local viewer (second-monitor player window) toggle
      setLocalViewerEnabled: (enabled: boolean) => Promise<{ success: boolean; localEnabled: boolean }>;
    };
  }

  interface ImportMeta {
    client: boolean;
  }
}
