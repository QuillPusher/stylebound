/*
 * Blocks: the engine's parsed blocks as plain data (see docs/API.md), and the
 * mapping from an issue to its block. Shared by the entry point and the verifier.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('./engine.js');

export function parse(text) {
  const parsed = engine.parse(text);
  return { text, blocks: toBlocks(parsed) };
}

// A block's segments, one per line, as document offsets. `match` is the span
// used to find the block for an issue: an image-alt block matches the whole
// image syntax and a table cell the whole space between its pipes, so issues
// on an empty alt text or an empty cell still map to their own block.
function segments(b, lines) {
  return b.lineIdx.map((li, k) => {
    const ln = lines[li];
    const seg = b.ranges ? b.ranges[k] : [ln.contentStart, ln.text.length];
    const match = b.kind === 'image-alt' ? [b.image.start, b.image.end]
      : b.kind === 'cell' ? b.cellRaw : seg;
    return {
      line: li,
      start: ln.offset + seg[0], end: ln.offset + seg[1],
      matchStart: ln.offset + match[0], matchEnd: ln.offset + match[1]
    };
  });
}

export function toBlocks(parsed) {
  const { lines, text } = parsed;
  return parsed.blocks.map((b, id) => {
    const segs = segments(b, lines);
    const first = segs[0];
    const last = segs[segs.length - 1];
    const block = {
      id,
      kind: b.kind,
      start: first.start,
      end: last.end,
      line: first.line + 1,
      endLine: last.line + 1,
      source: text.slice(first.start, last.end),
      prose: b.text,
      checked: b.checked
    };
    if (b.kind === 'heading') block.level = b.level;
    if (b.kind === 'list') { block.ordered = !!b.ordered; block.listId = b.listId; }
    if (b.kind === 'cell') { block.header = !!b.header; block.column = b.col; }
    Object.defineProperty(block, 'segments', { value: segs, enumerable: false });
    return block;
  });
}

// Document-level rules report through temporary blocks that are not in
// parsed.blocks, so the block is found by position: same kind first, then
// any kind, then any block on the same line.
export function findBlock(issue, blocks) {
  const inside = b => b.segments.some(s => (s.matchStart <= issue.start && issue.start < s.matchEnd) || (s.matchStart === s.matchEnd && s.matchStart === issue.start));
  const line = issue.line - 1;
  const onLine = b => b.segments.some(s => s.line === line);
  const found = blocks.find(b => b.kind === issue.blockKind && inside(b))
    || blocks.find(inside)
    || blocks.find(b => b.kind === issue.blockKind && onLine(b))
    || blocks.find(onLine);
  if (!found) throw new Error(`no block for issue ${issue.ruleId} at line ${issue.line}`);
  return found.id;
}
