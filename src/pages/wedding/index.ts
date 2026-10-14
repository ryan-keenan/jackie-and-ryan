import type { APIRoute } from 'astro';
import { siteHeaderHtml } from '../../lib/site-header';
import siteHeaderCss from '../../styles/site-header.css?raw';
import tokensCss from '../../styles/tokens.css?raw';
import page from '../../wedding/page.html?raw';

// The wedding page is hand-written HTML (src/wedding/page.html) that Astro's
// template parser does not accept, so it is served as a string with the site
// header inserted at its <!-- site-header --> marker. Its scripts, styles and
// images stay in public/wedding/ and are loaded by relative paths.

const HEADER_MARKER = '<!-- site-header -->';
if (!page.includes(HEADER_MARKER) || !page.includes('</head>')) {
	throw new Error(`src/wedding/page.html must contain ${HEADER_MARKER} and </head>`);
}

export const GET: APIRoute = ({ url, locals, redirect }) => {
	// Relative paths (styles.css, images/...) only resolve under /wedding/ with the trailing slash.
	if (!url.pathname.endsWith('/')) return redirect('/wedding/', 301);

	const html = page
		// Function replacers, so a "$" in the inserted text is never read as a replacement pattern.
		.replace('</head>', () => `<style>${tokensCss}\n${siteHeaderCss}</style>\n</head>`)
		.replace(HEADER_MARKER, () => siteHeaderHtml(locals.isAdmin));
	return new Response(html, {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			// Browsers re-check every visit, like the other public pages.
			'cache-control': 'no-cache',
		},
	});
};
