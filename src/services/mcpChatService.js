// Dedicated plugin gateway transport: no daemon credentials and no persistence.
export function redactDiagnostics(value, secrets = []) {
  const sensitive = /^(authorization|token|apiKey|sessionId|requestId)$/i;
  const clean = (item) => {
    if (Array.isArray(item)) return item.map(clean);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item).map(([key, entry]) => [
          key,
          sensitive.test(key) ? '[redacted]' : clean(entry),
        ])
      );
    }
    if (typeof item !== 'string') return item;
    let text = item.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]');
    for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
    return text;
  };
  return clean(value);
}

export function createMcpChatClient(baseUrl, token, fetcher = globalThis.fetch) {
  const base = new URL(baseUrl);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('Invalid gateway URL');
  if (token && token.length < 32) throw new Error('Invalid gateway token');
  let session = '';
  let closed = false;
  const pending = new Set();
  async function request(path, body, { method = 'POST', timeout = 120000 } = {}) {
    if (closed) throw new Error('Connection closed');
    const controller = new AbortController();
    pending.add(controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher(new URL(path, base.origin), {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          ...(session ? { 'X-PINS-Chat-Session': session } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
      });
      const text = await response.text();
      if (text.length > 262144) throw new Error('Gateway response exceeds budget');
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`Gateway returned invalid JSON (HTTP ${response.status})`);
      }
      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${result.error || 'Gateway unavailable'}`);
      if (closed) throw new Error('Connection closed');
      return result;
    } catch (error) {
      throw new Error(redactDiagnostics(error.message, [token, session]), { cause: error });
    } finally {
      clearTimeout(timer);
      pending.delete(controller);
    }
  }
  return {
    async connect() {
      const result = await request('/session', {});
      if (
        typeof result.sessionId !== 'string' ||
        result.sessionId.length !== 64 ||
        !Array.isArray(result.tools)
      )
        throw new Error('Invalid operator session');
      session = result.sessionId;
      return { tools: result.tools, status: result.status, expires: result.expires };
    },
    chat: (body) => request('/chat', body),
    tool: (name, args) => request('/tool', { name, arguments: args }),
    approve: (preview) =>
      request('/approve', {
        requestId: preview.requestId,
        name: preview.tool,
        arguments: preview.arguments,
      }),
    reject: (preview) => request('/reject', { requestId: preview.requestId }),
    cancel: () => request('/cancel', {}, { timeout: 15000 }),
    clear: () => request('/clear', {}),
    status: () => request('/status', undefined, { method: 'GET', timeout: 15000 }),
    diagnostics: async () =>
      redactDiagnostics(
        await request('/diagnostics', undefined, { method: 'GET', timeout: 15000 }),
        [token, session]
      ),
    redact: (value) => redactDiagnostics(value, [token, session]),
    async close() {
      for (const controller of pending) controller.abort();
      try {
        if (session) await request('/session', undefined, { method: 'DELETE', timeout: 5000 });
      } finally {
        closed = true;
        session = '';
        token = '';
      }
    },
  };
}
