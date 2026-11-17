<template>
  <div>
    <Modal
      :show="showSettingsModal"
      zIndex="z-modal-raised"
      maxWidth="max-w-sm"
      @close="showSettingsModal = false"
    >
      <template #header>
        <h2 class="text-xl font-bold">
          {{ $t('components.sequence.monitor.settings.title') }}
        </h2>
      </template>
      <template #body>
        <MonitorViewSetting class="w-full" />
      </template>
    </Modal>

    <SubNav
      :items="[
        { name: $t('components.sequence.stats'), value: 'showStats' },
        { name: $t('components.sequence.imageHistory'), value: 'showImageHistory' },
      ]"
      v-model:activeItem="currentTab"
    />

    <div v-if="store.imageHistoryInfo && store.imageHistoryInfo.length > 0" class="mt-14 mx-2 mb-2">
      <ImageFilterControls />
    </div>

    <div class="flex items-center justify-center mb-6 mx-2">
      <div v-if="currentTab == 'showStats'">
        <button
          type="button"
          class="fixed right-4 z-10 flex items-center justify-center min-h-touch min-w-touch rounded-full bg-surface-3 border border-line-strong text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          style="bottom: var(--above-statusbar)"
          @click="showSettingsModal = true"
          :aria-label="$t('components.sequence.monitor.settings.title')"
        >
          <Cog6ToothIcon class="w-6 h-6" />
        </button>

        <div
          v-if="hasImages || showsTimeline"
          class="flex flex-col min-w-[80vw] w-full max-w-4xl justify-center items-center space-y-4"
        >
          <h2 v-if="sequenceStore.targetName">{{ sequenceStore.targetName }}</h2>
          <template v-if="hasImages">
            <div class="mt-5 w-full">
              <LastSequenceImg />
            </div>
          </template>

          <!-- PINS: the session timeline covers the HFR chart's statistics, and shows
               slews, solves and focus runs before the first frame exists -->
          <div v-if="showsTimeline" class="w-full">
            <SessionTimeline />
          </div>
          <div
            v-else-if="settingsStore.monitorViewSetting.showImgStatsGraph"
            class="tns-card w-full p-1!"
          >
            <SequenzGraph />
          </div>

          <!-- Sequence current status -->
          <div
            v-if="settingsStore.monitorViewSetting.showSequenceCurrentState"
            class="tns-card w-full"
          >
            <div class="flex items-center gap-2 pb-1">
              <span class="tns-dot bg-status-ok"></span>
              <h2 class="tns-section-title">{{ $t('components.sequence.status') }}:</h2>
            </div>
            <div class="pb-4">
              <SequenceRunningItem />
            </div>
            <div class="p-4 bg-surface-2 border border-line rounded-control mb-3">
              <SequenceRunningConditions />
            </div>
            <div class="border-t border-line my-4"></div>
            <div>
              <h3 class="text-sm font-semibold text-content-muted">
                {{ $t('components.sequence.totalExposureTime.title') }}:
              </h3>
              <totalExposureTime />
            </div>
          </div>

          <div
            class="tns-card flex flex-col w-full min-h-80 p-2!"
            v-if="settingsStore.monitorViewSetting.showGuiderAfGraph && store.focuserInfo.Connected"
          >
            <p class="mb-4 text-center">{{ $t('components.focuser.last_autofocus') }}</p>
            <AutofocusGrafik class="grow h-screen-3/4" />
          </div>
          <div class="p-5"></div>
        </div>
        <div v-else class="tns-card mt-20">
          <p class="text-content-muted font-medium">
            {{ $t('components.sequence.noSequenceData') }}
          </p>
        </div>
      </div>

      <div v-if="currentTab == 'showImageHistory'" class="mt-5">
        <SequenceImageHistory />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import SubNav from '@/components/SubNav.vue';
import Modal from '@/components/helpers/Modal.vue';
import SessionTimeline from '@/components/sessionTimeline/SessionTimeline.vue';
import SequenceImageHistory from '@/components/imageHistory/SequenceImageHistory.vue';
import LastSequenceImg from '@/components/imageHistory/LastSequenceImg.vue';
import SequenzGraph from '@/components/imageHistory/SequenzGraph.vue';
import AutofocusGrafik from '@/components/focuser/AfFnishGraph.vue';
import MonitorViewSetting from '@/components/imageHistory/MonitorViewSetting.vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import { useSequenceStore } from '@/store/sequenceStore';
import SequenceRunningItem from '@/components/sequence/SequenceRunningItem.vue';
import SequenceRunningConditions from '@/components/sequence/SequenceRunningConditions.vue';
import totalExposureTime from '@/components/imageHistory/totalExposureTime.vue';
import ImageFilterControls from '@/components/imageHistory/ImageFilterControls.vue';

const currentTab = ref('showStats');

const store = apiStore();
const settingsStore = useSettingsStore();
const sequenceStore = useSequenceStore();
const showSettingsModal = ref(false);

const hasImages = computed(() => store.imageHistoryInfo?.length > 0);
const showsTimeline = computed(
  () => store.isPINS && settingsStore.monitorViewSetting.showImgStatsGraph
);
</script>
