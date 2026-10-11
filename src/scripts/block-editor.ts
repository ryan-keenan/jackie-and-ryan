import type { Block } from '../lib/blocks';

// Editor for a post body: a list of blocks that can be edited, reordered,
// removed and added. It renders into `root` and reports every change through
// onChange; saving is up to the page.

export interface EditorPhoto {
	id: string;
	/** "Photo 3 · Jan 10, 7:32 PM" */
	label: string;
	thumbUrl: string;
}

export interface EditorVideo {
	id: string;
	/** "Video 1 · IMG_0042.MOV" */
	label: string;
	/** A still frame, once Stream has processed the video. */
	thumbUrl: string | null;
}

type BlockType = Block['type'];

const TYPE_NAMES: Record<BlockType, string> = {
	heading: 'Heading',
	paragraph: 'Paragraph',
	photo: 'Photo',
	gallery: 'Gallery',
	video: 'Video',
	quote: 'Quote',
};

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
	...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	Object.assign(element, props);
	for (const child of children) element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
	return element;
}

export class BlockEditor {
	private blocks: Block[];
	private readonly photosById: Map<string, EditorPhoto>;
	private readonly videosById: Map<string, EditorVideo>;

	constructor(
		private readonly root: HTMLElement,
		initial: Block[],
		private readonly photos: EditorPhoto[],
		private readonly videos: EditorVideo[],
		private readonly onChange: () => void,
	) {
		this.blocks = structuredClone(initial);
		this.photosById = new Map(photos.map((photo) => [photo.id, photo]));
		this.videosById = new Map(videos.map((video) => [video.id, video]));
		this.render();
	}

	/** Makes a newly uploaded photo available in the photo pickers. */
	addPhoto(photo: EditorPhoto) {
		this.photos.push(photo);
		this.photosById.set(photo.id, photo);
		this.render();
	}

	/** Adds a newly uploaded video, or updates one (e.g. its still frame once processed). */
	setVideo(video: EditorVideo) {
		const index = this.videos.findIndex((v) => v.id === video.id);
		if (index >= 0) this.videos[index] = video;
		else this.videos.push(video);
		this.videosById.set(video.id, video);
		this.render();
	}

	getBlocks(): Block[] {
		return structuredClone(this.blocks);
	}

	private changed() {
		this.onChange();
		this.render();
	}

	private photoSelect(selected: string | null, onPick: (id: string) => void): HTMLSelectElement {
		const select = el('select', { className: 'photo-picker' });
		if (!selected) select.appendChild(el('option', { value: '', textContent: 'Choose a photo…', selected: true }));
		for (const photo of this.photos) {
			select.appendChild(el('option', { value: photo.id, textContent: photo.label, selected: photo.id === selected }));
		}
		select.addEventListener('change', () => select.value && onPick(select.value));
		return select;
	}

	private videoSelect(selected: string, onPick: (id: string) => void): HTMLSelectElement {
		const select = el('select', { className: 'photo-picker' });
		for (const video of this.videos) {
			select.appendChild(el('option', { value: video.id, textContent: video.label, selected: video.id === selected }));
		}
		select.addEventListener('change', () => select.value && onPick(select.value));
		return select;
	}

	private videoThumb(videoId: string): HTMLElement {
		const video = this.videosById.get(videoId);
		return video?.thumbUrl
			? el('img', { className: 'block-thumb', src: video.thumbUrl, alt: video.label })
			: el('div', { className: 'block-thumb video-processing', textContent: 'Processing…' });
	}

	private thumb(photoId: string): HTMLImageElement {
		const photo = this.photosById.get(photoId);
		return el('img', { className: 'block-thumb', src: photo?.thumbUrl ?? '', alt: photo?.label ?? 'Missing photo' });
	}

