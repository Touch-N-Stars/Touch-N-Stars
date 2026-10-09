<template>
  <!-- Port of the AAPA plugin's WebSocket server: a TNS-side setting, not one of
       the server's own settings. -->
  <label class="flex flex-col gap-1">
    <span class="text-sm text-content-muted">{{ $t('plugins.aapa.ws.port') }}</span>
    <input
      v-model.trim="draft"
      type="text"
      inputmode="numeric"
      class="tns-input"
      :class="{ 'border-status-danger!': invalid }"
      @blur="apply"
      @keydown.enter="$event.target.blur()"
    />
    <span v-if="invalid" class="text-xs text-status-danger">
      {{ $t('plugins.aapa.invalidValue') }}
    </span>
  </label>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useAapaStore } from '../store/aapaStore';

const store = useAapaStore();
const draft = ref(String(store.wsPort));
const invalid = ref(false);

watch(
  () => store.wsPort,
  (port) => (draft.value = String(port))
);

function apply() {
  if (draft.value === String(store.wsPort)) {
    invalid.value = false;
    return;
  }
  invalid.value = !store.setWsPort(draft.value);
}
</script>
