// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createScrollPan, startNonTaskDrag, startPointerDrag } from './pointerDrag';

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

  it('returned cleanup detaches listeners without triggering callbacks', () => {
    const cb = { onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() };
    const stop = startPointerDrag({ button: 0, clientX: 100, clientY: 50 }, cb);
    stop();
    fire('pointermove', 150, 50);
    fire('pointerup', 150, 50);
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(cb.onEnd).not.toHaveBeenCalled();
    expect(cb.onCancel).not.toHaveBeenCalled();
  });
});

describe('createScrollPan', () => {
  it('subtracts incremental pointer deltas from scrollLeft and scrollTop', () => {
    const el = { scrollLeft: 100, scrollTop: 50 } as HTMLElement;
    const step = createScrollPan(el, { clientX: 200, clientY: 100 });
    step({ clientX: 180, clientY: 90 });
    expect(el).toMatchObject({ scrollLeft: 120, scrollTop: 60 });
    // simulate external scroll adjustment (e.g. timeline edge expansion)
    el.scrollLeft += 500;
    step({ clientX: 170, clientY: 95 });
    expect(el).toMatchObject({ scrollLeft: 630, scrollTop: 55 });
  });
});

describe('startNonTaskDrag', () => {
  it('pans on drag when pan=true and skips onClick after movement', () => {
    const scrollEl = { scrollLeft: 100, scrollTop: 40 } as HTMLElement;
    const onPanChange = vi.fn();
    const onClick = vi.fn();
    startNonTaskDrag(
      { button: 0, clientX: 50, clientY: 50 },
      { scrollEl, pan: true, onPanChange, onClick },
    );
    fire('pointermove', 30, 35);
    expect(onPanChange).toHaveBeenCalledWith(true);
    expect(scrollEl).toMatchObject({ scrollLeft: 120, scrollTop: 55 });
    fire('pointerup', 25, 35);
    expect(onPanChange).toHaveBeenLastCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when not moved and cancels panning on Escape', () => {
    const scrollEl = { scrollLeft: 100, scrollTop: 40 } as HTMLElement;
    const onPanChange = vi.fn();
    const onClick = vi.fn();

    startNonTaskDrag(
      { button: 0, clientX: 50, clientY: 50 },
      { scrollEl, pan: false, onPanChange, onClick },
    );
    fire('pointerup', 51, 51);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onPanChange).not.toHaveBeenCalled();

    startNonTaskDrag(
      { button: 0, clientX: 50, clientY: 50 },
      { scrollEl, pan: true, onPanChange, onClick },
    );
    fire('pointermove', 70, 50);
    key({ key: 'Escape' });
    expect(onPanChange).toHaveBeenLastCalledWith(false);
  });
});
