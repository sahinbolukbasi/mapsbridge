const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('../../../apps/web/node_modules/esbuild');

const sourceRoot = path.resolve(__dirname, '../src');
const env = {
  AWS_REGION: 'eu-central-1',
  COGNITO_USER_POOL_ID: 'eu-central-1_test',
  COGNITO_CLIENT_ID: 'test-client',
  DYNAMODB_TABLE: 'test-data',
  CONNECTIONS_TABLE: 'test-connections',
  MESSAGES_TABLE: 'test-data',
};
const cognitoUser = (sub = 'user-a') => ({
  UserAttributes: [{ Name: 'sub', Value: sub }],
});
const token = () => [
  { alg: 'RS256', typ: 'JWT' },
  { sub: 'user-a', iss: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test', client_id: 'test-client', token_use: 'access', exp: Math.floor(Date.now() / 1000) + 300 },
].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.signature';
const event = (method, route, accessToken, body) => ({
  routeKey: `${method} ${route}`,
  headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  requestContext: { http: { method, path: route }, requestId: 'test-request' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function harness(options = {}) {
  const calls = { data: [] };
  const cache = new Map();
  const commands = {};
  for (const name of ['QueryCommand', 'PutItemCommand', 'GetItemCommand', 'UpdateItemCommand', 'DeleteItemCommand', 'ScanCommand', 'TransactWriteItemsCommand']) {
    commands[name] = class { constructor(input) { this.name = name; this.input = input; } };
  }
  const external = {
    '@aws-sdk/client-cognito-identity-provider': {},
    '@aws-sdk/client-dynamodb': {
      ...commands,
      DynamoDBClient: class {
        async send(command) {
          calls.data.push(command);
          return options.data ? options.data(command) : { Items: [], Count: 0 };
        }
      },
    },
    '@aws-sdk/client-apigatewaymanagementapi': {
      ApiGatewayManagementApiClient: class { async send() {} },
      PostToConnectionCommand: class { constructor(i) { this.input = i; } },
    },
    '@aws-sdk/util-dynamodb': { marshall: v => v, unmarshall: v => v },
    '@aws-sdk/client-s3': {
      S3Client: class { async send() { return {}; } },
      PutObjectCommand: class { constructor(i) { this.input = i; } },
      GetObjectCommand: class { constructor(i) { this.input = i; } },
      ListObjectsV2Command: class { constructor(i) { this.input = i; } },
    },
    '@aws-sdk/client-bedrock-agentcore-control': {
      BedrockAgentCoreControlClient: class { async send() { return {}; } },
      GetGatewayCommand: class { constructor(i) { this.input = i; } },
      ListGatewayTargetsCommand: class { constructor(i) { this.input = i; } },
      GetMemoryCommand: class { constructor(i) { this.input = i; } },
    },
    '@aws-sdk/client-lambda': {
      LambdaClient: class { async send() { return { Payload: new TextEncoder().encode('{}') }; } },
      InvokeCommand: class { constructor(i) { this.input = i; } },
    },
    '@aws-sdk/client-cloudwatch': {
      CloudWatchClient: class { async send() { return { MetricDataResults: [] }; } },
      GetMetricDataCommand: class { constructor(i) { this.input = i; } },
    },
    '@aws-sdk/client-sqs': {
      SQSClient: class { async send() { return {}; } },
      GetQueueAttributesCommand: class { constructor(i) { this.input = i; } },
    },
    '@aws-sdk/client-bedrock': {
      BedrockClient: class { async send() { return { modelSummaries: [] }; } },
      ListFoundationModelsCommand: class { constructor(i) { this.input = i; } },
      GetFoundationModelCommand: class { constructor(i) { this.input = i; } },
    },
    redis: { createClient() { throw new Error('Unexpected Redis access'); } },
  };
  function load(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = transformSync(readFileSync(filename, 'utf8'), {
      loader: 'ts', format: 'cjs', target: 'node22', supported: { 'dynamic-import': false },
    }).code;
    vm.runInNewContext(code, {
      module, exports: module.exports, Buffer, AbortSignal,
      process: { env: { ...env, ...options.env } },
      crypto: require('node:crypto').webcrypto,
      console: { log() {}, warn() {}, error() {} },
      fetch: async (url, request) => {
        return options.fetch ? options.fetch(url, request) : { ok: true, json: async () => cognitoUser() };
      },
      require(specifier) {
        if (specifier.startsWith('.')) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
        if (external[specifier]) return external[specifier];
        throw new Error(`Unexpected dependency: ${specifier}`);
      },
    }, { filename });
    return module.exports;
  }
  return { load, calls };
}

test('GET /chat/threads returns 200 with an empty threads list', async () => {
  const h = harness();
  const result = await h.load('chat/index.ts').handler(event('GET', '/chat/threads', token()));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(Array.isArray(body.threads));
  const query = h.calls.data.find(c => c.name === 'QueryCommand');
  assert.ok(query);
  assert.equal(query.input.IndexName, 'GSI1');
  assert.equal(query.input.ExpressionAttributeValues[':pk'], 'THREAD#user-a');
});

test('POST /chat/threads returns 400 when participantId is missing', async () => {
  const h = harness();
  const result = await h.load('chat/index.ts').handler(event('POST', '/chat/threads', token(), {}));
  assert.equal(result.statusCode, 400);
  assert.equal(h.calls.data.filter(c => c.name === 'TransactWriteItemsCommand').length, 0);
});

test('POST /chat/threads creates thread with sorted participants and returns 201', async () => {
  const h = harness();
  const result = await h.load('chat/index.ts').handler(event('POST', '/chat/threads', token(), { participantId: 'user-z' }));
  assert.equal(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(typeof body.threadId === 'string' && body.threadId.length > 0);
  const tx = h.calls.data.find(c => c.name === 'TransactWriteItemsCommand');
  assert.ok(tx);
  const meta = tx.input.TransactItems.find(i => i.Put?.Item?.SK === 'META');
  assert.ok(meta);
  assert.equal(meta.Put.Item.createdBy, 'user-a');
  // participants are sorted alphabetically
  assert.equal(meta.Put.Item.participants.length, 2);
  assert.ok(meta.Put.Item.participants.includes('user-a'));
  assert.ok(meta.Put.Item.participants.includes('user-z'));
  assert.equal(meta.Put.Item.participants[0], 'user-a', 'participants must be sorted');
  assert.equal(meta.Put.Item.participants[1], 'user-z');
});

test('POST /chat/threads includes initial message in the transaction when provided', async () => {
  const h = harness();
  const result = await h.load('chat/index.ts').handler(event('POST', '/chat/threads', token(), { participantId: 'user-b', initialMessage: 'Merhaba!' }));
  assert.equal(result.statusCode, 201);
  const tx = h.calls.data.find(c => c.name === 'TransactWriteItemsCommand');
  assert.ok(tx);
  const msgPut = tx.input.TransactItems.find(i => i.Put?.Item?.PK?.startsWith('CHAT#'));
  assert.ok(msgPut, 'initial message item should be included in the transaction');
  assert.equal(msgPut.Put.Item.senderId, 'user-a');
  assert.equal(msgPut.Put.Item.content, 'Merhaba!');
});

test('POST /chat/threads/{id}/messages returns 400 for empty content', async () => {
  const h = harness({ data: () => ({ Item: { participants: ['user-a', 'user-b'] } }) });
  const result = await h.load('chat/index.ts').handler(event('POST', '/chat/threads/thread-1/messages', token(), { content: '   ' }));
  assert.equal(result.statusCode, 400);
  assert.equal(h.calls.data.filter(c => c.name === 'PutItemCommand').length, 0);
});

test('POST /chat/threads/{id}/messages returns 404 when user is not a participant', async () => {
  const h = harness({ data: () => ({ Item: { participants: ['user-b', 'user-c'] } }) });
  const result = await h.load('chat/index.ts').handler(event('POST', '/chat/threads/private-thread/messages', token(), { content: 'Hello' }));
  assert.equal(result.statusCode, 404);
  assert.equal(h.calls.data.filter(c => c.name === 'PutItemCommand').length, 0);
});

test('POST /chat/threads/{id}/messages returns 201 and persists message for verified participant', async () => {
  const h = harness({ data: command => {
    if (command.name === 'GetItemCommand') return { Item: { participants: ['user-a', 'user-b'] } };
    return {};
  }});
  const result = await h.load('chat/index.ts').handler(event('POST', '/chat/threads/shared-thread/messages', token(), { content: 'Hi there' }));
  assert.equal(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(typeof body.timestamp === 'string');
  const put = h.calls.data.find(c => c.name === 'PutItemCommand');
  assert.ok(put);
  assert.equal(put.input.Item.senderId, 'user-a');
  assert.equal(put.input.Item.content, 'Hi there');
  assert.ok(put.input.Item.PK.startsWith('CHAT#'));
  // thread metadata update should also be issued
  const update = h.calls.data.find(c => c.name === 'UpdateItemCommand');
  assert.ok(update);
  assert.ok(update.input.UpdateExpression.includes('lastMessageAt'));
});

test('GET /chat/threads/{id}/messages returns 404 when thread does not include caller', async () => {
  const h = harness({ data: () => ({ Item: { participants: ['user-b', 'user-c'] } }) });
  const result = await h.load('chat/index.ts').handler(event('GET', '/chat/threads/secret-thread/messages', token()));
  assert.equal(result.statusCode, 404);
});

test('GET /chat/threads/{id}/messages returns 200 with messages for a participant', async () => {
  const h = harness({ data: command => {
    if (command.name === 'GetItemCommand') return { Item: { participants: ['user-a', 'user-b'] } };
    if (command.name === 'QueryCommand') return { Items: [{ PK: 'CHAT#t1', SK: 'MSG#ts', senderId: 'user-b', content: 'Hey' }] };
    return {};
  }});
  const result = await h.load('chat/index.ts').handler(event('GET', '/chat/threads/my-thread/messages', token()));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(Array.isArray(body.messages));
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].senderId, 'user-b');
});
