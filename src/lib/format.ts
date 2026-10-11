// Trip dates are stored as YYYY-MM-DD. They are formatted in UTC so a date never
// shifts by a day depending on where the page is rendered.

const monthDayYear = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });

function parseDate(value: string): Date {
	const date = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
	return date;
}

/** "March 3, 2026", "March 3–12, 2026", "March 28 – April 2, 2026" or "December 28, 2025 – January 3, 2026". */
export function formatTripDates(start: string | null, end: string | null): string {
	if (!start) return '';
	const s = parseDate(start);
	if (!end || end === start) return monthDayYear.format(s);
	const e = parseDate(end);
	if (s.getUTCFullYear() !== e.getUTCFullYear()) {
		return `${monthDayYear.format(s)} – ${monthDayYear.format(e)}`;
	}
	if (s.getUTCMonth() !== e.getUTCMonth()) {
		return `${monthDay.format(s)} – ${monthDayYear.format(e)}`;
	}
	return `${monthDay.format(s)}–${day.format(e)}, ${e.getUTCFullYear()}`;
}

/** Public URL for a stored display or thumbnail image. */
export function mediaUrl(r2Key: string): string {
	return `/media/${r2Key}`;
}
