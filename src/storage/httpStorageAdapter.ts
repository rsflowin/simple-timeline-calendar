import { ConflictError, type SaveOptions, type StorageAdapter } from './StorageAdapter';

/** Browser `keepalive` fetches fail above 64 KiB (UTF-8 bytes); stay safely below. */
const KEEPALIVE_MAX_BYTES = 60_000;
const encoder = new TextEncoder();

/**
 * Persists the roadmap to the app server's `/api/roadmap` endpoints.
 * `baseUrl` defaults to same-origin (`''`) and can point to a remote server URL
 * (e.g. from a Tauri client) when needed.
 */
export function httpStorageAdapter(baseUrl = ''): StorageAdapter {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/roadmap`;
  let revision: string | null = null;
  let inFlight: Promise<void> | null = null;

  const sendSave = async (json: string, options?: SaveOptions) => {
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
      keepalive:
        Boolean(options?.keepalive) && encoder.encode(json).byteLength <= KEEPALIVE_MAX_BYTES,
    });
    // Consume the body to EOF so Chromium immediately releases any keepalive byte quota.
    await res.text().catch(() => {});
    if (res.status === 409) throw new ConflictError();
    if (!res.ok) throw new Error(`Failed to save roadmap (${res.status})`);
    revision = res.headers.get('etag') ?? revision;
  };

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

    save(json, options) {
      const prev = inFlight;
      const run = prev ? prev.then(() => sendSave(json, options)) : sendSave(json, options);
      const settled = run
        .then(
          () => {},
          () => {},
        )
        .finally(() => {
          if (inFlight === settled) inFlight = null;
        });
      inFlight = settled;
      return run;
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
