import { describe, it, expect } from 'vitest';
import { serializeProject } from '../app/utils/projectSerialize';

const peaks = { length: 3, duration: 12.5, peaks: [0.1, 0.9, 0.4] };

const project = () => ({
  name: 'Show',
  schemaVersion: 5,
  items: [
    { type: 'audio', uuid: 'a', waveformPath: 'a.json', waveform: peaks, outPoint: 12.5 },
    {
      type: 'group', uuid: 'g', children: [
        { type: 'audio', uuid: 'b', waveformPath: 'b.json', waveform: peaks },
      ],
    },
  ],
  cartItems: [{ slot: 0, itemUuid: 'c', index: [-1, 0] }],
  cartOnlyItems: [{ type: 'audio', uuid: 'c', waveformPath: 'c.json', waveform: peaks }],
});

// Every key present anywhere in a parsed JSON value.
const allKeys = (value: any): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)])
    : [];

describe('serializeProject', () => {
  it('writes no waveform key at any depth, including cart-only items', () => {
    const keys = allKeys(JSON.parse(serializeProject(project())));
    expect(keys).not.toContain('waveform');
    expect(serializeProject(project())).not.toContain('"peaks"');
  });

  it('keeps every waveformPath', () => {
    const parsed = JSON.parse(serializeProject(project()));
    expect(parsed.items[0].waveformPath).toBe('a.json');
    expect(parsed.items[1].children[0].waveformPath).toBe('b.json');
    expect(parsed.cartOnlyItems[0].waveformPath).toBe('c.json');
  });

  it('round-trips everything else unchanged and does not mutate the project', () => {
    const source = project();
    const parsed = JSON.parse(serializeProject(source));
    const { waveform: _a, ...a } = source.items[0] as any;
    expect(parsed.items[0]).toEqual(a);
    expect(parsed.cartItems).toEqual(source.cartItems);
    expect(parsed.name).toBe('Show');
    expect(source.items[0].waveform).toBe(peaks);
  });

  it('is pretty-printed as before', () => {
    expect(serializeProject({ name: 'x' })).toBe('{\n  "name": "x"\n}');
  });
});
