import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createTag, deleteTag, reorderTags, updateTag } from '../domain/doc';
import { LIMITS, TAG_COLORS, type Tag, type TagColor } from '../domain/types';
import { flushAutosave } from '../storage/autosave';
import { useDoc, useRoadmap } from '../store/roadmapStore';
import { SortableList } from './SortableList';
import styles from './TagManager.module.css';

const colorName = (c: TagColor) => c[0].toUpperCase() + c.slice(1);

/** Tag manager dialog (TAG-5): add, rename, recolour, reorder, delete. Every change is one undo step. */
export function TagManager({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tags = useDoc().tags;
  const commit = useRoadmap((s) => s.commit);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    flushAutosave();
    onClose();
  };

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Manage tags" onClose={close}>
      {open && (
        <div className={styles.body}>
          <h2 className={styles.heading}>Manage tags</h2>
          {tags.length > 1 && (
            <p className={styles.hint}>
              Drag to reorder tags; determines row order in Dedicated display mode.
            </p>
          )}
          {tags.length === 0 ? (
            <p className={styles.muted}>No tags yet. Add one below.</p>
          ) : (
            <SortableList
              items={tags}
              label="Tags"
              itemLabel={(t) => t.name}
              className={styles.list}
              onReorder={(ids) => {
                commit((d) => reorderTags(d, ids));
                flushAutosave();
              }}
              renderItem={(t, handle) => <TagRow tag={t} handle={handle} />}
            />
          )}
          <AddTag />
          <footer className={styles.footer}>
            <button type="button" onClick={close}>
              Done
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}

function TagRow({ tag, handle }: { tag: Tag; handle: ReactNode }) {
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
    <>
      <div className={styles.line}>
        {handle}
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
    </>
  );
}

function AddTag() {
  const commit = useRoadmap((s) => s.commit);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          commit((d) => createTag(d, name));
          setName('');
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <div className={styles.line}>
        <input
          aria-label="New tag name"
          placeholder="New tag name"
          maxLength={LIMITS.tagName}
          value={name}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <button type="submit">Add</button>
      </div>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
