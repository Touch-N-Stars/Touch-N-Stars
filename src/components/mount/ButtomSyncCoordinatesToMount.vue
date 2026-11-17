<template>
  <div class="flex gap-1">
    <button
      @click="syncCoordinates"
      :disabled="
        framingStore.isSlewing ||
        framingStore.isSlewingAndCentering ||
        framingStore.isRotating ||
        store.mountInfo.AtPark ||
        props.disabled
      "
      :class="['tns-btn-secondary', statusClass]"
    >
      <span
        v-if="mountStore.isSyncCoordinates"
        class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></span>
      <p v-else>{{ $t('components.mount.control.sync_coordinates_to_mount') }}</p>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useMountStore } from '@/store/mountStore';
import { useFramingStore } from '@/store/framingStore';
import { apiStore } from '@/store/store';

const store = apiStore();
const mountStore = useMountStore();
const framingStore = useFramingStore();
const statusClass = ref('');

const props = defineProps({
  raAngle: Number,
  decAngle: Number,
  label: String,
  disabled: Boolean,
});

async function syncCoordinates() {
  console.log(
    '[ButtomSyncCoordinatesToMount] Syncing coordinates to mount:',
    props.raAngle,
    props.decAngle
  );
  const result = await mountStore.syncCoordinates(props.raAngle, props.decAngle);
  console.log('[ButtomSyncCoordinatesToMount] Sync result:', result);
  if (result.success) {
    statusClass.value = 'glow-green';
  } else {
    statusClass.value = 'glow-red';
  }

  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
}
</script>

<style scoped></style>
