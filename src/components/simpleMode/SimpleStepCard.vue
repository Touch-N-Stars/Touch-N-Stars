<template>
  <section
    class="rounded-card border transition-colors"
    :class="
      current
        ? 'border-accent/60 bg-surface-1 shadow-lg shadow-accent/5'
        : 'border-line bg-surface-1/70'
    "
  >
    <!-- Header row: number/check, title, status. Tapping it opens or closes the step. -->
    <button
      type="button"
      class="w-full flex items-center gap-3 p-3 min-h-touch text-left"
      :aria-expanded="open"
      data-haptic="none"
      @click="manualOpen = !open"
    >
      <span
        class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
        :class="badgeClass"
      >
        <CheckIcon v-if="status === 'done'" class="w-5 h-5" />
        <ForwardIcon v-else-if="status === 'skipped'" class="w-4 h-4" />
        <Spinner v-else-if="status === 'running'" size="sm" />
        <span v-else>{{ number }}</span>
      </span>
      <span class="flex-1 min-w-0">
        <span class="block font-semibold text-content leading-tight">{{ title }}</span>
        <span v-if="summary" class="block text-xs text-content-muted truncate">{{ summary }}</span>
      </span>
      <span class="text-xs font-semibold shrink-0" :class="statusTextClass">
        {{ $t(`components.simpleMode.status.${status}`) }}
      </span>
      <ChevronDownIcon
        class="w-4 h-4 shrink-0 text-content-faint transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <div v-if="open" class="px-3 pb-3 flex flex-col gap-3">
      <p class="text-sm text-content-muted">{{ description }}</p>
      <slot />
      <!-- Hand marks for what the app cannot read from the devices -->
      <div v-if="markable || skippable" class="flex flex-wrap gap-2">
        <button
          v-if="markable && status !== 'done'"
          type="button"
          class="tns-btn-secondary w-auto! flex-1"
          @click="$emit('mark', 'done')"
        >
          <CheckIcon class="w-4 h-4" />
          {{ $t('components.simpleMode.markDone') }}
        </button>
        <button
          v-if="skippable && status !== 'skipped' && status !== 'done'"
          type="button"
          class="tns-btn-secondary w-auto! flex-1"
          @click="$emit('mark', 'skipped')"
        >
          <ForwardIcon class="w-4 h-4" />
          {{ $t('components.simpleMode.skip') }}
        </button>
        <button
          v-if="hasMark"
          type="button"
          class="tns-btn-ghost text-xs! px-2!"
          @click="$emit('mark', null)"
        >
          {{ $t('components.simpleMode.undoMark') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { CheckIcon, ChevronDownIcon, ForwardIcon } from '@heroicons/vue/24/outline';
import Spinner from '@/components/helpers/Spinner.vue';

const props = defineProps({
  number: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  // One short line next to the title, e.g. the live value of the step
  summary: { type: String, default: '' },
  status: {
    type: String,
    required: true,
    validator: (value) => ['done', 'running', 'open', 'skipped'].includes(value),
  },
  // The step the user should look at now: highlighted and opened
  current: { type: Boolean, default: false },
  markable: { type: Boolean, default: false },
  skippable: { type: Boolean, default: false },
  hasMark: { type: Boolean, default: false },
});

defineEmits(['mark']);

// null = follow `current`; a tap on the header overrides it until the current step moves on.
const manualOpen = ref(null);
const open = computed(() => manualOpen.value ?? (props.current || props.status === 'running'));
watch(
  () => props.current,
  () => {
    manualOpen.value = null;
  }
);

const badgeClass = computed(() => {
  switch (props.status) {
    case 'done':
      return 'bg-status-ok/20 text-status-ok';
    case 'running':
      return 'bg-accent/20 text-accent';
    case 'skipped':
      return 'bg-surface-3 text-content-faint';
    default:
      return props.current ? 'bg-accent-action text-white' : 'bg-surface-3 text-content-muted';
  }
});

const statusTextClass = computed(() => {
  switch (props.status) {
    case 'done':
      return 'text-status-ok';
    case 'running':
      return 'text-accent';
    case 'skipped':
      return 'text-content-faint';
    default:
      return 'text-content-muted';
  }
});
</script>
