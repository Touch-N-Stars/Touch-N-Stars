<template>
  <div />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { useStellariumStore } from '@/store/stellariumStore';
import { useHorizonStore } from '@/plugins/horizon-creator/store/horizonStore';
import { buildHorizonGeoJSON } from '@/plugins/horizon-creator/utils/horizon-utils';

const stellariumStore = useStellariumStore();
const horizonStore = useHorizonStore();

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

let horizonLayer = null;
let horizonLine = null;

function update() {
  const stel = stellariumStore.stel;
  if (!stel || !horizonLine) return;

  if (horizonStore.points.length < 2) {
    horizonLine.data = EMPTY_FC;
    return;
  }

  const latRad = stel.core.observer.latitude;
  const lonRad = stel.core.observer.longitude;
  const mjd = stel.core.observer.utc;

  horizonLine.data = buildHorizonGeoJSON(horizonStore.points, latRad, lonRad, mjd);
}

watch(() => horizonStore.points, update, { deep: true });

onMounted(() => {
  const stel = stellariumStore.stel;
  if (!stel) return;

  horizonLayer = stel.createLayer({ id: 'horizonLayer', z: 6, visible: true });
  horizonLine = stel.createObj('geojson', { id: 'horizonLine' });
  horizonLine.data = EMPTY_FC;
  horizonLayer.add(horizonLine);
  update();
});

onBeforeUnmount(() => {
  horizonLine = null;
  horizonLayer = null;
});
</script>
