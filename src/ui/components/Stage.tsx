import { useEffect, useState, type ReactNode } from 'react';

export const STAGE_W = 1600;
export const STAGE_H = 900;

function fit() {
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
}

/** A fixed 1600x900 logical stage scaled to fit the window. */
export function Stage({ children, background }: { children: ReactNode; background?: string }) {
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <div className="stage-outer">
      <div
        className="stage"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          backgroundImage: background ? `url(${background})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
