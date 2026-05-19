<template>
  <div
    class="rounded-lg border transition-all duration-200"
    :class="[borderClass, hasChildren && depth > 0 ? depthLeftBorder : '', activeSectionRing]"
  >
    <!-- Item header row -->
    <div class="flex items-center gap-1.5 px-2 py-2">
      <!-- Drag handle -->
      <span
        class="drag-handle flex-shrink-0 p-1 text-slate-600 transition-colors touch-none"
        :class="
          isLocked
            ? 'cursor-not-allowed opacity-40'
            : 'cursor-grab active:cursor-grabbing hover:text-slate-400'
        "
        :title="$t('components.sequence.move')"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M7 2a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zm-6 6a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zm-6 6a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4z"
          />
        </svg>
      </span>

      <!-- Collapse chevron -->
      <button
        v-if="hasChildren"
        class="flex-shrink-0 p-0.5 rounded hover:bg-slate-600/40 transition-colors"
        @click.stop="collapsed = !collapsed"
      >
        <ChevronRightIcon
          class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-90': !collapsed }"
        />
      </button>
      <span v-else class="w-4 flex-shrink-0" />

      <!-- Type component (display + edit) -->
      <component :is="typeComponent" :item="item" class="flex-1 min-w-0" />

      <!-- More menu -->
      <div class="flex-shrink-0" ref="moreRef">
        <button
          class="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-600/40 transition-colors"
          :title="$t('components.sequence.more')"
          :disabled="isLocked"
          @click.stop="toggleMore"
        >
          <EllipsisVerticalIcon class="w-4 h-4" />
        </button>
        <Teleport to="body">
          <div
            v-if="moreOpen"
            class="fixed z-[9999] bg-gray-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-max"
            :style="moreStyle"
            @click.stop
          >
            <button class="menu-item" :disabled="isLocked" @click="doAction('duplicate')">
              <DocumentDuplicateIcon class="w-4 h-4" /> {{ $t('components.sequence.duplicate') }}
            </button>
            <button class="menu-item" :disabled="isLocked" @click="doAction('toggle-enable')">
              <component
                :is="item.Status === 'DISABLED' ? PlayCircleIcon : PauseCircleIcon"
                class="w-4 h-4"
              />
              {{
                item.Status === 'DISABLED'
                  ? $t('components.sequence.enable')
                  : $t('components.sequence.disable')
              }}
            </button>
            <button class="menu-item" :disabled="isLocked" @click="doAction('reset')">
              <ArrowPathIcon class="w-4 h-4" /> {{ $t('components.sequence.resetStatus') }}
            </button>
            <div class="border-t border-slate-700 my-1" />
            <button
              class="menu-item text-red-400 hover:text-red-300 hover:bg-red-900/20"
              :disabled="isLocked"
              @click="doAction('remove')"
            >
              <TrashIcon class="w-4 h-4" /> {{ $t('components.sequence.delete') }}
            </button>
          </div>
        </Teleport>
      </div>
    </div>

    <!-- Children with nested draggable -->
    <div v-if="!collapsed && hasChildren" class="px-2 pb-2">
      <!-- Sky chart for DSO container -->
      <SkyChart
        v-if="dsoTarget && settingsStore.coordinates.latitude !== null"
        :target="dsoTarget"
        :coordinates="settingsStore.coordinates"
        class="mb-1.5"
      />

      <!-- Triggers -->
      <div
        v-if="item.Triggers !== undefined"
        class="mb-1.5 rounded-lg p-1.5 space-y-1 transition-all duration-200"
        :class="
          activeSection === 'trigger'
            ? 'border border-cyan-400/80 bg-cyan-950/30 shadow-lg shadow-cyan-500/30'
            : 'border border-cyan-600/30 bg-cyan-950/10'
        "
      >
        <div class="px-1">
          <span class="text-xs text-cyan-400/70">{{ $t('components.sequence.triggers') }}</span>
        </div>
        <draggable
          :list="item.Triggers"
          item-key="Id"
          handle=".drag-handle"
          ghost-class="opacity-30"
          :force-fallback="true"
          class="space-y-1"
          :fallbackOnBody="true"
          :disabled="isLocked"
          @end="(evt) => onSiblingDragEnd(evt, item.Triggers)"
        >
          <template #item="{ element }">
            <SequenceItem
              :item="element"
              :siblings="item.Triggers"
              :depth="depth + 1"
              class="border-cyan-600/30"
            />
          </template>
        </draggable>
        <div v-if="canAdd && !isLocked" class="flex justify-center mt-1">
          <AddTypeButton
            :targetId="item.Triggers?.at(-1)?.Id ?? item.Id"
            mode="trigger"
            :insertAfter="(item.Triggers?.length ?? 0) > 0 ? true : null"
            :containerName="item.Name"
            @open-change="(v) => onAddSectionActive('trigger', v)"
          />
        </div>
      </div>

      <!-- Conditions -->
      <div
        v-if="item.Conditions !== undefined"
        class="mb-1.5 rounded-lg p-1.5 space-y-1 transition-all duration-200"
        :class="
          activeSection === 'condition'
            ? 'border border-amber-400/80 bg-amber-950/30 shadow-lg shadow-amber-500/30'
            : 'border border-amber-600/30 bg-amber-950/10'
        "
      >
        <div class="px-1">
          <span class="text-xs text-amber-400/70">{{ $t('components.sequence.conditions') }}</span>
        </div>
        <draggable
          :list="item.Conditions"
          item-key="Id"
          handle=".drag-handle"
          ghost-class="opacity-30"
          :force-fallback="true"
          class="space-y-1"
          :fallbackOnBody="true"
          :disabled="isLocked"
          @end="(evt) => onSiblingDragEnd(evt, item.Conditions)"
        >
          <template #item="{ element }">
            <SequenceItem
              :item="element"
              :siblings="item.Conditions"
              :depth="depth + 1"
              class="border-amber-600/30"
            />
          </template>
        </draggable>
        <div v-if="canAdd && !isLocked" class="flex justify-center mt-1">
          <AddTypeButton
            :targetId="item.Conditions?.at(-1)?.Id ?? item.Id"
            mode="condition"
            :insertAfter="(item.Conditions?.length ?? 0) > 0 ? true : null"
            :containerName="item.Name"
            @open-change="(v) => onAddSectionActive('condition', v)"
          />
        </div>
      </div>

      <div
        class="rounded-lg transition-all duration-200"
        :class="
          activeSection === 'item'
            ? 'ring-1 ring-blue-400/70 bg-blue-950/15 shadow-lg shadow-blue-500/30'
            : ''
        "
      >
        <draggable
          :list="item.Items"
          item-key="Id"
          handle=".drag-handle"
          ghost-class="opacity-30"
          :force-fallback="true"
          class="space-y-1.5"
          :fallbackOnBody="true"
          :disabled="isLocked"
          @end="(evt) => onChildDragEnd(evt)"
        >
          <template #item="{ element }">
            <SequenceItem :item="element" :siblings="item.Items" :depth="depth + 1" />
          </template>
        </draggable>

        <!-- Add item button at bottom, centered -->
        <div
          v-if="item.Items !== undefined && canAdd && !isLocked"
          class="flex justify-center mt-2"
        >
          <AddTypeButton
            :targetId="item.Items?.at(-1)?.Id ?? item.Id"
            mode="item"
            :insertAfter="(item.Items?.length ?? 0) > 0 ? true : null"
            :containerName="item.Name"
            @open-change="(v) => onAddSectionActive('item', v)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import SkyChart from '@/components/framing/SkyChart.vue';
