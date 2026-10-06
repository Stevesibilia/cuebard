/**
 * Playlist actions shared by the workspace toolbar and the playlist: import
 * audio files (dialog or drop), import from YouTube, add a group.
 */
import { v4 as uuidv4 } from 'uuid';
import type { AudioItem, GroupItem } from '~/types/project';
import { createDefaultAudioItem, createDefaultGroupItem } from '~/types/project';
import { resolveWaveformPath } from '~/utils/paths';
import { outPointAfterDuration } from '~/utils/trim';

export const usePlaylistActions = () => {
  const { currentProject, addItem, triggerWaveformUpdate } = useProject();

  // Shared so the toolbar opens the dialog that MainWorkspace mounts
  const showYouTubeModal = useState('youtubeImportOpen', () => false);

  const handleImport = async () => {
    if (!import.meta.client || !window.electronAPI || !currentProject.value) return;

    const filePaths = await window.electronAPI.selectAudioFiles();
    if (!filePaths || filePaths.length === 0) return;

    for (const filePath of filePaths) {
      await importAudioFile(filePath);
    }
  };

  const importAudioFile = async (sourcePath: string) => {
    if (!currentProject.value) return;

    try {
      const fileName = sourcePath.split(/[\\/]/).pop() || 'audio.mp3';
      const uuid = uuidv4();
      const destPath = `${currentProject.value.folderPath}/media/${fileName}`;

      // Copy file to media folder, never over an existing file: a clash is
      // stored as "name (2).ext" and the cue points at the name actually written
      const copyResult = await window.electronAPI.copyFile(sourcePath, destPath, { noOverwrite: true });
      if (!copyResult.success) {
        console.error('Failed to copy file:', copyResult.error);
        return;
      }
      const storedName = (copyResult.destPath ?? destPath).split(/[\\/]/).pop() || fileName;
      const storedPath = `${currentProject.value.folderPath}/media/${storedName}`;

      // Get audio duration
      const duration = await getAudioDuration(storedPath);

      // Create audio item WITHOUT waveform (will be generated async via ffmpeg)
      const audioItem: AudioItem = {
        ...createDefaultAudioItem(),
        uuid,
        index: [currentProject.value.items.length],
        displayName: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
        type: 'audio',
        mediaFileName: storedName,
        mediaPath: `media/${storedName}`, // Store relative path to project folder
        waveformPath: `${uuid}.json`, // bare filename; resolved against folderPath at runtime
        waveform: undefined, // Will be generated asynchronously
        outPoint: duration,
        duration
      } as AudioItem;

      // Add item immediately (no blocking)
      addItem(audioItem);

      // Generate waveform asynchronously using ffmpeg
      generateWaveformAsync(audioItem);
    } catch (error) {
      console.error('Error importing audio:', error);
    }
  };

  const generateWaveformAsync = async (item: AudioItem) => {
    try {
      if (!currentProject.value) return;

      // Ensure waveforms directory exists
      const waveformsDir = `${currentProject.value.folderPath}/waveforms`;
      await window.electronAPI.ensureDirectory(waveformsDir);

      // Resolve the waveform file against the current folder (stored value is a
      // bare, host-portable filename).
      const waveformPath = resolveWaveformPath(currentProject.value.folderPath, item.waveformPath);

      // Check if waveform file already exists and is valid
      const existingWaveform = await window.electronAPI.readFile(waveformPath);
      if (existingWaveform.success && existingWaveform.data) {
        try {
          const waveformData = JSON.parse(existingWaveform.data);

          // Validate waveform format (duration field is optional now)
          if (waveformData.peaks && waveformData.peaks.length > 0) {
            item.waveform = waveformData;

            // Update duration from waveform data if available (more accurate than Audio API)
            if (waveformData.duration && waveformData.duration > 0) {
              item.outPoint = outPointAfterDuration(item.outPoint, item.duration, waveformData.duration);
              item.duration = waveformData.duration;
            }

            triggerWaveformUpdate();
            console.log(`Existing waveform loaded for ${item.displayName}`);
            return;
          }
          console.warn('Invalid waveform format, regenerating...');
        } catch (e) {
          console.warn('Failed to parse existing waveform, regenerating...');
        }
      }

      // Check if generateWaveform is available
      if (!window.electronAPI.generateWaveform) {
        console.warn('generateWaveform not implemented yet - waveform will not be generated');
        console.info('Please implement the generateWaveform IPC handler in your Electron main process');
        return;
      }

      // Generate waveform using ffmpeg (non-blocking)
      const mediaPath = `${currentProject.value.folderPath}/media/${item.mediaFileName}`;
      const result = await window.electronAPI.generateWaveform(mediaPath, waveformPath);

      if (result.success) {
        console.log(`Started waveform generation for ${item.displayName}`);

        // Start polling for waveform file (check every 2 seconds)
        const pollInterval = setInterval(async () => {
          try {
            const waveformFile = await window.electronAPI.readFile(waveformPath);
            if (waveformFile.success && waveformFile.data) {
              const waveformData = JSON.parse(waveformFile.data);

              // Validate waveform format (duration field is optional)
              if (waveformData.peaks && waveformData.peaks.length > 0) {
                item.waveform = waveformData;

                // Update duration from waveform data if available (more accurate than Audio API)
                if (waveformData.duration && waveformData.duration > 0) {
                  item.outPoint = outPointAfterDuration(item.outPoint, item.duration, waveformData.duration);
                  item.duration = waveformData.duration;
                }

                // Force Vue reactivity update
                triggerWaveformUpdate();

                // Stop polling once loaded
                clearInterval(pollInterval);
                console.log(`Waveform loaded for ${item.displayName} (${waveformData.peaks.length} peaks, ${waveformData.duration?.toFixed(2)}s)`);
              }
            }
          } catch (error) {
            console.error('Error polling for waveform:', error);
          }
        }, 2000);

        // Stop polling after 30 seconds to prevent infinite polling
        setTimeout(() => {
          clearInterval(pollInterval);
        }, 30000);
      } else {
        console.error('Failed to generate waveform:', result.error);
      }
    } catch (error) {
      console.error('Error generating waveform:', error);
    }
  };

  const getAudioDuration = async (filePath: string): Promise<number> => {
    // Simplified - would use proper audio decoding
    return new Promise((resolve) => {
      if (import.meta.client) {
        const audio = new Audio(`file://${filePath}`);
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
          resolve(60); // Default fallback
        });
      } else {
        resolve(60);
      }
    });
  };

  const handleAddGroup = () => {
    if (!currentProject.value) return;

    const groupItem: GroupItem = {
      ...createDefaultGroupItem(),
      uuid: uuidv4(),
      index: [currentProject.value.items.length],
      displayName: 'New Group',
      type: 'group',
      children: [] // Create a new array for each group to avoid shared references
    } as GroupItem;

    addItem(groupItem);
  };

  return {
    handleImport,
    importAudioFile,
    handleAddGroup,
    showYouTubeModal,
  };
};
