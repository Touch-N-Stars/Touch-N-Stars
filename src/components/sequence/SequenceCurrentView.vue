<template>
  <div class="space-y-3 pb-36">
    <Teleport to="body">
      <ControlSequence />
    </Teleport>

    <!-- Loading -->
    <div v-if="!store.loaded" class="flex items-center justify-center py-12 text-slate-400">
      <svg class="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>

    <template v-else>
      <div :class="sequenceStore.sequenceControlsLocked ? 'pointer-events-none opacity-60' : ''">
        <!-- Global Triggers -->
        <div
          class="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg transition-all duration-200"
          :class="
            activeGlobal
              ? 'border border-purple-400/70 shadow-purple-500/20'
              : 'border border-purple-600/30'
          "
        >
          <div
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/30 rounded-t-lg select-none"
            @click="toggleSection('globalTriggers')"
          >
            <div class="flex items-center gap-2">
              <ChevronRightIcon
                class="w-4 h-4 text-slate-400 transition-transform duration-200"
                :class="{ 'rotate-90': !collapsed.globalTriggers }"
              />
              <div class="w-2 h-2 bg-purple-400 rounded-full shadow-sm shadow-purple-400/50" />
              <span class="font-medium text-purple-200">Global Trigger</span>
            </div>
          </div>
          <div v-if="!collapsed.globalTriggers" class="p-3 pt-0 space-y-1.5">
            <SequenceItem
              v-for="trigger in store.globalTriggers"
              :key="trigger.Id"
              :item="trigger"
              :siblings="store.globalTriggers"
            />
            <div class="flex justify-center mt-1">
              <AddTypeButton
                :targetId="store.globalTriggers.at(-1)?.Id ?? store.data[0]?.Id ?? ''"
                mode="trigger"
                :insertAfter="store.globalTriggers.length > 0 ? true : null"
                containerName="Global"
                @open-change="(v) => (activeGlobal = v)"
              />
            </div>
          </div>
        </div>

        <!-- Start / Targets / End containers -->
        <div class="space-y-3 mt-3">
          <div
            v-for="(container, idx) in store.containers"
            :key="container.Id ?? idx"
            class="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg transition-all duration-200"
            :class="
              activeContainerMap[container.Id ?? idx]
                ? 'border border-blue-400/60 shadow-blue-500/20'
                : 'border border-slate-600/50'
            "
          >
            <!-- Container header -->
            <div
              class="flex items-center justify-between p-3 hover:bg-slate-700/30 rounded-t-lg select-none"
            >
              <div class="flex items-center gap-2">
                <ChevronRightIcon
                  class="w-4 h-4 text-slate-400 transition-transform duration-200 cursor-pointer"
                  :class="{ 'rotate-90': !collapsed[container.Id ?? idx] }"
                  @click="toggleSection(container.Id ?? idx)"
                />
                <div class="w-2 h-2 rounded-full" :class="containerDot(idx)" />
                <span
                  class="font-medium text-gray-100 cursor-pointer"
                  @click="toggleSection(container.Id ?? idx)"
                  >{{ container.Name }}</span
                >
              </div>
            </div>

            <!-- Container body with draggable items -->
            <div v-if="!collapsed[container.Id ?? idx]" class="p-3 pt-0">
              <!-- Rendered even when empty, so rows from other containers can be dropped here.
                   The hint sits on top of the empty list and lets the drop through. -->
              <div v-if="container.Items" class="relative">
                <draggable
                  :list="container.Items"
                  item-key="Id"
                  handle=".drag-handle"
                  ghost-class="opacity-30"
                  :force-fallback="true"
                  class="space-y-1.5"
                  :class="{ 'min-h-12': !container.Items.length }"
                  :fallbackOnBody="true"
                  :disabled="sequenceStore.sequenceControlsLocked"
                  :group="store.canMoveAcrossContainers ? 'sequence-items' : null"
                  @change="(evt) => store.applyDrop(evt, container.Items, container.Id)"
                >
                  <template #item="{ element }">
                    <SequenceItem :item="element" :siblings="container.Items" />
                  </template>
                </draggable>
                <div
                  v-if="!container.Items.length"
                  class="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-600 text-xs"
                >
                  {{ $t('components.sequence.emptyContainer') }}
                </div>
              </div>
              <div v-else class="text-center py-4 text-slate-600 text-xs">
                {{ $t('components.sequence.emptyContainer') }}
              </div>
              <div class="flex justify-center mt-2">
                <AddTypeButton
                  :targetId="container.Items?.at(-1)?.Id ?? container.Id"
                  mode="item"
                  :insertAfter="(container.Items?.length ?? 0) > 0 ? true : null"
                  :containerName="container.Name"
                  @open-change="(v) => (activeContainerMap[container.Id ?? idx] = v)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="sequenceStore.sequenceControlsLocked"
        class="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-700/40 rounded-md px-3 py-2"
      >
        {{ $t('components.sequence.controlsLockedMessage') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted, onUnmounted } from 'vue';
import draggable from 'vuedraggable';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSequenceStore } from '@/store/sequenceStore';
import { apiStore } from '@/store/store';
import SequenceItem from './SequenceItem.vue';
import AddTypeButton from './AddTypeButton.vue';
import ControlSequence from './controlSequence.vue';

const store = useSequenceV2Store();
const sequenceStore = useSequenceStore();
const backendStore = apiStore();
const collapsed = reactive({});
const activeGlobal = ref(false);
const activeContainerMap = reactive({});

function toggleSection(key) {
  collapsed[key] = !collapsed[key];
}

const DOT_COLORS = ['bg-blue-400', 'bg-green-400', 'bg-orange-400', 'bg-purple-400'];
function containerDot(idx) {
  return DOT_COLORS[idx] ?? 'bg-slate-400';
}

// Restart polling when the backend comes back while this view is mounted:
// a transient connection loss runs clearAllStates(), which stops the poller
// without this view ever unmounting.
watch(
  () => backendStore.isBackendReachable,
  (reachable) => {
    if (reachable && !store.isFetching()) store.startPolling();
  }
);

onMounted(() => store.startPolling());
onUnmounted(() => store.stopPolling());
</script>
