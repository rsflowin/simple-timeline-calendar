import type { Tag } from '../domain/types';
import styles from './TagChip.module.css';

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className={styles.chip}
      style={{ background: `var(--tag-${tag.color}-bg)`, color: `var(--tag-${tag.color}-fg)` }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${tag.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}
