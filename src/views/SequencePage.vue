<template>
  <SequenceV2Page v-if="store.sequenceEditorAvailable" />

  <div
    v-else-if="store.sequenceEditorDetectionPending"
    class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center"
  >
    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
  </div>

  <div v-else class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-6">
    <LoadingOverlay
      :show="sequenceStore.sequenceLoading"
      :message="$t('components.sequence.loadingSequence')"
    />

    <div class="fixed right-3 z-10" style="bottom: var(--above-statusbar)">
      <button
        @click="toggleEdit"
        class="p-2 min-h-touch min-w-touch flex items-center justify-center bg-surface-3 border border-line-strong rounded-full shadow-md"
        :class="{
          'connected-glow': sequenceStore.sequenceEdit,
          'opacity-50 cursor-not-allowed': sequenceStore.sequenceControlsLocked,
        }"
        v-if="sequenceStore.sequenceIsEditable"
        :disabled="sequenceStore.sequenceControlsLocked"
        :title="editButtonTitle"
      >
        <PencilIcon class="icon" />
      </button>
    </div>

    <FavTargets
      :show-framning="false"
      class="fixed right-16 z-10"
      style="bottom: var(--above-statusbar)"
    />
    <FitsPlateSolve
      v-if="
        store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.7.0')
      "
      :showFraming="false"
      :showSeqTarget="true"
      class="fixed right-28 z-10"
      style="bottom: var(--above-statusbar)"
    />

    <controlSequence v-if="sequenceStore.sequenceIsLoaded" />
    <div class="max-w-6xl mx-auto lg:px-4">
      <div class="space-y-6 md:space-y-8">
        <!-- Added floating header effect -->
        <div class="backdrop-blur-sm bg-surface-1/60 rounded-card p-4 shadow-xl">
          <LoadSequence />
          <transition name="slide-fade">
            <div v-show="currentTab === 'showSequenz'" class="space-y-6 md:space-y-8">
              <infoSequence />
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import infoSequence from '@/components/sequence/infoSequence.vue';
import controlSequence from '@/components/sequence/controlSequence.vue';
import { useSequenceStore } from '@/store/sequenceStore';
import { PencilIcon } from '@heroicons/vue/24/outline';
import FavTargets from '@/components/favTargets/FavTargets.vue';
import FitsPlateSolve from '@/components/fitsPlatesolve/FitsPlateSolve.vue';
import LoadSequence from '@/components/sequence/LoadSequence.vue';
import LoadingOverlay from '@/components/helpers/LoadingOverlay.vue';
import SequenceV2Page from '@/views/SequenceV2Page.vue';
import { apiStore } from '@/store/store';
import { useI18n } from 'vue-i18n';

const store = apiStore();
const currentTab = ref('showSequenz'); // Standardwert
const sequenceStore = useSequenceStore();
const { t } = useI18n();
const editButtonTitle = computed(() =>
  sequenceStore.sequenceControlsLocked ? t('components.sequence.lockControls') : undefined
);

function toggleEdit() {
  if (sequenceStore.sequenceControlsLocked) return;

  sequenceStore.sequenceEdit = !sequenceStore.sequenceEdit;
  if (sequenceStore.sequenceEdit) {
    sequenceStore.stopFetching();
  } else {
    sequenceStore.startFetching();
  }
}
onBeforeUnmount(() => {
  sequenceStore.sequenceEdit = false;
  sequenceStore.startFetching();
});
</script>
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.connected-glow {
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
}
</style>
