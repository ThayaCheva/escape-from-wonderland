// The five board locations as pixel masks traced from the board art (tools/trace_locations.py).
import { LOCATIONS } from '../engine/board';
import type { LocationId } from '../engine/types';

export interface Mask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
}

export type Masks = Partial<Record<LocationId, Mask>>;

export const maskUrl = (loc: LocationId) => `${import.meta.env.BASE_URL}assets/locations/${loc}.png`;

/** The location under a point given in percent of the board, or null. */
export function locationAt(masks: Masks, xPct: number, yPct: number, allowed: readonly LocationId[] = LOCATIONS): LocationId | null {
  if (xPct < 0 || xPct >= 100 || yPct < 0 || yPct >= 100) return null;
  for (const loc of allowed) {
    const m = masks[loc];
    if (!m) continue;
    const x = Math.floor((xPct / 100) * m.width);
    const y = Math.floor((yPct / 100) * m.height);
    if (m.alpha[y * m.width + x] > 127) return loc;
  }
  return null;
}

let cache: Promise<Masks> | null = null;

/** Loads the mask images once and reads their alpha channels. */
export function loadMasks(): Promise<Masks> {
  cache ??= Promise.all(
    LOCATIONS.map(
      (loc) =>
        new Promise<[LocationId, Mask] | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
            for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
            resolve([loc, { width: canvas.width, height: canvas.height, alpha }]);
          };
          img.onerror = () => resolve(null);
          img.src = maskUrl(loc);
        }),
    ),
  ).then((entries) => Object.fromEntries(entries.filter((e): e is [LocationId, Mask] => e !== null)) as Masks);
  return cache;
}
