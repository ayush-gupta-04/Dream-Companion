import { resolveRecapWindow } from './recapWindowResolver.js';

/**
 * Runs one allow-listed recap tool against already fetched, ordered delivery
 * facts. The LLM selects the tool and its bounded arguments; it never selects
 * deliveries itself.
 */
export function executeRecapTool({ tool, matchStatus, deliveries, session }) {
  const request = toWindowRequest({ tool, sessionId: session?.id });
  return resolveRecapWindow({ matchStatus, deliveries, request, session });
}

function toWindowRequest({ tool, sessionId }) {
  switch (tool.tool) {
    case 'LAST_N_MINUTES':
      return { window: tool.tool, minutes: tool.minutes };
    case 'LAST_N_OVERS':
      return { window: tool.tool, overs: tool.overs };
    case 'SINCE_SESSION_JOIN':
      return { window: tool.tool, sessionId };
    case 'WHOLE_MATCH':
    case 'LAST_OVER':
      return { window: tool.tool };
    default:
      throw new Error(`Unsupported recap tool: ${tool.tool}`);
  }
}
