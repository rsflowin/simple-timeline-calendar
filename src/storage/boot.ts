import { EMPTY_DOC } from '../domain/doc';
import { parseRoadmap } from '../domain/schema';
import type { RoadmapDoc } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

/** Never throws: unreadable data is backed up and the app starts empty with an error to show. */
export async function loadRoadmap(
  adapter: StorageAdapter,
): Promise<{ doc: RoadmapDoc; error: string | null }> {
  const raw = await adapter.load();
  if (raw === null) return { doc: EMPTY_DOC, error: null };
  try {
    return { doc: parseRoadmap(raw), error: null };
  } catch (e) {
    await adapter.backup(raw);
    return { doc: EMPTY_DOC, error: e instanceof Error ? e.message : String(e) };
  }
}
