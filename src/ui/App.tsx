import { useState } from 'react';
import { useGame } from './useGame';
import { loadGame } from './save';
import { TitleScreen } from './components/TitleScreen';
import { NewGameScreen } from './components/NewGameScreen';
import { EndScreen } from './components/EndScreen';
import { Table } from './components/Table';

export function App() {
  const game = useGame();
  const [screen, setScreen] = useState<'title' | 'new'>('title');

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
    return <Table state={game.state} dispatch={game.dispatch} onQuit={() => { game.quit(); setScreen('title'); }} />;
  }
  if (screen === 'new') {
    return <NewGameScreen onStart={game.start} onBack={() => setScreen('title')} />;
  }
  return <TitleScreen canContinue={loadGame() !== null} onNew={() => setScreen('new')} onContinue={game.resume} />;
}
