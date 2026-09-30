import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import type { AudioItem, GroupItem } from '~/types/project';

/**
 * Tests for the real audio engine. Howler is replaced by a fake that keeps
 * the parts of its contract the engine depends on: the global `_howls`
 * registry (unload removes `this` with indexOf, exactly as Howler does, so a
 * Howl reached through a Vue proxy stays registered), the html5 play lock
 * (a fade issued between play() on a loaded Howl and its 'play' event never
 * runs), a playback position that follows the (fake) clock, and hooks to
 * fire load/error/end events.
 */

const fake = vi.hoisted(() => {
  const Howler = { _howls: [] as any[], volume: () => {} };
  const state = { fileDuration: 10 };
  const instances: any[] = [];

  class FakeHowl {
    opts: any;
    calls: { method: string; args: any[] }[] = [];
    unloaded = false;
    _volume: number;
    _loop: boolean;
    _playing = false;
    _loaded = false;
    _playLock = false;
    _once: Record<string, (() => void)[]> = {};
    _base = 0; // position in the file (s) when playback last started
    _startedAt = 0;

    constructor(opts: any) {
      this.opts = opts;
      this._volume = opts.volume ?? 1;
      this._loop = !!opts.loop;
      Howler._howls.push(this);
      instances.push(this);
    }

    _record(method: string, args: any[]) {
      this.calls.push({ method, args });
    }

    callsOf(method: string) {
      return this.calls.filter(c => c.method === method).map(c => c.args);
    }

    play(sprite?: string) {
      this._record('play', sprite === undefined ? [] : [sprite]);
      if (!this._playing) {
        if (sprite && this.opts.sprite?.[sprite]) this._base = this.opts.sprite[sprite][0] / 1000;
        this._startedAt = Date.now();
        this._playing = true;
      }
      if (this._loaded) {
        // Howler holds a lock until the audio element's play() settles,
        // then emits 'play' (every event goes through setTimeout 0)
        this._playLock = true;
        setTimeout(() => {
          this._playLock = false;
          this._emit('play');
        }, 0);
      }
      return 1;
    }

    once(event: string, fn: () => void) {
      (this._once[event] ??= []).push(fn);
      return this;
    }

    _emit(event: string) {
      const listeners = this._once[event] ?? [];
      this._once[event] = [];
      listeners.forEach(fn => fn());
    }

    pause() {
      this._record('pause', []);
      this._base = this.seek() as number;
      this._playing = false;
      return this;
    }

    stop() {
      this._record('stop', []);
      this._playing = false;
      this._base = 0;
      return this;
    }

    seek(position?: number) {
      if (position === undefined) {
        return this._playing ? this._base + (Date.now() - this._startedAt) / 1000 : this._base;
      }
      this._record('seek', [position]);
      this._base = position;
      this._startedAt = Date.now();
      return this;
    }

    volume(v?: number) {
      if (v === undefined) return this._volume;
      this._record('volume', [v]);
      this._volume = v;
      return this;
    }

    fade(from: number, to: number, ms: number) {
      // Queued by Howler behind an event that never comes: it never runs
      if (this._playLock) return this;
      this._record('fade', [from, to, ms]);
      this._volume = to;
      return this;
    }

    loop(v?: boolean) {
      if (v === undefined) return this._loop;
      this._record('loop', [v]);
      this._loop = v;
      return this;
    }

    duration() {
      return state.fileDuration;
    }

    playing() {
      return this._playing;
    }

    unload() {
      this._record('unload', []);
      const index = Howler._howls.indexOf(this);
      if (index >= 0) Howler._howls.splice(index, 1);
      this.unloaded = true;
    }

    /** Test hook: fire a Howler event. */
    fire(event: 'load' | 'loaderror' | 'playerror' | 'end') {
      if (event === 'load') {
        this._loaded = true;
        this.opts.onload?.();
      }
      else if (event === 'end') this.opts.onend?.();
      else this.opts[`on${event}`]?.(1, 'fake error');
    }
  }

  return { Howler, FakeHowl, instances, state };
});

vi.mock('howler', () => ({ Howl: fake.FakeHowl, Howler: fake.Howler }));

import { useAudioEngine } from '~/composables/useAudioEngine';

