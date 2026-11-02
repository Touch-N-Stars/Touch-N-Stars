<template>
  <section v-if="!store.calibrationUnsupported" class="tns-card flex flex-col gap-3">
    <h3 class="text-base font-semibold text-content">
      {{ t('plugins.livestack.settings.masters.title') }}
    </h3>
    <p class="text-sm text-content-muted">{{ t('plugins.livestack.settings.masters.note') }}</p>

    <p v-if="!library && store.calibrationLoadError" class="text-xs text-red-400">
      {{ loadErrorText }}
    </p>
    <p v-else-if="!library" class="text-xs text-content-muted">
      {{ t('plugins.livestack.settings.masters.loading') }}
    </p>

    <template v-else>
      <!-- A failed reload keeps the list on screen -->
      <p v-if="store.calibrationLoadError" class="text-xs text-red-400">
        {{ loadErrorText }}
      </p>
      <div v-for="group in groups" :key="group.type" class="flex flex-col gap-1">
        <h4 class="text-sm font-semibold text-content">
          {{ t(group.label) }} ({{ library[group.key].length }})
        </h4>
        <p v-if="!library[group.key].length" class="text-xs text-content-muted">
          {{ t('plugins.livestack.settings.masters.none') }}
        </p>
        <!-- The index keeps keys unique: desktop Livestack allows the same file twice -->
        <div
          v-for="(master, index) in library[group.key]"
          :key="`${master.Path}|${index}`"
          class="flex items-center gap-2 px-2 py-1 rounded-control border border-line bg-surface-2"
        >
          <div class="flex-1 min-w-0">
            <p class="text-xs font-mono text-content break-all">{{ master.FileName }}</p>
            <p class="text-xs font-mono text-content-muted break-all">
              {{ folderOf(master.Path) }}
            </p>
            <p class="text-xs text-content-muted">{{ describe(master) }}</p>
            <p v-if="!master.FileExists" class="text-xs text-amber-400">
              {{ t('plugins.livestack.settings.masters.missing_file') }}
            </p>
          </div>
          <button
            class="tns-btn-secondary w-auto! min-h-touch px-3! shrink-0"
            :disabled="locked || store.calibrationBusy"
            :aria-label="t('plugins.livestack.settings.masters.remove')"
            @click="onRemove(master)"
          >
            <TrashIcon class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Adding a master: pick the file, check what its header says, confirm -->
      <div
        v-if="draft"
        class="flex flex-col gap-2 p-2 rounded-control border border-accent/60 bg-surface-2"
      >
        <p class="text-xs font-mono text-content break-all">{{ draft.FileName }}</p>
        <p class="text-xs text-content-muted">{{ draft.Width }} × {{ draft.Height }}</p>

        <label class="text-xs text-content" for="livestack_master_type">
          {{ t('plugins.livestack.settings.masters.type') }}
        </label>
        <select id="livestack_master_type" v-model="draft.Type" class="tns-select w-full text-sm">
          <option v-for="group in groups" :key="group.type" :value="group.type">
            {{ t(group.label) }}
          </option>
        </select>
        <p v-if="!draft.Type" class="text-xs text-amber-400">
          {{ t('plugins.livestack.settings.masters.type_unknown') }}
        </p>

        <template v-if="draft.Type === 'BIAS' || draft.Type === 'DARK'">
          <NumberInputPicker
            v-model="draft.Gain"
            input-id="livestack_master_gain"
            :label="t('plugins.livestack.settings.masters.gain_label')"
            label-key="plugins.livestack.settings.masters.gain_label"
            :min="-1"
            :max="100000"
            :step="1"
            :decimal-places="0"
            :use-default-sentinel="false"
          />
          <NumberInputPicker
            v-model="draft.Offset"
            input-id="livestack_master_offset"
            :label="t('plugins.livestack.settings.masters.offset_label')"
            label-key="plugins.livestack.settings.masters.offset_label"
            :min="-1"
            :max="100000"
            :step="1"
            :decimal-places="0"
            :use-default-sentinel="false"
          />
        </template>
        <template v-if="draft.Type === 'DARK'">
          <NumberInputPicker
            v-model="draft.ExposureTime"
            input-id="livestack_master_exposure"
            :label="t('plugins.livestack.settings.masters.exposure_label')"
            label-key="plugins.livestack.settings.masters.exposure_label"
            :min="0"
            :max="36000"
            :step="1"
            :decimal-places="3"
            :use-default-sentinel="false"
          />
          <!-- Livestack's fallbacks for gain/offset "any" ignore the exposure time -->
          <p v-if="draft.Gain === -1 || draft.Offset === -1" class="text-xs text-amber-400">
            {{ t('plugins.livestack.settings.masters.dark_any_hint') }}
          </p>
        </template>
        <template v-if="draft.Type === 'FLAT'">
          <label class="text-xs text-content" for="livestack_master_filter">
            {{ t('plugins.livestack.settings.masters.filter_label') }}
          </label>
          <!-- Livestack matches the filter name exactly: no autocorrect, offer the wheel's names -->
          <input
            id="livestack_master_filter"
            v-model="draft.Filter"
            type="text"
            class="tns-input w-full text-sm"
            list="livestack_master_filters"
            autocapitalize="off"
            autocorrect="off"
            autocomplete="off"
            spellcheck="false"
            :placeholder="t('plugins.livestack.settings.masters.filter_placeholder')"
          />
          <datalist id="livestack_master_filters">
            <option v-for="name in filterNames" :key="name" :value="name" />
          </datalist>
        </template>

        <p v-if="store.calibrationBusy" class="text-xs text-content-muted">
          {{ t('plugins.livestack.settings.masters.reading') }}
        </p>

        <div class="flex flex-row gap-2">
          <button
            class="tns-btn-primary flex-1 min-h-touch"
            :disabled="!draft.Type || store.calibrationBusy || locked"
            @click="onAdd"
          >
            {{ t('plugins.livestack.settings.masters.confirm_add') }}
          </button>
          <button
            class="tns-btn-secondary flex-1 min-h-touch"
            :disabled="store.calibrationBusy"
            @click="draft = null"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>

      <button
        v-else
        class="tns-btn-secondary min-h-touch"
        :disabled="locked || store.calibrationBusy"
        @click="showBrowser = true"
      >
        {{ t('plugins.livestack.settings.masters.add') }}
      </button>

      <p v-if="errorText" class="text-xs text-red-400 break-words">{{ errorText }}</p>
      <p v-if="locked" class="text-xs text-content-muted">
        {{ t('plugins.livestack.settings.locked_hint') }}
      </p>
    </template>

    <FileBrowser
      v-model="showBrowser"
      mode="file"
      :file-extensions="['fits', 'fit']"
      :title="t('plugins.livestack.settings.masters.browser_title')"
      :initial-path="browserStartFolder"
      @select="onFileSelected"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { TrashIcon } from '@heroicons/vue/24/outline';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import FileBrowser from '@/components/helpers/fileBrowser.vue';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import { useLivestackStore } from '../store/livestackStore.js';

