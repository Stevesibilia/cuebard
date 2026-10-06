/**
 * Everything that can fire a cue without the mouse: cart and global hotkeys,
 * MIDI, and the remote-control API trigger/stop events. Mounted once from
 * app.vue so they work in every workspace view, minimal mode included.
 */
export const useControlSurfaces = () => {
  const hotkeys = useCartHotkeys();
  const midi = useMidiController();
  const { triggerByUuid, triggerByIndex, stopCue } = useAudioEngine();
  let unsubscribers: (() => void)[] = [];

  const mount = () => {
    if (!import.meta.client) return;

    hotkeys.mount();
    midi.mount();

    if (!window.electronAPI) return;

    unsubscribers.push(window.electronAPI.onTriggerItem((_event, data) => {
      if (data.type === 'uuid') {
        triggerByUuid(data.value);
      } else if (data.type === 'index') {
        triggerByIndex(data.value);
      }
    }));

    unsubscribers.push(window.electronAPI.onStopItem((_event, data) => {
      if (data.type === 'uuid') {
        stopCue(data.value);
      }
    }));
  };

  const unmount = () => {
    if (!import.meta.client) return;

    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];
    midi.unmount();
    hotkeys.unmount();
  };

  return { mount, unmount };
};
