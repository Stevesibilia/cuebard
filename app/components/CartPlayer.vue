<template>
  <div class="cart-player" ref="cartPlayerRef">
    <div class="cart-header">
      <h2 class="cart-title">{{ t('cartUi.title') }}</h2>
      <button class="controls-btn" @click="showControlConfig = true" :title="t('cart.configureControls')">
        <span class="material-symbols-rounded">keyboard</span>
        {{ t('cartUi.keysAndMidi') }}
      </button>
    </div>
    
    <div class="cart-grid" :class="gridClass">
      <CartSlot
        v-for="slot in CART_SLOT_COUNT"
        :key="slot"
        :slot="slot - 1"
        :item="getCartItem(slot - 1)"
        :keyLabel="getKeyLabel(slot - 1)"
      />
    </div>

    <ControlConfigModal
      v-if="showControlConfig"
      @close="showControlConfig = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { AudioItem } from '~/types/project';
import { formatKeyLabel } from '~/composables/useCartHotkeys';
import { CART_SLOT_COUNT } from '~/utils/cart';

const { currentProject } = useProject();
const { getCartItem } = useCartItems();
const { keyMappings } = useCartHotkeys();
const { t } = useLocalization();

const showControlConfig = ref(false);
const cartPlayerRef = ref<HTMLElement | null>(null);
const gridClass = ref('grid-cols-2');

// Watch for resize and adjust grid columns
const updateGridColumns = () => {
  if (!cartPlayerRef.value) return;
  
  const width = cartPlayerRef.value.offsetWidth;
  
  // Adjust grid columns based on width
  if (width < 500) {
    gridClass.value = 'grid-cols-2';
  } else if (width < 800) {
    gridClass.value = 'grid-cols-2';
  } else if (width < 1100) {
    gridClass.value = 'grid-cols-3';
  } else {
    gridClass.value = 'grid-cols-4';
  }
};

const getKeyLabel = (slotIndex: number): string => {
  const binding = keyMappings.value[slotIndex];
  return binding ? formatKeyLabel(binding) : '';
};

onMounted(() => {
  if (import.meta.client) {
    // Initial setup
    updateGridColumns();
    
    // Watch for resize
    const resizeObserver = new ResizeObserver(() => {
      updateGridColumns();
    });
    
    if (cartPlayerRef.value) {
      resizeObserver.observe(cartPlayerRef.value);
    }
    
    onUnmounted(() => {
      resizeObserver.disconnect();
    });
  }
});
</script>

<style scoped>
.cart-player {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  box-sizing: border-box;
  background-color: var(--color-panel);
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
}

.cart-title {
  font-size: var(--font-size-label);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.controls-btn {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-label);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);

  .material-symbols-rounded {
    font-size: 16px;
  }

  &:hover {
    background-color: var(--color-field);
    color: var(--color-text-primary);
  }
}

.cart-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-auto-rows: 84px;
  gap: 8px;
  overflow-y: auto;
  align-content: start;
  
  &.grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  
  &.grid-cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  
  &.grid-cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
