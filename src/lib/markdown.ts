import MarkdownIt from 'markdown-it';

// Post paragraphs come from AI drafts and the editor. html: false means any raw
// HTML in them is shown as text, never injected into the page.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// External links open in a new tab and don't pass the journal's URL along.
const defaultLinkOpen =
	md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	const href = String(tokens[idx].attrGet('href') ?? '');
	if (/^https?:\/\//.test(href)) {
		tokens[idx].attrSet('target', '_blank');
		tokens[idx].attrSet('rel', 'noopener noreferrer');
	}
	return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(markdown: string): string {
	return md.render(markdown);
}
