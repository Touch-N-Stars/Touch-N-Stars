<template>
  <div>
    <SubNav
      :items="[
        { name: $t('components.sequence.title'), value: 'showSequence' },
        { name: $t('components.settings.title'), value: 'showSettings' },
      ]"
      v-model:activeItem="currentTab"
    />

    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-6">
      <LoadingOverlay
        :show="sequenceStore.sequenceLoading"
        :message="$t('components.sequence.loadingSequence')"
      />

      <!-- Sequence Tab -->
      <div v-if="currentTab === 'showSequence'" class="max-w-6xl mx-auto">
        <div class="backdrop-blur-sm bg-surface-1/60 rounded-card p-4 shadow-xl">
          <SequenceCurrentView />
        </div>
      </div>

      <!-- Settings Tab -->
      <div
        v-if="currentTab === 'showSettings'"
        class="container max-w-md landscape:max-w-xl mx-auto"
      >
        <div class="border border-line rounded-card shadow-lg bg-surface-1 p-5">
          <SequenceSettings />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SubNav from '@/components/SubNav.vue';
import SequenceCurrentView from '@/components/sequence/SequenceCurrentView.vue';
import SequenceSettings from '@/components/sequence/SequenceSettings.vue';
import LoadingOverlay from '@/components/helpers/LoadingOverlay.vue';
import { useSequenceStore } from '@/store/sequenceStore';

const sequenceStore = useSequenceStore();
const currentTab = ref('showSequence');
</script>
