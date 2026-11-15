/*
 * DOCX reading (plan chunk 3.1): turns a .docx file into Markdown that the
 * checker reads, with a map from each Markdown block back to its DOCX
 * paragraph. The file is only read, never written. Known limits are in
 * docs/DOCX-LIMITS.md.
 */
import { readZip } from './zip.mjs';

export class DocxError extends Error {}

/* ------------------------------------------------------------------ */
/* A small XML reader: elements, attributes and text, enough for WordprocessingML. */

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function decode(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] !== undefined ? ENTITIES[e] : m;
  });
}

export function parseXml(xml) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.children.push({ text: m[1] });
    else if (m[3]) {
      if (m[2]) { stack.pop(); continue; }
      const attrs = {};
      const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = ar.exec(m[4]))) attrs[a[1]] = decode(a[2] !== undefined ? a[2] : a[3]);
      const node = { name: m[3], attrs, children: [] };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) {
      top.children.push({ text: decode(m[6]) });
    }
  }
  return root;
}

const kids = (node, name) => (node && node.children ? node.children.filter(c => c.name === name) : []);
const kid = (node, name) => kids(node, name)[0];
const val = node => (node ? node.attrs['w:val'] : undefined);

/* ------------------------------------------------------------------ */
/* Styles and numbering. */

function readStyles(xml) {
  const styles = {};
  if (!xml) return styles;
  for (const s of kids(kid(parseXml(xml), 'w:styles'), 'w:style')) {
    const id = s.attrs['w:styleId'];
    const name = (val(kid(s, 'w:name')) || id || '').toLowerCase();
    const ppr = kid(s, 'w:pPr');
    const outline = ppr && kid(ppr, 'w:outlineLvl');
    styles[id] = { name, basedOn: val(kid(s, 'w:basedOn')), outline: outline ? Number(val(outline)) : null };
  }
  return styles;
}

function readNumbering(xml) {
  const formats = {}; // numId -> ilvl -> numFmt
  if (!xml) return formats;
  const root = kid(parseXml(xml), 'w:numbering');
  const abstract = {};
  for (const a of kids(root, 'w:abstractNum')) {
    const levels = {};
    for (const l of kids(a, 'w:lvl')) levels[l.attrs['w:ilvl']] = val(kid(l, 'w:numFmt')) || 'bullet';
    abstract[a.attrs['w:abstractNumId']] = levels;
  }
  for (const n of kids(root, 'w:num')) formats[n.attrs['w:numId']] = abstract[val(kid(n, 'w:abstractNumId'))] || {};
  return formats;
}

const ORDERED = new Set(['decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman', 'decimalZero']);
const MONO = /consolas|courier|menlo|monaco|lucida console|source code|fira code|cascadia|mono/i;
const CODE_STYLE = /code|verbatim|source|preformatted|monospace/i;

// Table of contents, table of figures and index entries: Word builds them from
// the headings and captions, so they are not checked (they appear in the
// Markdown view as one HTML comment).
const TOC_STYLE = /^(toc \d|toc heading|table of figures|index \d|index heading)$/;

function styleChain(styleId, styles) {
  const names = [];
  for (let id = styleId, guard = 0; id && guard < 10; guard++) {
    const s = styles[id];
    names.push(s ? s.name : String(id).toLowerCase());
    id = s && s.basedOn;
  }
  return names;
}

