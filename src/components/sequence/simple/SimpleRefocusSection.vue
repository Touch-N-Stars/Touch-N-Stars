<template>
  <!-- Simple mode only: how often the whole plan focuses again -->
  <div class="tns-card space-y-1">
    <div class="text-xs font-semibold uppercase tracking-wider text-content-faint">
      {{ $t('components.sequence.simple.refocus.title') }}
    </div>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.refocus.label')"
      :hint="$t('components.sequence.simple.refocus.hint')"
      :active="refocus.active"
      :disabled="refocus.running"
      :change="(on) => store.setRegularRefocus(on, DEFAULT_REFOCUS_MINUTES)"
    >
      <label for="simple-refocus" class="tns-label">
        {{ $t('components.sequence.simple.refocus.howOften') }}
      </label>
      <select
        id="simple-refocus"
        class="tns-select"
        :value="refocus.minutes"
        :disabled="saving || refocus.running"
        @change="changeMinutes(Number($event.target.value))"
      >
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </SimpleSwitchRow>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SimpleSwitchRow from './SimpleSwitchRow.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { DEFAULT_REFOCUS_MINUTES, REFOCUS_MINUTES, refocusInterval } from '@/utils/simpleMode';
import { AF_AFTER_TIME_TYPE, findByType } from '@/utils/sequenceSimple';

const props = defineProps({
  /** refocusState() of the plan */
  refocus: { type: Object, required: true },
});

const { t } = useI18n();
const store = useSequenceV2Store();
const saving = ref(false);

// A value from the full editor must not vanish from the list
const options = computed(() =>
  [...new Set([...REFOCUS_MINUTES, props.refocus.minutes ?? DEFAULT_REFOCUS_MINUTES])]
    .sort((a, b) => a - b)
    .map((value) => {
      const { unit, count } = refocusInterval(value);
      return {
        value,
        label: t(`components.sequence.simple.refocus.every.${unit}`, { count }, count),
      };
    })
);

async function changeMinutes(minutes) {
  const trigger = findByType(store.globalTriggers, AF_AFTER_TIME_TYPE);
  if (!trigger) return;
  saving.value = true;
  try {
    await store.setProperty(trigger.Id, 'Amount', minutes);
  } finally {
    saving.value = false;
  }
}
</script>
