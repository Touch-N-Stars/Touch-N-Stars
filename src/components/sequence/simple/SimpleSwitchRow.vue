<template>
  <div class="space-y-2">
    <div class="min-h-touch flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-content">{{ label }}</div>
        <div v-if="hint" class="text-xs text-content-faint">{{ hint }}</div>
      </div>
      <ToggleButton
        :statusValue="active"
        :disabled="disabled || busy"
        @update:statusValue="toggle"
      />
    </div>
    <!-- Settings of the switched-on item -->
    <div v-if="active && $slots.default" class="pl-3 border-l-2 border-line space-y-2">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';

// `change` receives the new state and may return a promise; the switch stays disabled until
// it settles, so a double tap cannot add the same item twice.
const props = defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  change: { type: Function, required: true },
});

const busy = ref(false);

async function toggle(value) {
  busy.value = true;
  try {
    await props.change(value);
  } finally {
    busy.value = false;
  }
}
</script>
