// Optional "your turn" chime for online play. Off unless the player turns it on.
const KEY = 'escape-wonderland/sound';

export function shouldChime(wasMine: boolean, isMine: boolean, enabled: boolean): boolean {
  return enabled && isMine && !wasMine;
}

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // ignore: the setting just won't be remembered
  }
}

/** A short two-note chime made with WebAudio (no sound files). */
export function chime(): void {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // no audio available
  }
}
