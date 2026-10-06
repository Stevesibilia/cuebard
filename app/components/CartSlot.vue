<template>
  <div 
    class="cart-slot"
    ref="slotRef"
    :class="{ 
      'has-item': hasItem, 
      'has-color': hasCustomColor,
      'is-playing': isPlaying,
      'warning-yellow': warningState === 'yellow',
      'warning-orange': warningState === 'orange',
      'warning-red': warningState === 'red',
      'drag-over': isDragOver
    }"
    :style="slotStyle"
  >
    <div v-if="!hasItem" class="empty-slot" @click="handleImport" :title="t('cart.clickToImport')">
      <span class="key-cap" :title="t('cartUi.slotLabel', { slot: slot + 1 })">{{ keyLabel || slot + 1 }}</span>
      <span class="slot-hint">{{ t('cartUi.dropCue') }}</span>
      <span class="slot-hint on-hover">{{ t('cart.clickToImport') }}</span>
    </div>
    
    <div 
      v-else 
      class="slot-content"
      draggable="true"
      @click="handlePlay"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <!-- Waveform canvas, shown on hover -->
      <canvas 
        v-if="item.type === 'audio' && item.waveform"
        ref="waveformCanvas"
        class="cart-waveform-canvas"
      ></canvas>
      
      <!-- Progress line at the bottom -->
      <div v-if="isPlaying" class="cart-progress" :style="progressStyle"></div>
      
      <div class="slot-top">
        <span class="key-cap" :title="t('cartUi.slotLabel', { slot: slot + 1 })">{{ keyLabel || slot + 1 }}</span>

        <!-- Action buttons (show on hover) -->
        <div class="slot-actions">
          <button class="slot-btn play" @click.stop="handlePlay" :title="t('actions.play')">
            <span class="material-symbols-rounded">play_arrow</span>
          </button>
          <button class="slot-btn stop" @click.stop="handleStop" :title="t('actions.stop')" v-if="isPlaying">
            <span class="material-symbols-rounded">stop</span>
          </button>
          <button class="slot-btn edit" @click.stop="handleEdit" :title="t('actions.edit')">
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button class="slot-btn delete" @click.stop="handleDelete" :title="t('actions.remove')">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
      </div>

      <span class="slot-name" :title="item.displayName">{{ item.displayName }}</span>
      
      <div class="slot-footer">
        <span class="slot-duration">{{ isPlaying ? "-" + formatTime(duration - currentTime) : formatDuration(item) }}</span>
        <span v-if="chips.length" class="behavior-chips">
          <span
            v-for="chip in chips"
            :key="chip.id"
            class="behavior-chip"
            :title="chip.title"
          >{{ chip.label }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { triggerRef } from 'vue';
import type { AudioItem } from '~/types/project';
import { resolveWaveformPath } from '~/utils/paths';
import { outPointAfterDuration } from '~/utils/trim';
import { planCartPush, CART_SLOT_COUNT } from '~/utils/cart';
import { waveformDisplayScale } from '~/utils/audio';
import { behaviourChips } from '~/utils/rowDisplay';
import { NEUTRAL_CUE_COLOR } from '~/types/project';

const props = defineProps<{
  slot: number;
  item: AudioItem | null;
  keyLabel?: string;
}>();

const slotRef = ref<HTMLElement | null>(null);

const { currentProject, findItemByUuid, triggerWaveformUpdate, selectedItem, selectedItems } = useProject();
const { playCue, stopCue, activeCues } = useAudioEngine();
const { t, currentLocale } = useLocalization();
const { addCartOnlyItem, updateCartOnlyItem, removeCartOnlyItem, getCartOnlyItem } = useCartItems();

const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const playbackProgress = ref(0);
const warningState = ref<'yellow' | 'orange' | 'red' | null>(null);
const isDragOver = ref(false);

const hasItem = computed(() => props.item !== null);
const isPlaying = computed(() => props.item ? activeCues.value.has(props.item.uuid) : false);

// A deliberately coloured cue tints its card; neutral-default cues stay flat
const hasCustomColor = computed(() =>
  !!props.item?.color && props.item.color.toLowerCase() !== NEUTRAL_CUE_COLOR
);

const slotStyle = computed(() =>
  hasCustomColor.value ? { '--slot-color': props.item!.color } : {}
);

const progressStyle = computed(() => ({ width: `${playbackProgress.value}%` }));

// Readable behaviour chips, as in playlist rows
const chips = computed(() => {
  if (!props.item) return [];
  const resolveName = (uuid: string) =>
    (findItemByUuid(uuid) ?? getCartOnlyItem(uuid))?.displayName ?? null;
  return behaviourChips(props.item, t, resolveName, currentLocale.value);
});

// Watch for playback
let progressInterval: any = null;
watch(isPlaying, (playing) => {
  if (playing && props.item) {
    const cue = activeCues.value.get(props.item.uuid);
    if (cue) {
      duration.value = cue.duration;
      progressInterval = setInterval(() => {
        if (!props.item) return;
        const cue = activeCues.value.get(props.item.uuid);
        if (cue) {
          currentTime.value = cue.currentTime;
          duration.value = cue.duration;
          playbackProgress.value = duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0;
          
          // Update warning state based on time remaining
          const timeRemaining = duration.value - currentTime.value;
          if (timeRemaining <= 5) {
            warningState.value = 'red';
          } else if (timeRemaining <= 10) {
            warningState.value = 'orange';
          } else if (timeRemaining <= 30) {
            warningState.value = 'yellow';
          } else {
            warningState.value = null;
          }
        }
      }, 100);
    }
  } else {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    playbackProgress.value = 0;
    currentTime.value = 0;
    warningState.value = null;
  }
}, { immediate: true }); // a slot mounted mid-cue shows its countdown

onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval);
  }
});

