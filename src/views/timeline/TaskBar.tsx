import type { PointerEvent } from 'react';
import { formatRange } from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import { useUi } from '../../store/uiStore';
import styles from './timeline.module.css';

interface Props {
  span: TaskSpan;
  left: number;
  width: number;
  top: number;
  color: { background: string; color: string };
  selected: boolean;
  /** Shown under the bar while it's dragged (TL-16). */
  tip?: string;
  onPointerDown(e: PointerEvent<HTMLButtonElement>): void;
  /** Keyboard activation; pointer clicks come through the drag (TL-15). */
  onOpen(): void;
}

export function TaskBar({ span, left, width, top, color, selected, tip, ...on }: Props) {
  const label = `${span.task.title}, ${formatRange(span.start, span.end)}`;
  const cls = [styles.bar, selected && styles.selected, tip && styles.dragging];
  return (
    <button
      type="button"
      className={cls.filter(Boolean).join(' ')}
      style={{ left, width, top, ...color }}
      aria-label={label}
      title={tip ? undefined : label}
      onPointerDown={on.onPointerDown}
      // a focused bar is the selected one, so Delete works on it (NF-4)
      onFocus={() => useUi.getState().select(span.id)}
      onClick={(e) => {
        if (e.detail === 0) on.onOpen();
      }}
    >
      <span className={styles.barLabel}>{span.task.title}</span>
      <span className={`${styles.handle} ${styles.handleStart}`} data-handle="start" />
      <span className={`${styles.handle} ${styles.handleEnd}`} data-handle="end" />
      {tip && <span className={styles.tip}>{tip}</span>}
    </button>
  );
}
