<template>
  <section data-testid="mount-sky-chart">
    <h4 class="tns-section-title">{{ $t('components.mount.skyChart.title') }}</h4>
    <p v-if="store.mountIsParked" class="text-sm text-content-muted">
      {{ $t('components.mount.skyChart.parked') }}
    </p>
    <SkyChart v-else-if="target" :target="target" :coordinates="coordinates" />
  </section>
</template>

<script setup>
import { computed } from 'vue';
import SkyChart from '@/components/framing/SkyChart.vue';
import { apiStore } from '@/store/store';

const store = apiStore();

// The chart only needs to follow the pointing roughly. Rounding to 0.1° keeps
// these computeds stable between the 2 s polls while the mount tracks, so the
// chart is not rebuilt on every poll - only when the mount actually moves.
const raDeg = computed(() => {
  const info = store.mountInfo;
  if (!info?.Connected) return null;
  const ra = info.Coordinates?.RADegrees ?? (info.Coordinates?.RA ?? info.RightAscension) * 15;
  return Number.isFinite(ra) ? Math.round(ra * 10) / 10 : null;
});

const decDeg = computed(() => {
  const info = store.mountInfo;
  if (!info?.Connected) return null;
  const dec = info.Coordinates?.Dec ?? info.Declination;
  return Number.isFinite(dec) ? Math.round(dec * 10) / 10 : null;
});

// JNow vs. J2000 differs by well under a degree, which an altitude chart over
// a whole night cannot show, so the mount's coordinates are used as reported.
const target = computed(() =>
  raDeg.value != null && decDeg.value != null ? { RA: raDeg.value, Dec: decDeg.value } : null
);

const latitude = computed(() => store.profileInfo?.AstrometrySettings?.Latitude ?? 0);
const longitude = computed(() => store.profileInfo?.AstrometrySettings?.Longitude ?? 0);
const coordinates = computed(() => ({ latitude: latitude.value, longitude: longitude.value }));
</script>
