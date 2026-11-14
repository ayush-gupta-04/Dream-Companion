import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as schemas from '../../src/schemas/index.js';
import * as analyticsModuleSchemas from '../../src/modules/analytics/analyticsSchemas.js';
import * as summariesModuleSchemas from '../../src/modules/summaries/recapSchemas.js';
import * as timelineModuleSchemas from '../../src/modules/timeline/timelineSchemas.js';

describe('Centralized Schemas Directory', () => {
  test('exports all expected schemas from schemas/index.js', () => {
    // Timeline schemas
    assert.ok(schemas.timelineEventTypes);
    assert.ok(schemas.timelineEventTypeSchema);
    assert.ok(schemas.timelineImportanceLevels);
    assert.ok(schemas.timelineImportanceLevelSchema);
    assert.ok(schemas.timelineQuerySchema);
    assert.ok(schemas.eventSearchQuerySchema);

    // Shared natural-language match query schemas
    assert.ok(schemas.analysisToolTypes);
    assert.ok(schemas.matchQueryToolTypes);
    assert.ok(schemas.matchQueryRequestSchema);
    assert.ok(schemas.matchQueryToolSchema);
    assert.ok(schemas.analysisNarrationSchema);

    // Analytics schemas
    assert.ok(schemas.overAnalysisQuerySchema);
    assert.ok(schemas.overAnalysisParamsSchema);
    assert.ok(schemas.overComparisonQuerySchema);

    // Recap schemas
    assert.ok(schemas.recapWindowTypes);
    assert.ok(schemas.recapToolTypes);
    assert.ok(schemas.sessionRequestSchema);
    assert.ok(schemas.recapIntentSchema);
    assert.ok(schemas.recapNarrationSchema);

    // Delivery schemas
    assert.ok(schemas.extrasSchema);
    assert.ok(schemas.wicketSchema);
    assert.ok(schemas.normalizedDeliverySchema);
  });

  test('maintains backward compatibility via module re-exports', () => {
    assert.equal(analyticsModuleSchemas.overAnalysisQuerySchema, schemas.overAnalysisQuerySchema);
    assert.equal(summariesModuleSchemas.recapIntentSchema, schemas.recapIntentSchema);
    assert.equal(timelineModuleSchemas.timelineQuerySchema, schemas.timelineQuerySchema);
  });
});
