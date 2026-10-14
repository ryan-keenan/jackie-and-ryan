// The site-wide header as an HTML string, so both the Astro journal pages and
// the hand-written wedding page (src/wedding/page.html) render the same markup.
// Styles are in src/styles/site-header.css. The Admin button only appears for
// signed-in admins (locals.isAdmin, set by src/middleware.ts).

export function siteHeaderHtml(isAdmin: boolean): string {
	const admin = isAdmin ? '<a class="admin-link" href="/admin">Admin</a>' : '';
	return `<header class="site-header"><a class="site-title" href="/">Jackie &amp; Ryan</a><nav><a href="/">Journal</a>${admin}</nav></header>`;
}
