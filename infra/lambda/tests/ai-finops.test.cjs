const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { transformSync } = require('../../../apps/web/node_modules/esbuild');
const root = path.resolve(__dirname, '../../..');
function harness(options = {}) {
  const records = [], logs = [], calls = [], cache = new Map();
  const rate = { inputUsdPerMillion: 1, outputUsdPerMillion: 5, cacheReadUsdPerMillion: 0.1, cacheWriteUsdPerMillion: 1.25,
    verifiedAt: new Date(Date.now() - 1000).toISOString(), source: 'https://example.com/test-rate-fixture' };
  const env = { AWS_REGION: 'eu-central-1', ENVIRONMENT: 'test', BEDROCK_MODEL_ID: 'model-v1', AI_FINOPS_METRICS_ENABLED: 'true',
    AI_MODEL_RATES_JSON: JSON.stringify({ 'eu-central-1|model-v1': rate }), ...options.env };
  function load(relative) {
    const file = path.resolve(root, relative); if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node22' }).code;
    vm.runInNewContext(code, { module: mod, exports: mod.exports, process: { env }, Buffer, AbortSignal, TextEncoder, Date,
      console: { log: x => { try { logs.push(JSON.parse(x)); } catch {} }, warn() {} },
      require(spec) {
        if (spec.endsWith('/ai-operations')) return { readAIControl: async () => ({}), chooseModel: (_control, requested) => requested || env.BEDROCK_MODEL_ID, recordAIOperation: async e => records.push(e) };
        if (spec === '@aws-sdk/client-bedrock-runtime') return { ConverseCommand: class { constructor(input) { this.input = input; } }, BedrockRuntimeClient: class { async send(command) {
          calls.push(command.input);
          if (options.send) return options.send(command.input);
          return { stopReason: 'end_turn', usage: { inputTokens: 1000, outputTokens: 500 }, output: { message: { content: [{ text: '{"ok":true}' }] } } };
        } } };
        if (spec.startsWith('node:')) return require(spec);
        if (spec.startsWith('.')) return load(path.resolve(path.dirname(file), spec + '.ts'));
        throw Error('Unexpected import ' + spec);
      },
    }, { filename: file }); return mod.exports;
  }
  const finops = load('infra/lambda/src/shared/ai-finops.ts');
  return { finops, env, records, logs, calls, load, rate };
}
const response = (mode = 'route', statusCode = 200) => ({ statusCode, body: JSON.stringify({ success: statusCode === 200, responseMode: mode }) });
test('Exact model/region rates count all token classes and reject unknown/stale pricing', () => {
  const h = harness(), usage = { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 1000, cacheWriteInputTokens: 500 };
  assert.equal(h.finops.estimateModelCost('model-v1', usage).estimatedModelCostUsd, 0.004225);
  assert.equal(h.finops.estimateModelCost('haiku', usage).pricingStatus, 'unconfigured');
  assert.equal(h.finops.estimateModelCost('model-v1', usage, { ...h.env, AWS_REGION: 'us-east-1' }).estimatedModelCostUsd, null);
  assert.equal(h.finops.estimateModelCost('model-v1', undefined).pricingStatus, 'usage_unknown');
  assert.equal(h.finops.estimateModelCost('model-v1', usage, h.env, Date.now() + 31 * 86400000).pricingStatus, 'stale');
  assert.equal(h.finops.estimateModelCost('model-v1', { ...usage, cacheDetails: [{ ttl: '1h', inputTokens: 500 }] }).estimatedModelCostUsd, null);
  assert.equal(h.finops.estimateModelCost('model-v1', { ...usage, outputTokens: -1 }).pricingStatus, 'usage_unknown');
});
test('Invalid rate configuration is visible rather than interpreted as free inference', () => {
  const h = harness({ env: { AI_MODEL_RATES_JSON: 'bad JSON' } });
  assert.equal(h.finops.estimateModelCost('model-v1', { inputTokens: 1, outputTokens: 2 }).pricingStatus, 'invalid');
});
test('Malformed model output still records consumed tokens and cost exactly once', async () => {
  const h = harness({ send: async () => ({ stopReason: 'end_turn', usage: { inputTokens: 1000, outputTokens: 500 }, output: { message: { content: [{ text: 'not JSON' }] } } }) });
  const result = await h.load('apps/web/app/lib/ai/bedrock-client.ts').invokeBedrockJSON('private prompt');
  assert.equal(result.success, false); assert.equal(h.records.length, 1);
  assert.equal(h.records[0].status, 'failed'); assert.equal(h.records[0].inputTokens, 1000);
  assert.equal(h.records[0].estimatedModelCostUsd, 0.0035);
  assert.equal(JSON.stringify([...h.records, ...h.logs]).includes('private prompt'), false);
});
test('Provider timeout is unpriced and cannot emit a zero-dollar plan', async () => {
  const h = harness({ send: async () => { throw Object.assign(Error('private provider detail'), { name: 'TimeoutError' }); } });
  await h.finops.withAIRequestMeter(async () => {
    h.finops.activateAIRequestMeter();
    await h.load('apps/web/app/lib/ai/bedrock-client.ts').invokeBedrockJSON('private prompt');
    return response();
  });
  assert.equal(h.records[0].estimatedModelCostUsd, null);
  const metric = h.logs.find(r => r.Requests === 1); assert.equal(metric.UnpricedRequests, 1); assert.equal(metric.PlanCostUsd, undefined);
  assert.equal(JSON.stringify(h.logs).includes('private provider detail'), false);
});
test('Parallel requests have isolated cost totals and no user or request ID dimensions', async () => {
  const h = harness();
  await Promise.all([1000, 2000].map(input => h.finops.withAIRequestMeter(async () => {
    h.finops.activateAIRequestMeter(); await new Promise(resolve => setTimeout(resolve, input === 1000 ? 5 : 1));
    h.finops.recordModelUsage('model-v1', 'answer', { inputTokens: input, outputTokens: 0 }, true, 3);
    return response();
  })));
  const plans = h.logs.filter(r => r.PlanCostUsd !== undefined);
  assert.deepEqual(plans.map(r => r.PlanCostUsd).sort(), [0.001, 0.002]);
  for (const event of h.logs) assert.equal(JSON.stringify(event._aws.CloudWatchMetrics[0].Dimensions).includes('Id'), false);
});
test('Work limits block provider calls before billing and count attempts within each request', async () => {
  const h = harness({ env: { AI_MAX_MODEL_CALLS_PER_REQUEST: '1' } });
  const client = h.load('apps/web/app/lib/ai/bedrock-client.ts');
  await h.finops.withAIRequestMeter(async () => {
    h.finops.activateAIRequestMeter();
    assert.equal((await client.invokeBedrockJSON('first')).success, true);
    assert.equal((await client.invokeBedrockJSON('second')).success, false);
    return response();
  });
  assert.equal(h.calls.length, 1); assert.equal(h.records[1].errorCode, 'AI_REQUEST_WORK_LIMIT');
  assert.equal(h.records[1].invoked, false);
  assert.equal(h.logs.find(r => r.Requests).PlanCostUsd, 0.0035);
  assert.equal((await client.invokeBedrockJSON('test', { maxTokens: 4201 })).success, false);
  assert.equal(h.calls.length, 1);
});
test('Total output reservations and input byte cap cannot be bypassed by retries', async () => {
  const h = harness({ env: { AI_MAX_REQUEST_OUTPUT_TOKENS: '5000' } });
  await h.finops.withAIRequestMeter(async () => {
    h.finops.reserveModelWork(3000, 100); assert.throws(() => h.finops.reserveModelWork(3000, 100), /AI_REQUEST_WORK_LIMIT/);
    return response();
  });
  assert.throws(() => h.finops.reserveModelWork(10, 65537), /AI_MODEL_WORK_LIMIT/);
});
test('Conservative input-token cap blocks oversized prompts before provider invocation', () => {
  const h = harness({ env: { AI_MAX_INPUT_TOKENS: '10' } });
  assert.equal(h.finops.estimateInputTokens(30), 10);
  assert.throws(() => h.finops.reserveModelWork(10, 31), /AI_MODEL_WORK_LIMIT/);
});
test('Only committed route responses produce PlanCostUsd; replays before activation do not', async () => {
  const h = harness();
  await h.finops.withAIRequestMeter(async () => response());
  assert.equal(h.logs.length, 0);
  await h.finops.withAIRequestMeter(async () => { h.finops.activateAIRequestMeter(); return response('chat'); });
  assert.equal(h.logs[0].CompletedPlans, 0); assert.equal(h.logs[0].PlanCostUsd, undefined);
  await h.finops.withAIRequestMeter(async () => { h.finops.activateAIRequestMeter(); return response('route', 503); });
  assert.equal(h.logs[1].RequestFailures, 1); assert.equal(h.logs[1].PlanCostUsd, undefined);
});
test('Application profile is selected for main-model accounting without changing admin model identity', async () => {
  const h = harness({ env: { BEDROCK_APPLICATION_PROFILE_ARN: 'arn:aws:bedrock:eu-central-1:123:application-inference-profile/answer' } });
  await h.load('apps/web/app/lib/ai/bedrock-client.ts').invokeBedrockJSON('test');
  assert.match(h.calls[0].modelId, /application-inference-profile/);
  assert.equal(h.records[0].pricingStatus, 'unconfigured');
});
test('UI cost summary does not double count requests, hides missing prices and divides by real plans', () => {
  const h = harness(), { summarizeAICost } = h.load('apps/web/app/lib/ai/finops-summary.ts');
  const summary = summarizeAICost([
    { kind: 'model', status: 'failed', estimatedModelCostUsd: 0.1, pricingStatus: 'priced' },
    { kind: 'model', status: 'succeeded' },
    { kind: 'request', status: 'succeeded', responseMode: 'route', estimatedModelCostUsd: 0.1, pricingStatus: 'priced' },
    { kind: 'request', status: 'succeeded', responseMode: 'route', estimatedModelCostUsd: null, pricingStatus: 'usage_unknown' },
  ]);
  assert.equal(summary.knownModelCostUsd, 0.1); assert.equal(summary.unpricedCalls, 1);
  assert.equal(summary.completedPlans, 2); assert.equal(summary.pricedPlans, 1); assert.equal(summary.averagePlanModelCostUsd, 0.1);
  assert.equal(summarizeAICost([]).averagePlanModelCostUsd, null);
});

const validIntake = { action: 'clarify', context: { interests: [], constraints: [], planningRequested: true }, destinationMention: '', daysMention: '', queries: [] };
test('economical intake is selected independently and malformed intake falls back once', async () => {
 for (const broken of [false,true]) {
  let count=0;
  const h=harness({env:{CUSTOM_MODEL_ENABLED:'true',BEDROCK_INTAKE_MODEL_ID:'cheap-intake'},send:async()=>({stopReason:'end_turn',usage:{inputTokens:100,outputTokens:50},output:{message:{content:[{text:JSON.stringify(++count===1&&broken?{action:'plan'}:validIntake)}]}}})});
  const result=await h.load('apps/web/app/lib/ai/bedrock-client.ts').invokeIntakeJSON('Gezi planla');
  assert.equal(result.success,true);assert.equal(h.calls[0].modelId,'cheap-intake');
  assert.equal(h.calls.length,broken?2:1);if(broken)assert.equal(h.calls[1].modelId,'model-v1');
 }
});