function headingLevel(styleId, styles) {
  for (let id = styleId, guard = 0; id && guard < 10; guard++) {
    const s = styles[id];
    const name = s ? s.name : String(id).toLowerCase();
    let m = /^heading\s*(\d)$/.exec(name) || /^heading(\d)$/.exec(String(id).toLowerCase());
    if (m) return Math.min(6, Number(m[1]));
    if (name === 'title') return 1;
    if (s && s.outline !== null && s.outline < 6) return s.outline + 1;
    id = s && s.basedOn;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Runs to Markdown. */

function runParts(node, out) {
  for (const c of node.children || []) {
    if (!c.name) continue;
    if (c.name === 'w:del' || c.name === 'w:moveFrom') continue; // tracked deletions are not text
    if (c.name === 'w:r') {
      const rpr = kid(c, 'w:rPr');
      const style = rpr ? val(kid(rpr, 'w:rStyle')) || '' : '';
      const fonts = rpr && kid(rpr, 'w:rFonts');
      const font = fonts ? fonts.attrs['w:ascii'] || fonts.attrs['w:hAnsi'] || '' : '';
      const bold = rpr && kid(rpr, 'w:b') && val(kid(rpr, 'w:b')) !== '0' && val(kid(rpr, 'w:b')) !== 'false';
      const code = CODE_STYLE.test(style) || MONO.test(font);
      let text = '';
      for (const t of c.children) {
        if (t.name === 'w:t') text += (t.children || []).map(x => x.text || '').join('');
        else if (t.name === 'w:tab') text += '\t';
        else if (t.name === 'w:br' || t.name === 'w:cr') text += '\n';
        else if (t.name === 'w:noBreakHyphen') text += '-';
      }
      if (text) out.push({ text, code, bold });
    } else if (c.name !== 'w:pPr' && c.name !== 'w:rPr') {
      runParts(c, out); // hyperlinks, insertions, smart tags, simple fields
    }
  }
  return out;
}

function inline(parts) {
  // Merge neighbouring runs with the same formatting, then wrap them.
  const merged = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && last.code === p.code && last.bold === p.bold) last.text += p.text;
    else merged.push({ ...p });
  }
  return merged.map(p => {
    let t = p.text;
    if (p.code) {
      const fence = t.includes('`') ? '``' : '`';
      t = fence + (t.includes('`') ? ' ' + t + ' ' : t) + fence;
    }
    if (p.bold && t.trim()) {
      const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0];
      t = lead + '**' + t.trim() + '**' + trail;
    }
    return t;
  }).join('');
}

/* ------------------------------------------------------------------ */

/**
 * Reads a .docx file (a Buffer). Returns { markdown, blocks } where each
 * block is { paragraph, style, kind, line } for the DOCX paragraph (1-based,
 * in document order, table cells included) that starts at Markdown line `line`.
 */
