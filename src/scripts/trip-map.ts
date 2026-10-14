// Draws a post's map with MapLibre in one of the free styles listed in
// src/lib/map.ts. Loaded only when a map scrolls near view.
//
// Tile sources, all free for a non-commercial site and needing no key:
// - OpenFreeMap vector styles (Positron, Liberty, Fiord) for the drawn maps.
// - EOX Sentinel-2 cloudless for satellite imagery (CC BY-NC-SA, 10 m per pixel).
// - AWS Terrain Tiles (Mapzen terrarium encoding) for relief shading, 3D
//   terrain and contour lines. maplibre-contour turns the elevation tiles into
//   contour lines in the browser.

import { addProtocol, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ZOOM, type MapMode, type MapStyle, type MapView } from '../lib/map';

// MapLibre looks for its worker next to its own file, which the bundler moves;
// give it a worker that Vite builds as a standalone file.
setWorkerUrl(workerUrl);

const OPENFREEMAP = 'https://tiles.openfreemap.org/styles/';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SENTINEL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg';
const SENTINEL_ATTRIBUTION =
	'<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2023)';
const TERRAIN_ATTRIBUTION = 'Elevation: Mapzen Terrain Tiles on AWS';
const PIN = '#b8935f';

/** Farthest a 'fit' map zooms in: about 20 km across, so one pin still shows its surroundings. */
const FIT_MAX_ZOOM = 11;
/** How far the 3D style tilts the camera, in degrees from straight down. */
const TERRAIN_PITCH = 60;
const GLOBE_ZOOM = 1.6;

const dem = new mlcontour.DemSource({ url: TERRARIUM, encoding: 'terrarium', maxzoom: 13, worker: true });
dem.setupMaplibre({ addProtocol } as unknown as Parameters<typeof dem.setupMaplibre>[0]);

/** Contour lines labeled in feet, closer together as the map zooms in. */
const CONTOUR_TILES = dem.contourProtocolUrl({
	multiplier: 3.28084,
	thresholds: { 8: [1000, 5000], 10: [500, 2000], 11: [200, 1000], 13: [100, 500], 14: [50, 250], 15: [20, 100] },
	elevationKey: 'ele',
	levelKey: 'level',
	contourLayer: 'contours',
});

function demSource() {
	return { type: 'raster-dem' as const, tiles: [TERRARIUM], encoding: 'terrarium' as const, tileSize: 256, maxzoom: 15, attribution: TERRAIN_ATTRIBUTION };
}

function contourLayers(line: string, label: string, halo: string): LayerSpecification[] {
	return [
		{
			id: 'contour-lines',
			type: 'line',
			source: 'contours',
			'source-layer': 'contours',
			paint: {
				'line-color': line,
				'line-width': ['match', ['get', 'level'], 1, 1.1, 0.5],
				'line-opacity': ['match', ['get', 'level'], 1, 0.9, 0.6],
			},
		},
		{
			id: 'contour-labels',
			type: 'symbol',
			source: 'contours',
			'source-layer': 'contours',
			filter: ['>', ['get', 'level'], 0],
			layout: {
				'symbol-placement': 'line',
				'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' ft'],
				'text-font': ['Noto Sans Regular'],
				'text-size': 10,
			},
			paint: { 'text-color': label, 'text-halo-color': halo, 'text-halo-width': 1.2 },
		},
	];
}

