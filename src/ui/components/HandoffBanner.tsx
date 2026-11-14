import { actingSeat } from '../../engine/step';
import type { GameState } from '../../engine/types';
import { aliceImage } from '../assets';

export function handoffText(state: GameState): { title: string; detail: string } {
  const seat = actingSeat(state);
  const name = state.players[seat].name;
  const prompt = state.prompts[0];
  if (prompt?.type === 'setup-pick') {
    return { title: `${name}: choose your starting card`, detail: 'Everyone else look away. Click when ready.' };
  }
  if (prompt && prompt.seat !== state.current) {
    return { title: `Pass the mouse to ${name}`, detail: 'Everyone else look away. Click when ready.' };
  }
  return { title: `${name}'s turn`, detail: 'Click to begin.' };
}

export function HandoffBanner({ state, onConfirm }: { state: GameState; onConfirm: () => void }) {
  const { title, detail } = handoffText(state);
  const player = state.players[actingSeat(state)];
  return (
    <div className="handoff" onClick={onConfirm} role="button" data-testid="handoff">
      <div className={`handoff-card toward-${player.edge}`}>
        <img src={aliceImage(player.alice)} alt="" />
        <div>
          <div className="handoff-title">{title}</div>
          <div className="handoff-detail">{detail}</div>
        </div>
      </div>
    </div>
  );
}
