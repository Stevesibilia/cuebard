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

  describe('with a write in flight', () => {
    // Writer whose calls stay pending until the test resolves them.
    const deferredWriter = () => {
      const calls: Array<(ok: boolean) => void> = [];
      const write = vi.fn(() => new Promise<boolean>((resolve) => { calls.push(resolve); }));
      return { write, calls };
    };
    const settle = () => vi.advanceTimersByTimeAsync(0);

    it('flush resolves only after the in-flight write resolves', async () => {
      const { write, calls } = deferredWriter();
      const saver = createDebouncedSaver(write, 500);
      saver.schedule();
      await vi.advanceTimersByTimeAsync(500); // timer fired, write started
      expect(write).toHaveBeenCalledTimes(1);

      let flushed: boolean | undefined;
      saver.flush().then((ok) => { flushed = ok; });
      await settle();
      expect(flushed).toBeUndefined();

      calls[0](true);
      await settle();
      expect(flushed).toBe(true);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('saveNow waits for the in-flight write before starting its own', async () => {
      const { write, calls } = deferredWriter();
      const saver = createDebouncedSaver(write, 500);
      saver.schedule();
      await vi.advanceTimersByTimeAsync(500);
      expect(write).toHaveBeenCalledTimes(1);

      let saved: boolean | undefined;
      saver.saveNow().then((ok) => { saved = ok; });
      await settle();
      expect(write).toHaveBeenCalledTimes(1);

      calls[0](true);
      await settle();
      expect(write).toHaveBeenCalledTimes(2);
      expect(saved).toBeUndefined();

      calls[1](false);
      await settle();
      expect(saved).toBe(false);
    });

    it('a timer firing during a write chains after it', async () => {
      const { write, calls } = deferredWriter();
      const saver = createDebouncedSaver(write, 500);
      void saver.saveNow();
      await settle();
      expect(write).toHaveBeenCalledTimes(1);

      saver.schedule();
      await vi.advanceTimersByTimeAsync(500);
      expect(write).toHaveBeenCalledTimes(1);

      calls[0](true);
      await settle();
      expect(write).toHaveBeenCalledTimes(2);
      calls[1](true);
      await settle();
    });

    it('flush with a pending timer and a write in flight writes once more, after it', async () => {
      const { write, calls } = deferredWriter();
      const saver = createDebouncedSaver(write, 500);
      void saver.saveNow();
      await settle();
      saver.schedule();

      let flushed: boolean | undefined;
      saver.flush().then((ok) => { flushed = ok; });
      await settle();
      expect(write).toHaveBeenCalledTimes(1);

      calls[0](true);
      await settle();
      expect(write).toHaveBeenCalledTimes(2);
      expect(flushed).toBeUndefined();

      calls[1](true);
      await settle();
      expect(flushed).toBe(true);
    });

    it('two concurrent saveNow calls never overlap their writes', async () => {
      const { write, calls } = deferredWriter();
      const saver = createDebouncedSaver(write, 500);
      void saver.saveNow();
      await settle();
      void saver.saveNow();
      void saver.saveNow();
      await settle();
      expect(write).toHaveBeenCalledTimes(1);
      calls[0](true);
      await settle();
      expect(write).toHaveBeenCalledTimes(2);
      calls[1](true);
      await settle();
      expect(write).toHaveBeenCalledTimes(3);
      calls[2](true);
      await settle();
    });
  });
});
