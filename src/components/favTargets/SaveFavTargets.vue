<template>
  <div :class="{ 'w-full': showLabel }">
    <button
      type="button"
      :disabled="props.disabled"
      @click="showModal = true"
      class="tns-btn-secondary"
      :class="{ 'w-full gap-2': showLabel }"
    >
      <HeartIcon class="w-7 h-7 shrink-0" />
      <span v-if="showLabel">{{ t('components.fav_target.save_to_favorites') }}</span>
    </button>

    <!-- A tap beside it must not throw away the typed name. -->
    <Modal
      :show="showModal"
      zIndex="z-modal-raised"
      maxWidth="max-w-xl"
      :closeOnBackdropClick="false"
      @close="showModal = false"
    >
      <template #header>
        <h2 class="text-xl font-bold">{{ t('components.fav_target.enter_name') }}</h2>
      </template>
      <template #body>
        <div class="w-full">
          <input v-model="nameInput" type="text" class="w-full h-10 tns-input" />
          <p v-if="isMosaic" class="text-xs text-content-muted mt-2">
            {{ mosaicCols * mosaicRows }} {{ t('components.framing.mosaic.panels') }}
            {{ t('components.framing.mosaic.willBeSaved') }}
          </p>
          <div class="flex justify-end mt-4 space-x-2">
            <button type="button" @click="confirmSave" class="tns-btn-primary">
              {{ t('common.confirm') }}
            </button>
            <button type="button" @click="showModal = false" class="tns-btn-danger">
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { useFavTargetStore } from '@/store/favTargetsStore';
import { HeartIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import { degreesToHMS, degreesToDMS } from '@/utils/utils';
import { useFramingStore } from '@/store/framingStore';

const favTargetsStore = useFavTargetStore();
const { t } = useI18n();

const props = defineProps({
  name: { type: String, default: 'Unknown' },
  ra: Number,
  dec: Number,
  raString: String,
  decString: String,
  rotation: { type: Number, default: 0 },
  mosaicCols: { type: Number, default: null },
  mosaicRows: { type: Number, default: null },
  mosaicOverlap: { type: Number, default: null },
  mosaicPreserveAlignment: { type: Boolean, default: null },
  // Pre-computed panel centres ({ label, ra, dec, rotation }); when given they
  // win over framingStore.mosaicPanelCoords, which only the framing page keeps
  // up to date.
  panels: { type: Array, default: null },
  showLabel: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const showModal = ref(false);
const nameInput = ref(props.name);

watch([showModal, () => props.disabled], ([isOpen, isDisabled]) => {
  if (isDisabled) {
    showModal.value = false;
    return;
  }
  if (isOpen) nameInput.value = props.name;
});

const isMosaic = computed(() => props.mosaicCols > 1 || props.mosaicRows > 1);

function computePanels() {
  const overlap = props.mosaicOverlap / 100;
  const cols = props.mosaicCols;
  const rows = props.mosaicRows;
  const centerRA = props.ra;
  const centerDec = props.dec;
  const centerRot = props.rotation;

  const framingStore = useFramingStore();
  const scale = framingStore.fov / framingStore.containerWidth;
  const fovX = framingStore.camWidth * scale;
  const fovY = framingStore.camHeight * scale;

  const stepRa = fovX * (1 - overlap);
  const stepDec = fovY * (1 - overlap);
  let cosDec = Math.cos((centerDec * Math.PI) / 180);
  if (Math.abs(cosDec) < 1e-8) cosDec = 1e-8;

  const theta = (centerRot * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const panels = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dc = col - (cols - 1) / 2;
      const dr = row - (rows - 1) / 2;
      const rawX = dc * stepRa;
      const rawY = dr * stepDec;
      // Im Uhrzeigersinn rotieren, passend zur visuellen Kamera-Rotation in
      // FramingAssistantImg (SVG rotiert clockwise um rotationAngleVisu).
      const rotX = rawX * cosT + rawY * sinT;
      const rotY = -rawX * sinT + rawY * cosT;
      const panelRA = centerRA - rotX / cosDec;
      const panelDec = centerDec - rotY;
      const panelRot = centerRot;
      panels.push({
        label: `${col + 1}-${row + 1}`,
        ra: panelRA,
        dec: panelDec,
        rotation: panelRot,
      });
    }
  }
  return panels;
}

async function confirmSave() {
  if (!nameInput.value.trim()) return;
  const baseName = nameInput.value.trim();

  if (isMosaic.value) {
    // Panel-Koordinaten kommen aus dem Store (von FramingAssistantImg aus den
    // tatsächlich gerenderten Pixelpositionen berechnet) und stimmen damit exakt
    // mit dem Overlay überein. Fallback auf lokale Berechnung, falls leer.
    const framingStore = useFramingStore();
    const panels =
      props.panels ??
      (framingStore.mosaicPanelCoords.length > 0
        ? framingStore.mosaicPanelCoords
        : computePanels());
    for (const p of panels) {
      await favTargetsStore.addFavorite({
        Name: `${baseName} Panel ${p.label}`,
        Ra: p.ra,
        Dec: p.dec,
        RaString: degreesToHMS(p.ra),
        DecString: degreesToDMS(p.dec),
        Rotation: p.rotation,
      });
    }
  } else {
    console.log('Saving favorite target rotation:', props.rotation);
    await favTargetsStore.addFavorite({
      Name: baseName,
      Ra: props.ra,
      Dec: props.dec,
      RaString: props.raString,
      DecString: props.decString,
      Rotation: props.rotation,
    });
  }

  showModal.value = false;
}
</script>
