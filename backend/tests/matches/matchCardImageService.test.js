import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMatchCardImageUrl } from '../../src/modules/matches/matchCardImageService.js';

test('match card images are stable and use only the bundled artwork URLs', () => {
  const firstUrl = getMatchCardImageUrl('match-123');

  assert.equal(firstUrl, getMatchCardImageUrl('match-123'));
  assert.match(firstUrl, /^\/match-card-images\/img(?:[1-9]|1[0-2])\.jpg$/);
});
