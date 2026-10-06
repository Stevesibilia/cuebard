<template>
  <div class="viewer-control" ref="rootRef">
    <button
      class="viewer-btn"
      :class="{ open: popoverOpen }"
      aria-haspopup="dialog"
      :aria-expanded="popoverOpen"
      @click="togglePopover"
    >
      <span v-if="remoteEnabled" class="on-dot" aria-hidden="true"></span>
      {{ t('visuals.viewer') }}
    </button>

    <div v-if="popoverOpen" class="viewer-popover" role="dialog" :aria-label="t('visuals.viewer')">
      <!-- Local second-monitor player window -->
      <label class="toggle-row">
        <span class="toggle-label">{{ t('visuals.playerWindow') }}</span>
        <input type="checkbox" :checked="localEnabled" @change="onToggleLocal" />
      </label>

      <!-- Remote LAN browser viewer -->
      <label class="toggle-row">
        <span class="toggle-label">{{ t('visuals.remoteViewer') }}</span>
        <input type="checkbox" :checked="remoteEnabled" @change="onToggleRemote" />
      </label>

      <div v-if="remoteEnabled" class="remote-detail">
        <img
          v-if="primaryUrl && qrDataUrl"
          :src="qrDataUrl"
          :alt="t('visuals.qrAlt')"
          class="qr"
          width="88"
          height="88"
        />
        <div class="remote-text">
          <template v-if="primaryUrl">
            <span class="url-text" :title="t('visuals.urlTitle')">{{ primaryUrl }}</span>
            <span v-if="otherUrls.length" class="url-alt">
              {{ t('visuals.otherUrls', { urls: otherUrls.join(', ') }) }}
            </span>
          </template>
          <span v-else class="url-none">{{ t('visuals.noLanAddress') }}</span>
          <span class="warn">{{ t('visuals.lanWarning') }}</span>
        </div>
      </div>

      <!-- Remote Control API from other devices (session-only, default off) -->
      <label class="toggle-row network-row">
        <span class="toggle-label stacked">
          <span>{{ t('remoteControl.networkToggle') }}</span>
          <span class="toggle-help">{{ t('remoteControl.networkHelp') }}</span>
        </span>
        <input type="checkbox" :checked="apiNetworkEnabled" @change="onToggleApiNetwork" />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import QRCode from 'qrcode';

const { t } = useLocalization();

const rootRef = ref<HTMLElement | null>(null);
const popoverOpen = ref(false);
const remoteEnabled = ref(false);
const localEnabled = ref(true);
const apiNetworkEnabled = ref(false);
const urls = ref<string[]>([]);
const qrDataUrl = ref<string>('');

const primaryUrl = computed(() => urls.value[0] || '');
const otherUrls = computed(() => urls.value.slice(1));

const api = () => (import.meta.client ? window.electronAPI : null);

async function refreshStatus() {
  const status = await api()?.getRemoteViewerStatus();
  if (status) {
    remoteEnabled.value = status.enabled;
    localEnabled.value = status.localEnabled;
    urls.value = status.urls || [];
  }
  const apiNetwork = await api()?.getApiNetworkEnabled();
  if (apiNetwork) apiNetworkEnabled.value = apiNetwork.enabled;
}

async function togglePopover() {
  popoverOpen.value = !popoverOpen.value;
  if (popoverOpen.value) await refreshStatus();
}

async function onToggleRemote(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  const res = await api()?.setRemoteViewerEnabled(enabled);
  remoteEnabled.value = res?.enabled ?? enabled;
  if (remoteEnabled.value) await refreshStatus();
}

async function onToggleApiNetwork(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  const res = await api()?.setApiNetworkEnabled(enabled);
  apiNetworkEnabled.value = res?.enabled ?? enabled;
}

async function onToggleLocal(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  const res = await api()?.setLocalViewerEnabled(enabled);
  localEnabled.value = res?.localEnabled ?? enabled;
}

// Regenerate the QR whenever the primary URL changes (client-side, no network).
watch(primaryUrl, async (url) => {
  if (!url) { qrDataUrl.value = ''; return; }
  try {
    qrDataUrl.value = await QRCode.toDataURL(url, { margin: 2, width: 176 });
  } catch {
    qrDataUrl.value = '';
  }
}, { immediate: true });

function onDocClick(e: MouseEvent) {
  if (popoverOpen.value && rootRef.value && !rootRef.value.contains(e.target as Node)) {
    popoverOpen.value = false;
  }
}

let detachStatus: (() => void) | undefined;
onMounted(() => {
  document.addEventListener('mousedown', onDocClick);
  // Window opening/closing (menu or OS chrome) moves localViewerEnabled in
  // lockstep in the main process; mirror it so the toggle stays accurate.
  detachStatus = api()?.onPlayerWindowStatusChanged((isOpen: boolean) => { localEnabled.value = isOpen; });
  refreshStatus();
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick);
  detachStatus?.();
});
</script>

<style scoped>
.viewer-control {
  position: relative;
  display: inline-flex;
}

.viewer-btn {
  height: var(--size-control);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}
.viewer-btn:hover,
.viewer-btn.open {
  background-color: var(--color-surface-hover);
  border-color: var(--color-accent);
}

.on-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background-color: var(--color-success);
}

/* Anchored under the toolbar button, right-aligned with it */
.viewer-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: var(--z-dropdown);
  width: 300px;
  padding: 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-control-border);
  border-radius: 12px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.toggle-label {
  flex: 1;
  color: var(--color-text-primary);
}
.toggle-label.stacked {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toggle-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
  accent-color: var(--color-accent);
  cursor: pointer;
}
.network-row {
  align-items: flex-start;
  padding-top: 10px;
  border-top: 1px solid var(--color-control-border);
}
.toggle-help {
  font-size: 11px;
  color: var(--color-text-muted);
}

.remote-detail {
  display: flex;
  align-items: center;
  gap: 10px;
}
.qr {
  flex-shrink: 0;
  border-radius: 6px;
}
.remote-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.url-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-label);
  color: var(--color-text-primary);
  word-break: break-all;
  user-select: all;
}
.url-alt,
.url-none {
  font-size: 11px;
  color: var(--color-text-muted);
  word-break: break-all;
}
.warn {
  font-size: 11px;
  color: var(--color-warning-text);
}
</style>
