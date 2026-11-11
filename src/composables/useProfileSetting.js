import { ref, computed, watch, toValue, onScopeDispose } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

// How long the saved/error status stays set, e.g. for a glow on the control.
export const STATUS_RESET_MS = 2000;

const GLOW_CLASSES = { saved: 'glow-green', error: 'glow-red' };

// Reads a NINA profile setting key such as 'FilterWheelSettings-FilterWheelFilters-2-FocusOffset'
// from profileInfo. The key doubles as the path, so array indices work as plain segments.
export function readProfilePath(profileInfo, settingKey) {
  return settingKey.split('-').reduce((obj, key) => obj?.[key], profileInfo);
}

/**
 * One NINA profile setting as an editable value.
 *
 * - `value` starts at the profile value and follows it when something else writes the
 *   setting (a preset, another client, NINA itself). It does not follow while a save of
 *   its own is in flight or while `hold()` is true, so neither a stale poll nor a remote
 *   change overwrites what the user is typing.
 * - `save(next)` writes the value; it can be bound to @change directly (a DOM event
 *   argument means "save the current value"). A rejected write (`Success !== true`) or a request
 *   error puts `value` back to what the profile says, so the control never shows a value
 *   NINA did not take.
 * - `status` is 'saved' or 'error' for STATUS_RESET_MS after a save, '' otherwise;
 *   `glowClass` is the matching 'glow-green' / 'glow-red' class.
 *
 * @param {string|import('vue').Ref<string>|() => string} settingKey  NINA setting path
 * @param {object} [options]
 * @param {() => any} [options.source]      where the current value comes from; defaults to
 *                                          profileInfo at `settingKey`
 * @param {any} [options.fallback]          used while the profile has no value
 * @param {(v: any) => any} [options.fromProfile]  profile value -> UI value
 * @param {(v: any) => any} [options.toProfile]    UI value -> value sent to NINA
 * @param {() => boolean} [options.hold]    pauses following the profile (e.g. while focused)
 */
export function useProfileSetting(settingKey, options = {}) {
  const {
    source,
    fallback,
    fromProfile = (v) => v,
    toProfile = (v) => v,
    hold = () => false,
  } = options;

  const store = apiStore();
  const key = computed(() => toValue(settingKey));

  const profileValue = computed(() => {
    const raw = source ? source() : readProfilePath(store.profileInfo, key.value);
    return raw === undefined || raw === null ? fallback : fromProfile(raw);
  });

  const value = ref(profileValue.value);
  // A counter, not a flag: stepper taps can start a second save before the first returns.
  const pendingSaves = ref(0);
  const saving = computed(() => pendingSaves.value > 0);
  const status = ref('');

  let statusTimer = null;
  function setStatus(next) {
    clearTimeout(statusTimer);
    status.value = next;
    statusTimer = setTimeout(() => {
      status.value = '';
    }, STATUS_RESET_MS);
  }

  watch(profileValue, (v) => {
    if (saving.value || hold()) return;
    value.value = v;
  });

  async function save(next = value.value) {
    // Bound straight to a native @change, the argument is the DOM event, not a value;
    // v-model has already put the new value into `value` by then.
    if (typeof Event !== 'undefined' && next instanceof Event) next = value.value;
    value.value = next;
    pendingSaves.value++;
    let ok = false;
    try {
      const response = await apiService.profileChangeValue(key.value, toProfile(next));
      ok = response?.Success === true;
      if (!ok) console.warn(`[useProfileSetting] ${key.value} rejected:`, response?.Error);
    } catch (error) {
      console.error(`[useProfileSetting] Error saving ${key.value}:`, error);
    } finally {
      pendingSaves.value--;
    }
    // Only the last of overlapping saves settles the value; earlier ones would flash back.
    if (!ok && !saving.value) value.value = profileValue.value;
    setStatus(ok ? 'saved' : 'error');
    return ok;
  }

  // The app's save feedback classes, for controls that show the outcome themselves.
  const glowClass = computed(() => GLOW_CLASSES[status.value] ?? '');

  onScopeDispose(() => clearTimeout(statusTimer));

  return { value, save, saving, status, glowClass };
}
