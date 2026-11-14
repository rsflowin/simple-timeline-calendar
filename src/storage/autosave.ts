import { serializeRoadmap } from '../domain/schema';
import { useRoadmap } from '../store/roadmapStore';
import type { StorageAdapter } from './StorageAdapter';

/** Saves the document 300 ms after the last change, and immediately when the page is hidden. */
export function startAutosave(adapter: StorageAdapter, onError: (e: unknown) => void, delay = 300) {
  let doc = useRoadmap.getState().history.present;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    adapter.save(serializeRoadmap(doc)).catch(onError);
  };
  const unsubscribe = useRoadmap.subscribe((s) => {
    if (s.history.present === doc) return;
    doc = s.history.present;
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });
  const onHide = () => {
    if (timer !== undefined) flush();
  };
  globalThis.addEventListener?.('pagehide', onHide);
  globalThis.document?.addEventListener('visibilitychange', onHide);

  return () => {
    unsubscribe();
    clearTimeout(timer);
    globalThis.removeEventListener?.('pagehide', onHide);
    globalThis.document?.removeEventListener('visibilitychange', onHide);
  };
}
