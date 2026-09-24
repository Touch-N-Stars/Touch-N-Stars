<template>
  <div>
    <p v-if="!rows || rows.length === 0" class="py-4 text-center text-sm text-gray-400">
      {{ emptyText }}
    </p>

    <template v-else>
      <!-- md and up: a real table -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-xs text-gray-400">
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-2 pb-2 font-medium"
                :class="col.align === 'left' ? 'text-left' : 'text-right'"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in rows"
              :key="rowKey ? row[rowKey] : idx"
              class="border-b border-gray-700/50 last:border-b-0"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-2 py-2 text-gray-200 tabular-nums"
                :class="col.align === 'left' ? 'text-left' : 'text-right'"
              >
                {{ format(row[col.key], col) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- below md: one stacked card per row, so nothing scrolls sideways on a phone -->
      <div class="flex flex-col gap-2 md:hidden">
        <div
          v-for="(row, idx) in rows"
          :key="rowKey ? row[rowKey] : idx"
          class="rounded-lg border border-gray-700/50 bg-gray-900/40 p-2"
        >
          <div
            v-for="col in columns"
            :key="col.key"
            class="flex items-center justify-between gap-3 py-0.5 text-sm"
          >
            <span class="text-gray-400">{{ col.label }}</span>
            <span class="text-gray-200 tabular-nums">{{ format(row[col.key], col) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  // [{ key, label, format?: 'int' | 'num' | (value) => string, align?: 'left' | 'right' }]
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: '' },
  emptyText: { type: String, default: '' },
});

// The backend passes unmeasured values through as null, NaN or the string "NaN".
function isMissing(value) {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'NaN' ||
    (typeof value === 'number' && !Number.isFinite(value))
  );
}

function format(value, col) {
  if (typeof col.format === 'function') return col.format(value);
  if (isMissing(value)) return '--';
  const num = Number(value);
  if (col.format === 'int' && Number.isFinite(num)) return Math.round(num).toString();
  if (col.format === 'num' && Number.isFinite(num)) return num.toFixed(2);
  return value;
}
</script>
