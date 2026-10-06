/**
 * Composition-wide actions shared by the Visuals toolbar (layer count,
 * Publish all, Black) and the composition panel (per-layer sync).
 *
 * Publishing goes through useVisualDisplay's linking pipeline, so each layer
 * still honours its own linked cue and link delay.
 */
export const useCompositionActions = () => {
  const { currentProject, findItemByUuid } = useProject();
  const { layers, publishLayerWithLinking, blackAll, getPublishedState } = useVisualDisplay();
  const { syncToPlayer } = usePlayerSync();
  const { playCue } = useAudioEngine();

  const layerCount = computed(() => layers.value.length);
  const hasDrafts = computed(() => layers.value.some((l) => !l.published));
  const hasPublished = computed(() => layers.value.some((l) => l.published));

  const syncIfReady = async () => {
    if (!currentProject.value) return;
    const state = getPublishedState(currentProject.value.folderPath);
    await syncToPlayer(state);
  };

  const publishAll = () => {
    // Publish each currently-draft layer through the linking pipeline so each
    // honors its own linked cue / delay. Already-published layers are untouched.
    const draftIds = layers.value.filter((l) => !l.published).map((l) => l.id);
    if (draftIds.length === 0) return;
    for (const id of draftIds) {
      publishLayerWithLinking(id, {
        syncCallback: syncIfReady,
        playCue,
        findItemByUuid,
      });
    }
  };

  const blackOut = () => {
    blackAll();
    void syncIfReady();
  };

  return { layerCount, hasDrafts, hasPublished, syncIfReady, publishAll, blackOut };
};
