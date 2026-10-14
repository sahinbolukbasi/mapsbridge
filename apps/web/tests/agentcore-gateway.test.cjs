const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const endpoint = 'https://travel-123.gateway.bedrock-agentcore.eu-central-1.amazonaws.com/mcp';
const placeResult = { status: 'available', provider: 'Amazon Location', checkedAt: '2026-09-29T12:00:00Z',
  places: [{ id: 'p1', name: 'Museum', address: 'Rome', category: 'museum', lat: 41.9, lng: 12.5, checkedAt: '2026-09-29T12:00:00Z' }] };
function harness(options = {}) {
  const requests = [], geoCalls = [], cache = new Map();
  const env = { AWS_REGION: 'eu-central-1', PLACE_RESEARCH_ENABLED: 'true', AGENTCORE_GATEWAY_URL: endpoint, ...options.env };
  const mockFetch = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ url: String(url), ...init, parsed: body });
    if (options.fetch) return options.fetch(url, init, body);
    if (init.method === 'GET') return new Response(null, { status: 405 });
    if (!body?.id && body?.id !== 0) return new Response(null, { status: 202 });
    if (options.denied) return new Response('Access denied', { status: 403 });
    const result = body.method === 'initialize'
      ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'test-gateway', version: '1' } }
      : options.toolResult || { content: [{ type: 'text', text: JSON.stringify(placeResult) }] };
    const data = JSON.stringify({ jsonrpc: '2.0', id: body.id, result });
    if (options.sse) return new Response(`event: message\ndata: ${data}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
    return new Response(data, { headers: { 'content-type': 'application/json' } });
  };
  function load(file) {
    const filename = path.resolve(__dirname, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const customRequire = spec => {
      if (spec === '@aws-sdk/credential-provider-node') return { defaultProvider: () => async () => ({ accessKeyId: 'TESTKEY', secretAccessKey: 'testsecret', sessionToken: 'test-session-token' }) };
      if (spec === '@aws-sdk/client-geo-places') return { GeoPlacesClient: class { async send(c) { geoCalls.push(c); return {}; } }, GeocodeCommand: class { constructor(input) { this.input = input; } }, SearchTextCommand: class { constructor(input) { this.input = input; } } };
      if (spec.startsWith('.')) return load(path.resolve(path.dirname(filename), spec + '.ts'));
      return require(spec);
    };
    new Function('require', 'exports', 'module', 'process', 'fetch', code)(customRequire, module.exports, module, { env }, mockFetch);
    return module.exports;
  }
  return { load, requests, geoCalls };
}
const gatewayPath = '../app/lib/ai/agentcore-gateway.ts';
const placesPath = '../app/lib/ai/place-research.ts';
test('Gateway validates AWS region and endpoint before signing', () => {
  const { gatewayEndpoint } = harness().load(gatewayPath);
  assert.equal(gatewayEndpoint(endpoint, 'eu-central-1').href, endpoint);
  for (const bad of [endpoint.replace('https:', 'http:'), endpoint + '?x=y', endpoint.replace('/mcp', '/other'), endpoint.replace('amazonaws.com', 'amazonaws.com.evil.test'), endpoint.replace('eu-central-1', 'us-east-1'), endpoint.replace('https://', 'https://user:pass@')]) {
    assert.throws(() => gatewayEndpoint(bad, 'eu-central-1'));
  }
});
test('Real MCP handshake and tool call carry SigV4 session credentials and bounded arguments', async () => {
  const h = harness();
  assert.deepEqual(await h.load(gatewayPath).callPlaceResearchTool('Rome', ['museum']), placeResult);
  const calls = h.requests.filter(r => r.parsed?.method === 'tools/call');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].parsed.params.name, 'travel___research_places');
  assert.deepEqual(calls[0].parsed.params.arguments, { destination: 'Rome', queries: ['museum'] });
  for (const r of h.requests) {
    assert.match(r.headers.authorization, /AWS4-HMAC-SHA256/);
    assert.match(r.headers.authorization, /eu-central-1\/bedrock-agentcore\/aws4_request/);
    assert.equal(r.headers['x-amz-security-token'], 'test-session-token');
    assert.equal(r.redirect, 'error');
  }
});
test('MCP SSE and structured tool responses are accepted', async () => {
  const h = harness({ sse: true, toolResult: { content: [], structuredContent: placeResult } });
  assert.deepEqual(await h.load(gatewayPath).callPlaceResearchTool('Rome', ['museum']), placeResult);
});
test('Gateway denial fails closed without direct Places calls or tool retries', async () => {
  const h = harness({ denied: true });
  const result = await h.load(placesPath).researchPlaces({ destination: 'Rome', interests: [] }, ['museum']);
  assert.equal(result.status, 'unavailable');
  assert.equal(h.geoCalls.length, 0);
  assert.equal(h.requests.filter(r => r.parsed?.method === 'initialize').length, 1);
});
test('Tool errors and invalid coordinates cannot become route evidence', async () => {
  for (const toolResult of [ { isError: true, content: [{ type: 'text', text: 'denied' }] },
    { content: [], structuredContent: { ...placeResult, places: [{ ...placeResult.places[0], lat: 999 }] } },
    { content: [{ type: 'text', text: 'not JSON' }] } ]) {
    const h = harness({ toolResult });
    const result = await h.load(placesPath).researchPlaces({ destination: 'Rome', interests: [] }, ['museum']);
    assert.equal(result.status, 'unavailable');
    assert.equal(h.geoCalls.length, 0);
  }
});
test('Explicit false disables Places without network access', async () => {
  const h = harness({ env: { PLACE_RESEARCH_ENABLED: 'false' } });
  assert.equal((await h.load(placesPath).researchPlaces({ destination: 'Rome', interests: [] }, [])).status, 'unavailable');
  assert.equal(h.requests.length + h.geoCalls.length, 0);
});
test('Unconfigured Gateway retains direct research compatibility', async () => {
  const h = harness({ env: { AGENTCORE_GATEWAY_URL: '' } });
  await h.load(placesPath).researchPlaces({ destination: 'Rome', interests: [] }, []);
  assert.equal(h.geoCalls.length, 1); assert.equal(h.requests.length, 0);
});
test('Signed fetch rejects oversized output and unexpected destinations', async () => {
  const h = harness({ fetch: async () => new Response('x'.repeat(256 * 1024 + 1)) });
  const { signedGatewayFetch } = h.load(gatewayPath);
  const signed = signedGatewayFetch(new URL(endpoint), 'eu-central-1', AbortSignal.timeout(1000));
  await assert.rejects(() => signed('https://evil.test/mcp'), /ENDPOINT_CHANGED/);
  const response = await signed(endpoint, { method: 'POST', body: '{}' });
  await assert.rejects(() => response.text(), /RESPONSE_TOO_LARGE/);
});
test('Lambda tool rejects unknown tools, oversized arguments, and identity injection', async () => {
  const h = harness(), { handler } = h.load('../server/ai/gateway-handler.ts');
  const context = { clientContext: { custom: { bedrockAgentCoreToolName: 'travel___research_places' } } };
  await assert.rejects(() => handler({ destination: 'Rome', queries: [] }, {}), /UNSUPPORTED_TOOL/);
  for (const args of [{ destination: 'Rome', queries: [], userId: 'other' }, { destination: 'x'.repeat(121), queries: [] }, { destination: 'Rome', queries: ['a', 'b', 'c', 'd'] }]) {
    await assert.rejects(() => handler(args, context), /INVALID_TOOL_ARGUMENTS/);
  }
  assert.equal(h.geoCalls.length, 0);
  assert.equal((await handler({ destination: 'Rome', queries: ['museum'] }, context)).status, 'empty');
  assert.equal(h.geoCalls.length, 1); assert.equal(h.requests.length, 0);
});
test('Research sends at most three normalized queries and no personal context', async () => {
  const h = harness();
  await h.load(placesPath).researchPlaces({ destination: 'Rome', interests: [], userId: 'private', preferences: { budget: 'private' } }, ['museum', 'coffee', 'restaurant', 'park']);
  const args = h.requests.find(r => r.parsed?.method === 'tools/call').parsed.params.arguments;
  assert.deepEqual(Object.keys(args).sort(), ['destination', 'queries']);
  assert.equal(args.queries.length, 3);
});
test('Signed transport carries a shared deadline to cancel network work', async () => {
  const h = harness({ fetch: async (url, init) => {
    init.signal.throwIfAborted();
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  } });
  const controller = new AbortController();
  const signed = h.load(gatewayPath).signedGatewayFetch(new URL(endpoint), 'eu-central-1', controller.signal);
  const pending = signed(endpoint, { method: 'POST', body: '{}' });
  controller.abort(new Error('deadline'));
  await assert.rejects(() => pending, /deadline/);
});
