import { describe, expect, it } from 'vitest';
import type { TaskSpan } from '../../domain/spans';
import type { Task } from '../../domain/types';
import { laneFit, shownLanes, splitLanes, withGesture, type CalSpan } from './layout';

describe('laneFit', () => {
  it('fits 22 px lanes under the 24 px date line, at least one', () => {
    expect(laneFit(24 + 3 * 22)).toBe(3);
    expect(laneFit(24 + 3 * 22 - 1)).toBe(2);
    expect(laneFit(10)).toBe(1);
  });
});

describe('shownLanes', () => {
  it('shows every lane when they fit or there is no cap', () => {
    expect(shownLanes(3, 3)).toBe(3);
    expect(shownLanes(9, undefined)).toBe(9);
  });

  it('leaves the last fitting lane for "+N more" when they do not', () => {
    expect(shownLanes(4, 3)).toBe(2);
    expect(shownLanes(4, 1)).toBe(0);
  });
});

describe('withGesture', () => {
  const span = (id: string, start: number, end: number): TaskSpan => ({
    id,
    start,
    end,
    task: { id } as Task,
  });
  const spans = [span('a', 10, 12), span('b', 20, 20)];

  it('returns the same array when nothing is being dragged', () => {
    expect(withGesture(spans, null, null)).toBe(spans);
  });

  it('substitutes the dragged task range, keeping the task', () => {
    expect(withGesture(spans, { id: 'a', start: 15, end: 17 }, null)).toEqual([
      span('a', 15, 17),
      spans[1],
    ]);
  });

  it('adds the draft as a span with no task', () => {
    const out = withGesture(spans, null, { start: 3, end: 9 });
    expect(out.slice(0, 2)).toEqual(spans);
    expect(out[2]).toEqual({ id: '', start: 3, end: 9 });
  });
});

describe('splitLanes', () => {
  const seg = (id: string, task = true) => ({
    item: { id, task: task ? ({ id } as Task) : undefined } as CalSpan,
  });
  const lanes = [[seg('a')], [seg('b')], [seg('c'), seg('', false)], [seg('d')]];
  const ids = (ls: { item: CalSpan }[][]) => ls.map((l) => l.map((s) => s.item.id));
  const active = (s: CalSpan) => !s.task || s.id === 'd';

  it('draws the first `shown` lanes and hides the rest when nothing is active', () => {
    const { drawn, hidden } = splitLanes(lanes, 2, () => false);
    expect(ids(drawn)).toEqual([['a'], ['b']]);
    expect(ids(hidden)).toEqual([['c', ''], ['d']]);
  });

  it('pins the draft and the dragged bar into the last shown lane, out of the hidden ones', () => {
    const { drawn, hidden } = splitLanes(lanes, 2, active);
    expect(ids(drawn)).toEqual([['a'], ['b', '', 'd']]);
    expect(ids(hidden)).toEqual([['c'], []]);
  });

  it('pins into lane 0 when no lane is shown', () => {
    expect(ids(splitLanes(lanes, 0, active).drawn)).toEqual([['', 'd']]);
  });
});
