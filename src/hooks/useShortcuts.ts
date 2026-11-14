import { useEffect, useRef } from 'react';

const TYPING = 'input, textarea, select, [contenteditable], dialog, [role=dialog]';

/**
 * Global keyboard shortcuts. Keys: `'n'`, `'1'`, `'mod+z'`, `'mod+shift+z'`, `'delete'`,
 * `'escape'`… `mod` is Ctrl or ⌘. Ignored during IME composition, and while typing in a field or
 * inside a dialog/popover, except `escape`.
 */
export function useShortcuts(map: Record<string, () => void>) {
  const latest = useRef(map);
  useEffect(() => {
    latest.current = map;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.isComposing || e.keyCode === 229) return;
      const mod = e.ctrlKey || e.metaKey;
      // A non-Latin layout (Korean gives 'ㅜ' for N) falls back to the physical key.
      const key =
        e.key.length === 1 && e.key.charCodeAt(0) > 127
          ? (/^(?:Key|Digit)(.)$/.exec(e.code)?.[1] ?? e.key)
          : e.key;
      const name = [mod && 'mod', e.shiftKey && 'shift', key.toLowerCase()]
        .filter(Boolean)
        .join('+');
      const handler = latest.current[name];
      if (!handler) return;
      if (name !== 'escape' && e.target instanceof Element && e.target.closest(TYPING)) return;
      // Stops `n` from being typed into the field it opens. Never on Esc: that would stop a
      // native <dialog> from closing.
      if (name !== 'escape') e.preventDefault();
      handler();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
