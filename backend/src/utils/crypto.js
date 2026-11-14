import { createHash } from 'node:crypto';

/**
 * Generates a SHA-256 hex digest of a value.
 * Used for content hashing, change detection, and idempotent revisions.
 *
 * @param {unknown} value
 * @returns {string} SHA-256 hex string
 */
export function fingerprint(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(serialized).digest('hex');
}
