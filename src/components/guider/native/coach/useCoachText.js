import { useI18n } from 'vue-i18n';
import { settingLabel } from '@/utils/nativeGuider';
import {
  describeChange,
  findingText,
  formatDuration,
  messageText,
  stepDetailText,
} from '@/utils/nativeGuiderCoach';

const BASE = 'components.guider.native.coach';

/**
 * Localized texts of the Guiding Coach (finding/message codes, step names, step details, setting
 * changes).
 */
export function useCoachText() {
  const { t, te } = useI18n();

  /** t() relative to components.guider.native.coach. */
  const k = (key, params) => t(`${BASE}.${key}`, params ?? {});

  function stepName(step) {
    return te(`${BASE}.steps.${step}.name`) ? k(`steps.${step}.name`) : step || '';
  }

  function stepState(state) {
    return te(`${BASE}.stepStates.${state}`) ? k(`stepStates.${state}`) : state || '';
  }

  /** Localized sub-phase of an AdvancedCoachStepStatus (DetailCode + DetailParameters). */
  function stepDetail(step) {
    return stepDetailText({ t, te }, step);
  }

  /** A finding's or trial's setting change for display, with the localized setting label. */
  function settingChange(change, settings) {
    return describeChange(change, settings, {
      on: t('components.guider.native.settings.on'),
      off: t('components.guider.native.settings.off'),
      label: (setting) => settingLabel({ t, te }, setting),
    });
  }

  return {
    t,
    te,
    k,
    stepName,
    stepState,
    stepDetail,
    duration: formatDuration,
    finding: (f) => findingText({ t, te }, f),
    message: (code, fallback, parameters) => messageText({ t, te }, code, fallback, parameters),
    settingChange,
  };
}
