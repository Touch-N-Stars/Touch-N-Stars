<template>
  <!-- After a night with restless guiding: the Guiding Coach finds out why. Only a
       recommendation - it takes a quarter of an hour under the sky and never runs on its own. -->
  <div
    v-if="show"
    class="flex flex-col gap-3 rounded-control border border-status-warn/40 bg-status-warn/10 p-3"
  >
    <div class="flex items-start gap-2">
      <AcademicCapIcon class="mt-0.5 h-5 w-5 shrink-0 text-status-warn" />
      <p class="text-sm text-content">{{ $t('components.simpleMode.coachHint.text') }}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="tns-btn-primary w-auto! flex-1" @click="openCoach">
        {{ $t('components.simpleMode.coachHint.open') }}
      </button>
      <button type="button" class="tns-btn-ghost" @click="dismiss">
        {{ $t('components.simpleMode.coachHint.dismiss') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AcademicCapIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { isNativeGuiderInUse } from '@/utils/nativeGuider';
import { guidingWasPoor } from '@/utils/simpleMode';

const router = useRouter();
const store = apiStore();
const settingsStore = useSettingsStore();

const tally = computed(() => settingsStore.simpleMode?.guiding ?? null);

// The coach belongs to the built-in guider. Once followed or dismissed, the hint stays away
// until another night's guiding turns out poor.
const show = computed(
  () =>
    isNativeGuiderInUse(store) &&
    guidingWasPoor(tally.value) &&
    settingsStore.simpleMode?.coachHintNight !== tally.value?.night
);

function dismiss() {
  settingsStore.dismissSimpleModeCoachHint(tally.value?.night);
}

function openCoach() {
  dismiss();
  router.push({ path: '/guider', query: { tab: 'coach' } });
}
</script>
