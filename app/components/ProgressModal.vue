<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog progress-dialog" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
      <div class="dialog-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="dialog-body">
        <div class="progress-info">
          <p>{{ message }}</p>
          <span class="progress-percentage">{{ percentage }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: percentage + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  visible: boolean;
  title: string;
  message: string;
  percentage: number;
  allowCancel?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
}>();

const handleOverlayClick = () => {
  if (props.allowCancel) {
    emit('cancel');
  }
};
</script>

<style scoped lang="scss">
@use '~/assets/styles/dialog' as dialog;
@include dialog.base;

.progress-dialog {
  width: 400px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 10px;

  p {
    margin: 0;
    flex: 1;
    color: var(--color-text-secondary);
  }
}

.progress-percentage {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.progress-track {
  width: 100%;
  height: 6px;
  background: var(--color-field);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-pill);
  transition: width 0.3s ease;
}
</style>
