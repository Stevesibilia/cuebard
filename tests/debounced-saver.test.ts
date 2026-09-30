import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedSaver } from '../app/utils/debouncedSaver';

describe('createDebouncedSaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const write = vi.fn(async () => true);
    return { write, saver: createDebouncedSaver(write, 500) };
  };

  it('collapses rapid schedules into one write after the delay', () => {
    const { write, saver } = setup();
    saver.schedule();
    vi.advanceTimersByTime(300);
    saver.schedule();
    vi.advanceTimersByTime(300);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.pending).toBe(false);
  });

  it('shares one timer between callers holding the same saver', async () => {
    // Two components both reach the module-scope saver through useProject()
    const { write, saver } = setup();
    const componentA = saver;
    const componentB = saver;
    componentA.schedule();
    componentB.schedule();
    expect(await componentB.flush()).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('flush writes a pending save at once and cancels the timer', async () => {
    const { write, saver } = setup();
    saver.schedule();
    expect(saver.pending).toBe(true);
    await saver.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.pending).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending does not write', async () => {
    const { write, saver } = setup();
    expect(await saver.flush()).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it('saveNow writes immediately even with nothing pending, and drops the pending timer', async () => {
    const { write, saver } = setup();
    await saver.saveNow();
    expect(write).toHaveBeenCalledTimes(1);
    saver.schedule();
    await saver.saveNow();
    expect(write).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('returns the writer result', async () => {
    const write = vi.fn(async () => false);
    const saver = createDebouncedSaver(write, 500);
    saver.schedule();
    expect(await saver.flush()).toBe(false);
    expect(await saver.saveNow()).toBe(false);
  });
});
