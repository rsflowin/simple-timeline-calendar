import { useId, useState, type KeyboardEvent } from 'react';
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
      <div className={styles.field}>
        {value.map((tagId) => {
          const tag = doc.tags.find((t) => t.id === tagId);
          return (
            tag && (
              <TagChip
                key={tagId}
                tag={tag}
                onRemove={() => onChange(value.filter((x) => x !== tagId))}
              />
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
