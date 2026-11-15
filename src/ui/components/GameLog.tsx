import { useLayoutEffect, useRef, useState } from 'react';
import { newLogLines } from '../animationEvents';

export function GameLog({ lines, lastPlayed }: {
  lines: string[];
  lastPlayed?: { label: string; open: (trigger: HTMLButtonElement) => void };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  // Keep row keys tied to the whole game as old entries fall out of the server's log.
  const [history, setHistory] = useState(() => ({ lines, offset: 0 }));
  if (history.lines !== lines) {
    const added = newLogLines(history.lines, lines).length;
    setHistory({ lines, offset: history.offset + history.lines.length + added - lines.length });
  }
  const followLatest = useRef(true);
  const reading = useRef<{ row: HTMLElement; offset: number } | null>(null);
  const first = Math.max(0, lines.length - 40);
  useLayoutEffect(() => {
    const log = ref.current;
    if (!open || !log) return;
    const anchor = reading.current;
    if (followLatest.current) {
      log.scrollTop = log.scrollHeight;
    } else if (anchor) {
      log.scrollTop = log.contains(anchor.row) ? anchor.row.offsetTop - anchor.offset : 0;
    }
  }, [open, lines]);
  return (
    <section className="activity">
      <div className="activity-header">
        <button
          type="button"
          className="activity-toggle"
          aria-expanded={open}
          aria-controls="table-activity"
          onClick={() => {
            followLatest.current = true;
            reading.current = null;
            setOpen(!open);
          }}
        >
          <span>Activity</span>
          <span className="activity-chevron" aria-hidden />
        </button>
        <button
          type="button"
          className="last-played-button"
          aria-haspopup="dialog"
          disabled={!lastPlayed}
          title={lastPlayed?.label ?? 'No cards have been played yet'}
          onClick={(event) => lastPlayed?.open(event.currentTarget)}
        >
          Last played
        </button>
      </div>
      <div
        className="game-log"
        id="table-activity"
        role="log"
        aria-label="Game activity"
        tabIndex={0}
        hidden={!open}
        ref={ref}
        data-testid="log"
        onScroll={({ currentTarget: log }) => {
          followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 12;
          const row = followLatest.current ? undefined : Array.from(log.children).find(
            (child): child is HTMLElement =>
              child instanceof HTMLElement && child.offsetTop + child.offsetHeight > log.scrollTop,
          );
          reading.current = row ? { row, offset: row.offsetTop - log.scrollTop } : null;
        }}
      >
        {lines.slice(first).map((line, i) => (
          <div key={history.offset + first + i} className={`log-line${first + i === lines.length - 1 ? ' newest' : ''}`}>
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}
