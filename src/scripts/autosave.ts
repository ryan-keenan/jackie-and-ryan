// Saves parts of the admin post page shortly after each change, so nothing typed
// is lost and the page needs no Save buttons. Each saver runs one save at a time;
// a change made while a save is running is saved right after it. A failed save
// shows its error and is retried on the next change (or flush), and leaving the
// page with anything unsaved asks first.
//
// Every saver on the page is registered here, so actions that read saved data
// (generating a draft, research, finding the place, publishing) can flush them
// all first with flushAll().

export interface Autosaver {
	/** Saves after `delayMs` without further changes. */
	schedule(delayMs?: number): void;
	/** Saves now if anything is waiting; resolves to false if the save failed. */
	flush(): Promise<boolean>;
	/** True while a change is unsaved or a save is running. */
	pending(): boolean;
}

const savers = new Set<Autosaver>();

export interface AutosaveOptions {
	/** Pause after typing before saving. */
	delayMs?: number;
	/**
	 * Whether this saves something readers see. After each such save the page gets
	 * a "post-edited" event on the document, to show a published post's unpublished edits.
	 */
	affectsPost: boolean;
}

/** A saver for one part of the page. `status`, if given, shows "Saving…", "Saved" or the error. */
export function autosave(save: () => Promise<void>, status: HTMLElement | null, { delayMs = 800, affectsPost }: AutosaveOptions): Autosaver {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;
	let failed = false;
	let running: Promise<void> | null = null;

	function show(text: string, ok: boolean) {
		if (!status) return;
		status.textContent = text;
		status.classList.toggle('status-error', !ok);
	}

	async function run(): Promise<boolean> {
		while (running) await running;
		if (!dirty) return !failed;
		dirty = false;
		show('Saving…', true);
		running = save()
			.then(
				() => {
					failed = false;
					show('Saved', true);
					if (affectsPost) document.dispatchEvent(new CustomEvent('post-edited'));
				},
				(error: unknown) => {
					failed = true;
					dirty = true;
					show(`Not saved: ${(error as Error).message}`, false);
				},
			)
			.finally(() => {
				running = null;
			});
		await running;
		// Changes made during the save go out right away, unless the save failed.
		if (dirty && !failed) return run();
		return !failed;
	}

	const saver: Autosaver = {
		schedule(ms = delayMs) {
			dirty = true;
			clearTimeout(timer);
			timer = setTimeout(() => void run(), ms);
		},
		flush() {
			clearTimeout(timer);
			return run();
		},
		pending: () => dirty || running !== null,
	};
	savers.add(saver);
	return saver;
}

/** Saves everything waiting on the page; resolves to false if any save failed. */
export async function flushAll(): Promise<boolean> {
	const results = await Promise.all([...savers].map((saver) => saver.flush()));
	return results.every(Boolean);
}

window.addEventListener('beforeunload', (event) => {
	if ([...savers].some((saver) => saver.pending())) event.preventDefault();
});
