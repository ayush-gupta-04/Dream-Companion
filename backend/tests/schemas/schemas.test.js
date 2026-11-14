import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as schemas from '../../src/schemas/index.js';
import * as aiModuleSchemas from '../../src/modules/ai/askMatchSchemas.js';
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

    // Ask Match schemas
    assert.ok(schemas.askMatchRequestSchema);
    assert.ok(schemas.askIntentSchema);
    assert.ok(schemas.narrationSchema);

    // Analytics schemas
    assert.ok(schemas.overAnalysisQuerySchema);
    assert.ok(schemas.overAnalysisParamsSchema);
    assert.ok(schemas.overComparisonQuerySchema);

    // Recap schemas
    assert.ok(schemas.recapWindowTypes);
    assert.ok(schemas.recapToolTypes);
    assert.ok(schemas.sessionRequestSchema);
    assert.ok(schemas.recapRequestSchema);
    assert.ok(schemas.recapIntentSchema);
    assert.ok(schemas.recapNarrationSchema);

    // Delivery schemas
    assert.ok(schemas.extrasSchema);
    assert.ok(schemas.wicketSchema);
    assert.ok(schemas.normalizedDeliverySchema);
  });

  test('maintains backward compatibility via module re-exports', () => {
    assert.equal(aiModuleSchemas.askMatchRequestSchema, schemas.askMatchRequestSchema);
    assert.equal(analyticsModuleSchemas.overAnalysisQuerySchema, schemas.overAnalysisQuerySchema);
    assert.equal(summariesModuleSchemas.recapRequestSchema, schemas.recapRequestSchema);
    assert.equal(timelineModuleSchemas.timelineQuerySchema, schemas.timelineQuerySchema);
  });
});
