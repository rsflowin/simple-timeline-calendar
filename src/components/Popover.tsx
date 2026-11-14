import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './Popover.module.css';

interface PopoverProps {
  /** Viewport rect to sit next to, e.g. `el.getBoundingClientRect()`. */
  anchor: DOMRect;
  label: string;
  onClose(): void;
  children: ReactNode;
}

const GAP = 6;
const MARGIN = 8;

/** Fixed-position popover below the anchor (above if there's no room). Closes on outside pointerdown and Esc. */
export function Popover({ anchor, label, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const { width, height } = el.getBoundingClientRect();
    let top = anchor.bottom + GAP;
    if (top + height > innerHeight - MARGIN) top = Math.max(MARGIN, anchor.top - GAP - height);
    const left = Math.max(MARGIN, Math.min(anchor.left, innerWidth - MARGIN - width));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current!.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={styles.popover}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.nativeEvent.isComposing && e.keyCode !== 229) onClose();
      }}
    >
      {children}
    </div>
  );
}
