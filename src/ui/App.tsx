import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types';
import { useGame } from './useGame';
import { loadGame } from './save';
import { roomFromUrl, useOnlineGame } from '../net/useOnlineGame';
import { TitleScreen } from './components/TitleScreen';
import { NewGameScreen } from './components/NewGameScreen';
import { EndScreen } from './components/EndScreen';
import { Table } from './components/Table';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnlineEntryScreen } from './components/OnlineEntryScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { OnlineStatusScreen } from './components/OnlineStatusScreen';

type Screen = 'title' | 'new' | 'create' | 'join';

/** True once the end screen should show: 2.5 s after the game ends, so the win animation can play. */
function useEndScreen(state: GameState | null): boolean {
  const [show, setShow] = useState(false);
  const seen = useRef<GameState | null>(null);
  useEffect(() => {
    const over = state?.phase === 'game-over';
    if (!over) {
      setShow(false);
    } else if (seen.current === null || seen.current.phase === 'game-over') {
      setShow(true); // opened straight onto a finished game
    } else {
      const t = setTimeout(() => setShow(true), 2500);
      seen.current = state;
      return () => clearTimeout(t);
    }
    seen.current = state;
  }, [state]);
  return show;
}

export function App() {
  const game = useGame();
  const online = useOnlineGame();
  const [screen, setScreen] = useState<Screen>(() => (roomFromUrl() ? 'join' : 'title'));
  const localEnd = useEndScreen(game.state);
  const onlineEnd = useEndScreen(online.view);

  const toTitle = () => {
    game.quit();
    online.leave();
    setScreen('title');
  };

  // ---------- one screen (hot-seat) ----------
  if (game.state) {
    if (game.state.phase === 'game-over' && localEnd) {
      return (
        <EndScreen
          state={game.state}
          onNew={() => {
            game.quit();
            setScreen('new');
          }}
        />
      );
    }
    return (
      <ErrorBoundary onReset={toTitle}>
        <Table state={game.state} dispatch={game.dispatch} onQuit={toTitle} />
      </ErrorBoundary>
    );
  }

  // ---------- online ----------
  if (online.status === 'replaced') {
    return <OnlineStatusScreen title="Opened in another tab" detail="This game is now open in another tab or window." onBack={toTitle} />;
  }
  if (online.status === 'game' && online.view && online.seat !== null) {
    if (online.view.phase === 'game-over' && onlineEnd) {
      const isHost = online.lobby?.hostSeat === online.seat;
      return (
        <EndScreen
          state={online.view}
          onNew={toTitle}
          newLabel="Back to title"
          extra={
            isHost ? (
              <button className="btn big" onClick={online.rematch}>
                Play again
              </button>
            ) : (
              <p className="muted">Waiting for the host to start a new game…</p>
            )
          }
        />
      );
    }
    return (
      <ErrorBoundary onReset={toTitle}>
        <Table
          state={online.view}
          dispatch={(a) => {
            online.act(a);
            return null;
          }}
          onQuit={() => {
            if (window.confirm('Leave this game? You can come back by opening the same link again.')) toTitle();
          }}
          viewerSeat={online.seat}
          connected={online.connected}
          notice={online.error}
          offline={!online.socketOpen}
        />
      </ErrorBoundary>
    );
  }
  if (online.status === 'lobby' && online.lobby && online.room && online.seat !== null) {
    return (
      <LobbyScreen
        room={online.room}
        seat={online.seat}
        players={online.lobby.players}
        hostSeat={online.lobby.hostSeat}
        error={online.error?.message ?? null}
        onStart={online.start}
        onLeave={toTitle}
      />
    );
  }
  if (online.status === 'connecting' && online.rejoining) {
    return <OnlineStatusScreen title="Reconnecting…" detail="Getting your seat back. If the server was asleep this can take up to a minute." onBack={toTitle} />;
  }
  if (screen === 'create' || screen === 'join') {
    return (
      <OnlineEntryScreen
        mode={screen}
        initialCode={roomFromUrl()}
        error={online.error?.message ?? null}
        busy={online.status === 'connecting'}
        onCreate={online.create}
        onJoin={online.join}
        onBack={toTitle}
      />
    );
  }
  if (online.status === 'connecting') {
    return <OnlineStatusScreen title="Reconnecting…" detail="Getting your seat back. If the server was asleep this can take up to a minute." onBack={toTitle} />;
  }

  // ---------- menus ----------
  if (screen === 'new') {
    return <NewGameScreen onStart={game.start} onBack={() => setScreen('title')} />;
  }
  return (
    <TitleScreen
      canContinue={loadGame() !== null}
      onCreate={() => setScreen('create')}
      onJoin={() => setScreen('join')}
      onLocal={() => setScreen('new')}
      onContinue={game.resume}
    />
  );
}
