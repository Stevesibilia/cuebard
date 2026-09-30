// A single debounce around a project writer. useProject keeps one instance at
// module scope so every component's saveProject() shares the same timer, and
// flush / saveNow see edits scheduled from anywhere.
//
// Writes never overlap: each one waits for the write already in flight, and
// flush() waits for an in-flight write too, so the close handshake cannot
// report "flushed" while the file is still being written.

export interface DebouncedSaver {
  // Schedule a write after `delayMs`, restarting the wait on every call.
  schedule(): void;
  // Write now if a write is pending, or wait for the one in flight; resolves
  // true when there was nothing to write.
  flush(): Promise<boolean>;
  // Drop any pending write and write now (after any write in flight).
  saveNow(): Promise<boolean>;
  readonly pending: boolean;
}

export function createDebouncedSaver(write: () => Promise<boolean>, delayMs = 500): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<boolean> | null = null;

  const cancel = (): boolean => {
    if (!timer) return false;
    clearTimeout(timer);
    timer = null;
    return true;
  };

  // Every write goes through here: chain after the write in flight (a loop,
  // because another caller may have started one while this one waited).
  const run = async (): Promise<boolean> => {
    while (inflight) {
      try {
        await inflight;
      } catch {
        // the earlier write's failure is its caller's to report
      }
    }
    const current = write();
    inflight = current;
    try {
      return await current;
    } finally {
      if (inflight === current) inflight = null;
    }
  };

  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    async flush() {
      if (cancel()) return run();
      if (inflight) return inflight;
      return true;
    },
    async saveNow() {
      cancel();
      return run();
    },
    get pending() {
      return timer !== null;
    },
  };
}
