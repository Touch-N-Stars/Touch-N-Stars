<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TargetCard from './TargetCard.vue';
import { fuzzyMatch } from '../fuzzyMatch';
import { computeRollup, buildProjectSettingsRows, classifyTargetCompletion } from '../calculations';

const { t } = useI18n();

const props = defineProps({
  project: { type: Object, required: true },
  targets: { type: Array, default: () => [] },
  targetsError: { type: String, default: '' },
  searchQuery: { type: String, default: '' },
  completionFilter: { type: String, default: 'all' },
  filterNameFilter: { type: String, default: 'all' },
  scheduledTargetIds: { type: Object, default: null }, // Set of target ids, or null when off
});

const expanded = ref(false);
const showSettings = ref(false);

const hasStrictFilters = computed(
  () =>
    props.completionFilter !== 'all' ||
    props.filterNameFilter !== 'all' ||
    Boolean(props.scheduledTargetIds)
);

// Completion/filter-name/scheduled-tonight are strict — they never fall
// back to "show everything" the way search does, since they're inherently
// about which targets qualify.
const strictFilteredTargets = computed(() => {
  if (!hasStrictFilters.value) return props.targets;
  return props.targets.filter((t) => {
    if (props.completionFilter !== 'all' && classifyTargetCompletion(t) !== props.completionFilter)
      return false;
    if (
      props.filterNameFilter !== 'all' &&
      !(t.ExposurePlan || []).some((p) => p.FilterName === props.filterNameFilter)
    )
      return false;
    if (props.scheduledTargetIds && !props.scheduledTargetIds.has(t.Id)) return false;
    return true;
  });
});

const filteredTargets = computed(() => {
  const base = strictFilteredTargets.value;
  if (!props.searchQuery) return base;
  const byName = base.filter((t) => fuzzyMatch(t.Name, props.searchQuery));
  // Empty match means the project itself matched the query (by name) — show
  // the rest of the filtered targets rather than the raw list.
  return byName.length ? byName : base;
});

const isExpanded = computed(
  () => expanded.value || Boolean(props.searchQuery) || hasStrictFilters.value
);

const T = 'plugins.targetSchedulerViewer.projectCard';

// buildProjectSettingsRows() returns structured data, not display strings —
// it's plain logic with no access to vue-i18n, so all label/unit/enum text
// is produced here via t().
function formatSettingRow(row) {
  switch (row.key) {
    case 'description':
      return [t(`${T}.description`), row.text || t(`${T}.emptyValue`)];
    case 'minimumTime':
      return [t(`${T}.minimumTime`), t(`${T}.minutes`, { count: row.minutes })];
    case 'filterSwitchFrequency':
      return [t(`${T}.filterSwitchFrequency`), row.text];
    case 'ditherEvery':
      return [t(`${T}.ditherEvery`), t(`${T}.exposures`, { count: row.count })];
    case 'meridianWindow':
      return [t(`${T}.meridianWindow`), t(`${T}.minutes`, { count: row.minutes })];
    case 'horizon':
      return [
        t(`${T}.horizon`),
        row.custom ? t(`${T}.horizonCustom`, { offset: row.offset }) : t(`${T}.off`),
      ];
    case 'altitudeLimits':
      return [t(`${T}.altitudeLimits`), `${row.min}°–${row.max}°`];
    case 'grading':
      return [t(`${T}.grading`), row.enabled ? t(`${T}.enabled`) : t(`${T}.disabled`)];
    case 'smartExposureOrder':
      return [t(`${T}.smartExposureOrder`), row.enabled ? t(`${T}.on`) : t(`${T}.off`)];
    case 'mosaic':
      return [t(`${T}.mosaic`), row.enabled ? t(`${T}.yes`) : t(`${T}.no`)];
    default:
      return [row.key, ''];
  }
}

const settingsRows = computed(() => [
  [t(`${T}.priority`), props.project.Priority],
  [t(`${T}.integrationAccepted`), rollup.value.integrationTime],
  [t(`${T}.integrationExpected`), rollup.value.expectedIntegrationTime],
  [t(`${T}.integrationRemaining`), rollup.value.remainingIntegrationTime],
  ...buildProjectSettingsRows(props.project).map(formatSettingRow),
]);

// Maps to TNS's own semantic tokens (good/accent/warning/danger) rather than
// inventing new hues, so state colors stay consistent with the rest of the
// app. Any state not in this list (the API doesn't document the full set)
// falls back to a neutral muted dot rather than guessing a color for it.
const STATE_DOT_CLASSES = {
  Active: 'bg-status-ok',
  Draft: 'bg-accent',
  Inactive: 'bg-status-warn',
  Closed: 'bg-status-danger',
};

const stateDotClass = computed(() => STATE_DOT_CLASSES[props.project.State] || 'bg-content-faint');

const rollup = computed(() => computeRollup(props.targets));
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-line bg-surface-1">
    <button
      class="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:brightness-110"
      @click="expanded = !expanded"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span class="tns-dot" :class="stateDotClass" :title="project.State" />
        <span class="break-words font-semibold">{{ project.Name }}</span>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <div class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-3 sm:block">
          <div class="h-full rounded-full bg-status-ok" :style="{ width: rollup.pct + '%' }" />
        </div>
        <span class="w-9 text-right text-[11px] tabular-nums text-content-faint"
          >{{ rollup.pct }}%</span
        >
        <span
          role="button"
          tabindex="0"
          class="rounded p-1 text-content-faint transition-colors hover:brightness-125"
          :class="showSettings ? 'bg-surface-3' : 'bg-transparent'"
          @click.stop="showSettings = !showSettings"
          @keydown.enter.stop="showSettings = !showSettings"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0Zm-9-3.75h.008v.008H12V8.25Z"
            />
          </svg>
        </span>
        <svg
          class="h-4 w-4 shrink-0 text-content-faint transition-transform"
          :class="{ 'rotate-180': isExpanded }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </button>

    <div
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :style="{ gridTemplateRows: showSettings ? '1fr' : '0fr' }"
    >
      <div class="overflow-hidden">
        <dl
          class="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line p-3 text-[11px] sm:grid-cols-3"
        >
          <div v-for="[label, value] in settingsRows" :key="label">
            <dt class="text-content-faint">{{ label }}</dt>
            <dd class="break-words">{{ value }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :style="{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }"
    >
      <div class="overflow-hidden">
        <div class="space-y-2 border-t border-line p-3">
          <div v-if="targetsError" class="text-sm text-status-danger">
            {{ targetsError }}
          </div>
          <div v-else-if="!targets.length" class="text-sm text-content-faint">
            {{ t('plugins.targetSchedulerViewer.projectCard.noTargets') }}
          </div>
          <TargetCard v-for="target in filteredTargets" :key="target.Id" :target="target" />
        </div>
      </div>
    </div>
  </div>
</template>
