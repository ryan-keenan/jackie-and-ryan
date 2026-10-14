import { describe, expect, it } from 'vitest';
import { siteHeaderHtml } from './site-header';

describe('siteHeaderHtml', () => {
	it('shows the Admin button only to admins', () => {
		expect(siteHeaderHtml(true)).toContain('href="/admin"');
		expect(siteHeaderHtml(false)).not.toContain('/admin');
		expect(siteHeaderHtml(false)).toContain('href="/">Journal</a>');
	});
});
