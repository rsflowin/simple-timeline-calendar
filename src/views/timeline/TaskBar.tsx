import type { PointerEvent } from 'react';
import { formatRange } from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import { useUi } from '../../store/uiStore';
import { editTask, hideHover, hoverProps } from '../openTask';
import styles from './timeline.module.css';

interface Props {
  span: TaskSpan;
  left: number;
  width: number;
  top: number;
  color: { background: string; color: string };
  selected: boolean;
  canDrag?: boolean;
  /** Shown under the bar while it's dragged (TL-16). */
  tip?: string;
  onPointerDown(e: PointerEvent<HTMLButtonElement>): void;
}

export function TaskBar({
  span,
  left,
  width,
  top,
  color,
  selected,
  canDrag = true,
  tip,
  onPointerDown,
}: Props) {
  const label = `${span.task.title}, ${formatRange(span.start, span.end)}`;
  const cls = [styles.bar, selected && styles.selected, tip && styles.dragging];
  return (
    <button
      type="button"
      className={cls.filter(Boolean).join(' ')}
      style={{ left, width, top, ...color }}
      aria-label={label}
      {...hoverProps(span.id)}
      onPointerDown={(e) => {
        hideHover();
        onPointerDown(e);
      }}
      // a focused bar is the selected one, so Delete works on it (NF-4)
      onFocus={() => useUi.getState().select(span.id)}
      // Enter / Space edits; pointer clicks come through the drag and open the peek (TL-15)
      onClick={(e) => {
        if (e.detail === 0) editTask(span.id);
      }}
      onDoubleClick={() => editTask(span.id)}
    >
      <span className={styles.barLabel}>{span.task.title}</span>
      {canDrag && (
        <>
          <span className={`${styles.handle} ${styles.handleStart}`} data-handle="start" />
          <span className={`${styles.handle} ${styles.handleEnd}`} data-handle="end" />
        </>
      )}
      {tip && <span className={styles.tip}>{tip}</span>}
    </button>
  );
}
