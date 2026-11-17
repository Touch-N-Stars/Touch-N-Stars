<template>
  <div v-if="!store.mountInfo.Connected" class="flex justify-center items-center pb-2">
    <DeviceNotConnected messageKey="components.mount.info.notConnected" class="w-full" />
  </div>
  <!-- compact (device page): states share one line, values flow in two quiet
       columns. Default (status bar panel): stat tile grid. -->
  <div
    v-else
    :class="
      compact
        ? 'flex flex-wrap items-center gap-x-5 gap-y-2'
        : 'gap-2 grid grid-cols-2 landscape:grid-cols-3'
    "
  >
    <StatusBool
      :compact="compact"
      :isEnabled="!store.mountInfo.AtPark"
      :enabledText="$t('components.mount.info.unparked')"
      :disabledText="$t('components.mount.info.parked')"
    />
    <StatusBool
      :compact="compact"
      :isEnabled="store.mountInfo.TrackingEnabled"
      :enabledText="$t('components.mount.info.trackingActive')"
      :disabledText="$t('components.mount.info.trackingDisabled')"
    />
    <StatusBool
      :compact="compact"
      :isEnabled="store.mountIsSlewing"
      :enabledText="$t('components.mount.info.slewing')"
      :disabledText="$t('components.mount.info.notSlewing')"
    />
    <StatusString
      v-if="!hideMountInfos"
      :compact="compact"
      :isEnabled="!!store.mountInfo.RightAscensionString"
      :Name="$t('components.mount.info.rightAscension')"
      :Value="store.mountInfo.RightAscensionString || ''"
    />
    <StatusString
      v-if="!hideMountInfos"
      :compact="compact"
      :isEnabled="!!store.mountInfo.DeclinationString"
      :Name="$t('components.mount.info.declination')"
      :Value="store.mountInfo.DeclinationString || ''"
    />
    <StatusString
      v-if="!hideMountInfos"
      :compact="compact"
      :isEnabled="!!store.mountInfo.AltitudeString"
      :Name="$t('components.mount.info.Alt')"
      :Value="store.mountInfo.AltitudeString || ''"
    />
    <StatusString
      v-if="!hideMountInfos"
      :compact="compact"
      :isEnabled="!!store.mountInfo.AzimuthString"
      :Name="$t('components.mount.info.Az')"
      :Value="store.mountInfo.AzimuthString || ''"
    />
    <StatusString
      v-if="!hideMountInfos"
      :compact="compact"
      secondary
      :isEnabled="!!store.mountInfo.TimeToMeridianFlipString"
      :Name="$t('components.mount.info.timeToMeridianFlip')"
      :Value="store.mountInfo.TimeToMeridianFlipString || ''"
    />
    <StatusString
      v-if="!hideMountInfos"
      :compact="compact"
      secondary
      :isEnabled="!!store.mountInfo.SideOfPier"
      :Name="$t('components.mount.info.SideOfPier')"
      :Value="sideOfPierDisplay()"
    />
  </div>
</template>

<script setup>
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import StatusBool from '@/components/helpers/StatusBool.vue';
import StatusString from '@/components/helpers/StatusString.vue';
import { apiStore } from '@/store/store';
const store = apiStore();

const props = defineProps({
  modelValue: Boolean,
  hideMountInfos: {
    type: Boolean,
    default: false,
  },
  // Dense page layout: inline state chips + two value columns (see template).
  compact: {
    type: Boolean,
    default: false,
  },
});

const { hideMountInfos, compact } = props;

const sideOfPierDisplay = () => {
  const value = store.mountInfo.SideOfPier || '';
  return value.replace('pier', '');
};
</script>
