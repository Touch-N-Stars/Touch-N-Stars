<template>
  <template v-for="f in editableFields" :key="f.key">
    <!-- Number -->
    <NumberInputPicker
      v-if="f.type === 'integer' || f.type === 'number'"
      :modelValue="f.value"
      :label="f.key"
      :labelKey="`generic-${item.Id}-${f.key}`"
      :min="-99999"
      :max="99999"
      :step="f.type === 'number' ? 0.1 : 1"
      :decimalPlaces="f.type === 'number' ? 2 : undefined"
      @change="save(f.key, $event)"
    />

    <!-- Boolean -->
    <div v-else-if="f.type === 'boolean'" class="seq-field-row">
      <label class="text-xs text-slate-400">{{ f.key }}</label>
      <button
        class="ml-auto px-3 py-1 rounded text-xs font-medium border transition-colors"
        :class="
          f.value
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
            : 'bg-slate-700/60 text-slate-400 border-slate-600 hover:bg-slate-700'
        "
        @click="save(f.key, !f.value)"
      >
        {{ f.value ? $t('components.sequence.items.on') : $t('components.sequence.items.off') }}
      </button>
    </div>

    <!-- Choice (enum or a string with a list of valid values) -->
    <div v-else-if="f.type === 'choice'" class="seq-field-row">
      <label class="text-xs text-slate-400 shrink-0">{{ f.key }}</label>
      <select
        class="tns-select ml-auto w-36 md:w-40 text-xs"
        :value="f.value"
        @change="save(f.key, $event.target.value)"
      >
        <option v-for="option in f.options" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>

    <!-- String -->
    <div v-else class="seq-field-row">
      <label class="text-xs text-slate-400 shrink-0">{{ f.key }}</label>
      <TextInput
        :modelValue="f.value"
        inputClass="ml-auto w-36 md:w-40 bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-xs text-gray-200"
        @change="save(f.key, $event)"
      />
    </div>
  </template>

  <!-- Values NINA owns (runtime state, complex plugin objects) are shown but not editable -->
  <div v-for="f in readOnlyFields" :key="f.key" class="seq-field-row">
    <label class="text-xs text-slate-400 shrink-0">{{ f.key }}</label>
    <span class="ml-auto min-w-0 truncate text-xs text-slate-500 select-text" :title="f.text">
      {{ f.text }}
    </span>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import TextInput from '@/components/helpers/TextInput.vue';
import { excludedKeys } from '@/utils/sequenceConfig';
import { useSequenceV2Store } from '@/store/sequenceV2Store';

const props = defineProps({
  item: { type: Object, required: true },
  save: { type: Function, required: true },
});

const store = useSequenceV2Store();

// Field metadata from the plugin (/sequence/fields); null = not available, guess from JSON
const fieldMeta = ref(null);
const metaLoaded = ref(false);

onMounted(async () => {
  fieldMeta.value = await store.fetchEditableFields(props.item.Id);
  metaLoaded.value = true;
});

const EDITABLE_TYPES = new Set(['integer', 'number', 'boolean', 'string', 'choice']);

// Fallback for plugins without /sequence/fields: derive the type from the JSON value
function guessFields() {
  return Object.entries(props.item)
    .filter(
      ([key, val]) => !excludedKeys.has(key) && ['number', 'boolean', 'string'].includes(typeof val)
    )
    .map(([key, val]) => ({
      key,
      value: val,
      type: typeof val === 'number' ? (Number.isInteger(val) ? 'integer' : 'number') : typeof val,
    }));
}

const editableFields = computed(() => {
  if (!metaLoaded.value) return [];
  if (!fieldMeta.value) return guessFields();
  return fieldMeta.value
    .filter(
      (f) =>
        !f.ReadOnly &&
        EDITABLE_TYPES.has(f.Type) &&
        !excludedKeys.has(f.Name) &&
        props.item[f.Name] !== undefined
    )
    .map((f) => ({
      key: f.Name,
      type: f.Type,
      value: f.Type === 'choice' ? String(props.item[f.Name] ?? '') : props.item[f.Name],
      options: f.Options ?? [],
    }));
});

const MAX_READONLY_TEXT = 120;

// The plugin caps long lists as { _truncated, Count, Items } - show the real size then.
function describe(val) {
  if (typeof val !== 'object') return String(val);
  if (Array.isArray(val)) return `[${val.length}]`;
  if (val._truncated) return `[${val.Count}]`;
  const text = JSON.stringify(val);
  return text.length > MAX_READONLY_TEXT ? `${text.slice(0, MAX_READONLY_TEXT)}…` : text;
}

const readOnlyFields = computed(() => {
  if (!metaLoaded.value) return [];
  const editable = new Set(editableFields.value.map((f) => f.key));
  return Object.entries(props.item)
    .filter(([key, val]) => {
      if (excludedKeys.has(key) || editable.has(key)) return false;
      if (val === null || val === undefined || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      // Without metadata every primitive is already offered as editable above
      return fieldMeta.value !== null || typeof val === 'object';
    })
    .map(([key, val]) => ({ key, text: describe(val) }));
});
</script>
