import { useRef, useState } from 'react';
import { usePrefs } from '../store/prefsStore';
import { useDoc } from '../store/roadmapStore';
import { Popover } from './Popover';
import { TagChip } from './TagChip';
import styles from './TagFilter.module.css';

/** Toolbar tag filter (UI-5): tasks having any checked tag; none checked = all tasks. */
export function TagFilter() {
  const tags = useDoc().tags;
  const filter = usePrefs((s) => s.tagFilter);
  const setPrefs = usePrefs((s) => s.set);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Ids of deleted tags stay in the filter (they come back on undo) but don't count.
  const count = tags.filter((t) => filter.includes(t.id)).length;

  const close = () => {
    setAnchor(null);
    button.current?.focus();
  };
  const toggle = (id: string) =>
    setPrefs({ tagFilter: filter.includes(id) ? filter.filter((x) => x !== id) : [...filter, id] });

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={anchor !== null}
        className={count ? styles.active : undefined}
        // Without this, the popover's outside-pointerdown closes it and the click reopens it.
        onPointerDown={(e) => anchor && e.stopPropagation()}
        onClick={(e) => (anchor ? close() : setAnchor(e.currentTarget.getBoundingClientRect()))}
      >
        {count ? `Tags (${count})` : 'Tags'}
      </button>
      {anchor && (
        <Popover anchor={anchor} label="Filter by tag" onClose={close}>
          <div className={styles.body}>
            {tags.length === 0 && <p className={styles.empty}>No tags yet</p>}
            {tags.map((t, i) => (
              <label key={t.id} className={styles.option}>
                <input
                  type="checkbox"
                  autoFocus={i === 0}
                  checked={filter.includes(t.id)}
                  onChange={() => toggle(t.id)}
                />
                <TagChip tag={t} />
              </label>
            ))}
            {/* not disabled when empty: disabling the focused button would drop focus out of the popover */}
            <button
              type="button"
              className={styles.clear}
              onClick={() => setPrefs({ tagFilter: [] })}
            >
              Clear
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