type FakeHowl = InstanceType<typeof fake.FakeHowl>;
type Item = AudioItem | GroupItem;

const project = ref<{ folderPath: string; items: Item[] } | null>(null);
const showToast = vi.fn();

const findItemByUuid = (uuid: string): Item | null => {
  const search = (items: Item[]): Item | null => {
    for (const item of items) {
      if (item.uuid === uuid) return item;
      if (item.type === 'group') {
        const found = search(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  return project.value ? search(project.value.items) : null;
};

const findItemByIndex = (index: number[]): Item | null => {
  if (!project.value) return null;
  let items = project.value.items;
  let current: Item | null = null;
  for (const idx of index) {
    if (idx >= items.length) return null;
    current = items[idx];
    if (current.type === 'group') items = current.children;
  }
  return current;
};

const audio = (uuid: string, over: Partial<AudioItem> = {}): AudioItem => ({
  uuid,
  index: [0],
  displayName: uuid,
  color: '#6b7280',
  type: 'audio',
  mediaFileName: `${uuid}.mp3`,
  mediaPath: `media/${uuid}.mp3`,
  waveformPath: `${uuid}.json`,
  inPoint: 0,
  outPoint: 10,
  duration: 10,
  volume: 1,
  endBehavior: { action: 'nothing' },
  startBehavior: { action: 'nothing' },
  customActions: [],
  duckingBehavior: { mode: 'no-ducking' },
  fadeOutDuration: 1,
  playFade: 0,
  stopFade: 0,
  crossFade: 0,
  ...over,
});

/** Put items in the project (indices follow their position) and return the reactive copies. */
const load = <T extends Item[]>(...items: T): T => {
  const reindex = (list: Item[], parent: number[]) => {
    list.forEach((item, i) => {
      item.index = [...parent, i];
      if (item.type === 'group') reindex(item.children, item.index);
    });
  };
  reindex(items, []);
  project.value = { folderPath: '/project', items };
  return project.value.items as T;
};

const howlOf = (uuid: string): FakeHowl => {
  const found = [...fake.instances].reverse().find(h => h.opts.src[0].endsWith(`/${uuid}.mp3`));
  if (!found) throw new Error(`no Howl created for ${uuid}`);
  return found;
};

/** Play a cue and let its media load. */
const start = async (engine: ReturnType<typeof useAudioEngine>, item: AudioItem): Promise<FakeHowl> => {
  await engine.playCue(item);
  const howl = howlOf(item.uuid);
  howl.fire('load');
  return howl;
};

let engine: ReturnType<typeof useAudioEngine>;

beforeEach(() => {
  vi.useFakeTimers();
  fake.Howler._howls.length = 0;
  fake.instances.length = 0;
  fake.state.fileDuration = 10;
  project.value = null;
  showToast.mockClear();

  const states = new Map<string, any>();
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()));
    return states.get(key);
  });
  vi.stubGlobal('useProject', () => ({ currentProject: project, findItemByUuid, findItemByIndex }));
  vi.stubGlobal('useToast', () => ({ showToast }));
  vi.stubGlobal('useLocalization', () => ({ t: (key: string) => key }));

  engine = useAudioEngine();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Howl release', () => {
  it('unloads the Howl when a cue ends naturally', async () => {
    const [a] = load(audio('a'));
    const howl = await start(engine, a);
    expect(fake.Howler._howls).toContain(howl);

    vi.advanceTimersByTime(10_000);

    expect(engine.activeCues.value.has('a')).toBe(false);
    expect(howl.unloaded).toBe(true);
    expect(fake.Howler._howls).not.toContain(howl);
  });

  it('unloads the Howl after the stop fade-out', async () => {
    const [a] = load(audio('a', { fadeOutDuration: 1 }));
    const howl = await start(engine, a);

    await engine.stopCue('a');
    expect(engine.activeCues.value.has('a')).toBe(false);
    expect(fake.Howler._howls).toContain(howl); // still fading out

    vi.advanceTimersByTime(1000);
    expect(fake.Howler._howls).not.toContain(howl);
  });

  it('unloads every Howl on stop-all and clears group progress', async () => {
    const [group, b] = load(
      { uuid: 'g', index: [0], displayName: 'g', color: '', type: 'group', isExpanded: true,
        startBehavior: { action: 'play-first' }, endBehavior: { action: 'nothing' },
        children: [audio('a')] } as GroupItem,
      audio('b'),
    );
    await start(engine, group.children[0] as AudioItem);
    await start(engine, b);
    expect(engine.activeGroups.value.has('g')).toBe(true);

    await engine.stopAllCues();

    expect(engine.activeCues.value.size).toBe(0);
    expect(engine.activeGroups.value.size).toBe(0);
    expect(fake.Howler._howls).toHaveLength(0);
  });
});

