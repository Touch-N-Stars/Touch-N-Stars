<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-control">
    <div class="flex flex-row items-center justify-between">
      <label for="toggle_light" class="text-xs md:text-sm text-content">
        {{ $t('components.camera.set_save_snapshot') }}
      </label>
      <div>
        <toggleButton
          @click="toggleSave"
          :status-value="saveSnapshots"
          class="pr-5 pl-5 justify-center h-7 md:h-8"
        />
      </div>
    </div>
    <div class="flex flex-row items-center justify-between mt-2 md:mt-3">
      <label for="targetName" class="text-xs md:text-sm text-content mr-2">
        {{ $t('components.camera.snapshotTargetName') }}
      </label>
      <input
        id="targetName"
        v-model="settingsStore.camera.snapshotTargetName"
        type="text"
        class="tns-input flex-1 text-xs md:text-sm"
        :disabled="!saveSnapshots"
      />
    </div>
  </div>
</template>
<script setup>
import { watch } from 'vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { useProfileSetting } from '@/composables/useProfileSetting';
import { useSettingsStore } from '@/store/settingsStore';

const settingsStore = useSettingsStore();

let saveDebounce;
watch(
  () => settingsStore.camera.snapshotTargetName,
  () => {
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => settingsStore.saveCameraSettings(), 600);
  }
);

const { value: saveSnapshots, save } = useProfileSetting('SnapShotControlSettings-Save', {
  fallback: false,
});

function toggleSave() {
  save(!saveSnapshots.value);
}
</script>
