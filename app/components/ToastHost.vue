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
  right: var(--spacing-md);
  bottom: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-width: 420px;
  z-index: var(--z-tooltip);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-inline-start: 4px solid var(--color-info);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-list);
  cursor: pointer;
  pointer-events: auto;
}

.toast:hover {
  background: var(--color-surface-hover);
}

.toast-error {
  border-inline-start-color: var(--color-danger);
}

.toast-error .material-symbols-rounded {
  color: var(--color-danger);
}

.toast-info .material-symbols-rounded {
  color: var(--color-info);
}

.toast-message {
  overflow-wrap: anywhere;
}
</style>