export function docxToMarkdown(buf) {
  let files;
  try { files = readZip(buf); } catch (e) { throw new DocxError(`This is not a DOCX file: ${e.message}`); }
  const doc = files.get('word/document.xml');
  if (!doc) throw new DocxError('This is not a DOCX file: word/document.xml is missing.');
  const styles = readStyles(files.get('word/styles.xml') && files.get('word/styles.xml').toString('utf8'));
  const numbering = readNumbering(files.get('word/numbering.xml') && files.get('word/numbering.xml').toString('utf8'));
  const body = kid(kid(parseXml(doc.toString('utf8')), 'w:document'), 'w:body');
  if (!body) throw new DocxError('The DOCX file has no body.');

  const lines = [];
  const blocks = [];
  let paragraphNo = 0;
  // A Word document has one title (Title style) and chapters in Heading 1.
  // When it has a title, or more than one Heading 1, every heading moves one
  // level down, so the title is the only top-level heading.
  let level1 = 0;
  let hasTitle = false;
  (function count(node) {
    for (const c of node.children || []) {
      if (c.name === 'w:p') {
        const ppr = kid(c, 'w:pPr');
        const id = ppr ? val(kid(ppr, 'w:pStyle')) : undefined;
        const chain = styleChain(id, styles);
        if (chain.some(n => TOC_STYLE.test(n)) || chain[0] === 'subtitle') continue;
        if (chain.includes('title')) hasTitle = true;
        else if (headingLevel(id, styles) === 1) level1++;
      } else if (c.name === 'w:sdt') count(kid(c, 'w:sdtContent') || {});
    }
  })(body);
  const shift = hasTitle || level1 > 1 ? 1 : 0;
  let toc = [];
  const closeToc = () => {
    if (!toc.length) return;
    blank();
    lines.push('<!-- Table of contents (not checked):', ...toc.map(l => l.replace(/--/g, '- -')), '-->');
    blank();
    toc = [];
  };
  let codeOpen = false;
  const counters = {};
  const styleName = id => (id && styles[id] ? styles[id].name : id || 'normal');
  const blank = () => { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); };
  const closeCode = () => { if (codeOpen) { lines.push('```'); codeOpen = false; blank(); } };

  function paragraphText(p) {
    return inline(runParts(p, [])).replace(/\t/g, ' ');
  }

  function emitParagraph(p) {
    paragraphNo++;
    const ppr = kid(p, 'w:pPr');
    const styleId = ppr ? val(kid(ppr, 'w:pStyle')) : undefined;
    const parts = runParts(p, []);
    const plain = parts.map(x => x.text).join('');
    const chain = styleChain(styleId, styles);
    if (inToc || chain.some(n => TOC_STYLE.test(n))) {
      const line = plain.replace(/\s+/g, ' ').trim();
      if (line) toc.push(line);
      return;
    }
    closeToc();
    // A paragraph in a code style ("Code", "Source Code", "HTML Preformatted") is a line of a code block.
    if (CODE_STYLE.test(styleName(styleId))) {
      if (!codeOpen) { blank(); lines.push('```'); codeOpen = true; blocks.push({ paragraph: paragraphNo, style: styleName(styleId), kind: 'code', line: lines.length + 1 }); }
      lines.push(plain);
      return;
    }
    closeCode();
    const text = inline(parts).replace(/\t/g, ' ');
    if (!text.trim()) return;
    // The subtitle is a line under the title, not a heading.
    const level = chain[0] === 'subtitle' ? 0
      : chain.includes('title') ? 1
        : Math.min(6, headingLevel(styleId, styles) + (headingLevel(styleId, styles) ? shift : 0));
    const numPr = ppr && kid(ppr, 'w:numPr');
    if (level) {
      blank();
      blocks.push({ paragraph: paragraphNo, style: styleName(styleId), kind: 'heading', line: lines.length + 1 });
      lines.push('#'.repeat(level) + ' ' + text.replace(/\n/g, ' '));
      blank();
      return;
    }
    if (numPr || /list (bullet|number)/.test(styleName(styleId))) {
      const ilvl = numPr ? Number(val(kid(numPr, 'w:ilvl')) || 0) : 0;
      const numId = numPr ? val(kid(numPr, 'w:numId')) : styleName(styleId);
      const fmt = numPr ? (numbering[numId] || {})[ilvl] : /number/.test(styleName(styleId)) ? 'decimal' : 'bullet';
      const ordered = ORDERED.has(fmt);
      const key = numId + ':' + ilvl;
      counters[key] = (counters[key] || 0) + 1;
      for (const k of Object.keys(counters)) if (k.startsWith(numId + ':') && Number(k.split(':')[1]) > ilvl) delete counters[k];
      const marker = ordered ? counters[key] + '.' : '-';
      const prev = lines[lines.length - 1];
      if (prev !== undefined && prev !== '' && !/^\s*(?:-|\d+\.) /.test(prev)) blank();
      blocks.push({ paragraph: paragraphNo, style: styleName(styleId), kind: ordered ? 'step' : 'list', line: lines.length + 1 });
      lines.push('   '.repeat(ilvl) + marker + ' ' + text.replace(/\n/g, ' '));
      return;
    }
    blank();
    blocks.push({ paragraph: paragraphNo, style: styleName(styleId), kind: 'paragraph', line: lines.length + 1 });
    lines.push(...text.split('\n'));
    blank();
  }

  function emitTable(tbl) {
    closeToc();
    closeCode();
    blank();
    const rows = kids(tbl, 'w:tr');
    rows.forEach((tr, r) => {
      const cells = kids(tr, 'w:tc').map(tc => {
        const texts = [];
        for (const p of kids(tc, 'w:p')) {
          paragraphNo++;
          const t = paragraphText(p).replace(/\n/g, ' ').trim();
          if (t) texts.push(t);
        }
        return texts.join(' ').replace(/\|/g, '\\|');
      });
      if (r === 0) blocks.push({ paragraph: paragraphNo - cells.length + 1, style: 'table', kind: 'table', line: lines.length + 1 });
      lines.push('| ' + cells.join(' | ') + ' |');
      if (r === 0) lines.push('|' + cells.map(() => '---').join('|') + '|');
    });
    blank();
  }

  function walk(node) {
    for (const c of node.children || []) {
      if (c.name === 'w:p') emitParagraph(c);
      else if (c.name === 'w:tbl') emitTable(c);
      else if (c.name === 'w:sdt') {
        // A content control that Word marks as a table of contents.
        const gallery = kid(kid(kid(c, 'w:sdtPr') || {}, 'w:docPartObj') || {}, 'w:docPartGallery');
        const wasToc = inToc;
        if (gallery && /table of contents/i.test(val(gallery) || '')) inToc = true;
        walk(kid(c, 'w:sdtContent') || {});
        inToc = wasToc;
        if (!inToc) closeToc();
      }
    }
  }
  let inToc = false;
  walk(body);
  closeToc();
  closeCode();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return { markdown: lines.join('\n') + '\n', blocks };
}

/** The DOCX paragraph for a Markdown line: { paragraph, style } or null. */
export function paragraphAt(blocks, line) {
  let found = null;
  for (const b of blocks) {
    if (b.line <= line) found = b;
    else break;
  }
  return found;
}
