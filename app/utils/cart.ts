// Cart grid rules.

// Number of slots in the cart grid (CartPlayer renders exactly these).
export const CART_SLOT_COUNT = 16;

// Plans a "push" drop onto an occupied slot: the contiguous run of occupied
// slots starting at `targetSlot` moves up by one, stopping at the first empty
// slot; later slots stay put. Returns old slot -> new slot for every cue that
// moves, or null when the run reaches the last slot (no room: refuse the
// drop). `occupiedSlots` must not include the dragged cue's own slot.
export function planCartPush(
  occupiedSlots: number[],
  targetSlot: number,
  slotCount = CART_SLOT_COUNT,
): Map<number, number> | null {
  const occupied = new Set(occupiedSlots);
  const moves = new Map<number, number>();
  let slot = targetSlot;
  while (occupied.has(slot)) {
    if (slot + 1 >= slotCount) return null;
    moves.set(slot, slot + 1);
    slot++;
  }
  return moves;
}
