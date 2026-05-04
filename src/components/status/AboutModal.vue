<template>
  <div
    class="fixed inset-0 z-top flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
    @click.self="handleOutsideClick"
  >
    <div
      class="bg-gray-800/95 rounded-xl p-8 max-w-md w-full mx-4 relative shadow-2xl transform transition-all duration-300 ease-out"
      :class="{ 'scale-95 opacity-0': !isMounted, 'scale-100 opacity-100': isMounted }"
      @click.stop
    >
      <div class="flex justify-between items-center mb-8 pb-6 border-b border-gray-700/50">
        <h2 class="text-2xl font-bold text-gray-100 tracking-tight">About Touch-N-Stars</h2>
        <button
          @click="$emit('close')"
          class="p-2 hover:bg-gray-700/50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 transform hover:rotate-90 transition-transform duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div
        class="space-y-6 overflow-y-auto max-h-[50vh] pr-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800/50"
      >
        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Version</span>
          </h3>
          <p class="text-gray-300 pl-7">Touch 'N' Stars: {{ version }}</p>
          <p v-if="store.isPINS" class="text-gray-300 pl-7 mt-1">
            PINS: {{ store.currentPinsVersion || 'Unknown' }}
          </p>
        </div>

        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3.94 6.06a8 8 0 1112.12 0 8 8 0 01-12.12 0zm10.607 1.414a6 6 0 10-8.485 0 6 6 0 008.485 0zM10 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Website</span>
          </h3>
          <a
            href="https://touch-n-stars.eu"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 transition-colors duration-200 pl-7 flex items-center space-x-2 break-all"
          >
            <span>https://touch-n-stars.eu</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
              />
              <path
                d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
              />
            </svg>
          </a>
        </div>

        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 2a8 8 0 100 16 8 8 0 000-16zM4 10a6 6 0 1112 0 6 6 0 01-12 0zm6-3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 100-2h-2V8a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Copyright</span>
          </h3>
          <p class="text-gray-300 pl-7">© {{ currentYear }} Touch-N-Stars</p>
        </div>

        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l5-2a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"
              />
            </svg>
            <span>Application Overview</span>
          </h3>
          <p class="text-gray-300 pl-7 leading-relaxed">
            Nina astro control plugin for managing astronomical equipment and sequences.
          </p>
        </div>

        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
            <span @click="startBad">GitHub Repository</span>
          </h3>
          <a
            href="https://github.com/Touch-N-Stars/Touch-N-Stars"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 transition-colors duration-200 pl-7 flex items-center space-x-2"
          >
            <span>https://github.com/Touch-N-Stars/Touch-N-Stars</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
              />
              <path
                d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
              />
            </svg>
          </a>
        </div>

        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Used Modules</span>
          </h3>
          <ul class="text-gray-300 list-disc list-inside space-y-2 pl-7">
            <li
              class="hover:text-gray-100 transition-colors duration-200 flex items-center space-x-2"
            >
              <span>Vue.js</span>
            </li>
            <li
              class="hover:text-gray-100 transition-colors duration-200 flex items-center space-x-2"
            >
              <span>Tailwind CSS</span>
            </li>
            <li
              class="hover:text-gray-100 transition-colors duration-200 flex items-center space-x-2"
            >
              <span>NINA Advanced API</span>
            </li>
            <li
              class="hover:text-gray-100 transition-colors duration-200 flex items-center space-x-2"
            >
              <span>WebSocket</span>
            </li>
          </ul>
        </div>

        <!-- Neuer Eintrag: Stellarium Web Engine -->
        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l5-2a1 1 0 000-1.838l-7-3z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Stellarium Web Engine</span>
          </h3>
          <a
            href="https://github.com/Stellarium/stellarium-web-engine"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 transition-colors duration-200 pl-7 flex items-center space-x-2"
          >
            <span>https://github.com/Stellarium/stellarium-web-engine</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
              />
              <path
                d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
              />
            </svg>
          </a>
        </div>

        <!-- Neuer Eintrag: HiPS Images -->
        <div
          class="bg-gray-700/20 p-5 rounded-xl hover:bg-gray-700/30 transition-colors duration-200"
        >
          <h3 class="font-semibold text-gray-100 mb-3 flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l5-2a1 1 0 000-1.838l-7-3z"
                clip-rule="evenodd"
              />
            </svg>
            <span>HiPS Images</span>
          </h3>
          <a
            href="https://archive.stsci.edu/dss/copyright.html"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 transition-colors duration-200 pl-7 flex items-center space-x-2"
          >
            <span>https://archive.stsci.edu/dss/copyright.html</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
              />
              <path
                d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';

const settingsStore = useSettingsStore();
const store = apiStore();
const emit = defineEmits(['close']);
const count = ref(0);
const currentYear = new Date().getFullYear();

function startBad() {
  count.value++;
  if (count.value === 3) {
    alert('Augenschmerz Markierer aktiviert.');
    settingsStore.showSpecial = true;
  }
  if (count.value === 4) {
    alert('vorbei der spaß ');
    settingsStore.showSpecial = false;
  }
}

function handleOutsideClick(event) {
  emit('close');
  // Stop propagation to prevent parent modals from opening
  if (event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
}

const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

defineProps({
  version: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
/* Mobile optimization */
@media (max-width: 640px) {
  .max-w-md {
    margin: 1rem;
    padding: 1.5rem;
  }
}

/* Smooth scroll behavior */
.scrollbar-thin {
  scrollbar-width: thin;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 20px;
}
</style>
