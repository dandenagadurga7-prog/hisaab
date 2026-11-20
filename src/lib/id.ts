/** Collision-resistant prefixed identifiers. */

export type IdPrefix = 'cus' | 'txn' | 'shot';

let counter = 0;

function randomUUID(): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID().replace(/-/g, '');
  }
  // Fallback for browsers without crypto.randomUUID (older Safari).
  counter += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}${counter.toString(36)}${rand}`;
}

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${randomUUID()}`;
}

/** Deterministic 32-bit FNV-1a hash, hex encoded. Used for import de-duplication. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
