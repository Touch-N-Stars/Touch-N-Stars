<template>
  <main
    :inert="showStartWarning"
    :class="{ 'chat-connected': connected }"
    class="mx-auto flex max-w-4xl flex-col gap-3 p-4"
  >
    <header class="chat-heading flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('title') }}</h1>
        <p class="text-sm text-[var(--color-content-muted)]">{{ t('subtitle') }}</p>
      </div>
      <label v-if="!connected" class="flex min-h-touch cursor-pointer items-center gap-2 text-sm">
        <input v-model="debug" type="checkbox" /> {{ t('debug') }}
      </label>
    </header>

    <p
      v-if="error && !connected"
      role="alert"
      class="tns-card border border-red-400/50 max-h-24 shrink-0 overflow-y-auto p-3 text-sm"
    >
      {{ error }}
    </p>

    <section v-if="!connected" class="tns-card space-y-3 p-4">
      <template v-if="debug">
        <label class="block text-sm" for="mcp-gateway">{{ t('gateway') }}</label>
        <input
          id="mcp-gateway"
          v-model="endpoint"
          type="url"
          class="tns-input w-full"
          :disabled="busy"
        />
        <label class="block text-sm" for="mcp-token">{{ t('token') }}</label>
        <input
          id="mcp-token"
          v-model="token"
          type="password"
          autocomplete="off"
          class="tns-input w-full"
          :disabled="busy"
        />
      </template>
      <button
        ref="startButton"
        class="tns-btn-primary min-h-touch"
        :disabled="busy"
        @click="showStartWarning = true"
      >
        {{ busy ? t('working') : t('start') }}
      </button>
    </section>

    <template v-else>
      <section
        class="chat-model tns-card flex shrink-0 flex-wrap items-center justify-between gap-3 p-3"
      >
        <div class="min-w-0">
          <span class="text-sm font-medium">{{ t('local') }} · {{ model.state }}</span>
          <p class="chat-model-detail break-all text-xs text-[var(--color-content-muted)]">
            {{ model.modelId }}
          </p>
          <p v-if="model.modelId?.includes('diagnostic')" class="chat-model-detail mt-1 text-xs">
            {{ t('diagnosticModel') }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex min-h-touch cursor-pointer items-center gap-2 text-sm">
            <input v-model="debug" type="checkbox" /> {{ t('debug') }}
          </label>
          <button class="tns-btn-secondary w-auto! min-h-touch" @click="disconnect">
            {{ t('disconnect') }}
          </button>
        </div>
      </section>

      <div ref="conversation" class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        <section
          class="tns-card flex flex-col gap-4 p-3"
          role="log"
          aria-live="polite"
          :aria-label="t('conversation')"
        >
          <div v-if="!messages.length" class="my-auto space-y-3 text-center">
            <ChatBubbleLeftRightIcon class="mx-auto h-10 w-10 opacity-60" />
            <p>{{ t('welcome') }}</p>
            <button class="tns-btn-secondary min-h-touch" :disabled="busy" @click="statusShortcut">
              {{ t('statusPrompt') }}
            </button>
          </div>
          <article
            v-for="message in messages"
            :key="message.id"
            class="min-w-0 space-y-2 rounded-xl border border-[var(--color-line)] p-3"
            :class="message.role === 'user' ? 'ml-6' : 'mr-6'"
          >
            <div
              class="flex items-center justify-between gap-2 text-xs text-[var(--color-content-muted)]"
            >
              <span>{{ message.role === 'user' ? t('you') : t('assistant') }}</span>
              <span v-if="message.response?.kind === 'text'">{{ t('unverified') }}</span>
            </div>
            <p v-if="message.text" class="select-text whitespace-pre-wrap break-words text-sm">
              {{ message.text }}
            </p>
            <div v-if="message.response?.kind === 'approval'" class="space-y-3">
              <p class="font-medium">{{ t('reviewAction') }}</p>
              <p class="text-sm">{{ t('approvalHelp') }}</p>
              <pre class="max-h-48 overflow-auto rounded-lg bg-black/20 p-3 text-xs select-text">{{
                format({
                  tool: message.response.preview.tool,
                  arguments: message.response.preview.arguments,
                  remainingActions: message.response.remainingActions,
                })
              }}</pre>
              <p class="text-xs">
                {{ t('expires') }}
                {{ new Date(message.response.preview.expires).toLocaleTimeString() }}
              </p>
              <div v-if="!message.decided" class="flex flex-wrap gap-2">
                <button
                  class="tns-btn-primary w-auto! min-h-touch"
                  :disabled="busy || expired(message)"
                  @click="approve(message)"
                >
                  {{ t('approve') }}
                </button>
                <button
                  class="tns-btn-secondary w-auto! min-h-touch"
                  :disabled="busy"
                  @click="reject(message)"
                >
                  {{ t('reject') }}
                </button>
              </div>
              <p v-else-if="!message.invalidated" class="text-sm">{{ t('decisionRecorded') }}</p>
            </div>
            <div v-if="message.response?.kind === 'result'" class="space-y-2">
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="font-mono">{{ message.response.name }}</span>
                <span :class="message.response.result.isError ? 'text-red-400' : ''">{{
                  outcome(message.response.result)
                }}</span>
              </div>
              <p v-if="message.response.result.job" class="text-xs font-mono">
                {{ message.response.result.job.id }}
              </p>
              <McpDeviceStatus
                v-if="message.response.name === 'get_status'"
                :result="message.response.result"
              />
              <details class="text-sm">
                <summary class="min-h-touch cursor-pointer">{{ t('toolResult') }}</summary>
                <pre
                  class="max-h-64 overflow-auto rounded-lg bg-black/20 p-3 text-xs select-text"
                  >{{ format(message.response.result) }}</pre>
              </details>
            </div>
            <p
              v-if="message.response?.continuationError"
              role="alert"
              class="text-sm text-amber-400"
            >
              {{ t('planStopped') }}
            </p>
            <details v-if="debug && message.response?.generation" class="text-xs">
              <summary class="min-h-touch cursor-pointer">{{ t('modelOutput') }}</summary>
              <pre class="max-h-48 overflow-auto whitespace-pre-wrap select-text">{{
                format(message.response.generation)
              }}</pre>
            </details>
          </article>
          <p v-if="error" role="alert" class="max-h-24 overflow-y-auto text-sm text-red-400">
            {{ error }}
          </p>
          <div ref="bottom"></div>
        </section>

        <details class="tns-card space-y-3 p-4">
          <summary class="min-h-touch cursor-pointer font-medium">{{ t('toolBrowser') }}</summary>
          <p class="text-sm">{{ t('toolHelp') }}</p>
          <label class="sr-only" for="mcp-tool">{{ t('tool') }}</label>
          <select id="mcp-tool" v-model="manualTool" class="tns-select w-full" :disabled="busy">
            <option value="">{{ t('chooseTool') }}</option>
            <option v-for="tool in tools" :key="tool.name" :value="tool.name">
              {{ tool.name }}
            </option>
          </select>
          <p class="text-sm">{{ selectedTool?.description }}</p>
          <details v-if="selectedTool" class="text-sm">
            <summary class="min-h-touch cursor-pointer">{{ t('schema') }}</summary>
            <pre class="max-h-48 overflow-auto text-xs select-text">{{
              format(selectedTool.inputSchema)
            }}</pre>
          </details>
          <label class="block text-sm" for="mcp-arguments">{{ t('arguments') }}</label>
          <textarea
            id="mcp-arguments"
            v-model="manualArgs"
            rows="4"
            maxlength="8000"
            class="tns-input w-full font-mono text-sm"
            :disabled="busy"
          ></textarea>
          <button
            class="tns-btn-secondary min-h-touch"
            :disabled="busy || !manualTool"
            @click="runManual"
          >
            {{ t('reviewRequest') }}
          </button>
        </details>
        <section v-if="debug" class="tns-card space-y-3 p-4">
          <h2 class="font-medium">{{ t('debug') }}</h2>
          <p class="text-xs">{{ t('debugHelp') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              class="tns-btn-secondary w-auto! min-h-touch"
              :disabled="!connected || busy"
              @click="refreshDebug"
            >
              {{ t('refresh') }}
            </button>
            <button
              class="tns-btn-secondary w-auto! min-h-touch"
              :disabled="!diagnostics"
              @click="exportDebug"
            >
              {{ t('export') }}
            </button>
          </div>
          <pre
            v-if="diagnostics"
            class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs select-text"
            >{{ format(diagnostics) }}</pre>
        </section>
      </div>

      <form class="chat-composer tns-card shrink-0 space-y-3 p-3" @submit.prevent="send">
        <p v-if="thinking" role="status" aria-live="polite" class="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          ></span>
          {{ t('thinking') }}
        </p>
        <p v-else-if="busy" role="status" class="text-sm">{{ t('working') }}</p>
        <label class="sr-only" for="mcp-message">{{ t('message') }}</label>
        <textarea
          id="mcp-message"
          v-model="draft"
          rows="2"
          maxlength="2000"
          class="tns-input w-full resize-none"
          :placeholder="t('placeholder')"
          @keydown.ctrl.enter.prevent="send"
        ></textarea>
        <div class="flex gap-2">
          <button
            type="submit"
            class="tns-btn-primary min-h-touch"
            :disabled="busy || !draft.trim()"
          >
            {{ t('send') }}
          </button>
          <button
            v-if="busy"
            type="button"
            class="tns-btn-secondary w-auto! min-h-touch"
            @click="cancel"
          >
            {{ t('cancelInference') }}
          </button>
          <button v-else type="button" class="tns-btn-secondary w-auto! min-h-touch" @click="clear">
            {{ t('clear') }}
          </button>
        </div>
      </form>
    </template>

    <Modal :show="showStartWarning" :disable-close="true" max-width="max-w-lg" @close="cancelStart">
      <template #header>
        <h2 id="mcp-start-title" class="text-lg font-semibold">{{ t('experimentalTitle') }}</h2>
      </template>
      <template #body>
        <div
          ref="warningDialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mcp-start-title"
          aria-describedby="mcp-start-description"
          tabindex="-1"
          class="w-full space-y-4"
          @keydown="warningKeydown"
        >
          <p id="mcp-start-description">{{ t('experimentalWarning') }}</p>
          <div class="flex flex-wrap justify-end gap-3">
            <button class="tns-btn-secondary w-auto! min-h-touch" @click="cancelStart">
              {{ translate('common.cancel') }}
            </button>
            <button class="tns-btn-primary w-auto! min-h-touch" @click="acceptStart">
              {{ t('continue') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </main>
</template>

<script setup>
import McpDeviceStatus from '../components/McpDeviceStatus.vue';
import { appendChatReply, invalidateChatApprovals } from '@/utils/mcpChatReplies';
import Modal from '@/components/helpers/Modal.vue';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatBubbleLeftRightIcon } from '@heroicons/vue/24/outline';
import { useSettingsStore } from '@/store/settingsStore';
import { createMcpChatClient, redactDiagnostics } from '@/services/mcpChatService';
import { isAppBackgrounded, useBackgroundAwarePolling } from '@/utils/appLifecycle';

const { t: translate, locale } = useI18n();
const t = (key) => translate(`plugins.mcpChat.${key}`);
const settings = useSettingsStore();
const rig = computed(
  () =>
    `${settings.backendProtocol || 'http'}://${settings.connection.ip || window.location.hostname}`
);
const endpoint = ref(`${rig.value}:4784`);
const token = ref('');
const showStartWarning = ref(false);
const warningDialog = ref(null);
const startButton = ref(null);
watch(showStartWarning, async (visible) => {
  await nextTick();
  if (visible) warningDialog.value?.focus();
  else startButton.value?.focus();
});
function warningKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelStart();
    return;
  }
  if (event.key !== 'Tab') return;
  const buttons = warningDialog.value?.querySelectorAll('button:not(:disabled)');
  if (!buttons?.length) return;
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === warningDialog.value)
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === warningDialog.value)
  ) {
    event.preventDefault();
    first.focus();
  }
}
function cancelStart() {
  showStartWarning.value = false;
}
async function acceptStart() {
  showStartWarning.value = false;
  await connect();
}
const connected = ref(false);
const busy = ref(false);
const debug = ref(false);
const error = ref('');
const model = ref({});
const tools = ref([]);
const messages = ref([]);
const draft = ref('');
const manualTool = ref('');
const manualArgs = ref('{}');
const diagnostics = ref(null);
const bottom = ref(null);
const conversation = ref(null);
const thinking = ref(false);
let client;
let epoch = 0;
let sequence = 0;
let polling;
const clock = ref(Date.now());
const selectedTool = computed(() => tools.value.find((tool) => tool.name === manualTool.value));
const runningJobs = computed(() =>
  messages.value.filter((m) => m.response?.result?.requiresPolling)
);
const pollActive = computed(() => connected.value && !busy.value && runningJobs.value.length > 0);
const format = (value) =>
  JSON.stringify(client ? client.redact(value) : redactDiagnostics(value), null, 2);
