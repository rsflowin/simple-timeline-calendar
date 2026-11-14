import { describe, expect, it } from 'vitest';
import { laneFit, shownLanes } from './layout';

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
