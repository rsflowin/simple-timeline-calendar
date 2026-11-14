import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { deleteTag, updateTag } from '../domain/doc';
import { LIMITS, TAG_COLORS, type Tag, type TagColor } from '../domain/types';
import { useDoc, useRoadmap } from '../store/roadmapStore';
import styles from './TagManager.module.css';

const colorName = (c: TagColor) => c[0].toUpperCase() + c.slice(1);

/** Tag manager dialog (TAG-5): rename, recolour, delete. Every change is one undo step. */
export function TagManager({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tags = useDoc().tags;

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Manage tags" onClose={onClose}>
      {open && (
        <div className={styles.body}>
          <h2 className={styles.heading}>Manage tags</h2>
          {tags.length === 0 ? (
            <p className={styles.muted}>No tags yet. Add them from a task&apos;s Tags field.</p>
          ) : (
            <ul className={styles.list}>
              {tags.map((t) => (
                <TagRow key={t.id} tag={t} />
              ))}
            </ul>
          )}
          <footer className={styles.footer}>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const commit = useRoadmap((s) => s.commit);
  // null = not being edited, so the input follows the doc (e.g. after undo)
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const rename = () => {
    if (draft === null) return;
    try {
      commit((d) => updateTag(d, tag.id, { name: draft }));
      setDraft(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') rename();
    if (e.key === 'Escape' && draft !== null) {
      e.preventDefault(); // revert only; don't also close the dialog
      e.stopPropagation();
      setDraft(null);
      setError(null);
    }
  };

  return (
    <li>
      <div className={styles.line}>
        <input
          aria-label={`Rename ${tag.name}`}
          maxLength={LIMITS.tagName}
          value={draft ?? tag.name}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={rename}
          onKeyDown={onKeyDown}
        />
        <div role="group" aria-label={`${tag.name} colour`} className={styles.swatches}>
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={colorName(c)}
              title={colorName(c)}
              aria-pressed={c === tag.color}
              className={styles.swatch}
              style={{ background: `var(--tag-${c}-bg)`, borderColor: `var(--tag-${c}-fg)` }}
              onClick={() => commit((d) => updateTag(d, tag.id, { color: c }))}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={`Delete ${tag.name}`}
          className={styles.delete}
          onClick={() => commit((d) => deleteTag(d, tag.id))}
        >
          Delete
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </li>
  );
}
