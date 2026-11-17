<template>
  <!-- Dec backlash play model: what it learned and where the Dec gear sits in the play.
       Every value has its own help modal, so the terms are explained where they appear. -->
  <div class="flex flex-col gap-3 text-xs" data-testid="native-guider-dec-backlash">
    <div class="flex flex-col gap-0.5">
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="shrink-0 text-content-muted">{{ t(`${base}.fullReversal`) }}</span>
        <NativeHelpTip
          class="self-center"
          :title="t(`${base}.fullReversal`)"
          :text="t(`${base}.info.fullReversal`)"
        />
        <span class="ml-auto shrink-0 font-semibold text-content tabular-nums">{{
          formatMs(backlash.fullReversalMs)
        }}</span>
      </div>
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="shrink-0 text-content-muted">{{ t(`${base}.shape`) }}</span>
        <NativeHelpTip
          class="self-center"
          :title="t(`${base}.shape`)"
          :text="t(`${base}.info.shape`)"
        />
        <span class="ml-auto truncate font-semibold text-content">{{ shapeLabel }}</span>
      </div>
      <div
        v-if="backlash.shapeFromCalibration"
        class="text-right text-[10px] text-content-faint"
        data-testid="native-guider-dec-backlash-calibrated"
      >
        {{ t(`${base}.fromCalibration`) }}
      </div>
    </div>

    <!-- The play as a bar: North side left, South side right, the gear's position marked -->
    <div class="flex flex-col gap-1">
      <div class="flex items-baseline gap-2">
        <span class="shrink-0 text-content-muted">{{ t(`${base}.play`) }}</span>
        <NativeHelpTip
          class="self-center"
          :title="t(`${base}.play`)"
          :text="t(`${base}.info.play`)"
        />
        <span class="ml-auto truncate font-semibold" :class="TONE_TEXT[backlash.tone]">{{
          t(`${base}.gears.${backlash.gear}`)
        }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 shrink-0 text-center font-bold text-content-muted">{{
          t(`${base}.northShort`)
        }}</span>
        <div
          class="relative h-3 flex-1 rounded-full bg-surface-3"
          role="img"
          :aria-label="barLabel"
        >
          <span
            v-if="backlash.gearPosition !== null"
            class="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500"
            :class="TONE_BG[backlash.tone]"
            :style="{ left: `${backlash.gearPosition * 100}%` }"
            data-testid="native-guider-dec-backlash-gear"
          ></span>
        </div>
        <span class="w-3 shrink-0 text-center font-bold text-content-muted">{{
          t(`${base}.southShort`)
        }}</span>
      </div>
      <div class="flex justify-between gap-2 text-[10px] text-content-faint tabular-nums">
        <span>{{ t(`${base}.slackNorth`, { value: formatMs(backlash.slackNorthMs) }) }}</span>
        <span class="text-right">{{
          t(`${base}.slackSouth`, { value: formatMs(backlash.slackSouthMs) })
        }}</span>
      </div>
      <div v-if="backlash.gearPosition === null" class="text-[10px] text-content-faint">
        {{ t(`${base}.positionUnknown`) }}
      </div>
    </div>

    <!-- Counters: the whole tile opens its explanation, like the stat tiles of the state strip -->
    <div class="grid grid-cols-2 gap-1.5">
      <NativeHelpTip
        v-for="tile in tiles"
        :key="tile.key"
        :title="t(`${base}.${tile.key}`)"
        :text="tile.help"
        class="tns-stat-tile min-w-0 pr-4!"
      >
        <span class="tns-stat-label whitespace-normal! line-clamp-2">{{
          t(`${base}.${tile.key}`)
        }}</span>
        <span class="tns-stat-value">{{ tile.value }}</span>
      </NativeHelpTip>
    </div>

    <p class="text-content-faint leading-relaxed">{{ t(`${base}.tapHint`) }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import NativeHelpTip from './NativeHelpTip.vue';
import { TONE_BG, TONE_TEXT, fmt, formatMs } from '@/utils/nativeGuider';

const props = defineProps({
  /** decBacklash(status): the normalized play model state. */
  backlash: { type: Object, required: true },
});

const { t } = useI18n();
const base = 'components.guider.native.backlash';

const shapeLabel = computed(() =>
  props.backlash.shape ? t(`${base}.shapes.${props.backlash.shape}`) : '–'
);

const barLabel = computed(() =>
  [
    t(`${base}.gears.${props.backlash.gear}`),
    t(`${base}.slackNorth`, { value: formatMs(props.backlash.slackNorthMs) }),
    t(`${base}.slackSouth`, { value: formatMs(props.backlash.slackSouthMs) }),
  ].join(' · ')
);

const count = (value) => (value === null ? '–' : String(Math.round(value)));

const tiles = computed(() => [
  {
    key: 'reversals',
    value: count(props.backlash.reversals),
    help: t(`${base}.info.reversals`),
  },
  {
    key: 'heldCorrections',
    value: count(props.backlash.heldCorrections),
    help: t(`${base}.heldExplanation`),
  },
  {
    key: 'learnedTakeUps',
    value: fmt(props.backlash.learnedTakeUps, 1),
    help: t(`${base}.info.learnedTakeUps`),
  },
  {
    key: 'lastCompensation',
    value: formatMs(props.backlash.lastCompensationMs),
    help: t(`${base}.info.lastCompensation`),
  },
]);
</script>
