import { describe, it, expect } from 'vitest';
import { planCartPush, CART_SLOT_COUNT } from '../app/utils/cart';

const entries = (m: Map<number, number> | null) => (m ? [...m.entries()] : m);

describe('planCartPush', () => {
  it('moves only the target cue when the next slot is empty', () => {
    // slots 3 and 5 occupied, 4 empty: pushing onto 3 moves 3 -> 4, 5 stays
    expect(entries(planCartPush([3, 5, 9], 3))).toEqual([[3, 4]]);
  });

  it('shifts the contiguous run and stops at the first gap', () => {
    expect(entries(planCartPush([2, 3, 4, 7], 2))).toEqual([[2, 3], [3, 4], [4, 5]]);
  });

  it('refuses when the run reaches the last slot', () => {
    expect(planCartPush([13, 14, 15], 13)).toBeNull();
    expect(planCartPush([15], 15)).toBeNull();
  });

  it('refuses a push into a completely full row', () => {
    const all = Array.from({ length: CART_SLOT_COUNT }, (_, i) => i);
    expect(planCartPush(all, 0)).toBeNull();
  });

  it('never returns a slot at or beyond the slot count', () => {
    for (let target = 0; target < CART_SLOT_COUNT; target++) {
      for (let runEnd = target; runEnd < CART_SLOT_COUNT; runEnd++) {
        const occupied = Array.from({ length: runEnd - target + 1 }, (_, i) => target + i);
        const plan = planCartPush(occupied, target);
        if (plan) for (const to of plan.values()) expect(to).toBeLessThan(CART_SLOT_COUNT);
      }
    }
  });

  it('returns an empty plan when the target is free', () => {
    expect(entries(planCartPush([1, 2], 5))).toEqual([]);
  });

  it('honours a custom slot count', () => {
    expect(planCartPush([2, 3], 2, 4)).toBeNull();
    expect(entries(planCartPush([2], 2, 4))).toEqual([[2, 3]]);
  });

  it('exports the grid size CartPlayer renders', () => {
    expect(CART_SLOT_COUNT).toBe(16);
  });
});
