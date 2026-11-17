// A continuation is another proposal, never an instruction to execute.
export function appendChatReply(messages, message, nextId) {
  messages.push(message);
  const next = message.response?.nextApproval;
  if (next?.kind === 'approval' && next.preview?.requestId) {
    messages.push({ id: nextId(), role: 'assistant', text: '', response: next });
  }
  if (messages.length > 24) messages.splice(0, messages.length - 24);
}

export function invalidateChatApprovals(messages) {
  for (const message of messages) {
    if (message.response?.kind === 'approval') {
      message.decided = true;
      message.invalidated = true;
    }
  }
}
