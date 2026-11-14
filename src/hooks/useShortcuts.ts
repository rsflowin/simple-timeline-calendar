import { useEffect, useRef } from 'react';

const TYPING = 'input, textarea, select, [contenteditable], dialog';

/**
 * Global keyboard shortcuts. Keys: `'n'`, `'1'`, `'mod+z'`, `'mod+shift+z'`, `'delete'`,
 * `'escape'`… `mod` is Ctrl or ⌘. Ignored while typing in a field or inside an open dialog,
 * except `escape`.
 */
export function useShortcuts(map: Record<string, () => void>) {
  const latest = useRef(map);
  useEffect(() => {
    latest.current = map;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) return;
      const mod = e.ctrlKey || e.metaKey;
      const name = [mod && 'mod', e.shiftKey && 'shift', e.key.toLowerCase()]
        .filter(Boolean)
        .join('+');
      const handler = latest.current[name];
      if (!handler) return;
      if (name !== 'escape' && e.target instanceof Element && e.target.closest(TYPING)) return;
      // Never preventDefault on Esc: that would stop a native <dialog> from closing.
      if (mod) e.preventDefault();
      handler();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