function satellite(options: { contours?: boolean; terrain?: boolean; globe?: boolean } = {}): StyleSpecification {
	const style: StyleSpecification = {
		version: 8,
		glyphs: GLYPHS,
		sources: {
			imagery: { type: 'raster', tiles: [SENTINEL], tileSize: 256, maxzoom: 15, attribution: SENTINEL_ATTRIBUTION },
			dem: demSource(),
		},
		layers: [
			{ id: 'imagery', type: 'raster', source: 'imagery' },
			{
				id: 'hillshade',
				type: 'hillshade',
				source: 'dem',
				paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#fff' },
			},
		],
	};
	if (options.contours) {
		style.sources.contours = { type: 'vector', tiles: [CONTOUR_TILES], maxzoom: 15 };
		style.layers.push(...contourLayers('rgba(255,244,214,0.85)', '#fff4d6', 'rgba(0,0,0,0.55)'));
	}
	if (options.terrain) {
		// A separate source from the hillshade one, as MapLibre recommends.
		style.sources.terrain = demSource();
		style.terrain = { source: 'terrain', exaggeration: 1.3 };
		style.sky = {
			'sky-color': '#9cc3e6',
			'horizon-color': '#e9eef2',
			'fog-color': '#e9eef2',
			'sky-horizon-blend': 0.6,
			'horizon-fog-blend': 0.6,
			'fog-ground-blend': 0.4,
		};
	}
	if (options.globe) style.projection = { type: 'globe' };
	return style;
}

async function openFreeMap(name: string, edit?: (style: StyleSpecification) => void): Promise<StyleSpecification> {
	const response = await fetch(OPENFREEMAP + name);
	if (!response.ok) throw new Error(`Map style "${name}" failed to load (HTTP ${response.status})`);
	const style = (await response.json()) as StyleSpecification;
	edit?.(style);
	return style;
}

function layer(style: StyleSpecification, id: string) {
	const found = style.layers.find((l) => l.id === id);
	if (!found) throw new Error(`Map style has no "${id}" layer`);
	return found as LayerSpecification & { paint: Record<string, unknown>; layout?: Record<string, unknown> };
}

function insertAfter(style: StyleSpecification, id: string, ...layers: LayerSpecification[]) {
	style.layers.splice(style.layers.indexOf(layer(style, id)) + 1, 0, ...layers);
}

/** OpenFreeMap's pale Positron, warmed to the site's palette. */
function warmPositron(style: StyleSpecification) {
	layer(style, 'background').paint['background-color'] = '#f6f1ea';
	layer(style, 'water').paint['fill-color'] = '#d6e2e6';
	layer(style, 'park').paint['fill-color'] = '#e6ead9';
}

function addRelief(style: StyleSpecification, shade: string, highlight: string, exaggeration: number, contours: LayerSpecification[]) {
	style.sources.dem = demSource();
	style.sources.contours = { type: 'vector', tiles: [CONTOUR_TILES], maxzoom: 15 };
	insertAfter(style, 'water', {
		id: 'hillshade',
		type: 'hillshade',
		source: 'dem',
		paint: {
			'hillshade-exaggeration': exaggeration,
			'hillshade-shadow-color': shade,
			'hillshade-highlight-color': highlight,
			'hillshade-accent-color': shade,
		},
	});
	insertAfter(style, 'waterway', ...contours);
}

function lightTopo(style: StyleSpecification) {
	warmPositron(style);
	addRelief(style, '#8a7a66', '#fffaf2', 0.35, contourLayers('#b08d63', '#8b6b47', '#f6f1ea'));
}

