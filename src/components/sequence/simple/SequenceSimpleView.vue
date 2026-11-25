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
    <SimpleNightLimits
      v-if="simpleMode"
      :planSummary="summary"
      :planTimes="planTimes"
      :site="site"
      :nowMs="nowMs"
    />

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
        {{
          prefillName
            ? $t('components.sequence.simple.addTargetNamed', { name: prefillName })
            : $t('components.sequence.simple.addTarget')
        }}
      </button>
    </div>

    <SimpleEndSection @show-full="$emit('show-full')" />
  </div>
</template>

<script setup>
import { usePlanSummary } from '@/composables/usePlanSummary';
import { usePlanTerms } from '@/composables/usePlanTerms';
import { useSimplePlanTargets } from '@/composables/useSimplePlanTargets';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';
import SimpleEndSection from './SimpleEndSection.vue';
import SimpleGlobalSection from './SimpleGlobalSection.vue';
import SimpleNightLimits from './SimpleNightLimits.vue';
import SimpleStartSection from './SimpleStartSection.vue';
import SimpleTargetCard from './SimpleTargetCard.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useFramingStore } from '@/store/framingStore';
import { useToastStore } from '@/store/toastStore';
import { findTargetAreaContainer } from '@/utils/sequenceTargets';
import { degreesToDMS, degreesToHMS } from '@/utils/utils';
import { formatClock, formatDuration } from '@/utils/sequenceSimple';

const { seqT } = usePlanTerms();
defineEmits(['show-full']);

const { t } = useI18n();
const store = useSequenceV2Store();
const { active: simpleMode, applyToTarget } = useSimplePlanTargets();
const framingStore = useFramingStore();
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

const { planSummary: summary, planTimes, site } = usePlanSummary(nowMs);

const hasTargetArea = computed(() => findTargetAreaContainer(store.data) !== null);

// The target the mount was last sent to from the app (sky atlas, framing). A new target starts
// with it - before, it came up as NINA's "Deep Sky Object Instruction Set" at 00:00:00 / +00°
// and the user had to search the object they had just centered once more.
const prefill = computed(() => {
  const last = framingStore.lastTarget;
  if (!last || !Number.isFinite(last.ra) || !Number.isFinite(last.dec)) return null;
  return {
    ...last,
    name: last.name || `RA ${degreesToHMS(last.ra)} Dec ${degreesToDMS(last.dec)}`,
  };
});
const prefillName = computed(() => prefill.value?.name ?? '');

async function addFirstTarget() {
  adding.value = true;
  try {
    let result = await store.addDsoTarget(null);
    if (result.ok && prefill.value) {
      const { name, ra, dec } = prefill.value;
      const id = result.id;
      result = await store.setDsoTarget(id, name, ra, dec, framingStore.rotationAngle);
      result.id = id;
    }
    // Same steps and limits as a target added from the atlas
    if (result.ok && simpleMode.value) {
      result = await applyToTarget(result.id, { addExposure: true });
    }
    if (result.ok) return;
    toastStore.showToast({
      type: 'error',
      title: t('components.sequence.editFailed'),
      message: result.locked
        ? seqT('controlsLockedMessage')
        : result.error || t('components.framing.sequenceTargetPicker.addFailed'),
      autoClose: true,
    });
  } finally {
    adding.value = false;
  }
}
</script>
