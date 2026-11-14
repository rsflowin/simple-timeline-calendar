import type { StorageAdapter } from './StorageAdapter';

export const ROADMAP_KEY = 'timeline-calendar:roadmap';

export function localStorageAdapter(storage: Storage = localStorage): StorageAdapter {
  return {
    load: async () => storage.getItem(ROADMAP_KEY),
    save: async (json) => storage.setItem(ROADMAP_KEY, json),
    backup: async (json) =>
      storage.setItem(`${ROADMAP_KEY}:backup:${new Date().toISOString()}`, json),
  };
}
