import { useEffect, useState, type ReactNode } from 'react';
import { STAGES, useScreen } from '../screen';

function fit(w: number, h: number) {
  return Math.min(window.innerWidth / w, window.innerHeight / h);
}

/** A fixed 1600x900 logical stage scaled to fit the window. */
export function Stage({ children, background, className, modal }: {
  children: ReactNode;
  background?: string;
  className?: string;
  modal?: ReactNode;
}) {
  const kind = useScreen();
  const { w, h } = STAGES[kind];
  const [scale, setScale] = useState(() => fit(w, h));
  useEffect(() => {
    const onResize = () => setScale(fit(w, h));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [w, h]);
  return (
    <div className="stage-outer">
      <div
        className={`stage ${kind}${className ? ` ${className}` : ''}`}
        style={{
          width: w,
          height: h,
          transform: `translate(-50%, -50%) scale(${scale})`,
          backgroundImage: background ? `url(${background})` : undefined,
        }}
      >
        <div inert={modal != null}>{children}</div>
        {modal}
      </div>
    </div>
  );
}