import AddTypeButton from './AddTypeButton.vue';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceStore } from '@/store/sequenceStore';
import draggable from 'vuedraggable';
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  ArrowPathIcon,
  PlayCircleIcon,
  PauseCircleIcon,
} from '@heroicons/vue/24/outline';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { ITEM_COMPONENTS, GenericItem } from './items/index.js';
import OrbitalObjectContainerItem from './items/OrbitalObjectContainerItem.vue';

const NO_ADD_TYPES = new Set(['NINA.Sequencer.SequenceItem.Imaging.SmartExposure']);
const NO_EXPAND_TYPES = new Set([
  'NINA.Sequencer.SequenceItem.Imaging.SmartExposure',
  'NINA.Sequencer.SequenceItem.Imaging.TakeManyExposures',
  'NINA.Sequencer.SequenceItem.FlatDevice.AutoBrightnessFlat',
  'NINA.Sequencer.SequenceItem.FlatDevice.AutoExposureFlat',
  'NINA.Sequencer.SequenceItem.FlatDevice.SkyFlat',
  'NINA.Sequencer.SequenceItem.FlatDevice.TrainedDarkFlatExposure',
  'NINA.Sequencer.SequenceItem.FlatDevice.TrainedFlatExposure',
]);

const props = defineProps({
  item: { type: Object, required: true },
  siblings: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 },
});

const canAdd = computed(() => !NO_ADD_TYPES.has(props.item.FullTypeName));
const isNoExpand = computed(() => NO_EXPAND_TYPES.has(props.item.FullTypeName));

const store = useSequenceV2Store();
const sequenceStore = useSequenceStore();
const settingsStore = useSettingsStore();
const collapsed = ref(false);
const activeSection = ref(null);
const isLocked = computed(() => sequenceStore.sequenceControlsLocked);

function onAddSectionActive(mode, isOpen) {
  activeSection.value = isOpen ? mode : null;
}

const activeSectionRing = computed(() => {
  if (activeSection.value === 'trigger')
    return 'ring-1 ring-cyan-400/70 shadow-lg shadow-cyan-500/40';
  if (activeSection.value === 'condition')
    return 'ring-1 ring-amber-400/70 shadow-lg shadow-amber-500/40';
  if (activeSection.value === 'item') return 'ring-1 ring-blue-400/70 shadow-lg shadow-blue-500/40';
  return '';
});
const moreOpen = ref(false);
const moreRef = ref(null);
const moreStyle = ref({});

