<template>
  <div class="space-y-3 pb-36">
    <Teleport to="body">
      <ControlSequence />
    </Teleport>

    <!-- Loading -->
    <div v-if="!store.loaded" class="flex items-center justify-center py-12 text-content-muted">
      <Spinner />
    </div>

    <template v-else>
      <!-- The layout is chosen in the sequence settings tab; both views work on the same tree.
           v-if: the simple view only costs anything while it is shown. -->
      <div
        v-if="viewMode === 'simple'"
        :class="sequenceStore.sequenceControlsLocked ? 'pointer-events-none opacity-60' : ''"
      >
        <SequenceSimpleView @show-full="settingsStore.setSequenceViewMode('full')" />
      </div>

      <!-- The view link stays outside the locked wrapper: switching the layout edits nothing.
           The full view has no way back here; that switch lives in the sequence settings tab. -->
      <button
        v-if="viewMode === 'simple'"
        type="button"
        class="w-full min-h-touch flex items-center justify-center gap-1 text-sm text-content-faint hover:text-content-muted"
        @click="settingsStore.setSequenceViewMode('full')"
      >
        {{ $t('components.sequence.simple.openExpert') }}
        <ChevronRightIcon class="w-4 h-4" />
      </button>

      <!-- v-show: keeps the expand/collapse state of the full tree across a switch. -->
      <div
        v-show="viewMode === 'full'"
        :class="sequenceStore.sequenceControlsLocked ? 'pointer-events-none opacity-60' : ''"
      >
        <!-- Global Triggers. Purple marks this section the way the dots below mark the
             areas; like the item category colors, it stays outside the design tokens. -->
        <div
          class="bg-surface-2/60 backdrop-blur-sm rounded-lg shadow-lg transition-all duration-200"
          :class="
            activeGlobal
              ? 'border border-purple-400/70 shadow-purple-500/20'
              : 'border border-purple-600/30'
          "
        >
          <div
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-3/30 rounded-t-lg select-none"
            @click="toggleSection('globalTriggers')"
          >
            <div class="flex items-center gap-2">
              <ChevronRightIcon
                class="w-4 h-4 text-content-muted transition-transform duration-200"
                :class="{ 'rotate-90': !collapsed.globalTriggers }"
              />
              <div class="w-2 h-2 bg-purple-400 rounded-full shadow-sm shadow-purple-400/50" />
              <span class="font-medium text-purple-200">{{
                $t('components.sequence.globalTriggers')
              }}</span>
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
            class="bg-surface-2/60 backdrop-blur-sm rounded-lg shadow-lg transition-all duration-200"
            :class="
              activeContainerMap[container.Id ?? idx]
                ? 'border border-blue-400/60 shadow-blue-500/20'
                : 'border border-line-strong'
            "
          >
            <!-- Container header -->
            <div
              class="flex items-center justify-between p-3 hover:bg-surface-3/30 rounded-t-lg select-none"
            >
              <div class="flex items-center gap-2">
                <ChevronRightIcon
                  class="w-4 h-4 text-content-muted transition-transform duration-200 cursor-pointer"
                  :class="{ 'rotate-90': !collapsed[container.Id ?? idx] }"
                  @click="toggleSection(container.Id ?? idx)"
                />
                <div class="w-2 h-2 rounded-full" :class="containerDot(idx)" />
                <span
                  class="font-medium text-content cursor-pointer"
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
                  class="pointer-events-none absolute inset-0 flex items-center justify-center text-content-faint text-xs"
                >
                  {{ $t('components.sequence.emptyContainer') }}
                </div>
              </div>
              <div v-else class="text-center py-4 text-content-faint text-xs">
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
        class="text-xs text-status-warn bg-status-warn/10 border border-status-warn/40 rounded-md px-3 py-2"
      >
        {{ $t('components.sequence.controlsLockedMessage') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue';
import draggable from 'vuedraggable';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import SequenceItem from './SequenceItem.vue';
import AddTypeButton from './AddTypeButton.vue';
import ControlSequence from './controlSequence.vue';
import SequenceSimpleView from './simple/SequenceSimpleView.vue';
import Spinner from '@/components/helpers/Spinner.vue';

const store = useSequenceV2Store();
const sequenceStore = useSequenceStore();
const settingsStore = useSettingsStore();

// Older persisted settings have no `sequence` block yet; they get the full view.
const viewMode = computed(() =>
  settingsStore.sequence?.viewMode === 'simple' ? 'simple' : 'full'
);
const backendStore = apiStore();
const collapsed = reactive({});
const activeGlobal = ref(false);
const activeContainerMap = reactive({});

function toggleSection(key) {
  collapsed[key] = !collapsed[key];
}

// The dots tell the areas apart, so they keep their own colors instead of the design tokens.
const DOT_COLORS = ['bg-blue-400', 'bg-green-400', 'bg-orange-400', 'bg-purple-400'];
function containerDot(idx) {
  return DOT_COLORS[idx] ?? 'bg-content-muted';
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