	private editorFor(block: Block, index: number): HTMLElement {
		const update = (next: Block) => {
			this.blocks[index] = next;
			this.onChange();
		};
		switch (block.type) {
			case 'heading': {
				const input = el('input', { type: 'text', value: block.text, className: 'block-heading' });
				input.addEventListener('input', () => update({ type: 'heading', text: input.value }));
				return input;
			}
			case 'paragraph': {
				const area = el('textarea', { value: block.markdown, rows: Math.max(3, Math.ceil(block.markdown.length / 90)) });
				area.addEventListener('input', () => update({ type: 'paragraph', markdown: area.value }));
				return area;
			}
			case 'quote': {
				const text = el('textarea', { value: block.text, rows: 2 });
				const by = el('input', { type: 'text', value: block.attribution ?? '', placeholder: 'Who said it (optional)' });
				const save = () =>
					update(by.value.trim() ? { type: 'quote', text: text.value, attribution: by.value } : { type: 'quote', text: text.value });
				text.addEventListener('input', save);
				by.addEventListener('input', save);
				return el('div', { className: 'stack' }, text, by);
			}
			case 'photo':
				return el(
					'div',
					{ className: 'photo-row' },
					this.thumb(block.photoId),
					this.photoSelect(block.photoId, (id) => {
						this.blocks[index] = { type: 'photo', photoId: id };
						this.changed();
					}),
				);
			case 'video':
				return el(
					'div',
					{ className: 'photo-row' },
					this.videoThumb(block.videoId),
					this.videoSelect(block.videoId, (id) => {
						this.blocks[index] = { type: 'video', videoId: id };
						this.changed();
					}),
				);
			case 'gallery': {
				const items = block.photoIds.map((id, position) => {
					const remove = el('button', { type: 'button', className: 'link', textContent: 'Remove' });
					remove.addEventListener('click', () => {
						const photoIds = block.photoIds.filter((_, i) => i !== position);
						this.blocks[index] = { type: 'gallery', photoIds };
						this.changed();
					});
					return el('div', { className: 'gallery-item' }, this.thumb(id), remove);
				});
				const add = this.photoSelect(null, (id) => {
					this.blocks[index] = { type: 'gallery', photoIds: [...block.photoIds, id] };
					this.changed();
				});
				const hint =
					block.photoIds.length < 2 || block.photoIds.length > 6
						? el('p', { className: 'status-error hint', textContent: 'A gallery needs 2 to 6 photos.' })
						: el('span');
				return el('div', { className: 'stack' }, el('div', { className: 'gallery-row' }, ...items), add, hint);
			}
		}
	}

	private move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= this.blocks.length) return;
		[this.blocks[index], this.blocks[target]] = [this.blocks[target], this.blocks[index]];
		this.changed();
	}

	private add(type: BlockType) {
		const first = this.photos[0]?.id;
		const blank: Record<BlockType, Block | null> = {
			heading: { type: 'heading', text: 'New section' },
			paragraph: { type: 'paragraph', markdown: 'Write something…' },
			quote: { type: 'quote', text: 'Something someone said' },
			photo: first ? { type: 'photo', photoId: first } : null,
			gallery: this.photos.length >= 2 ? { type: 'gallery', photoIds: [this.photos[0].id, this.photos[1].id] } : null,
			video: this.videos[0] ? { type: 'video', videoId: this.videos[0].id } : null,
		};
		const block = blank[type];
		if (!block) return;
		this.blocks.push(block);
		this.changed();
	}

	private render() {
		this.root.replaceChildren();
		this.blocks.forEach((block, index) => {
			const up = el('button', { type: 'button', className: 'icon', textContent: '↑', title: 'Move up', disabled: index === 0 });
			const down = el('button', {
				type: 'button',
				className: 'icon',
				textContent: '↓',
				title: 'Move down',
				disabled: index === this.blocks.length - 1,
			});
			const remove = el('button', { type: 'button', className: 'icon', textContent: '✕', title: 'Remove block' });
			up.addEventListener('click', () => this.move(index, -1));
			down.addEventListener('click', () => this.move(index, 1));
			remove.addEventListener('click', () => {
				this.blocks.splice(index, 1);
				this.changed();
			});
			this.root.appendChild(
				el(
					'div',
					{ className: `block block-${block.type}` },
					el('div', { className: 'block-bar' }, el('span', { className: 'block-type', textContent: TYPE_NAMES[block.type] }), up, down, remove),
					this.editorFor(block, index),
				),
			);
		});

		const addBar = el('div', { className: 'add-bar' }, el('span', { textContent: 'Add:' }));
		for (const type of Object.keys(TYPE_NAMES) as BlockType[]) {
			const disabled =
				(type === 'photo' && this.photos.length < 1) ||
				(type === 'gallery' && this.photos.length < 2) ||
				(type === 'video' && this.videos.length < 1);
			const button = el('button', { type: 'button', className: 'button secondary small', textContent: TYPE_NAMES[type], disabled });
			button.addEventListener('click', () => this.add(type));
			addBar.appendChild(button);
		}
		this.root.appendChild(addBar);
	}
}
