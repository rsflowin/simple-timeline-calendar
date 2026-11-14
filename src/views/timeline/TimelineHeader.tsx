import type { HeaderCell } from '../../domain/scale';
import styles from './timeline.module.css';

interface Props {
  top: HeaderCell[];
  bottom: HeaderCell[];
  from: number;
  px: number;
}

/** Two sticky header rows; cells are absolutely placed on the timeline's scale. */
export function TimelineHeader({ top, bottom, from, px }: Props) {
  const place = (c: HeaderCell) => ({ left: (c.start - from) * px, width: c.days * px });
  return (
    <div className={styles.header}>
      <div className={styles.headerRow}>
        {top.map((c) => (
          <div key={c.key} className={styles.cell} style={place(c)}>
            <span className={styles.stickyLabel}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.headerRow}>
        {bottom.map((c) => (
          <div key={c.key} className={styles.cell} style={place(c)}>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