function toggleMore() {
  if (isLocked.value) return;

  if (moreOpen.value) {
    moreOpen.value = false;
    return;
  }
  if (moreRef.value) {
    const rect = moreRef.value.getBoundingClientRect();
    const menuWidth = 160;
    let left = rect.right - menuWidth;
    if (left < 4) left = 4;
    moreStyle.value = { top: `${rect.bottom + 4}px`, left: `${left}px` };
  }
  moreOpen.value = true;
}

const hasChildren = computed(
  () =>
    !isNoExpand.value &&
    (props.item.Items?.length > 0 ||
      props.item.Triggers !== undefined ||
      props.item.Conditions !== undefined)
);

const dsoTarget = computed(() => {
  const t = props.item.Target;
  if (!t) return null;
  // string format: "RA: 00:42:44; Dec: 41° 16' 07\"; Epoch: J2000; Position Angle: 0"
  if (typeof t === 'string') {
    const raMatch = t.match(/RA:\s*(\d+):(\d+):([\d.]+)/);
    const decMatch = t.match(/Dec:\s*(-?)(\d+)°\s*(\d+)'\s*([\d.]+)"/);
    if (!raMatch || !decMatch) return null;
    const raH = parseInt(raMatch[1]) + parseInt(raMatch[2]) / 60 + parseFloat(raMatch[3]) / 3600;
    const decAbs =
      parseInt(decMatch[2]) + parseInt(decMatch[3]) / 60 + parseFloat(decMatch[4]) / 3600;
    return { RA: raH * 15, Dec: decMatch[1] === '-' ? -decAbs : decAbs };
  }
  // object format (legacy)
  const co = t.InputCoordinates;
  if (!co) return null;
  const raH = (co.RAHours ?? 0) + (co.RAMinutes ?? 0) / 60 + (co.RASeconds ?? 0) / 3600;
  const decAbs = Math.abs(co.DecDegrees ?? 0) + (co.DecMinutes ?? 0) / 60 + (co.DecSeconds ?? 0) / 3600;
  return { RA: raH * 15, Dec: (co.NegativeDec || (co.DecDegrees ?? 0) < 0) ? -decAbs : decAbs };
});
const typeComponent = computed(() => {
  if (store.orbitalItems[props.item.Id]) return OrbitalObjectContainerItem;
  return ITEM_COMPONENTS[props.item.FullTypeName] ?? GenericItem;
});

const DEPTH_BORDERS = [
  'border-l-2 border-l-blue-500/60',
  'border-l-2 border-l-violet-500/60',
  'border-l-2 border-l-fuchsia-500/60',
  'border-l-2 border-l-rose-500/60',
];

const depthLeftBorder = computed(() => DEPTH_BORDERS[(props.depth - 1) % DEPTH_BORDERS.length]);

const borderClass = computed(() => {
  const s = props.item.Status;
  if (s === 'RUNNING') return 'border-green-500/50 shadow-lg shadow-green-500/35';
  if (s === 'FINISHED') return 'border-emerald-600/30 bg-emerald-950/10';
  if (s === 'DISABLED') return 'border-slate-700/30 bg-slate-900/20 opacity-60';
  return 'border-slate-600/30 bg-slate-800/30';
});

async function doAction(action) {
  if (isLocked.value) return;

  moreOpen.value = false;
  const id = props.item.Id;
  if (!id) return;
  if (action === 'duplicate') await store.duplicate(id);
  if (action === 'toggle-enable') await store.enable(id, props.item.Status === 'DISABLED');
  if (action === 'reset') await store.resetStatus(id);
  if (action === 'remove') await store.remove(id);
}

function onChildDragEnd(evt) {
  if (isLocked.value) return;
  if (evt.oldIndex === evt.newIndex) return;
  const siblings = props.item.Items;
  const movedId = siblings[evt.newIndex].Id;
  const newIdx = evt.newIndex;
  if (newIdx === 0) {
    store.move(movedId, siblings[1]?.Id, false);
  } else {
    store.move(movedId, siblings[newIdx - 1]?.Id, true);
  }
}

function onSiblingDragEnd(evt, siblings) {
  if (isLocked.value) return;
  if (evt.oldIndex === evt.newIndex) return;
  const movedId = siblings[evt.newIndex].Id;
  const newIdx = evt.newIndex;
  if (newIdx === 0) {
    store.move(movedId, siblings[1]?.Id, false);
  } else {
    store.move(movedId, siblings[newIdx - 1]?.Id, true);
  }
}

function onOutsideClick(e) {
  if (moreRef.value && !moreRef.value.contains(e.target)) {
    moreOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', onOutsideClick));
onUnmounted(() => document.removeEventListener('click', onOutsideClick));
</script>

<style scoped>
.menu-item {
  @apply flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/60 transition-colors;
}
</style>
