import { describe, expect, it } from 'vitest';
import { shouldChime } from '../sound';

describe('shouldChime', () => {
  it('chimes only when it becomes your move and sound is on', () => {
    expect(shouldChime(false, true, true)).toBe(true);
    expect(shouldChime(true, true, true)).toBe(false);
    expect(shouldChime(false, true, false)).toBe(false);
    expect(shouldChime(true, false, true)).toBe(false);
  });
});
