<template>
  <section class="tns-card flex flex-col gap-3">
    <h3 class="text-base font-semibold text-content">
      {{ t('plugins.livestack.rgb.title') }}
    </h3>

    <p v-if="!store.rgbCandidates.length" class="text-sm text-content-muted">
      {{ t('plugins.livestack.rgb.no_targets') }}
    </p>

    <template v-else>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-content" for="rgb_target">
          {{ t('plugins.livestack.rgb.target') }}
        </label>
        <select id="rgb_target" v-model="selectedTarget" class="tns-select w-full text-sm">
          <option
            v-for="candidate in store.rgbCandidates"
            :key="candidate.Target"
            :value="candidate.Target"
          >
            {{ candidate.Target }}
          </option>
        </select>
      </div>

      <template v-if="selectedCandidate">
        <div v-for="channel in channels" :key="channel.key" class="flex flex-col gap-1">
          <label class="text-sm font-medium text-content" :for="`rgb_${channel.key}`">
            {{ t(channel.label) }}
          </label>
          <select
            :id="`rgb_${channel.key}`"
            v-model="channelSelection[channel.key]"
            class="tns-select w-full text-sm"
          >
            <option v-for="filter in selectedCandidate.Filters" :key="filter" :value="filter">
              {{ filter }}
            </option>
          </select>
        </div>

        <p v-if="store.rgbError" class="text-xs text-red-400 break-words">
          {{ store.rgbError }}
        </p>

        <div class="flex flex-row gap-2">
          <button
            class="tns-btn-primary flex-1"
            :disabled="store.rgbBusy || !isSelectionComplete"
            @click="onCreate"
          >
            {{
              store.rgbBusy ? t('plugins.livestack.rgb.working') : t('plugins.livestack.rgb.create')
            }}
          </button>
          <button
            v-if="selectedCandidate.HasRgb"
            class="tns-btn-danger flex-1"
            :disabled="store.rgbBusy"
            @click="onDelete"
          >
            {{ t('plugins.livestack.rgb.remove') }}
          </button>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLivestackStore } from '../store/livestackStore.js';

// RGB combination. Only on PINS - on Windows NINA the livestack plugin provides its own WPF
// wizard for this.
const store = useLivestackStore();
const { t } = useI18n();

const channels = [
  { key: 'red', label: 'plugins.livestack.rgb.red' },
  { key: 'green', label: 'plugins.livestack.rgb.green' },
  { key: 'blue', label: 'plugins.livestack.rgb.blue' },
];

const selectedTarget = ref(null);
const channelSelection = ref({ red: null, green: null, blue: null });

const selectedCandidate = computed(() =>
  store.rgbCandidates.find((candidate) => candidate.Target === selectedTarget.value)
);

const isSelectionComplete = computed(
  () => channelSelection.value.red && channelSelection.value.green && channelSelection.value.blue
);

function applySuggestion(candidate) {
  channelSelection.value = {
    red: candidate?.SuggestedRed ?? null,
    green: candidate?.SuggestedGreen ?? null,
    blue: candidate?.SuggestedBlue ?? null,
  };
}

watch(selectedCandidate, (candidate) => {
  applySuggestion(candidate);
  // Drop an error from a previous target so it does not stick to the new selection
  store.rgbError = null;
});

async function onCreate() {
  await store.createRgbCombination({
    target: selectedTarget.value,
    red: channelSelection.value.red,
    green: channelSelection.value.green,
    blue: channelSelection.value.blue,
  });
}

async function onDelete() {
  await store.deleteRgbCombination(selectedTarget.value);
}

onMounted(async () => {
  await store.loadRgbCandidates();
  if (!selectedCandidate.value) {
    selectedTarget.value = store.rgbCandidates[0]?.Target ?? null;
  }
});
</script>
