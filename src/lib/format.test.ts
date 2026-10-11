import { describe, expect, it } from 'vitest';
import { formatDuration, formatTakenAt, formatTripDates } from './format';

describe('formatTripDates', () => {
	it('formats single days and missing dates', () => {
		expect(formatTripDates(null, null)).toBe('');
		expect(formatTripDates('2026-03-03', null)).toBe('March 3, 2026');
		expect(formatTripDates('2026-03-03', '2026-03-03')).toBe('March 3, 2026');
	});

	it('shortens ranges within a month or year', () => {
		expect(formatTripDates('2026-03-03', '2026-03-12')).toBe('March 3–12, 2026');
		expect(formatTripDates('2026-03-28', '2026-04-02')).toBe('March 28 – April 2, 2026');
		expect(formatTripDates('2025-12-28', '2026-01-03')).toBe('December 28, 2025 – January 3, 2026');
	});

	it('does not shift dates across time zones', () => {
		expect(formatTripDates('2026-01-01', null)).toBe('January 1, 2026');
	});

	it('throws on malformed dates instead of rendering "Invalid Date"', () => {
		expect(() => formatTripDates('March 3', null)).toThrow(/Invalid date/);
	});
});

describe('formatTakenAt', () => {
	it("shows the camera's local time regardless of offset", () => {
		expect(formatTakenAt('2026-01-10T19:32:00+08:00')).toBe('Jan 10, 2026, 7:32 PM');
		expect(formatTakenAt('2026-01-10T19:32:00')).toBe('Jan 10, 2026, 7:32 PM');
	});

	it('says when a photo has no date', () => {
		expect(formatTakenAt(null)).toBe('No date in photo');
	});
});

describe('formatDuration', () => {
	it('formats video lengths', () => {
		expect(formatDuration(42.4)).toBe('0:42');
		expect(formatDuration(725)).toBe('12:05');
		expect(formatDuration(3723)).toBe('1:02:03');
		expect(formatDuration(null)).toBe('');
		expect(formatDuration(-1)).toBe('');
	});
});
