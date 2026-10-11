// Helpers for preparing photos in the browser before upload. Kept free of
// browser APIs so they can be unit tested.

export const DISPLAY_MAX_PX = 2400;
export const THUMB_MAX_PX = 600;

/** Scales width x height down (never up) so the long edge is at most maxPx. */
export function fitWithin(width: number, height: number, maxPx: number): { width: number; height: number } {
	const scale = Math.min(1, maxPx / Math.max(width, height));
	return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Converts EXIF "2026:01:10 19:32:00" plus an optional offset "+08:00" into
 * "2026-01-10T19:32:00+08:00". Without an offset the result has no zone: it is
 * the camera's local wall-clock time, which is what the post should show.
 * Returns null for missing or unreadable values (some phones write zeros).
 */
export function exifTakenAt(dateTimeOriginal: unknown, offsetTimeOriginal: unknown): string | null {
	if (typeof dateTimeOriginal !== 'string') return null;
	const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dateTimeOriginal.trim());
	if (!match || match[1] === '0000') return null;
	const [, y, mo, d, h, mi, s] = match;
	const offset = typeof offsetTimeOriginal === 'string' && /^[+-]\d{2}:\d{2}$/.test(offsetTimeOriginal.trim())
		? offsetTimeOriginal.trim()
		: '';
	return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
}

const TYPES_BY_EXTENSION: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	heic: 'image/heic',
	heif: 'image/heif',
	webp: 'image/webp',
};

/**
 * The upload type for an original file. Browsers sometimes leave File.type empty
 * for iPhone HEIC photos, so the extension is used as a fallback. Returns null
 * for anything that isn't a supported photo format.
 */
export function originalMimeType(fileName: string, fileType: string): string | null {
	const supported = new Set(Object.values(TYPES_BY_EXTENSION));
	if (supported.has(fileType)) return fileType;
	if (fileType && fileType !== 'application/octet-stream') return null;
	const extension = fileName.toLowerCase().split('.').pop() ?? '';
	return TYPES_BY_EXTENSION[extension] ?? null;
}

export function isHeic(mimeType: string): boolean {
	return mimeType === 'image/heic' || mimeType === 'image/heif';
}

/** Earliest and latest calendar dates (YYYY-MM-DD) among photo timestamps, or null if none have one. */
export function tripDateRange(takenAts: (string | null)[]): { start: string; end: string } | null {
	const dates = takenAts.filter((t): t is string => !!t).map((t) => t.slice(0, 10)).sort();
	return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}
