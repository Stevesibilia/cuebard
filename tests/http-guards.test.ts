import { describe, it, expect } from 'vitest';
import {
  isLoopback,
  isCrossSiteBrowserRequest,
  isAllowedHost,
  parseIndexPath,
  isSafeExternalUrl,
// @ts-expect-error CommonJS module without type declarations
} from '../electron/lib/http-guards';

describe('isLoopback', () => {
  it('accepts IPv4, IPv6 and IPv6-mapped loopback', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
  });

  it('refuses LAN and missing addresses', () => {
    expect(isLoopback('192.168.1.42')).toBe(false);
    expect(isLoopback('::ffff:192.168.1.42')).toBe(false);
    expect(isLoopback(undefined)).toBe(false);
  });
});

describe('isCrossSiteBrowserRequest', () => {
  it('passes curl and scripts (no Origin, no Sec-Fetch-Site)', () => {
    expect(isCrossSiteBrowserRequest({ host: 'localhost:8080', 'user-agent': 'curl/8' })).toBe(false);
  });

  it('passes a URL typed in the address bar and same-origin requests', () => {
    expect(isCrossSiteBrowserRequest({ 'sec-fetch-site': 'none' })).toBe(false);
    expect(isCrossSiteBrowserRequest({ 'sec-fetch-site': 'same-origin' })).toBe(false);
  });

  it('refuses any request carrying an Origin', () => {
    expect(isCrossSiteBrowserRequest({ origin: 'https://evil.example' })).toBe(true);
    expect(isCrossSiteBrowserRequest({ origin: 'null' })).toBe(true);
  });

  it('refuses cross-site and same-site subresource requests', () => {
    expect(isCrossSiteBrowserRequest({ 'sec-fetch-site': 'cross-site' })).toBe(true);
    expect(isCrossSiteBrowserRequest({ 'sec-fetch-site': 'same-site' })).toBe(true);
  });
});

describe('isAllowedHost', () => {
  const names = ['stage-laptop', 'stage-laptop.local'];

  it('allows IP literals with or without port', () => {
    expect(isAllowedHost('192.168.1.42:8080', names)).toBe(true);
    expect(isAllowedHost('127.0.0.1', names)).toBe(true);
    expect(isAllowedHost('[::1]:8080', names)).toBe(true);
    expect(isAllowedHost('[fe80::1]', names)).toBe(true);
  });

  it('allows localhost and the machine names, case-insensitively', () => {
    expect(isAllowedHost('localhost:8080', names)).toBe(true);
    expect(isAllowedHost('LOCALHOST', names)).toBe(true);
    expect(isAllowedHost('Stage-Laptop.local:8080', names)).toBe(true);
    expect(isAllowedHost('stage-laptop', names)).toBe(true);
  });

  it('refuses foreign names (DNS rebinding)', () => {
    expect(isAllowedHost('evil.example', names)).toBe(false);
    expect(isAllowedHost('attacker.example:8080', names)).toBe(false);
    expect(isAllowedHost('localhost.evil.example', names)).toBe(false);
    expect(isAllowedHost('stage-laptop.evil.example', names)).toBe(false);
  });

  it('refuses missing or malformed hosts', () => {
    expect(isAllowedHost(undefined, names)).toBe(false);
    expect(isAllowedHost('', names)).toBe(false);
    expect(isAllowedHost('[not-an-ip]:8080', names)).toBe(false);
    expect(isAllowedHost('a:b:c', names)).toBe(false);
  });
});

describe('parseIndexPath', () => {
  it('parses comma-separated non-negative integers', () => {
    expect(parseIndexPath('0')).toEqual([0]);
    expect(parseIndexPath('1,0')).toEqual([1, 0]);
    expect(parseIndexPath('1, 0')).toEqual([1, 0]);
  });

  it('refuses anything else', () => {
    expect(parseIndexPath('-1')).toBeNull();
    expect(parseIndexPath('1,x')).toBeNull();
    expect(parseIndexPath('1.5')).toBeNull();
    expect(parseIndexPath('0x1')).toBeNull();
    expect(parseIndexPath('1,,2')).toBeNull();
    expect(parseIndexPath('')).toBeNull();
    expect(parseIndexPath('99999999999999999999')).toBeNull();
    expect(parseIndexPath(undefined)).toBeNull();
  });
});

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
