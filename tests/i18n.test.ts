import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import fs from 'fs';
import path from 'path';
import { resolveMessage } from '../app/utils/i18n';
import { controlActionLabel, controlCategoryLabel } from '../app/utils/controlLabels';

const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'locales');

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') acc[prefix + key] = value;
    else Object.assign(acc, flatten(value, `${prefix}${key}.`));
    return acc;
  }, {});

const locales: Record<string, Tree> = Object.fromEntries(
  fs.readdirSync(localesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'))]),
);
const en = flatten(locales.en);
const placeholders = (message: string) => (message.match(/\{\w+\}/g) ?? []).sort();

// Locales translated in full. The others fall back to English key by key.
const COMPLETE_LOCALES = ['it'];

describe('resolveMessage', () => {
  const data = {
    en: { cart: { close: 'Close', conflict: 'Already assigned to Slot {slot}' }, _metadata: { code: 'en' } },
    it: { cart: { close: 'Chiudi' } },
  };

  it('uses the current locale', () => {
    expect(resolveMessage(data, 'it', 'cart.close')).toBe('Chiudi');
  });

  it('falls back to English for a key the locale lacks', () => {
    expect(resolveMessage(data, 'it', 'cart.conflict', { slot: 3 })).toBe('Already assigned to Slot 3');
  });

  it('falls back to English for a locale that is not loaded', () => {
    expect(resolveMessage(data, 'xx', 'cart.close')).toBe('Close');
  });

  it('returns the key when no locale has it', () => {
    expect(resolveMessage(data, 'it', 'cart.missing')).toBe('cart.missing');
    expect(resolveMessage({}, 'en', 'cart.close')).toBe('cart.close');
  });

  it('does not resolve sections or metadata', () => {
    expect(resolveMessage(data, 'en', 'cart')).toBe('cart');
    expect(resolveMessage(data, 'en', '_metadata.code')).toBe('_metadata.code');
  });

  it('leaves a placeholder without a value in place', () => {
    expect(resolveMessage(data, 'en', 'cart.conflict')).toBe('Already assigned to Slot {slot}');
    expect(resolveMessage(data, 'en', 'cart.conflict', { other: 1 })).toBe('Already assigned to Slot {slot}');
  });
});

describe('locale files', () => {
  it.each(Object.keys(locales))('%s has only keys that English has, with the same placeholders', (code) => {
    const flat = flatten(locales[code]);
    expect(Object.keys(flat).filter((key) => !(key in en))).toEqual([]);
    const mismatched = Object.keys(flat).filter(
      (key) => key in en && placeholders(flat[key]).join() !== placeholders(en[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it.each(COMPLETE_LOCALES)('%s translates every English key', (code) => {
    const flat = flatten(locales[code]);
    expect(Object.keys(en).filter((key) => !(key in flat))).toEqual([]);
  });
});

describe('keys used in the app', () => {
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(vue|ts)$/.test(entry.name)) sources.push(full);
    }
  };
  walk(path.join(root, 'app'));

  it('all exist in English', () => {
    const missing: string[] = [];
    for (const file of sources) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) {
        if (!(match[1] in en)) missing.push(`${path.relative(root, file)}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every keyboard and MIDI action and category has an English label', async () => {
    // The composables declare module-level state with Nuxt's auto-imports
    vi.stubGlobal('ref', ref);
    vi.stubGlobal('computed', computed);
    const { MIDI_ACTIONS } = await import('../app/composables/useMidiController');
    const { GLOBAL_ACTIONS } = await import('../app/composables/useCartHotkeys');
    vi.unstubAllGlobals();

    const t = (key: string, params?: Record<string, string | number>) =>
      resolveMessage(locales, 'en', key, params);
    for (const action of [...MIDI_ACTIONS, ...GLOBAL_ACTIONS]) {
      expect(controlActionLabel(t, action.id)).toBe(action.label);
      expect(controlCategoryLabel(t, action.category)).toBe(action.category);
    }
  });

  it('every menu label the main process uses exists in English', () => {
    const menu = fs.readFileSync(path.join(root, 'electron/menu.js'), 'utf8');
    const used = [...menu.matchAll(/label: t\.(\w+)/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((key) => !(`menu.${key}` in en))).toEqual([]);
  });
});