// An antique look on Positron's data: parchment land, muted sea-green water
// with an inked shore, brown ink roads and labels, italic water names, and
// sepia relief and contours. The paper grain and compass rose are drawn over
// the map by TripMap.astro.
const PAPER = '#efe2c4';
function oldWorld(style: StyleSpecification) {
	for (const l of style.layers as (LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> })[]) {
		const paint = (l.paint ??= {});
		if (l.type === 'fill') {
			if (l.id === 'water') {
				paint['fill-color'] = '#bccbbd';
				paint['fill-outline-color'] = '#6f8478';
			} else if (l.id.startsWith('park') || l.id.includes('wood')) {
				paint['fill-color'] = '#ddcf9f';
				paint['fill-opacity'] = 0.6;
			} else if (l.id.includes('glacier') || l.id.includes('ice')) {
				paint['fill-color'] = '#f5edd8';
			} else {
				paint['fill-color'] = '#e6d5ae';
				paint['fill-opacity'] = 0.5;
			}
		} else if (l.type === 'line') {
			if (l.id.startsWith('boundary')) {
				paint['line-color'] = '#8a3b2a';
				paint['line-dasharray'] = [3, 2];
			} else if (l.id === 'waterway') paint['line-color'] = '#6f8478';
			else if (l.id.includes('casing')) paint['line-color'] = PAPER;
			else paint['line-color'] = '#8b6b4a';
		} else if (l.type === 'symbol') {
			const water = l.id.startsWith('water');
			paint['text-color'] = water ? '#3f5a63' : '#5a3d22';
			paint['text-halo-color'] = PAPER;
			l.layout ??= {};
			if (water) l.layout['text-font'] = ['Noto Sans Italic'];
			if (l.id.includes('shield')) l.layout.visibility = 'none';
		}
	}
	layer(style, 'background').paint['background-color'] = PAPER;
	addRelief(style, '#6b4f2e', '#fff6e0', 0.5, contourLayers('rgba(122,86,50,0.55)', '#6b4f2e', PAPER));
}

const STYLES: Record<MapStyle, () => Promise<StyleSpecification> | StyleSpecification> = {
	light: () => openFreeMap('positron', warmPositron),
	'light-topo': () => openFreeMap('positron', lightTopo),
	'old-world': () => openFreeMap('positron', oldWorld),
	satellite: () => satellite(),
	'satellite-topo': () => satellite({ contours: true }),
	'terrain-3d': () => satellite({ terrain: true }),
	liberty: () => openFreeMap('liberty'),
	fiord: () => openFreeMap('fiord'),
	globe: () => satellite({ globe: true }),
};

export interface TripMap {
	/** Redraws the map in another style and zoom setting, for the admin preview. */
	update(mode: Exclude<MapMode, 'off'>, style: MapStyle): Promise<void>;
}

export async function drawTripMap(container: HTMLElement, view: MapView, style: MapStyle): Promise<TripMap> {
	const map = new Map({
		container,
		style: await STYLES[style](),
		center: view.center,
		zoom: 4,
		maxPitch: 85,
		// Page scrolling stays normal; two fingers (or Ctrl/Cmd + scroll) move the map.
		cooperativeGestures: true,
	});
	map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

	for (const point of view.points) {
		const dot = document.createElement('div');
		dot.className = 'trip-map-pin';
		// In 3D a ridge can stand between the camera and a pin; keep the pin visible anyway.
		new Marker({ element: dot, opacityWhenCovered: '1' }).setLngLat(point).addTo(map);
	}
	container.style.setProperty('--pin', PIN);

	function placeCamera(mode: Exclude<MapMode, 'off'>, current: MapStyle) {
		const pitch = current === 'terrain-3d' ? TERRAIN_PITCH : 0;
		if (current === 'globe') {
			// The whole planet, tilted so the pin sits a little above center.
			map.jumpTo({ center: [view.center[0], Math.max(-60, Math.min(60, view.center[1] - 15))], zoom: GLOBE_ZOOM, pitch: 0, bearing: 0 });
		} else if (mode === 'fit') {
			map.fitBounds(view.bounds, { padding: 60, maxZoom: FIT_MAX_ZOOM + (pitch ? 1.5 : 0), pitch, bearing: 0, duration: 0 });
		} else {
			map.jumpTo({ center: view.center, zoom: ZOOM[mode] + (pitch ? 1.5 : 0), pitch, bearing: 0 });
		}
	}

	placeCamera(view.mode, style);
	let shown = style;
	return {
		async update(mode, next) {
			if (next !== shown) {
				map.setStyle(await STYLES[next](), { diff: false });
				shown = next;
			}
			placeCamera(mode, next);
		},
	};
}
