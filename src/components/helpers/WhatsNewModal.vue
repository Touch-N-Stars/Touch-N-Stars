<template>
  <div
    ref="overlayElement"
    class="fixed inset-0 z-modal-raised flex items-center justify-center bg-black/60"
  >
    <div
      class="bg-surface-1 text-white w-full h-full sm:w-[min(720px,95vw)] sm:h-auto sm:max-h-[85vh] rounded-none sm:rounded-xl overflow-hidden shadow-2xl"
      role="dialog"
      aria-modal="true"
      :aria-label="data?.title || $t('whatsnew.title')"
    >
      <!-- Header -->
      <div
        class="sticky top-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-line bg-surface-1/95 backdrop-blur"
      >
        <h2 class="text-base sm:text-lg font-semibold truncate">
          {{ data?.title || $t('whatsnew.title') }}
        </h2>
        <button
          @click="$emit('close')"
          class="p-2 rounded-full hover:bg-surface-2 text-content hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-6 h-6"
          >
            <path
              fill-rule="evenodd"
              d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div
        class="p-4 overflow-y-auto max-h-[calc(100vh-8rem)] sm:max-h-[calc(85vh-3.25rem)] space-y-2"
      >
        <div v-if="data" class="prose prose-invert max-w-none">
          <!-- Render HTML from generator; it's sanitized/minimal from generator -->
          <div v-html="data.html"></div>
        </div>
        <div v-else class="text-content">
          {{ $t('whatsnew.loading') }}
        </div>
      </div>

      <!-- Footer -->
      <div
        class="sticky bottom-0 px-4 py-3 border-t border-line bg-surface-1/95 backdrop-blur flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between"
      >
        <div class="text-xs sm:text-sm text-content-muted" v-if="data?.date">{{ data.date }}</div>
        <div class="flex items-center gap-2">
          <button
            @click="$emit('close')"
            class="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-white text-sm"
          >
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useModalEscape } from '@/composables/useModalEscape';
defineProps({
  data: { type: Object, default: null },
});
const emit = defineEmits(['close']);

const overlayElement = ref(null);
useModalEscape(overlayElement, () => emit('close'));
</script>

<style scoped>
.prose :where(h2, h3) {
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
}
.prose :where(ul) {
  margin: 0.25rem 0 0.5rem 0;
}
.prose :where(li) {
  line-height: 1.4;
}
</style>
