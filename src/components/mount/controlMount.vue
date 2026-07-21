<template>
  <div class="flex flex-col xs:flex-row gap-1 xs:gap-2">
    <ButtonPark />
    <ButtonUnpark />
    <ButtonHome />
    <ButtonSetAsPark />
    <!-- Full width while stacked, compact in the row so the labelled buttons keep their space -->
    <ButtonSlewStop class="xs:w-16" />
  </div>
  <div class="flex mt-4 justify-center items-center">
    <div class="w-3 mr-2 h-[1px] bg-line-strong"></div>
    <p class="text-xs">{{ $t('components.mount.control.trackingMode') }}</p>
    <div class="grow ml-2 h-[1px] bg-line-strong"></div>
  </div>
  <!-- Auto-fit grid: fits as many >=4rem buttons per row as the card allows and
       wraps the rest to the next row, so the five tracking buttons never spill
       over the card edge on narrow screens. Each cell keeps a >=48px tap size. -->
  <div class="grid grid-cols-[repeat(auto-fit,minmax(4rem,1fr))] gap-2 mt-2">
    <ButtonTrackingMode />
    <ButtonTrackingStop />
  </div>

  <div class="flex mt-4 justify-center items-center">
    <div class="w-3 mr-2 h-[1px] bg-line-strong"></div>
    <p class="text-xs">{{ $t('components.mount.control.reverse_axis') }}</p>
    <div class="grow ml-2 h-[1px] bg-line-strong"></div>
  </div>
  <div class="flex gap-x-2 mt-2">
    <ProfileToggle
      class="flex-1"
      labelKey="components.mount.settings.reverse_primary_axis"
      settingKey="TelescopeSettings-PrimaryReversed"
      :spread="false"
    />
    <ProfileToggle
      class="flex-1"
      labelKey="components.mount.settings.reverse_secondary_axis"
      settingKey="TelescopeSettings-SecondaryReversed"
      :spread="false"
    />
  </div>

  <div class="flex mt-4 justify-center items-center">
    <div class="w-3 mr-2 h-[1px] bg-line-strong"></div>
    <p class="text-xs">{{ $t('components.mount.control.manuellControl') }}</p>
    <div class="grow ml-2 h-[1px] bg-line-strong"></div>
  </div>
  <div>
    <moveAxis />
  </div>
</template>

<script setup>
import moveAxis from '@/components/mount/moveAxis.vue';
import ButtonSetAsPark from '@/components/mount/ButtonSetAsPark.vue';
import ButtonHome from '@/components/mount/ButtonHome.vue';
import ButtonUnpark from '@/components/mount/ButtonUnpark.vue';
import ButtonPark from '@/components/mount/ButtonPark.vue';
import ButtonSlewStop from '@/components/mount//ButtonSlewStop.vue';
import ButtonTrackingMode from '@/components/mount/ButtonTrackingMode.vue';
import ButtonTrackingStop from '@/components/mount/ButtonTrackingStop.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';
</script>