// Masters are added to and removed from Livestack's own library through the TNS plugin's
// /api/livestack/calibration; Livestack stores it in the profile itself.
const groups = [
  { type: 'BIAS', key: 'Bias', label: 'plugins.livestack.settings.masters.bias' },
  { type: 'DARK', key: 'Dark', label: 'plugins.livestack.settings.masters.dark' },
  { type: 'FLAT', key: 'Flat', label: 'plugins.livestack.settings.masters.flat' },
];

// Errors whose generic settings text would name the wrong thing here
const LIBRARY_ERROR_KEYS = {
  'path-not-absolute': 'plugins.livestack.settings.masters.file_path_invalid',
  'out-of-range': 'plugins.livestack.settings.masters.out_of_range',
  unknown: 'plugins.livestack.settings.masters.request_failed',
};

const store = useLivestackStore();
const mainStore = apiStore();
const toastStore = useToastStore();
const { t, te } = useI18n();

const showBrowser = ref(false);
const draft = ref(null);

const library = computed(() => store.calibration);

const locked = computed(() => store.status === 'running' || store.calibration?.IsStacking === true);

// The connected wheel's filters and the profile's, as suggestions for a flat's filter name
const filterNames = computed(() => {
  const names = [
    ...(mainStore.filterInfo?.AvailableFilters ?? []).map((f) => f?.Name),
    ...(mainStore.profileInfo?.FilterWheelSettings?.FilterWheelFilters ?? []).map((f) => f?.Name),
  ];
  return [...new Set(names.filter((name) => typeof name === 'string' && name.length))];
});

