<template>
  <label v-if="field.type === 'bool'" class="flex items-center justify-between gap-3 min-h-touch">
    <span class="text-sm text-content">{{ label }}</span>
    <input
      type="checkbox"
      class="w-6 h-6 accent-cyan-600 shrink-0"
      :checked="Boolean(serverValue)"
      :disabled="disabled"
      @change="commit($event.target.checked)"
    />
  </label>
  <label v-else class="flex flex-col gap-1">
    <span class="text-sm text-content-muted">{{ label }}</span>
    <input
      v-model="draft"
      type="text"
      :inputmode="field.type === 'double' ? 'decimal' : 'numeric'"
      class="tns-input"
      :class="{ 'border-status-danger!': invalid }"
      :disabled="disabled"
      @focus="editing = true"
      @blur="onBlur"
      @keydown.enter="$event.target.blur()"
    />
    <span v-if="invalid" class="text-xs text-status-danger">
      {{ $t('plugins.aapa.invalidValue') }}
    </span>
  </label>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useAapaStore } from '../store/aapaStore';
import { getSettingField } from '../utils/aapaProtocol';

const props = defineProps({
  settingKey: { type: String, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
});

const store = useAapaStore();
const field = computed(() => getSettingField(props.settingKey) ?? { type: 'double' });
const serverValue = computed(() => store.settings[props.settingKey]);

const draft = ref('');
const editing = ref(false);
const invalid = ref(false);

// Follow server broadcasts (e.g. a change made in NINA's own panel), but never
// overwrite what the user is typing.
watch(
  serverValue,
  (value) => {
    if (!editing.value) draft.value = value === null || value === undefined ? '' : String(value);
  },
  { immediate: true }
);

function commit(raw) {
  invalid.value = !store.setSetting(props.settingKey, raw);
}

function onBlur() {
  editing.value = false;
  if (draft.value === String(serverValue.value ?? '')) {
    invalid.value = false;
    return;
  }
  // On success the server echoes the saved value in its next state broadcast.
  commit(draft.value);
}
</script>
