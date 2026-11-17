<template>
  <div class="space-y-3">
    <!-- Totals -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ $t('components.sequence.simple.targets') }}</span>
        <span class="tns-stat-value">{{ summary.targets.length }}</span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ $t('components.sequence.simple.remaining') }}</span>
        <span class="tns-stat-value">≈ {{ formatDuration(summary.remainingSeconds) }}</span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ $t('components.sequence.simple.total') }}</span>
        <span class="tns-stat-value">{{ formatDuration(summary.totalSeconds) }}</span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ $t('components.sequence.simple.finishAt') }}</span>
        <span class="tns-stat-value">
          {{ summary.remainingSeconds ? `≈ ${formatClock(summary.endMs)}` : '–' }}
        </span>
      </div>
    </div>

    <p class="text-[11px] text-content-faint">
      {{ $t('components.sequence.simple.estimateHint') }}
    </p>

    <!-- Switches for the global triggers and the start area -->
    <SimpleGlobalSection @show-full="$emit('show-full')" />
    <SimpleStartSection @show-full="$emit('show-full')" />

    <!-- Targets -->
    <SimpleTargetCard
      v-for="(target, index) in summary.targets"
      :key="target.container.Id"
      :target="target"
      :canMoveUp="index > 0"
      :canMoveDown="index < summary.targets.length - 1"
    />

    <div v-if="!summary.targets.length" class="tns-card space-y-3 text-center">
      <p class="text-sm text-content-faint">{{ $t('components.sequence.simple.empty') }}</p>
      <button
        type="button"
        class="tns-btn-primary"
        :disabled="!hasTargetArea || adding"
        @click="addFirstTarget"
      >
        <PlusIcon class="w-4 h-4" />
        {{ $t('components.sequence.simple.addTarget') }}
      </button>
    </div>

    <SimpleEndSection @show-full="$emit('show-full')" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';
import SimpleEndSection from './SimpleEndSection.vue';
import SimpleGlobalSection from './SimpleGlobalSection.vue';
import SimpleStartSection from './SimpleStartSection.vue';
import SimpleTargetCard from './SimpleTargetCard.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useToastStore } from '@/store/toastStore';
import { findTargetAreaContainer } from '@/utils/sequenceTargets';
import {
  FRAME_OVERHEAD_SECONDS,
  summarizeTargets,
  formatClock,
  formatDuration,
} from '@/utils/sequenceSimple';

defineEmits(['show-full']);

const { t } = useI18n();
const store = useSequenceV2Store();
const toastStore = useToastStore();
const adding = ref(false);

// The clock times count from "now". A local timer, not a backend poll: it only moves the
// start of the estimate forward while the view is open.
const nowMs = ref(Date.now());
let clockTimer = null;
onMounted(() => {
  clockTimer = setInterval(() => (nowMs.value = Date.now()), 30000);
});
onUnmounted(() => clearInterval(clockTimer));

const summary = computed(() =>
  summarizeTargets(store.data, {
    overheadSeconds: FRAME_OVERHEAD_SECONDS,
    nowMs: nowMs.value,
  })
);

const hasTargetArea = computed(() => findTargetAreaContainer(store.data) !== null);

async function addFirstTarget() {
  adding.value = true;
  try {
    const result = await store.addDsoTarget(null);
    if (result.ok) return;
    toastStore.showToast({
      type: 'error',
      title: t('components.sequence.editFailed'),
      message: result.locked
        ? t('components.sequence.controlsLockedMessage')
        : result.error || t('components.framing.sequenceTargetPicker.addFailed'),
      autoClose: true,
    });
  } finally {
    adding.value = false;
  }
}
</script>
