<template>
  <div v-if="!sequenceStore.sequenceIsLoaded" class="pt-2">
    <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
      <p class="text-red-400 font-medium">{{ $t('components.sequence.noSequenceLoaded') }}</p>
    </div>
  </div>
  <div v-else class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-6">
    <div class="fixed right-3 z-10" style="bottom: calc(env(safe-area-inset-bottom, 0px) + 48px)">
      <button
        @click="toggleEdit"
        class="p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md"
        :class="{ 'connected-glow': sequenceStore.sequenceEdit }"
        v-if="sequenceStore.sequenceIsEditable"
      >
        <PencilIcon class="icon" />
      </button>
    </div>
    <div
      class="fixed left-3 z-10 bg-gray-800 rounded-full p-1 shadow-xl border border-cyan-500"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + 48px)"
    >
      <infoModal
        :size="'w-8 h-8'"
        :icon-text-colour="'text-white'"
        :message="$t('components.sequence.info_general.message')"
        :link="'https://github.com/Touch-N-Stars/Touch-N-Stars'"
        :linkText="'GitHub'"
      />
    </div>
    <FavTargets
      :show-framning="false"
      class="fixed right-16 z-10"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + 48px)"
    />
    <div class="max-w-6xl mx-auto lg:px-4">
      <div class="space-y-6 md:space-y-8">
        <!-- Added floating header effect -->
        <div class="backdrop-blur-sm bg-gray-800/50 rounded-xl p-4 shadow-xl">
          <controlSequence />
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
import { onBeforeUnmount } from 'vue';
import infoSequence from '@/components/sequence/infoSequence.vue';
import infoModal from '@/components/helpers/infoModal.vue';
import controlSequence from '@/components/sequence/controlSequence.vue';
import { useSequenceStore } from '@/store/sequenceStore';
import { ref } from 'vue';
import { PencilIcon } from '@heroicons/vue/24/outline';
import FavTargets from '@/components/favTargets/FavTargets.vue';

const currentTab = ref('showSequenz'); // Standardwert
const sequenceStore = useSequenceStore();

function toggleEdit() {
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
