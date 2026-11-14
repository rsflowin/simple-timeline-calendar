import { formatRange } from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import styles from './timeline.module.css';

interface Props {
  span: TaskSpan;
  left: number;
  width: number;
  top: number;
  color: { background: string; color: string };
}

export function TaskBar({ span, left, width, top, color }: Props) {
  const label = `${span.task.title}, ${formatRange(span.start, span.end)}`;
  return (
    <button
      type="button"
      className={styles.bar}
      style={{ left, width, top, ...color }}
      aria-label={label}
      title={label}
    >
      <span className={styles.barLabel}>{span.task.title}</span>
    </button>
  );
}
