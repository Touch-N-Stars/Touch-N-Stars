import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendChatReply, invalidateChatApprovals } from '../mcpChatReplies.js';

test('completed result and next proposal remain separate without executing anything', () => {
  const next = { kind: 'approval', preview: { requestId: 'mount' } };
  const result = { id: 1, response: { kind: 'result', nextApproval: next } };
  const messages = [];
  appendChatReply(messages, result, () => 2);
  assert.equal(messages[0], result);
  assert.equal(messages[1].response, next);
  assert.equal(messages[1].decided, undefined);
});

test('stopped plan preserves result and warning without a new proposal', () => {
  const messages = [];
  appendChatReply(
    messages,
    { response: { kind: 'result', continuationError: 'stopped' } },
    () => 2
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].response.continuationError, 'stopped');
});

test('only complete approval continuations are appended and conversation is bounded', () => {
  const messages = Array.from({ length: 24 }, (_, id) => ({ id }));
  appendChatReply(messages, { id: 25, response: { nextApproval: { kind: 'result' } } }, () => 26);
  assert.equal(messages.length, 24);
  assert.equal(messages.at(-1).id, 25);
});

test('replacing a plan disables every older approval without changing completed results', () => {
  const messages = [{ response: { kind: 'approval' } }, { response: { kind: 'result' } }];
  invalidateChatApprovals(messages);
  assert.equal(messages[0].decided, true);
  assert.equal(messages[0].invalidated, true);
  assert.equal(messages[1].decided, undefined);
});
