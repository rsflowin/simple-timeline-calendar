import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, initHistory, pushHistory, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes', () => {
    let h = pushHistory(pushHistory(initHistory(0), 1), 2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
  });
  it('a new change clears redo', () => {
    const h = pushHistory(undo(pushHistory(initHistory(0), 1)), 5);
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });
  it('ignores a no-op push and an undo with no past', () => {
    const h = initHistory({ a: 1 });
    expect(pushHistory(h, h.present)).toBe(h);
    expect(undo(h)).toBe(h);
  });
  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = pushHistory(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(5);
  });
});
