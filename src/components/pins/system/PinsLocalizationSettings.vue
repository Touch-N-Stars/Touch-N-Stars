<template>
  <section
    v-if="store.isPINS"
    :class="embedded ? 'flex flex-col gap-4' : 'tns-card flex flex-col gap-3'"
  >
    <div v-if="!embedded">
      <h3 class="tns-section-title">
        {{ t('components.settings.localization.title') }}
      </h3>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.settings.localization.description') }}
      </p>
    </div>

    <p v-if="loading" class="text-sm text-content-muted">
      {{ t('components.settings.localization.loading') }}
    </p>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase text-content-muted">
            {{ t('components.settings.localization.systemLocale') }}
          </span>
          <input
            v-model.trim="filters.locale"
            type="search"
            class="tns-input"
            autocomplete="off"
            :disabled="saving"
            :placeholder="t('components.settings.localization.searchPlaceholder')"
          />
          <select v-model="form.locale" class="tns-select" :disabled="saving">
            <option v-for="value in localeChoices" :key="value" :value="value">
              {{ value }}
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase text-content-muted">
            {{ t('components.settings.localization.wifiCountry') }}
          </span>
          <select v-model="form.wifiCountry" class="tns-select" :disabled="saving">
            <option
              v-for="country in options.wifiCountries"
              :key="country.code"
              :value="country.code"
            >
              {{ country.name }} ({{ country.code }})
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase text-content-muted">
            {{ t('components.settings.localization.timezone') }}
          </span>
          <input
            v-model.trim="filters.timezone"
            type="search"
            class="tns-input"
            autocomplete="off"
            :disabled="saving"
            :placeholder="t('components.settings.localization.searchPlaceholder')"
          />
          <select v-model="form.timezone" class="tns-select" :disabled="saving">
            <option v-for="value in timezoneChoices" :key="value" :value="value">
              {{ value }}
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase text-content-muted">
            {{ t('components.settings.localization.keyboardLayout') }}
          </span>
          <input
            v-model.trim="filters.keyboardLayout"
            type="search"
            class="tns-input"
            autocomplete="off"
            :disabled="saving"
            :placeholder="t('components.settings.localization.searchPlaceholder')"
          />
          <select v-model="form.keyboardLayout" class="tns-select" :disabled="saving">
            <option v-for="layout in keyboardChoices" :key="layout.code" :value="layout.code">
              {{ layout.name }} ({{ layout.code }})
            </option>
          </select>
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="tns-btn-primary"
          :disabled="saving || confirming || !isComplete || !isDirty"
          @click="save"
        >
          {{
            saving
              ? t('components.settings.localization.saving')
              : t('components.settings.localization.save')
          }}
        </button>
        <button class="tns-btn-secondary" :disabled="saving" @click="load">
          {{ t('components.settings.localization.refresh') }}
        </button>
        <span v-if="saved" class="text-sm text-status-ok">
          {{ t('components.settings.localization.saved') }}
        </span>
      </div>
    </template>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">
      {{ errorMessage }}
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import {
  parseJobIdFromResponse,
  pollJobUntilFinished,
} from '@/components/pins/composables/pinsJobPolling';

defineProps({
  embedded: { type: Boolean, default: false },
});

const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();
const loading = ref(false);
const saving = ref(false);
const confirming = ref(false);
const saved = ref(false);
const errorMessage = ref('');
const current = ref(null);
const options = reactive({
  locales: [],
  wifiCountries: [],
  timezones: [],
  keyboardLayouts: [],
  keyboardLayoutOptions: [],
});
const form = reactive({
  locale: '',
  wifiCountry: '',
  timezone: '',
  keyboardLayout: '',
});
const filters = reactive({
  locale: '',
  timezone: '',
  keyboardLayout: '',
});

function filterOptions(values, query, selected) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return values;
  const matches = values.filter((value) => value.toLocaleLowerCase().includes(needle));
  return selected && !matches.includes(selected) ? [selected, ...matches] : matches;
}

const localeChoices = computed(() => filterOptions(options.locales, filters.locale, form.locale));
const timezoneChoices = computed(() =>
  filterOptions(options.timezones, filters.timezone, form.timezone)
);
const keyboardChoices = computed(() =>
  filterKeyboardOptions(options.keyboardLayoutOptions, filters.keyboardLayout, form.keyboardLayout)
);

