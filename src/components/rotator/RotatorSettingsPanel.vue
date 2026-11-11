<template>
  <div class="flex flex-col gap-2 sm:gap-4 pb-20">
    <!-- Reverse Setting Container -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-surface-2/50 rounded-lg border border-line/50"
    >
      <h3 class="font-bold text-base text-accent">
        {{ $t('components.rotator.settings.basic') }}
      </h3>
      <rotatorReverse />
      <mechanicalRange />
      <setRotatorBacklash />
      <setRotatorOvershoot />
    </div>
  </div>
</template>

<script setup>
import rotatorReverse from './rotatorReverse.vue';
import mechanicalRange from './settings/mechanicalRange.vue';
import setRotatorOvershoot from './settings/setRotatorOvershoot.vue';
import setRotatorBacklash from './settings/setRotatorBacklash.vue';
</script>
