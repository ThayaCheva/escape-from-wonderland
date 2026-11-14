import { describe, expect, it } from 'vitest';
import { fanLayout } from '../layout';

describe('fanLayout', () => {
  it('fits a 25-card hand inside its edge', () => {
    const { step, total } = fanLayout(25, 500, 70);
    expect(total).toBeLessThanOrEqual(500);
    expect(step).toBeGreaterThan(0);
  });

  it('a single card has no spacing', () => {
    expect(fanLayout(1, 500, 70)).toEqual({ step: 0, total: 70 });
  });

  it('small hands use the comfortable spacing', () => {
    expect(fanLayout(5, 500, 70).step).toBe(52.5);
  });

  it('an empty hand takes no room', () => {
    expect(fanLayout(0, 500, 70)).toEqual({ step: 0, total: 0 });
  });
});
