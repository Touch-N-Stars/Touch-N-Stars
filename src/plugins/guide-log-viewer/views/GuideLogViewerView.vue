<template>
  <div class="px-2 sm:px-3 py-3 mx-auto w-full max-w-7xl">
    <GuideLogViewer />

    <!-- Flight recorder replay of an incident tapped in "Worth a look" (full screen) -->
    <NativeIncidentReplay
      v-if="store.replayIncidentId"
      :key="store.replayIncidentId"
      :id="store.replayIncidentId"
      @close="store.closeReplay()"
    />
  </div>
</template>

<script setup>
import { defineAsyncComponent, onBeforeUnmount } from 'vue';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import GuideLogViewer from '../components/GuideLogViewer.vue';

const NativeIncidentReplay = defineAsyncComponent(
  () => import('@/components/guider/native/incidents/NativeIncidentReplay.vue')
);

const store = useNativeGuiderStore();

// A replay opened here belongs to this page.
onBeforeUnmount(() => store.closeReplay());
</script>
