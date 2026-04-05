<template>
  <div
    class="fixed inset-0 top-[82px] landscape:top-0 landscape:left-32 z-10 bg-black flex flex-col md:flex-row overflow-hidden"
  >
    <!-- Main Image Area -->
    <div class="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
      <AllskySnapshot />
    </div>

    <!-- Controls Sidebar (Right desktop) or Bottom Bar (Mobile) -->
    <div
      class="h-24 pb-8 w-full md:h-full md:pb-0 md:w-20 lg:w-24 bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 flex flex-shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] md:shadow-[-4px_0_20px_rgba(0,0,0,0.5)]"
    >
      <AllskyControlBar @open-settings="openSettings" />
    </div>

    <!-- Settings Modal -->
    <AllskySettingsModal :is-open="showSettingsModal" @close="closeSettings" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useallskyStore } from '../store/allskyStore.js';
import AllskySnapshot from '../components/AllskySnapshot.vue';
import AllskyControlBar from '../components/AllskyControlBar.vue';
import AllskySettingsModal from '../components/AllskySettingsModal.vue';

const allskyStore = useallskyStore();
const showSettingsModal = ref(false);

const openSettings = () => {
  showSettingsModal.value = true;
};

const closeSettings = () => {
  showSettingsModal.value = false;
};

onMounted(() => {
  allskyStore.loadFromLocalStorage();
});
</script>

<style scoped>
/* iOS Safari scroll fix */
div {
  -webkit-user-select: none;
  user-select: none;
}
</style>
