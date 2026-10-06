<template>
  <div>
    <button @click="setSequenceTarget" class="tns-btn-secondary">
      <span>{{ $t('components.framing.setSequnceTarget') }}</span>
    </button>

    <SequenceTargetPickerModal
      :show="showPicker"
      :targets="pickerTargets"
      @close="showPicker = false"
      @confirm="onPickerConfirm"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import apiService from '@/services/apiService';
import SequenceTargetPickerModal from '@/components/framing/SequenceTargetPickerModal.vue';
import { useFramingStore } from '@/store/framingStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import {
  collectDsoContainers,
  dsoContainerRaString,
  dsoContainerDecString,
} from '@/utils/sequenceTargets';
import { degreesToHMS, degreesToDMS } from '@/utils/utils';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  raAngle: Number,
  decAngle: Number,
  name: String,
});

const framingStore = useFramingStore();
const sequenceStore = useSequenceStore();
const sequenceV2Store = useSequenceV2Store();
const store = apiStore();
const toastStore = useToastStore();
const { t } = useI18n();

const showPicker = ref(false);
const pickerTargets = ref([]);
// The framing values captured when the button was tapped. Nothing is sent until the
// dialog is confirmed, so they have to survive until then.
const pendingTarget = ref(null);

const hasSequenceLoaded = computed(
  () =>
    sequenceStore.sequenceIsLoaded &&
    Array.isArray(sequenceStore.sequenceInfo) &&
    sequenceStore.sequenceInfo.length > 0
);

function buildCoordinateName(ra, dec) {
  return `RA ${degreesToHMS(ra)} Dec ${degreesToDMS(dec)}`;
}

function showError(message) {
  toastStore.showToast({
    type: 'error',
    title: t('components.fav_target.modal_sequence.titel'),
    message,
  });
}

function showSuccess() {
  toastStore.showToast({
    type: 'success',
    title: t('components.fav_target.modal_sequence.titel'),
    message: t('components.fav_target.modal_sequence_ok.message'),
  });
}

// The store actions always reload the sequence before returning, so a failure never
// leaves an optimistically set value behind -- only the toast has to be produced here.
function reportResult(result, fallbackMessage) {
  if (result?.ok) {
    showSuccess();
    return;
  }
  if (result?.locked) {
    showError(t('components.sequence.controlsLockedMessage'));
    return;
  }
  showError(result?.error || fallbackMessage);
}

async function setSequenceTarget() {
  // Write the props into the framing store when they were passed in
  if (props.raAngle !== undefined && props.decAngle !== undefined) {
    framingStore.RAangle = props.raAngle;
    framingStore.DECangle = props.decAngle;

    // Build a selectedItem object when a name was passed in
    if (props.name) {
      framingStore.selectedItem = { Name: props.name };
    }
  }

  const name =
    framingStore.selectedItem?.Name ||
    props.name ||
    buildCoordinateName(framingStore.RAangle, framingStore.DECangle);
  const rotation = framingStore.rotationAngle;

  if (!hasSequenceLoaded.value) {
    console.error('No sequence loaded');
    showError(t('components.fav_target.modal_sequence_error.message'));
    return;
  }

  pendingTarget.value = {
    name,
    ra: framingStore.RAangle,
    dec: framingStore.DECangle,
    rotation,
  };

  // Without the plugin's sequence editor there is nothing to pick a target in -- legacy
  // behaviour: the first target of the sequence is overwritten.
  if (!store.sequenceEditorAvailable) {
    try {
      await apiService.sequnceTargetSet(
        name,
        framingStore.RAangle,
        framingStore.DECangle,
        rotation,
        0
      );
      showSuccess();
    } catch (error) {
      console.error('Error setting sequence target:', error);
      showError(
        error?.response?.data?.Message || t('components.fav_target.modal_sequence_error.message')
      );
    }
    return;
  }

  // Read-only: the list must show what the sequence holds right now, not a stale store
  // state, and no target may be changed before the user confirms.
  await sequenceV2Store.loadCurrent();
  const containers = collectDsoContainers(sequenceV2Store.data);

  // Nothing to pick from -- create the sequence's first target without asking.
  if (containers.length === 0) {
    await applyToNewTarget(null);
    return;
  }

  pickerTargets.value = containers.map((container, index) => {
    const raStr = dsoContainerRaString(container);
    const decStr = dsoContainerDecString(container);
    return {
      id: container.Id,
      name:
        container.Name ||
        (raStr && `RA ${raStr} Dec ${decStr}`) ||
        t('components.framing.sequenceTargetPicker.unnamed', { index: index + 1 }),
      raStr,
      decStr,
    };
  });
  showPicker.value = true;
}

async function onPickerConfirm(choice) {
  showPicker.value = false;
  if (choice.mode === 'replace') {
    await applyToExistingTarget(choice.id);
  } else {
    await applyToNewTarget(choice.afterId);
  }
}

async function applyToExistingTarget(id) {
  const target = pendingTarget.value;
  if (!target) return;
  const result = await sequenceV2Store.setDsoTarget(
    id,
    target.name,
    target.ra,
    target.dec,
    target.rotation
  );
  reportResult(result, t('components.fav_target.modal_sequence_error.message'));
}

async function applyToNewTarget(afterId) {
  const target = pendingTarget.value;
  if (!target) return;
  const added = await sequenceV2Store.addDsoTarget(afterId);
  if (!added.ok) {
    reportResult(added, t('components.framing.sequenceTargetPicker.addFailed'));
    return;
  }
  await applyToExistingTarget(added.id);
}
</script>
