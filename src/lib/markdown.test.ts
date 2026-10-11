import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('escapes raw HTML instead of rendering it', () => {
		const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;script&gt;');
	});

	it('opens external links in a new tab without leaking the referrer', () => {
		expect(renderMarkdown('[site](https://example.com)')).toContain(
			'<a href="https://example.com" target="_blank" rel="noopener noreferrer">',
		);
	});

	it('leaves internal links in the same tab', () => {
		expect(renderMarkdown('[home](/)')).toContain('<a href="/">');
	});

	it('does not turn javascript: URLs into links', () => {
		expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript:');
	});
});
