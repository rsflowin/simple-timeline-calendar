import { EMPTY_DOC } from '../domain/doc';
import { parseRoadmap, serializeRoadmap } from '../domain/schema';
import type { RoadmapDoc } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

/**
 * Never throws on bad data: it is backed up and the app starts empty with an error to show.
 * `unreadable` is the raw text when parsing failed, so the UI can offer it for download.
 */
export async function loadRoadmap(
  adapter: StorageAdapter,
): Promise<{ doc: RoadmapDoc; error: string | null; unreadable: string | null }> {
  const raw = await adapter.load();
  if (raw === null) return { doc: EMPTY_DOC, error: null, unreadable: null };
  try {
    return { doc: parseRoadmap(raw), error: null, unreadable: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    try {
      await adapter.backup(raw);
    } catch {
      // No backup: leave the original data in place rather than overwrite it.
      return {
        doc: EMPTY_DOC,
        error: `${error} The backup could not be written.`,
        unreadable: raw,
      };
    }
    // Overwrite so the next start doesn't back it up again; failing here is harmless.
    try {
      await adapter.save(serializeRoadmap(EMPTY_DOC));
    } catch {
      // Already backed up.
    }
    return { doc: EMPTY_DOC, error, unreadable: raw };
  }
}
