import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecapService } from '../../src/modules/summaries/recapService.js';

test(
  'persists an anonymous session marker for a match',
  { skip: process.env.RUN_DATABASE_TESTS !== 'true' },
  async () => {
    const { prisma } = await import('../../src/db/prisma.js');
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const match = await prisma.match.create({ data: { name: `Phase 5 test ${suffix}` } });
    const service = createRecapService({ prisma, aiClient: null });

    try {
      const session = await service.join({ matchId: match.id });
      const persisted = await prisma.matchSession.findUnique({ where: { id: session.id } });

      assert.equal(persisted.matchId, match.id);
      assert.equal(persisted.joinedInningsNumber, null);
      assert.equal(persisted.joinedDeliverySequence, null);
    } finally {
      await prisma.match.delete({ where: { id: match.id } });
      await prisma.$disconnect();
    }
  }
);
