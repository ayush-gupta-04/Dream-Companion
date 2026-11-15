import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from '../../src/modules/summaries/recapService.js';

test(
  'persists an authenticated viewer session marker for a match',
  { skip: process.env.RUN_DATABASE_TESTS !== 'true' },
  async () => {
    const { prisma } = await import('../../src/db/prisma.js');
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const match = await prisma.match.create({ data: { name: `Phase 5 test ${suffix}` } });

    try {
      const session = await join({
        matchId: match.id,
        viewer: { userId: 'user_persistence_test', sessionId: 'sess_persistence_test' }
      });
      const persisted = await prisma.matchSession.findUnique({ where: { id: session.id } });

      assert.equal(persisted.matchId, match.id);
      assert.equal(persisted.clerkUserId, 'user_persistence_test');
      assert.equal(persisted.clerkSessionId, 'sess_persistence_test');
      assert.equal(persisted.joinedInningsNumber, null);
      assert.equal(persisted.joinedDeliverySequence, null);
    } finally {
      await prisma.match.delete({ where: { id: match.id } });
      await prisma.$disconnect();
    }
  }
);
