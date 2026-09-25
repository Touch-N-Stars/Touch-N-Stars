<template>
  <!-- @container: the editor rows and the header below size themselves against the item's own
       width, which shrinks with nesting depth, rather than against the viewport. Note that
       container-type also makes this a containing block for position:fixed -- both popovers
       here teleport to body, and the draggable lists live in SequenceItem, not in here. -->
  <div class="@container flex-1 min-w-0">
    <!-- Header: left=name+summary, right=badges+edit (vertically centered) -->
    <div class="flex items-center gap-1.5">
      <!-- Left: name + summary stacked -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <component
            :is="itemIcon"
            v-if="itemIcon"
            class="w-3.5 h-3.5 shrink-0"
            :class="itemIconColor"
          />
          <span
            class="text-sm font-medium text-gray-200 truncate min-w-0 @max-[18rem]:whitespace-normal @max-[18rem]:line-clamp-2"
            >{{ displayName }}</span
          >
          <span v-if="label" class="shrink-0 text-xs text-slate-500 font-normal">{{ label }}</span>
        </div>
        <div v-if="$slots.summary" class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <slot name="summary" />
        </div>
      </div>

      <!-- Right: badges + edit, centered relative to full height -->
      <div class="shrink-0 flex items-center gap-1.5">
        <!-- Issues badge -->
        <button
          v-if="issues.length"
          ref="issuesRef"
          class="flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-1.5 py-0.5 text-xs hover:bg-red-500/30 transition-colors"
          @click.stop="toggleIssues"
        >
          <ExclamationTriangleIcon class="w-3 h-3" />
          {{ issues.length }}
        </button>
        <Teleport to="body">
          <div
            v-if="issuesOpen"
            class="fixed z-[9999] bg-gray-800 border border-red-700/40 rounded-lg shadow-xl py-2 px-3 min-w-max max-w-xs"
            :style="issuesStyle"
            @click.stop
          >
            <p
              v-for="(iss, i) in issues"
              :key="i"
              class="text-red-300 text-xs flex items-start gap-1.5 py-0.5"
            >
              <ExclamationTriangleIcon class="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {{ iss }}
            </p>
          </div>
        </Teleport>

        <!-- Status badge -->
        <span
          v-if="status && status !== 'CREATED'"
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="statusColor(status)"
        >
          {{ status }}
        </span>

        <!-- Edit toggle -->
        <button
          v-if="hasEditor"
          class="p-1 rounded transition-colors"
          :class="
            isRunning
              ? 'text-slate-700 cursor-not-allowed'
              : editing
                ? 'text-cyan-400 hover:bg-slate-600/40'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-600/40'
          "
          :disabled="isRunning"
          :title="isRunning ? $t('components.sequence.runningLocked') : $t('common.edit')"
          @click.stop="editing = !editing"
        >
          <PencilSquareIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Edit panel -->
    <div v-if="editing && hasEditor" class="border-t border-slate-700/50 mt-1 pt-2 space-y-2">
      <!-- Issues list -->
      <div
        v-if="issues.length"
        class="bg-red-900/20 border border-red-700/40 rounded-lg p-2 space-y-0.5"
      >
        <p v-for="(iss, i) in issues" :key="i" class="text-red-300 text-xs flex items-start gap-1">
          <ExclamationTriangleIcon class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {{ iss }}
        </p>
      </div>

      <!-- Type-specific editor fields -->
      <slot name="editor" :save="save" :saving="saving" />

      <!-- Saving indicator -->
      <div v-if="saving" class="text-xs text-cyan-400 flex items-center gap-1">
        <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        {{ $t('components.sequence.items.saving') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, useSlots, onMounted, onUnmounted } from 'vue';
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  CameraIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ViewfinderCircleIcon,
  GlobeAltIcon,
  ArrowsPointingInIcon,
  SunIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowPathIcon,
  HomeIcon,
  LinkIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
  CodeBracketIcon,
  ArrowPathRoundedSquareIcon,
  ChartBarIcon,
  MoonIcon,
  RectangleGroupIcon,
  StarIcon,
  SparklesIcon,
  PhotoIcon,
  ArrowsPointingOutIcon,
  AdjustmentsVerticalIcon,
  QueueListIcon,
  ViewColumnsIcon,
  BellAlertIcon,
  CommandLineIcon,
} from '@heroicons/vue/24/outline';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { displayIssues, displayStatus } from '@/utils/sequenceStatus';

