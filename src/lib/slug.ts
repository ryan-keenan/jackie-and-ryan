/** URL-safe slug: "Taiwan & Seoul, Jan '26" -> "taiwan-seoul-jan-26". */
export function slugify(text: string): string {
	const slug = text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '') // strip accents left by NFKD
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
	return slug || 'post';
}

/** The first of base, base-2, base-3, ... that isn't taken. */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
	for (let n = 1; n < 1000; n++) {
		const candidate = n === 1 ? base : `${base}-${n}`;
		if (!(await isTaken(candidate))) return candidate;
	}
	throw new Error(`No free slug for "${base}"`);
}
