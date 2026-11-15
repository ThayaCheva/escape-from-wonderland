// Which layout to use: the full desktop table, or the phone layout (online play, phone held sideways).
import { createContext, useContext, useEffect, useState } from 'react';

export type ScreenKind = 'desktop' | 'phone';

/** Logical stage size for each layout; the stage is scaled to fit the window. */
export const STAGES: Record<ScreenKind, { w: number; h: number }> = {
  desktop: { w: 1600, h: 900 },
  phone: { w: 1000, h: 470 },
};

/** Phones: touch screens whose short side is at most 500 px. Tablets and PCs keep the desktop table. */
export function pickScreen(width: number, height: number, coarsePointer: boolean): { kind: ScreenKind; portrait: boolean } {
  const phone = coarsePointer && Math.min(width, height) <= 500;
  return { kind: phone ? 'phone' : 'desktop', portrait: phone && height > width };
}

/** Phone layout: opponents stacked down the left side (stage coordinates of each panel's centre). */
export function opponentSlot(index: number, count: number): { x: number; y: number } {
  return { x: 112, y: 183 - (count - 1) * 61 + index * 122 };
}

function read() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return pickScreen(window.innerWidth, window.innerHeight, coarse);
}

export function useScreenSize() {
  const [screen, setScreen] = useState(read);
  useEffect(() => {
    const update = () => setScreen(read());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return screen;
}

/** The layout in use below this point of the tree (one-screen games always use the desktop table). */
export const ScreenContext = createContext<ScreenKind>('desktop');
export const useScreen = () => useContext(ScreenContext);
