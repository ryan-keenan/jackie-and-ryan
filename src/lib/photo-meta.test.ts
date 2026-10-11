import { describe, expect, it } from 'vitest';
import { exifTakenAt, fitWithin, originalMimeType, tripDateRange } from './photo-meta';

describe('fitWithin', () => {
	it('scales the long edge down to the limit, keeping the aspect ratio', () => {
		expect(fitWithin(4032, 3024, 2400)).toEqual({ width: 2400, height: 1800 });
		expect(fitWithin(3024, 4032, 600)).toEqual({ width: 450, height: 600 });
	});

	it('never scales small images up', () => {
		expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600 });
	});
});

describe('exifTakenAt', () => {
	it('converts EXIF dates, keeping the offset when present', () => {
		expect(exifTakenAt('2026:01:10 19:32:00', '+08:00')).toBe('2026-01-10T19:32:00+08:00');
		expect(exifTakenAt('2026:01:10 19:32:00', undefined)).toBe('2026-01-10T19:32:00');
	});

	it('ignores missing, zeroed and malformed values', () => {
		expect(exifTakenAt(undefined, undefined)).toBeNull();
		expect(exifTakenAt('0000:00:00 00:00:00', undefined)).toBeNull();
		expect(exifTakenAt('yesterday', undefined)).toBeNull();
		expect(exifTakenAt('2026:01:10 19:32:00', 'PST')).toBe('2026-01-10T19:32:00');
	});
});

describe('originalMimeType', () => {
	it('trusts known browser types', () => {
		expect(originalMimeType('a.jpg', 'image/jpeg')).toBe('image/jpeg');
		expect(originalMimeType('IMG_1.HEIC', 'image/heic')).toBe('image/heic');
	});

	it('falls back to the extension when the browser gives no type', () => {
		expect(originalMimeType('IMG_1.HEIC', '')).toBe('image/heic');
		expect(originalMimeType('IMG_1.heif', 'application/octet-stream')).toBe('image/heif');
	});

	it('rejects non-photo files', () => {
		expect(originalMimeType('clip.mov', 'video/quicktime')).toBeNull();
		expect(originalMimeType('notes.txt', '')).toBeNull();
		expect(originalMimeType('a.gif', 'image/gif')).toBeNull();
	});
});

describe('tripDateRange', () => {
	it('returns the first and last dates', () => {
		expect(
			tripDateRange(['2026-01-12T10:00:00', null, '2026-01-10T19:32:00+08:00', '2026-01-18T08:00:00']),
		).toEqual({ start: '2026-01-10', end: '2026-01-18' });
	});

	it('returns null when no photo has a date', () => {
		expect(tripDateRange([null, null])).toBeNull();
	});
});
