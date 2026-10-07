// Release notes reach the update dialog in two formats: HTML from
// electron-updater (Windows, Linux) and Markdown from the GitHub API (macOS,
// fallback check). Both are parsed into plain blocks that the dialog renders
// as text, so no markup from the network ever reaches the page.

export interface NoteSpan {
  text: string;
  bold?: boolean;
  code?: boolean;
  href?: string;
}

// Headings and paragraphs hold one line; a list holds one line per item.
export interface NoteBlock {
  kind: 'heading' | 'paragraph' | 'list';
  lines: NoteSpan[][];
}

interface SpanStyle {
  bold?: boolean;
  code?: boolean;
  href?: string;
}

const HTML_TAG = /<\/?(?:p|div|ul|ol|li|h[1-6]|br|strong|b|em|a|code|pre|blockquote)\b[^>]*>/i;

export function parseReleaseNotes(notes: string | null | undefined): NoteBlock[] {
  if (!notes || !notes.trim()) return [];
  return HTML_TAG.test(notes) ? parseHtml(notes) : parseMarkdown(notes);
}

// Only web links are kept; GitHub's site-relative links are made absolute.
function safeHref(raw: string): string | undefined {
  const url = raw.startsWith('/') && !raw.startsWith('//') ? `https://github.com${raw}` : raw;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function pushSpan(line: NoteSpan[], text: string, style: SpanStyle) {
  if (!text) return;
  const last = line[line.length - 1];
  if (last && !!last.bold === !!style.bold && !!last.code === !!style.code && last.href === style.href) {
    last.text += text;
    return;
  }
  const span: NoteSpan = { text };
  if (style.bold) span.bold = true;
  if (style.code) span.code = true;
  if (style.href) span.href = style.href;
  line.push(span);
}

// Collapses whitespace the way a browser would and drops empty lines.
function tidyLine(line: NoteSpan[]): NoteSpan[] {
  const out: NoteSpan[] = [];
  for (const span of line) {
    const text = span.text.replace(/\s+/g, ' ');
    const prev = out[out.length - 1];
    out.push({ ...span, text: prev && /\s$/.test(prev.text) ? text.replace(/^ /, '') : text });
  }
  if (out.length) {
    out[0]!.text = out[0]!.text.replace(/^ /, '');
    out[out.length - 1]!.text = out[out.length - 1]!.text.replace(/ $/, '');
  }
  return out.filter(span => span.text);
}

// --- Markdown -------------------------------------------------------------

const MD_INLINE = /(`+)([^`]+?)\1|(\*\*|__)(.+?)\3|\[([^\]]+)\]\(([^)\s]+)\)|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"*_])/g;

function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!|<>])/g, '$1');
}

function parseInline(text: string, style: SpanStyle, line: NoteSpan[]) {
  let last = 0;
  for (const match of text.matchAll(MD_INLINE)) {
    pushSpan(line, unescapeMarkdown(text.slice(last, match.index)), style);
    const [, , code, , bold, linkText, linkUrl, autoLink, bareUrl] = match;
    if (code !== undefined) {
      pushSpan(line, code, { ...style, code: true });
    } else if (bold !== undefined) {
      parseInline(bold, { ...style, bold: true }, line);
    } else if (linkText !== undefined) {
      parseInline(linkText, { ...style, href: safeHref(linkUrl!) }, line);
    } else {
      const url = (autoLink ?? bareUrl)!;
      pushSpan(line, url, { ...style, href: safeHref(url) });
    }
    last = match.index + match[0].length;
  }
  pushSpan(line, unescapeMarkdown(text.slice(last)), style);
}

