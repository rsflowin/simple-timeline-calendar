/**
 * crypto.randomUUID only exists in secure contexts. The Docker build opened via a LAN IP
 * (http://192.168.x.x:8080) is not one, so fall back to a random string there.
 */
export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
