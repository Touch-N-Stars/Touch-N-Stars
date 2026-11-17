<template>
  <Modal :show="show" maxWidth="max-w-md" @close="$emit('close')">
    <template #header>
      <span class="text-base font-semibold">
        {{ $t('components.framing.sequenceTargetPicker.title') }}
      </span>
    </template>

    <template #body>
      <div class="w-full space-y-3">
        <p class="text-xs text-content-faint">
          {{ $t('components.framing.sequenceTargetPicker.hint') }}
        </p>

        <div class="space-y-1.5">
          <button
            v-for="target in targets"
            :key="target.id"
            type="button"
            class="w-full min-h-touch flex items-center gap-3 px-3 py-2 rounded-control border text-left transition-colors"
            :class="rowClass(selection === target.id)"
            @click="selection = target.id"
          >
            <CheckCircleIcon
              class="w-5 h-5 shrink-0"
              :class="selection === target.id ? 'text-accent-action' : 'text-content-faint/40'"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-content">{{ target.name }}</span>
              <span
                v-if="target.raStr || target.decStr"
                class="block truncate text-xs font-mono text-content-faint"
              >
                {{ target.raStr }} {{ target.decStr }}
              </span>
            </span>
          </button>

          <button
            type="button"
            class="w-full min-h-touch flex items-center gap-3 px-3 py-2 rounded-control border text-left transition-colors"
            :class="rowClass(selection === NEW_TARGET)"
            @click="selection = NEW_TARGET"
          >
            <PlusCircleIcon
              class="w-5 h-5 shrink-0"
              :class="selection === NEW_TARGET ? 'text-accent-action' : 'text-content-faint/40'"
            />
            <span class="text-sm text-content">
              {{ $t('components.framing.sequenceTargetPicker.newTarget') }}
            </span>
          </button>
        </div>

        <div v-if="selection === NEW_TARGET && targets.length" class="space-y-1">
          <label class="block text-xs text-content-faint" for="sequence-target-template">
            {{ $t('components.framing.sequenceTargetPicker.template') }}
          </label>
          <select id="sequence-target-template" v-model="template" class="tns-select">
            <option v-for="target in targets" :key="target.id" :value="target.id">
              {{ $t('components.framing.sequenceTargetPicker.copyOf', { name: target.name }) }}
            </option>
            <option :value="EMPTY_TEMPLATE">
              {{ $t('components.framing.sequenceTargetPicker.emptyTarget') }}
            </option>
          </select>
        </div>

        <div
          v-if="selection === NEW_TARGET && targets.length && template === EMPTY_TEMPLATE"
          class="space-y-1"
        >
          <label class="block text-xs text-content-faint" for="sequence-target-position">
            {{ $t('components.framing.sequenceTargetPicker.position') }}
          </label>
          <select id="sequence-target-position" v-model="position" class="tns-select">
            <option :value="AT_END">
              {{ $t('components.framing.sequenceTargetPicker.positionEnd') }}
            </option>
            <option v-for="target in targets" :key="target.id" :value="target.id">
              {{
                $t('components.framing.sequenceTargetPicker.positionAfter', { name: target.name })
              }}
            </option>
          </select>
        </div>

        <div class="flex gap-2 pt-1">
          <button type="button" class="tns-btn-secondary" @click="$emit('close')">
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            class="tns-btn-primary"
            :disabled="selection === null"
            @click="confirm"
          >
            {{ $t('common.confirm') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { CheckCircleIcon, PlusCircleIcon } from '@heroicons/vue/24/outline';

const NEW_TARGET = '__new__';
const AT_END = '__end__';
const EMPTY_TEMPLATE = '__empty__';

const props = defineProps({
  show: Boolean,
  // [{ id, name, raStr, decStr }] in sequence order
  targets: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'confirm']);

const selection = ref(null);
const position = ref(AT_END);
// A new target is a copy of this one (with all its exposures), or EMPTY_TEMPLATE.
const template = ref(EMPTY_TEMPLATE);

// The dialog is kept mounted, so every opening starts from a clean selection instead of
// whatever the previous run left behind.
watch(
  () => props.show,
  (open) => {
    if (!open) return;
    selection.value = props.targets[0]?.id ?? NEW_TARGET;
    position.value = AT_END;
    // Copying the last target is what "next target, same exposures" needs most often.
    template.value = props.targets.at(-1)?.id ?? EMPTY_TEMPLATE;
  },
  { immediate: true }
);

function rowClass(active) {
  return active
    ? 'border-accent-action bg-surface-2'
    : 'border-line bg-surface-1 hover:bg-surface-2';
}

function confirm() {
  if (selection.value === null) return;
  if (selection.value !== NEW_TARGET) {
    emit('confirm', { mode: 'replace', id: selection.value });
    return;
  }
  // The plugin inserts a copy right behind its source, so there is no position to choose.
  if (template.value !== EMPTY_TEMPLATE && props.targets.some((t) => t.id === template.value)) {
    emit('confirm', { mode: 'copy', sourceId: template.value });
    return;
  }
  const afterId = position.value === AT_END ? (props.targets.at(-1)?.id ?? null) : position.value;
  emit('confirm', { mode: 'new', afterId });
}
</script>
