<template>
  <div class="flex flex-col gap-1">
    <div
      class="flex flex-row items-center justify-between w-full border border-line p-2 rounded-control"
    >
      <label for="showImage" class="text-content-muted">
        {{ $t('components.sequence.monitor.settings.showImage') }}
      </label>
      <div>
        <toggleButton
          @click="
            settingsStore.monitorViewSetting.showImage = !settingsStore.monitorViewSetting.showImage
          "
          :status-value="settingsStore.monitorViewSetting.showImage"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2 border border-line p-2 rounded-control">
      <div class="flex items-center justify-between w-full">
        <label for="showImageStats" class="text-content-muted">
          {{ $t('components.sequence.monitor.settings.showImageStats') }}
        </label>
        <div>
          <toggleButton
            @click="
              settingsStore.monitorViewSetting.showImageStats =
                !settingsStore.monitorViewSetting.showImageStats
            "
            :status-value="settingsStore.monitorViewSetting.showImageStats"
          />
        </div>
      </div>
      <div class="flex items-center justify-between w-full">
        <label for="showImageStats" class="text-content-muted">
          {{ $t('components.sequence.monitor.settings.display_status_under_image') }}
        </label>
        <div>
          <toggleButton
            @click="
              settingsStore.monitorViewSetting.displayStatusUnderImage =
                !settingsStore.monitorViewSetting.displayStatusUnderImage
            "
            :status-value="settingsStore.monitorViewSetting.displayStatusUnderImage"
          />
        </div>
      </div>
    </div>

    <div
      class="flex flex-row items-center justify-between w-full border border-line p-2 rounded-control"
    >
      <label for="showImgStatsGraph" class="text-content-muted">
        {{
          store.isPINS
            ? $t('components.sequence.monitor.settings.showTimeline')
            : $t('components.sequence.monitor.settings.showImgStatsGraph')
        }}
      </label>
      <div>
        <toggleButton
          @click="
            settingsStore.monitorViewSetting.showImgStatsGraph =
              !settingsStore.monitorViewSetting.showImgStatsGraph
          "
          :status-value="settingsStore.monitorViewSetting.showImgStatsGraph"
        />
      </div>
    </div>

    <div
      class="flex flex-row items-center justify-between w-full border border-line p-2 rounded-control"
    >
      <label for="showSequenceCurrentState" class="text-content-muted">
        {{ $t('components.sequence.monitor.settings.sequenceCurrentState') }}
      </label>
      <div>
        <toggleButton
          @click="
            settingsStore.monitorViewSetting.showSequenceCurrentState =
              !settingsStore.monitorViewSetting.showSequenceCurrentState
          "
          :status-value="settingsStore.monitorViewSetting.showSequenceCurrentState"
        />
      </div>
    </div>

    <div
      class="flex flex-row items-center justify-between w-full border border-line p-2 rounded-control"
    >
      <label for="showGuiderAfGraph" class="text-content-muted">
        {{ $t('components.sequence.monitor.settings.showGuiderAfGraph') }}
      </label>
      <div>
        <toggleButton
          @click="
            settingsStore.monitorViewSetting.showGuiderAfGraph =
              !settingsStore.monitorViewSetting.showGuiderAfGraph
          "
          :status-value="settingsStore.monitorViewSetting.showGuiderAfGraph"
        />
      </div>
    </div>

    <div class="flex flex-col gap-1 border border-line p-2 rounded-control">
      <label class="text-content-muted">{{
        $t('components.sequence.monitor.settings.imageRotation')
      }}</label>
      <div class="flex gap-2">
        <button
          v-for="deg in [0, 90, 180, 270]"
          :key="deg"
          type="button"
          @click="settingsStore.setImageRotation(deg)"
          :aria-pressed="settingsStore.currentImageRotation === deg"
          :class="[
            'flex-1 min-h-touch rounded-control text-sm font-medium border',
            settingsStore.currentImageRotation === deg
              ? 'bg-accent-action border-accent text-white'
              : 'bg-surface-3 border-line-strong text-content',
          ]"
        >
          {{ deg }}°
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import toggleButton from '@/components/helpers/toggleButton.vue';

const settingsStore = useSettingsStore();
const store = apiStore();
</script>
