import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Hash } from '@smithy/hash-node';

/** Only operator-configured AWS endpoints may receive signed credentials. */
export function gatewayEndpoint(value: string, region: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      url.pathname !== '/mcp' || !/^[a-z0-9-]+$/.test(region) ||
      !new RegExp(`^[a-z0-9-]+\\.gateway\\.bedrock-agentcore\\.${region}\\.amazonaws\\.com$`).test(url.hostname)) {
    throw new Error('INVALID_GATEWAY_ENDPOINT');
  }
  return url;
}

export function signedGatewayFetch(endpoint: URL, region: string, signal: AbortSignal): typeof fetch {
  const signer = new SignatureV4({ service: 'bedrock-agentcore', region,
    credentials: defaultProvider(), sha256: Hash.bind(null, 'sha256') });
  return async (input, init) => {
    const request = new Request(input, init);
    if (request.url !== endpoint.href) throw new Error('GATEWAY_ENDPOINT_CHANGED');
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
    const signed = await signer.sign(new HttpRequest({ protocol: endpoint.protocol,
      hostname: endpoint.hostname, path: endpoint.pathname, method: request.method,
      headers: { ...Object.fromEntries(request.headers), host: endpoint.hostname }, body }));
    const response = await fetch(endpoint, { method: request.method, headers: signed.headers, body,
      redirect: 'error', signal: AbortSignal.any([signal, request.signal]) });
    if (!response.body) return response;
    // Bound JSON and SSE alike before the MCP parser allocates the complete response.
    let bytes = 0;
    const limited = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > 256 * 1024) throw new Error('GATEWAY_RESPONSE_TOO_LARGE');
        controller.enqueue(chunk);
      },
    }));
    return new Response(limited, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

function buildDataToolClient(toolEnvKey: string, timeoutMs: number) {
  const region = process.env.AWS_REGION || 'eu-central-1';
  const endpoint = gatewayEndpoint(process.env.AGENTCORE_GATEWAY_URL || '', region);
  const rawTool = process.env[toolEnvKey] || '';
  if (!rawTool || !/^[A-Za-z0-9_-]+___[A-Za-z0-9_-]+$/.test(rawTool)) throw new Error('INVALID_GATEWAY_TOOL');
  const deadline = AbortSignal.timeout(timeoutMs);
  const client = new Client({ name: 'mapsbridge-data', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(endpoint, { fetch: signedGatewayFetch(endpoint, region, deadline) });
  return { client, transport, endpoint, rawTool, deadline };
}

async function callDataTool(toolEnvKey: string, args: Record<string, unknown>, timeoutMs = 6000): Promise<unknown | null> {
  const { client, transport, rawTool, deadline } = buildDataToolClient(toolEnvKey, timeoutMs);
  const started = Date.now();
  let succeeded = false;
  try {
    await client.connect(transport, { signal: deadline, timeout: timeoutMs });
    const result = await client.callTool({ name: rawTool, arguments: args }, undefined, { signal: deadline, timeout: timeoutMs });
    if (result.isError) return null;
    const text = Array.isArray(result.content) ? result.content.find(b => b.type === 'text')?.text : undefined;
    const data = result.structuredContent ?? (typeof text === 'string' ? JSON.parse(text) : undefined);
    if (!data || (data as any).unavailable) return null;
    succeeded = true;
    return data;
  } catch {
    return null;
  } finally {
    await client.close().catch(() => undefined);
    console.log(JSON.stringify({ metric: 'AgentCoreGatewayCall', tool: toolEnvKey, succeeded, durationMs: Date.now() - started }));
  }
}

export async function callFlightSearchTool(destination: string, origin?: string, currency?: string): Promise<unknown | null> {
  if (!process.env.AGENTCORE_FLIGHT_TOOL || !process.env.AGENTCORE_GATEWAY_URL) return null;
  return callDataTool('AGENTCORE_FLIGHT_TOOL', { destination, ...(origin ? { origin } : {}), ...(currency ? { currency } : {}) }, 5000);
}

export async function callAdvisoryTool(destination: string, countrySlug?: string): Promise<unknown | null> {
  if (!process.env.AGENTCORE_ADVISORY_TOOL || !process.env.AGENTCORE_GATEWAY_URL) return null;
  return callDataTool('AGENTCORE_ADVISORY_TOOL', { destination, ...(countrySlug ? { country_slug: countrySlug } : {}) }, 6000);
}

/** One read-only research call per plan; no tool discovery or model-driven fan-out. */
export async function callPlaceResearchTool(destination: string, queries: string[]): Promise<unknown> {
  const region = process.env.AWS_REGION || 'eu-central-1';
  const endpoint = gatewayEndpoint(process.env.AGENTCORE_GATEWAY_URL || '', region);
  const tool = process.env.AGENTCORE_PLACES_TOOL || 'travel___research_places';
  if (!/^[A-Za-z0-9_-]+___research_places$/.test(tool)) throw new Error('INVALID_GATEWAY_TOOL');
  const deadline = AbortSignal.timeout(8000);
  const client = new Client({ name: 'mapsbridge-places', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(endpoint, { fetch: signedGatewayFetch(endpoint, region, deadline) });
  const started = Date.now();
  let succeeded = false;
  try {
    await client.connect(transport, { signal: deadline, timeout: 8000 });
    const result = await client.callTool({ name: tool, arguments: { destination, queries } }, undefined,
      { signal: deadline, timeout: 8000 });
    if (result.isError) throw new Error('GATEWAY_TOOL_FAILED');
    const text = Array.isArray(result.content) ? result.content.find(block => block.type === 'text')?.text : undefined;
    const data = result.structuredContent ?? (typeof text === 'string' ? JSON.parse(text) : undefined);
    if (!data) throw new Error('GATEWAY_EMPTY_RESULT');
    succeeded = true;
    return data;
  } finally {
    await client.close().catch(() => undefined);
    console.log(JSON.stringify({ metric: 'AgentCoreGatewayCall', tool: 'research_places', succeeded, durationMs: Date.now() - started }));
  }
}
