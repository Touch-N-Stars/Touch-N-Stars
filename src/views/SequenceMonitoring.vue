<template>
  <div>
    <!-- Modal -->
    <transition name="fade">
      <div
        v-if="showSettingsModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div
          class="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 relative shadow-xl shadow-black"
        >
          <!-- Schließen-Button oben rechts -->
          <button
            @click="showSettingsModal = false"
            class="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-gray-900 rounded-full"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <!-- Modal-Inhalt -->
          <h3 class="text-lg font-bold mb-4 text-gray-100">
            {{ $t('components.sequence.monitor.settings.title') }}
          </h3>
          <div class="flex justify-end space-x-4">
            <MonitorViewSetting class="w-full" />
          </div>
        </div>
      </div>
    </transition>

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
          class="z-10 p-2 rounded-full bg-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 fixed right-4"
          style="bottom: var(--above-statusbar)"
          @click="showSettingsModal = true"
          aria-label="Open settings"
        >
          <Cog6ToothIcon class="icon" />
        </button>

        <div
          v-if="hasImages || showsTimeline"
          class="flex flex-col min-w-[80vw] w-full max-w-4xl justify-center items-center space-y-4"
        >
          <template v-if="hasImages">
            <h2>{{ sequenceStore.targetName }}</h2>
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
            class="w-full p-1 border border-cyan-700 bg-gray-800 shadow-lg shadow-cyan-700/40 rounded-xl"
          >
            <SequenzGraph />
          </div>

          <!-- Sequence current status -->
          <div
            v-if="settingsStore.monitorViewSetting.showSequenceCurrentState"
            class="w-full border border-cyan-700 bg-gray-800 shadow-lg shadow-cyan-700/40 rounded-xl p-5"
          >
            <div class="flex items-center gap-2 pb-1">
              <div class="w-2 h-2 bg-green-300 rounded-full shadow-purple-400/50 shadow-sm"></div>
              <h2 class="font-medium text-lg text-purple-200">
                {{ $t('components.sequence.status') }}:
              </h2>
            </div>
            <div class="pb-4">
              <SequenceRunningItem />
            </div>
            <div
              class="p-5 bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 rounded-lg mb-3 shadow-lg transition-all duration-200 hover:shadow-xl"
            >
              <SequenceRunningConditions />
            </div>
            <div class="border-t border-slate-600/50 my-4"></div>
            <div>
              <h4 class="text-purple-200">
                {{ $t('components.sequence.totalExposureTime.title') }}:
              </h4>
              <totalExposureTime />
            </div>
          </div>

          <div
            class="flex flex-col w-full min-h-80 border border-cyan-700 bg-gray-800 shadow-lg shadow-cyan-700/40 rounded-xl p-2"
            v-if="settingsStore.monitorViewSetting.showGuiderAfGraph && store.focuserInfo.Connected"
          >
            <p class="mb-4 text-center">{{ $t('components.focuser.last_autofocus') }}</p>
            <AutofocusGrafik class="grow h-screen-3/4" />
          </div>
          <div class="p-5"></div>
        </div>
        <div v-else class="p-4 mt-20 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p class="text-red-400 font-medium">{{ $t('components.sequence.noSequenceData') }}</p>
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

<style>
.icon {
  width: 24px;
  height: 24px;
}
</style>
