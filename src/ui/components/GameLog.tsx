import { useEffect, useRef } from 'react';

export function GameLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length, lines[lines.length - 1]]);
  return (
    <div className="game-log" ref={ref} data-testid="log">
      {lines.slice(-40).map((l, i, shown) => (
        <div key={`${lines.length}-${i}`} className={`log-line${i === shown.length - 1 ? ' newest' : ''}`}>
          {l}
        </div>
      ))}
    </div>
  );
}
