<template>
  <div />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { useStellariumStore } from '@/store/stellariumStore';
import { useHorizonStore } from '@/plugins/horizon-creator/store/horizonStore';
import { interpolateHorizon } from '@/plugins/horizon-creator/utils/horizon-utils';

const stellariumStore = useStellariumStore();
const horizonStore = useHorizonStore();

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

let horizonLayer = null;
let horizonLine = null;
let updateTimer = null;

function update() {
  const stel = stellariumStore.stel;
  if (!stel || !horizonLine) return;

  if (horizonStore.points.length < 2) {
    horizonLine.data = EMPTY_FC;
    return;
  }

  const D2R = stel.D2R;
  const R2D = stel.R2D;

  const interp = interpolateHorizon(horizonStore.points, 2);
  interp.push({ az: interp[0].az, alt: interp[0].alt }); // close the loop

  const coords = interp.map(({ az, alt }) => {
    const azR = az * D2R;
    const altR = alt * D2R;
    // NEZ vector in OBSERVED_GEOM frame (x=North, y=East, z=Zenith)
    // az is N=0°, E=90° (standard geographic convention)
    const obsVec = [
      Math.cos(altR) * Math.cos(azR),
      Math.cos(altR) * Math.sin(azR),
      Math.sin(altR),
    ];
    const icrfVec = stel.convertFrame(stel.observer, 'OBSERVED_GEOM', 'ICRF', obsVec);
    const rd = stel.c2s(icrfVec);
    const raDeg = stel.anp(rd[0]) * R2D;
    const decDeg = rd[1] * R2D;
    return [raDeg, decDeg];
  });

  horizonLine.data = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          stroke: '#ff6600',
          'stroke-opacity': 0.9,
          'stroke-width': 2,
        },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
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

  // Refresh every 500ms so the overlay stays fixed in alt-az space as LST advances.
  updateTimer = setInterval(update, 500);
});

onBeforeUnmount(() => {
  if (updateTimer) { clearInterval(updateTimer); updateTimer = null; }
  horizonLine = null;
  horizonLayer = null;
});
</script>
