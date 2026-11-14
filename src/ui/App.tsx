import { useState } from 'react';
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

export function App() {
  const game = useGame();
  const online = useOnlineGame();
  const [screen, setScreen] = useState<Screen>(() => (roomFromUrl() ? 'join' : 'title'));

  const toTitle = () => {
    game.quit();
    online.leave();
    setScreen('title');
  };

  // ---------- one screen (hot-seat) ----------
  if (game.state) {
    if (game.state.phase === 'game-over') {
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
    if (online.view.phase === 'game-over') {
      return <EndScreen state={online.view} onNew={toTitle} newLabel="Back to title" />;
    }
    return (
      <ErrorBoundary onReset={toTitle}>
        <Table
          state={online.view}
          dispatch={(a) => {
            online.act(a);
            return null;
          }}
          onQuit={toTitle}
          viewerSeat={online.seat}
          connected={online.connected}
          notice={online.error}
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