const errorText = computed(() => {
  const error = store.calibrationError;
  if (!error) {
    return '';
  }

  if (LIBRARY_ERROR_KEYS[error.code]) {
    return t(LIBRARY_ERROR_KEYS[error.code]);
  }

  const key = `plugins.livestack.settings.errors.${String(error.code).replaceAll('-', '_')}`;
  return te(key) ? t(key) : error.message;
});

// e.g. "Livestack plugin not available" rather than a generic "could not load"
const loadErrorText = computed(() => {
  const code = store.calibrationLoadErrorCode;
  const key = code && `plugins.livestack.settings.errors.${code.replaceAll('-', '_')}`;
  return key && te(key) ? t(key) : t('plugins.livestack.settings.masters.load_failed');
});

// Masters usually live together: start where the last one is, else in the working directory
const browserStartFolder = computed(() => {
  const masters = groups.flatMap((group) => library.value?.[group.key] ?? []);
  const last = masters[masters.length - 1];
  return last ? folderOf(last.Path) : store.settings?.WorkingDirectory;
});

function folderOf(path) {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : path;
}

function anyOr(value) {
  return value === -1 ? t('plugins.livestack.settings.masters.any') : value;
}

function describe(master) {
  const parts = [`${master.Width} × ${master.Height}`];
  if (master.Type === 'FLAT') {
    parts.push(t('plugins.livestack.settings.masters.filter', { value: master.Filter }));
  } else {
    parts.push(t('plugins.livestack.settings.masters.gain', { value: anyOr(master.Gain) }));
    parts.push(t('plugins.livestack.settings.masters.offset', { value: anyOr(master.Offset) }));
  }
  if (master.Type === 'DARK') {
    parts.push(t('plugins.livestack.settings.masters.exposure', { value: master.ExposureTime }));
  }
  return parts.join(' · ');
}

async function onFileSelected(path) {
  if (!path) {
    return;
  }

  const info = await store.inspectCalibrationMaster(path);
  if (info) {
    draft.value = { ...info, Filter: info.Filter ?? '' };
  }
}

async function onAdd() {
  const { Path, Type, Gain, Offset, ExposureTime, Filter } = draft.value;
  const added = await store.addCalibrationMaster({
    Path,
    Type,
    Gain: Math.round(Gain),
    Offset: Math.round(Offset),
    ExposureTime,
    Filter,
  });
  if (added) {
    draft.value = null;
  }
}

async function onRemove(master) {
  const confirmed = await toastStore.showConfirmation(
    t('plugins.livestack.settings.masters.remove_title'),
    t('plugins.livestack.settings.masters.remove_message', { name: master.FileName }),
    t('plugins.livestack.settings.masters.remove'),
    t('common.cancel')
  );
  if (confirmed) {
    await store.removeCalibrationMaster(master);
  }
}

// The lock follows the running state
watch(
  () => store.status,
  () => store.loadCalibration()
);

onMounted(() => {
  store.calibrationError = null;
  store.loadCalibration({ initial: true });
});
</script>
