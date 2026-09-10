<template>
  <div>
    <SubNav
      :items="[
        { name: $t('components.sequence.title'), value: 'showSequence' },
        { name: $t('components.settings.title'), value: 'showSettings' },
      ]"
      v-model:activeItem="sequenceStore.currentTab"
    />

    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-6">
      <LoadingOverlay
        :show="sequenceStore.sequenceLoading"
        :message="$t('components.sequence.loadingSequence')"
      />

      <!-- Sequence Tab.
           v-show, not v-if: SequenceCurrentView keeps the expand/collapse state
           of every container in component-local state, owns the 2s poller and
           teleports the floating control bar to body. Unmounting it on a tab
           switch would collapse the whole tree, restart the poller and hide
           start/stop/lock - so it stays mounted and only hides. -->
      <div v-show="sequenceStore.currentTab === 'showSequence'" class="max-w-6xl mx-auto">
        <div class="backdrop-blur-sm bg-surface-1/60 rounded-card p-4 shadow-xl">
          <SequenceCurrentView />
        </div>
      </div>

      <!-- Settings Tab. pb-36 clears the control bar, which stays visible here
           because the sequence view above is never unmounted. -->
      <div
        v-if="sequenceStore.currentTab === 'showSettings'"
        class="container max-w-md landscape:max-w-xl mx-auto pb-36"
      >
        <div class="border border-line rounded-card shadow-lg bg-surface-1 p-5">
          <SequenceSettings />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import SubNav from '@/components/SubNav.vue';
import SequenceCurrentView from '@/components/sequence/SequenceCurrentView.vue';
import SequenceSettings from '@/components/sequence/SequenceSettings.vue';
import LoadingOverlay from '@/components/helpers/LoadingOverlay.vue';
import { useSequenceStore } from '@/store/sequenceStore';

// The tab lives in the store, not in a local ref: App.vue remounts the
// router-view on every orientation change, which would drop a local one and
// throw the user back to the sequence tab mid-edit.
const sequenceStore = useSequenceStore();
</script>
