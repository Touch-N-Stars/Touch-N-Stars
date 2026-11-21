<template>
  <!-- After the plan: what the night brought, and what is left to do (end the night, or wait
       for the camera to warm up and the mount to park). -->
  <section class="tns-card border-accent/40! flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <CheckCircleIcon class="w-6 h-6 text-status-ok shrink-0" />
      <h2 class="text-xl font-bold text-content leading-tight">
        {{ $t(`components.simpleMode.summary.${phase}.title`) }}
      </h2>
    </div>
    <p class="text-sm text-content-muted">
      {{ $t(`components.simpleMode.summary.${phase}.text`) }}
    </p>

    <div class="grid grid-cols-3 gap-2">
      <div class="tns-stat-tile min-w-0">
        <span class="tns-stat-label">{{ $t('components.simpleMode.summary.frames') }}</span>
        <span class="tns-stat-value">{{ frames.frames }}</span>
      </div>
      <div class="tns-stat-tile min-w-0">
        <span class="tns-stat-label">{{ $t('components.simpleMode.summary.integration') }}</span>
        <span class="tns-stat-value">{{ integration }}</span>
      </div>
      <div class="tns-stat-tile min-w-0">
        <span class="tns-stat-label">{{ $t('components.simpleMode.summary.medianHfr') }}</span>
        <span class="tns-stat-value">
          {{ frames.medianHfr !== null ? frames.medianHfr.toFixed(2) : '–' }}
        </span>
      </div>
    </div>

    <SimpleCoachHint />

    <!-- Ended: the rig is shutting down - show that it really does -->
    <ul v-if="phase === 'ended'" class="flex flex-col gap-1 text-sm">
      <li v-if="store.mountInfo.Connected" class="flex items-center gap-2">
        <span
          class="tns-dot"
          :class="store.mountIsParked ? 'bg-status-ok' : 'bg-status-warn'"
        ></span>
        {{
          store.mountIsParked
            ? $t('components.simpleMode.rig.parked')
            : $t('components.simpleMode.summary.ended.notParked')
        }}
      </li>
      <li v-if="store.cameraInfo.Connected && warming" class="flex items-center gap-2">
        <Spinner size="sm" class="text-accent" />
        {{
          $t('components.simpleMode.steps.cool.warmingSummary', {
            temp: `${Number(store.cameraInfo.Temperature).toFixed(1)} °C`,
          })
        }}
      </li>
    </ul>

    <button v-if="phase === 'finished'" type="button" class="tns-btn-primary" @click="$emit('end')">
      {{ $t('components.simpleMode.steps.end.action') }}
    </button>
    <!-- Ended by mistake, or the sky cleared again: back to the night -->
    <button
      v-if="phase === 'ended'"
      type="button"
      class="tns-btn-secondary"
      @click="$emit('resume')"
    >
      {{ $t('components.simpleMode.summary.ended.resume') }}
    </button>
    <router-link to="/sequence" class="tns-btn-secondary">
      {{ $t('components.simpleMode.steps.capture.editPlan') }}
    </router-link>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { CheckCircleIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useImagetStore } from '@/store/imageStore';
import Spinner from '@/components/helpers/Spinner.vue';
import SimpleCoachHint from './SimpleCoachHint.vue';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';
import { formatDuration } from '@/utils/sequenceSimple';
import { nightFrames } from '@/utils/simpleMode';

const props = defineProps({
  /** 'finished' | 'ended' */
  phase: { type: String, required: true },
  night: { type: String, required: true },
  warming: { type: Boolean, default: false },
});
defineEmits(['end', 'resume']);

const store = apiStore();
const imageStore = useImagetStore();

const isDeleted = (entry, index) =>
  isHistoryEntryDeleted(entry, historyEntryKey(index, entry), imageStore.deletedHistoryKeys);
const frames = computed(() => nightFrames(store.imageHistoryInfo, props.night, isDeleted));
const integration = computed(() =>
  frames.value.seconds > 0 ? formatDuration(frames.value.seconds) : '–'
);
</script>
