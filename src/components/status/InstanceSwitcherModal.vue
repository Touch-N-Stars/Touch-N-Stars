<template>
  <Modal show zIndex="z-top" maxWidth="max-w-sm" @close="$emit('close')">
    <template #header>
      <h2 class="text-xl font-bold">{{ $t('components.instanceSwitcher.title') }}</h2>
    </template>
    <template #body>
      <div class="w-full">
        <!-- Loading -->
        <div
          v-if="checking"
          class="flex items-center justify-center py-8 gap-3 text-content-muted text-sm"
        >
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {{ $t('components.instanceSwitcher.checking') }}
        </div>

        <!-- Instance List -->
        <div v-else class="space-y-2 max-h-72 overflow-y-auto">
          <div
            v-if="visibleInstances.length === 0"
            class="text-center py-6 text-content-muted text-sm"
          >
            {{ $t('components.instanceSwitcher.noneOnline') }}
          </div>

          <button
            v-for="(instance, index) in visibleInstances"
            :key="instance.id"
            @click="selectInstance(instance.id)"
            class="w-full text-left p-3 rounded-lg border transition-all duration-150 flex items-center gap-3"
            :class="
              instance.id === selectedInstanceId
                ? 'border-accent/50 bg-accent/20 ring-1 ring-accent'
                : 'border-line-strong hover:border-line-strong hover:bg-surface-3'
            "
          >
            <!-- Color dot -->
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :class="
                getDotColor(settingsStore.getInstanceColorByIndex(getOriginalIndex(instance)))
              "
            />

            <!-- Name + address -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">{{ instance.name }}</p>
              <p class="text-xs text-content-muted truncate">
                {{ instance.ip }}:{{ instance.port }}
              </p>
            </div>

            <!-- Active indicator -->
            <div v-if="instance.id === selectedInstanceId" class="flex items-center gap-1 shrink-0">
              <span class="w-2 h-2 rounded-full bg-status-ok" />
              <span class="text-xs text-status-ok">{{
                $t('components.instanceSwitcher.active')
              }}</span>
            </div>
          </button>
        </div>

        <!-- Footer -->
        <div class="mt-4 pt-4 border-t border-line">
          <router-link
            to="/settings"
            @click="$emit('close')"
            class="flex items-center justify-center gap-2 w-full py-2 text-sm text-content-muted hover:text-accent transition-colors"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {{ $t('components.instanceSwitcher.manageInstances') }}
          </router-link>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import axios from 'axios';
import { useSettingsStore } from '@/store/settingsStore';

const emit = defineEmits(['close']);

const settingsStore = useSettingsStore();
const checking = ref(true);
const onlineIds = ref([]);

const instances = computed(() => settingsStore.connection.instances);
const selectedInstanceId = computed(() => settingsStore.selectedInstanceId);

const visibleInstances = computed(() =>
  instances.value.filter((i) => onlineIds.value.includes(i.id))
);

function getOriginalIndex(instance) {
  return instances.value.findIndex((i) => i.id === instance.id);
}

function getDotColor(bgClass) {
  return bgClass.replace(/-\d{3}(\/\d+)?$/, '-400');
}

function selectInstance(id) {
  settingsStore.setSelectedInstanceId(id);
  emit('close');
}

async function isInstanceOnline(instance) {
  const response = await axios.get(`http://${instance.ip}:${instance.port}/api/get-api-port`, {
    timeout: 500,
  });
  // Global interceptor swallows network errors and returns { data: { Success: false } }
  // A real response from the TNS plugin returns a port number
  if (response?.data?.Success === false) return false;
  if (response?.status >= 400) return false;
  return typeof response?.data === 'number' && response.data !== -1;
}

onMounted(async () => {
  const results = await Promise.all(
    instances.value.map(async (instance) => {
      const online = await isInstanceOnline(instance);
      return online ? instance.id : null;
    })
  );
  onlineIds.value = results.filter((id) => id !== null);
  checking.value = false;
});
</script>