function parseMarkdown(notes: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list = null as string[] | null;

  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', lines: [markdownLine(paragraph.join(' '))] });
    paragraph = [];
  };
  const endList = () => {
    if (list) blocks.push({ kind: 'list', lines: list.map(markdownLine) });
    list = null;
  };

  for (const raw of notes.replace(/\r\n?/g, '\n').split('\n')) {
    const text = raw.trim();
    const heading = /^#{1,6}\s+(.*?)\s*#*$/.exec(text);
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(text);

    if (!text || /^([-*_])(\s*\1){2,}$/.test(text)) {
      endParagraph();
      endList();
    } else if (heading) {
      endParagraph();
      endList();
      blocks.push({ kind: 'heading', lines: [markdownLine(heading[1]!)] });
    } else if (item) {
      endParagraph();
      (list ??= []).push(item[1]!);
    } else if (list && /^\s/.test(raw)) {
      list[list.length - 1] += ` ${text}`;
    } else {
      endList();
      paragraph.push(text);
    }
  }
  endParagraph();
  endList();
  return blocks.filter(block => block.lines.length);
}

function markdownLine(text: string): NoteSpan[] {
  const line: NoteSpan[] = [];
  parseInline(text, {}, line);
  return tidyLine(line);
}

// --- HTML -----------------------------------------------------------------

const HTML_TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+|<)/g;
const SKIPPED_TAGS = new Set(['script', 'style', 'template', 'iframe', 'object', 'svg', 'math', 'head', 'title']);
const BLOCK_TAGS = new Set(['p', 'div', 'pre', 'blockquote', 'table', 'tr', 'details', 'summary']);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

function hrefOf(attributes: string): string | undefined {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
  return match ? safeHref(decodeEntities(match[1] ?? match[2] ?? match[3] ?? '')) : undefined;
}

function parseHtml(notes: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let current = null as NoteBlock | null;
  let line: NoteSpan[] = [];
  let skipping = 0;
  let bold = 0;
  let code = 0;
  const links: (string | undefined)[] = [];

  const endLine = () => {
    const tidy = tidyLine(line);
    line = [];
    if (!tidy.length) return;
    if (!current) {
      current = { kind: 'paragraph', lines: [] };
      blocks.push(current);
    }
    current.lines.push(tidy);
  };
  const startBlock = (kind: NoteBlock['kind'] | null) => {
    endLine();
    if (current && !current.lines.length) blocks.pop();
    current = kind ? { kind, lines: [] } : null;
    if (current) blocks.push(current);
  };

  for (const [token, closing, tagName, attributes, text] of notes.matchAll(HTML_TOKEN)) {
    if (token.startsWith('<!--')) continue;
    const tag = tagName?.toLowerCase();

    if (tag && SKIPPED_TAGS.has(tag)) {
      if (!attributes?.trimEnd().endsWith('/')) skipping = Math.max(0, skipping + (closing ? -1 : 1));
      continue;
    }
    if (skipping) continue;

    if (text !== undefined) {
      const style: SpanStyle = { bold: bold > 0, code: code > 0, href: links[links.length - 1] };
      pushSpan(line, decodeEntities(text), style);
    } else if (tag === 'strong' || tag === 'b') {
      bold = Math.max(0, bold + (closing ? -1 : 1));
    } else if (tag === 'code') {
      code = Math.max(0, code + (closing ? -1 : 1));
    } else if (tag === 'a') {
      if (closing) links.pop();
      else links.push(hrefOf(attributes ?? ''));
    } else if (tag === 'br') {
      pushSpan(line, ' ', {});
    } else if (tag && /^h[1-6]$/.test(tag)) {
      startBlock(closing ? null : 'heading');
    } else if (tag === 'ul' || tag === 'ol') {
      startBlock(closing ? null : 'list');
    } else if (tag === 'li') {
      endLine();
      if (!closing && current?.kind !== 'list') startBlock('list');
    } else if (tag && BLOCK_TAGS.has(tag)) {
      // A paragraph inside a list item stays part of that item.
      if (current?.kind !== 'list') startBlock(closing ? null : 'paragraph');
    }
  }
  startBlock(null);
  return blocks;
}
