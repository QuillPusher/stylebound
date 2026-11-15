// Test-only: writes a small, valid .docx from the simple Markdown of the trial
// documents (headings, paragraphs, bullet and numbered lists, tables, code
// blocks, inline code, bold). The product only reads DOCX; this builds fixtures.
import { writeZip } from '../../packages/core/src/zip.mjs';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function runs(text) {
  // Links keep their text only; then split into bold and code pieces.
  text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  const out = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|([^*`]+|\*|`)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      for (const r of runs(m[1])) out.push({ ...r, bold: true });
    } else if (m[2] !== undefined) out.push({ text: m[2], code: true });
    else out.push({ text: m[3] });
  }
  return out;
}

function runXml(r) {
  const props = [r.code ? '<w:rStyle w:val="CodeChar"/><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '', r.bold ? '<w:b/>' : ''].join('');
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

const para = (text, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${runs(text).map(runXml).join('')}</w:p>`;

export function markdownToDocx(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const body = [];
  const nums = []; // numbering instances: 'bullet' or 'decimal'
  let i = 0;
  let listNum = null, listKind = null;
  const endList = () => { listNum = null; listKind = null; };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      endList();
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(`<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:t xml:space="preserve">${esc(lines[i])}</w:t></w:r></w:p>`);
        i++;
      }
      i++;
      continue;
    }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      endList();
      body.push(para(m[2], `<w:pStyle w:val="Heading${m[1].length}"/>`));
      i++;
      continue;
    }
    if (/^\|/.test(line)) {
      endList();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!/^\|[\s:|-]+\|?\s*$/.test(lines[i])) {
          const cells = lines[i].trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
          rows.push(`<w:tr>${cells.map(c => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>${para(c)}</w:tc>`).join('')}</w:tr>`);
        }
        i++;
      }
      body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr>${rows.join('')}</w:tbl>`);
      continue;
    }
    if ((m = /^(\s*)(?:(\d+)\.|-)\s+(.*)$/.exec(line))) {
      const kind = m[2] ? 'decimal' : 'bullet';
      if (listKind !== kind || listNum === null) { nums.push(kind); listNum = nums.length; listKind = kind; }
      const level = Math.floor(m[1].length / 2);
      body.push(para(m[3], `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${listNum}"/></w:numPr>`));
      i++;
      continue;
    }
    if (!line.trim()) { i++; if (i < lines.length && !/^(\s*)(?:\d+\.|-)\s+/.test(lines[i])) endList(); continue; }
    endList();
    const text = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|\||```|\s*(?:\d+\.|-)\s)/.test(lines[i])) text.push(lines[i++]);
    body.push(para(text.join(' ')));
  }

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body.join('')}<w:sectPr/></w:body></w:document>`;
  const headings = [1, 2, 3, 4, 5, 6].map(n => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>`).join('');
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${W}><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${headings}<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style><w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const abstract = kind => `<w:abstractNum w:abstractNumId="${kind === 'bullet' ? 0 : 1}">${[0, 1, 2].map(l => `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${kind}"/><w:lvlText w:val="${kind === 'bullet' ? '•' : `%${l + 1}.`}"/></w:lvl>`).join('')}</w:abstractNum>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering ${W}>${abstract('bullet')}${abstract('decimal')}${nums.map((k, n) => `<w:num w:numId="${n + 1}"><w:abstractNumId w:val="${k === 'bullet' ? 0 : 1}"/></w:num>`).join('')}</w:numbering>`;
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>';
  return writeZip([
    ['[Content_Types].xml', types],
    ['_rels/.rels', rels],
    ['word/document.xml', document],
    ['word/styles.xml', styles],
    ['word/numbering.xml', numbering],
    ['word/_rels/document.xml.rels', docRels]
  ]);
}

// Test-only: a .docx from [{ style, text }] paragraphs, with Word's built-in
// Title, Subtitle, TOC, heading and caption styles. A { toc: [...] } item is a
// table-of-contents content control, as Word inserts it.
export function styledDocx(items) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const p = (style, text) => para(text, style ? `<w:pStyle w:val="${style}"/>` : '');
  const body = items.map(it => (it.toc
    ? `<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr><w:sdtContent>${it.toc.map(t => p(t.style, t.text)).join('')}</w:sdtContent></w:sdt>`
    : p(it.style, it.text))).join('');
  const style = (id, name, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${extra}</w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${W}>${[
    style('Normal', 'Normal'),
    style('Title', 'Title', '<w:basedOn w:val="Normal"/>'),
    style('Subtitle', 'Subtitle', '<w:basedOn w:val="Title"/>'),
    style('Heading1', 'heading 1', '<w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr>'),
    style('Heading2', 'heading 2', '<w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr>'),
    style('TOCHeading', 'TOC Heading', '<w:basedOn w:val="Heading1"/>'),
    style('TOC1', 'toc 1', '<w:basedOn w:val="Normal"/>'),
    style('TOC2', 'toc 2', '<w:basedOn w:val="Normal"/>'),
    style('Caption', 'Image Caption', '<w:basedOn w:val="Normal"/>')
  ].join('')}</w:styles>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  return writeZip([['[Content_Types].xml', types], ['_rels/.rels', rels], ['word/document.xml', document], ['word/styles.xml', styles], ['word/_rels/document.xml.rels', docRels]]);
}
