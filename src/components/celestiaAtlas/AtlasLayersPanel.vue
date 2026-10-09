<template>
  <div class="grid gap-3">
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="layer in layers"
        :key="layer.key"
        class="atlas-layer-chip"
        :class="{ 'is-on': isOn(layer) }"
        type="button"
        :aria-pressed="isOn(layer)"
        @click="toggle(layer)"
      >
        <span class="tns-dot" :class="isOn(layer) ? 'bg-accent' : 'bg-content-faint'" />
        <span class="min-w-0 flex-1 text-left leading-tight [overflow-wrap:anywhere]">
          {{ $t(`components.celestiaAtlas.settings.${layer.label}`) }}
        </span>
      </button>
    </div>
    <!-- Background switch, only once there is more than one survey to choose from -->
    <select
      v-if="installedSurveyIds.length > 1"
      v-model="surveySource"
      class="tns-select w-full"
      :aria-label="$t('components.celestiaAtlas.survey.source_label')"
    >
      <option v-for="id in installedSurveyIds" :key="id" :value="id">
        {{ $t(`components.celestiaAtlas.survey.source_${skySurveyLocaleKey(id)}`) }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import { useCelestiaAtlasSurveyStore } from '@/store/celestiaAtlasSurveyStore';
import {
  SKY_SURVEY_IDS,
  normalizeSkySurveyId,
  skySurveyLocaleKey,
} from '@/integrations/celestiaAtlas/offlineSkySurvey';

// Quick toggles for what is drawn on the sky. These are the settings a user flips while
// observing; everything rarer stays in the settings dialog. `defaultOn` marks the keys
// whose stored value is only false when explicitly switched off (missing === on).
const settingsStore = useSettingsStore();

const layers = [
  { key: 'constellationsLinesVisible', label: 'constellations_lines_visible' },
  { key: 'equatorialLinesVisible', label: 'equatorial_lines_visible' },
  { key: 'azimuthalLinesVisible', label: 'azimuthal_lines_visible' },
  { key: 'meridianLinesVisible', label: 'meridian_lines_visible' },
  { key: 'eclipticLinesVisible', label: 'ecliptic_lines_visible' },
  { key: 'dsosVisible', label: 'dsos_visible' },
  { key: 'skySurveyVisible', label: 'sky_survey_visible', defaultOn: true },
  { key: 'atmosphereVisible', label: 'atmosphere_visible' },
  { key: 'landscapesVisible', label: 'landscapes_visible' },
  { key: 'hideBelowHorizon', label: 'hide_below_horizon', defaultOn: true },
];

// The survey stores are polled by the Atlas view; this only reads them.
const installedSurveyIds = computed(() =>
  SKY_SURVEY_IDS.filter((id) => useCelestiaAtlasSurveyStore(id).installedOrder !== null)
);
const surveySource = computed({
  get: () => normalizeSkySurveyId(settingsStore.celestiaAtlas.skySurveySource),
  set: (id) => {
    settingsStore.celestiaAtlas.skySurveySource = id;
  },
});

function isOn(layer) {
  const value = settingsStore.celestiaAtlas[layer.key];
  return layer.defaultOn ? value !== false : Boolean(value);
}

function toggle(layer) {
  settingsStore.celestiaAtlas[layer.key] = !isOn(layer);
}
</script>

<style scoped>
.atlas-layer-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  /* Grid items default to min-width:auto, i.e. the longest word; without this a label
     like "Himmelsdurchmusterung" pushes the chip into the neighbouring column. */
  min-width: 0;
  min-height: var(--spacing-touch);
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-content-muted);
  background: var(--color-surface-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-chip);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.atlas-layer-chip.is-on {
  color: var(--color-content);
  border-color: rgb(34 211 238 / 45%);
  background: rgb(34 211 238 / 10%);
}
</style>
