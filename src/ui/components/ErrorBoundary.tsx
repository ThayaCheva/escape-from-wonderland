import { Component, type ReactNode } from 'react';
import { clearSave } from '../save';

/** If rendering ever fails, clear the save so the next load starts clean, and offer a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    clearSave();
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="panel" style={{ position: 'fixed' }}>
        <h1>Something went wrong</h1>
        <p>The saved game couldn’t be shown, so it was cleared.</p>
        <button
          className="btn"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset();
          }}
        >
          Back to the title screen
        </button>
      </div>
    );
  }
}
