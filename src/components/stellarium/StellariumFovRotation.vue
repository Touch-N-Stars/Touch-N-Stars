<template>
  <div :class="positionClasses" class="absolute z-30">
    <button
      v-if="!expanded"
      @click="open"
      class="p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md"
      :title="$t('components.framing.fovSettings.rotationAngle')"
    >
      <CameraFramingIcon class="w-7 h-7 text-cyan-300" camera-class="text-white" />
    </button>
    <div
      v-else
      class="flex flex-col gap-2 bg-black bg-opacity-90 border border-cyan-600 rounded-lg p-3 shadow-md w-80"
    >
      <div class="flex justify-between items-start gap-2">
        <NumberInputPicker
          v-model="rotationModel"
          :label="$t('components.framing.fovSettings.rotationAngle')"
          labelKey="components.framing.fovSettings.rotationAngle"
          :min="0"
          :max="360"
          :step="1"
          :decimalPlaces="1"
          inputId="stellarium-fov-rotation"
          wrapperClass="w-full"
        />
        <button
          @click="expanded = false"
          class="p-1 text-gray-300 hover:text-white shrink-0"
          :title="$t('common.close')"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <getImageRotation />

      <div class="text-xs font-mono text-gray-400 leading-tight">
        <div>RA: {{ raString || '—' }}</div>
        <div>Dec: {{ decString || '—' }}</div>
      </div>

      <input v-model="targetName" type="text" placeholder="Target name" class="default-input" />

      <ButtonSlewCenterRotate :raAngle="raDeg" :decAngle="decDeg" :disabled="!hasMount" />

      <setSequenceTarget
        class="w-full"
        :raAngle="raDeg"
        :decAngle="decDeg"
        :name="effectiveTargetName"
      />

      <SaveFavTargets
        :name="effectiveTargetName"
        :ra="raDeg"
        :dec="decDeg"
        :ra-string="raString"
        :dec-string="decString"
        :rotation="rotationModel"
        :show-label="true"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import CameraFramingIcon from '@/components/icons/CameraFramingIcon.vue';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useStellariumStore } from '@/store/stellariumStore';
import { useOrientation } from '@/composables/useOrientation';
import { degreesToHMS, degreesToDMS, rad2deg } from '@/utils/utils';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ButtonSlewCenterRotate from '@/components/mount/ButtonSlewCenterRotate.vue';
import setSequenceTarget from '@/components/framing/setSequenceTarget.vue';
import SaveFavTargets from '@/components/favTargets/SaveFavTargets.vue';
import getImageRotation from '@/components/framing/getImageRotation.vue';

const store = apiStore();
const framingStore = useFramingStore();
const stellariumStore = useStellariumStore();
const { isLandscape } = useOrientation();

const expanded = ref(false);
const raDeg = ref(0);
const decDeg = ref(0);
const raString = ref('');
const decString = ref('');
const targetName = ref('');
let rafId = null;

const rotationModel = computed({
  get: () => Number(framingStore.rotationAngle ?? 0),
  set: (value) => {
    framingStore.rotationAngle = Number(value);
  },
});

const hasMount = computed(() => store.mountInfo.Connected && !store.sequenceRunning);

const effectiveTargetName = computed(() => {
  if (targetName.value && targetName.value.trim() !== '') return targetName.value.trim();
  if (raString.value && decString.value) return `${raString.value} ${decString.value}`;
  return 'Stellarium view';
});

function sampleView() {
  const stel = stellariumStore.stel;
  if (!stel) return;
  const icrfVec = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', [0, 0, -1]);
  const raDecRad = stel.c2s(icrfVec);
  let ra = rad2deg(raDecRad[0]);
  const dec = rad2deg(raDecRad[1]);
  if (ra < 0) ra += 360;
  raDeg.value = ra;
  decDeg.value = dec;
  raString.value = degreesToHMS(ra);
  decString.value = degreesToDMS(dec);
}

function loop() {
  sampleView();
  rafId = requestAnimationFrame(loop);
}

function open() {
  sampleView();
  expanded.value = true;
}

watch(expanded, (isExpanded) => {
  if (isExpanded) {
    rafId = requestAnimationFrame(loop);
  } else if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});

const positionClasses = computed(() => ({
  'top-3 right-3': !isLandscape.value && !expanded.value,
  'top-16 right-3': !isLandscape.value && expanded.value,
  'top-3 right-20': isLandscape.value,
}));
</script>
