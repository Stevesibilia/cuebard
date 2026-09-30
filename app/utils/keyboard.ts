// Input types that take no text: focus on one of these must not block hotkeys
const NON_TEXT_INPUT_TYPES = new Set([
  'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image',
]);

/**
 * True when the element accepts text entry, so keystrokes belong to it and
 * not to the app's hotkeys. Sliders, checkboxes and buttons return false.
 */
export function isTextEntryElement(
  el: { tagName: string; type?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUT_TYPES.has((el.type || 'text').toLowerCase());
  return false;
}
