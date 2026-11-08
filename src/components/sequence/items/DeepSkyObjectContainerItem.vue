<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ raStr }} {{ decStr }}</span>
      <span class="text-xs text-content-faint font-mono">{{ displayPositionAngle }}°</span>
    </template>

    <template #editor>
      <!-- Container Name -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{ $t('common.name') }}</label>
        <TextInput
          :modelValue="item.Name ?? ''"
          inputClass="tns-input-compact ml-auto w-36 md:w-40"
          @change="store.setProperty(item.Id, 'Name', $event)"
        />
      </div>

      <!-- Object search -->
      <TargetSearch @target-selected="handleTargetSelected" />

      <!-- Load from favorites -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.dso.loadFromFavorites')
        }}</label>
        <button
          class="ml-auto flex items-center gap-1 px-2 py-1 bg-surface-2 border border-line-strong rounded text-xs text-content hover:bg-surface-3"
          @click="openFavPicker"
        >
          <HeartIcon class="w-4 h-4 text-pink-400" />
        </button>
      </div>

      <!-- Load this target into the framing assistant -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.dso.loadIntoFraming')
        }}</label>
        <button
          class="ml-auto flex items-center gap-1 px-2 py-1 bg-surface-2 border border-line-strong rounded text-xs text-content hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!canLoadIntoFraming"
          @click="loadIntoFraming"
        >
          <CameraFramingIcon class="w-4 h-4 text-accent" />
        </button>
      </div>

      <!-- FITS Plate Solve -->
      <div
        v-if="
          appStore.isPINS ||
          appStore.checkVersionNewerOrEqual(appStore.currentTnsPluginVersion, '1.2.7.0')
        "
        class="seq-field-row"
      >
        <label class="tns-label shrink-0">{{ $t('components.fitsPlatesolve.buttonTitle') }}</label>
        <FitsPlateSolve
          class="ml-auto"
          variant="inline"
          :showFraming="false"
          :showSeqTarget="false"
          @solved="handleFitsSolved"
        />
      </div>

      <DsoFavoritePickerModal
        :show="showFavPicker"
        @close="showFavPicker = false"
        @select="loadFavTarget"
      />

      <DsoCoordinateFields :item="item" />
    </template>
  </ItemShell>
</template>

<script setup>
import { ref } from 'vue';
import ItemShell from './ItemShell.vue';
import DsoFavoritePickerModal from './DsoFavoritePickerModal.vue';
import DsoCoordinateFields from './DsoCoordinateFields.vue';
import TextInput from '@/components/helpers/TextInput.vue';
import TargetSearch from '@/plugins/sequence-creator/components/TargetSearch.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { apiStore } from '@/store/store';
import { HeartIcon } from '@heroicons/vue/24/outline';
import FitsPlateSolve from '@/components/fitsPlatesolve/FitsPlateSolve.vue';
import CameraFramingIcon from '@/components/icons/CameraFramingIcon.vue';
import { useDsoContainerTarget } from '@/composables/useDsoContainerTarget';

const props = defineProps({
  item: { type: Object, required: true },
});

const store = useSequenceV2Store();
const appStore = apiStore();
const showFavPicker = ref(false);

const {
  raStr,
  decStr,
  displayPositionAngle,
  callSetTarget,
  setFromSearch,
  setFromFavorite,
  canLoadIntoFraming,
  loadIntoFraming,
} = useDsoContainerTarget(() => props.item);

function openFavPicker() {
  showFavPicker.value = true;
}

function loadFavTarget(target) {
  setFromFavorite(target);
  showFavPicker.value = false;
}

function handleFitsSolved(result) {
  callSetTarget(result.ra, result.dec, 'FITS Plate Solve', result.rotation ?? 0);
}

async function handleTargetSelected(targetData) {
  await setFromSearch(targetData);
}
</script>
