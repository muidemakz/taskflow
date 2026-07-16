import { marked } from 'marked';

// Anchor format: slugified heading text ("design-principles"), with a
// numeric suffix for repeats ("design-principles-2"). This exact string is
// shared verbatim by three things -- the table-of-contents links, the
// rendered <hN id="..."> in the doc body, and DocAnnotation.anchor -- so
// any of them can always resolve to the same DOM node.
function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

// Renders markdown to { html, headings } in one pass so the heading ids in
// the HTML and the table-of-contents entries can never drift apart.
export function renderMarkdown(source) {
  const headings = [];
  const seen = new Map();

  const renderer = new marked.Renderer();
  renderer.heading = (text, level, raw) => {
    const base = slugify(raw);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    headings.push({ id, level, text: raw });
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };

  const html = marked.parse(source || '', { renderer });
  return { html, headings };
}
