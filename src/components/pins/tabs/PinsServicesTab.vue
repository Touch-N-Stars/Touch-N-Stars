<template>
  <div class="flex flex-col space-y-6">
    <PinsSambaCard :enabled="sambaEnabled" :disabled="isBusy" @toggle="toggleSamba" />

    <PinsPhd2Card
      :enabled="phd2Enabled"
      :running="phd2Running"
      :disabled="isBusy"
      @toggle="togglePhd2"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import PinsSambaCard from '../PinsSambaCard.vue';
import PinsPhd2Card from '../PinsPhd2Card.vue';
import { usePinsJobRunner } from '../composables/usePinsJobRunner';
import { usePinsServices } from '../composables/usePinsServices';

const { t } = useI18n();
const runner = usePinsJobRunner({ t });
const { isBusy } = runner;
const { sambaEnabled, phd2Enabled, phd2Running, toggleSamba, togglePhd2 } = usePinsServices({
  t,
  runner,
});
</script>
