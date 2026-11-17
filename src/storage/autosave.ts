import { serializeRoadmap } from '../domain/schema';
import { useRoadmap } from '../store/roadmapStore';
import type { StorageAdapter } from './StorageAdapter';

const flushers = new Set<() => void>();

/** Flushes any pending debounced save immediately (e.g. after importing a JSON file). */
export function flushAutosave() {
  for (const flush of flushers) flush();
}

/** Saves the document 300 ms after the last change, and immediately when the page is hidden. */
export function startAutosave(
  adapter: StorageAdapter,
  onError: (e: unknown) => void,
  delay = 300,
  onSaved?: () => void,
) {
  let doc = useRoadmap.getState().history.present;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (keepalive = false) => {
    clearTimeout(timer);
    timer = undefined;
    adapter.save(serializeRoadmap(doc), { keepalive }).then(() => onSaved?.(), onError);
  };
  const unsubscribe = useRoadmap.subscribe((s) => {
    if (s.history.present === doc) return;
    doc = s.history.present;
    clearTimeout(timer);
    timer = setTimeout(() => flush(false), delay);
  });
  const flushNow = () => {
    if (timer !== undefined) flush(false);
  };
  const flushOnHide = () => {
    if (timer !== undefined) flush(true);
  };
  const onVisibilityChange = () => {
    if (globalThis.document?.visibilityState === 'hidden') flushOnHide();
  };
  flushers.add(flushNow);
  // `?.` because the node test environment has no window or document.
  globalThis.addEventListener?.('pagehide', flushOnHide);
  globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    unsubscribe();
    flushers.delete(flushNow);
    clearTimeout(timer);
    globalThis.removeEventListener?.('pagehide', flushOnHide);
    globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
