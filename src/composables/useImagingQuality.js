// How good the pictures of the running night are, rated for the simple mode: guiding against
// the image scale, focus as the HFR growth against the earlier pictures, cooling against its
// target. The imaging cockpit (verdict, alerts) and the status bar (one segment per quality,
// its docked panel explains it) read the same ratings, so they cannot disagree.
// Everything comes from the stores, so the status bar can use it on every page.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import { useImagetStore } from '@/store/imageStore';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { lastSteps } from '@/components/guider/native/graphData';
import { isNativeGuiderInUse, windowRms } from '@/utils/nativeGuider';
import { arcsecPerPixel } from '@/utils/imageScale';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';
import {
  hfrHealth,
  imagingActivity,
  QUALITY_SCALES,
  rateCooling,
  rateGuiding,
  scalePercent,
} from '@/utils/simpleMode';

// Enough steps for a calm RMS, few enough to follow a change within a minute or two.
const RMS_STEPS = 50;

function num(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

export const fmt = (value, digits = 2) =>
  value === null || value === undefined ? '–' : value.toFixed(digits);

const pct = (value) => Math.round(value * 100);

function signedPercent(change) {
  return `${change >= 0 ? '+' : '−'}${Math.abs(pct(change))}`;
}

// Widths of the green and yellow zone in percent of a scale's width
function zones(scale) {
  return {
    good: (scale.good / scale.max) * 100,
    ok: ((scale.ok - scale.good) / scale.max) * 100,
  };
}

/** Status bar segment state for a rating: green, yellow, red as ok, warn, danger */
export const LEVEL_STATE = { good: 'ok', ok: 'warn', poor: 'danger' };

export function useImagingQuality() {
  const { t } = useI18n();
  const store = apiStore();
  const cameraStore = useCameraStore();
  const imageStore = useImagetStore();
  const nativeGuiderStore = useNativeGuiderStore();

  // --- Guiding ------------------------------------------------------------------------------
  const usesNativeGuider = computed(() => isNativeGuiderInUse(store));
  // The built-in guider knows more states than NINA's guider info (Settling, LostLock, ...)
  const guiderState = computed(() =>
    usesNativeGuider.value && store.guiderInfo.Connected
      ? nativeGuiderStore.state
      : (store.guiderInfo.State ?? '')
  );
  const guiding = computed(() => ['Guiding', 'Settling'].includes(guiderState.value));

  // The built-in guider's steps only while its socket delivers them: after a drop (app in the
  // background, network gap) they stand still and would show an old RMS as the current one.
  const liveSteps = computed(() => usesNativeGuider.value && nativeGuiderStore.wsConnected);

  const activity = computed(() =>
    imagingActivity({
      afRunning: Boolean(store.focuserAfInfo?.autofocus_running),
      slewing: store.mountIsSlewing,
      guiderState: guiderState.value,
      // The built-in guider's settle flag comes from its feed; without it the flag is stale.
      settling: liveSteps.value && nativeGuiderStore.isSettling,
      exposing: Boolean(store.cameraInfo.IsExposing),
    })
  );
  // The rig pauses guiding for an autofocus run or a slew; that is no problem.
  const guidingPaused = computed(() =>
    ['autofocus', 'slewing', 'calibrating'].includes(activity.value)
  );

  const imageScale = computed(() =>
    arcsecPerPixel(
      store.cameraInfo.PixelSize,
      store.profileInfo?.TelescopeSettings?.FocalLength,
      store.cameraInfo.BinX
    )
  );

  const recentSteps = computed(() =>
    liveSteps.value ? lastSteps(nativeGuiderStore.steps, RMS_STEPS) : []
  );

  // RMS of the last streamed steps; otherwise NINA's guider info, which the 2 s poll keeps
  // current for any guider (PHD2 too). Only while guiding: NINA keeps the last RMS after a stop.
  const guideRms = computed(() => {
    if (!guiding.value) return null;
    if (recentSteps.value.length >= 5) {
      const rms = windowRms(recentSteps.value);
      if (rms.total !== null) return rms;
    }
    const e = store.guiderInfo?.RMSError;
    if (num(e?.Total?.Arcseconds) !== null) {
      return {
        ra: num(e.RA?.Arcseconds),
        dec: num(e.Dec?.Arcseconds),
        total: num(e.Total.Arcseconds),
      };
    }
    return null;
  });

  const guidingRating = computed(() => rateGuiding(guideRms.value?.total, imageScale.value));

  // --- Focus ----------------------------------------------------------------------------------
  const isDeleted = (entry, index) =>
    isHistoryEntryDeleted(entry, historyEntryKey(index, entry), imageStore.deletedHistoryKeys);
  const hfr = computed(() => hfrHealth(store.imageHistoryInfo, isDeleted));

  // --- Cooling --------------------------------------------------------------------------------
  // Only while the cooler is meant to hold a temperature: a camera that cannot cool, or one
  // that is warming up at the end of the night, has no target to be off from.
  const coolingTarget = computed(() => {
    const target = num(store.cameraInfo.TargetTemp ?? cameraStore.targetTemp);
    return store.cameraInfo.Connected &&
      store.cameraInfo.CanSetTemperature &&
      ['cooling', 'holding'].includes(cameraStore.coolingState) &&
      target !== null
      ? target
      : null;
  });
  const sensorTemp = computed(() => num(store.cameraInfo.Temperature));
  const cooling = computed(() =>
    coolingTarget.value === null
      ? { level: null, offset: null }
      : rateCooling(sensorTemp.value, coolingTarget.value)
  );

  // --- The three qualities, with what explains them -----------------------------------------
  const E = 'components.simpleMode.cockpit.explain';

  const guidingQuality = computed(() => {
    const rms = guideRms.value;
    const rating = guidingRating.value;
    const G = QUALITY_SCALES.guiding;
    let now;
    if (rms && rating.ratio !== null) {
      now = t(`${E}.guiding.now`, {
        rms: fmt(rms.total),
        ratio: fmt(rating.ratio),
        scale: fmt(imageScale.value),
      });
    } else if (rms) {
      now = t(`${E}.guiding.nowNoScale`, { rms: fmt(rms.total) });
    } else {
      now = t(guidingPaused.value ? `${E}.guiding.nowPaused` : `${E}.guiding.nowOff`);
    }
    return {
      key: 'guiding',
      level: rms ? rating.level : null,
      word: rms
        ? t(`components.simpleMode.cockpit.guidingLevel.${rating.level ?? 'unknown'}`)
        : null,
      percent: scalePercent(rms ? rating.ratio : null, G),
      zones: zones(G),
      now,
      limits: t(`${E}.guiding.limits`, { good: G.good, ok: G.ok }),
    };
  });

  const focusQuality = computed(() => {
    const h = hfr.value;
    const F = QUALITY_SCALES.sharpness;
    let now;
    if (!h) now = t(`${E}.focus.nowNone`);
    else if (h.change === null) now = t(`${E}.focus.nowFirst`, { count: F.minPictures });
    else {
      now = t(`${E}.focus.now`, {
        hfr: fmt(h.hfr),
        change: signedPercent(h.change),
        baseline: fmt(h.baseline),
      });
    }
    return {
      key: 'focus',
      level: h?.level ?? null,
      word: !h
        ? t('components.simpleMode.cockpit.noFrame')
        : h.level
          ? t(`components.simpleMode.cockpit.focusLevel.${h.level}`)
          : t('components.simpleMode.cockpit.hfrNoBaseline'),
      percent: scalePercent(h?.change ?? null, F),
      zones: zones(F),
      now,
      limits: t(`${E}.focus.limits`, { good: pct(F.good), ok: pct(F.ok) }),
    };
  });

  const coolingQuality = computed(() => {
    const C = QUALITY_SCALES.cooling;
    return {
      key: 'cooling',
      level: cooling.value.level,
      word: null,
      percent: scalePercent(cooling.value.offset, C),
      zones: zones(C),
      now:
        coolingTarget.value === null
          ? ''
          : t(`${E}.cooling.now`, {
              temp: fmt(sensorTemp.value, 1),
              target: coolingTarget.value,
            }),
      limits: t(`${E}.cooling.limits`, { good: C.good }),
    };
  });

  return {
    activity,
    coolingTarget,
    cooling,
    coolingQuality,
    focusQuality,
    guideRms,
    guiderState,
    guiding,
    guidingPaused,
    guidingQuality,
    guidingRating,
    hfr,
    imageScale,
    liveSteps,
    sensorTemp,
    usesNativeGuider,
  };
}