const handleImport = async () => {
  if (!import.meta.client || !window.electronAPI || !currentProject.value) return;
  
  const filePaths = await window.electronAPI.selectAudioFiles();
  if (!filePaths || filePaths.length === 0) return;
  
  // Import first file to this slot
  const filePath = filePaths[0];
  await importAudioFileToSlot(filePath);
};

const importAudioFileToSlot = async (filePath: string) => {
  if (!currentProject.value) return;
  
  try {
    // Extract filename from path
    const fileName = filePath.split(/[/\\]/).pop() || 'audio.wav';
    const mediaPath = `${currentProject.value.folderPath}/media/${fileName}`;
    
    // Copy file to project media folder, never over an existing file: a
    // clash is stored as "name (2).ext" and the cue points at that name
    const copyResult = await window.electronAPI.copyFile(filePath, mediaPath, { noOverwrite: true });
    if (!copyResult.success) {
      console.error('Failed to copy file:', copyResult.error);
      return;
    }
    const storedName = (copyResult.destPath ?? mediaPath).split(/[/\\]/).pop() || fileName;
    
    // Get audio duration - use 60 seconds as temporary default
    // The actual duration will be detected when waveform is generated
    const duration = 60;
    
    // Create new audio item
    const { v4: uuidv4 } = await import('uuid');
    const { createDefaultCartAudioItem } = await import('~/types/project');
    
    const uuid = uuidv4();
    // Store the bare filename; resolved against the current folderPath at
    // runtime so the project stays portable across synced hosts.
    const waveformPath = `${uuid}.json`;
    
    const newItem: AudioItem = {
      ...createDefaultCartAudioItem(),
      uuid,
      type: 'audio' as const,
      displayName: fileName.replace(/\.[^/.]+$/, ''),
      mediaFileName: storedName,
      mediaPath: `media/${storedName}`, // Store relative path to project folder
      waveformPath,
      duration,
      outPoint: duration,
      waveform: undefined, // Will be generated asynchronously
      index: [-1, props.slot] // Cart items use [-1, slot] indexing
    } as AudioItem;
    
    // Store in cart-only items (NOT in project.items)
    addCartOnlyItem(newItem);
    
    // Assign to cart slot
    const existingIndex = currentProject.value.cartItems.findIndex((ci: any) => ci.slot === props.slot);
    
    if (existingIndex !== -1) {
      currentProject.value.cartItems[existingIndex].itemUuid = uuid;
      currentProject.value.cartItems[existingIndex].index = [-1, props.slot];
    } else {
      currentProject.value.cartItems.push({
        slot: props.slot,
        itemUuid: uuid,
        index: [-1, props.slot]
      });
    }
    
    // Save project
    const { saveProject } = useProject();
    await saveProject();
    
    // Generate waveform asynchronously using ffmpeg (non-blocking)
    // This will also get the correct duration
    generateWaveformForItem(newItem);
  } catch (error) {
    console.error('Error importing audio to cart:', error);
  }
};

