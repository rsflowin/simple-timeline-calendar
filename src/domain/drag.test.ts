import { describe, expect, it } from 'vitest';
import { applyDrag, rangeBetween } from './drag';

const span = { start: 10, end: 12 };

describe('applyDrag', () => {
  it('moves both ends', () => expect(applyDrag(span, 'move', 3)).toEqual({ start: 13, end: 15 }));
  it('resizes start, never past end', () => {
    expect(applyDrag(span, 'resize-start', -2)).toEqual({ start: 8, end: 12 });
    expect(applyDrag(span, 'resize-start', 5)).toEqual({ start: 12, end: 12 });
  });
  it('resizes end, never before start', () => {
    expect(applyDrag(span, 'resize-end', 4)).toEqual({ start: 10, end: 16 });
    expect(applyDrag(span, 'resize-end', -5)).toEqual({ start: 10, end: 10 });
  });
});

describe('rangeBetween', () => {
  it('orders the two days', () => {
    expect(rangeBetween(5, 2)).toEqual([2, 5]);
    expect(rangeBetween(2, 5)).toEqual([2, 5]);
  });
});