const props = defineProps({
  item: { type: Object, required: true },
  label: { type: String, default: '' },
});

const slots = useSlots();
const store = useSequenceV2Store();
const editing = ref(false);
const saving = ref(false);
const issuesOpen = ref(false);
const issuesRef = ref(null);
const issuesStyle = ref({});

function toggleIssues() {
  if (issuesOpen.value) {
    issuesOpen.value = false;
    return;
  }
  if (issuesRef.value) {
    const rect = issuesRef.value.getBoundingClientRect();
    const left = Math.max(4, rect.right - 240);
    issuesStyle.value = { top: `${rect.bottom + 4}px`, left: `${left}px` };
  }
  issuesOpen.value = true;
}

function onOutsideClick(e) {
  if (issuesRef.value && !issuesRef.value.contains(e.target)) {
    issuesOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', onOutsideClick));
onUnmounted(() => document.removeEventListener('click', onOutsideClick));

const hasEditor = computed(() => !!slots.editor);

// An item the sequencer is executing must not be edited. This also covers the composite
// items (SmartExposure, the flat items, TakeManyExposures), whose editors write to the
// ids of their hidden children rather than to this item's own id.
const isRunning = computed(() => props.item.Status === 'RUNNING');
watch(isRunning, (running) => {
  if (running) editing.value = false;
});

// A composite item hides its children, so their failure and their issues show on it.
const status = computed(() => displayStatus(props.item));
const issues = computed(() => displayIssues(props.item));

const ICON_MAP = [
  // Containers
  ['NINA.Sequencer.Container.DeepSkyObjectContainer', StarIcon, 'text-violet-400'],
  ['NINA.Sequencer.Container.SequentialContainer', QueueListIcon, 'text-blue-400'],
  ['NINA.Sequencer.Container.ParallelContainer', ViewColumnsIcon, 'text-indigo-400'],
  ['NINA.Sequencer.Container', RectangleGroupIcon, 'text-blue-400'],
  // Imaging
  ['SequenceItem.Imaging', CameraIcon, 'text-cyan-400'],
  // Autofocus
  ['SequenceItem.Autofocus', AdjustmentsHorizontalIcon, 'text-green-400'],
  ['Trigger.Autofocus', AdjustmentsHorizontalIcon, 'text-green-400'],
  // FilterWheel
  ['FilterWheel', FunnelIcon, 'text-purple-400'],
  // Platesolving
  ['Platesolving', ViewfinderCircleIcon, 'text-cyan-300'],
  // Telescope
  ['SequenceItem.Telescope', GlobeAltIcon, 'text-blue-300'],
  // Guider
  ['SequenceItem.Guider', ArrowsPointingInIcon, 'text-teal-400'],
  ['Trigger.Guider', ArrowsPointingInIcon, 'text-teal-400'],
  // FlatDevice
  ['FlatDevice', SunIcon, 'text-yellow-400'],
  // Camera equipment
  ['SequenceItem.Camera', BoltIcon, 'text-sky-400'],
  // Safety Monitor
  ['SafetyMonitor', ShieldCheckIcon, 'text-emerald-400'],
  ['Conditions.SafetyMonitor', ShieldCheckIcon, 'text-emerald-400'],
  // Switch
  ['SequenceItem.Switch', AdjustmentsVerticalIcon, 'text-orange-400'],
  // Rotator
  ['Rotator', ArrowPathIcon, 'text-indigo-400'],
  // Dome
  ['Dome', HomeIcon, 'text-slate-300'],
  // Connect / Profile
  ['Connect', LinkIcon, 'text-slate-400'],
  ['SwitchProfile', LinkIcon, 'text-slate-400'],
  // Utility – Wait items
  ['Utility.Wait', ClockIcon, 'text-amber-400'],
  ['Utility.WaitFor', ClockIcon, 'text-amber-400'],
  // Utility – Annotation / MessageBox
  ['Utility.Annotation', ChatBubbleLeftIcon, 'text-slate-400'],
  ['Utility.MessageBox', ChatBubbleLeftIcon, 'text-slate-400'],
  ['Utility.ExternalScript', CommandLineIcon, 'text-slate-400'],
  // Expressions / Variables
  ['Expressions', CodeBracketIcon, 'text-pink-400'],
  // Conditions
  ['Conditions.Moon', MoonIcon, 'text-slate-300'],
  ['Conditions.Sun', SunIcon, 'text-yellow-300'],
  ['Conditions.Altitude', ChartBarIcon, 'text-amber-300'],
  ['Conditions.AboveHorizon', ChartBarIcon, 'text-amber-300'],
  ['Conditions.Time', ClockIcon, 'text-amber-400'],
  ['Conditions.Loop', ArrowPathRoundedSquareIcon, 'text-amber-400'],
  ['Conditions', ArrowPathRoundedSquareIcon, 'text-amber-400'],
  // Triggers
  ['Trigger.Platesolving', ViewfinderCircleIcon, 'text-cyan-300'],
  ['Trigger.MeridianFlip', ArrowPathIcon, 'text-orange-300'],
  ['Trigger.Connect', LinkIcon, 'text-slate-400'],
  ['Trigger.Dome', HomeIcon, 'text-slate-300'],
  ['ninaAPI', BoltIcon, 'text-red-400'],
  // Polar Alignment
  ['PolarAlignment', ArrowsPointingOutIcon, 'text-blue-300'],
  // PHD2
  ['phd2', SparklesIcon, 'text-cyan-400'],
  ['Phd2', SparklesIcon, 'text-cyan-400'],
  ['RMS', SparklesIcon, 'text-cyan-400'],
  // Livestack
  ['Livestack', PhotoIcon, 'text-violet-300'],
  // Ground Station
  ['DaleGhent.NINA.GroundStation', BellAlertIcon, 'text-rose-400'],
];

const itemIcon = computed(() => {
  const t = props.item.FullTypeName ?? '';
  for (const [pattern, icon] of ICON_MAP) {
    if (t.includes(pattern)) return icon;
  }
  return null;
});

const itemIconColor = computed(() => {
  const t = props.item.FullTypeName ?? '';
  for (const [pattern, , color] of ICON_MAP) {
    if (t.includes(pattern)) return color;
  }
  return 'text-slate-400';
});

const displayName = computed(() => {
  if (props.item.Name) return props.item.Name;
  const short = props.item.FullTypeName?.split('.')?.at(-1) ?? '';
  return short.replace(/([A-Z])/g, ' $1').trim();
});

async function save(key, value) {
  if (isRunning.value) return;
  saving.value = true;
  await store.setProperty(props.item.Id, key, value);
  saving.value = false;
}

function statusColor(status) {
  switch (status) {
    case 'FINISHED':
      return 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50';
    case 'RUNNING':
      return 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50';
    case 'FAILED':
      return 'bg-red-500/30 text-red-200 border border-red-400/50';
    case 'SKIPPED':
      return 'bg-gray-500/30 text-gray-300 border border-gray-400/50';
    case 'DISABLED':
      return 'bg-gray-700/50 text-gray-500 border border-gray-600/50';
    default:
      return 'bg-gray-600/30 text-gray-300 border border-gray-500/50';
  }
}
</script>