describe('finalizeCue idempotence', () => {
  it('runs the end behaviour once when the end timer and onend both fire', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [a] = load(audio('a', { endBehavior: { action: 'next' } }), audio('b'));
    const howl = await start(engine, a);

    vi.advanceTimersByTime(10_000); // scheduled end
    howl.fire('end'); // browser-fired ended event, late

    expect(engine.activeCues.value.has('b')).toBe(true);
    expect(fake.instances.filter(h => h.opts.src[0].endsWith('/b.mp3'))).toHaveLength(1);
    // A second end behaviour would have tried to play b again
    expect(warn).not.toHaveBeenCalled();
  });

  it('second finalize is a no-op', async () => {
    const [a] = load(audio('a'));
    const howl = await start(engine, a);

    howl.fire('end');
    howl.fire('end');

    expect(howl.callsOf('stop')).toHaveLength(1);
    expect(howl.callsOf('unload')).toHaveLength(1);
    expect(engine.activeCues.value.size).toBe(0);
  });

  it('an external stop does not run the end behaviour', async () => {
    const [a] = load(audio('a', { endBehavior: { action: 'next' } }), audio('b'));
    await start(engine, a);

    await engine.stopCue('a');
    vi.advanceTimersByTime(20_000);

    expect(engine.activeCues.value.size).toBe(0);
    expect(fake.instances).toHaveLength(1);
  });
});

