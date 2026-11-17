<template>
  <section class="flex flex-col gap-2 min-w-0">
    <h4 class="text-sm font-semibold text-content">{{ k('camera.title') }}</h4>

    <p v-if="!grid.exposures.length" class="text-xs text-content-muted">
      {{ k('camera.noResults') }}
    </p>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="w-full border-separate border-spacing-1 text-xs tabular-nums">
          <thead>
            <tr>
              <th class="text-left font-normal text-content-faint">
                {{ k('camera.exposure') }} \ {{ k('camera.gain') }}
              </th>
              <th
                v-for="gain in grid.gains"
                :key="gain"
                scope="col"
                class="text-center font-semibold text-content-muted"
              >
                {{ gain }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="exposure in grid.exposures" :key="exposure">
              <th scope="row" class="whitespace-nowrap pr-1 text-left font-semibold text-content">
                {{ trimmed(exposure, 2) }} s
              </th>
              <td v-for="gain in grid.gains" :key="gain" class="p-0">
                <button
                  type="button"
                  class="cell"
                  :class="cellClass(exposure, gain)"
                  :style="cellStyle(exposure, gain)"
                  :aria-pressed="isSelected(exposure, gain)"
                  :aria-label="cellLabel(exposure, gain)"
                  @click="select(exposure, gain)"
                >
                  <template v-if="grid.cell(exposure, gain)">
                    <StarIcon
                      v-if="grid.isRecommended(grid.cell(exposure, gain))"
                      class="absolute right-1 top-1 h-3.5 w-3.5 text-accent"
                    />
                    <span
                      class="text-sm font-semibold"
                      :class="{ 'line-through': !grid.cell(exposure, gain).feasible }"
                    >
                      {{ jitterText(grid.cell(exposure, gain)) }}
                    </span>
                    <span class="text-[10px] text-content-muted">
                      {{
                        grid.cell(exposure, gain).feasible
                          ? `${k('camera.snr')} ${fmt(grid.cell(exposure, gain).snr, 0)}`
                          : reasonText(grid.cell(exposure, gain).reason)
                      }}
                    </span>
                  </template>
                  <span v-else class="text-content-faint">…</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detail of the tapped (or recommended) cell -->
      <div
        v-if="detail"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-control bg-surface-2 px-3 py-2 text-xs tabular-nums"
      >
        <span class="font-semibold text-content">
          {{ trimmed(detail.exposureSeconds, 2) }} s · {{ k('camera.gain') }} {{ detail.gain }}
        </span>
        <span v-if="grid.isRecommended(detail)" class="font-semibold text-accent">
          {{ k('camera.recommended') }}
        </span>
        <span class="text-content-muted">
          {{ k('camera.jitter') }} {{ jitterText(detail) }}
          <template v-if="Number.isFinite(detail.jitterPx)">
            ({{ fmt(detail.jitterPx, 2) }} px)</template
          >
        </span>
        <span class="text-content-muted">{{ k('camera.snr') }} {{ fmt(detail.snr, 1) }}</span>
        <span class="text-content-muted">{{ k('camera.hfd') }} {{ fmt(detail.hfd, 2) }} px</span>
        <span class="text-content-muted">{{ k('camera.stars') }} {{ detail.stars ?? '–' }}</span>
        <span class="text-content-muted">{{ k('camera.frames') }} {{ detail.frames ?? '–' }}</span>
        <span v-if="!detail.feasible" class="font-semibold text-status-danger">
          {{ reasonText(detail.reason) }}
        </span>
      </div>
      <p class="text-[11px] text-content-faint">
        {{ k('camera.legend') }} {{ k('camera.tapHint') }}
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { StarIcon } from '@heroicons/vue/24/solid';
import { fmt } from '@/utils/nativeGuider';
import { cameraGrid, jitterColor, jitterScale, trimmed } from '@/utils/nativeGuiderCoach';
import { useCoachText } from './useCoachText';

const props = defineProps({
  /** AdvancedCoachCameraCheck { results, recommended }. */
  camera: { type: Object, default: null },
});

const { k, te } = useCoachText();

const grid = computed(() => cameraGrid(props.camera));
const selected = ref(null);

const detail = computed(() => {
  if (selected.value) {
    const cell = grid.value.cell(selected.value.exposure, selected.value.gain);
    if (cell) return cell;
  }
  return props.camera?.recommended || null;
});

function isSelected(exposure, gain) {
  return selected.value?.exposure === exposure && selected.value?.gain === gain;
}

function select(exposure, gain) {
  selected.value = isSelected(exposure, gain) ? null : { exposure, gain };
}

function jitterText(result) {
  return Number.isFinite(result?.jitterArcsec) ? `${fmt(result.jitterArcsec, 2)}″` : '–';
}

function reasonText(reason) {
  const key = `components.guider.native.coach.values.reason.${reason}`;
  return reason && te(key) ? k(`values.reason.${reason}`) : reason || '';
}

function cellClass(exposure, gain) {
  const cell = grid.value.cell(exposure, gain);
  return {
    'cell-infeasible': cell && !cell.feasible,
    'cell-recommended': cell && grid.value.isRecommended(cell),
    'cell-selected': isSelected(exposure, gain),
  };
}

function cellStyle(exposure, gain) {
  const cell = grid.value.cell(exposure, gain);
  if (!cell || !cell.feasible) return {};
  const scale = jitterScale(cell.jitterArcsec, grid.value.jitterMin, grid.value.jitterMax);
  return { backgroundColor: jitterColor(scale) };
}

function cellLabel(exposure, gain) {
  const cell = grid.value.cell(exposure, gain);
  const head = `${trimmed(exposure, 2)} s, ${k('camera.gain')} ${gain}`;
  if (!cell) return `${head}: ${k('camera.notMeasured')}`;
  return cell.feasible
    ? `${head}: ${k('camera.jitter')} ${jitterText(cell)}, ${k('camera.snr')} ${fmt(cell.snr, 0)}`
    : `${head}: ${reasonText(cell.reason)}`;
}
</script>

<style scoped>
@reference '../../../../assets/tailwind.css';

.cell {
  @apply relative flex min-h-12 w-full min-w-16 flex-col items-center justify-center rounded-chip
    border border-line bg-surface-2 px-1 py-1 text-content transition-colors;
}

.cell-infeasible {
  @apply text-content-faint;
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 6px,
    rgba(148, 163, 184, 0.12) 6px 8px
  );
}

.cell-recommended {
  @apply border-2 border-accent;
}

.cell-selected {
  @apply ring-2 ring-accent/50;
}
</style>