function filterKeyboardOptions(values, query, selected) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return values;
  const matches = values.filter((layout) =>
    `${layout.code} ${layout.name}`.toLocaleLowerCase().includes(needle)
  );
  const current = values.find((layout) => layout.code === selected);
  return current && !matches.some((layout) => layout.code === selected)
    ? [current, ...matches]
    : matches;
}

const isComplete = computed(() => Object.values(form).every((value) => String(value).trim()));
const isDirty = computed(
  () =>
    current.value &&
    Object.keys(form).some((key) => String(form[key]) !== String(current.value[key] || ''))
);
const isWifiCountryDirty = computed(
  () => current.value && String(form.wifiCountry) !== String(current.value.wifiCountry || '')
);

function messageFrom(error) {
  return error?.response?.data?.detail || error?.message || String(error);
}

function setCurrent(status) {
  current.value = status;
  for (const key of Object.keys(form)) form[key] = status?.[key] || '';
}

function includeCurrentOptions() {
  for (const [key, optionKey] of [
    ['locale', 'locales'],
    ['timezone', 'timezones'],
    ['keyboardLayout', 'keyboardLayouts'],
  ]) {
    const value = form[key];
    if (value && !options[optionKey].includes(value)) options[optionKey].unshift(value);
  }
  if (
    form.wifiCountry &&
    !options.wifiCountries.some((country) => country.code === form.wifiCountry)
  ) {
    options.wifiCountries.unshift({ code: form.wifiCountry, name: form.wifiCountry });
  }
  if (
    form.keyboardLayout &&
    !options.keyboardLayoutOptions.some((layout) => layout.code === form.keyboardLayout)
  ) {
    options.keyboardLayoutOptions.unshift({
      code: form.keyboardLayout,
      name: form.keyboardLayout,
    });
  }
}

async function load() {
  if (!store.isPINS || loading.value) return;
  loading.value = true;
  saved.value = false;
  errorMessage.value = '';
  try {
    const [status, available] = await Promise.all([
      apiPinsService.getPinsSystemLocalization(),
      apiPinsService.getPinsSystemLocalizationOptions(),
    ]);
    options.locales = available?.locales || [];
    options.wifiCountries = available?.wifiCountries || [];
    options.timezones = available?.timezones || [];
    options.keyboardLayouts = available?.keyboardLayouts || [];
    options.keyboardLayoutOptions =
      available?.keyboardLayoutOptions?.length > 0
        ? available.keyboardLayoutOptions
        : options.keyboardLayouts.map((code) => ({ code, name: code }));
    setCurrent(status || {});
    includeCurrentOptions();
  } catch (error) {
    console.error('[PinsLocalization] Load failed:', error);
    errorMessage.value = t('components.settings.localization.loadError', {
      message: messageFrom(error),
    });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!store.isPINS || saving.value || confirming.value || !isComplete.value || !isDirty.value)
    return;

  if (isWifiCountryDirty.value) {
    confirming.value = true;
    let confirmed = false;
    try {
      confirmed = await toastStore.showConfirmation(
        t('components.settings.localization.wifiCountryConfirmTitle'),
        t('components.settings.localization.wifiCountryConfirmMessage'),
        t('common.confirm'),
        t('common.cancel')
      );
    } finally {
      confirming.value = false;
    }
    if (!confirmed) return;
  }

  saving.value = true;
  saved.value = false;
  errorMessage.value = '';
  try {
    const response = await apiPinsService.updatePinsSystemLocalization({ ...form });
    const jobId = parseJobIdFromResponse(response);
    if (!jobId) throw new Error(t('components.settings.localization.missingJob'));
    const result = await pollJobUntilFinished(jobId, { maxConsecutiveErrors: 5 });
    if (!result.success) {
      throw new Error(
        result.result?.error || result.result?.stderr || result.result?.status || 'failed'
      );
    }
    await load();
    saved.value = true;
  } catch (error) {
    console.error('[PinsLocalization] Save failed:', error);
    errorMessage.value = t('components.settings.localization.saveError', {
      message: messageFrom(error),
    });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
