<template>
  <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('selectProject.title')">
      <div class="dialog-header">
        <h3>{{ t('selectProject.title') }}</h3>
        <button class="icon-btn" :title="t('selectProject.cancel')" :aria-label="t('selectProject.cancel')" @click="handleCancel">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="dialog-body">
        <p class="modal-message">{{ t('selectProject.message') }}</p>
        <div class="project-list">
          <button
            v-for="(project, index) in projects"
            :key="index"
            class="project-item"
            :class="{ selected: selectedIndex === index }"
            @click="selectedIndex = index"
          >
            <span class="material-symbols-rounded">description</span>
            <span class="project-name">{{ project }}</span>
          </button>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn" @click="handleCancel">
          {{ t('selectProject.cancel') }}
        </button>
        <button class="btn primary" :disabled="selectedIndex === null" @click="handleSelect">
          {{ t('selectProject.open') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  projects: string[];
}>();

const emit = defineEmits<{
  select: [projectName: string];
  cancel: [];
}>();

const { t } = useLocalization();
const selectedIndex = ref<number | null>(null);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    selectedIndex.value = null;
  }
});

const handleSelect = () => {
  if (selectedIndex.value !== null) {
    emit('select', props.projects[selectedIndex.value]);
  }
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<style scoped lang="scss">
@use '~/assets/styles/dialog' as dialog;
@include dialog.base;

.modal-message {
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.project-item {
  height: var(--size-control-lg);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;

  .material-symbols-rounded {
    font-size: 18px;
    color: var(--color-text-muted);
  }

  &:hover {
    background-color: var(--color-surface-hover);
  }

  &.selected {
    background-color: var(--color-accent-tint);
    outline: 1.5px solid var(--color-accent);
    outline-offset: -1.5px;

    .material-symbols-rounded {
      color: var(--color-accent);
    }
  }
}

.project-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
