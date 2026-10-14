import { researchPlacesDirect } from '../../app/lib/ai/place-research';
import { cleanContext } from '../../app/lib/ai/planning';

/** AgentCore Lambda target receives arguments directly, not an API Gateway envelope. */
export async function handler(event: unknown, context: { clientContext?: { custom?: Record<string, string> } }) {
  const tool = context.clientContext?.custom?.bedrockAgentCoreToolName;
  if (tool !== 'travel___research_places') throw new Error('UNSUPPORTED_TOOL');
  const args = event as { destination?: unknown; queries?: unknown } | null;
  if (!args || typeof args.destination !== 'string' || !args.destination.trim() || args.destination.length > 120 ||
      !Array.isArray(args.queries) || args.queries.length > 3 ||
      args.queries.some(q => typeof q !== 'string' || !q.trim() || q.length > 150) ||
      Object.keys(args).some(k => !['destination', 'queries'].includes(k))) {
    throw new Error('INVALID_TOOL_ARGUMENTS');
  }
  return researchPlacesDirect(cleanContext({ destination: args.destination.trim(), interests: [] }), args.queries as string[]);
}
