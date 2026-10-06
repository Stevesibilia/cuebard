<template>
  <div class="toast-host">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.kind}`"
      :role="toast.kind === 'error' ? 'alert' : 'status'"
      @click="dismissToast(toast.id)"
    >
      <span class="material-symbols-rounded">{{ toast.kind === 'error' ? 'error' : 'info' }}</span>
      <span class="toast-message">{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const { toasts, dismissToast } = useToast();
</script>

<style scoped>
.toast-host {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  z-index: var(--z-tooltip);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  background: var(--color-chrome);
  border: 1px solid var(--color-divider);
  border-inline-start: 3px solid var(--color-info);
  border-radius: var(--radius-card);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  line-height: 1.4;
  cursor: pointer;
  pointer-events: auto;
}

.toast:hover {
  background: var(--color-surface-hover);
}

.toast .material-symbols-rounded {
  font-size: 18px;
}

.toast-error {
  border-color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-chrome));
  border-inline-start-color: var(--color-danger);
}

.toast-error .material-symbols-rounded {
  color: var(--color-danger-text);
}

.toast-info .material-symbols-rounded {
  color: var(--color-info);
}

.toast-message {
  overflow-wrap: anywhere;
}
</style>
