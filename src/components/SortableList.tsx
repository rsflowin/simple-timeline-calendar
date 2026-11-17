import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { startPointerDrag } from '../hooks/pointerDrag';
import styles from './SortableList.module.css';

export interface SortableListProps<T extends { id: string }> {
  items: readonly T[];
  label: string;
  itemLabel(item: T): string;
  onReorder(orderedIds: string[]): void;
  renderItem(item: T, handle: ReactNode): ReactNode;
  className?: string;
}

interface DragState {
  id: string;
  order: string[];
  pointerY: number;
  startY: number;
  startSlotY: number;
}

function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function reorderAtPointer(
  order: readonly string[],
  dragId: string,
  clientY: number,
  getRect: (id: string) => { top: number; height: number } | undefined,
): string[] | null {
  const curIdx = order.indexOf(dragId);
  if (curIdx === -1) return null;
  let nextIdx = curIdx;
  for (let i = 0; i < curIdx; i++) {
    const r = getRect(order[i]);
    if (r && r.height > 0 && clientY < r.top + r.height / 2) {
      nextIdx = i;
      break;
    }
  }
  if (nextIdx === curIdx) {
    for (let i = order.length - 1; i > curIdx; i--) {
      const r = getRect(order[i]);
      if (r && r.height > 0 && clientY > r.top + r.height / 2) {
        nextIdx = i;
        break;
      }
    }
  }
  return nextIdx === curIdx ? null : arrayMove(order, curIdx, nextIdx);
}

const sameIds = (a: readonly string[], b: readonly { id: string }[]) =>
  a.length === b.length && a.every((id, i) => id === b[i].id);

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <circle cx="4.5" cy="3" r="1.15" />
      <circle cx="9.5" cy="3" r="1.15" />
      <circle cx="4.5" cy="7" r="1.15" />
      <circle cx="9.5" cy="7" r="1.15" />
      <circle cx="4.5" cy="11" r="1.15" />
      <circle cx="9.5" cy="11" r="1.15" />
    </svg>
  );
}

/** Drag-and-drop (and Up/Down arrow key) reorderable list. */
export function SortableList<T extends { id: string }>({
  items,
  label,
  itemLabel,
  onReorder,
  renderItem,
  className,
}: SortableListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  });

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragSessionRef = useRef<{ cancel(): void; stop(): void } | null>(null);
  const justCancelledRef = useRef(false);
  const translatedElRef = useRef<HTMLLIElement | null>(null);
  const focusHandleIdRef = useRef<string | null>(null);

  useEffect(() => {
    const dialog = listRef.current?.closest('dialog');
    const onDialogCancel = (e: Event) => {
      if (dragSessionRef.current) {
        e.preventDefault();
        dragSessionRef.current.cancel();
      } else if (justCancelledRef.current) {
        e.preventDefault();
        justCancelledRef.current = false;
      }
    };
    dialog?.addEventListener('cancel', onDialogCancel);
    return () => {
      dialog?.removeEventListener('cancel', onDialogCancel);
      dragSessionRef.current?.stop();
      dragSessionRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (
      translatedElRef.current &&
      (!drag || itemRefs.current.get(drag.id) !== translatedElRef.current)
    ) {
      translatedElRef.current.style.transform = '';
      translatedElRef.current = null;
    }
    if (!drag) return;
    const rowEl = itemRefs.current.get(drag.id);
    if (!rowEl) return;
    const listEl = listRef.current;
    const currentSlotY = rowEl.offsetTop - (listEl?.scrollTop ?? 0);
    const dy = drag.pointerY - drag.startY - (currentSlotY - drag.startSlotY);
    rowEl.style.transform = `translateY(${dy}px)`;
    translatedElRef.current = rowEl;
  }, [drag]);

  useLayoutEffect(() => {
    const id = focusHandleIdRef.current;
    if (!id) return;
    focusHandleIdRef.current = null;
    handleRefs.current.get(id)?.focus({ preventScroll: true });
  }, [items]);

  const displayedItems = useMemo(() => {
    if (!drag) return items;
    const byId = new Map(items.map((x) => [x.id, x]));
    const ordered: T[] = [];
    const seen = new Set<string>();
    for (const id of drag.order) {
      const item = byId.get(id);
      if (item && !seen.has(id)) {
        seen.add(id);
        ordered.push(item);
      }
    }
    for (const item of items) {
      if (!seen.has(item.id)) ordered.push(item);
    }
    return ordered;
  }, [items, drag]);

  const startDrag = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0 || items.length < 2) return;
    const listEl = listRef.current;
    const rowEl = itemRefs.current.get(id);
    const startY = e.clientY;
    const startSlotY = (rowEl?.offsetTop ?? 0) - (listEl?.scrollTop ?? 0);
    let order = items.map((x) => x.id);

    const onMove = (_dx: number, _dy: number, ev: globalThis.PointerEvent) => {
      if (listEl && listEl.scrollHeight > listEl.clientHeight) {
        const lr = listEl.getBoundingClientRect();
        if (ev.clientY < lr.top + 24) listEl.scrollTop -= 8;
        else if (ev.clientY > lr.bottom - 24) listEl.scrollTop += 8;
      }
      const next = reorderAtPointer(order, id, ev.clientY, (itemId) =>
        itemRefs.current.get(itemId)?.getBoundingClientRect(),
      );
      if (next) order = next;
      setDrag({ id, order, pointerY: ev.clientY, startY, startSlotY });
    };

    const onEnd = (_dx: number, _dy: number, _ev: globalThis.PointerEvent, moved: boolean) => {
      dragSessionRef.current = null;
      setDrag(null);
      if (moved && !sameIds(order, itemsRef.current)) onReorder(order);
    };

    const onCancel = () => {
      dragSessionRef.current = null;
      justCancelledRef.current = true;
      setTimeout(() => {
        justCancelledRef.current = false;
      }, 0);
      setDrag(null);
    };

    const stop = startPointerDrag(e, { onMove, onEnd, onCancel });
    dragSessionRef.current = {
      stop,
      cancel: () => {
        stop();
        onCancel();
      },
    };
  };

  const onHandleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const idx = items.findIndex((x) => x.id === id);
    const nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    e.preventDefault();
    focusHandleIdRef.current = id;
    onReorder(
      arrayMove(
        items.map((x) => x.id),
        idx,
        nextIdx,
      ),
    );
  };

  const canReorder = items.length > 1;

  return (
    <ul
      ref={listRef}
      aria-label={label}
      data-dragging={drag ? 'true' : undefined}
      className={className ? `${styles.list} ${className}` : styles.list}
    >
      {displayedItems.map((item) => {
        const isDragging = drag?.id === item.id;
        const name = itemLabel(item);
        const handle = (
          <button
            ref={(el) => {
              if (el) handleRefs.current.set(item.id, el);
              else handleRefs.current.delete(item.id);
            }}
            type="button"
            aria-label={`Reorder ${name}`}
            title={canReorder ? 'Drag to reorder, or use Up/Down arrows' : undefined}
            disabled={!canReorder}
            className={styles.handle}
            onPointerDown={(e) => startDrag(e, item.id)}
            onKeyDown={(e) => onHandleKeyDown(e, item.id)}
          >
            <GripIcon />
          </button>
        );
        return (
          <li
            key={item.id}
            ref={(el) => {
              if (el) itemRefs.current.set(item.id, el);
              else itemRefs.current.delete(item.id);
            }}
            data-dragging={isDragging ? 'true' : undefined}
            className={isDragging ? `${styles.item} ${styles.dragging}` : styles.item}
          >
            {renderItem(item, handle)}
          </li>
        );
      })}
    </ul>
  );
}
