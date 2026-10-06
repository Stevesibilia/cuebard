import { describe, it, expect } from 'vitest';
import { isTextEntryElement } from '~/utils/keyboard';

const input = (type?: string) => ({ tagName: 'INPUT', type });

describe('isTextEntryElement', () => {
  it.each(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image'])(
    'input type %s does not take text',
    (type) => {
      expect(isTextEntryElement(input(type))).toBe(false);
    },
  );

  it.each(['text', 'search', 'number', 'email', 'password', 'url', 'tel'])(
    'input type %s takes text',
    (type) => {
      expect(isTextEntryElement(input(type))).toBe(true);
    },
  );

  it('an input with no type is a text input', () => {
    expect(isTextEntryElement(input())).toBe(true);
    expect(isTextEntryElement(input(''))).toBe(true);
  });

  it('input type is matched case-insensitively', () => {
    expect(isTextEntryElement(input('RANGE'))).toBe(false);
    expect(isTextEntryElement({ tagName: 'input', type: 'Text' })).toBe(true);
  });

  it('textarea, select and contenteditable take text', () => {
    expect(isTextEntryElement({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'SELECT' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('other elements and no element do not take text', () => {
    expect(isTextEntryElement({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextEntryElement({ tagName: 'BODY', isContentEditable: false })).toBe(false);
    expect(isTextEntryElement(null)).toBe(false);
  });
});
