<template>
  <ItemShell :item="item" :label="$t('components.sequence.items.generic')">
    <template v-if="editableFields.length || readOnlyFields.length" #editor="{ save }">
      <template v-for="f in editableFields" :key="f.key">
        <!-- Number -->
        <NumberInputPicker
          v-if="f.type === 'number'"
          :modelValue="f.value"
          :label="f.key"
          :labelKey="`generic-${item.Id}-${f.key}`"
          :min="-99999"
          :max="99999"
          :step="f.isFloat ? 0.1 : 1"
          :decimalPlaces="f.isFloat ? 1 : undefined"
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

      <!-- Complex values (plugin objects, lists) are shown but cannot be edited generically -->
      <div v-for="f in readOnlyFields" :key="f.key" class="seq-field-row">
        <label class="text-xs text-slate-400 shrink-0">{{ f.key }}</label>
        <span class="ml-auto min-w-0 truncate text-xs text-slate-500 select-text" :title="f.text">
          {{ f.text }}
        </span>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import TextInput from '@/components/helpers/TextInput.vue';
import { excludedKeys } from '@/utils/sequenceConfig';

const props = defineProps({
  item: { type: Object, required: true },
});

const editableFields = computed(() =>
  Object.entries(props.item)
    .filter(([key, val]) => {
      if (excludedKeys.has(key)) return false;
      const t = typeof val;
      return t === 'number' || t === 'boolean' || t === 'string';
    })
    .map(([key, val]) => ({
      key,
      value: val,
      type: typeof val,
      isFloat: typeof val === 'number' && val !== Math.round(val),
    }))
);

const MAX_READONLY_TEXT = 120;

// The plugin caps long lists as { _truncated, Count, Items } - show the real size then.
function describeComplex(val) {
  if (Array.isArray(val)) return `[${val.length}]`;
  if (val._truncated) return `[${val.Count}]`;
  const text = JSON.stringify(val);
  return text.length > MAX_READONLY_TEXT ? `${text.slice(0, MAX_READONLY_TEXT)}…` : text;
}

const readOnlyFields = computed(() =>
  Object.entries(props.item)
    .filter(([key, val]) => !excludedKeys.has(key) && val !== null && typeof val === 'object')
    .filter(([, val]) => !(Array.isArray(val) && val.length === 0))
    .map(([key, val]) => ({ key, text: describeComplex(val) }))
);
</script>