const generateWaveformForItem = async (item: AudioItem) => {
  try {
    if (!currentProject.value) return;
    
    // Check if generateWaveform is available
    if (!window.electronAPI.generateWaveform) {
      console.warn('generateWaveform not implemented yet - waveform will not be generated');
      return;
    }
    
    const mediaPath = `${currentProject.value.folderPath}/media/${item.mediaFileName}`;
    const waveformPath = resolveWaveformPath(currentProject.value.folderPath, item.waveformPath);

    // Generate waveform using ffmpeg (non-blocking)
    const result = await window.electronAPI.generateWaveform(mediaPath, waveformPath);

    if (result.success) {
      console.log(`Started waveform generation for cart slot ${props.slot + 1}`);

      // Start polling for waveform file (check every 2 seconds)
      const pollInterval = setInterval(async () => {
        try {
          const waveformFile = await window.electronAPI.readFile(waveformPath);
          if (waveformFile.success && waveformFile.data) {
            const waveformData = JSON.parse(waveformFile.data);
            
            // Validate waveform format (duration field is optional, not provided by backend)
            if (waveformData.peaks && waveformData.peaks.length > 0) {
              item.waveform = waveformData;
              
              // Update duration from waveform data if available
              if (waveformData.duration && waveformData.duration > 0) {
                item.outPoint = outPointAfterDuration(item.outPoint, item.duration, waveformData.duration);
                item.duration = waveformData.duration;
              }
              
              // Update the cart-only item with waveform data
              updateCartOnlyItem(item.uuid, item);
              
              // Force Vue reactivity update
              triggerWaveformUpdate();
              nextTick(drawWaveform);
              
              // Stop polling once loaded
              clearInterval(pollInterval);
              console.log(`Waveform loaded for cart slot ${props.slot + 1} (${waveformData.peaks.length} peaks, ${waveformData.duration?.toFixed(2)}s)`);
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

const handlePlay = () => {
  if (!props.item) return;
  playCue(props.item);

  if (selectedItem.value !== null) {
    selectedItems.value.clear();
    selectedItems.value.add(props.item.uuid);
    selectedItem.value = props.item;
  }
};

const handleStop = () => {
  if (!props.item) return;
  stopCue(props.item.uuid);
};

const handleDelete = () => {
  if (!currentProject.value || !props.item) return;
  
  // Remove from cart-only items
  removeCartOnlyItem(props.item.uuid);
  
  // Remove from cart
  const index = currentProject.value.cartItems.findIndex((ci: any) => ci.slot === props.slot);
  if (index !== -1) {
    currentProject.value.cartItems.splice(index, 1);
    const { saveProject } = useProject();
    saveProject();
  }
};

const handleEdit = () => {
  if (!props.item) return;

  selectedItems.value.clear();
  selectedItems.value.add(props.item.uuid);
  selectedItem.value = props.item;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDuration = (item: AudioItem | null): string => {
  if (!item) return '';
  
  // Calculate trimmed duration based on in/out points
  const totalDuration = item.duration;
  const inPoint = item.inPoint || 0;
  const outPoint = item.outPoint || totalDuration;
  const trimmedDuration = outPoint - inPoint;
  
  const totalSeconds = Math.floor(trimmedDuration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
};

// Draw waveform
const drawWaveform = () => {
  if (!waveformCanvas.value || !props.item || props.item.type !== 'audio') return;
  
  const audioItem = props.item as AudioItem;
  if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) return;
  
  const canvas = waveformCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Set canvas size to match element size
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  // Use text color for waveform
  const computedStyle = getComputedStyle(canvas);
  const textColor = computedStyle.getPropertyValue('color');
  const rgb = textColor.match(/\d+/g);
  if (!rgb) return;
  
  ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  
  const peaks = audioItem.waveform.peaks;
  
  // Calculate trimmed region if in/out points are set
  const totalDuration = audioItem.duration;
  const inPoint = audioItem.inPoint || 0;
  const outPoint = audioItem.outPoint || totalDuration;
  const trimmedDuration = outPoint - inPoint;
  
  // Calculate which peaks to show (slice based on in/out ratios)
  const startIndex = Math.floor((inPoint / totalDuration) * peaks.length);
  const endIndex = Math.ceil((outPoint / totalDuration) * peaks.length);
  const trimmedPeaks = peaks.slice(startIndex, endIndex);
  
  const barWidth = rect.width / trimmedPeaks.length;
  const centerY = rect.height / 2;

  // Apply volume scaling to waveform display
  const volumeMultiplier = audioItem.volume || 1.0;
  // Peak-normalize display so quiet cues stay visible. Scale is computed over
  // the whole track so trimming doesn't rescale the surviving region.
  const displayScale = waveformDisplayScale(peaks);

  trimmedPeaks.forEach((value, i) => {
    // Values are already normalized 0-1, scale by volume and display scale
    const barHeight = Math.min(value * volumeMultiplier * displayScale, 1) * rect.height * 0.8;
    const x = i * barWidth;
    const y = centerY - barHeight / 2;

    ctx.fillRect(x, y, Math.max(barWidth, 1), barHeight);
  });
};

// Watch for item changes and redraw
let resizeObserver: ResizeObserver | null = null;
let waveformPollInterval: NodeJS.Timeout | null = null;

onMounted(() => {
  // Use native DOM listeners for drag-and-drop — Vue event handlers
  // on this component don't receive drop events (likely a Vue 3 scoped template issue)
  if (slotRef.value) {
    slotRef.value.addEventListener('dragenter', (e) => {
      e.preventDefault();
    });
    slotRef.value.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        isDragOver.value = true;
        e.dataTransfer.dropEffect = 'move';
      }
    });
    slotRef.value.addEventListener('dragleave', () => {
      isDragOver.value = false;
    });
    slotRef.value.addEventListener('drop', (e) => {
      e.preventDefault();
      handleDrop(e);
    });
  }

  if (props.item && waveformCanvas.value) {
    nextTick(drawWaveform);
    resizeObserver = new ResizeObserver(() => {
      drawWaveform();
    });
    resizeObserver.observe(waveformCanvas.value);
    
    // Start polling for waveform if not available yet
    const audioItem = props.item as AudioItem;
    if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) {
      startWaveformPolling();
    }
  }
});

onUnmounted(() => {
  if (resizeObserver && waveformCanvas.value) {
    resizeObserver.unobserve(waveformCanvas.value);
    resizeObserver.disconnect();
  }
  
  if (waveformPollInterval) {
    clearInterval(waveformPollInterval);
  }
});

// Poll for waveform data if not yet available
const startWaveformPolling = () => {
  if (waveformPollInterval) return; // Already polling
  
  waveformPollInterval = setInterval(async () => {
    if (!props.item || props.item.type !== 'audio') {
      clearInterval(waveformPollInterval!);
      waveformPollInterval = null;
      return;
    }
    
    const audioItem = props.item as AudioItem;
    
    // Check if waveform is now available
    if (audioItem.waveform && audioItem.waveform.peaks && audioItem.waveform.peaks.length > 0) {
      // Waveform loaded, stop polling and redraw
      clearInterval(waveformPollInterval!);
      waveformPollInterval = null;
      nextTick(drawWaveform);
      return;
    }
    
    // Try to load waveform from file
    if (window.electronAPI && audioItem.waveformPath && currentProject.value) {
      try {
        const result = await window.electronAPI.readFile(resolveWaveformPath(currentProject.value.folderPath, audioItem.waveformPath));
        if (result.success && result.data) {
          const waveformData = JSON.parse(result.data);
          if (waveformData.peaks && waveformData.peaks.length > 0) {
            audioItem.waveform = waveformData;
            
            // Update duration from waveform data if available
            if (waveformData.duration && waveformData.duration > 0) {
              audioItem.outPoint = outPointAfterDuration(audioItem.outPoint, audioItem.duration, waveformData.duration);
              audioItem.duration = waveformData.duration;
            }
            
            // Update the cart-only item with waveform data
            updateCartOnlyItem(audioItem.uuid, audioItem);
            
            clearInterval(waveformPollInterval!);
            waveformPollInterval = null;
            
            // Force reactivity update
            triggerWaveformUpdate();
            nextTick(drawWaveform);
            console.log(`Waveform polling found data for cart slot ${props.slot + 1}`);
          }
        }
      } catch (error) {
        // Silently ignore, will retry on next poll
      }
    }
  }, 2000); // Poll every 2 seconds
  
  // Stop polling after 30 seconds
  setTimeout(() => {
    if (waveformPollInterval) {
      clearInterval(waveformPollInterval);
      waveformPollInterval = null;
    }
  }, 30000);
};

watch(() => props.item, (newItem, oldItem) => {
  if (newItem && newItem.type === 'audio') {
    nextTick(drawWaveform);
    
    // Start polling if waveform not available
    const audioItem = newItem as AudioItem;
    if (!audioItem.waveform || !audioItem.waveform.peaks || audioItem.waveform.peaks.length === 0) {
      startWaveformPolling();
    }
  }
}, { deep: true });

const handleDragStart = (e: DragEvent) => {
  if (!e.dataTransfer || !props.item) return;
  
  // Set the drag data to include slot number and item UUID
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('cart-slot', props.slot.toString());
  e.dataTransfer.setData('item-uuid', props.item.uuid);
};

const handleDragEnd = () => {
  isDragOver.value = false;
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragOver.value = false;
  
  if (!e.dataTransfer || !currentProject.value) return;
  
  // Check if it's a cart item being reordered
  const sourceSlotStr = e.dataTransfer.getData('cart-slot');
  if (sourceSlotStr) {
    const sourceSlot = parseInt(sourceSlotStr);
    const targetSlot = props.slot;
    
    if (sourceSlot === targetSlot) return; // Same slot, do nothing
    
    // Get the source cart item
    const sourceIndex = currentProject.value.cartItems.findIndex((ci: any) => ci.slot === sourceSlot);
    if (sourceIndex === -1) return;
    
    const sourceCartItem = currentProject.value.cartItems[sourceIndex];
    
    // Check if target slot is occupied
    const targetIndex = currentProject.value.cartItems.findIndex((ci: any) => ci.slot === targetSlot);
    
    if (targetIndex === -1) {
      // Target slot is empty - simple move
      currentProject.value.cartItems[sourceIndex].slot = targetSlot;
    } else {
      // Target slot is occupied - push/insert behavior: shift only the
      // contiguous run from the target up to the first gap; refuse the drop
      // when that run reaches the last slot (nowhere to push to)
      const occupiedSlots = currentProject.value.cartItems
        .filter((ci: any) => ci.slot !== sourceSlot)
        .map((ci: any) => ci.slot as number);
      const moves = planCartPush(occupiedSlots, targetSlot, CART_SLOT_COUNT);
      if (!moves) return;

      // Remove source item first
      currentProject.value.cartItems.splice(sourceIndex, 1);
      
      for (const cartItem of currentProject.value.cartItems) {
        const newSlot = moves.get(cartItem.slot);
        if (newSlot !== undefined) {
          cartItem.slot = newSlot;
          cartItem.index = [-1, newSlot];
        }
      }
      
      // Insert source item at target slot
      currentProject.value.cartItems.push({
        slot: targetSlot,
        itemUuid: sourceCartItem.itemUuid,
        index: [-1, targetSlot]
      });
    }
    
    // Save the project
    const { saveProject } = useProject();
    await saveProject();
    return;
  }
  
  // Check if it's a file drop
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    // Check if it's an audio file
    if (file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)) {
      // In Electron, we can get the file path from the File object using webUtils
      if (window.electronAPI && window.electronAPI.getFilePath) {
        const filePath = window.electronAPI.getFilePath(file);
        if (filePath) {
          await importAudioFileToSlot(filePath);
          return;
        }
      }
    }
  }
  
  // Otherwise, check if it's an item UUID from the playlist
  const itemUuid = e.dataTransfer.getData('item-uuid');
  if (!itemUuid) return;
  
  // Add or replace cart item
  const existingIndex = currentProject.value.cartItems.findIndex((ci: any) => ci.slot === props.slot);
  
  if (existingIndex !== -1) {
    currentProject.value.cartItems[existingIndex].itemUuid = itemUuid;
    currentProject.value.cartItems[existingIndex].index = [-1, props.slot];
  } else {
    currentProject.value.cartItems.push({
      slot: props.slot,
      itemUuid,
      index: [-1, props.slot]
    });
  }
  
  // Save the project
  const { saveProject } = useProject();
  saveProject();
};
</script>

<style scoped lang="scss">
.cart-slot {
  position: relative;
  min-width: 0;
  height: 84px;
  box-sizing: border-box;
  border: 1px dashed var(--color-control-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);

  &.has-item {
    border: 1px solid var(--color-divider);
    /* A custom colour tints the card; neutral cues stay on the field colour */
    background: color-mix(in srgb, var(--slot-color, var(--color-field)) 10%, var(--color-field));

    &:hover {
      border-color: var(--color-control-border);
    }
  }

  /* Playing: accent outline and tint, over a stronger colour tint */
  &.has-item.is-playing {
    border: 1.5px solid var(--color-accent);
    background:
      linear-gradient(var(--color-accent-tint), var(--color-accent-tint)),
      color-mix(in srgb, var(--slot-color, var(--color-field)) 18%, var(--color-field));

    .slot-name {
      color: var(--color-accent);
    }
  }

  &.drag-over,
  &.has-item.drag-over {
    background: var(--color-accent-tint-strong);
    border-color: var(--color-accent);
  }
  
  &.warning-yellow {
    animation: flash-yellow 2s ease-in-out infinite;
  }
  
  &.warning-orange {
    animation: flash-orange 1s ease-in-out infinite;
  }
  
  &.warning-red {
    animation: flash-red 0.5s ease-in-out infinite;
  }
}

@keyframes flash-yellow {
  0%, 100% { border-color: var(--color-accent); }
  50% { border-color: var(--color-state-armed); }
}

@keyframes flash-orange {
  0%, 100% { border-color: var(--color-accent); }
  50% { border-color: var(--color-state-paused); }
}

@keyframes flash-red {
  0%, 100% { border-color: var(--color-accent); }
  50% { border-color: var(--color-danger); }
}

.key-cap {
  flex: none;
  height: 20px;
  min-width: 20px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-key);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.empty-slot {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
  box-sizing: border-box;
  color: var(--color-text-muted);
  font-size: 11px;
  text-align: center;

  .key-cap {
    border-color: transparent;
    color: var(--color-text-muted);
  }

  .slot-hint.on-hover {
    display: none;
  }

  &:hover {
    background-color: var(--color-field);

    .slot-hint {
      display: none;
    }

    .slot-hint.on-hover {
      display: block;
      color: var(--color-text-secondary);
    }
  }
}

.slot-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  box-sizing: border-box;
  min-height: 0;

  &:active {
    cursor: grabbing;
  }

  /* Everything except the canvas and progress line sits above them */
  > :not(.cart-waveform-canvas):not(.cart-progress) {
    position: relative;
  }
}

.slot-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
  flex: none;
}

.slot-name {
  flex: 1;
  min-height: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  color: var(--color-text-primary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

/* Hover actions top-right, over the card */
.slot-actions {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}

.cart-slot:hover .slot-actions {
  opacity: 1;
  pointer-events: auto;
}

.slot-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background-color: var(--color-control-border);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 15px;
  }

  &:hover {
    background-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  &.stop:hover,
  &.delete:hover {
    background-color: var(--color-danger);
  }
}

.slot-footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

.slot-duration {
  flex: none;
  white-space: nowrap;
}

.behavior-chips {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  overflow: hidden;
}

.behavior-chip {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-sans);
  color: var(--color-text-secondary);
}

.behavior-chip + .behavior-chip::before {
  content: '· ';
  color: var(--color-text-muted);
}

.cart-waveform-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity var(--transition-fast);
  pointer-events: none;
  color: var(--color-text-primary);
}

.slot-content:hover .cart-waveform-canvas {
  opacity: 0.18;
}

.cart-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background-color: var(--color-accent);
  pointer-events: none;
  transition: width 100ms linear;
}
</style>