describe('cue lifecycle', () => {
  it('pause cancels the end timer, resume re-arms it', async () => {
    const [a] = load(audio('a', { endBehavior: { action: 'next' } }), audio('b'));
    await start(engine, a);

    vi.advanceTimersByTime(4000);
    await engine.pauseCue('a');
    vi.advanceTimersByTime(30_000);
    expect(engine.activeCues.value.has('a')).toBe(true);
    expect(engine.activeCues.value.has('b')).toBe(false);

    await engine.resumeCue('a');
    vi.advanceTimersByTime(5900);
    expect(engine.activeCues.value.has('a')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(engine.activeCues.value.has('a')).toBe(false);
    expect(engine.activeCues.value.has('b')).toBe(true);
  });
});

describe('panic', () => {
  it('stops only the cues playing when pressed and clears group progress', async () => {
    const [group, b] = load(
      { uuid: 'g', index: [0], displayName: 'g', color: '', type: 'group', isExpanded: true,
        startBehavior: { action: 'play-first' }, endBehavior: { action: 'nothing' },
        children: [audio('a', { endBehavior: { action: 'next' } })] } as GroupItem,
      audio('b'),
    );
    const howlA = await start(engine, group.children[0] as AudioItem);
    expect(engine.activeGroups.value.size).toBe(1);

    await engine.panicStop();
    expect(engine.activeCues.value.size).toBe(0);
    expect(engine.activeGroups.value.size).toBe(0);
    expect(howlA.callsOf('fade')).toEqual([[1, 0, 500]]);

    vi.advanceTimersByTime(200);
    const howlB = await start(engine, b);
    vi.advanceTimersByTime(600);

    expect(engine.activeCues.value.has('b')).toBe(true);
    expect(howlB.unloaded).toBe(false);
    expect(howlB.callsOf('stop')).toHaveLength(0);
    expect(howlA.unloaded).toBe(true);
    expect(fake.Howler._howls).toEqual([howlB]);
  });

  it('a panicked cue does not run its end behaviour', async () => {
    const [a] = load(audio('a', { endBehavior: { action: 'next' } }), audio('b'));
    const howl = await start(engine, a);

    vi.advanceTimersByTime(9800);
    await engine.panicStop();
    howl.fire('end'); // reaches its end during the fade
    vi.advanceTimersByTime(1000);

    expect(fake.instances).toHaveLength(1);
    expect(engine.activeCues.value.size).toBe(0);
  });
});

describe('custom actions', () => {
  const withAction = () => load(
    audio('a', { customActions: [{ timePoint: 5, action: { type: 'play-item', uuid: 'b' } }] }),
    audio('b'),
  );

  it('runs an action when playback crosses its time point', async () => {
    const [a] = withAction();
    await start(engine, a);

    vi.advanceTimersByTime(4900);
    expect(engine.activeCues.value.has('b')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(engine.activeCues.value.has('b')).toBe(true);
  });

  it('does not run an action when the cue is stopped before its time point', async () => {
    const [a] = withAction();
    await start(engine, a);

    vi.advanceTimersByTime(2000);
    await engine.stopCue('a');
    vi.advanceTimersByTime(10_000);

    expect(fake.instances).toHaveLength(1);
    expect(engine.activeCues.value.size).toBe(0);
  });
});

describe('paused cues arm no timers', () => {
  const pausedAt4 = async () => {
    const [a] = load(audio('a', { endBehavior: { action: 'next' }, stopFade: 2 }), audio('b'));
    const howl = await start(engine, a);
    vi.advanceTimersByTime(4000);
    await engine.pauseCue('a');
    return { a, howl };
  };

  const expectEndsOnlyAfterResume = async (howl: FakeHowl, remainingMs: number) => {
    vi.advanceTimersByTime(30_000);
    expect(engine.activeCues.value.has('a')).toBe(true);
    expect(engine.activeCues.value.has('b')).toBe(false);
    expect(howl.callsOf('fade')).toHaveLength(0);

    await engine.resumeCue('a');
    vi.advanceTimersByTime(remainingMs - 100);
    expect(engine.activeCues.value.has('a')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(engine.activeCues.value.has('a')).toBe(false);
    expect(engine.activeCues.value.has('b')).toBe(true);
  };

  it('seek while paused', async () => {
    const { howl } = await pausedAt4();
    await engine.seekCue('a', 7);
    await expectEndsOnlyAfterResume(howl, 3000);
  });

  it('loop toggle while paused', async () => {
    const { howl } = await pausedAt4();
    engine.setLoopForCue('a', false);
    await expectEndsOnlyAfterResume(howl, 6000);
  });

  it('property edit while paused', async () => {
    const { a, howl } = await pausedAt4();
    a.stopFade = 1;
    engine.rescheduleCueTriggers('a');
    vi.advanceTimersByTime(100);
    await expectEndsOnlyAfterResume(howl, 6000);
  });

  it('custom actions are not armed while paused', async () => {
    const [a] = load(
      audio('a', { customActions: [{ timePoint: 5, action: { type: 'play-item', uuid: 'b' } }] }),
      audio('b'),
    );
    await start(engine, a);
    vi.advanceTimersByTime(4000);
    await engine.pauseCue('a');
    await engine.seekCue('a', 4.5);
    vi.advanceTimersByTime(10_000);
    expect(engine.activeCues.value.has('b')).toBe(false);
  });
});

describe('trim edits', () => {
  it('in-point moved earlier while playing keeps the same absolute end', async () => {
    fake.state.fileDuration = 30;
    const [a] = load(audio('a', { inPoint: 10, outPoint: 20, duration: 30 }));
    const howl = await start(engine, a);

    vi.advanceTimersByTime(2000);
    expect(howl.seek()).toBe(12);

    a.inPoint = 5;
    engine.rescheduleCueTriggers('a');
    vi.advanceTimersByTime(100); // debounce
    expect(engine.activeCues.value.get('a')!.duration).toBe(15);

    vi.advanceTimersByTime(7800); // position 19.9
    expect(engine.activeCues.value.has('a')).toBe(true);
    vi.advanceTimersByTime(100); // position 20, the out-point
    expect(engine.activeCues.value.has('a')).toBe(false);
  });

  it('caps the out-point at the real file length', async () => {
    fake.state.fileDuration = 8;
    const [a] = load(audio('a', { outPoint: 10 }));
    await start(engine, a);

    expect(engine.activeCues.value.get('a')!.duration).toBe(8);
    vi.advanceTimersByTime(8000);
    expect(engine.activeCues.value.has('a')).toBe(false);
  });
});

describe('fades survive pause', () => {
  it('resume continues a fade-in for its remaining time', async () => {
    const [a] = load(audio('a', { playFade: 5, volume: 0.8 }));
    const howl = await start(engine, a);
    expect(howl.callsOf('fade')).toEqual([[0, 0.8, 5000]]);

    vi.advanceTimersByTime(2000);
    await engine.pauseCue('a');
    vi.advanceTimersByTime(60_000);
    await engine.resumeCue('a');
    expect(howl.callsOf('fade')).toHaveLength(1); // waits for Howler's 'play'
    vi.advanceTimersByTime(0);

    const fades = howl.callsOf('fade');
    expect(fades).toHaveLength(2);
    expect(fades[1].slice(1)).toEqual([0.8, 3000]);
  });

  it('a cue paused again before the resume settles keeps its fade for later', async () => {
    const [a] = load(audio('a', { playFade: 5 }));
    const howl = await start(engine, a);

    vi.advanceTimersByTime(2000);
    await engine.pauseCue('a');
    await engine.resumeCue('a');
    await engine.pauseCue('a');
    vi.advanceTimersByTime(1000);
    expect(howl.callsOf('fade')).toHaveLength(1);

    await engine.resumeCue('a');
    vi.advanceTimersByTime(0);
    expect(howl.callsOf('fade')[1].slice(1)).toEqual([1, 3000]);
  });

  it('a fade that already finished is not repeated', async () => {
    const [a] = load(audio('a', { playFade: 1 }));
    const howl = await start(engine, a);

    vi.advanceTimersByTime(2000);
    await engine.pauseCue('a');
    await engine.resumeCue('a');

    expect(howl.callsOf('fade')).toHaveLength(1);
  });
});

describe('media failure', () => {
  it('a load error leaves the other cues untouched', async () => {
    const [b, a] = load(audio('b'), audio('a', { duckingBehavior: { mode: 'stop-all' }, endBehavior: { action: 'next' } }), audio('c'));
    const howlB = await start(engine, b);

    await engine.playCue(a);
    const howlA = howlOf('a');
    expect(engine.activeCues.value.has('b')).toBe(true); // not stopped at setup
    howlA.fire('loaderror');

    expect(engine.activeCues.value.has('a')).toBe(false);
    expect(engine.activeCues.value.has('b')).toBe(true);
    expect(howlB.callsOf('fade')).toHaveLength(0);
    expect(howlB.callsOf('stop')).toHaveLength(0);
    expect(howlA.unloaded).toBe(true);
    expect(fake.Howler._howls).toEqual([howlB]);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('audio.mediaError: a.mp3', 'error');
    // A failed cue does not run its end behaviour
    expect(engine.activeCues.value.has('c')).toBe(false);
  });

  it('stop-all still stops the others once the media has loaded', async () => {
    const [b, a] = load(audio('b'), audio('a', { duckingBehavior: { mode: 'stop-all' } }));
    await start(engine, b);
    await start(engine, a);

    expect(engine.activeCues.value.has('b')).toBe(false);
    expect(engine.activeCues.value.has('a')).toBe(true);
  });

  it('a play error after load restores the volume it ducked', async () => {
    const [b, a] = load(audio('b'), audio('a', { duckingBehavior: { mode: 'duck-others', duckLevel: 0.5 } }));
    const howlB = await start(engine, b);
    const howlA = await start(engine, a);
    expect(howlB.callsOf('fade')).toEqual([[1, 0.5, 250]]);

    howlA.fire('playerror');

    expect(howlB.callsOf('fade')[1]).toEqual([0.5, 1, 1000]);
    expect(engine.activeCues.value.get('b')!.isDucked).toBe(false);
    expect(engine.activeCues.value.has('a')).toBe(false);
    expect(howlA.unloaded).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});

describe('ducking level', () => {
  it('duck-others with no stored level ducks to 0.2', async () => {
    const [b, a] = load(audio('b'), audio('a', { duckingBehavior: { mode: 'duck-others' } }));
    const howlB = await start(engine, b);
    await start(engine, a);

    expect(howlB.callsOf('fade')).toEqual([[1, 0.2, 250]]);
    expect(engine.activeCues.value.get('b')!.volume).toBe(0.2);
  });
});
