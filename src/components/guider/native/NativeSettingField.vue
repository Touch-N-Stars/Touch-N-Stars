<template>
  <div class="flex flex-col gap-1.5 py-3" :class="compact ? 'py-2' : ''">
    <!-- Label row -->
    <div class="flex items-start justify-between gap-2">
      <!-- action with options: one button per option (the option is the value that runs it),
           after a second tap to confirm -->
      <div v-if="type === 'action' && optionList.length" class="flex min-w-0 flex-col gap-1.5">
        <span class="flex items-center gap-1">
          <span class="text-sm font-medium text-content break-words">{{ label }}</span>
          <InfoModal v-if="description" :title="label" :message="description" size="w-4 h-4" />
        </span>
        <div
          v-if="confirmingOption === null"
          class="flex flex-wrap gap-1.5"
          role="group"
          :aria-label="label"
        >
          <button
            v-for="option in optionList"
            :key="option"
            type="button"
            class="tns-btn-secondary w-auto! px-3! text-sm!"
            :disabled="saving"
            @click="confirmingOption = option"
          >
            {{ optionLabel(option) }}
          </button>
        </div>
        <div v-else class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-status-warn">
            {{
              t('components.guider.native.settings.actionOptionConfirm', {
                option: optionLabel(confirmingOption),
              })
            }}
          </span>
          <button
            type="button"
            class="tns-btn-secondary w-auto! px-3! text-sm!"
            @click="confirmingOption = null"
          >
            {{ t('components.guider.native.settings.actionCancel') }}
          </button>
          <button
            type="button"
            class="tns-btn-danger w-auto! px-3! text-sm!"
            @click="runAction(confirmingOption)"
          >
            {{ optionLabel(confirmingOption) }}
          </button>
        </div>
      </div>
      <!-- action: a button that runs something in the guider, after a second tap to confirm -->
      <div v-else-if="type === 'action'" class="flex min-w-0 flex-wrap items-center gap-2">
        <button
          v-if="!confirming"
          type="button"
          class="tns-btn-secondary w-auto! px-3! text-sm!"
          :disabled="saving"
          @click="confirming = true"
        >
          {{ label }}
        </button>
        <InfoModal
          v-if="description && !confirming"
          :title="label"
          :message="description"
          size="w-4 h-4"
        />
        <template v-else>
          <span class="text-xs text-status-warn">
            {{ t('components.guider.native.settings.actionConfirm') }}
          </span>
          <button
            type="button"
            class="tns-btn-secondary w-auto! px-3! text-sm!"
            @click="confirming = false"
          >
            {{ t('components.guider.native.settings.actionCancel') }}
          </button>
          <button type="button" class="tns-btn-danger w-auto! px-3! text-sm!" @click="runAction()">
            {{ label }}
          </button>
        </template>
      </div>
      <div v-else class="flex min-w-0 flex-col">
        <span class="flex items-center gap-1">
          <label :for="inputId" class="text-sm font-medium text-content break-words">
            {{ label }}
          </label>
          <InfoModal v-if="description" :title="label" :message="description" size="w-4 h-4" />
        </span>
        <span
          v-if="setting.requiresReconnect"
          class="mt-0.5 w-fit rounded-chip border border-status-warn/40 bg-status-warn/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-warn"
        >
          {{ t('components.guider.native.settings.requiresReconnect') }}
        </span>
      </div>

      <!-- Save state -->
      <span class="flex h-6 w-6 shrink-0 items-center justify-center" aria-live="polite">
        <ArrowPathIcon v-if="saving" class="h-4 w-4 animate-spin text-content-muted" />
        <CheckIcon v-else-if="saved" class="h-5 w-5 text-status-ok" />
        <ExclamationTriangleIcon v-else-if="error" class="h-5 w-5 text-status-danger" />
      </span>
    </div>

    <!-- action: the button is in the label row -->
    <template v-if="type === 'action'"></template>

    <!-- bool -->
    <div v-else-if="type === 'bool'" class="flex min-h-touch items-center">
      <toggleButton
        :statusValue="Boolean(draft)"
        :disabled="saving"
        @update:statusValue="onToggle"
      />
    </div>

    <!-- enum with a segmented switch (the app's segmented control): two ways to give a value -->
    <div
      v-else-if="segmented"
      class="grid gap-1 rounded-control border border-line bg-surface-1 p-1"
      :style="{ gridTemplateColumns: `repeat(${optionList.length}, minmax(0, 1fr))` }"
      role="radiogroup"
      :aria-label="label"
      @keydown="onSegmentKey"
    >
      <button
        v-for="(option, index) in optionList"
        :key="option"
        ref="segmentButtons"
        type="button"
        role="radio"
        :tabindex="index === segmentFocusIndex ? 0 : -1"
        class="min-h-touch rounded-chip px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          String(draft) === option
            ? 'bg-accent-action text-white'
            : 'text-content-muted hover:bg-surface-2'
        "
        :aria-checked="String(draft) === option"
        :disabled="saving"
        :data-testid="`native-guider-setting-${setting.name}-${option}`"
        @click="onChoose(option)"
      >
        {{ optionLabel(option) }}
      </button>
    </div>

    <!-- enum -->
    <select
      v-else-if="type === 'enum'"
      :id="inputId"
      v-model="draft"
      class="tns-select"
      :disabled="saving"
      @change="commit"
    >
      <option v-if="!optionList.includes(String(draft))" :value="draft">{{ draft }}</option>
      <option v-for="option in optionList" :key="option" :value="option">
        {{ optionLabel(option) }}
      </option>
    </select>

    <!-- int / double: the app's number picker (numpad on touch, -/+ steps) -->
    <div v-else-if="isNumeric" class="flex items-center gap-2">
      <NumberInputPicker
        v-model="numberDraft"
        :labelKey="pickerTitleKey"
        :min="pickerSpec.min"
        :max="pickerSpec.max"
        :step="pickerSpec.step"
        :decimalPlaces="pickerSpec.decimals"
        :useDefaultSentinel="sentinel !== null"
        :defaultValue="effectiveDefault"
        :inputId="inputId"
        wrapperClass="w-full"
        class="min-w-0 flex-1"
        @change="commit"
        @blur="commit"
      />
      <span v-if="setting.unit" class="shrink-0 text-xs text-content-muted">
        {{ setting.unit }}
      </span>
    </div>

    <!-- string -->
    <input
      v-else
      :id="inputId"
      v-model="draft"
      type="text"
      class="tns-input"
      :class="error ? 'border-status-danger!' : ''"
      :disabled="saving"
      @blur="commit"
      @keydown.enter.prevent="onEnter"
    />

    <!-- Hints / errors -->
    <p v-if="error" class="text-xs text-status-danger break-words">{{ error }}</p>
    <p
      v-if="warning"
      class="flex items-start gap-1.5 rounded-control border border-status-warn/40 bg-status-warn/10 px-2 py-1.5 text-xs text-status-warn"
    >
      <ExclamationTriangleIcon class="mt-px h-4 w-4 shrink-0" />
      <span>{{ t(`components.guider.native.settings.warnings.${warning}`) }}</span>
    </p>
    <p v-if="valueInUse !== null" class="text-xs text-content-muted tabular-nums">
      {{
        t('components.guider.native.settings.valueInUse', {
          value: valueInUse,
          unit: setting.unit || '',
        })
      }}
    </p>
    <div
      v-if="rangeHint || showReset"
      class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
    >
      <span v-if="rangeHint" class="text-xs text-content-faint tabular-nums">{{ rangeHint }}</span>
      <button
        v-if="showReset"
        type="button"
        class="ml-auto flex min-h-touch items-center gap-1 text-xs text-accent"
        :disabled="saving"
        @click="resetToDefault"
      >
        <ArrowUturnLeftIcon class="h-3.5 w-3.5" />
        {{ t('components.guider.native.settings.resetToDefault', { value: defaultLabel }) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { apiStore } from '@/store/store';
import {
  defaultSentinel,
  isSegmentedSetting,
  numericPickerSpec,
  sentinelEffectiveValue,
  settingDescription,
  settingFormValue,
  settingLabel,
  settingOptionLabel,
  settingValueInUse,
  settingWarning,
  validateSettingValue,
} from '@/utils/nativeGuider';

const props = defineProps({
  setting: { type: Object, required: true },
  compact: { type: Boolean, default: false },
});

const { t, te } = useI18n();
const store = useNativeGuiderStore();

const inputId = computed(() => `native-guider-setting-${props.setting.name}`);
const type = computed(() => String(props.setting.type || 'string').toLowerCase());
const isNumeric = computed(() => type.value === 'int' || type.value === 'double');
const segmented = computed(() => isSegmentedSetting(props.setting));

const optionList = computed(() =>
  Array.isArray(props.setting.options) ? props.setting.options.map(String) : []
);
// e.g. the Dec guide modes: the value stays the option, the translation says what it does
const optionLabel = (option) => settingOptionLabel({ t, te }, props.setting.name, option);
// the backend's English label and description unless the locale has them
const label = computed(() => settingLabel({ t, te }, props.setting));
const description = computed(() => settingDescription({ t, te }, props.setting));

const pickerSpec = computed(() => numericPickerSpec(props.setting));
// The numpad's title goes through t(): give it the translation key when there is one, the
// backend's label otherwise (t() returns an unknown key unchanged).
const pickerTitleKey = computed(() => {
  const key = `components.guider.native.settings.labels.${props.setting.name}`;
  return te(key) ? key : String(props.setting.label || props.setting.name);
});

const draft = ref(settingFormValue(props.setting));
// Value that means "default" (Gain/Offset -1: guide camera settings, PixelSizeUm 0: driver), else null
const sentinel = computed(() => defaultSentinel(props.setting));
// What the sentinel currently stands for, shown greyed in the empty field ("Default (120)").
const mainStore = apiStore();
const effectiveDefault = computed(() =>
  sentinel.value === null
    ? null
    : sentinelEffectiveValue(
        props.setting.name,
        mainStore.profileInfo?.GuideCameraSettings,
        mainStore.guideCameraInfo
      )
);
// The picker works on numbers; the draft stays the form value validateSettingValue() expects.
// The picker knows only -1 as its "default", so the setting's own sentinel is mapped onto it.
const numberDraft = computed({
  get: () => {
    const value = Number(String(draft.value ?? '').replace(',', '.'));
    if (!Number.isFinite(value)) return 0;
    return sentinel.value !== null && value === sentinel.value ? -1 : value;
  },
  set: (value) => {
    draft.value = String(sentinel.value !== null && value === -1 ? sentinel.value : value);
  },
});
const saving = ref(false);
const saved = ref(false);
const error = ref('');
const confirming = ref(false);
/** Option of an action setting waiting for the confirming tap, null when none. */
const confirmingOption = ref(null);
let savedTimer = null;

// Follow backend updates (poll/refresh) unless the user is editing a changed value.
watch(
  () => props.setting.value,
  () => {
    if (!saving.value) draft.value = settingFormValue(props.setting);
  }
);

const currentValue = computed(() => settingFormValue(props.setting));
// The value the guider uses when it adjusted the setting itself (the learned Dec backlash pulse).
const valueInUse = computed(() => settingValueInUse(props.setting, store.status));
// A combination with other settings that doesn't work as chosen (play model without Predictive).
const warning = computed(() => settingWarning(props.setting, store.settings));

const rangeHint = computed(() => {
  if (!isNumeric.value) return '';
  const { min, max } = props.setting;
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) return t('components.guider.native.settings.range', { min, max });
  if (hasMin) return t('components.guider.native.settings.rangeMin', { min });
  if (hasMax) return t('components.guider.native.settings.rangeMax', { max });
  return '';
});

const defaultLabel = computed(() => {
  const value = props.setting.defaultValue;
  if (type.value === 'bool') {
    return String(value).toLowerCase() === 'true'
      ? t('components.guider.native.settings.on')
      : t('components.guider.native.settings.off');
  }
  if (sentinel.value !== null) return t('components.guider.native.settings.defaultValue');
  return props.setting.unit ? `${value} ${props.setting.unit}` : String(value);
});

const showReset = computed(() => {
  const def = props.setting.defaultValue;
  if (def === null || def === undefined || def === '') return false;
  if (type.value === 'bool') {
    return String(def).toLowerCase() !== String(props.setting.value).toLowerCase();
  }
  if (isNumeric.value) {
    const a = Number(String(def).replace(',', '.'));
    const b = Number(String(props.setting.value).replace(',', '.'));
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) > 1e-9;
  }
  return String(def) !== String(props.setting.value ?? '');
});

function isUnchanged(value) {
  if (type.value === 'bool') return Boolean(value) === Boolean(currentValue.value);
  if (isNumeric.value) {
    const a = Number(String(value).replace(',', '.'));
    const b = Number(String(currentValue.value).replace(',', '.'));
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-12;
  }
  return String(value ?? '') === String(currentValue.value ?? '');
}

async function save(rawValue) {
  error.value = '';
  const result = validateSettingValue(props.setting, rawValue);
  if (!result.ok) {
    error.value = t(
      `components.guider.native.settings.errors.${result.error}`,
      result.params || {}
    );
    return;
  }
  if (isUnchanged(result.value)) return;

  saving.value = true;
  saved.value = false;
  try {
    await store.saveSetting(props.setting.name, result.value);
    saved.value = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (err) {
    error.value = err?.message || t('components.guider.native.settings.saveFailed');
    // Back to the value the backend holds.
    draft.value = settingFormValue(props.setting);
  } finally {
    saving.value = false;
  }
}

function commit() {
  if (saving.value) return;
  save(draft.value);
}

function onEnter(event) {
  commit();
  event?.target?.blur?.();
}

/** Runs an action setting: 'true', or the chosen option of an action with options. */
async function runAction(option = null) {
  confirming.value = false;
  confirmingOption.value = null;
  error.value = '';
  saving.value = true;
  saved.value = false;
  try {
    await store.saveSetting(props.setting.name, option ?? 'true');
    saved.value = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saved.value = false;
    }, 2000);
  } catch (err) {
    error.value = err?.message || t('components.guider.native.settings.saveFailed');
  } finally {
    saving.value = false;
  }
}

function onChoose(option) {
  if (saving.value || String(draft.value) === option) return;
  draft.value = option;
  save(option);
}

/** Buttons of the segmented switch, for the arrow keys. */
const segmentButtons = ref([]);
/** The one switch button in the tab order: the chosen option, else the first. */
const segmentFocusIndex = computed(() =>
  Math.max(0, optionList.value.indexOf(String(draft.value)))
);

/** Arrow keys move through the segmented switch and choose, like a native radio group. */
function onSegmentKey(event) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step || saving.value) return;
  event.preventDefault();
  const count = optionList.value.length;
  const index = (segmentFocusIndex.value + step + count) % count;
  onChoose(optionList.value[index]);
  segmentButtons.value[index]?.focus();
}

function onToggle(value) {
  draft.value = value;
  save(value);
}

function resetToDefault() {
  const def = props.setting.defaultValue;
  draft.value = type.value === 'bool' ? String(def).toLowerCase() === 'true' : String(def);
  save(draft.value);
}

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer);
});
</script>
