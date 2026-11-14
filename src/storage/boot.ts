import { EMPTY_DOC } from '../domain/doc';
import { parseRoadmap, serializeRoadmap } from '../domain/schema';
import type { RoadmapDoc } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

/**
 * Never throws on bad data: it is backed up and the app starts empty with a sentence to show.
 * `unreadable` is the raw text when parsing failed, so the UI can offer it for download.
 * `backedUp` is false only when that text exists nowhere else: don't save over it yet (DATA-5).
 */
export async function loadRoadmap(adapter: StorageAdapter): Promise<{
  doc: RoadmapDoc;
  error: string | null;
  unreadable: string | null;
  backedUp: boolean;
}> {
  const raw = await adapter.load();
  if (raw === null) return { doc: EMPTY_DOC, error: null, unreadable: null, backedUp: true };
  try {
    return { doc: parseRoadmap(raw), error: null, unreadable: null, backedUp: true };
  } catch (e) {
    const reason = `Saved roadmap couldn't be read (${e instanceof Error ? e.message : String(e)})`;
    try {
      await adapter.backup(raw);
    } catch {
      // No backup: leave the original data in place rather than overwrite it.
      return {
        doc: EMPTY_DOC,
        error: `${reason} and no backup could be written. Export or download it before making changes; starting with an empty roadmap. Your changes aren't saved until you download the backup or choose Start fresh.`,
        unreadable: raw,
        backedUp: false,
      };
    }
    // Overwrite so the next start doesn't back it up again; failing here is harmless.
    try {
      await adapter.save(serializeRoadmap(EMPTY_DOC));
    } catch {
      // Already backed up.
    }
    return {
      doc: EMPTY_DOC,
      error: `${reason}. A backup copy was kept; starting with an empty roadmap.`,
      unreadable: raw,
      backedUp: true,
    };
  }
}
