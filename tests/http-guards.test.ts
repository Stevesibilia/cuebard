import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { isSafeExternalUrl } from '../electron/lib/http-guards';

describe('isSafeExternalUrl', () => {
  it('allows web and mail links', () => {
    expect(isSafeExternalUrl('https://github.com/tdoukinitsas/liveplay')).toBe(true);
    expect(isSafeExternalUrl('http://example.com/')).toBe(true);
    expect(isSafeExternalUrl('mailto:someone@example.com')).toBe(true);
  });

  it('refuses every other scheme and non-URLs', () => {
    expect(isSafeExternalUrl('file:///Applications/Calculator.app')).toBe(false);
    expect(isSafeExternalUrl('smb://server/share')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('tel:+390000000')).toBe(false);
    expect(isSafeExternalUrl('/etc/passwd')).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
  });
});
