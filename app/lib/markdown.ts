import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
markdown.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
  tokens[index]!.attrSet('target', '_blank');
  tokens[index]!.attrSet('rel', 'noopener noreferrer');
  return renderer.renderToken(tokens, index, options);
};

export function renderMarkdown(text: string, changedLines?: Set<number>) {
  if (!changedLines?.size) return markdown.render(text);
  const env = {};
  const tokens = markdown.parse(text, env);
  for (const token of tokens) {
    if (!token.map || token.hidden || !['p', 'li', 'tr', 'pre', 'code', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(token.tag)) continue;
    // Nested list items have their own markers.
    const [start, end] = token.map;
    for (let line = start; line < (token.tag === 'li' ? start + 1 : end); line++) {
      if (changedLines.has(line + 1)) {
        token.attrJoin('class', 'markdown-change');
        break;
      }
    }
  }
  return markdown.renderer.render(tokens, markdown.options, env);
}
