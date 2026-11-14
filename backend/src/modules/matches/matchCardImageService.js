const imageNames = Object.freeze(Array.from({ length: 12 }, (_, index) => `img${index + 1}.jpg`));

function stableHash(value) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

/**
 * Assigns a stable, decorative image from the bundled match-card artwork.
 * The match identifier, rather than its directory position, keeps the image
 * unchanged when match ordering or pagination changes.
 *
 * @param {string} matchId Persisted match identifier.
 * @returns {string} Public URL served by the backend.
 */
export function getMatchCardImageUrl(matchId) {
  const imageIndex = stableHash(matchId) % imageNames.length;
  return `/match-card-images/${imageNames[imageIndex]}`;
}
