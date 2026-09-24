<script setup>
import { THEME } from '../theme';

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  accent: { type: Boolean, default: false },
});
</script>

<template>
  <div>
    <p class="text-[11px]" :style="{ color: THEME.inkMuted }">{{ label }}</p>
    <p
      class="text-2xl font-semibold leading-tight"
      :style="{ color: accent ? THEME.accent : THEME.inkPrimary }"
    >
      {{ value }}
    </p>
  </div>
</template>
