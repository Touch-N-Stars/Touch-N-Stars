<template>
  <div class="p-4 flex flex-col gap-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
    <PHD2Profil />
  </div>
  <div v-if="guiderStore.phd2IsConnected" class="flex flex-col gap-1">
    <div class="p-4 flex flex-col gap-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
      <SetExposure />
    </div>
    <div class="p-4 flex flex-col gap-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
      <SetRaAlgoPara />
    </div>
    <div class="p-4 flex flex-col gap-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
      <SetDecAlgoPara />
    </div>
  </div>
</template>

<script setup>
import { useGuiderStore } from '@/store/guiderStore';
import SetExposure from '@/components/guider/PHD2/SetExposure.vue';
import SetRaAlgoPara from '@/components/guider/PHD2/SetRaAlgoPara.vue';
import SetDecAlgoPara from '@/components/guider/PHD2/SetDecAlgoPara.vue';
import PHD2Profil from '@/components/guider/PHD2/PHD2Profil.vue';

const guiderStore = useGuiderStore();
</script>
