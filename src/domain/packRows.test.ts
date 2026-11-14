import { describe, expect, it } from 'vitest';
import { packRows, type Span } from './packRows';

const s = (id: string, start: number, end: number): Span => ({ id, start, end });
const ids = (rows: Span[][]) => rows.map((r) => r.map((x) => x.id));

describe('packRows', () => {
  it('puts non-overlapping spans in one row', () => {
    expect(ids(packRows([s('a', 0, 2), s('b', 3, 5)], true))).toEqual([['a', 'b']]);
  });
  it('treats the inclusive end day as an overlap', () => {
    expect(ids(packRows([s('a', 0, 2), s('b', 2, 4)], true))).toEqual([['a'], ['b']]);
  });
  it('fills the first row that fits', () => {
    const rows = packRows([s('a', 0, 9), s('b', 0, 2), s('c', 3, 5), s('d', 10, 11)], true);
    expect(ids(rows)).toEqual([
      ['a', 'd'],
      ['b', 'c'],
    ]);
  });
  it('sorts by start, longer first on ties', () => {
    const rows = packRows([s('short', 0, 1), s('late', 5, 6), s('long', 0, 8)], true);
    expect(ids(rows)).toEqual([['long'], ['short', 'late']]);
  });
  it('gives every span its own row when packing is off', () => {
    expect(ids(packRows([s('b', 3, 5), s('a', 0, 2)], false))).toEqual([['a'], ['b']]);
  });
  it('handles empty input and does not mutate it', () => {
    const input = [s('b', 3, 5), s('a', 0, 2)];
    packRows(input, true);
    expect(ids([input])).toEqual([['b', 'a']]);
    expect(packRows([], true)).toEqual([]);
  });
});
