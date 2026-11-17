import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpChatClient, redactDiagnostics } from '../mcpChatService.js';

const token = 'fixture-token-'.repeat(4);
const session = 'a'.repeat(64);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('gateway transport uses explicit in-memory auth and a separate approval endpoint', async () => {
  const calls = [];
  const client = createMcpChatClient('http://fixture.local:4784', token, async (url, options) => {
    calls.push({ url: url.toString(), ...options });
    return json(
      url.pathname === '/session' && options.method === 'POST'
        ? { sessionId: session, tools: [], status: {} }
        : { kind: 'result' }
    );
  });
  await client.connect();
  await client.chat({ messages: [{ role: 'user', content: 'connect camera' }] });
  assert.equal(calls[1].url, 'http://fixture.local:4784/chat');
  assert.equal(calls.length, 2);
  await client.approve({
    requestId: 'preview',
    tool: 'connect_device',
    arguments: { device: 'camera', wait_seconds: 0 },
  });
  assert.equal(calls[2].url, 'http://fixture.local:4784/approve');
  assert.deepEqual(JSON.parse(calls[2].body), {
    requestId: 'preview',
    name: 'connect_device',
    arguments: { device: 'camera', wait_seconds: 0 },
  });
  assert.equal(calls[2].headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[2].headers['X-PINS-Chat-Session'], session);
  assert.equal(calls[2].credentials, 'omit');
  await client.close();
  await assert.rejects(client.tool('get_status', {}), /Connection closed/);
});

test('mutating requests are never automatically retried', async () => {
  let mutations = 0;
  const client = createMcpChatClient('http://fixture.local', token, async (url) => {
    if (url.pathname === '/session') return json({ sessionId: session, tools: [] });
    mutations++;
    return json({ error: 'state changed' }, 409);
  });
  await client.connect();
  await assert.rejects(
    client.approve({ requestId: 'p', tool: 'park_mount', arguments: {} }),
    /409/
  );
  assert.equal(mutations, 1);
  await client.close();
});

test('diagnostics redact nested credentials and token text', () => {
  const result = redactDiagnostics(
    { token, nested: { sessionId: session, error: `Bearer ${token}`, output: `prefix ${token}` } },
    [token, session]
  );
  assert.ok(!JSON.stringify(result).includes(token));
  assert.ok(!JSON.stringify(result).includes(session));
  assert.equal(result.nested.sessionId, '[redacted]');
});

test('gateway refuses embedded credentials and invalid session responses', async () => {
  assert.throws(() => createMcpChatClient('http://secret@fixture.local', token));
  assert.throws(() => createMcpChatClient('file:///tmp/gateway', token));
  const client = createMcpChatClient('http://fixture.local', token, async () =>
    json({ sessionId: 'short', tools: [] })
  );
  await assert.rejects(client.connect(), /Invalid operator session/);
  await client.close();
});

test('device-local connection omits bearer credential while retaining operator session', async () => {
  const calls = [];
  const client = createMcpChatClient('http://fixture.local:4784', '', async (url, options) => {
    calls.push(options);
    return json({ sessionId: session, tools: [] });
  });
  await client.connect();
  await client.tool('get_status', {});
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[1].headers['X-PINS-Chat-Session'], session);
  await client.close();
});
