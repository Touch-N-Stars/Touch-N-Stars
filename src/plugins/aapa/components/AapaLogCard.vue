<template>
  <section class="tns-card space-y-2">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-content">{{ $t('plugins.aapa.log.title') }}</h2>
      <button
        class="tns-btn-secondary w-auto! px-3! text-xs!"
        :disabled="store.log.length === 0"
        @click="store.clearLog()"
      >
        {{ $t('plugins.aapa.log.clear') }}
      </button>
    </div>
    <div
      ref="scroller"
      class="h-80 overflow-y-auto rounded-chip bg-surface-2 p-2 font-mono text-xs text-content-muted select-text"
    >
      <p v-if="store.log.length === 0" class="text-content-faint">
        {{ $t('plugins.aapa.log.empty') }}
      </p>
      <p v-for="entry in store.log" :key="entry.id" class="whitespace-pre-wrap break-words">
        {{ entry.text }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useAapaStore } from '../store/aapaStore';

const store = useAapaStore();
const scroller = ref(null);

function scrollToEnd() {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  });
}

// Watch the newest id, not the length: the length stops changing once the ring buffer is full.
watch(() => store.log.at(-1)?.id, scrollToEnd);
onMounted(scrollToEnd);
</script>
