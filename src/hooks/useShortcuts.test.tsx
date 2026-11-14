// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShortcuts } from './useShortcuts';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));

describe('useShortcuts', () => {
  afterEach(() => document.body.replaceChildren());

  it('calls the handler for a key pressed on the page', () => {
    const n = vi.fn();
    renderHook(() => useShortcuts({ n }));
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(n).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true); // or the key is typed into the field it opens
  });

  it('ignores keys typed in a field, except escape', () => {
    const n = vi.fn();
    const escape = vi.fn();
    renderHook(() => useShortcuts({ n, escape }));
    const input = document.body.appendChild(document.createElement('input'));
    press('n', {}, input);
    press('Escape', {}, input);
    expect(n).not.toHaveBeenCalled();
    expect(escape).toHaveBeenCalledOnce();
  });

  it('ignores keys inside a dialog or popover, except escape', () => {
    const n = vi.fn();
    const escape = vi.fn();
    renderHook(() => useShortcuts({ n, escape }));
    const inDialog = document.body
      .appendChild(document.createElement('dialog'))
      .appendChild(document.createElement('button'));
    const popover = document.body.appendChild(document.createElement('div'));
    popover.setAttribute('role', 'dialog');
    const inPopover = popover.appendChild(document.createElement('button'));
    press('n', {}, inDialog);
    press('n', {}, inPopover);
    press('Escape', {}, inPopover);
    expect(n).not.toHaveBeenCalled();
    expect(escape).toHaveBeenCalledOnce();
  });

  it('ignores keys during IME composition', () => {
    const n = vi.fn();
    renderHook(() => useShortcuts({ n }));
    press('n', { isComposing: true });
    press('Process', { keyCode: 229 } as KeyboardEventInit);
    expect(n).not.toHaveBeenCalled();
  });

  it('reads the physical key when the layout gives a non-ASCII character', () => {
    const n = vi.fn();
    const one = vi.fn();
    renderHook(() => useShortcuts({ n, '1': one }));
    press('ㅜ', { code: 'KeyN' });
    press('1', { code: 'Digit1' });
    expect(n).toHaveBeenCalledOnce();
    expect(one).toHaveBeenCalledOnce();
  });

  it('keeps e.key for ASCII layouts (AZERTY a is on KeyQ)', () => {
    const a = vi.fn();
    const q = vi.fn();
    renderHook(() => useShortcuts({ a, q }));
    press('a', { code: 'KeyQ' });
    expect(a).toHaveBeenCalledOnce();
    expect(q).not.toHaveBeenCalled();
  });

  it('maps ctrl and meta to mod, with shift', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useShortcuts({ 'mod+z': undo, 'mod+shift+z': redo }));
    press('z', { ctrlKey: true });
    press('z', { metaKey: true });
    press('Z', { ctrlKey: true, shiftKey: true });
    expect(undo).toHaveBeenCalledTimes(2);
    expect(redo).toHaveBeenCalledOnce();
  });

  it('does not fire a plain-key shortcut when a modifier is held', () => {
    const z = vi.fn();
    renderHook(() => useShortcuts({ z }));
    press('z', { ctrlKey: true });
    press('z', { altKey: true });
    expect(z).not.toHaveBeenCalled();
  });
});
