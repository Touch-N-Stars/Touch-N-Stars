<template>
  <div class="space-y-4">
    <!-- Slew and Center Active -->
    <div v-if="slewAndCenterActive" class="space-y-3">
      <!-- Status Header -->
      <div
        v-show="slewAndCenterStatus"
        class="bg-accent/10 w-full p-3 rounded-lg border border-accent/30"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-content">{{ slewAndCenterStatus }}</span>
        </div>
      </div>

      <!-- Current Measurement -->
      <div v-if="currentMeasurement" class="grid grid-cols-3 gap-2">
        <div class="bg-surface-2 p-3 rounded-lg border border-line">
          <p class="tns-label mb-1">{{ $t('dialogs.plateSolving.time') }}</p>
          <p class="text-content font-semibold">{{ currentMeasurement.time }}</p>
        </div>
        <div
          class="p-3 rounded-lg border"
          :class="[
            isErrorWithinThreshold
              ? 'bg-status-ok/10 border-status-ok/50'
              : 'bg-surface-2 border-line',
          ]"
        >
          <p
            class="text-xs mb-2"
            :class="isErrorWithinThreshold ? 'text-status-ok' : 'text-content-muted'"
          >
            {{ $t('dialogs.plateSolving.error') }}
          </p>
          <div
            class="space-y-1"
            :class="isErrorWithinThreshold ? 'text-status-ok' : 'text-content'"
          >
            <p
              v-for="(line, idx) in parseErrorDistance(currentMeasurement.errorDistance)"
              :key="idx"
              class="text-xs font-semibold"
            >
              {{ line }}
            </p>
          </div>
        </div>
        <div class="bg-surface-2 p-3 rounded-lg border border-line">
          <p class="tns-label mb-1">{{ $t('dialogs.plateSolving.rotation') }}</p>
          <p class="text-content font-semibold">{{ Math.round(currentMeasurement.rotation) }}°</p>
        </div>
      </div>

      <!-- Measurements History -->
      <div v-if="measurements.length > 0" class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-surface-2">
            <tr>
              <th class="px-2 py-2 text-left text-content-muted border-b border-line">
                {{ $t('dialogs.plateSolving.time') }}
              </th>
              <th class="px-2 py-2 text-left text-content-muted border-b border-line">
                {{ $t('dialogs.plateSolving.status') }}
              </th>
              <th class="px-2 py-2 text-left text-content-muted border-b border-line">
                {{ $t('dialogs.plateSolving.error') }}
              </th>
              <th class="px-2 py-2 text-left text-content-muted border-b border-line">
                {{ $t('dialogs.plateSolving.rotation') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(measurement, idx) in measurements" :key="idx" class="border-b border-line">
              <td class="px-2 py-2 text-content">{{ measurement.time }}</td>
              <td class="px-2 py-2 flex justify-center">
                <CheckIcon v-if="measurement.success" class="w-5 h-5 text-status-ok" />
                <XMarkIcon v-else class="w-5 h-5 text-status-danger" />
              </td>
              <td class="px-2 py-2 text-content">
                {{ extractDistance(measurement.errorDistance) }}
              </td>
              <td class="px-2 py-2 text-content">{{ Math.round(measurement.rotation) }}°</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';

const store = apiStore();

const props = defineProps({
  dialog: {
    type: Object,
    required: true,
  },
});

// SignalR format - Read from dialog.slewAndCenter directly
const slewAndCenterData = computed(() => {
  return props.dialog?.slewAndCenter || null;
});

const slewAndCenterActive = computed(() => {
  return slewAndCenterData.value?.active || false;
});

const slewAndCenterStatus = computed(() => {
  return slewAndCenterData.value?.status || '';
});

const currentMeasurement = computed(() => {
  return slewAndCenterData.value?.currentMeasurement || null;
});

const measurements = computed(() => {
  return slewAndCenterData.value?.measurements || [];
});

// Check if current error distance is within threshold
const isErrorWithinThreshold = computed(() => {
  if (!currentMeasurement.value || !store.profileInfo?.PlateSolveSettings) {
    return false;
  }

  let errorDistance = currentMeasurement.value.errorDistance;
  const threshold = store.profileInfo.PlateSolveSettings.Threshold;

  // Handle "--" or other non-numeric values
  if (errorDistance === '--' || errorDistance === null || errorDistance === undefined) {
    return false;
  }

  const errorStr = String(errorDistance).trim();
  let numericError = 0;

  // Check if it's a time format (HH:MM:SS or -HH:MM:SS)
  if (errorStr.includes(':')) {
    const isNegative = errorStr.startsWith('-');
    const parts = errorStr.replace(/[^\d:]/g, '').split(':');

    if (parts.length >= 2) {
      // Convert HH:MM:SS to decimal (assuming it's in degrees, minutes, seconds)
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;

      // Convert to decimal degrees: degrees + minutes/60 + seconds/3600
      numericError = hours + minutes / 60 + seconds / 3600;
      if (isNegative) numericError = -numericError;
    }
  } else {
    // Regular numeric format (with or without degree symbol)
    numericError = parseFloat(errorStr.replace(/[^\d.\-]/g, ''));
  }

  const numericThreshold = parseFloat(String(threshold).replace(/[^\d.]/g, ''));

  return (
    !isNaN(numericError) && !isNaN(numericThreshold) && Math.abs(numericError) < numericThreshold
  );
});

function parseErrorDistance(errorDistance) {
  if (!errorDistance || typeof errorDistance !== 'string') {
    return [errorDistance];
  }

  // Split by semicolon and trim each part
  return errorDistance
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function extractDistance(errorDistance) {
  if (!errorDistance || typeof errorDistance !== 'string') {
    return errorDistance;
  }

  // Extract "Distance: 74° 24' 55"" from the error distance string
  const match = errorDistance.match(/Distance:\s*([^;]+)/);
  if (match) {
    return match[1].trim();
  }

  return errorDistance;
}
</script>
