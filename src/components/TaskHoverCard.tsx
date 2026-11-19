import { useEffect, useLayoutEffect, useRef } from 'react';
import { formatRangeWithYear, toDayIndex } from '../domain/dates';
import { useDoc } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { hideHover } from '../views/openTask';
import { TagChip } from './TagChip';
import styles from './TaskHoverCard.module.css';

const GAP = 6;
const MARGIN = 8;

/** Full title, dates and tags of the bar under the mouse, so short bars stay readable. Mount once. */
export function TaskHoverCard() {
  const hover = useUi((s) => s.hover);
  const doc = useDoc();
  const ref = useRef<HTMLDivElement>(null);
  const task = hover && doc.tasks.find((t) => t.id === hover.id);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !hover) return;
    const { width, height } = el.getBoundingClientRect();
    const a = hover.anchor;
    let top = a.bottom + GAP;
    if (top + height > innerHeight - MARGIN) top = Math.max(MARGIN, a.top - GAP - height);
    const left = Math.max(MARGIN, Math.min(a.left, innerWidth - MARGIN - width));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [hover]);

  // The anchor rect goes stale once anything scrolls.
  useEffect(() => {
    if (!hover) return;
    addEventListener('scroll', hideHover, true);
    return () => removeEventListener('scroll', hideHover, true);
  }, [hover]);

  if (!task) return null;
  const tags = task.tagIds.flatMap((id) => doc.tags.find((t) => t.id === id) ?? []);
  return (
    <div ref={ref} className={styles.card} aria-hidden="true">
      <div className={styles.title}>{task.title}</div>
      <div className={styles.dates}>
        {formatRangeWithYear(toDayIndex(task.start), toDayIndex(task.end))}
      </div>
      {tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>
      )}
    </div>
  );
}
