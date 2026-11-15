import { ConflictError, type StorageAdapter } from './StorageAdapter';

/** Browser `keepalive` fetches fail above 64 KiB; stay safely below. */
const KEEPALIVE_MAX_CHARS = 60_000;

/**
 * Persists the roadmap to the app server's `/api/roadmap` endpoints.
 * `baseUrl` defaults to same-origin (`''`) and can point to a remote server URL
 * (e.g. from a Tauri client) when needed.
 */
export function httpStorageAdapter(baseUrl = ''): StorageAdapter {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/roadmap`;
  let revision: string | null = null;

  return {
    async load() {
      const res = await fetch(endpoint, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 204 || res.status === 404) {
        revision = null;
        return null;
      }
      if (!res.ok) throw new Error(`Failed to load roadmap (${res.status})`);
      revision = res.headers.get('etag');
      return res.text();
    },

    async save(json) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (revision !== null) headers['If-Match'] = revision;
      else headers['If-None-Match'] = '*';

      const res = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: json,
        keepalive: json.length <= KEEPALIVE_MAX_CHARS,
      });
      if (res.status === 409) throw new ConflictError();
      if (!res.ok) throw new Error(`Failed to save roadmap (${res.status})`);
      revision = res.headers.get('etag') ?? revision;
    },

    async backup(json) {
      const res = await fetch(`${endpoint}/backup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) throw new Error(`Failed to back up roadmap (${res.status})`);
    },
  };
}
