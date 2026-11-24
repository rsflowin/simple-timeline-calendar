import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createTag, findTagByName } from '../../domain/doc';
import { newId } from '../../domain/id';
import type { Tag } from '../../domain/types';
import { useDoc, useRoadmap } from '../../store/roadmapStore';
import { TagChip } from '../TagChip';
import styles from './TagInput.module.css';

interface TagInputProps {
  /** Selected tag ids. */
  value: string[];
  onChange(ids: string[]): void;
  /** Id of the text input, for a `<label htmlFor>`. */
  id?: string;
}

type Option = { tag: Tag } | { create: string };

/** Notion-style tag picker (TAG-1 … TAG-4), an ARIA combobox. */
export function TagInput({ value, onChange, id }: TagInputProps) {
  const doc = useDoc();
  const commit = useRoadmap((s) => s.commit);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const [dragId, setDragId] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const focusId = useRef<string | null>(null);
  const sortable = value.length > 1;

  /** Moves a selected tag to index `to`; the first tag sets the task's colour. */
  const move = (tagId: string, to: number) => {
    const ids = value.filter((x) => x !== tagId);
    ids.splice(to, 0, tagId);
    onChange(ids);
  };

  // A keyboard move can re-insert the focused chip's node, which drops focus; put it back.
  useLayoutEffect(() => {
    if (!focusId.current) return;
    const chips = fieldRef.current?.querySelectorAll<HTMLElement>('[data-tag-id]') ?? [];
    [...chips].find((el) => el.dataset.tagId === focusId.current)?.focus();
    focusId.current = null;
  }, [value]);

  const query = text.trim();
  const options: Option[] = doc.tags
    .filter((t) => !value.includes(t.id) && t.name.toLowerCase().includes(query.toLowerCase()))
    .map((tag) => ({ tag }));
  if (query && !findTagByName(doc, query)) options.push({ create: query });
  const current = Math.min(active, options.length - 1); // -1 when there are no options
  const expanded = open && options.length > 0;
  const optionId = (i: number) => `${listId}-${i}`;

  const choose = (option: Option) => {
    let tagId: string;
    if ('tag' in option) {
      tagId = option.tag.id;
    } else {
      // Commit now: addTask/updateTask drop tag ids that aren't in the doc yet.
      tagId = newId();
      try {
        commit((d) => createTag(d, option.create, tagId));
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    onChange([...value, tagId]);
    setText('');
    setActive(0);
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME (e.g. Korean) owns the key
    if (e.key === 'Escape' && expanded) {
      e.preventDefault(); // close the list, not the surrounding dialog
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const n = options.length;
      if (n) setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); // don't submit the surrounding form; Ctrl/⌘+Enter still does
      if (expanded && current >= 0) choose(options[current]);
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={styles.root}>
      <div ref={fieldRef} className={styles.field}>
        {value.map((tagId, i) => {
          const tag = doc.tags.find((t) => t.id === tagId);
          return (
            tag && (
              <span
                key={tagId}
                data-tag-id={tagId}
                className={styles.chip}
                data-dragging={dragId === tagId || undefined}
                tabIndex={sortable ? 0 : undefined}
                // A plain span's aria-label is ignored; a group is announced and may hold the × button.
                role={sortable ? 'group' : undefined}
                aria-label={sortable ? `${tag.name}, ${i + 1} of ${value.length}` : undefined}
                title={
                  sortable
                    ? 'Drag or use ←/→ to reorder. The first tag sets the colour.'
                    : undefined
                }
                draggable={sortable}
                onDragStart={(e) => {
                  setDragId(tagId);
                  // Firefox won't drag without data; a custom type keeps it out of the text box.
                  e.dataTransfer?.setData('application/x-tag-id', tagId);
                }}
                onDragOver={(e) => {
                  if (dragId) e.preventDefault(); // allow dropping here
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) move(dragId, i);
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return; // not from the × button
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                  const to = e.key === 'ArrowLeft' ? i - 1 : i + 1;
                  if (to < 0 || to >= value.length) return;
                  e.preventDefault();
                  focusId.current = tagId;
                  move(tagId, to);
                }}
              >
                <TagChip tag={tag} onRemove={() => onChange(value.filter((x) => x !== tagId))} />
              </span>
            )
          );
        })}
        <input
          id={id}
          className={styles.input}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded && current >= 0 ? optionId(current) : undefined}
          autoComplete="off"
          placeholder={value.length ? '' : 'Add tags…'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </div>
      {expanded && (
        <ul id={listId} role="listbox" aria-label="Tags" className={styles.list}>
          {options.map((option, i) => (
            <li
              key={'tag' in option ? option.tag.id : 'create'}
              id={optionId(i)}
              role="option"
              aria-selected={i === current}
              className={styles.option}
              // Keep focus in the input so clicking an option doesn't close the list first.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(option)}
            >
              {'tag' in option ? <TagChip tag={option.tag} /> : `Create "${option.create}"`}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
