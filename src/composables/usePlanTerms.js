// The simple mode calls the sequence a "plan", as its navigation does; the full editor keeps
// N.I.N.A.'s term. The keys listed here have a plan wording under components.sequence.plan.
import { useI18n } from 'vue-i18n';
import { useSimpleMode } from '@/composables/useSimpleMode';

export const PLAN_WORDED_KEYS = [
  'title',
  'startSequence',
  'resetSequence',
  'resetConfirmationMessage',
  'clearConfirmationMessage',
  'manageSequences',
  'saveSequenceAs',
  'sequenceFolder',
  'sequenceFolderSaveError',
  'controlsLockedMessage',
];

/** The locale key for a components.sequence text: its plan wording in the simple mode. */
export function planTermKey(key, simpleMode) {
  return simpleMode && PLAN_WORDED_KEYS.includes(key)
    ? `components.sequence.plan.${key}`
    : `components.sequence.${key}`;
}

export function usePlanTerms() {
  const { t } = useI18n();
  const { active } = useSimpleMode();

  const seqKey = (key) => planTermKey(key, active.value);
  const seqT = (key, params = {}) => t(seqKey(key), params);

  return { seqKey, seqT };
}
