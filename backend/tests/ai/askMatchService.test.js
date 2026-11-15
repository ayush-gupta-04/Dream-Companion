import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { config } from '../../src/config/index.js';

let tools;
let narrate;
mock.module('../../src/modules/analytics/matchAnalyticsService.js', {
  exports: {
    analyzeOver: (request) => tools.analyzeOver(request),
    analyzePlayer: (request) => tools.analyzePlayer(request),
    compareOvers: (request) => tools.compareOvers(request)
  }
});
mock.module('../../src/modules/timeline/eventSearchService.js', {
  exports: { searchMatchEvents: (request) => tools.searchMatchEvents(request) }
});
mock.module('../../src/modules/ai/geminiMatchQueryClient.js', {
  exports: { narrateAnalysis: (request) => narrate(request) }
});
const { executeAnalysis } = await import('../../src/modules/ai/askMatchService.js');
config.gemini.apiKey = 'test-key';

const facts = {
  type: 'OVER_ANALYSIS',
  matchId: 'match-1',
  references: [{ deliveryId: 'delivery-1', deliverySequence: 1 }]
};

function analysisTool(overrides) {
  return {
    tool: 'OVER_ANALYSIS',
    inningsNumber: 1,
    overNumber: 0,
    comparisonOver1: null,
    comparisonOver2: null,
    playerId: null,
    eventTypes: null,
    minimumImportance: null,
    startSequence: null,
    endSequence: null,
    minutes: null,
    overs: null,
    ...overrides
  };
}

test('uses only allow-listed deterministic facts before analysis narration', async () => {
  narrate = async ({ query, facts: receivedFacts }) => {
    assert.equal(query, 'Analyse the first over');
    assert.equal(receivedFacts, facts);
    return 'The verified over produced four runs.';
  };
  tools = {
    analyzeOver: async () => facts,
    analyzePlayer: async () => assert.fail('Unexpected tool call'),
    compareOvers: async () => assert.fail('Unexpected tool call'),
    searchMatchEvents: async () => assert.fail('Unexpected tool call')
  };

  const result = await executeAnalysis({
    matchId: 'match-1',
    query: 'Analyse the first over',
    tool: analysisTool()
  });

  assert.equal(result.tool, 'OVER_ANALYSIS');
  assert.equal(result.answer, 'The verified over produced four runs.');
  assert.deepEqual(result.references, facts.references);
  assert.equal(result.facts, facts);
});

test('analyzes the last over when innings and over numbers are omitted', async () => {
  let analyzeOverRequest = null;
  narrate = async ({ query, facts: receivedFacts }) => {
    assert.equal(query, 'Analyse the last over');
    assert.equal(receivedFacts, facts);
    return 'The last completed over was quiet.';
  };
  tools = {
    analyzeOver: async (request) => {
      analyzeOverRequest = request;
      return facts;
    },
    analyzePlayer: async () => assert.fail('Unexpected tool call'),
    compareOvers: async () => assert.fail('Unexpected tool call'),
    searchMatchEvents: async () => assert.fail('Unexpected tool call')
  };

  const result = await executeAnalysis({
    matchId: 'match-1',
    query: 'Analyse the last over',
    tool: analysisTool({ inningsNumber: null, overNumber: null })
  });

  assert.equal(result.tool, 'OVER_ANALYSIS');
  assert.deepEqual(analyzeOverRequest, {
    matchId: 'match-1',
    inningsNumber: null,
    overNumber: null
  });
  assert.equal(result.answer, 'The last completed over was quiet.');
});

test('compares overs deterministically before narration', async () => {
  const comparisonFacts = {
    type: 'OVER_COMPARISON',
    references: [{ deliveryId: 'delivery-1', deliverySequence: 1 }]
  };
  narrate = async ({ facts: receivedFacts }) => {
    assert.equal(receivedFacts, comparisonFacts);
    return 'The verified figures differ.';
  };
  tools = {
    analyzeOver: async () => assert.fail('Unexpected tool call'),
    analyzePlayer: async () => assert.fail('Unexpected tool call'),
    compareOvers: async (request) => {
      assert.deepEqual(request, {
        matchId: 'match-1',
        inningsNumber: 1,
        over1: 0,
        over2: 9
      });
      return comparisonFacts;
    },
    searchMatchEvents: async () => assert.fail('Unexpected tool call')
  };

  const result = await executeAnalysis({
    matchId: 'match-1',
    query: 'Compare the first and tenth overs',
    tool: analysisTool({
      tool: 'OVER_COMPARISON',
      overNumber: null,
      comparisonOver1: 0,
      comparisonOver2: 9
    })
  });

  assert.equal(result.tool, 'OVER_COMPARISON');
  assert.equal(result.answer, 'The verified figures differ.');
  assert.equal(result.facts, comparisonFacts);
});

test('searches factual events deterministically before narration', async () => {
  const eventFacts = {
    type: 'EVENT_SEARCH',
    references: [{ eventId: 'event-1', deliveryId: 'delivery-1', deliverySequence: 1 }],
    nextCursor: 'event-26'
  };
  narrate = async ({ facts: receivedFacts }) => {
    assert.equal(receivedFacts, eventFacts);
    return 'The verified wickets are listed.';
  };
  tools = {
    analyzeOver: async () => assert.fail('Unexpected tool call'),
    analyzePlayer: async () => assert.fail('Unexpected tool call'),
    compareOvers: async () => assert.fail('Unexpected tool call'),
    searchMatchEvents: async (request) => {
      assert.deepEqual(request, {
        matchId: 'match-1',
        inningsNumber: 1,
        types: ['WICKET'],
        playerId: 'player-1',
        startSequence: undefined,
        endSequence: undefined,
        minimumImportance: 'MAJOR',
        limit: 25
      });
      return eventFacts;
    }
  };

  const result = await executeAnalysis({
    matchId: 'match-1',
    query: 'Show Player One wickets',
    tool: analysisTool({
      tool: 'EVENT_SEARCH',
      overNumber: null,
      playerId: 'player-1',
      eventTypes: ['WICKET'],
      minimumImportance: 'MAJOR'
    })
  });

  assert.equal(result.tool, 'EVENT_SEARCH');
  assert.equal(result.limitations.length, 1);
  assert.equal(result.answer, 'The verified wickets are listed.');
  assert.deepEqual(result.references, eventFacts.references);
});
