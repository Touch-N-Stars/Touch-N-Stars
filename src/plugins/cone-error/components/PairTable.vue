<template>
  <div v-if="pairs.length" class="overflow-x-auto">
    <table class="w-full text-xs text-content">
      <thead class="text-content-muted">
        <tr>
          <th class="text-left py-1">#</th>
          <th class="text-right">ΔRA {{ sideLabel($t, 'East', true) }}</th>
          <th class="text-right">ΔRA {{ sideLabel($t, 'West', true) }}</th>
          <th class="text-right">{{ $t('plugins.coneError.result.cone') }}</th>
          <th class="text-left pl-2">{{ $t('plugins.coneError.progress.note') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="pair in pairs"
          :key="pair.index"
          class="border-t border-line"
          :class="{ 'text-content-faint line-through': pair.rejected }"
        >
          <td class="py-1">{{ pair.index + 1 }}</td>
          <td class="text-right">{{ arcmin(pair.deltaRaEastArcmin) }}</td>
          <td class="text-right">{{ arcmin(pair.deltaRaWestArcmin) }}</td>
          <td class="text-right font-semibold">{{ arcmin(pair.coneArcmin) }}</td>
          <td class="pl-2 text-status-warn">
            {{ pair.rejected ? $t('plugins.coneError.result.outlier') : pair.problem || '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { sideLabel } from '../format';

defineProps({
  pairs: { type: Array, default: () => [] },
});

function arcmin(value) {
  return typeof value === 'number' ? `${value.toFixed(2)}′` : '—';
}
</script>
