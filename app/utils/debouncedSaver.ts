// A single debounce around a project writer. useProject keeps one instance at
// module scope so every component's saveProject() shares the same timer, and
// flush / saveNow see edits scheduled from anywhere.

export interface DebouncedSaver {
  // Schedule a write after `delayMs`, restarting the wait on every call.
  schedule(): void;
  // Write now if a write is pending; resolves true when nothing was pending.
  flush(): Promise<boolean>;
  // Drop any pending write and write now.
  saveNow(): Promise<boolean>;
  readonly pending: boolean;
}

export function createDebouncedSaver(write: () => Promise<boolean>, delayMs = 500): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): boolean => {
    if (!timer) return false;
    clearTimeout(timer);
    timer = null;
    return true;
  };

  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        write();
      }, delayMs);
    },
    async flush() {
      return cancel() ? write() : true;
    },
    async saveNow() {
      cancel();
      return write();
    },
    get pending() {
      return timer !== null;
    },
  };
}
