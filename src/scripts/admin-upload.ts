import exifr from 'exifr';
import {
	DISPLAY_MAX_PX,
	THUMB_MAX_PX,
	exifTakenAt,
	fitWithin,
	isHeic,
	originalMimeType,
} from '../lib/photo-meta';

// Prepares photos in the browser and uploads them for one post:
//   1. read the date taken and GPS position from the photo's EXIF data
//   2. decode it (iPhone HEIC photos go through heic2any where the browser can't)
//   3. draw it to a canvas at display and thumbnail sizes and encode JPEGs;
//      re-encoding drops all embedded metadata, including GPS
//   4. upload the original, both JPEGs and the metadata in one request

export interface UploadedPhoto {
	id: string;
	r2_key_thumb: string;
	taken_at: string | null;
	note: string;
}

export interface PreparedPhoto {
	original: File;
	display: Blob;
	thumb: Blob;
	meta: {
		width: number;
		height: number;
		taken_at: string | null;
		lat: number | null;
		lon: number | null;
		note: string;
	};
}

const JPEG_QUALITY = 0.82;

async function readExif(file: File): Promise<{ taken_at: string | null; lat: number | null; lon: number | null }> {
	// Photos without EXIF (screenshots, edited exports) are normal; they just have no date or place.
	const [tags, gps] = await Promise.all([
		exifr
			.parse(file, { pick: ['DateTimeOriginal', 'OffsetTimeOriginal'], reviveValues: false })
			.catch(() => undefined),
		exifr.gps(file).catch(() => undefined),
	]);
	const lat = typeof gps?.latitude === 'number' && Number.isFinite(gps.latitude) ? gps.latitude : null;
	const lon = typeof gps?.longitude === 'number' && Number.isFinite(gps.longitude) ? gps.longitude : null;
	return { taken_at: exifTakenAt(tags?.DateTimeOriginal, tags?.OffsetTimeOriginal), lat, lon };
}

async function decode(file: File, mimeType: string): Promise<ImageBitmap> {
	try {
		return await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch (error) {
		if (!isHeic(mimeType)) throw new Error(`This browser could not read the image (${(error as Error).message})`);
	}
	// Most browsers other than Safari can't decode HEIC; convert it to JPEG first.
	// heic2any is large, so it is only loaded when needed.
	const { default: heic2any } = await import('heic2any');
	const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
	return createImageBitmap(Array.isArray(converted) ? converted[0] : converted);
}

function drawScaled(source: CanvasImageSource, width: number, height: number, maxPx: number): HTMLCanvasElement {
	const size = fitWithin(width, height, maxPx);
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is not available in this browser');
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	context.drawImage(source, 0, 0, size.width, size.height);
	return canvas;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the resized photo'))),
			'image/jpeg',
			JPEG_QUALITY,
		),
	);
}

export async function preparePhoto(file: File, note = ''): Promise<PreparedPhoto> {
	const mimeType = originalMimeType(file.name, file.type);
	if (!mimeType) throw new Error('Not a supported photo format (JPEG, PNG, HEIC or WebP)');
	const original = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });

	const [exif, bitmap] = await Promise.all([readExif(file), decode(file, mimeType)]);
	try {
		const displayCanvas = drawScaled(bitmap, bitmap.width, bitmap.height, DISPLAY_MAX_PX);
		// The thumbnail is scaled from the display size, which looks better than one big jump.
		const thumbCanvas = drawScaled(displayCanvas, displayCanvas.width, displayCanvas.height, THUMB_MAX_PX);
		const [display, thumb] = await Promise.all([toJpeg(displayCanvas), toJpeg(thumbCanvas)]);
		return {
			original,
			display,
			thumb,
			meta: { width: displayCanvas.width, height: displayCanvas.height, ...exif, note },
		};
	} finally {
		bitmap.close();
	}
}

/** Uploads a prepared photo, reporting progress from 0 to 1. Rejects with the server's error message. */
export function uploadPhoto(
	postId: string,
	photo: PreparedPhoto,
	onProgress: (fraction: number) => void,
): Promise<UploadedPhoto> {
	const form = new FormData();
	form.append('original', photo.original);
	form.append('display', photo.display, 'display.jpg');
	form.append('thumb', photo.thumb, 'thumb.jpg');
	form.append('meta', JSON.stringify(photo.meta));

	// XMLHttpRequest rather than fetch: fetch can't report upload progress.
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('POST', `/api/admin/posts/${postId}/photos`);
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total);
		};
		request.onload = () => {
			let body: { error?: string } & Partial<UploadedPhoto> = {};
			try {
				body = JSON.parse(request.responseText);
			} catch {
				// Non-JSON response, e.g. a 500 page; reported below by status code.
			}
			if (request.status === 201) resolve(body as UploadedPhoto);
			else reject(new Error(body.error ?? `Upload failed (HTTP ${request.status})`));
		};
		request.onerror = () => reject(new Error('Upload failed: network error'));
		request.send(form);
	});
}

/** Runs tasks with at most `limit` in flight at once. */
export async function runWithLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
	const queue = [...items];
	const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
		while (queue.length) await task(queue.shift()!);
	});
	await Promise.all(workers);
}
