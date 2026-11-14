import type { StorageAdapter } from './StorageAdapter';

const KEY = 'timeline-calendar:roadmap';

export function localStorageAdapter(storage: Storage = localStorage): StorageAdapter {
  return {
    load: async () => storage.getItem(KEY),
    save: async (json) => storage.setItem(KEY, json),
    backup: async (json) => storage.setItem(`${KEY}:backup:${new Date().toISOString()}`, json),
  };
}
