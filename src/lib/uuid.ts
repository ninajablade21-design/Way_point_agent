/**
 * RFC 4122 v4 UUID. Uses crypto.randomUUID when available, but falls back for
 * non-secure contexts (e.g. opening the dev server over http://192.168.x.x on a phone),
 * where crypto.randomUUID is undefined and would otherwise crash the app.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