const expired = (message) => new Date(message.response.preview.expires).getTime() <= clock.value;
const outcome = (result) =>
  result.isError ? t('failed') : result.job ? result.job.state : t('queryComplete');

async function perform(operation) {
  if (busy.value) return;
  const generation = epoch;
  busy.value = true;
  error.value = '';
  thinking.value = false;
  try {
    // Finish an in-flight job query before sending a single-use approval.
    if (polling) await polling;
    if (generation !== epoch) return;
    await operation(generation);
  } catch (failure) {
    if (generation === epoch)
      error.value = client
        ? client.redact(failure.message)
        : redactDiagnostics(failure.message, [token.value]);
  } finally {
    if (generation === epoch) {
      busy.value = false;
      await nextTick();
      scrollConversation();
    }
  }
}
function scrollConversation() {
  const panel = conversation.value;
  const anchor = bottom.value;
  if (!panel || !anchor) return;
  panel.scrollTo({
    top: Math.max(
      0,
      panel.scrollTop + anchor.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom
    ),
    behavior: 'smooth',
  });
}
function add(role, text, response) {
  appendChatReply(messages.value, { id: ++sequence, role, text, response }, () => ++sequence);
  void nextTick(scrollConversation);
}
async function connect() {
  await perform(async (generation) => {
    const candidate = createMcpChatClient(endpoint.value, token.value);
    client = candidate;
    let result;
    try {
      result = await candidate.connect();
    } catch (failure) {
      if (failure.message.includes('HTTP 401')) debug.value = true;
      await candidate.close().catch(() => {});
      throw failure;
    }
    if (generation !== epoch) return;
    tools.value = result.tools;
    model.value = result.status;
    connected.value = true;
    token.value = '';
  });
}
function disconnect() {
  showStartWarning.value = false;
  epoch++;
  const old = client;
  client = undefined;
  connected.value = false;
  busy.value = false;
  token.value = '';
  tools.value = [];
  messages.value = [];
  model.value = {};
  diagnostics.value = null;
  error.value = '';
  thinking.value = false;
  void old?.close().catch(() => {});
}
function invalidateApprovals() {
  invalidateChatApprovals(messages.value);
}
async function send() {
  if (!draft.value.trim() || !connected.value || busy.value) return;
  const text = draft.value.trim();
  draft.value = '';
  invalidateApprovals();
  add('user', text);
  await perform(async (generation) => {
    const history = messages.value
      .filter((m) => m.text && (!m.response || m.response.kind === 'text'))
      .slice(-7)
      .map(({ role, text: content }) => ({ role, content }));
    thinking.value = true;
    let response;
    try {
      response = await client.chat({ messages: history, locale: locale.value });
    } finally {
      if (generation === epoch) thinking.value = false;
    }
    if (generation !== epoch) return;
    add('assistant', response.kind === 'text' ? response.rawText : '', response);
  });
}
function statusShortcut() {
  if (!connected.value || busy.value) return;
  add('user', t('statusPrompt'));
  void perform(async (generation) => {
    const response = await client.tool('get_status', {});
    if (generation !== epoch) return;
    add('assistant', '', response);
  });
}
async function runManual() {
  await perform(async (generation) => {
    const args = JSON.parse(manualArgs.value);
    if (!args || Array.isArray(args) || typeof args !== 'object')
      throw new Error(t('invalidArguments'));
    if (selectedTool.value?.annotations?.readOnlyHint !== true) invalidateApprovals();
    const response = await client.tool(manualTool.value, args);
    if (generation === epoch) add('assistant', '', response);
  });
}
async function approve(message) {
  await perform(async (generation) => {
    message.decided = true;
    const response = await client.approve(message.response.preview);
    if (generation === epoch) add('assistant', '', response);
  });
}
async function reject(message) {
  await perform(async () => {
    message.decided = true;
    await client.reject(message.response.preview);
  });
}
async function cancel() {
  const activeClient = client;
  const generation = epoch;
  if (!activeClient) return;
  try {
    await activeClient.cancel();
    if (generation === epoch) invalidateApprovals();
  } catch (failure) {
    if (generation === epoch) error.value = activeClient.redact(failure.message);
  }
}
async function clear() {
  await perform(async (generation) => {
    await client.clear();
    if (generation === epoch) messages.value = [];
  });
}
async function refreshDebug() {
  await perform(async (generation) => {
    const data = await client.diagnostics();
    if (generation === epoch) {
      diagnostics.value = data;
      model.value = data.model;
    }
  });
}
function exportDebug() {
  const data = format({
    exportedAt: new Date().toISOString(),
    diagnostics: diagnostics.value,
    conversation: messages.value,
  });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pins-ai-debug.json';
  link.click();
  URL.revokeObjectURL(url);
}
useBackgroundAwarePolling(
  async () => {
    const generation = epoch;
    polling = (async () => {
      for (const message of runningJobs.value.slice(0, 4)) {
        if (busy.value || generation !== epoch) break;
        try {
          const response = await client.tool('get_job', {
            job_id: message.response.result.job.id,
            wait_seconds: 0,
          });
          if (generation === epoch) {
            message.response = { ...response, name: message.response.name };
            if (response.nextApproval) add('assistant', '', response.nextApproval);
          }
        } catch (failure) {
          if (generation === epoch) error.value = client.redact(failure.message);
          break;
        }
      }
    })();
    try {
      await polling;
    } finally {
      polling = undefined;
    }
  },
  3000,
  pollActive
);
useBackgroundAwarePolling(
  async () => {
    const generation = epoch;
    try {
      const status = await client.status();
      if (generation === epoch) model.value = status.model;
    } catch (failure) {
      if (generation === epoch) error.value = client.redact(failure.message);
    }
  },
  5000,
  computed(() => connected.value && !busy.value)
);
useBackgroundAwarePolling(
  () => {
    clock.value = Date.now();
  },
  1000,
  computed(
    () =>
      connected.value && messages.value.some((m) => m.response?.kind === 'approval' && !m.decided)
  )
);
watch(rig, () => {
  disconnect();
  endpoint.value = `${rig.value}:4784`;
});
watch(isAppBackgrounded, (backgrounded) => {
  if (backgrounded && busy.value) void cancel();
});
watch(manualTool, () => {
  manualArgs.value = '{}';
});
onUnmounted(disconnect);
</script>

<style scoped>
.chat-connected {
  height: calc(
    100dvh - 82px - var(--subnav-offset, 0px) - var(--statusbar-height, 48px) -
      env(safe-area-inset-bottom, 0px) - var(--stage-inset, 8px) - 32px
  );
}
@media (orientation: landscape) {
  .chat-connected {
    height: calc(
      100dvh - var(--subnav-offset, 0px) - var(--statusbar-height, 48px) -
        env(safe-area-inset-bottom, 0px) - 2 * var(--stage-inset, 8px) - 32px
    );
  }
}
@media (max-height: 600px) {
  .chat-connected {
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .chat-connected .chat-heading {
    display: none;
  }
  .chat-model-detail {
    display: none;
  }
  .chat-model,
  .chat-composer {
    padding: 0.5rem;
  }
  .chat-composer textarea {
    height: 48px;
  }
}
</style>
