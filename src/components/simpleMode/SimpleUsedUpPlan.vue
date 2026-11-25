<template>
  <!-- The plan of an earlier night is still loaded, with nothing left to take -->
  <div class="flex flex-col gap-2 rounded-control border border-line p-3">
    <p class="text-sm text-content">
      {{ $t('components.simpleMode.steps.capture.nothingLeft') }}
    </p>
    <button
      type="button"
      class="tns-btn-secondary"
      :disabled="busy || disabled"
      @click="$emit('repeat')"
    >
      <Spinner v-if="busy" size="sm" />
      {{ $t('components.simpleMode.steps.capture.repeat') }}
    </button>
  </div>
</template>

<script setup>
import Spinner from '@/components/helpers/Spinner.vue';

defineProps({
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
defineEmits(['repeat']);
</script>
