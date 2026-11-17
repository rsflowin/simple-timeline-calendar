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

interface TaggedSpan extends Span {
  tag?: string;
}

const ts = (id: string, start: number, end: number, tag?: string): TaggedSpan => ({
  id,
  start,
  end,
  tag,
});

describe('packRows with tag grouping', () => {
  const tagOf = (x: TaggedSpan) => x.tag;

  it('keeps non-overlapping spans of different tags on separate rows in dedicated mode', () => {
    const spans = [
      ts('a1', 0, 2, 'A'),
      ts('b1', 5, 6, 'B'),
      ts('a2', 10, 12, 'A'),
      ts('u1', 15, 16),
    ];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'dedicated' });
    expect(ids(rows)).toEqual([['a1', 'a2'], ['b1'], ['u1']]);
  });

  it('spills overlapping same-tag spans within that tag band in dedicated mode', () => {
    const spans = [
      ts('a1', 0, 5, 'A'),
      ts('a2', 3, 8, 'A'),
      ts('a3', 7, 10, 'A'),
      ts('b1', 0, 2, 'B'),
    ];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'dedicated' });
    expect(ids(rows)).toEqual([['a1', 'a3'], ['a2'], ['b1']]);
  });

  it('orders groups by tagOrder and puts unknown or untagged spans together at the bottom', () => {
    const spans = [
      ts('u1', 0, 1),
      ts('ghost', 5, 6, 'deleted'),
      ts('b1', 0, 1, 'B'),
      ts('a1', 0, 1, 'A'),
    ];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'dedicated' });
    expect(ids(rows)).toEqual([['a1'], ['b1'], ['u1', 'ghost']]);
  });

  it('merges non-overlapping tracks across tags in compact mode without splitting same-tag tracks', () => {
    const spans = [
      ts('a1', 0, 5, 'A'),
      ts('a2', 3, 7, 'A'), // overlaps a1 -> track A1
      ts('a3', 10, 15, 'A'), // fits after a1 on track A0
      ts('b1', 11, 13, 'B'), // overlaps a3 on row 0, fits on row 1 with a2
    ];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'compact' });
    expect(ids(rows)).toEqual([
      ['a1', 'a3'],
      ['a2', 'b1'],
    ]);
  });

  it('does not split a non-overlapping tag track across rows in compact mode', () => {
    const spans = [
      ts('a1', 0, 2, 'A'),
      ts('a2', 20, 25, 'A'),
      ts('b1', 5, 7, 'B'), // fits gap on row 0, but b2 overlaps a2 -> whole B track stays together
      ts('b2', 22, 24, 'B'),
    ];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'compact' });
    expect(ids(rows)).toEqual([
      ['a1', 'a2'],
      ['b1', 'b2'],
    ]);
  });

  it('treats inclusive end === start as overlapping when merging tracks in compact mode', () => {
    const spans = [ts('a1', 0, 2, 'A'), ts('b1', 2, 4, 'B')];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'compact' });
    expect(ids(rows)).toEqual([['a1'], ['b1']]);
  });

  it('merges completely non-overlapping tags into one row in compact mode sorted by start', () => {
    const spans = [ts('b1', 5, 6, 'B'), ts('a1', 0, 2, 'A'), ts('a2', 10, 12, 'A')];
    const rows = packRows(spans, true, { tagOrder: ['A', 'B'], tagOf, mode: 'compact' });
    expect(ids(rows)).toEqual([['a1', 'b1', 'a2']]);
  });

  it('keeps one row per span sorted by start when pack is false even with tag options', () => {
    const spans = [ts('b1', 5, 6, 'B'), ts('a1', 0, 2, 'A')];
    const rows = packRows(spans, false, { tagOrder: ['A', 'B'], tagOf, mode: 'dedicated' });
    expect(ids(rows)).toEqual([['a1'], ['b1']]);
  });
});
