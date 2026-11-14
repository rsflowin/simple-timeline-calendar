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
    press('n');
    expect(n).toHaveBeenCalledOnce();
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

  it('ignores keys inside an open dialog', () => {
    const n = vi.fn();
    renderHook(() => useShortcuts({ n }));
    const button = document.body
      .appendChild(document.createElement('dialog'))
      .appendChild(document.createElement('button'));
    press('n', {}, button);
    expect(n).not.toHaveBeenCalled();
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
