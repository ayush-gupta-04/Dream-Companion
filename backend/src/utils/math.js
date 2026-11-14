/**
 * Rounds a number to a fixed number of decimal places (default 2).
 *
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {number}
 */
export function round(value, decimals = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
