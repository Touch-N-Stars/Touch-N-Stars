<template>
  <div
    class="flex flex-row md:flex-col items-center justify-start w-full h-full text-white px-4 md:px-0 md:pt-6 gap-6 md:gap-8 overflow-hidden"
  >
    <!-- 1. Actions: Start/Stop -->
    <button
      @click="toggleAutoRefresh"
      :disabled="!allskyStore.isValid"
      class="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors shadow-lg flex-shrink-0"
      :class="
        allskyStore.autoRefresh
          ? 'bg-red-600 hover:bg-red-500 shadow-red-900/50'
          : 'bg-green-600 hover:bg-green-500 shadow-green-900/50'
      "
      :title="
        allskyStore.autoRefresh ? t('plugins.allsky.stopAuto') : t('plugins.allsky.startAuto')
      "
    >
      <svg
        v-if="!allskyStore.autoRefresh"
        class="w-5 h-5 md:w-6 md:h-6 fill-current"
        viewBox="0 0 24 24"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <svg v-else class="w-5 h-5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
      </svg>
    </button>

    <!-- 2. Actions: Settings -->
    <button
      @click="emit('open-settings')"
      class="w-10 h-10 md:w-12 md:h-12 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-full flex items-center justify-center transition-colors shadow-lg shadow-black/50 flex-shrink-0"
      :title="t('plugins.allsky.settings')"
    >
      <svg
        class="w-5 h-5 md:w-6 md:h-6 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.543-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        ></path>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        ></path>
      </svg>
    </button>

    <!-- 3. Status -->
    <div
      class="flex flex-row md:flex-col items-center gap-2 md:gap-3 ml-auto md:ml-0 md:mt-auto md:mb-16 flex-shrink-0"
    >
      <div
        class="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full flex-shrink-0"
        :class="
          allskyStore.isConnected
            ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.9)]'
            : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]'
        "
      ></div>
      <span
        class="hidden md:block text-xs font-bold text-gray-500 uppercase tracking-widest text-center"
        style="writing-mode: vertical-rl; transform: rotate(180deg)"
      >
        {{
          allskyStore.isConnected ? t('plugins.allsky.connected') : t('plugins.allsky.disconnected')
        }}
      </span>
      <span
        class="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
      >
        {{
          allskyStore.isConnected ? t('plugins.allsky.connected') : t('plugins.allsky.disconnected')
        }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useallskyStore } from '../store/allskyStore.js';

const { t } = useI18n();
const allskyStore = useallskyStore();
const emit = defineEmits(['open-settings']);

const toggleAutoRefresh = () => {
  if (allskyStore.autoRefresh) {
    allskyStore.stopAutoRefresh();
    allskyStore.updateDisplaySettings({ autoRefresh: false });
  } else {
    allskyStore.updateDisplaySettings({ autoRefresh: true });
    allskyStore.startAutoRefresh();
  }
};
</script>
