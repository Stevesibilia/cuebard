import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { isSameAppUrl } from '../electron/lib/navigation';

describe('isSameAppUrl', () => {
  const devUrl = 'http://localhost:3000';
  const indexUrl = 'file:///Applications/E-LivePlay.app/Contents/Resources/app/.output/public/index.html';

  it('allows same-origin navigation on the dev server', () => {
    expect(isSameAppUrl('http://localhost:3000/', devUrl)).toBe(true);
    expect(isSameAppUrl('http://localhost:3000/workspace?x=1#y', devUrl)).toBe(true);
  });

  it('refuses another origin from the dev server', () => {
    expect(isSameAppUrl('http://localhost:3001/', devUrl)).toBe(false);
    expect(isSameAppUrl('https://localhost:3000/', devUrl)).toBe(false);
    expect(isSameAppUrl('https://evil.example/', devUrl)).toBe(false);
    expect(isSameAppUrl('file:///Users/me/Pictures/map.png', devUrl)).toBe(false);
  });

  it('allows the same packaged index file, with query or hash', () => {
    expect(isSameAppUrl(indexUrl, indexUrl)).toBe(true);
    expect(isSameAppUrl(indexUrl + '#/workspace', indexUrl)).toBe(true);
  });

  it('refuses another file from the packaged app', () => {
    expect(isSameAppUrl('file:///Users/me/Pictures/map.png', indexUrl)).toBe(false);
    expect(isSameAppUrl('https://evil.example/', indexUrl)).toBe(false);
  });

  it('refuses everything when there is no app URL or it is a data: page', () => {
    expect(isSameAppUrl('https://evil.example/', null)).toBe(false);
    expect(isSameAppUrl('data:text/html,hi', 'data:text/html,hi')).toBe(false);
  });

  it('refuses unparseable URLs', () => {
    expect(isSameAppUrl('not a url', devUrl)).toBe(false);
  });
});
