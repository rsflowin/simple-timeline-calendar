// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { startPointerDrag } from './pointerDrag';

const fire = (type: string, clientX = 0, clientY = 0) =>
  window.dispatchEvent(new MouseEvent(type, { clientX, clientY }));
const key = (init: KeyboardEventInit) => window.dispatchEvent(new KeyboardEvent('keydown', init));

function start(button = 0) {
  const cb = { onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() };
  startPointerDrag({ button, clientX: 100, clientY: 50 }, cb);
  return cb;
}

describe('startPointerDrag', () => {
  it('reports a click when the pointer moves less than the threshold', () => {
    const cb = start();
    fire('pointermove', 102, 51);
    fire('pointerup', 102, 51);
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(cb.onEnd).toHaveBeenCalledWith(2, 1, expect.anything(), false);
  });

  it('reports moves and a moved end once past the threshold', () => {
    const cb = start();
    fire('pointermove', 110, 50);
    fire('pointerup', 130, 60);
    expect(cb.onMove).toHaveBeenCalledWith(10, 0, expect.anything());
    expect(cb.onEnd).toHaveBeenCalledWith(30, 10, expect.anything(), true);
    fire('pointermove', 200, 50);
    expect(cb.onMove).toHaveBeenCalledOnce(); // listeners removed
  });

  it('Escape cancels, except during IME composition', () => {
    const cb = start();
    fire('pointermove', 120, 50);
    key({ key: 'Escape', isComposing: true });
    expect(cb.onCancel).not.toHaveBeenCalled();
    key({ key: 'Escape' });
    fire('pointerup', 120, 50);
    expect(cb.onCancel).toHaveBeenCalledOnce();
    expect(cb.onEnd).not.toHaveBeenCalled();
  });

  it('ignores buttons other than the main one', () => {
    const cb = start(2);
    fire('pointermove', 150, 50);
    fire('pointerup', 150, 50);
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(cb.onEnd).not.toHaveBeenCalled();
  });
});
