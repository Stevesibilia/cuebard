import { describe, it, expect } from 'vitest';
import { parseReleaseNotes } from '../app/utils/releaseNotes';

describe('parseReleaseNotes', () => {
  it('returns nothing for empty notes', () => {
    expect(parseReleaseNotes('')).toEqual([]);
    expect(parseReleaseNotes(undefined)).toEqual([]);
    expect(parseReleaseNotes('  \n ')).toEqual([]);
  });

  describe('Markdown (GitHub API)', () => {
    it('reads headings, lists and paragraphs', () => {
      const notes = [
        "## What's Changed",
        '',
        '- fix(release): bundle ffmpeg (steve)',
        '* second item',
        '1. numbered',
        '',
        '## Statistics',
        '',
        'First line',
        'continues here.',
      ].join('\r\n');
      expect(parseReleaseNotes(notes)).toEqual([
        { kind: 'heading', lines: [[{ text: "What's Changed" }]] },
        { kind: 'list', lines: [
          [{ text: 'fix(release): bundle ffmpeg (steve)' }],
          [{ text: 'second item' }],
          [{ text: 'numbered' }],
        ] },
        { kind: 'heading', lines: [[{ text: 'Statistics' }]] },
        { kind: 'paragraph', lines: [[{ text: 'First line continues here.' }]] },
      ]);
    });

    it('reads bold, code and links', () => {
      expect(parseReleaseNotes('- **Commits**: 1 in `main`, see [the PR](https://github.com/x/y/pull/1)')).toEqual([
        { kind: 'list', lines: [[
          { text: 'Commits', bold: true },
          { text: ': 1 in ' },
          { text: 'main', code: true },
          { text: ', see ' },
          { text: 'the PR', href: 'https://github.com/x/y/pull/1' },
        ]] },
      ]);
    });

    it('links bare URLs without trailing punctuation', () => {
      expect(parseReleaseNotes('Full changelog: https://github.com/x/y/compare/v1...v2.')).toEqual([
        { kind: 'paragraph', lines: [[
          { text: 'Full changelog: ' },
          { text: 'https://github.com/x/y/compare/v1...v2', href: 'https://github.com/x/y/compare/v1...v2' },
          { text: '.' },
        ]] },
      ]);
    });

    it('keeps the text of a link with an unsafe URL but drops the link', () => {
      expect(parseReleaseNotes('[click](data:text/html,x)')[0]!.lines[0]![0]).toEqual({ text: 'click' });
    });

    it('joins an indented continuation line to its list item', () => {
      expect(parseReleaseNotes('- first\n  more\n- second')).toEqual([
        { kind: 'list', lines: [[{ text: 'first more' }], [{ text: 'second' }]] },
      ]);
    });

    it('drops rules and unescapes characters', () => {
      expect(parseReleaseNotes('one\n\n---\n\n2 \\* 3')).toEqual([
        { kind: 'paragraph', lines: [[{ text: 'one' }]] },
        { kind: 'paragraph', lines: [[{ text: '2 * 3' }]] },
      ]);
    });
  });

  describe('HTML (electron-updater)', () => {
    it('reads headings, lists and paragraphs', () => {
      const notes = `<h2>What&#39;s Changed</h2>
<ul>
<li>fix(release): bundle <code>ffmpeg</code> by <a class="user-mention" href="https://github.com/steve">@steve</a></li>
<li><strong>Commits</strong>: 1</li>
</ul>
<p>Thanks &amp; enjoy</p>`;
      expect(parseReleaseNotes(notes)).toEqual([
        { kind: 'heading', lines: [[{ text: "What's Changed" }]] },
        { kind: 'list', lines: [
          [
            { text: 'fix(release): bundle ' },
            { text: 'ffmpeg', code: true },
            { text: ' by ' },
            { text: '@steve', href: 'https://github.com/steve' },
          ],
          [{ text: 'Commits', bold: true }, { text: ': 1' }],
        ] },
        { kind: 'paragraph', lines: [[{ text: 'Thanks & enjoy' }]] },
      ]);
    });

    it('drops scripts, styles, event handlers and unsafe links', () => {
      const notes = '<p onclick="x()">Hi<script>alert(1)</script><style>p{}</style> <a href="javascript:alert(1)">there</a><img src=x onerror=alert(1)></p>';
      expect(parseReleaseNotes(notes)).toEqual([
        { kind: 'paragraph', lines: [[{ text: 'Hi there' }]] },
      ]);
    });

    it('makes GitHub site links absolute', () => {
      expect(parseReleaseNotes('<p><a href="/Stevesibilia/cuebard/pull/1">#1</a></p>')[0]!.lines[0]).toEqual([
        { text: '#1', href: 'https://github.com/Stevesibilia/cuebard/pull/1' },
      ]);
    });

    it('keeps a paragraph inside a list item in that item', () => {
      expect(parseReleaseNotes('<ul><li><p>one</p></li><li>two</li></ul>')).toEqual([
        { kind: 'list', lines: [[{ text: 'one' }], [{ text: 'two' }]] },
      ]);
    });

    it('puts loose text in a paragraph', () => {
      expect(parseReleaseNotes('Hello<br>world<ul><li>x</li></ul>tail')).toEqual([
        { kind: 'paragraph', lines: [[{ text: 'Hello world' }]] },
        { kind: 'list', lines: [[{ text: 'x' }]] },
        { kind: 'paragraph', lines: [[{ text: 'tail' }]] },
      ]);
    });
  });
});
