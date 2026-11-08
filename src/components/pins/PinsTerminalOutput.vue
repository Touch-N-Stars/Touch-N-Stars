<template>
  <div class="border border-line rounded-card bg-ground overflow-hidden flex flex-col h-[500px]">
    <div class="bg-surface-1 px-4 py-2 border-b border-line flex justify-between items-center">
      <div class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-content-faint"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          ></path>
        </svg>
        <span class="text-xs text-content-muted font-mono font-semibold tracking-wide">
          {{ $t('plugins.pins.terminalOutput') }}
        </span>
      </div>
      <button
        @click="$emit('clear')"
        class="min-h-touch text-xs text-accent hover:text-content transition-colors hover:underline px-2 rounded-control"
      >
        {{ $t('plugins.pins.clearOutput') }}
      </button>
    </div>
    <div
      ref="terminalRef"
      class="flex-1 overflow-y-auto p-4 font-mono text-xs sm:text-sm space-y-1 scroll-smooth bg-ground select-text"
    >
      <div v-if="logs.length === 0" class="text-content-faint italic select-none">
        {{ $t('plugins.pins.waiting') }}
      </div>
      <div
        v-for="(log, index) in logs"
        :key="index"
        class="break-words whitespace-pre-wrap font-mono leading-relaxed"
        :class="getLogClass(log)"
      >
        <span class="text-content-faint select-none mr-2 text-[10px] align-middle">
          {{ new Date().toLocaleTimeString([], { hour12: false }) }}
        </span>
        <span class="mr-2 opacity-75">➜</span>
        <span v-html="formatLog(log)"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  logs: {
    type: Array,
    required: true,
  },
});

defineEmits(['clear']);

const terminalRef = ref(null);

watch(
  () => props.logs.length,
  () => {
    nextTick(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
      }
    });
  }
);

function getLogClass(log) {
  if (typeof log !== 'string') return 'text-content';
  const lower = log.toLowerCase();
  if (lower.includes('error') || lower.includes('fail')) return 'text-status-danger';
  if (lower.includes('warn')) return 'text-status-warn';
  if (lower.includes('success') || lower.includes('done') || lower.includes('complete')) {
    return 'text-status-ok';
  }
  if (lower.includes('info')) return 'text-accent';
  return 'text-content';
}

function formatLog(log) {
  if (typeof log === 'object') {
    try {
      return JSON.stringify(log, null, 2);
    } catch (e) {
      return String(log);
    }
  }
  return log;
}
</script>

<style scoped>
::-webkit-scrollbar {
  width: 10px;
}
::-webkit-scrollbar-track {
  background: #111827;
}
::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 5px;
  border: 2px solid #111827;
}
::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
</style>
